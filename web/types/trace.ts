// TypeScript types mirroring the trace JSON schema (schemaVersion 2)

export type Lane = 'transition' | 'optimistic' | 'sync' | null;

export type Phase = 'render' | 'commit' | 'passive-effect' | 'idle' | 'event';

export type AnnotationType = 'comment' | 'function-decl' | 'side-effect' | 'closure';

export interface Annotation {
  line: number;
  type: AnnotationType;
  label: string;
  detail: string;
}

export interface HookSnapshot {
  index: number;
  type: string;
  memoized: string;
  queue: string[];
  deps: string[] | null;
  changed: boolean;
}

export type EffectStatus = 'scheduled' | 'fired' | 'cleanup-pending' | 'cleaned-up';

export interface EffectSnapshot {
  id: string;
  deps: string[];
  status: EffectStatus;
}

export interface Variable {
  name: string;
  value: string;
  kind: string;
  changed: boolean;
}

export interface TraceMeta {
  schemaVersion: number;
  id: string;
  title: string;
  hook: string;
  category: string;
  reactVersion: string;
  source: string;
  recordedAt: string;
  annotations: Annotation[];
}

export interface Step {
  i: number;
  line: number;
  phase: Phase;
  renderCount: number;
  variables: Variable[];
  hooks: HookSnapshot[];
  effects: EffectSnapshot[];
  dom: string | null;
  lane: Lane;
  note?: string;
  synthetic?: boolean;
}

export interface Trace {
  meta: TraceMeta;
  steps: Step[];
}

// Catalog entry — only the fields needed for navigation, no steps
export interface CatalogEntry {
  id: string;
  title: string;
  hook: string;
  category: string;
}

// Phase segment for the timeline bar
export interface PhaseSegment {
  start: number; // step index (inclusive)
  end: number;   // step index (inclusive)
  phase: Phase;
}
