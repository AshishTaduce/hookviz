#!/usr/bin/env node
// Re-records examples into a temp folder and checks they match the committed
// traces in recorder/out. The only field allowed to differ is meta.recordedAt.
//
// Run: npm run verify:traces               (all examples, about 2 minutes)
//      npm run verify:traces -- --example=usestate-counter
//
// This runs example code under Node's inspector, the same as `npm run record`.
// Do not run it on a machine that holds secrets for an example you have not read.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const committedDir = join(root, 'recorder', 'out');
const only = process.argv.find((a) => a.startsWith('--example='))?.split('=')[1];

const tmp = mkdtempSync(join(tmpdir(), 'hookviz-verify-'));
const recordArgs = only ? ['run', 'record', '-w', 'recorder', '--', `--example=${only}`] : ['run', 'record:all', '-w', 'recorder'];
const run = spawnSync('npm', recordArgs, {
  cwd: root,
  env: { ...process.env, HOOKVIZ_OUT_DIR: tmp },
  stdio: ['ignore', 'inherit', 'inherit'],
});
if (run.status !== 0) {
  rmSync(tmp, { recursive: true, force: true });
  console.error('\nverify:traces: recording failed (see output above)');
  process.exit(1);
}

// One trace (useRef holding a DOM node) stores a raw dump of React's internal fiber as a string.
// That dump includes random key suffixes (__reactFiber$k3j9x0a) and profiler timings, so it
// differs on every run. Any string containing such a dump is masked before comparing.
const normalise = (file) =>
  JSON.stringify(
    JSON.parse(readFileSync(file, 'utf8'), (key, value) => {
      if (key === 'recordedAt') return undefined;
      if (typeof value === 'string' && /__react(Fiber|Props|Container|Events)\$/.test(value)) return '[serialised DOM node]';
      return value;
    }),
  );

const errors = [];
const fresh = readdirSync(tmp).filter((f) => f.endsWith('.trace.json'));
const committed = new Set(readdirSync(committedDir).filter((f) => f.endsWith('.trace.json')));

for (const f of fresh) {
  if (!committed.has(f)) {
    errors.push(`${f}: recorded, but not committed. Commit recorder/out/${f}`);
    continue;
  }
  if (normalise(join(tmp, f)) !== normalise(join(committedDir, f))) {
    errors.push(`${f}: committed trace differs from a fresh recording. Re-record with: npm run record -- --example=${f.replace('.trace.json', '')}`);
  }
}
if (!only) {
  for (const f of committed) if (!fresh.includes(f)) errors.push(`${f}: committed trace has no example to record`);
}

rmSync(tmp, { recursive: true, force: true });
if (errors.length) {
  console.error(`\nverify:traces found ${errors.length} problem(s):\n`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`\nverify:traces ok (${fresh.length} trace${fresh.length === 1 ? '' : 's'} match)`);
