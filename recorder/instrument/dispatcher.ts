import * as React from 'react';
import type { HookEvent, Phase } from './types.js';

const INTERNALS_KEY = '__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE';

/** Hooks whose return value is `[value, setter]` — the setter gets wrapped to record the update queue. */
const TUPLE_HOOKS = new Set(['useState', 'useReducer', 'useOptimistic', 'useActionState']);

export function serialize(v: unknown): string {
  if (typeof v === 'function') return `ƒ ${v.name || 'anonymous'}()`;
  if (typeof v === 'symbol') return v.toString();
  if (typeof v === 'bigint') return `${v}n`;
  if (v === undefined) return 'undefined';
  if (v === null) return 'null';
  if (typeof v !== 'object') return JSON.stringify(v) ?? String(v);
  try {
    const seen = new WeakSet();
    return JSON.stringify(v, (_k, val) => {
      if (typeof val === 'function') return `ƒ ${val.name || 'anonymous'}()`;
      if (typeof val === 'object' && val !== null) {
        if (seen.has(val)) return '[Circular]';
        seen.add(val);
      }
      return val;
    }) ?? String(v);
  } catch {
    return String(v);
  }
}

/** Pull the "memoized value" a user would recognise out of a hook's return value. */
function memoizedOf(hookType: string, result: unknown): string {
  if (TUPLE_HOOKS.has(hookType) && Array.isArray(result)) return serialize(result[0]);
  if (hookType === 'useTransition' && Array.isArray(result)) return serialize(result[0]);
  if (hookType === 'useRef' && result && typeof result === 'object') {
    return serialize((result as { current: unknown }).current);
  }
  if (hookType === 'useEffect' || hookType === 'useLayoutEffect' || hookType === 'useInsertionEffect') {
    return 'undefined';
  }
  return serialize(result);
}

function depsOf(args: unknown[]): string[] | null {
  const deps = args[1];
  if (!Array.isArray(deps)) return null;
  return deps.map(serialize);
}

interface EffectRecord {
  prevDeps: string[] | null;
  cleanup: (() => void) | null;
}

export interface Hookviz {
  drain(): HookEvent[];
  setPhase(phase: Phase): void;
  /**
   * React's DEV build reassigns `ReactSharedInternals.H` between every hook call
   * to detect nested hooks, so dispatcher swaps are useless as render delimiters.
   * Wrapping the component gives us exact render boundaries instead.
   */
  wrapComponent<P extends object>(Component: React.FunctionComponent<P>): React.FunctionComponent<P>;
  done: boolean;
}

export function install(): Hookviz {
  const internals = (React as unknown as Record<string, any>)[INTERNALS_KEY];
  if (!internals) throw new Error(`React internals (${INTERNALS_KEY}) not found — unsupported React version`);

  const events: HookEvent[] = [];
  const emit = (e: HookEvent) => events.push(e);

  let hookIndex = 0;
  let renderCount = 0;
  let phase: Phase = 'idle';

  const setPhase = (next: Phase) => {
    if (next === phase) return;
    phase = next;
    emit({ t: 'phase', phase: next });
  };

  /** Stable-identity wrappers, keyed by hook index, so setter identity survives re-renders. */
  const setterCache = new Map<number, { orig: unknown; wrapped: (...a: unknown[]) => unknown }>();
  const effects = new Map<string, EffectRecord>();
  const wrappedDispatchers = new WeakMap<object, object>();
  /**
   * React DEV reads `H` (already our proxy), swaps in a nested-hook guard, then
   * restores what it read. Without this guard we would wrap our own proxy again
   * on every hook call, and each extra layer would double-count the hook index.
   */
  const ourProxies = new WeakSet<object>();

  function wrapSetter(index: number, orig: unknown) {
    const cached = setterCache.get(index);
    if (cached && cached.orig === orig) return cached.wrapped;
    const wrapped = (...args: unknown[]) => {
      emit({ t: 'enqueue', index, update: serialize(args[0]) });
      return (orig as (...a: unknown[]) => unknown)(...args);
    };
    setterCache.set(index, { orig, wrapped });
    return wrapped;
  }

  function wrapEffectArgs(id: string, args: unknown[]): unknown[] {
    const create = args[0] as () => (() => void) | void;
    if (typeof create !== 'function') return args;
    const deps = depsOf(args);
    const record = effects.get(id) ?? { prevDeps: null, cleanup: null };

    // React only re-runs the effect when deps are absent or shallow-changed.
    const willRun =
      !effects.has(id) || deps === null || record.prevDeps === null ||
      deps.length !== record.prevDeps.length ||
      deps.some((d, i) => d !== record.prevDeps![i]);

    if (willRun) {
      emit({ t: 'effect-scheduled', id, deps });
      if (record.cleanup) emit({ t: 'effect-cleanup-pending', id });
    }
    record.prevDeps = deps;
    effects.set(id, record);

    const wrappedCreate = () => {
      const prevPhase = phase;
      if (record.cleanup) {
        setPhase('passive-effect');
        emit({ t: 'effect-cleaned-up', id });
        try { record.cleanup(); } finally { record.cleanup = null; }
      }
      setPhase('passive-effect');
      emit({ t: 'effect-fired', id });
      const cleanup = create();
      record.cleanup = typeof cleanup === 'function' ? cleanup : null;
      setPhase(prevPhase === 'passive-effect' ? 'idle' : prevPhase);
      // Hand React its own teardown so unmount cleanup is also captured.
      return typeof cleanup === 'function'
        ? () => {
            setPhase('passive-effect');
            emit({ t: 'effect-cleaned-up', id });
            record.cleanup = null;
            cleanup();
            setPhase('idle');
          }
        : cleanup;
    };
    return [wrappedCreate, args[1]];
  }

  function wrapDispatcher(d: object): object {
    if (ourProxies.has(d)) return d;
    const existing = wrappedDispatchers.get(d);
    if (existing) return existing;

    const proxy = new Proxy(d, {
      get(target, prop, receiver) {
        const orig = Reflect.get(target, prop, receiver);
        const name = String(prop);
        if (typeof orig !== 'function' || !name.startsWith('use')) return orig;

        return function instrumentedHook(...args: unknown[]) {
          const index = hookIndex++;
          const isEffect = name === 'useEffect' || name === 'useLayoutEffect' || name === 'useInsertionEffect';
          const effectId = `e${index}`;
          const callArgs = isEffect ? wrapEffectArgs(effectId, args) : args;

          const result = (orig as (...a: unknown[]) => unknown).apply(target, callArgs);

          emit({
            t: 'hook',
            index,
            hookType: name,
            memoized: memoizedOf(name, result),
            deps: isEffect || name === 'useMemo' || name === 'useCallback' ? depsOf(args) : null,
          });

          if (TUPLE_HOOKS.has(name) && Array.isArray(result)) {
            return [result[0], wrapSetter(index, result[1])];
          }
          return result;
        };
      },
    });

    wrappedDispatchers.set(d, proxy);
    ourProxies.add(proxy);
    return proxy;
  }

  let current = internals.H;
  Object.defineProperty(internals, 'H', {
    configurable: true,
    get: () => current,
    set: (next: object | null) => {
      current = next ? wrapDispatcher(next) : next;
    },
  });

  const api: Hookviz = {
    drain() {
      const out = events.slice();
      events.length = 0;
      return out;
    },
    setPhase,
    wrapComponent(Component) {
      const wrapped = (props: any) => {
        hookIndex = 0;
        renderCount++;
        emit({ t: 'render-start', renderCount });
        setPhase('render');
        try {
          return Component(props);
        } finally {
          emit({ t: 'render-end' });
          setPhase('commit');
        }
      };
      Object.defineProperty(wrapped, 'name', { value: Component.name || 'Example' });
      return wrapped;
    },
    done: false,
  };
  (globalThis as Record<string, unknown>).__HOOKVIZ__ = api;
  return api;
}
