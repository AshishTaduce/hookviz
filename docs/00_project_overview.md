# 00 — HookViz: Project Overview

> **Stability: HIGH.** This doc holds decisions and rationale. It should rarely
> change. If something here changes, it means a fundamental direction shift —
> update deliberately and note the date.

---

## What we're building

An interactive React hooks visualizer — conceptually like [jsv9000.app](https://www.jsv9000.app/)
(which visualizes the JS event loop), but for React hooks.

A user picks a curated example, and watches it execute **line by line**, while
simultaneously seeing:

- the **hooks linked list** for that fiber
- the **effects queue** (scheduled → fired → cleaned up)
- **live variable values** at the current statement
- the current **render phase** (render / commit / passive-effect / idle / event)

## Why this project exists

Two goals, both real:

1. **Portfolio centerpiece.** Differentiated — most portfolios have a CRUD app.
   An interactive teaching tool is shareable and tends to spread in dev
   communities. Strong interview talking point.
2. **Learning vehicle.** Building it forces deep internalization of hook
   internals, which doubles as interview prep.

## Audience: beginner through advanced, in one tool

Explicit design goal, not an afterthought: someone learning `useState` for the
first time and someone debugging a `useTransition` race condition should both
want to reach for this tool — neither should feel it wasn't built for them.

This is **not** two separate modes or two separate tools. It's one dataset
(the trace) with a toggleable presentation layer:

- An **annotations layer** (see doc 01 schema, doc 02 UI) names comments,
  function declarations, side effects, and closures inline — the things a
  beginner needs explained and an advanced user wants to hide.
- An **experience-level toggle** controls default density: more annotation
  and explanation surfaced by default for newer users, collapsed to raw state
  by default for experienced ones. Same trace, same panels, different default
  verbosity.

The risk this guards against: a tool that's either too sparse to teach anyone,
or so annotated it feels condescending to someone who already knows the
material. The toggle is the fix — don't try to find one density that pleases
everyone, since it doesn't exist.

## Owner context

Solo project. Developer is an experienced Flutter/React engineer returning to
the React ecosystem after ~8 months of full-time Flutter work, using this
project to close the gap on modern React (19.x), Next.js App Router, and
newer hooks.

Implementation is done via Claude Code; visual design via Claude Design.

---

## The core architectural decision

**Build-time trace recording + static replay player.**

Examples are curated (not user-authored). Each one is executed **once at build
time** under a real V8 debugger with real React, producing a static JSON
trace. The frontend is a dumb replay player over that JSON.

### Why — and what was rejected

| Approach | Verdict | Reasoning |
|---|---|---|
| **Hand-authored animation** (fake, scripted steps) | ❌ Rejected | Scales terribly — every example is manual animation work. Code panel and step data can silently diverge. Feels like a demo, not a tool. |
| **Mini-reconciler** (reimplement React's hook mechanics) | ❌ Rejected | Good story, but reimplementing means the tool teaches *your* model of React, not React. Ongoing maintenance burden as React evolves. |
| **Live in-browser execution** | ❌ Deferred | CDP stepping is impossible browser-to-browser; would require a Babel AST transform instead (inject `__step()` calls). Worse: React's concurrent scheduler is **non-deterministic at runtime** — `useTransition` examples could produce different step orderings run to run. That's fatal for a teaching tool, precisely on the hooks people find most confusing. |
| **Server-side run of user code** (Version B) | 🟡 Milestone 2 | Reuses the existing recorder. Needs a server + Docker sandbox for arbitrary code. Deferral was reconsidered on 2026-08-17 and re-affirmed: the visualizer UI isn't validated yet, the trace schema will likely shift once real panels render real data, and the backend work costs the same later. One prerequisite is required in v1 — the recorder must accept source as a **string**, not a file path (doc 01, forward-compat rule 4). |
| **Build-time recording** (chosen) | ✅ | Real V8 debugger = real lines + real variables. Real React = accurate semantics. Static JSON = cheap hosting, deterministic, no security surface. |

### A note on the DOM panel (added 2026-08-17)

The DOM/rendered-output panel added to the UI spec is **not** a reopening of
the live-execution question. It's a third static capture stream — a DOM
snapshot taken during recording at each commit step, stored in the trace
alongside hook state. Deterministic for a fixed example, same as everything
else in the trace. See doc 01, Stream 3.

### The sustainability property that drove the decision

Adding a new example is: **write the component → run recorder → commit the JSON.**
No animation authoring. No per-example manual work.

Adding support for a *new hook* is a one-time addition to the dispatcher
instrumentation — then all examples using it work normally.

This is what makes "accept a PR to add an example" viable long-term, which was
an explicit design goal.

---

## Scope discipline

**v1 ships minimal.** Core loop working well beats breadth.

Explicitly deferred:
- Live / editable code execution (but *designed for* — see doc 02)
- Hook comparison view (two hooks side by side)
- Landing / explainer page
- User-submitted examples

## Known trade-offs accepted

- **Concurrent hooks need explicit handling.** `useTransition` / `useOptimistic`
  involve React's priority lanes. Rather than fight non-determinism, the trace
  captures lane/priority info explicitly so the UI can *display* scheduling
  rather than pretend it's linear.
- **React version is load-bearing.** Traces encode version-specific hook
  ordering and effect-flush timing. Version bumps require regenerating all
  traces (see doc 01).
- **CDP stepping through React internals is the main technical risk.** Naive
  stepping produces hundreds of irrelevant frames per example. Mitigated with
  blackboxing (see doc 01).
