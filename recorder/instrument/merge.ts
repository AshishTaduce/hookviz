import type { RawStep } from './stepper.js';
import type { EffectSnapshot, HookSnapshot, Phase, Step, Trace, TraceMeta, Variable } from './types.js';

/** `// @note ...` above a line becomes that line's note; `// @title` / `// @hook` set meta. */
export function parseAnnotations(source: string) {
  const lines = source.split('\n');
  const notes = new Map<number, string>();
  const meta: { title?: string; hook?: string } = {};
  let pending: string | null = null;

  lines.forEach((raw, idx) => {
    const text = raw.trim();
    const title = text.match(/^\/\/\s*@title\s+(.*)$/);
    if (title) { meta.title = title[1].trim(); return; }
    const hook = text.match(/^\/\/\s*@hook\s+(.*)$/);
    if (hook) { meta.hook = hook[1].trim(); return; }
    const note = text.match(/^\/\/\s*@note\s+(.*)$/);
    if (note) { pending = note[1].trim(); return; }
    if (pending && text && !text.startsWith('//')) {
      notes.set(idx + 1, pending);
      pending = null;
    }
  });

  return { notes, meta };
}

interface HookState {
  type: string;
  memoized: string;
  queue: string[];
  deps: string[] | null;
}

export function mergeSteps(
  raw: RawStep[],
  meta: Omit<TraceMeta, 'recordedAt'>,
): Trace {
  const hooks = new Map<number, HookState>();
  const effects = new Map<string, { deps: string[] | null; status: EffectSnapshot['status'] }>();
  const { notes } = parseAnnotations(meta.source);

  let phase: Phase = 'idle';
  let renderCount = 0;

  // `export const scenario` is recorder harness, not part of the lesson — its
  // events still count, but its lines never become visible steps.
  const scenarioLine = meta.source.split('\n').findIndex((l) => /^\s*export\s+(const|async\s+function|function)\s+scenario\b/.test(l));
  const firstHarnessLine = scenarioLine === -1 ? Infinity : scenarioLine + 1;

  const snapshots: Omit<Step, 'i'>[] = [];
  let lastVisibleLine = 0;

  const snapshot = (line: number, variables: Variable[], extra: Partial<Step> = {}) => {
    snapshots.push({
      line,
      phase,
      renderCount,
      variables,
      hooks: [...hooks.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([index, h]) => ({ index, type: h.type, memoized: h.memoized, queue: [...h.queue], deps: h.deps })),
      effects: [...effects.entries()].map(([id, e]) => ({ id, deps: e.deps, status: e.status })),
      ...extra,
    });
  };

  for (const step of raw) {
    for (const ev of step.events) {
      switch (ev.t) {
        case 'render-start':
          renderCount = ev.renderCount;
          phase = 'render';
          for (const h of hooks.values()) h.queue = [];
          break;
        case 'render-end':
          phase = 'commit';
          snapshot(lastVisibleLine, [], {
            synthetic: true,
            note: 'Render finished. React commits this tree to the DOM — effects have not run yet.',
          });
          break;
        case 'hook':
          hooks.set(ev.index, {
            type: ev.hookType,
            memoized: ev.memoized,
            queue: hooks.get(ev.index)?.queue ?? [],
            deps: ev.deps,
          });
          break;
        case 'enqueue': {
          const h = hooks.get(ev.index);
          if (h) h.queue.push(ev.update);
          break;
        }
        case 'effect-scheduled':
          effects.set(ev.id, { deps: ev.deps, status: 'scheduled' });
          break;
        case 'effect-fired': {
          const e = effects.get(ev.id);
          if (e) e.status = 'fired';
          break;
        }
        case 'effect-cleanup-pending': {
          const e = effects.get(ev.id);
          if (e) e.status = 'cleanup-pending';
          break;
        }
        case 'effect-cleaned-up': {
          const e = effects.get(ev.id);
          if (e) e.status = 'cleaned-up';
          break;
        }
        case 'phase':
          phase = ev.phase;
          break;
      }
    }

    if (step.line >= firstHarnessLine) continue;

    lastVisibleLine = step.line;
    snapshot(
      step.line,
      step.variables.map((v) => ({ name: v.name, value: v.value, kind: v.kind })),
      notes.has(step.line) ? { note: notes.get(step.line)! } : {},
    );
  }

  // Collapse consecutive pauses that say nothing new (esbuild emits several
  // breakpointable columns per original line).
  const deduped = snapshots.filter((s, i) => {
    if (i === 0) return true;
    const p = snapshots[i - 1];
    return !(
      s.line === p.line &&
      s.phase === p.phase &&
      s.renderCount === p.renderCount &&
      sameVars(s.variables, p.variables) &&
      sameHooks(s.hooks, p.hooks) &&
      JSON.stringify(s.effects) === JSON.stringify(p.effects)
    );
  });

  const steps: Step[] = deduped.map((s, i) => {
    const prev = deduped[i - 1];
    // Synthetic steps carry no scope, so diff variables against the last real
    // step — otherwise every variable would flash "changed" after a commit.
    const prevReal = deduped.slice(0, i).reverse().find((x) => !x.synthetic);
    return {
      i,
      ...s,
      variables: s.variables.map((v) => markVar(v, prevReal?.variables)),
      hooks: s.hooks.map((h) => markHook(h, prev?.hooks)),
    };
  });

  return {
    meta: { ...meta, recordedAt: new Date().toISOString() },
    steps,
  };
}

function markVar(v: Variable, prev?: Variable[]): Variable {
  const before = prev?.find((p) => p.name === v.name);
  return { ...v, changed: !before || before.value !== v.value };
}

function markHook(h: HookSnapshot, prev?: HookSnapshot[]): HookSnapshot {
  const before = prev?.find((p) => p.index === h.index);
  const changed =
    !before || before.memoized !== h.memoized || JSON.stringify(before.queue) !== JSON.stringify(h.queue);
  return { ...h, changed };
}

const sameVars = (a: Variable[], b: Variable[]) =>
  a.length === b.length && a.every((v, i) => v.name === b[i].name && v.value === b[i].value);

const sameHooks = (a: HookSnapshot[], b: HookSnapshot[]) =>
  a.length === b.length &&
  a.every((h, i) => h.index === b[i].index && h.memoized === b[i].memoized && JSON.stringify(h.queue) === JSON.stringify(b[i].queue));
