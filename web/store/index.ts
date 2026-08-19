'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import type { Trace } from '@/types/trace';

// ---------------------------------------------------------------------------
// Slice types
// ---------------------------------------------------------------------------

type TraceSlice = {
  traceId: string | null;
  trace: Trace | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  loadTrace: (id: string) => Promise<void>;
};

type PlaybackSlice = {
  stepIndex: number;
  isPlaying: boolean;
  speed: 0.5 | 1 | 2 | 4;
  mode: 'replay' | 'live'; // v1 hardcodes 'replay'
  play: () => void;
  pause: () => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (i: number) => void;
  setSpeed: (s: 0.5 | 1 | 2 | 4) => void;
};

type UISlice = {
  audience: 'guided' | 'expert';
  breadcrumbPopover:
    | { open: false }
    | { open: true; scope: 'root' | 'category' | 'hook' | 'example' };
  commandPaletteOpen: boolean;
  fontSize: number; // base UI font size, 10–20px
  setAudience: (a: 'guided' | 'expert') => void;
  openPopover: (scope: 'root' | 'category' | 'hook' | 'example') => void;
  closePopover: () => void;
  toggleCommandPalette: () => void;
  increaseFontSize: () => void;
  decreaseFontSize: () => void;
};

export type StoreState = TraceSlice & PlaybackSlice & UISlice;

// ---------------------------------------------------------------------------
// Playback interval — module-scoped ref, not store state
// ---------------------------------------------------------------------------

let intervalId: ReturnType<typeof setInterval> | null = null;

function clearPlaybackInterval() {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      // --- TraceSlice ---
      traceId: null,
      trace: null,
      status: 'idle',
      error: null,

      loadTrace: async (id: string) => {
        set({ status: 'loading', error: null, traceId: id });
        clearPlaybackInterval();
        try {
          // Forward-compat seam: static import today, fetch('/api/record') tomorrow.
          // Dynamic import is handled by Next.js's route-based code splitting.
          const mod = await import(`@/../recorder/out/${id}.trace.json`);
          const trace = mod.default as Trace;
          set({
            trace,
            status: 'ready',
            stepIndex: 0,
            isPlaying: false,
          });
        } catch (err) {
          set({
            status: 'error',
            error: err instanceof Error ? err.message : String(err),
          });
        }
      },

      // --- PlaybackSlice ---
      stepIndex: 0,
      isPlaying: false,
      speed: 1,
      mode: 'replay',

      play: () => {
        const { trace, stepIndex, speed } = get();
        if (!trace || stepIndex >= trace.steps.length - 1) return;

        clearPlaybackInterval();
        set({ isPlaying: true });

        const ms = 1000 / speed;
        intervalId = setInterval(() => {
          const { stepIndex: current, trace: t } = get();
          if (!t || current >= t.steps.length - 1) {
            clearPlaybackInterval();
            set({ isPlaying: false });
            return;
          }
          set({ stepIndex: current + 1 });
        }, ms);
      },

      pause: () => {
        clearPlaybackInterval();
        set({ isPlaying: false });
      },

      toggle: () => {
        const { isPlaying } = get();
        if (isPlaying) {
          get().pause();
        } else {
          get().play();
        }
      },

      next: () => {
        const { trace, stepIndex, isPlaying } = get();
        if (isPlaying) get().pause();
        if (!trace) return;
        set({ stepIndex: Math.min(stepIndex + 1, trace.steps.length - 1) });
      },

      prev: () => {
        const { stepIndex, isPlaying } = get();
        if (isPlaying) get().pause();
        set({ stepIndex: Math.max(stepIndex - 1, 0) });
      },

      seek: (i: number) => {
        const { trace, isPlaying } = get();
        if (isPlaying) get().pause();
        if (!trace) return;
        set({ stepIndex: Math.max(0, Math.min(i, trace.steps.length - 1)) });
      },

      setSpeed: (s: 0.5 | 1 | 2 | 4) => {
        const { isPlaying } = get();
        set({ speed: s });
        // If currently playing, restart interval with new speed
        if (isPlaying) {
          get().pause();
          get().play();
        }
      },

      // --- UISlice ---
      audience: 'guided',
      breadcrumbPopover: { open: false },
      commandPaletteOpen: false,
      fontSize: 13,

      setAudience: (a) => set({ audience: a }),

      openPopover: (scope) => set({ breadcrumbPopover: { open: true, scope } }),

      closePopover: () => set({ breadcrumbPopover: { open: false } }),

      toggleCommandPalette: () =>
        set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),

      increaseFontSize: () =>
        set((s) => ({ fontSize: Math.min(20, s.fontSize + 1) })),

      decreaseFontSize: () =>
        set((s) => ({ fontSize: Math.max(10, s.fontSize - 1) })),
    }),
    {
      name: 'hookviz.ui',
      storage: createJSONStorage(() => localStorage),
      // Only persist UISlice preferences — not trace data or playback state
      partialize: (state) => ({
        audience: state.audience,
        fontSize: state.fontSize,
      }),
      // skipHydration prevents the SSR→client mismatch: the server renders
      // with default state; the client rehydrates from localStorage explicitly
      // via useStore.persist.rehydrate() in PlayerShell after mount.
      skipHydration: true,
    }
  )
);

// ---------------------------------------------------------------------------
// Narrow selector hooks per panel
// (useShallow on array-valued selectors; scalar ones use default ref equality)
// ---------------------------------------------------------------------------

// useShallow on every selector that returns an object or array — Zustand's
// useSyncExternalStore requires getSnapshot to return a stable reference, or
// React will loop infinitely detecting a "new" value on every render.
export const useCurrentStep = () =>
  useStore(useShallow((s) =>
    s.mode === 'replay' && s.trace ? s.trace.steps[s.stepIndex] : null
  ));

export const useDomHtml = () =>
  useStore((s) => s.trace?.steps[s.stepIndex]?.dom ?? null);

export const useHooks = () =>
  useStore(useShallow((s) => s.trace?.steps[s.stepIndex]?.hooks));

export const useEffectsList = () =>
  useStore(useShallow((s) => s.trace?.steps[s.stepIndex]?.effects));

export const useVariables = () =>
  useStore(useShallow((s) => s.trace?.steps[s.stepIndex]?.variables));

export const useCodeCursor = () =>
  useStore(useShallow((s) => {
    const st = s.trace?.steps[s.stepIndex];
    return st ? { line: st.line, phase: st.phase } : null;
  }));

export const useStepNote = () =>
  useStore((s) => s.trace?.steps[s.stepIndex]?.note ?? null);
