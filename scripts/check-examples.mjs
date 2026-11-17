#!/usr/bin/env node
// Static checks for recorder/examples. Fast, runs no example code, needs no network.
// Run: npm run check:examples
//
// Examples are executed by the recorder, so this is also the first safety gate:
// an example may only import React and may not touch the network, the clock,
// randomness or the process. It is a guard, not a sandbox. CI additionally runs
// without secrets and with a read-only token.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const examplesDir = join(root, 'recorder', 'examples');
const outDir = join(root, 'recorder', 'out');

const MAX_LINES = 120;
const ALLOWED_IMPORTS = new Set(['react']);
const BANNED = [
  [/\bMath\.random\b/, 'Math.random makes the trace differ on every recording'],
  [/\bDate\b/, 'Date reads the real clock; use setTimeout/setInterval with tick() instead'],
  [/\bperformance\.now\b/, 'performance.now reads the real clock'],
  [/\bfetch\s*\(/, 'no real network calls; write a fake with setTimeout (see useeffect-fetch-race.tsx)'],
  [/\bXMLHttpRequest\b|\bWebSocket\b|\bEventSource\b/, 'no real network access'],
  [/\bprocess\b/, 'examples must not touch the Node process'],
  [/\brequire\s*\(/, 'use only `import ... from "react"`'],
  [/\bimport\s*\(/, 'dynamic import is not allowed'],
  [/\beval\s*\(|\bnew\s+Function\b|\bFunction\s*\(/, 'eval and Function are not allowed'],
  [/child_process|node:|\bfs\b/, 'no Node built-ins'],
  [/\blocalStorage\b|\bsessionStorage\b|\bdocument\.cookie\b/, 'no browser storage'],
];

const errors = [];
const fail = (file, msg) => errors.push(`${file}: ${msg}`);

const exampleFiles = readdirSync(examplesDir).filter((f) => f.endsWith('.tsx')).sort();
const traceFiles = existsSync(outDir) ? readdirSync(outDir).filter((f) => f.endsWith('.trace.json')) : [];

for (const file of exampleFiles) {
  const id = file.replace(/\.tsx$/, '');
  const src = readFileSync(join(examplesDir, file), 'utf8');
  const lines = src.split('\n');

  if (!/^[a-z0-9]+(-[a-z0-9]+)+$/.test(id)) fail(file, 'file name must be <hook>-<concept>.tsx in lowercase kebab-case');

  const hook = lines.slice(0, 6).map((l) => l.match(/^\/\/ @hook (\S+)\s*$/)).find(Boolean)?.[1];
  const title = lines.slice(0, 6).map((l) => l.match(/^\/\/ @title (.+?)\s*$/)).find(Boolean)?.[1];
  if (!hook) fail(file, 'missing `// @hook useSomething` in the first lines');
  else {
    if (!/^use[A-Z]\w*$/.test(hook)) fail(file, `@hook "${hook}" must be a React hook name such as useEffect`);
    if (!id.startsWith(hook.toLowerCase() + '-')) fail(file, `file name must start with "${hook.toLowerCase()}-"`);
  }
  if (!title) fail(file, 'missing `// @title useSomething — what it shows` in the first lines');
  else if (hook && !title.startsWith(`${hook} — `)) fail(file, `@title must start with "${hook} — "`);

  if (!/export\s+default\s/.test(src)) fail(file, 'missing a default-exported component');
  if (!/export\s+const\s+scenario\b/.test(src)) fail(file, 'missing `export const scenario`');
  if (!/^\s*\/\/ @annotate:\w[\w-]* .+ \| .+/m.test(src)) fail(file, 'needs at least one `// @annotate:<kind> Label | Explanation`');
  if (lines.length > MAX_LINES) fail(file, `${lines.length} lines; keep an example under ${MAX_LINES} so it teaches one idea`);

  for (const m of src.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)) {
    if (!ALLOWED_IMPORTS.has(m[1])) fail(file, `import from "${m[1]}" is not allowed; examples may only import "react"`);
  }
  if (/^\s*import\s+['"]/m.test(src)) fail(file, 'side-effect imports are not allowed');

  // Strip comments and strings crudely so prose like "Date" in an annotation does not trip the guard.
  const code = src
    .split('\n')
    .map((l) => l.replace(/^\s*\/\/.*$/, ''))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(['"`])(?:\\.|(?!\1)[^\\\n])*\1/g, '""');
  for (const [re, why] of BANNED) if (re.test(code)) fail(file, `forbidden: ${why}`);

  if (!traceFiles.includes(`${id}.trace.json`)) fail(file, `no recorder/out/${id}.trace.json; run: npm run record -- --example=${id}`);
}

for (const t of traceFiles) {
  const id = t.replace(/\.trace\.json$/, '');
  if (!exampleFiles.includes(`${id}.tsx`)) fail(t, `no recorder/examples/${id}.tsx for this trace`);
}

if (errors.length) {
  console.error(`check:examples found ${errors.length} problem(s):\n`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`check:examples ok (${exampleFiles.length} examples)`);
