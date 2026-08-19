export type Phase = 'render' | 'commit' | 'passive-effect' | 'idle' | 'event';

export type EffectStatus = 'scheduled' | 'fired' | 'cleanup-pending' | 'cleaned-up';

/** Semantic scheduling priority, captured at the call site — never a React lane bitmask. See dispatcher.ts. */
export type Lane = 'transition' | 'optimistic';

export type AnnotationType = 'comment' | 'function-decl' | 'side-effect' | 'closure';

export interface Annotation {
  line: number;
  type: AnnotationType;
  label: string;
  detail: string;
}

export interface Variable {
  name: string;
  value: string;
  kind: string;
  changed?: boolean;
}

export interface HookSnapshot {
  index: number;
  type: string;
  memoized: string;
  queue: string[];
  /** Present for dependency-taking hooks (useEffect/useMemo/useCallback); null when omitted. */
  deps?: string[] | null;
  changed?: boolean;
}

export interface EffectSnapshot {
  id: string;
  deps: string[] | null;
  status: EffectStatus;
}

export interface Step {
  i: number;
  line: number;
  phase: Phase;
  renderCount: number;
  variables: Variable[];
  hooks: HookSnapshot[];
  effects: EffectSnapshot[];
  note?: string;
  /**
   * True for steps the recorder inserts rather than observes. Commit runs
   * entirely inside React, so no example statement executes during it and no
   * breakpoint can fire — but the phase still has to be visible in the player.
   */
  synthetic?: boolean;
  /** Rendered markup, set only on commit-phase steps. See Stream 3 in doc 01. */
  dom?: string | null;
  /** Set on the step where a useTransition/useOptimistic update is scheduled; null otherwise. */
  lane?: Lane | null;
}

export interface TraceMeta {
  schemaVersion: number;
  id: string;
  title: string;
  hook: string;
  /** Groups examples for breadcrumb navigation — the hook name lowercased by default. */
  category: string;
  reactVersion: string;
  source: string;
  recordedAt: string;
  /** Hand-authored, line-anchored markers. Optional — an unannotated example still works. */
  annotations?: Annotation[];
}

export interface Trace {
  meta: TraceMeta;
  steps: Step[];
}

/**
 * Events emitted by the in-process dispatcher wrapper. The parent drains these
 * at every debugger pause, which is what ties them to a CDP step index.
 */
export type HookEvent =
  | { t: 'render-start'; renderCount: number }
  | { t: 'render-end' }
  | { t: 'hook'; index: number; hookType: string; memoized: string; deps: string[] | null }
  | { t: 'enqueue'; index: number; update: string; lane?: Lane | null }
  | { t: 'effect-scheduled'; id: string; deps: string[] | null }
  | { t: 'effect-fired'; id: string }
  | { t: 'effect-cleanup-pending'; id: string }
  | { t: 'effect-cleaned-up'; id: string }
  | { t: 'phase'; phase: Phase }
  | { t: 'dom'; html: string };
