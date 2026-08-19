import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { compileSource } from './build.js';
import { mergeSteps, parseAnnotations } from './merge.js';
import { runExample } from './stepper.js';
import type { Trace, TraceMeta } from './types.js';

const SCHEMA_VERSION = 2;
const require = createRequire(import.meta.url);

export interface RecordMeta {
  id: string;
  title?: string;
  hook?: string;
  /** Groups examples for breadcrumb navigation. Defaults to the hook name lowercased. */
  category?: string;
  reactVersion?: string;
}

export interface RecordOptions {
  verbose?: boolean;
}

/**
 * Core recorder entry point. Takes source as a STRING, not a file path — the
 * one deliberate coupling to the deferred live mode (doc 01 forward-compat
 * rule 4). Live mode's API route can call this directly with user-submitted
 * code, with no changes to the recorder itself.
 */
export async function record(sourceCode: string, meta: RecordMeta, opts: RecordOptions = {}): Promise<Trace> {
  const example = await compileSource(meta.id, sourceCode);
  const raw = await runExample(example, opts);
  const { meta: sourceMeta, annotations } = parseAnnotations(sourceCode);

  const hook = meta.hook ?? sourceMeta.hook ?? meta.id.split('-')[0];
  const reactVersion = meta.reactVersion ?? (require('react/package.json').version as string);

  const traceMeta: Omit<TraceMeta, 'recordedAt'> = {
    schemaVersion: SCHEMA_VERSION,
    id: meta.id,
    title: meta.title ?? sourceMeta.title ?? meta.id,
    hook,
    category: meta.category ?? hook.toLowerCase(),
    reactVersion,
    source: sourceCode,
    ...(annotations.length ? { annotations } : {}),
  };

  return mergeSteps(raw, traceMeta);
}

/** Thin file-reading wrapper over `record()` for the CLI / on-disk `examples/`. */
export async function recordFromFile(sourcePath: string, meta: RecordMeta, opts: RecordOptions = {}): Promise<Trace> {
  const sourceCode = await readFile(sourcePath, 'utf8');
  return record(sourceCode, meta, opts);
}
