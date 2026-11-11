# 03 — HookViz: Current Status

> **Stability: LOW — THIS DOC IS EXPECTED TO GO STALE.**
>
> This is the only doc holding volatile state: versions, progress, open
> questions. Everything that changes often lives *here* so docs 00–02 stay
> stable.
>
> **When updating project knowledge, replace this file. Leave 00–02 alone
> unless a real decision changed.**
>
> **Last updated: 2026-11-11 (19 examples recorded; deployed to Vercel;
> Next.js 15.5.29)**

---

## Pinned versions

| Package | Version | Notes |
|---|---|---|
| `react` | `19.2.8` | Exact pin, no caret. Latest stable as of Aug 2026. |
| `react-dom` | `19.2.8` | Must match `react` exactly. |
| `next` | `15.5.29` | Web workspace only. |

**React 19.2 chosen deliberately** — it's the line that introduced
`useEffectEvent`, which is one of the newer hooks we want to cover.

⚠️ Changing any of these requires regenerating all traces. See versioning
policy in doc 01.

---

## Progress

| Milestone | Status |
|---|---|
| Architecture decided | ✅ Done |
| Trace schema v2 | ✅ Done — `dom`, `lane`, `annotations`, `schemaVersion: 2`, `category` all implemented |
| Recorder (Stream 1–3) | ✅ Done — CDP stepper, dispatcher instrumentation, DOM snapshot on commit, lane capture |
| Schema v2 validated | ✅ Done — hand-checked against doc 01 schema; all fields populate correctly |
| v1 hook examples | ✅ Done — 19 examples (8 original hooks + gotcha/second examples + `useLayoutEffect`); the table below lists the original 8 |
| Web scaffold | ✅ Done — Next.js 15, React 19, Zustand v5, Monaco, static export |
| All 5 panels | ✅ Done — Code (Monaco), DOM (iframe), Hooks, Effects, Variables |
| Player + timeline | ✅ Done — play/pause/seek/speed, phase-colored timeline segments |
| Breadcrumb navigation | ✅ Done — anchored popover, hook/category/example scopes |
| Experience toggle | ✅ Done — Guided (annotations visible) / Expert (annotations hidden) |
| Visual design | ✅ Done for v1 |
| Live mode | ⬜ Deferred to milestone 2 (explicit decision, see decisions log) |
| Landing / explainer page | ⬜ Out of scope for v1 (explicit decision, see doc 00) |

---

## v1 hook examples

| ID | Hook | Example |
|---|---|---|
| `usecallback-stable-handler` | `useCallback` | Stable function identity across renders |
| `usecontext-theme` | `useContext` | Reading a shared value without prop drilling |
| `useeffect-stale-closure` | `useEffect` | Stale closure in an empty-deps effect |
| `usememo-filter-list` | `useMemo` | Skipping an expensive recalculation |
| `usereducer-counter` | `useReducer` | Managing state with dispatch |
| `useref-render-counter` | `useRef` | Persisting a value without re-rendering |
| `usestate-counter` | `useState` | Basic counter |
| `usetransition-tab-switch` | `useTransition` | Marking an update low priority |

**Not in v1 (deferred):** `useOptimistic`, `use()`, `useEffectEvent`,
`useId`, `useDeferredValue`. These require async simulation or concurrent
features not yet exercised by the recorder's scenario model.

---

## Open questions

**Product**
- How many examples per hook for v1 is currently 1 each. Adding a second
  "gotcha" or "interview pattern" example per hook is the most obvious
  content expansion once the v1 set is validated by a real user.

**Technical (deferred)**
- `meta.annotations[]` authoring: currently hand-authored per example.
  Auto-extraction heuristic (what counts as a side effect / closure) is
  deferred — Ashish's judgment call on the feel of Guided mode.
- `useOptimistic` / `use()` — requires async simulation in scenarios;
  deferred to v2.

---

## Decisions log

Append here when something changes, so the reason survives.

| Date | Decision | Reason |
|---|---|---|
| 2026-08 | Curated build-time recording over live execution | Determinism; concurrent scheduler is non-deterministic at runtime |
| 2026-08 | React pinned exactly at 19.2.8 | Traces encode version-specific behavior |
| 2026-08 | Monaco read-only over static highlighter | Forward-compat for deferred live mode |
| 2026-08 | Ship v1 minimal; live mode deferred to milestone 2 | Prove the core loop first |
| 2026-08-17 | Live mode (Option B) confirmed deferred — reconsidered explicitly and re-affirmed | Visualizer UI not yet validated; schema likely to shift once real panels render real data; sandboxing cost is the same later |
| 2026-08-17 | Recorder entry point must be `record(sourceCode: string, …)` | Single genuine coupling to live mode; cheap now, expensive retrofit later |
| 2026-08-17 | No server provisioned for v1 | v1 is fully static — Vercel free tier |
| 2026-08-17 | DOM/rendered-output panel added | Hooks/effects data alone didn't show what the user would actually see |
| 2026-08-17 | Annotation layer added (`meta.annotations`) | Beginner-to-advanced audience goal needed a concrete mechanism |
| 2026-08-17 | Experience-level toggle added (Guided/Expert) | Avoids forcing one annotation density on everyone; binary decision in the moment |
| 2026-08-17 | Schema bumped to v2 | `dom` and `annotations` fields added |
| 2026-08-17 | Breadcrumb navigation resolved as an anchored popover, not a page | Landing page stays deferred; popover satisfies browsing need within the VS Code breadcrumb aesthetic |
| 2026-08-17 | Visual design phase marked done for v1 | Recorder/schema work was the sole critical path |
| 2026-08-19 | Stream 3 DOM capture: jsdom in-process read, not Puppeteer (Marlowe) | Recorder renders in jsdom in a child Node process; `outerHTML` is a synchronous in-process read |
| 2026-08-19 | DOM snapshot fires on React's `onCommitFiberRoot`, not `render-end` (Marlowe) | `render-end` is pre-commit — `outerHTML` there is the previous commit's markup |
| 2026-08-19 | Lane/priority captured semantically at the scheduling site (Marlowe) | Raw lane bitmasks are version-specific and meaningless to learners |
| 2026-08-19 | merge.ts absorbs `dom` + `lane` + `annotations` + `schemaVersion` additively — no redesign (Marlowe) | All three slot into existing index-merge |
| 2026-08-19 | v1 hook set = 8 hooks, 1 example each | Cover the core set; gotcha/interview-pattern second examples deferred until v1 validated by users |
