import type { Phase, PhaseSegment, Trace } from '@/types/trace';

// Module-level cache: traceId → PhaseSegment[]
const segmentCache = new Map<string, PhaseSegment[]>();
// Module-level cache: traceId → commit step indices
const commitCache = new Map<string, number[]>();

export function getPhaseSegments(trace: Trace): PhaseSegment[] {
  const cached = segmentCache.get(trace.meta.id);
  if (cached) return cached;

  const segments: PhaseSegment[] = [];
  const steps = trace.steps;
  if (steps.length === 0) return [];

  let currentPhase: Phase = steps[0].phase;
  let start = 0;

  for (let i = 1; i < steps.length; i++) {
    if (steps[i].phase !== currentPhase) {
      segments.push({ start, end: i - 1, phase: currentPhase });
      currentPhase = steps[i].phase;
      start = i;
    }
  }
  segments.push({ start, end: steps.length - 1, phase: currentPhase });

  segmentCache.set(trace.meta.id, segments);
  return segments;
}

export function getCommitStepIndices(trace: Trace): number[] {
  const cached = commitCache.get(trace.meta.id);
  if (cached) return cached;

  const indices = trace.steps
    .filter((s) => s.phase === 'commit' && s.dom !== null)
    .map((s) => s.i);

  commitCache.set(trace.meta.id, indices);
  return indices;
}

export const PHASE_COLORS: Record<Phase, string> = {
  render: '#3b82f6',         // blue-500
  commit: '#f59e0b',         // amber-500
  'passive-effect': '#22c55e', // green-500
  event: '#a855f7',          // purple-500
  idle: '#6b7280',           // gray-500
};

export const PHASE_LABELS: Record<Phase, string> = {
  render: 'render',
  commit: 'commit',
  'passive-effect': 'passive-effect',
  event: 'event',
  idle: 'idle',
};
