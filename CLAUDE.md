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
- Landing page (`/`) and guide (`/guide`) were added 2026-11-17, reversing the
  earlier "no landing page in v1" decision. Player URLs stay `/<traceId>`.
  Breadcrumb navigation (category / hook / example) is still an anchored
  popover, not a route — see docs/02_ui_spec.md, "Navigation" section.
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
