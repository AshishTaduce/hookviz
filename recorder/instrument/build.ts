import * as esbuild from 'esbuild';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

export const RECORDER_ROOT = path.resolve(import.meta.dirname, '..');
export const BUILD_DIR = path.join(RECORDER_ROOT, '.build');
export const EXAMPLES_DIR = path.join(RECORDER_ROOT, 'examples');
export const OUT_DIR = path.join(RECORDER_ROOT, 'out');

/** Everything React needs at runtime stays external so the example keeps its own line numbers. */
const RUNTIME_EXTERNALS = ['react', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-dom', 'react-dom/client', 'jsdom'];

export interface CompiledExample {
  id: string;
  sourcePath: string;
  outPath: string;
  source: string;
  rawSourceMap: string;
}

export async function compileExample(id: string): Promise<CompiledExample> {
  await mkdir(BUILD_DIR, { recursive: true });
  const sourcePath = path.join(EXAMPLES_DIR, `${id}.tsx`);
  const outPath = path.join(BUILD_DIR, `${id}.js`);

  await esbuild.build({
    entryPoints: [sourcePath],
    outfile: outPath,
    bundle: false,
    format: 'esm',
    platform: 'node',
    target: 'node22',
    jsx: 'automatic',
    sourcemap: true,
    sourcesContent: true,
    minify: false,
    keepNames: true,
  });

  return {
    id,
    sourcePath,
    outPath,
    source: await readFile(sourcePath, 'utf8'),
    rawSourceMap: await readFile(`${outPath}.map`, 'utf8'),
  };
}

export async function compileRunner(): Promise<string> {
  await mkdir(BUILD_DIR, { recursive: true });
  const outPath = path.join(BUILD_DIR, 'runner.mjs');
  await esbuild.build({
    entryPoints: [path.join(RECORDER_ROOT, 'instrument', 'runner.ts')],
    outfile: outPath,
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node22',
    external: RUNTIME_EXTERNALS,
    minify: false,
    keepNames: true,
  });
  return outPath;
}
