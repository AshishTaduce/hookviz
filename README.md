# HookViz

Interactive React hooks visualizer — like [jsv9000.app](https://www.jsv9000.app/), but for React hooks.

**Status: recorder POC working. No frontend yet.**

## Architecture

Build-time trace recording + frontend replay player. See `hookviz_project_brief.md`.

```
recorder/
├── examples/            # one .tsx per example — real React components
├── instrument/
│   ├── build.ts         # esbuild: example -> .build/<id>.js (+sourcemap), runner -> .build/runner.mjs
│   ├── runner.ts        # child process: jsdom + dispatcher wrapper + real render/commit/effect cycle
│   ├── dispatcher.ts    # wraps ReactSharedInternals.H, records hooks / effects / update queues
│   ├── stepper.ts       # parent: drives the child over CDP, one pause per statement
│   ├── merge.ts         # merges both streams on step index, computes `changed` flags
│   └── types.ts         # trace schema
├── out/                 # generated *.trace.json (committed)
└── record.ts            # CLI
```

## Usage

```bash
npm install
npm run record -w recorder -- --example=usestate-counter   # one example
npm run record -w recorder -- --all                        # regenerate everything
npm run record -w recorder -- --example=<id> --verbose     # with CDP pause diagnostics
```

Output lands in `recorder/out/<id>.trace.json`.

## How the recorder actually works

The brief specifies Chrome DevTools Protocol. This uses CDP against **Node's own V8 inspector**
(`node --inspect-brk`) rather than a browser — same protocol, same client, and the right fit
because React renders in Node here. No Chrome install required.

Three findings shaped the implementation:

1. **Statement breakpoints beat stepping.** Rather than `stepInto`/`stepOver` and filtering out
   React frames, the stepper calls `Debugger.getPossibleBreakpoints` over the compiled example
   and sets a breakpoint on *every* statement location, then just resumes in a loop. Every pause
   is by construction inside the example, across renders, event handlers and effects. This
   sidesteps the React-internal-frame problem entirely.
2. **Blackboxing suppresses `debugger` statements.** The runner uses a `debugger` statement to
   hand control back to the parent at the exact moment the example module is loaded but not yet
   rendered — so `runner.mjs` must *not* be blackboxed.
3. **Node reports an empty `url` on call frames.** Use `location.scriptId`, matched against the
   `scriptParsed` event for the compiled example.
4. **Commit has no observable statement.** It runs entirely inside React, so no breakpoint can
   fire during it. The merger inserts one `synthetic: true` step per render so the
   render → commit → passive-effect lifecycle is visible in the player. It is the only step type
   that is not a real V8 pause.

### Dispatcher instrumentation

`ReactCurrentDispatcher` is `React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE.H`
in React 19. Two traps to know about:

- **React DEV swaps the dispatcher between every hook call** (to detect nested hooks), so a
  dispatcher swap is *not* a render boundary. Render boundaries come from wrapping the component
  function itself (`hookviz.wrapComponent`).
- **React DEV reads `H`, swaps it, then restores what it read** — which is our proxy. Without a
  `WeakSet` guard we wrap our own proxy on every hook call, and each extra layer double-counts
  the hook index (symptom: 6 hooks recorded for 3 hook calls).

### Writing an example

`recorder/examples/<hook>-<concept>.tsx`, default-exporting a self-contained component:

```tsx
// @title useState — basic counter      <- meta.title
// @hook useState                       <- meta.hook
import { useState } from 'react';

export default function Counter() {
  // @note Attached to the next code line as step.note
  const [count, setCount] = useState(0);
  return <button id="inc" onClick={() => setCount(count + 1)}>{count}</button>;
}

// Optional. Drives interactions; its own lines are excluded from the trace.
export const scenario = async ({ click }: { click: (s: string) => void }) => {
  click('#inc');
};
```

`scenario` receives `{ click, type, tick }`. Render, scenario and unmount all run inside `act()`,
so commit and passive-effect phases are real.

## Known simplifications (POC)

- Hook state is reconstructed from intercepted dispatcher calls, not read off the fiber's
  `memoizedState` linked list. Values are accurate; there is no fiber/alternate visualization yet.
- `renderCount` is global, not per-component. Examples are single-component today.
- Functional updates serialize as `ƒ anonymous()` in the queue rather than their source text.
- Multi-component examples would need each component passed through `wrapComponent`.
- `lane` / `priority` for concurrent hooks is not captured yet.

## React version

Pinned exactly to `19.2.8`. Traces encode version-specific hook ordering and effect-flush timing,
so a React bump is a deliberate PR: change the pin, run `--all`, commit the regenerated traces.

## Next

`web/` — Next.js replay player (Zustand `stepIndex` drives every panel). Not started.
