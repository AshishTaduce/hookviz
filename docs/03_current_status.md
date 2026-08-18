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
> **Last updated: 2026-08-17 (later same day — design pass complete, doc 02
> updated in place, Claude Code kickoff unblocked)**

---

## Pinned versions

| Package | Version | Notes |
|---|---|---|
| `react` | `19.2.8` | Exact pin, no caret. Latest stable as of Aug 2026. |
| `react-dom` | `19.2.8` | Must match `react` exactly. |
| `next` | `16.2.6` | Web workspace only. |

**React 19.2 chosen deliberately** — it's the line that introduced
`useEffectEvent`, which is one of the newer hooks we want to cover.

⚠️ Changing any of these requires regenerating all traces. See versioning
policy in doc 01.

---

## Progress

| Milestone | Status |
|---|---|
| Architecture decided | ✅ Done |
| Trace schema designed | 🟡 v2 — v1 traces still need re-recording once Stream 3 lands |
| UI layout decided | ✅ Done — main visualizer screen, DOM panel, annotation layer, experience toggle, and breadcrumb popover navigation all decided |
| Visual design | ✅ **Done.** Main visualizer screen (B1/B2) plus breadcrumb popover (B3) — see doc 04 section B. No landing/explainer page designed — explicitly out of scope, see doc 00. |
| Repo scaffold | 🟡 Reference scaffold exists — see caveat below |
| CDP stepper (`stepper.ts`) | ❓ Reported as "initial recordings done" — needs verification against schema v2 |
| Dispatcher instrumentation | ❓ Unknown |
| DOM snapshot capture (Stream 3) | ⬜ Not started — new in schema v2 |
| Merge + trace output | ❓ Unknown |
| First validated trace JSON (schema v2) | ⬜ Not started |
| Web scaffold | ⬜ Not started — **blocked on validated schema-v2 trace, not on design** (design is no longer the blocker) |
| Panels | ⬜ Not started |

---

## ✅ Design phase closed — recorder work is now the critical path

Design was the explicit gate on frontend work (doc 01 build order: recorder →
validated trace → *then* web/). That gate is now open on the design side.
The remaining blocker for starting `web/` is a validated schema-v2 trace, not
design.

**Next action: run the Claude Code kickoff, doc 04 section C, unchanged.**
It was deliberately held until design settled; that condition is now met.

### ⚠️ Schema v2 — still action required (unchanged from before)

The schema change (doc 01): added `meta.annotations` and `steps[i].dom`,
bumped `meta.schemaVersion` to 2. **Any trace recorded before this point is
schemaVersion 1** and does not have DOM snapshots or annotations. It needs
re-recording once the recorder implements Stream 3 (DOM capture). Don't build
frontend panels against v1 traces.

### ⚠️ Scaffold caveat (unchanged)

A reference scaffold was generated (workspaces, package.json files, tsconfig,
empty instrument stubs). **It contains empty stubs.** If recorder work
already exists, use the scaffold as a *diff target* for config/structure
only — do not copy its `instrument/*.ts` files over working code.

---

## Immediate next steps

1. **Run the Claude Code kickoff (doc 04, section C)** against the repo,
   with docs 01 and 03 attached. Unchanged from before — design completion
   doesn't alter its scope.
2. **Check the recorder's entry point signature.** Source string vs. file
   path — refactor now if needed (doc 01 forward-compat rule 4).
3. **Implement Stream 3 (DOM snapshot capture)** — Puppeteer, commit-phase
   steps only.
4. **Re-verify recorder output against schema v2** — `dom` populated on
   commit steps, `meta.annotations` present (even if empty), `schemaVersion:
   2` present.
5. **Confirm blackboxing** — a simple counter example should trace in the
   tens of steps, not hundreds.
6. **Once a schema-v2 trace is validated → scaffold `web/`.** At that point,
   request a frontend kickoff prompt — it will need to reference the
   finished panel design, the Guided/Expert behavior, and the breadcrumb
   popover navigation (all now decided, see doc 02).

**Not doing:** provisioning any server. v1 is static → Vercel free tier.
**Not doing:** a landing/explainer page or route — see doc 00/02, explicitly
out of scope. Breadcrumb navigation is an in-place popover, not a page.

---

## Open questions

**Technical**
- Does the current recorder output match the doc 01 schema, or did it
  diverge?
- Is `lane` / priority capture implemented for concurrent hooks, or
  deferred?
- Is `schemaVersion: 2` actually present in the recorder's output yet?

**Product**
- Final v1 hook list not locked. Candidate order: `useState`, `useEffect`,
  `useRef`, `useMemo`/`useCallback`, `useReducer`, `useContext`,
  `useTransition`, `useOptimistic`, `use()`, `useEffectEvent`.
- How many examples per hook for v1? (Suggested: 2–3 — basic, gotcha,
  interview pattern.)

**Design** — closed for v1. Doc 02's former "open design questions" are now
resolved via the B1/B2/B3 design passes; remaining stylistic polish (exact
marker glyphs, transition timing) can be finalized in implementation rather
than blocking Claude Code from starting.

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
| 2026-08-17 (later) | DOM/rendered-output panel added | Hooks/effects data alone didn't show what the user would actually see |
| 2026-08-17 (later) | Annotation layer added (`meta.annotations`) | Beginner-to-advanced audience goal needed a concrete mechanism |
| 2026-08-17 (later) | Experience-level toggle added (Guided/Expert, two states) | Avoids forcing one annotation density on everyone; binary decision in the moment |
| 2026-08-17 (later) | Schema bumped to v2 | `dom` and `annotations` fields added; pre-existing traces are v1, need re-recording |
| 2026-08-17 (later still) | **Breadcrumb navigation resolved as an anchored popover, not a page.** Request for a "home page" was flagged against doc 00/02's explicit out-of-scope listing; popover satisfies the actual need (browsing examples) without reopening that decision. | Landing/explainer page stays deferred; popover reuses the VS Code breadcrumb convention already chosen as the aesthetic reference and can share the `⌘K` list component |
| 2026-08-17 (later still) | **Visual design phase marked done for v1** — main screen (B1/B2) + breadcrumb popover (B3) | Recorder/schema work is now the sole critical path per doc 01's build order |
| 2026-08-17 (later still) | **Doc 02 updated in place** with the decided Navigation section (was previously an addendum, now merged into the canonical doc) | Doc 02 is the design source of truth and should reflect decisions directly, not via a separate patch file |
