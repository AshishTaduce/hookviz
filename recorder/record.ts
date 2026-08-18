#!/usr/bin/env node
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { BUILD_DIR, EXAMPLES_DIR, OUT_DIR, compileExample, compileRunner } from './instrument/build.js';
import { runExample } from './instrument/stepper.js';
import { mergeSteps, parseAnnotations } from './instrument/merge.js';

const require = createRequire(import.meta.url);
const reactVersion = require('react/package.json').version as string;

const args = process.argv.slice(2);
const verbose = args.includes('--verbose');
const all = args.includes('--all');
const idArg = args.find((a) => a.startsWith('--example='))?.split('=')[1] ?? args.find((a) => !a.startsWith('--'));

async function listExamples(): Promise<string[]> {
  const files = await readdir(EXAMPLES_DIR);
  return files.filter((f) => f.endsWith('.tsx')).map((f) => f.replace(/\.tsx$/, ''));
}

async function recordOne(id: string, runnerPath: string) {
  process.env.HOOKVIZ_RUNNER = runnerPath;
  const example = await compileExample(id);
  const raw = await runExample(example, { verbose });
  const { meta: annotations } = parseAnnotations(example.source);

  const trace = mergeSteps(raw, {
    id,
    title: annotations.title ?? id,
    hook: annotations.hook ?? id.split('-')[0],
    reactVersion,
    source: example.source,
  });

  await mkdir(OUT_DIR, { recursive: true });
  const outFile = path.join(OUT_DIR, `${id}.trace.json`);
  await writeFile(outFile, JSON.stringify(trace, null, 2));
  console.log(`✓ ${id}: ${trace.steps.length} steps → ${path.relative(process.cwd(), outFile)}`);
  return trace;
}

async function main() {
  await mkdir(BUILD_DIR, { recursive: true });
  const runnerPath = await compileRunner();
  const ids = all ? await listExamples() : idArg ? [idArg] : [];

  if (!ids.length) {
    console.error('usage: npm run record -- --example=<id>   |   npm run record:all');
    console.error(`available: ${(await listExamples()).join(', ')}`);
    process.exit(1);
  }

  for (const id of ids) await recordOne(id, runnerPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
