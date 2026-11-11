/**
 * Child process entry point. Runs under `node --inspect-brk` so the parent
 * (stepper.ts) can drive it over CDP.
 *
 * Order matters:
 *   1. jsdom globals   (react-dom/client needs a DOM before it is imported)
 *   2. dispatcher wrapper installed
 *   3. example imported  -> its script hits scriptParsed, parent learns scriptId
 *   4. `debugger`        -> parent arms statement breakpoints on the example
 *   5. render + scenario -> every example statement now pauses the parent
 */
import { JSDOM } from 'jsdom';
import { pathToFileURL } from 'node:url';

const [, , compiledExamplePath] = process.argv;

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'https://hookviz.local/',
  pretendToBeVisual: true,
});

// Some of these (notably `navigator`) are getter-only globals in modern Node,
// so plain assignment throws — always go through defineProperty.
function defineGlobal(name: string, value: unknown) {
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
}

for (const name of [
  'document', 'HTMLElement', 'HTMLInputElement', 'Element', 'Node', 'Event',
  'MouseEvent', 'CustomEvent', 'getComputedStyle', 'DocumentFragment', 'Text',
]) {
  defineGlobal(name, (dom.window as unknown as Record<string, unknown>)[name]);
}
defineGlobal('window', dom.window);
defineGlobal('navigator', dom.window.navigator);
defineGlobal('requestAnimationFrame', dom.window.requestAnimationFrame.bind(dom.window));
defineGlobal('cancelAnimationFrame', dom.window.cancelAnimationFrame.bind(dom.window));
defineGlobal('IS_REACT_ACT_ENVIRONMENT', true);

const { install } = await import('./dispatcher.js');
const React = await import('react');
// `install()` must run before `react-dom/client` is imported: react-dom reads
// `__REACT_DEVTOOLS_GLOBAL_HOOK__` into a module-level `isDevToolsPresent` flag
// at import time, and every onCommitRoot() call is gated behind that flag —
// installing the shim later means it's never seen, so DOM events never fire.
const hookviz = install();
const { createRoot } = await import('react-dom/client');

// ---- virtual clock ---------------------------------------------------------
// Real timers made traces depend on how slow the debugger was: every pause adds real
// delay, so a 300ms timer could fire before a 100ms one started 1s later. Examples now
// get a fake clock that only moves when a scenario calls tick(ms). Installed AFTER
// react-dom loads, so React keeps the real timers it captured at import time.
const realSetTimeout = globalThis.setTimeout.bind(globalThis); // runner housekeeping only
type VirtualTimer = { id: number; due: number; fn: () => void; every: number | null };
let virtualNow = 0;
let virtualSeq = 0;
const virtualTimers = new Map<number, VirtualTimer>();
const addTimer = (fn: (...a: unknown[]) => void, ms: unknown, every: boolean, args: unknown[]) => {
  const delay = Math.max(every ? 1 : 0, Number(ms) || 0);
  const id = ++virtualSeq;
  virtualTimers.set(id, { id, due: virtualNow + delay, fn: () => fn(...args), every: every ? delay : null });
  return id;
};
(globalThis as any).setTimeout = (fn: (...a: unknown[]) => void, ms?: number, ...args: unknown[]) => addTimer(fn, ms, false, args);
(globalThis as any).setInterval = (fn: (...a: unknown[]) => void, ms?: number, ...args: unknown[]) => addTimer(fn, ms, true, args);
(globalThis as any).clearTimeout = (globalThis as any).clearInterval = (id: number) => { virtualTimers.delete(id); };
const flushMicrotasks = () => new Promise<void>((r) => setImmediate(r));

const exampleModule = await import(pathToFileURL(compiledExamplePath).href);
const Component = hookviz.wrapComponent(exampleModule.default);
const scenario = exampleModule.scenario as undefined | ((api: ScenarioApi) => Promise<void> | void);

interface ScenarioApi {
  click(selector: string): void;
  type(selector: string, value: string): void;
  tick(ms?: number): Promise<void>;
}

const container = document.getElementById('root')!;
const root = createRoot(container);
const act = (React as any).act as (cb: () => any) => Promise<void>;

const api: ScenarioApi = {
  click(selector) {
    const el = document.querySelector(selector);
    if (!el) throw new Error(`scenario.click: no element matches ${selector}`);
    hookviz.setPhase('event');
    // A sync act() flushes React's whole queue on exit: the render, the commit,
    // passive effects, AND any re-render those effects trigger. Without this, an
    // effect-triggered update only landed on the next event (or at unmount).
    act(() => {
      (el as HTMLElement).dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    });
  },
  type(selector, value) {
    const el = document.querySelector(selector) as HTMLInputElement | null;
    if (!el) throw new Error(`scenario.type: no element matches ${selector}`);
    hookviz.setPhase('event');
    const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!;
    setter.call(el, value);
    act(() => {
      el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
  },
  async tick(ms = 0) {
    const target = virtualNow + ms;
    if (process.env.HOOKVIZ_DEBUG) console.error(`[clock] tick(${ms}) now=${virtualNow} pending=${[...virtualTimers.values()].map((t) => `#${t.id}@${t.due}`).join(',')}`);
    // Let already-resolved promises settle first (e.g. a click that awaited something).
    await act(async () => { await flushMicrotasks(); });
    for (;;) {
      let next: VirtualTimer | undefined;
      for (const t of virtualTimers.values()) {
        if (t.due <= target && (!next || t.due < next.due || (t.due === next.due && t.id < next.id))) next = t;
      }
      if (!next) break;
      virtualNow = Math.max(virtualNow, next.due);
      if (next.every !== null) next.due = virtualNow + next.every;
      else virtualTimers.delete(next.id);
      const timer = next;
      if (process.env.HOOKVIZ_DEBUG) console.error(`[clock] t=${virtualNow} fire #${timer.id}`);
      // One act per timer callback, like one browser task: React renders and flushes
      // effects before the next timer fires, so frames match what a real page commits.
      await act(async () => {
        timer.fn();
        await flushMicrotasks();
      });
    }
    virtualNow = target;
  },

};

// Parent arms breakpoints on the example script here, while we are stopped.
debugger;

await act(() => {
  root.render(React.createElement(Component));
});

if (scenario) {
  // No outer act() here: click/type/tick each flush on their own (see above), so
  // the recorded frames match what a real browser would commit between events.
  await scenario({
    ...api,
    click: (s) => api.click(s),
  });
}

// Settle anything still in flight (resolved promises, effects they scheduled) so the last
// real frame commits on its own instead of being batched into the unmount below.
for (let i = 0; i < 3; i++) {
  await act(async () => {
    await flushMicrotasks();
  });
}

if (process.env.HOOKVIZ_DEBUG) console.error(`[clock] unmount now=${virtualNow} pending=${virtualTimers.size}`);
await act(() => {
  root.unmount();
});

hookviz.setPhase('idle');
hookviz.done = true;
// Sentinel tells the parent execution finished so it can do a final drain.
process.stdout.write('\n__HOOKVIZ_DONE__\n');
// Stay alive until the parent has drained the final events (unmount cleanups) and
// kills us. Exiting immediately raced the parent's last Runtime.evaluate and
// randomly dropped the tail step. The timeout is only a backstop.
await new Promise((resolve) => realSetTimeout(resolve, 15000));
