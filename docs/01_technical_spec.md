# 01 — HookViz: Technical Spec

> **Stability: MEDIUM.** Architecture and schema are settled; specific versions
> and file paths may drift. Anything version-specific lives in doc 03 instead —
> if you find a hardcoded version number in this file, it's a bug in this doc.

---

## Repo shape

npm workspaces monorepo, two packages:

```
hookviz/
├── recorder/ # Node, runs at build time / in CI
│ ├── examples/ # one file per example, real React components
│ ├── instrument/
│ │ ├── stepper.ts # CDP statement stepping
│ │ ├── dispatcher.ts # React hook dispatcher wrapper
│ │ └── merge.ts # merges both streams → trace JSON
│ ├── src/cli.ts # `npm run record --example=<id>`
│ └── out/ # generated *.trace.json — COMMITTED to git
└── web/ # Next.js replay player
  ├── app/
  ├── components/
  │ ├── CodePanel/
  │ ├── HooksPanel/
  │ ├── EffectsPanel/
  │ ├── VariablesPanel/
  │ └── Player/
  └── store/ # Zustand
```

**`recorder/out/*.trace.json` must be committed.** It is a build artifact by
process but source data by role — the whole approach depends on traces being
static, reviewable, diffable files.

---

## How recording works

Two independent capture streams, merged on a shared step index.

### Stream 1 — statement stepping ("which line is running")

Drives the example through the **Chrome DevTools Protocol** via a real V8
debugger. This is the same mechanism VS Code's debugger uses.

Per pause:
- `callFrames[0].location.lineNumber` → the line
- `Runtime.getProperties` on the top scope → live variable values

**Critical: blackbox React frames.** Use `Debugger.setBlackboxPatterns` to skip
`node_modules/react*` and `node_modules/react-dom*`. Without this, a simple
counter increment becomes a several-hundred-step trace through React internals.
This is the single highest-risk implementation detail in the project.

### Stream 2 — hook dispatcher snapshots ("what React is doing")

React's hook dispatcher is swapped in during render. Wrapping it lets you
intercept every hook call and snapshot the fiber's `memoizedState` linked list,
pending update queues, and effect queue — each tagged with the current step
index from stream 1.

> ⚠️ The dispatcher is a React *internal*, not a public API. Its access path has
> changed across React versions and will change again. Isolate this in one
> module (`dispatcher.ts`) so a React upgrade touches one file.

### Stream 3 — DOM snapshot ("what the user would actually see")

At each `commit`-phase step only (the sole moment DOM actually mutates),
capture the rendered output via Puppeteer:

```ts
const domHTML = await page.evaluate(
  () => document.getElementById('root')?.outerHTML ?? ''
);
```

Stored as `steps[i].dom`, present only on commit steps. The frontend carries
forward the last known snapshot between commits — no need to store it on
every step, and no need to snapshot on render/passive-effect steps.

This stays fully within the static-recording model: the DOM at a given commit
is deterministic for a fixed example, so snapshotting it is no different in
kind from capturing hook state. It is **not** live re-execution — see doc 00
for why that distinction is load-bearing.

### Merging

`merge.ts` aligns all three streams by step index and precomputes `changed`
flags by diffing each step against the previous one. The frontend never diffs
anything at render time.

---

## Trace JSON schema

One file per example: `recorder/out/<example-id>.trace.json`

```jsonc
{
  "meta": {
    "schemaVersion": 2,
    "id": "usestate-counter",
    "title": "useState — basic counter",
    "hook": "useState",
    "category": "state", // drives breadcrumbs: category/hook/example
    "reactVersion": "<see doc 03>",
    "source": "/* full source string for the code panel */",
    "recordedAt": "<ISO timestamp>",
    "annotations": [ // OPTIONAL, hand-authored or extracted
      {
        "line": 1,
        "type": "comment", // comment | function-decl | side-effect | closure
        "label": "Component declaration",
        "detail": "Counter is a function component — it re-runs top to bottom on every render."
      },
      {
        "line": 4,
        "type": "side-effect",
        "label": "setInterval — a side effect",
        "detail": "This escapes React's render cycle. It's why useEffect exists: to fence off things like this from the render phase."
      }
    ]
  },
  "steps": [
    {
      "i": 0, // step index — the shared clock
      "line": 4, // 1-based, into meta.source
      "phase": "render", // render | commit | passive-effect | idle | event
      "renderCount": 1,
      "variables": [
        { "name": "count", "value": "0", "kind": "number", "changed": true }
      ],
      "hooks": [
        {
          "index": 0,
          "type": "useState",
          "memoized": "0",
          "queue": [], // pending updates
          "changed": true
        }
      ],
      "effects": [
        { "id": "e0", "deps": ["count"], "status": "scheduled" }
        // status: scheduled | fired | cleanup-pending | cleaned-up
      ],
      "dom": null, // set ONLY on commit-phase steps — see Stream 3
      "lane": null, // priority lane, for concurrent hooks
      "note": "Initial render: useState returns initial value 0"
    },
    {
      "i": 3,
      "line": 6,
      "phase": "commit",
      "renderCount": 1,
      "variables": [],
      "hooks": [],
      "effects": [],
      "dom": "<div id=\"root\"><button>0</button></div>",
      "lane": null,
      "note": "Committed to the DOM — this is what the user now sees"
    }
  ]
}
```

### Schema design notes

- **`changed` is precomputed at record time.** Keeps the frontend dumb.
- **`phase` is the highest-value field.** The render → commit → passive-effect
  lifecycle is what most hook tutorials fail to make legible. It drives the
  timeline visualization.
- **`note` is hand-authored per step.** Optional. Sourced from `// @note`
  comments in the example file.
- **`annotations` is hand-authored per example, not per step.** Line-anchored
  markers for comments, function declarations, side effects, and closures —
  the things a beginner needs named and an advanced user wants to hide. Drives
  the UI spec's annotation-layer toggle (doc 02). Optional and additive: an
  example with zero annotations still works, it's just unannotated.
- **`dom` is null except on commit steps.** Populated from the Stream 3
  snapshot. The frontend carries forward the last non-null value between
  commits rather than re-reading it every step.
- **`lane`** is null for most hooks; populated for `useTransition` /
  `useOptimistic` so scheduling priority can be shown deliberately.

### Schema evolution

`schemaVersion` is now in the schema (bumped to 2 for this revision — v1 had
no `dom` or `annotations`). When the schema changes, bump it and regenerate
all traces — do not try to support multiple schema versions in the player.

**Action required:** if any traces were recorded before `dom` and
`annotations` existed, they are schemaVersion 1 and need re-recording once the
recorder supports Stream 3. Check doc 03 for current state.

---

## Versioning policy

**Pin exact versions, no caret ranges,** in the recorder workspace.

Traces encode version-specific hook ordering and effect-flush timing. A silent
patch bump would change captured behavior out from under committed trace JSON.

**A React upgrade is a deliberate PR:**
1. Bump the pin in `recorder/package.json`
2. Run `npm run record:all` to regenerate every trace
3. Review the trace diffs — they show exactly what React changed
4. Commit traces alongside the version bump

Current pinned versions live in **doc 03**, not here.

---

## Forward-compatibility rules (for the deferred live mode)

Four cheap decisions that keep the live-execution door open without building
it now. All four should be honored in v1. Rule 4 is the load-bearing one.

1. **Code panel uses Monaco in read-only mode**, not a static highlighter.
   Same visual result; flipping to editable later is a prop change, not a
   rewrite. Costs some bundle weight — accepted.
2. **Store has a `mode` field**: `'replay' | 'live'`. v1 hardcodes `'replay'`.
   Panels read from a `useCurrentStep()` selector that doesn't know or care
   where the trace came from.
3. **Trace loading is async**: `loadTrace(id)` returns a promise even though v1
   just imports static JSON. Later, `runTrace(code)` hits an API and returns
   the same shape. Panels never learn the difference.
4. **⭐ The recorder takes source code as a STRING, not a file path.**

   This is the only genuine coupling between v1 and the live mode. Build the
   core as:

   ```ts
   record(sourceCode: string, meta: TraceMeta): Promise<Trace>
   ```

   with a thin file-reading wrapper on top for the CLI:

   ```ts
   recordFromFile(path: string) // reads file → calls record()
   ```

   If the recorder is instead built around "read from `examples/<id>.tsx`",
   accepting arbitrary user code later means unpicking the input path through
   the whole pipeline. Built this way, the live mode's API route just calls
   `record()` directly with no changes to the recorder at all.

   **Cost of doing this now: ~20 minutes. Cost of retrofitting: significant.**

---

## Hosting

**v1 requires no server.** This is a direct consequence of the build-time
recording decision.

- Recorder runs locally or in CI — never in production
- Traces are static JSON committed to the repo
- The deployed site is Next.js serving static content
- **Vercel free tier covers it entirely, indefinitely**

Do not provision infrastructure for v1. A server only becomes necessary at
milestone 2 (live mode), and its requirements should be designed then, against
a working UI, rather than guessed at now.

---

## Frontend architecture

Deliberately thin. All complexity is baked into the committed JSON.

- **Zustand store**: `{ traceId, stepIndex, isPlaying, mode }`
- `trace.steps[stepIndex]` drives every panel
- Prev/next/play just increment `stepIndex`
- No computation at render time — read `changed` flags, don't derive them

---

## Build order

The riskiest piece goes first. Do not build the frontend until a real trace
exists.

0. **Confirm the recorder's entry point is `record(sourceCode: string, …)`**
   with a file-reading wrapper — see forward-compat rule 4. Do this before
   writing more recorder code; it is cheap now and expensive later.
1. `instrument/stepper.ts` — CDP stepping, React frames blackboxed
2. `instrument/dispatcher.ts` — dispatcher wrapper
3. `instrument/merge.ts` — merge + diff flags + write JSON
4. First example → run end to end → **validate the JSON by hand**
5. Only then: `web/` scaffold, store, panels, player
