import type { RawStep } from './stepper.js';
import type { Annotation, AnnotationType, EffectSnapshot, HookSnapshot, Lane, Phase, Step, Trace, TraceMeta, Variable } from './types.js';

/** `label | detail`; if there's no `|`, the same text is used for both. */
function splitLabelDetail(rest: string): [string, string] {
  const bar = rest.indexOf('|');
  if (bar === -1) return [rest.trim(), rest.trim()];
  return [rest.slice(0, bar).trim(), rest.slice(bar + 1).trim()];
}

/**
 * `// @note ...` above a line becomes that line's note; `// @title` / `// @hook`
 * set meta; `// @annotate:<type> <label> | <detail>` above a line becomes a
 * `meta.annotations[]` entry line-anchored to it. Both `@note` and `@annotate`
 * attach to the next non-comment, non-blank line — same "marker sits above its
 * target" convention.
 */
export function parseAnnotations(source: string) {
  const lines = source.split('\n');
  const notes = new Map<number, string>();
  const meta: { title?: string; hook?: string } = {};
  const annotations: Annotation[] = [];
  let pending: string | null = null;
  let pendingAnnotation: Omit<Annotation, 'line'> | null = null;

  lines.forEach((raw, idx) => {
    const text = raw.trim();
    const title = text.match(/^\/\/\s*@title\s+(.*)$/);
    if (title) { meta.title = title[1].trim(); return; }
    const hook = text.match(/^\/\/\s*@hook\s+(.*)$/);
    if (hook) { meta.hook = hook[1].trim(); return; }
    const note = text.match(/^\/\/\s*@note\s+(.*)$/);
    if (note) { pending = note[1].trim(); return; }
    const annotate = text.match(/^\/\/\s*@annotate:(comment|function-decl|side-effect|closure)\s+(.*)$/);
    if (annotate) {
      const [label, detail] = splitLabelDetail(annotate[2]);
      pendingAnnotation = { type: annotate[1] as AnnotationType, label, detail };
      return;
    }
    if (pending && text && !text.startsWith('//')) {
      notes.set(idx + 1, pending);
      pending = null;
    }
    if (pendingAnnotation && text && !text.startsWith('//')) {
      annotations.push({ line: idx + 1, ...pendingAnnotation });
      pendingAnnotation = null;
    }
  });

  return { notes, meta, annotations };
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
  // Points at the synthetic commit snapshot most recently pushed, so a `dom`
  // event (which always arrives just after `render-end` — see doc 01 Stream 3)
  // can be patched onto it without a restructure.
  let lastCommitSnapshot: Omit<Step, 'i'> | null = null;

  const snapshot = (line: number, variables: Variable[], extra: Partial<Step> = {}) => {
    const s = {
      line,
      phase,
      renderCount,
      variables,
      hooks: [...hooks.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([index, h]) => ({ index, type: h.type, memoized: h.memoized, queue: [...h.queue], deps: h.deps })),
      effects: [...effects.entries()].map(([id, e]) => ({ id, deps: e.deps, status: e.status })),
      dom: null,
      lane: null,
      ...extra,
    };
    snapshots.push(s);
    return s;
  };

  for (const step of raw) {
    // Non-null when an `enqueue` drained in this pause's event batch carried a
    // semantic lane (doc 01, "Lane / priority capture") — attached to this
    // pause's own visible-step snapshot below, not the synthetic commit step.
    let stepLane: Lane | null = null;

    for (const ev of step.events) {
      switch (ev.t) {
        case 'render-start':
          renderCount = ev.renderCount;
          phase = 'render';
          for (const h of hooks.values()) h.queue = [];
          break;
        case 'render-end':
          phase = 'commit';
          lastCommitSnapshot = snapshot(lastVisibleLine, [], {
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
          if (ev.lane) stepLane = ev.lane;
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
        case 'dom':
          if (lastCommitSnapshot) lastCommitSnapshot.dom = ev.html;
          break;
      }
    }

    if (step.line >= firstHarnessLine) continue;

    lastVisibleLine = step.line;
    snapshot(
      step.line,
      step.variables.map((v) => ({ name: v.name, value: v.value, kind: v.kind })),
      {
        ...(notes.has(step.line) ? { note: notes.get(step.line)! } : {}),
        lane: stepLane,
      },
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
