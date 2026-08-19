# 01 — HookViz: Technical Specification (updated)

**Stability: MEDIUM** – Architecture and schema are settled; specific versions and file paths may drift. Any version-specific content lives in doc 03 and is explicitly version-bumped. If you find a hardcoded version number in this file, it's a bug in this doc.

## Repo shape
npm workspaces monorepo, two packages:

```bash
hookviz/
├── recorder/ # Node, runs at build time / in CI
│ ├── examples/ # one file per example, real React components
│ ├── instrument/ # core logic
│ │ ├── stepper.ts # CDP stepping
│ │ ├── dispatcher.ts # React hook dispatcher wrapper
│ │ ├── merge.ts    # merges both streams → trace JSON
│ │ └── record.ts   # CLI entry point
│ ├── src/cli.ts   # `npm run record --example=<id>`
│ └── out/         # generated *.trace.json — COMMITTED to git
└── web/           # Next.js replay player
  ├── app/
  ├── components/
  │ ├── CodePanel/
  │ ├── HooksPanel/
  │ ├── EffectsPanel/
  │ ├── VariablesPanel/
  │ └── Player/
  └── store/       # Zustand
```

`recorder/out/*.trace.json` must be committed. It is a build artifact by process but source data by role — the whole approach depends on traces being static, reviewable, diffable files.

## How recording works
Two independent capture streams, merged on a shared step index.

### Stream 1 — statement stepping (which line is running)

Drives the example through the **Chrome DevTools Protocol** via a real V8 debugger. This is the same mechanism VS Code's debugger uses.

Per pause:
- `callFrames[0].location.lineNumber` → the line
- `Runtime.getProperties` on the top scope → live variable values

**Critical: blackbox React frames.** Use `Debugger.setBlackboxPatterns` to skip
`node_modules/react*` and `node_modules/react-dom*`. Without this, a simple
counter increment becomes a several-hundred-step trace through React internals.
Without it, a simple counter increment becomes a several‑hundred-step trace through React internals.

### Stream 2 — hook dispatcher snapshots (what React is doing)

React's hook dispatcher is swapped in during render. Wrapping it lets you
intercept every hook call and snapshot the fiber's `memoizedState` linked list,
pending update queues, and effect queue — each tagged with the current step
index from stream 1.

> ⚠️ The dispatcher is a React internal, not a public API. Its access path has
> changed across React versions and will change again. Isolate this in one
> module (`dispatcher.ts`) so a React upgrade touches one file.

### Stream 3 — DOM snapshot (what the user would actually see)

At each `commit`-phase step only (the sole moment DOM actually mutates),
capture the rendered output by reading it straight out of the jsdom instance
the recorder already renders into, **in-process, no browser**:

```ts
const domHTML = document.getElementById('root')?.outerHTML ?? '';
```

**Corrected 2026‑08‑19 (Marlowe).** Earlier revisions of this section (and doc 04's Claude Code kickoff) specified Puppeteer + `page.evaluate()`. That was stale: there is no browser anywhere in the recorder. React renders into **jsdom** inside a child Node process, driven over CDP against Node's own `--inspect-brk` inspector (see README, "How the recorder actually works"). `document` is a live jsdom global in that process — the DOM is directly readable with a synchronous `.outerHTML`, so Puppeteer would add a heavyweight dependency and a *second* JS runtime to reach a DOM we already hold. It is also the wrong tool here: Puppeteer renders in a browser page, but React renders in Node. jsdom's serialization is faithful for displaying committed markup. The only divergences are things we never display: computed layout/geometry (jsdom has none) and cosmetic normalization like inline-`style` ordering. The DOM panel shows committed *markup*, so those don't matter. Decision: **jsdom in‑process, no Puppeteer**.

**Capture point — the load-bearing subtlety.**

Do *not* snapshot at the `render-end` boundary the dispatcher emits (`wrapComponent`'s `finally`). That fires when the component *function* returns — pre‑commit — so `outerHTML` there yields the *previous* commit's markup. Snapshot only *after* commit. The recommended mechanism is React's own commit callback, installed alongside the dispatcher (`install()`), before `react-dom/client` is imported:

```ts
globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
  supportsFiber: true, isDisabled: false,
  inject: () => 1, renderers: new Map(),
  onCommitFiberRoot: () => emit({ t: 'dom', html: document.getElementById('root')?.outerHTML ?? '' }),
  onCommitFiberUnmount: () => {},
  onPostCommitFiberRoot: () => {},
};
```

`onCommitFiberRoot` is the canonical "a commit just happened, DOM is updated"
hook — it is exactly what React DevTools uses, and it fires synchronously
after the mutation-phase callbacks. It is a React internal, but a markedly
*more* stable one than the dispatcher, and it belongs in the same one‑file
isolation (`dispatcher.ts`). `merge.ts` attaches the most‑recent `dom` event to
the synthetic commit step it already inserts on `render-end` (the event arrives
just after that step is created — see doc 03's merge note). Present only on
commit steps; the frontend carries forward the last non‑null value between
commits — no need to store it on every step.

This stays fully within the static‑recording model: the DOM at a given commit
is deterministic for a fixed example, so snapshotting it is no different in
kind from capturing hook state. It is **not** live re‑execution — see doc 00
for why that distinction is load‑bearing.

### Merging

`merge.ts` aligns all three streams by step index and precomputes `changed`
flags by diffing each step against the previous one. The frontend never diffs
anything at render time.

## Trace JSON schema

One file per example: `recorder/out/<example-id>.trace.json`

```jsonc
{
  "meta": {
    "schemaVersion": 2,
    "id": "usestate-counter",
    "title": "useState — basic counter",
    "hook": "useState",
    "category": "state",
    "reactVersion": "<see doc 03>",
    "source": "/* full source string for the code panel */",
    "recordedAt": "<ISO timestamp>",
    "annotations": [ // OPTIONAL, hand-authored or extracted
      {
        "line": 1,
        "type": "comment",
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
      "line": 4, // 1‑based, into meta.source
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
      "dom": null, // set ONLY on commit steps — see Stream 3
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
      "dom": "<div id=\\\"root\\\"><button>0</button></div>",
      "lane": null,
      "note": "Committed to the DOM — this is what the user now sees"
    }
  ]
}
```

### Schema design notes

- **`changed` is precomputed at record time.** Keeps the frontend dumb.
- **`phase` is the highest‑value field.** The render → commit → passive‑effect
  lifecycle is what most hook tutorials fail to make legible. It drives the
  timeline visualization.
- **`note` is hand‑authored per step.** Optional. Sourced from `// @note`
  comments in the example file.
- **`annotations` is hand‑authored per example, not per step.** Line‑anchored
  markers for comments, function declarations, side effects, and closures — the
  things a beginner needs named and an advanced user wants to hide. Drives the
  UI spec's annotation‑layer toggle (doc 02). Optional and additive: an
  example with zero annotations still works, it's just unannotated.
- **`dom` is null except on commit steps.** Populated from the Stream 3
  snapshot. The frontend carries forward the last non‑null value between
  commits rather than re‑reading it every step.
- **`lane`** is null for most steps; populated on the step where a
  `useTransition` / `useOptimistic` update is *scheduled* so scheduling
  priority can be shown deliberately. See "Lane / priority capture" below.
- **`meta.annotations`** — per‑*example*, not per‑step, so it never enters the
  step‑merge loop at all. It's produced by an independent source pass and
  attached to the returned `meta`. Note: `parseAnnotations` today extracts
  only `// @note` (per‑step notes) and `@title`/`@hook` meta — it does **not**
  yet produce the richer `meta.annotations[]` markers (comment / function‑decl /
  side‑effect / closure). That extractor is new work, but it lives in meta
  assembly, not the merge loop.

### Lane / priority capture design (Marlowe, 2026‑08‑19)

Doc 00 commits to capturing lane/priority *explicitly* rather than fighting
React's non‑deterministic concurrent scheduler. The schema had the `lane`
field but no mechanism. Here is the concrete one.

**Do not read React's internal lane bitmasks.** `fiber.lanes` / root pending
lanes are numeric, version‑specific constants that are meaningless to a
learner and fragile across React versions — exactly the kind of internal doc
01 says to isolate, not surface raw. Instead capture the *semantic* lane at the
*scheduling site*, which the dispatcher already controls by wrapping the
functions React hands back.

The dispatcher already wraps hook setters (see `wrapSetter` in `dispatcher.ts`).
Extend that:

- **`useTransition`** returns `[isPending, startTransition]`. Wrap
  `startTransition`. Inside the wrapper, set a module‑level
  `schedulingLane = 'transition'` (with a nesting depth counter, restored in a
  `finally`) around the original call. React invokes the passed callback
  synchronously, so any `setState` fired inside it emits its `enqueue` event
  while the flag is set. `isPending` is already captured as the hook's
  memoized value, so the UI can show the pending state for free.
- **`useOptimistic`** returns `[optimisticState, addOptimistic]`. Wrap
  `addOptimistic`; its `enqueue` is emitted with `lane = 'optimistic'`.
- **Normal setters** emit with `lane = schedulingLane ?? null` (i.e. `null`
  outside any transition).

Wire‑up:

- Extend the `enqueue` `HookEvent` with an optional `lane?: Lane` where
  `Lane = 'transition' | 'optimistic' | 'sync'`.
- `merge.ts`: when draining a step's events, if any `enqueue` carries a
  non‑null lane, set `step.lane` to it. (Optional enrichment: the low‑priority
  re‑render that results also commits under that lane — the DevTools commit
  hook's `priorityLevel` arg could tag that commit step too, but the
  scheduling‑site lane is the primary, sufficient signal.)

This is robust (we only ever wrap functions we're given — never read lane
constants), version‑resilient, and localized to `dispatcher.ts` plus one
optional schema field. `useDeferredValue` also rides transition lanes but
exposes no schedule function to wrap; its lane surfaces as a low‑priority
re‑render and is out of scope for v1 — note it as future work.

### Schema evolution

`schemaVersion` is now in the schema (bumped to 2 for this revision — v1 had
no `dom` or `annotations`). When the schema changes, bump it and regenerate
all traces — do not try to support multiple schema versions in the player.

**Action required:** if any traces were recorded before `dom` and
`annotations` existed, they are schemaVersion 1 and need re‑recording once the
recorder implements Stream 3. Check doc 03 for current state.

### Forward‑compatibility rules (for the deferred live mode)

Four cheap decisions that keep the live‑execution door open without building
it now. All four should be honored in v1.

1. **Code panel uses Monaco in read‑only mode**, not a static highlighter.
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

   with a thin file‑reading wrapper on top for the CLI:

   ```ts
   recordFromFile(path: string) // reads file → calls record()
   ```

   If the recorder is instead built around “read from `examples/<id>.tsx`”,
   accepting arbitrary user code later means unpicking the input path through
   the whole pipeline. Built this way, the live mode's API route just calls
   `record()` directly with no changes to the recorder at all.

   **Cost of doing this now: ~20 minutes. Cost of retrofitting: significant.**

## Hosting

**v1 requires no server.** This is a direct consequence of the build‑time
recording decision.

- Recorder runs locally or in CI — never in production
- Traces are static JSON committed to the repo
- The deployed site is Next.js serving static content
- **Vercel free tier covers it entirely, indefinitely**

Do not provision infrastructure for v1. A server only becomes necessary at
milestone 2 (live mode), and its requirements should be designed then, against
a working UI, rather than guessed at now.

## Frontend architecture (Marlowe, 2026‑08‑19)

Overall stance: **all interesting complexity is precomputed into the JSON.** The
frontend is a deterministic renderer over `steps[stepIndex]` with a player on
top. No diffing, no derivation, no live evaluation. The only nontrivial pieces
are (a) keeping five panels in visual sync without over‑rendering, (b) Monaco
decorations that survive mode toggles, and (c) the sandboxed DOM iframe.

### Next.js App Router structure

Navigation is popover‑based, not routed (doc 02) — but URLs still need to be
shareable and the site still needs to be a fully static export on Vercel. The
resolution:

- Single dynamic route: **`web/app/[traceId]/page.tsx`**, plus a root
  `web/app/page.tsx` that redirects to a default trace (e.g. first entry of the
  catalog). No per‑category or per‑hook routes — the breadcrumb popover
  filters an already‑loaded catalog client‑side.
- **`generateStaticParams()`** on `[traceId]` enumerates every trace id from a
  build‑time catalog (`web/lib/catalog.ts`, generated by a `prebuild` script
  that globs `recorder/out/*.trace.json` and emits `{id, title, hook,
  category}[]`). Result: `next export`‑compatible, one static HTML per trace,
  hostable as flat files. `output: 'export'` in `next.config.js`.
- **Trace JSON is loaded by static import at build time**, not fetched. Each
  `page.tsx` does `const trace = (await import(\`@/../recorder/out/${traceId}.trace.json\`)).default;`
  and passes it to a client `<Player trace={trace} />`. Rationale: traces are
  committed static data whose identity is already known at build time; a fetch
  would just add a network round‑trip and a loading state for data that is
  literally sitting next to the HTML. Bundle bloat is the counter‑concern —
  addressed by the per‑route split Next already does (each `[traceId]` route
  only imports its own trace). The catalog itself (id/title/hook/category
  only, no `steps`) is imported into a shared client module so the breadcrumb
  popover can render without a second fetch either.
- Popover navigation to another trace uses `router.push('/' + otherId)` — a
  client transition into the neighboring statically‑generated route. Fast
  because both HTML and JSON are already on disk; the transition is just a
  new client bundle chunk.
- Forward‑compat rule 3 (async `loadTrace()`) is honored by making the trace
  arrive via the store's `loadTrace(id)` action even in v1 — the action just
  wraps the static import in `Promise.resolve()`. Live mode later swaps the
  body of that action for a `fetch('/api/record', …)` with zero panel
  changes.

### Zustand store — shape, slices, actions

One store, sliced by concern, with `persist` middleware scoped to the
preferences slice only. Everything else is session‑local.

```ts
type Lane = 'transition' | 'optimistic' | 'sync' | null;

type TraceSlice = {
  traceId: string | null;
  trace: Trace | null;          // full loaded trace
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  loadTrace: (id: string) => Promise<void>;
};

type PlaybackSlice = {
  stepIndex: number;
  isPlaying: boolean;
  speed: 0.5 | 1 | 2 | 4;       // discrete, not continuous — button, not slider
  mode: 'replay' | 'live';       // v1 hardcodes 'replay'
  play: () => void;
  pause: () => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (i: number) => void;
  setSpeed: (s: 0.5 | 1 | 2 | 4) => void;
};

type UISlice = {
  audience: 'guided' | 'expert';           // persisted
  breadcrumbPopover:
    | { open: false }
    | { open: true; scope: 'root' | 'category' | 'hook' | 'example' };
  commandPaletteOpen: boolean;
  setAudience: (a: 'guided' | 'expert') => void;
  openPopover: (scope: 'root' | 'category' | 'hook' | 'example') => void;
  closePopover: () => void;
};
```

Notes on the non‑obvious calls:

- **`mode: 'replay' | 'live'` manifests today as a single reader helper**,
  `useCurrentStep()`, which in `'replay'` mode returns `trace.steps[stepIndex]`
  and in `'live'` mode (unbuilt) would return the last step streamed from an
  API. Panels only ever call `useCurrentStep()` — they never read `trace` or
  `stepIndex` directly. This is the seam. It is worth one indirection now to
  keep the field honest.
- **`audience` is the Guided/Expert toggle**, `persist`ed to localStorage under
  a single key (`hookviz.ui`), partialize'd to only the UI slice so we don't
  accidentally persist `stepIndex` or `isPlaying` across visits. Persisted per
  doc 02: preference is global, not per‑example.
- **Breadcrumb / palette state lives in the store**, not component‑local,
  because the breadcrumb bar (top nav) and the popover surface are structurally
  separate components; a shared open/close state is cleaner than a portal ref.
- **Playback actions are the only writers to `stepIndex`.** `next`/`prev`
  clamp against `trace.steps.length`; `play` schedules a `setInterval`
  (interval derived from `speed`) that ticks `stepIndex++` until end, then
  auto‑pauses. Interval id lives in a module‑scoped ref, not in store state,
  to avoid re‑renders on every tick.
- No `traceCatalog` in the store — it is a build‑time constant module import,
  not runtime state, so it doesn't belong in Zustand.

### Panel sync / re‑render strategy

Five panels (DOM, Hooks, Effects, Variables, Code) all read from the same
`steps[stepIndex]`. The naïve `const step = useStore(s => s.trace.steps[s.stepIndex])`
in every panel would work — but every step tick would re‑render all five, even
the ones whose data didn't change (e.g. a `render`‑phase step doesn't touch
`dom` or `effects`).

**Decision: narrow selectors per panel, keyed on the field each panel
actually reads**, with `zustand`'s default reference‑equality selector. Not
`useShallow` — the step object is precomputed and stable per index, so
identity equality on the individual field is the right primitive.

```ts
// hooks/useStep.ts
const step = () => {
  const { trace, stepIndex, mode } = useStore.getState();
  return mode === 'replay' ? trace!.steps[stepIndex] : /* live */ null;
};

export const useDomHtml = () => useStore(s => s.trace?.steps[s.stepIndex]?.dom ?? null);
export const useHooks   = () => useStore(s => s.trace?.steps[s.stepIndex]?.hooks);
export const useEffectsList = () => useStore(s => s.trace?.steps[s.stepIndex]?.effects);
export const useVariables   = () => useStore(s => s.trace?.steps[s.stepIndex]?.variables);
export const useCodeCursor  = () => useStore(s => {
  const st = s.trace?.steps[s.stepIndex];
  return st ? { line: st.line, phase: st.phase } : null;
});
```

Because `trace.steps` is precomputed once at load and each step object is
frozen, `steps[i].hooks === steps[j].hooks` when they didn't change is
naturally true if — and only if — the recorder emits the same array reference
across unchanged steps. **It doesn't today** (each step is a fresh object
from `merge.ts`), so a `useShallow` fallback per panel is the pragmatic guard.
Applied selectively: `useHooks`, `useEffectsList`, `useVariables` get
`useShallow`; `useDomHtml` and `useCodeCursor` are scalars and don't need it.

Torn‑state risk: Zustand snapshots are synchronous per render pass, so all
panels within one React commit read the same `stepIndex`. The only tear window
is between the store update and the flush — irrelevant here because we never
mutate the trace itself.

The **"changed" highlight‑and‑decay** UX (doc 02) is handled panel‑locally:
each row/cell reads `changed` from the current step and starts a CSS class
with an animation that decays over ~600ms. Because `changed` is precomputed
into the step, the panel doesn't need previous‑step state; the animation is
purely reactive to the currently‑bound row's flag. Keying rows by
`hook.index` / variable `name` / effect `id` (stable across steps) lets React
preserve DOM identity so the CSS animation retriggers correctly on flag flip.

### Monaco integration

Constraints (doc 02): read‑only source, current‑line highlight, gutter markers
from `meta.annotations`, visibility of markers driven by Guided/Expert toggle,
no re‑mount on toggle.

- **Load via `@monaco-editor/react`**, with `loader.config({ paths: { vs: '/monaco/vs' } })`
  serving Monaco from the app's static assets rather than the CDN (offline‑OK,
  deterministic bundle). Only the `typescript` and `basic-languages/typescript`
  contributions — no need for the full language services.
- **Current‑line highlight → `editor.createDecorationsCollection([...])`** with
  a `className` on the whole line range. One decoration, replaced (not
  cleared+re‑added) on each `stepIndex` change via
  `collection.set(newDecorations)`. `revealLineInCenterIfOutsideViewport(line)`
  keeps the cursor visible without yanking on every micro‑step.
- **Annotation gutter markers → the same decorations collection, separate
  instance**, each with `glyphMarginClassName: 'hv-annot hv-annot-' + type`
  (`comment` / `function-decl` / `side-effect` / `closure`). Glyph margin is on
  (`options.glyphMargin: true`); line numbers stay on beside it. The four
  glyphs are pure CSS backgrounds keyed by class — small square/circle/triangle
  markers per doc 02's spec.
- **Marker popovers → a Monaco `HoverProvider`**, not a custom DOM overlay.
  Reason: `HoverProvider` reuses Monaco's own positioning, escape handling, and
  focus management, which a hand‑rolled overlay would reinvent poorly.
  Register once per editor instance with
  `monaco.languages.registerHoverProvider('typescript', …)`; the provider
  looks up the annotation for the hovered line from a ref to
  `meta.annotations` and returns `{ contents: [{ value: label }, { value: detail }] }`.
- **Guided/Expert without remount**: markers live in one decorations
  collection whose contents are recomputed by an effect that reads
  `audience` — in Expert mode, filter markers to the empty set (or hide via
  a `display: none` on the marker classes, effectively the same). The editor
  instance, model, and current‑line collection are untouched, so no scroll
  reset, no cursor loss. Cost of a full remount here would be a visible
  reflow at every toggle — unacceptable given the toggle is a first‑class
  UI control.
- Editor sizing: fixed height via CSS grid on the layout, not
  `automaticLayout` (which uses `ResizeObserver` and is unnecessary for our
  static grid).

### DOM‑snapshot rendering mechanics

Decided (doc 02): `<iframe srcdoc>`, sandboxed, no scripts. The interesting
bits are how the raw HTML gets in, sizing, snapshot carry‑forward, and the
change‑flash across the iframe boundary.

- **`steps[i].dom` is a raw `outerHTML` string** for `#root`. It goes into
  the iframe as `<iframe sandbox="" srcdoc={wrapped}>` where `wrapped` is a
  tiny HTML shell:
  `<!doctype html><html><head><style>${resetCss}</style></head><body>${dom}</body></html>`
  Empty `sandbox=""` (no allow‑scripts, no allow‑same‑origin) disables JS
  execution and script‑originating fetches — cheap safety even for curated
  examples, per doc 02.
- **Auto‑sizing**: iframes don't self‑size to content. Options: fixed CSS
  height (bad — examples vary), `ResizeObserver` on `iframe.contentDocument.body`
  (works only with `allow-same-origin`, which we don't want), or a
  `postMessage` from an in‑iframe sizing script (requires `allow-scripts`,
  which we also don't want). **Resolution: fixed panel height via CSS, iframe
  fills it, `body { overflow: auto }` inside** — DOM panel scrolls when
  content exceeds the box. Doc 02 already gives this panel the top slot in
  the right column with meaningful vertical space; the internals below it
  aren't privileged over it. This trades pixel‑perfect fit for keeping the
  iframe fully sandboxed. Correct tradeoff.
- **Snapshot carry‑forward** (doc 02: "holds the last-known snapshot between
  commits rather than going blank"): the panel component keeps a
  `useRef<string | null>(null)` last‑committed HTML. On each render it reads
  `useDomHtml()`; if non‑null, update the ref and the iframe's `srcdoc`; if
  null, do nothing (the iframe keeps its previous `srcdoc`). Because `srcdoc`
  triggers a full reparse on change, we only set it on genuinely‑new commit
  strings (`if (html !== lastRef.current)`), not on every render.
- **Change‑flash across the iframe boundary — the genuinely tricky bit.** The
  requirement (doc 02): "a brief flash or outline on the changed DOM region"
  when the rendered output changes at a commit. Options considered:

  1. **`postMessage` + in‑iframe script**: adds `allow-scripts` to the
     sandbox and injects a small script that diffs old vs new body and
     flashes changed subtrees. Rejected — reintroduces script execution
     inside untrusted‑ish markup for a purely cosmetic effect. Not worth the
     security surface even given curated content.
  2. **Shadow DOM alternative to iframe**: attach a `ShadowRoot` to a host
     `div`, drop the HTML in with `shadow.innerHTML = html`. Style
     isolation, no cross‑origin barrier, `MutationObserver` and DOM diffing
     usable from the parent. But: shadow DOM does *not* fence scripts (a
     `<script>` in `innerHTML` still won't execute per HTML spec's
     "already‑started" rule, but inline event handlers can, and `<img
     onerror>` fires). The iframe's `sandbox=""` is a real security
     boundary; shadow DOM is not. Rejected on the same principle as (1).
  3. **Whole‑iframe flash on commit** — an outline animation on the iframe
     element itself, triggered by a `key` bump or a CSS class toggle when
     `stepIndex` lands on a commit step with a new `dom` string. **Chosen.**
     Doesn't require reaching into the iframe at all. We lose the
     "changed *region* highlight" fidelity — the flash is on the whole
     rendered surface, not the specific subtree that changed — but the
     honest read is: for the trace sizes we're dealing with (one small
     example rendering), the whole surface *is* the changed region often
     enough that region‑level fidelity is overspec. The internals panels
     (Hooks/Effects/Variables) already carry per‑row `changed` flags for
     structural detail; the DOM panel's job is "something visible just
     happened," which a border flash conveys clearly.

  Flagged as an **open question**, not a decision: if region‑level flash
  turns out to matter on richer examples, revisit (2) with a stricter HTML
  sanitizer pass (strip `<script>` and `on*` attributes at record time in
  `merge.ts`, then shadow DOM becomes safe). Deferred pending real content.

### Inter‑panel + player coordination

Single source of truth: `stepIndex`. Every reader is a Zustand selector
subscribed to it (transitively). Player controls (`prev`/`next`/`play`/`speed`/
timeline scrub) mutate only `stepIndex` and `isPlaying`/`speed`; panels have
no awareness of the player.

Derived state — kept minimal:

- **`phaseSegments`** (for the timeline bar's coloured segments): a
  precomputed array of `{start, end, phase}` runs. Computed **once when the
  trace loads**, cached on a module‑level `Map<traceId, PhaseSegment[]>`.
  Not in Zustand — it's a pure function of the trace, so it belongs in a
  memoized selector next to the timeline component, not in store state.
- **`commitStepIndices`** (for jump‑to‑next‑commit affordance and for the
  DOM panel's flash trigger): same treatment — one‑time compute at load,
  cached alongside `phaseSegments`.
- **Timeline hover preview** (small tooltip showing phase + line at hovered
  x): component‑local `useState`; no store round trip for cursor motion.
- **Effect status transitions** (doc 02 open question #2): if the eventual
  design needs to show scheduled→fired as animated state, that's again
  panel‑local — read `status` from the current step's effect, animate on
  key change. No shared state.

The rule: **anything computable purely from the loaded trace lives next to
its consumer as a memoized selector; only interaction state lives in
Zustand.** This keeps the store small, its actions few, and DevTools noise
low.

### Open questions flagged (not resolving)

- **Region‑level DOM change‑flash** — see Stream 3 section above. Chose
  whole‑surface flash; revisit if examples become complex enough that
  region fidelity matters.
- **Effect‑status transition animation** — doc 02 open question #2 stays
  open; architecture supports either static or animated treatment without
  changes.
- **Trace prefetch on popover hover** — could `router.prefetch(otherId)`
  when a popover row is hovered, so the transition to a neighbor trace is
  instantaneous. Cheap to add later; not designed in now to avoid
  guessing at hover‑debounce behavior before the popover exists.



## Build order

The riskiest piece goes first. Do not build the frontend until a real trace
exists.

0. **Confirm the recorder's entry point is `record(sourceCode: string, …)`**
   with a file‑reading wrapper — see forward‑compat rule 4. Do this before
   writing more recorder code; it is cheap now and expensive later.
1. `instrument/stepper.ts` — CDP stepping, React frames blackboxed
2. `instrument/dispatcher.ts` — dispatcher wrapper
3. `instrument/merge.ts` — merge + diff flags + write JSON
4. First example → run end to end → **validate the JSON by hand**
5. Only then: `web/` scaffold, store, panels, player
