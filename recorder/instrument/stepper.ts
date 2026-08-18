import CDP from 'chrome-remote-interface';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';
import type { HookEvent } from './types.js';
import type { CompiledExample } from './build.js';

export interface RawVariable {
  name: string;
  value: string;
  kind: string;
}

export interface RawStep {
  line: number;
  variables: RawVariable[];
  events: HookEvent[];
}

/** Node internals + every dependency: we only ever want to stop inside the example. */
const BLACKBOX = [
  '/node_modules/react/.*',
  '/node_modules/react-dom/.*',
  '/node_modules/jsdom/.*',
  '/node_modules/scheduler/.*',
  'node:.*',
];

const INSPECT_PORT = 9339;
const MAX_STEPS = 5000;

interface CdpRemoteObject {
  type: string;
  subtype?: string;
  value?: unknown;
  unserializableValue?: string;
  description?: string;
  objectId?: string;
  className?: string;
}

export async function runExample(example: CompiledExample, opts: { verbose?: boolean } = {}): Promise<RawStep[]> {
  const runnerPath = process.env.HOOKVIZ_RUNNER!;
  const exampleUrl = pathToFileURL(example.outPath).href;
  const tracer = new TraceMap(JSON.parse(example.rawSourceMap));

  const child = spawn(
    process.execPath,
    [`--inspect-brk=${INSPECT_PORT}`, runnerPath, example.outPath],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );

  const wsUrl = await new Promise<string>((resolve, reject) => {
    let buf = '';
    const timer = setTimeout(() => reject(new Error('timed out waiting for inspector')), 15_000);
    child.stderr.on('data', (d) => {
      buf += d.toString();
      const m = buf.match(/ws:\/\/\S+/);
      if (m) {
        clearTimeout(timer);
        resolve(m[0]);
      }
      if (opts.verbose) process.stderr.write(d);
    });
    child.on('exit', (code) => reject(new Error(`runner exited early (code ${code})\n${buf}`)));
  });

  let sawDone = false;
  let childStderr = '';
  child.stderr.on('data', (d) => { childStderr += d.toString(); });

  const donePromise = new Promise<void>((resolve, reject) => {
    let buf = '';
    child.stdout.on('data', (d) => {
      buf += d.toString();
      if (opts.verbose) process.stdout.write(d);
      if (buf.includes('__HOOKVIZ_DONE__')) {
        sawDone = true;
        resolve();
      }
    });
    child.on('exit', (code) => {
      if (sawDone || code === 0) resolve();
      else reject(new Error(`runner crashed (exit ${code}):\n${childStderr}`));
    });
  });

  const client = await CDP({ target: wsUrl });
  const { Debugger, Runtime } = client;

  const steps: RawStep[] = [];
  let exampleScriptId: string | null = null;
  let breakpointsArmed = false;
  let failure: Error | null = null;

  const mapLine = (generatedLine0: number, generatedCol0: number): number | null => {
    const pos = originalPositionFor(tracer, { line: generatedLine0 + 1, column: generatedCol0 });
    return pos.line ?? null;
  };

  async function formatValue(callFrameId: string, name: string, ro: CdpRemoteObject): Promise<string> {
    if (ro.unserializableValue) return ro.unserializableValue;
    if (ro.type === 'function') return `ƒ ${(ro.description ?? '').split('(')[0].replace(/^function\s*/, '').trim() || 'anonymous'}()`;
    if (ro.type === 'object' && ro.subtype !== 'null') {
      const { result } = await Debugger.evaluateOnCallFrame({
        callFrameId,
        expression: `(()=>{try{return JSON.stringify(${name})}catch(e){return String(${name})}})()`,
        returnByValue: true,
        silent: true,
      });
      if (typeof result.value === 'string') return result.value;
      return ro.description ?? 'Object';
    }
    if ('value' in ro) return typeof ro.value === 'string' ? JSON.stringify(ro.value) : String(ro.value);
    return ro.description ?? ro.type;
  }

  async function readVariables(frame: any): Promise<RawVariable[]> {
    const out: RawVariable[] = [];
    const seen = new Set<string>();
    for (const scope of frame.scopeChain) {
      if (!['local', 'block', 'closure'].includes(scope.type)) continue;
      if (!scope.object?.objectId) continue;
      const { result } = await Runtime.getProperties({
        objectId: scope.object.objectId,
        ownProperties: true,
        generatePreview: false,
      });
      for (const prop of result) {
        if (seen.has(prop.name) || prop.name === 'this' || prop.name === 'arguments') continue;
        if (!prop.value) continue;
        seen.add(prop.name);
        out.push({
          name: prop.name,
          value: await formatValue(frame.callFrameId, prop.name, prop.value as CdpRemoteObject),
          kind: (prop.value as CdpRemoteObject).subtype ?? (prop.value as CdpRemoteObject).type,
        });
      }
    }
    return out;
  }

  async function drain(callFrameId: string): Promise<HookEvent[]> {
    const { result } = await Debugger.evaluateOnCallFrame({
      callFrameId,
      expression: 'JSON.stringify(globalThis.__HOOKVIZ__ ? globalThis.__HOOKVIZ__.drain() : [])',
      returnByValue: true,
      silent: true,
    });
    try {
      return typeof result.value === 'string' ? JSON.parse(result.value) : [];
    } catch {
      return [];
    }
  }

  async function armBreakpoints() {
    if (breakpointsArmed || !exampleScriptId) return;
    breakpointsArmed = true;
    const { locations } = await Debugger.getPossibleBreakpoints({
      start: { scriptId: exampleScriptId, lineNumber: 0, columnNumber: 0 },
      restrictToFunction: false,
    });
    let ok = 0;
    for (const loc of locations) {
      try {
        await Debugger.setBreakpoint({ location: loc });
        ok++;
      } catch (e) {
        if (opts.verbose) console.error(`[stepper] setBreakpoint failed @${loc.lineNumber}:${loc.columnNumber}`, e);
      }
    }
    if (opts.verbose) console.error(`[stepper] armed ${ok}/${locations.length} breakpoints on ${exampleUrl}`);
  }

  Debugger.scriptParsed(({ url, scriptId }: { url: string; scriptId: string }) => {
    if (url === exampleUrl) exampleScriptId = scriptId;
  });

  // Pauses arrive as events; serialise handling so awaits never interleave.
  let chain: Promise<void> = Promise.resolve();
  Debugger.paused((params: any) => {
    chain = chain.then(() => handlePause(params)).catch((e) => {
      failure ??= e as Error;
    });
  });

  async function handlePause(params: any) {
    const frame = params.callFrames[0];
    // Node reports an empty `url` on call frames; `location.scriptId` is authoritative.
    const inExample = frame.location.scriptId === exampleScriptId;
    if (opts.verbose) {
      console.error(`[pause] reason=${params.reason} inExample=${inExample} genLine=${frame.location.lineNumber}`);
    }

    if (params.reason === 'Break on start') {
      await Debugger.resume();
      return;
    }

    // The `debugger` statement inside runner.ts: example is loaded, arm breakpoints now.
    if (!breakpointsArmed && !inExample) {
      await armBreakpoints();
      await Debugger.resume();
      return;
    }

    if (!inExample || steps.length >= MAX_STEPS) {
      await Debugger.resume();
      return;
    }

    const line = mapLine(frame.location.lineNumber, frame.location.columnNumber ?? 0);
    const events = await drain(frame.callFrameId);
    const variables = await readVariables(frame);

    if (line !== null) steps.push({ line, variables, events });
    await Debugger.resume();
  }

  await Debugger.enable();
  await Runtime.enable();
  await Debugger.setBlackboxPatterns({ patterns: BLACKBOX });
  await Runtime.runIfWaitingForDebugger();

  await donePromise;
  await chain;

  // Anything emitted after the final example statement (unmount cleanups, phase changes).
  if (sawDone) {
    try {
      const { result } = await Runtime.evaluate({
        expression: 'JSON.stringify(globalThis.__HOOKVIZ__ ? globalThis.__HOOKVIZ__.drain() : [])',
        returnByValue: true,
        silent: true,
      });
      const tail: HookEvent[] = typeof result.value === 'string' ? JSON.parse(result.value) : [];
      if (tail.length && steps.length) steps.push({ line: steps[steps.length - 1].line, variables: [], events: tail });
    } catch {
      /* child may already be gone */
    }
  }

  await client.close().catch(() => {});
  child.kill();

  if (failure) throw failure;
  if (!steps.length) throw new Error('no steps recorded — breakpoints never hit inside the example');
  return steps;
}
