import * as esbuild from 'esbuild';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

export const RECORDER_ROOT = path.resolve(import.meta.dirname, '..');
export const BUILD_DIR = path.join(RECORDER_ROOT, '.build');
export const EXAMPLES_DIR = path.join(RECORDER_ROOT, 'examples');
// HOOKVIZ_OUT_DIR lets scripts/verify-traces.mjs record into a temp folder and compare, without touching recorder/out.
export const OUT_DIR = process.env.HOOKVIZ_OUT_DIR ? path.resolve(process.env.HOOKVIZ_OUT_DIR) : path.join(RECORDER_ROOT, 'out');

/** Everything React needs at runtime stays external so the example keeps its own line numbers. */
const RUNTIME_EXTERNALS = ['react', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-dom', 'react-dom/client', 'jsdom'];

export interface CompiledExample {
  id: string;
  sourcePath: string;
  outPath: string;
  source: string;
  rawSourceMap: string;
}

/**
 * Compiles example source held in memory — the live-mode-facing path (doc 01
 * forward-compat rule 4). `resolveDir` anchors relative imports the same way a
 * real file on disk would; examples/ have none today, but user-submitted
 * source in live mode might.
 */
export async function compileSource(id: string, source: string, resolveDir = EXAMPLES_DIR): Promise<CompiledExample> {
  await mkdir(BUILD_DIR, { recursive: true });
  const outPath = path.join(BUILD_DIR, `${id}.js`);

  await esbuild.build({
    stdin: {
      contents: source,
      sourcefile: `${id}.tsx`,
      loader: 'tsx',
      resolveDir,
    },
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
    sourcePath: path.join(resolveDir, `${id}.tsx`),
    outPath,
    source,
    rawSourceMap: await readFile(`${outPath}.map`, 'utf8'),
  };
}

/** Thin file-reading wrapper over `compileSource` for the on-disk `examples/` set. */
export async function compileExample(id: string): Promise<CompiledExample> {
  const sourcePath = path.join(EXAMPLES_DIR, `${id}.tsx`);
  const source = await readFile(sourcePath, 'utf8');
  return compileSource(id, source);
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
