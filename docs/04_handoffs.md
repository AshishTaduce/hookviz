# 04 — HookViz: Handoffs

> **Stability: MEDIUM.** Copy-paste text for setting up the Project and
> kicking off work in Claude Design / Claude Code. Update the Claude Code
> prompt as milestones complete.

---

## A. Project custom instructions

Paste this into the HookViz project's custom instructions field.

```
This project is HookViz — an interactive React hooks visualizer. Curated
example components are executed once at build time under a real V8 debugger
with real React, producing static JSON traces. The frontend is a replay
player over that JSON.

Doc structure in project knowledge:
- 00 (overview) and 01 (technical spec) are STABLE. Treat their decisions as
  settled. If I ask for something that contradicts them, flag it before
  proceeding rather than quietly going along.
- 02 (UI spec) is the design source of truth.
- 03 (status) is VOLATILE and may be stale. Verify against the actual repo
  before relying on it.
- 04 (this doc) holds handoff prompts.

Key settled decisions, so they don't get re-litigated:
- Live/editable code execution is DEFERRED to milestone 2. This was
  reconsidered and re-affirmed. Do not propose building it now.
- React is pinned EXACTLY (no caret). Version bumps require regenerating all
  traces.
- Trace JSON in recorder/out/ is committed to git — it is source data, not
  build noise.
- v1 needs no server. It deploys static to Vercel free tier.
- No landing/explainer page in v1. Breadcrumb navigation is an anchored
  popover, not a page — see doc 02.

I'm an experienced Flutter/React engineer returning to the React ecosystem
after ~8 months of full-time Flutter work. Skip beginner framing on React
fundamentals; do explain React 19-specific internals and anything that
changed recently.

Be direct. If an approach I suggest has a problem, say so plainly rather
than building it and mentioning caveats afterward.
```

---

## B. Claude Design

### B1. Original kickoff (already used — kept for reference)

Superseded by B2 below. Not for reuse.

<details>
<summary>Original prompt</summary>

```
I'm designing HookViz, an interactive React hooks visualizer — think
jsv9000.app but for React hooks instead of the JS event loop.

The attached UI spec has the settled layout and rationale. Please read it
first; the layout decisions in it are settled, but all visual treatment
(color, spacing, type, motion) is open.

Start with the main visualizer screen. Priorities:
1. The phase timeline at the bottom is the signature element — it shows the
   render → commit → passive-effect lifecycle as colored segments. It should
   read clearly at a glance. Give it the most attention.
2. Four panels update simultaneously every step. The hard problem is visual
   hierarchy: making the thing that just CHANGED findable instantly without
   the whole screen feeling noisy.
3. Dark, terminal/debugger aesthetic. VS Code dark+ debug view, Chrome
   DevTools Sources panel. Serious instrument, not a toy.

The four open design questions at the end of the spec are genuinely
unresolved — I'd like your take on those, especially how to visualize the
hooks linked list so the list STRUCTURE is apparent without it becoming a
node graph that eats the panel.
```
</details>

### B2. Iteration prompt (already used — kept for reference)

Superseded by B3 below. Not for reuse.

<details>
<summary>Second prompt — added DOM panel, annotation layer, experience toggle</summary>

```
Iterating on the HookViz design based on the first pass. Three additions,
all reflected in the re-attached UI spec (doc 02) — please read the updated
"Panels", "Audience", and "Open design questions" sections before changing
anything.

1. NEW PANEL — rendered output / DOM. The current design has no way to see
   what actually changed on screen as you step through — only internal hook
   state. Add a panel showing the live rendered UI at the current step
   (sourced from a DOM snapshot, one per commit). It goes at the TOP of the
   right-hand panel column, above hooks/effects/variables — see the updated
   layout diagram. Give it more visual weight than the internals panels: it's
   the thing a newcomer already understands, and it should anchor the rest.

2. ANNOTATION LAYER on the code panel. Beyond the current line-highlight,
   surface interesting non-hook code elements — comments, function
   declarations, side effects, closures — as small gutter markers (not inline
   text, which would clutter the code). Hover or click reveals a short
   explanation in a popover. I need 3-4 visually distinct marker glyphs, one
   per category, legible at small size, that read as a category system
   without needing a legend. An example with zero annotations should look
   intentionally clean, not broken or incomplete.

3. EXPERIENCE-LEVEL TOGGLE — global, in the top nav, two states only:
   "Guided" (annotations visible by default, notes expanded) and "Expert"
   (annotations hidden by default, denser layout). This is NOT two different
   tools or a locked/unlocked distinction — same data, same panels, just
   different default visibility. One click to switch, no settings menu.
   I want a beginner encountering React hooks for the first time and someone
   with years of experience debugging a useTransition race condition to both
   feel this was built for them.

Please show how the DOM panel changes the right-column proportions, propose
the annotation marker glyphs, and show both Guided and Expert states of the
same screen so I can see the actual difference in density.
```
</details>

### B3. Breadcrumb navigation (already used — kept for reference)

Follow-up in the same session as B1/B2. Resolved how breadcrumb clicks
behave — an anchored popover, not a page. This closed out the design phase
for v1; the main screen (B1/B2) plus this popover (B3) are the full v1
design scope. Not for reuse as-is — if further nav changes come up later,
start a new prompt rather than replaying this one.

<details>
<summary>Third prompt — breadcrumb popover</summary>

```
One more addition to the HookViz design, same session. This is about
breadcrumb navigation — no new page or route, an anchored popover on the
existing top nav.

BEHAVIOR:
- Clicking a breadcrumb segment (category, hook, or the current example name)
  opens a popover anchored directly under the breadcrumb bar — same
  positioning convention as VS Code's own editor breadcrumb, which is
  already our aesthetic reference.
- Clicking the "category" segment shows ALL examples in that category, in a
  single scrollable list, grouped under small hook-name section headers
  (with a count next to each header). Selecting an example loads it
  immediately — there's no intermediate step.
- Clicking the "hook" segment shows the same list pre-filtered to just that
  hook's examples — flat, no grouping needed.
- Clicking the current example name behaves the same as clicking the hook
  segment (sibling examples under the same hook).
- Clicking the HookViz wordmark/logo opens the same popover at the top
  level — all categories, same grouped treatment, one level broader.

LIST ITEM DESIGN:
- Each row: example title + a small thumbnail — a tiny rendering of that
  example's phase-timeline (the colored render/commit/passive-effect strip
  from the bottom of the main screen), shrunk down. This should feel like a
  small sibling of the real timeline, not a new visual language.
- Rows need hover and keyboard-focus states (arrow key navigation, Enter to
  select, Esc to dismiss). Visually this list should look like a close
  relative of the ⌘K command palette result list already in the design —
  ideally close enough that it could reuse the same component, so please
  keep the two visually consistent rather than designing them as unrelated
  patterns.

CONSTRAINTS:
- Dark terminal/debugger aesthetic, consistent with the rest of the UI —
  same monospace-for-content, sans-for-chrome rule.
- This must work identically in Guided and Expert mode — the popover isn't
  part of the annotation/density system, so don't vary it between the two.
- Show me the popover open at both the category level (grouped) and the
  hook level (flat), anchored under the breadcrumb, with the rest of the
  main screen visible (dimmed or not — your call) behind it.
```
</details>

---

## C. Claude Code kickoff

**Design phase is done (B1/B2/B3) — this is now unblocked.**

Point it at the repo. Attach **doc 01 (technical spec)** and **doc 03
(status)** only — doc 00, 02, and 04 aren't inputs to this task.

```
Working on HookViz — see attached technical spec (01) and status (03).

IMPORTANT: the schema was bumped to v2 today. It now includes meta.annotations
and steps[i].dom (a DOM snapshot captured on commit-phase steps only, via
Puppeteer). If any traces exist from before this change, they are schemaVersion
1 and are missing both fields — don't treat them as valid without re-recording.

FIRST TASK, before writing any new recorder code:

Check the recorder's entry point signature. It must be:

  record(sourceCode: string, meta: TraceMeta): Promise<Trace>

with a thin file-reading wrapper for the CLI:

  recordFromFile(path: string) // reads file → calls record()

If it currently takes a file path instead, refactor it now. This is doc 01
forward-compat rule 4 — it's the single coupling to the deferred live-execution
milestone, cheap now and expensive later.

SECOND TASK: implement Stream 3 (DOM snapshot capture) per doc 01 — on
commit-phase steps only, via page.evaluate() reading the root element's
outerHTML.

THEN, verify current state and report back:
1. Does a schema-v2 trace JSON exist in recorder/out/? Show me one.
2. Does it match the FULL schema in doc 01, including dom and annotations?
   Flag any divergence — don't silently adapt the doc to the code or vice
   versa.
3. Is React frame blackboxing working? A simple useState counter should
   produce a trace in the TENS of steps. If it's hundreds, blackboxing is
   misconfigured and that's the bug to fix.
4. Confirm schemaVersion: 2 is present in meta.

Don't build the frontend yet. A validated schema-v2 trace comes first.
```

---

## D. Scaffold usage

`hookviz-scaffold.tar.gz` is **reference only.**

It contains workspace config (root + recorder + web `package.json`, tsconfig,
.gitignore, README) and **empty stubs** in `recorder/instrument/`.

If recorder work already exists: diff the config files against yours, ignore
the stubs entirely. Do not extract over working code.

Useful bits to check against your repo:
- Root `package.json` workspace wiring and script passthrough
- Exact (non-caret) React pin in `recorder/package.json`
- `.gitignore` — note that `recorder/out/*.trace.json` is deliberately
  NOT ignored

---

## E. CLAUDE.md (for the repo root)

Claude Code has no access to this Project's knowledge base — the two are
separate context systems. Drop this file at the repo root so Claude Code
picks up the load-bearing decisions automatically on every session, without
you needing to re-attach docs each time.

```markdown
# HookViz

Interactive React hooks visualizer. Curated examples are executed once at
build time under a real V8 debugger with real React, producing static JSON
traces (`recorder/out/*.trace.json`, committed to git). The frontend
(`web/`) is a dumb replay player over that JSON — no live execution.

## Settled — do not re-litigate

- Live/editable code execution is DEFERRED to milestone 2. Reconsidered and
  re-affirmed on 2026-08-17. Do not propose building it now.
- React is pinned EXACTLY in recorder/package.json (no caret). A version
  bump requires regenerating ALL traces — see versioning policy in
  docs/01_technical_spec.md.
- Trace JSON in recorder/out/ is source data, not build noise. It's
  committed to git on purpose.
- v1 needs no server — static deploy to Vercel free tier. Don't provision
  infrastructure.
- No landing/explainer page in v1. Breadcrumb navigation (category / hook /
  example) is an anchored popover, not a route — see docs/02_ui_spec.md,
  "Navigation" section.
- Recorder entry point must be `record(sourceCode: string, meta): Promise<Trace>`
  with a thin `recordFromFile(path)` wrapper — the one deliberate coupling
  to the deferred live mode.
- Schema is currently v2 (`meta.annotations`, `steps[i].dom`). Traces without
  `schemaVersion: 2` need re-recording; don't build against them.

## Build order

Recorder first, frontend last. Do not scaffold `web/` until a
schema-v2 trace has been hand-validated. See docs/01_technical_spec.md,
"Build order".

## Full docs

If `docs/00-04_*.md` exist in this repo, read them before starting anything
non-trivial — 00 and 01 are stable/settled, 02 is the design source of
truth, 03 is volatile status (verify against actual repo state before
trusting it).
```

Copy the docs themselves into a `docs/` folder in the repo (00–04) so the
`CLAUDE.md` references above actually resolve to something, and so decisions
are versioned alongside the code instead of living only in the claude.ai
Project.
