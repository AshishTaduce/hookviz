// Copies monaco-editor's prebuilt AMD bundle into web/public/monaco/vs so the
// static export can serve it at /monaco/vs. Resolves the package wherever npm
// installed it (hoisted to the repo root or nested under web/node_modules).
import { createRequire } from 'node:module';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const webDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(dirname(require.resolve('monaco-editor/package.json')), 'min', 'vs');
const dest = join(webDir, 'public', 'monaco', 'vs');

rmSync(dest, { recursive: true, force: true });
mkdirSync(dirname(dest), { recursive: true });
cpSync(src, dest, { recursive: true });
console.log(`monaco: copied ${src} -> ${dest}`);
