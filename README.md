# HookViz

Step-by-step React hooks visualizer. Watch `useState`, `useEffect`, `useReducer`, and more execute line-by-line with a synchronized source view, hook fiber list, DOM snapshot, effects queue, and variables panel.

**Live:** [hookviz.vercel.app](https://hookviz.vercel.app) *(deploy in progress)*

---

## What it does

HookViz records a React component's execution at the V8 statement level, captures hook state, effects, DOM commits, and variable values at every pause, then replays the result as a synchronized multi-panel UI.

- **Source panel** — Monaco editor with the component source; current line highlighted per phase
- **Rendered Output** — live DOM snapshot from each React commit, in a sandboxed iframe
- **Hooks** — fiber linked-list view: hook type, index, memoized value
- **Effects Queue** — passive effects with status: scheduled → fired → cleanup pending → cleaned up
- **Variables** — local variable values at the current statement
- **Player** — play/pause/step/seek, phase-colored timeline, speed control (0.5×–4×)
- **Breadcrumb navigation** — switch between all 16 examples in-place
- **Guided/Expert toggle** — show/hide educational annotations in the gutter
- **Font zoom** — A−/A+ controls to adjust panel and editor font size

---

## Examples (v1)

| Hook | Example | Concept |
|---|---|---|
| `useState` | basic counter | state initialization, setter, re-render |
| `useState` | batching gotcha | why two `setCount(count+1)` calls only increment once |
| `useEffect` | stale closure | empty dep array freezes a value at mount |
| `useEffect` | cleanup | how cleanup prevents interval/subscription leaks |
| `useRef` | render counter | mutable container that doesn't trigger re-renders |
| `useRef` | DOM ref | `ref.current` for imperative DOM access (focus, select) |
| `useMemo` | filter list | caching a computation, stable vs. changing deps |
| `useMemo` | inline object dep | why `[{ items }]` defeats memoization |
| `useCallback` | stable handler | stable function identity for memoized children |
| `useCallback` | missing dep | stale closure from an incomplete dep array |
| `useReducer` | counter | increment/decrement/reset via dispatch |
| `useReducer` | form state machine | why dispatch beats scattered `useState` setters |
| `useContext` | theme toggle | Provider → consumer without prop drilling |
| `useContext` | split context | avoid unnecessary re-renders by splitting contexts |
| `useTransition` | tab switch | low-priority update with `startTransition` |
| `useTransition` | isPending | keeping the input responsive while a heavy list updates |

---

## Architecture

Build-time trace recording + static Next.js replay player.

```
recorder/
├── examples/            # one .tsx per example — real React components
├── instrument/
│   ├── build.ts         # esbuild: example → .build/<id>.js (+sourcemap), runner → .build/runner.mjs
│   ├── runner.ts        # child process: jsdom + dispatcher wrapper + real render/commit/effect cycle
│   ├── dispatcher.ts    # wraps ReactSharedInternals.H, records hooks/effects/update queues
│   ├── stepper.ts       # parent: drives the child over CDP, one pause per statement
│   ├── merge.ts         # merges both streams on step index, computes `changed` flags
│   └── types.ts         # trace schema (schemaVersion 2)
├── out/                 # generated *.trace.json (committed to git)
└── record.ts            # CLI

web/
├── app/
│   ├── page.tsx         # redirects / → default trace
│   └── [traceId]/       # static route per trace, generated at build time
├── components/
│   ├── PlayerShell.tsx  # 3-row grid layout + store seeding
│   ├── TopNav.tsx       # breadcrumb + Guided/Expert toggle + font zoom
│   ├── Player.tsx       # playback controls + phase timeline
│   ├── BreadcrumbPopover.tsx
│   └── panels/
│       ├── CodePanel.tsx    # Monaco editor, line highlights, annotation glyphs
│       ├── DomPanel.tsx     # sandboxed iframe, carry-forward + flash on commit
│       ├── HooksPanel.tsx   # fiber linked-list
│       ├── EffectsPanel.tsx # passive effects with status badges
│       └── VariablesPanel.tsx
├── store/index.ts       # Zustand v5: TraceSlice + PlaybackSlice + UISlice (persist)
├── lib/
│   ├── catalog.ts       # AUTO-GENERATED — do not edit
│   └── generate-catalog.ts
└── public/monaco/vs/    # Monaco local assets (gitignored, copied at setup)
```

### How the recorder works

The brief specifies Chrome DevTools Protocol. This uses CDP against **Node's own V8 inspector** (`node --inspect-brk`) — same protocol, no Chrome required.

**Statement breakpoints:** `Debugger.getPossibleBreakpoints` over the compiled example sets a breakpoint on every statement. Each pause is inside the example; React internals are never paused in.

**Commit step:** React's commit phase has no observable statement (it runs inside React). The merger inserts one `synthetic: true` step per render containing the `dom` snapshot from `onCommitFiberRoot`.

**Dispatcher shim:** `ReactCurrentDispatcher` is `React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE.H` in React 19. The shim wraps it with a `Proxy` and a `WeakSet` guard (React DEV swaps the dispatcher on every hook call; without the guard, each swap re-wraps the proxy and double-counts hooks).

**DOM snapshot:** jsdom `document.getElementById('root').outerHTML` read synchronously inside `onCommitFiberRoot` — no browser needed.

**Lane capture:** `startTransition` and `addOptimistic` are wrapped by the dispatcher to tag steps with a semantic lane string (`transition`, `optimistic`) rather than reading React's internal bitmasks.

### Writing an example

`recorder/examples/<hook>-<concept>.tsx`, default-exporting a self-contained component:

```tsx
// @title useState — basic counter         ← meta.title
// @hook useState                          ← meta.hook

// @annotate:comment Label | Explanation shown in Guided mode
// @annotate:closure Label | Explanation
// @annotate:side-effect Label | Explanation
// @annotate:function-decl Label | Explanation

export default function Counter() {
  // @note Attached to the next step as step.note
  const [count, setCount] = useState(0);
  return <button id="inc" onClick={() => setCount(count + 1)}>{count}</button>;
}

// scenario drives interactions; its own lines are excluded from the trace
export const scenario = async ({ click, type, tick }: ScenarioApi) => {
  click('#inc');
  type('#input', 'hello');
  await tick(100); // wait ms (e.g. after setInterval)
};
```

---

## Development

```bash
# Prerequisites: Node 20+, no other global installs needed

# 1. Install dependencies
npm install

# 2. Copy Monaco assets (one-time setup — gitignored)
cp -r web/node_modules/monaco-editor/min/vs web/public/monaco/vs

# 3. Record all examples
npm run record:all -w recorder

# 4. Start the dev server
npm run dev -w web
# → http://localhost:3000

# Record a single example
npm run record -w recorder -- --example=usestate-counter
npm run record -w recorder -- --example=usestate-counter --verbose

# Production build
npm run build -w web
```

---

## Deployment (Vercel)

The web app is a fully static Next.js export (`output: 'export'`). No server required.

```bash
# One-time: install and authenticate Vercel CLI
npm i -g vercel
vercel login

# Deploy from the web/ directory
cd web && vercel --prod
```

Or connect the GitHub repo in the [Vercel dashboard](https://vercel.com/new):
- **Root directory:** `web`
- **Build command:** `npm run build`
- **Output directory:** `out`
- Framework preset: Next.js

---

## React version

Pinned exactly to `19.2.8`. Traces encode version-specific hook ordering and effect-flush timing. A React bump is a deliberate PR: change the pin, run `npm run record:all -w recorder`, commit the regenerated traces.

---

## Known simplifications

- Hook state reconstructed from dispatcher calls, not read off the fiber's `memoizedState` linked list. Values are accurate; no fiber/alternate visualization.
- `renderCount` is global, not per-component. Examples are single-component today.
- Functional updates serialize as `ƒ anonymous()` in the queue.
- Multi-component examples need each component passed through `wrapComponent`.
