# HookViz — Project Brief for Claude Code

## What we're building

An interactive React hooks visualizer — like [jsv9000.app](https://www.jsv9000.app/) but for React hooks instead of the JS event loop.

Users see a real component example, watch it execute **line by line**, and simultaneously see the **hooks linked list**, **effects queue**, **live variables**, and **render phase** update in real time as each statement runs.

---

## Core architecture decision

**Build-time trace recording + frontend replay player.** Not a live sandbox, not hand-animated.

### How it works

1. Each example is a **real React component** written in a file under `recorder/examples/`.
2. A **Node recorder script** runs each example through the **Chrome DevTools Protocol (CDP)** — a real V8 debugger. It steps statement-by-statement, capturing line number + live scope variables at each pause. Simultaneously, React's internal hook dispatcher is wrapped to emit hook-state snapshots (hooks linked list, effects queue, render phase, render count) keyed to the same step index.
3. Both streams are **merged into a single `*.trace.json`** file per example and committed to the repo under `recorder/out/`.
4. The **Next.js frontend** is a dumb replay player — it reads the committed trace JSON, and a Zustand store's `stepIndex` drives every panel. No live execution, no sandboxing, no security surface.

### Why this approach
- **Real V8 debugger** = real line numbers + real live variable values, not hand-authored animations.
- **Real React** = accurate hook semantics (not a mini-reimplementation).
- **Static trace JSON** = dirt cheap to host, instant load, no runtime risk.
- **"Add a PR" sustainability** = new example is just: write the component → run recorder → commit the JSON. No per-example animation work.

---

## Monorepo structure

```
hookviz/
├── recorder/
│   ├── examples/          # one .tsx file per example, real React components
│   ├── instrument/        # CDP stepping driver + dispatcher wrapper
│   └── out/               # generated *.trace.json (committed to git)
└── web/                   # Next.js replay player
    ├── app/
    ├── components/
    │   ├── CodePanel/     # Shiki-highlighted source, line highlight driven by stepIndex
    │   ├── HooksPanel/    # hooks linked list visualization
    │   ├── EffectsPanel/  # effects queue (scheduled/fired/cleaned up)
    │   ├── VariablesPanel/# live variable values
    │   └── Player/        # prev/next/play controls + phase indicator
    └── store/             # Zustand: { traceId, stepIndex, isPlaying }
```

---

## Trace JSON schema

Every example produces one file: `recorder/out/<example-id>.trace.json`

```jsonc
{
  "meta": {
    "id": "usestate-counter",
    "title": "useState — basic counter",
    "hook": "useState",
    "reactVersion": "19.2.8",
    "source": "/* full example source string for the code panel */",
    "recordedAt": "2026-08-16T…"
  },
  "steps": [
    {
      "i": 0,                      // step index (shared clock between CDP + dispatcher)
      "line": 4,                   // 1-based line number in meta.source
      "phase": "render",           // render | commit | passive-effect | idle | event
      "renderCount": 1,
      "variables": [
        { "name": "count", "value": "0", "kind": "number", "changed": true }
      ],
      "hooks": [
        {
          "index": 0,
          "type": "useState",
          "memoized": "0",         // current memoized value
          "queue": [],             // pending update queue
          "changed": true          // precomputed diff flag for animations
        }
      ],
      "effects": [
        { "id": "e0", "deps": ["count"], "status": "scheduled" }
        // status: scheduled | fired | cleanup-pending | cleaned-up
      ],
      "note": "Initial render: useState returns initial value 0"
      // note is optional, hand-authored per step in the example file
    }
  ]
}
```

Key schema decisions:
- `changed: true` flags are **precomputed at record time** (diff vs previous step) — frontend stays dumb, just reads the flag.
- `phase` makes the render → commit → passive-effect lifecycle **visually explicit** — the core thing most hook tutorials fail to teach.
- `note` is the only hand-authored field, optional. Auto-generate a default, let PR authors override.
- For concurrent hooks (`useTransition`, `useOptimistic`), add optional `lane` / `priority` field to the step.

---

## Recorder — key implementation notes

### CDP stepping with React frame blackboxing

Naive statement-stepping drags through hundreds of React internal frames per example. Must filter to only pause on frames whose script URL matches the example file. Use `Debugger.setBlackboxPatterns` to skip `node_modules/react*` and `node_modules/react-dom*`.

### Dispatcher instrumentation

React's hook dispatcher lives at `ReactCurrentDispatcher.current` during render. Wrap it before the example renders:
- Intercept each hook call (`useState`, `useEffect`, etc.)
- After each call, snapshot the fiber's `memoizedState` linked list
- Emit an event tagged with the current CDP step index

### React version — pin exactly

```json
// recorder/package.json
{
  "dependencies": {
    "react": "19.2.8",
    "react-dom": "19.2.8"
  }
}
```

Use exact pin (no caret). Trace JSON encodes version-specific hook ordering and effect-flush timing. A React bump should be a deliberate PR that regenerates all traces.

### First milestone: prototype the recorder on ONE example

The CDP stepping + blackboxing is the highest-risk unknown. Build a minimal recorder that:
1. Runs a single `useState` counter example
2. Steps through it with React frames blackboxed
3. Emits one real trace JSON

Validate this works before building the full authoring pipeline.

---

## Tech stack

| Layer | Choice |
|---|---|
| Recorder runtime | Node.js + `chrome-remote-interface` (CDP client) |
| React (recorder) | `19.2.8` exact pin |
| Dispatcher instrumentation | Wrap `ReactCurrentDispatcher.current` |
| Frontend framework | Next.js (latest, App Router) |
| State | Zustand (`stepIndex`, `isPlaying`, `traceId`) |
| Code highlighting | Shiki (line-level highlight via `decorations`) |
| Animation | Framer Motion (hook list transitions, variable changes) |
| Styling | Tailwind CSS |
| Monorepo | npm workspaces (two packages: `recorder`, `web`) |

---

## v1 hook coverage (to be confirmed)

Suggest starting with these in priority order:
1. `useState`
2. `useEffect`
3. `useRef`
4. `useMemo` + `useCallback`
5. `useReducer`
6. `useContext`
7. `useTransition`
8. `useOptimistic`
9. `use()`
10. `useEffectEvent` *(new in React 19.2)*

Each hook gets multiple examples (basic → common gotcha → interview question pattern).

---

## What makes a good example file

Each example in `recorder/examples/` should:
- Be a **self-contained React component** (no external deps beyond React)
- Cover **one concept or one common gotcha** per file
- Include **optional `// @note` comments** above key lines — the recorder picks these up as the `note` field in the step
- Be named `<hook>-<concept>.tsx`, e.g. `useeffect-stale-closure.tsx`

---

## Long-term sustainability (the "PR to add example" model)

- New hook example = write component file + run `npm run record --example=<id>` + commit JSON
- New hook type = one-time addition to the dispatcher wrapper, then examples work normally
- React version bump = update pin in `recorder/package.json` + run `npm run record:all` to regenerate all traces + commit
- New docs/notes = edit `note` fields in the trace JSON directly or via `// @note` in the example source

---

## What to build first (in order)

1. `recorder/instrument/stepper.ts` — CDP driver that steps one example, blackboxes React frames, emits `{ line, variables }` per step
2. `recorder/instrument/dispatcher.ts` — wraps React dispatcher, emits `{ hooks, effects, phase }` per hook call
3. `recorder/instrument/merge.ts` — merges the two streams on step index, computes `changed` flags, writes trace JSON
4. `recorder/examples/usestate-counter.tsx` — first example
5. Run end-to-end, validate the JSON looks right
6. `web/` — Next.js scaffold, Zustand store, static trace import
7. `web/components/CodePanel` — Shiki with line highlight
8. `web/components/HooksPanel` + `EffectsPanel` + `VariablesPanel`
9. `web/components/Player` — prev/next/play/speed controls
10. Wire everything together on `usestate-counter`, then add remaining examples
