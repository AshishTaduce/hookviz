# 02 — HookViz: UI Spec

> **Stability: MEDIUM.** Layout decisions and their rationale are settled.
> Specific visual treatment (exact colors, spacing, motion) is expected to
> evolve during design iteration — treat those as starting points, not law.
>
> **This doc is the primary input for Claude Design.**

---

## Aesthetic direction

**Dark, terminal / debugger-like.** VS Code debugger vibe, not a docs site and
not playful-illustrative.

Rationale: the tool *is* a debugger. Matching the visual language people already
associate with stepping through code means less to learn. It also reads as a
serious instrument rather than a toy.

Reference points: VS Code dark+ debug view, Chrome DevTools Sources panel.

---

## Layout — four zones

```
┌──────────────────────────────────────────────────────────┐
│ top nav · breadcrumbs: category/hook/example [◐] ⌘K │
├──────────────────────────────┬───────────────────────────┤
│                               │ rendered output (DOM)     │
│                               │ ┌─────────────────────┐   │
│                               │ │ [count: 0] [+1]     │   │
│                               │ └─────────────────────┘   │
│  code panel                  ├───────────────────────────┤
│  (line-highlighted,          │ hooks (linked list)        │
│  Monaco read-only,           ├───────────────────────────┤
│  optional annotation         │ effects queue               │
│  markers in the gutter)      ├───────────────────────────┤
│                               │ variables                  │
├──────────────────────────────┴───────────────────────────┤
│ ▶ ◀ ▶ step 4 / 27                                          │
│ ▓▓▓▓▓▓ render ▓▓ commit ▓▓▓▓ effects ░░░░                  │
└──────────────────────────────────────────────────────────┘
```

`[◐]` in the top nav is the experience-level toggle — see "Audience" section
below. It is global chrome, not buried in a settings panel.

### Why this arrangement

- **Code left, inspector panels right.** The eye moves constantly between
  "what line is running" and "what changed" — they must be horizontally
  adjacent, not separated by scroll distance.
- **Panels stacked, never tabbed.** The entire point is seeing DOM, hooks,
  effects, and variables change *simultaneously*. Tabs would defeat the tool.
- **DOM panel goes at the top of the right column**, above the internals
  panels. Rationale: it's the thing a visitor already understands ("the app
  changed") before they've learned to read hook state — it's the anchor that
  makes the internals panels legible by comparison, not an equal-weight
  fourth data table.
- **Timeline at the bottom spans full width.** It's not just a scrubber.

### The phase timeline is the signature element

Coloured by phase (render → commit → passive-effect), so the *shape* of the
lifecycle is legible at a glance before stepping through anything.

This is the highest-teaching-value element in the UI and the thing jsv9000 has
no equivalent of. Protect it during design iteration — if something has to get
visually louder, it's this.

---

## Navigation (decided)

**Top nav + breadcrumbs**, structured as `category / hook / example`.

Example: `state / useState / stale closure`

This supports multiple examples per hook and multiple hooks per category, which
is required for the long-term "add an example via PR" model.

Clicking any segment opens a **popover anchored under the breadcrumb bar** —
not a route change, not a separate page. Same convention as VS Code's own
editor breadcrumb, which already matches this project's aesthetic reference.

- **Category segment** (e.g. `state`) → popover shows every example in that
  category, in one scrollable list, grouped under small hook-name section
  headers with a count per header. Selecting an example loads it directly.
- **Hook segment** (e.g. `useState`) → same popover, pre-filtered to that
  hook's examples — flat list, no grouping.
- **Current example segment** → same as hook-level (sibling examples under
  the same hook).
- **Logo/wordmark** → same popover at the top level (all categories) — acts
  as the breadcrumb root. This is the tool's only "home" affordance; there is
  no separate landing page (still explicitly out of scope for v1 — see
  bottom of this doc).

List item = example title + a small thumbnail of that trace's phase-timeline
(a shrunk version of the signature bottom-bar element, not new iconography).
Arrow-key navigable, Enter to select, Esc to dismiss. Visually a close
relative of the `⌘K` command palette list — intended to share the same
underlying list component rather than be designed as an unrelated pattern.

Identical behavior in Guided and Expert mode — the popover is not part of
the annotation/density system (see "Audience" below).

Plus a `⌘K` command palette for direct search.

---

## Panels

| Panel | Shows | Notes |
|---|---|---|
| **Code** | Source with current line highlighted | Monaco, read-only in v1. Gutter carries optional annotation markers — see below. |
| **DOM / rendered output** | The actual rendered UI at the current commit | Sourced from `steps[i].dom` (doc 01, Stream 3). Renders inside a small sandboxed `<iframe srcdoc>` or shadow DOM, styled minimally — this is "what the user sees," not a styled preview. Holds the last-known snapshot between commits rather than going blank. |
| **Hooks** | The fiber's hooks linked list, in order | Linked-list *shape* should be visible — this is a teaching point, not just a table |
| **Effects** | Effect queue with status | scheduled / fired / cleanup-pending / cleaned-up |
| **Variables** | Live locals at current statement | Changed values need clear visual emphasis |
| **Player** | prev / next / play / speed, step counter | Plus the phase timeline |

### Change emphasis

Every step, some subset of DOM/hooks/variables changed. The `changed: true`
flag is already in the data. Design needs a consistent, non-distracting
treatment for "this just changed" — probably a brief highlight that decays,
not a persistent badge. The DOM panel needs its own version of this: when the
rendered output changes at a commit, that transition should be visible (a
brief flash or outline on the changed DOM region), not just a silent swap.

### Annotation layer (code panel)

Sourced from `meta.annotations` (doc 01) — line-anchored markers for
comments, function declarations, side effects, and closures.

- Rendered as small **gutter markers**, not inline text — inline would compete
  with the line-highlight and clutter the code itself.
- Hover or click reveals the `label` + `detail` in a lightweight popover.
- Type gets a distinct marker glyph/color per category (comment vs
  side-effect vs closure) so a scan of the gutter alone shows "where the
  interesting things are" before reading any of them.
- **Visibility is controlled by the experience-level toggle**, not a separate
  settings panel — see below.
- An example with no annotations must look intentional, not broken: empty
  gutter, no placeholder, no "no annotations available" message.

---

## Audience: the experience-level toggle

See doc 00 for the underlying decision. One dataset, one layout, one
toggleable presentation.

**Two states**, not a spectrum — a spectrum is indecisive UI for a decision
that's genuinely binary in the moment ("explain this to me" vs "show me the
data"):

- **Guided** (default for new visitors): annotation gutter markers visible,
  `note` field shown expanded near the player, more generous spacing.
- **Expert**: annotation markers hidden (still reachable via a keyboard
  shortcut or hover, never fully removed), `note` collapsed to a small icon,
  tighter density.

Toggle lives in the top nav — `[◐]` in the layout diagram — global and always
visible, one click, no nested settings menu. Persisted in local storage across
visits, not per-example.

**The thing to avoid:** don't build "Guided" as a simplified/limited version
of the tool and "Expert" as the real one. Same trace, same panels, same
capability — only the default visibility of the annotation and note layers
changes. A guided-mode user who clicks a hidden expert affordance should get
it; nothing is actually locked. The breadcrumb popover is identical in both
modes — it is not part of this density system.

---

## Design constraints

- **Dense but not cramped.** This is a power-user tool; information density is
  a feature. But five panels updating simultaneously can become noise — visual
  hierarchy has to make the *changed* thing findable instantly.
- **The DOM panel renders untrusted-ish HTML** (it's from curated examples, but
  still raw markup). Use `<iframe srcdoc>` with no scripts executed, not
  `dangerouslySetInnerHTML` directly in the page — cheap isolation, no reason
  to skip it even for trusted content.
- **Monospace for all code, values, and hook state.** Sans-serif only for
  chrome and labels.
- **Motion should be fast and functional.** Step transitions need to feel
  instant. Animation communicates *what changed*, never decorates.
- **Must work at laptop width.** Optimize for ~1440px; degrade gracefully
  narrower. Mobile is out of scope for v1.

---

## Open design questions

These are genuinely unresolved — good candidates for further design
iteration during implementation:

1. How to visualize the hooks **linked list** so the list structure is
   apparent, without it becoming a big node-graph that eats the panel.
2. Effect **status transitions** — how to show scheduled → fired → cleaned-up
   as a state change rather than just a changing label.
3. Whether `phase` needs representation **in the panels** too, or whether the
   timeline alone carries it.
4. Treatment for `lane` / priority on concurrent-hook examples — this only
   appears on some traces, so it can't be a permanently-reserved slot.
5. DOM panel sizing relative to the three internals panels below it. Give it
   disproportionate weight (it's the most legible panel to a newcomer) or
   match it to the others (visual consistency)? Leaning toward
   disproportionate, but untested.
6. Annotation gutter marker glyphs. Need 3–4 distinct, small, legible-at-12px
   marks that read as a category system without a legend.
7. Guided/Expert toggle transition. Should switching modes animate
   (annotations fade in/out) or snap instantly? Leaning snap — motion here
   risks feeling like a "loading" state rather than a preference change.

These are stylistic/implementation-level polish, not blockers — they don't
need to hold up starting the recorder or frontend work.

---

## Explicitly out of scope for v1

- Landing / explainer page — the breadcrumb popover (see "Navigation" above)
  covers browsing/entry needs without this
- Hook comparison view
- Editable code (designed for, not built — see doc 01)
- Mobile layout
- Light mode
- A third experience-level tier ("intermediate") — two states only, see
  "Audience" section above
