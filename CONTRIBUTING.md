# Contributing to HookViz

Thanks for helping. The most useful contribution is **a new example**: a small React component that shows one hook behaving in a way people find confusing. Each example is one `.tsx` file plus the trace the recorder produces from it. There is no server, no database and no account to set up.

- Humans: read this file.
- AI agents and bots: read [AGENTS.md](AGENTS.md). It has the same rules in a form made for machines.

## What is welcome

- **New examples.** One idea per example. A gotcha, a before and after, or a "why does this render twice" moment.
- **Fixes to existing examples**, such as a clearer annotation or a wrong explanation.
- **Bug reports** for the player (a panel out of sync, a layout problem, a broken phone view).
- **Small UI fixes** in `web/`.

## What needs a discussion first

Open an issue before starting any of these. They change how the project works, so a pull request without a prior agreement is likely to be closed.

- Live or editable code. HookViz replays recorded runs on purpose.
- New dependencies, or bumping React. The version is pinned because traces depend on it.
- Large redesigns, new pages or new panels.
- Anything in `.github/` or `scripts/`.

## Add an example, step by step

You need Node 20 or newer. Nothing else.

1. **Fork** the repo on GitHub and clone your fork.
2. **Install:**
   ```bash
   npm install
   ```
3. **Create the example** at `recorder/examples/<hook>-<concept>.tsx`. The name is lowercase and starts with the hook, for example `useeffect-double-fire.tsx`. Copy a close relative, such as `usestate-counter.tsx` or `useeffect-fetch-race.tsx`, and change it.
4. **Record it.** This runs your example under Node's debugger with real React and writes `recorder/out/<id>.trace.json`:
   ```bash
   npm run record -- --example=useeffect-double-fire
   ```
5. **Check it.** Static rules first, then a fresh recording compared to the one you made:
   ```bash
   npm run check
   ```
6. **Look at it.** Start the site and open your example in the player:
   ```bash
   npm run dev -w web
   ```
   Open `http://localhost:3000/useeffect-double-fire`. Step through it with the arrow keys. Does every panel make sense? Do the notes explain what the learner is looking at?
7. **Commit both files** (the `.tsx` and the `.trace.json`) and open a pull request.

Do not edit `recorder/out/*.json` by hand and do not commit `web/lib/catalog.ts`. The first is machine output, the second is generated.

## What makes a good example

- **One idea.** If you need two paragraphs to explain it, split it into two examples.
- **Short.** Under about 60 lines is typical. The hard limit is 120.
- **A real mistake.** Prefer something people actually get wrong, shown wrong and then right, in one run.
- **Self-contained.** Import only from `react`. No libraries, no real network calls. Fake a request with `setTimeout`, as `useeffect-fetch-race.tsx` does.
- **Deterministic.** No `Math.random`, no `Date`. Use `tick(ms)` in the scenario to move time forward. The same example must record to the same trace every time.
- **Explained where the code is.** Use `// @note` for the line that follows and `// @annotate:<kind> Label | Explanation` for ideas worth naming. Write for a developer who is new to the hook.
- **Plain language.** Short sentences. Say what React does and why.

The header at the top of the file is required:

```tsx
// @title useEffect — what the example shows, in one line
// @hook useEffect
```

The title must start with the hook name followed by ` — `. `scenario` is a function that clicks and types so the run has something to record:

```tsx
export const scenario = async ({ click, tick }: { click: (s: string) => void; tick: (ms?: number) => Promise<void> }) => {
  click('#inc');
  await tick(100);
};
```

Annotation kinds in use: `function-decl`, `closure`, `side-effect`, `comment`. The README has the full format under "Writing an example".

## What the checks do

`npm run check` runs two things, and CI runs the same two on every pull request:

| Command | What it checks |
|---|---|
| `npm run check:examples` | File name and header, only `react` imported, no network, clock, randomness or `process`, under 120 lines, every example has a trace and every trace has an example |
| `npm run verify:traces` | Records every example again and compares with the committed traces. Only the `recordedAt` timestamp may differ. Takes about two minutes |

CI also builds the site. If your pull request fails a check, the message says which file and what to change.

## Pull requests

- One example per pull request keeps review fast.
- Fill in the pull request template. It asks what the example teaches and how you checked it.
- If an AI wrote any of it, say so in the pull request. That is fine, and it helps the reviewer know what to look at closely.
- Maintainers review every pull request before it is merged. Merging is what publishes to the live site, and only a maintainer can do that.
- If you changed an existing example, re-record it and commit the new trace in the same pull request.

You can add a row to the examples table in the README, but it is optional. A maintainer will tidy it.

## Security

Examples are run by the recorder, so treat them like code someone might read with suspicion. The checks block the obvious things, but they are a guard and not a sandbox, so maintainers read every example before running it. Please do not try to get around them. If you find a way around them, report it privately, see [SECURITY.md](SECURITY.md).

## Licence

By contributing you agree that your contribution is released under the project's [MIT licence](LICENSE).
