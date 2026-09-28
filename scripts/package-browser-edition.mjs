// The Windows and macOS "Browser Edition" deliverables are the SAME file: the single self-contained
// dist/index.html, renamed to what a buyer double-clicks. No build step of its own — just copies the
// already-built app (run `npm run build` first) to a name/location ready to zip for Etsy.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(ROOT, 'dist', 'index.html');
const outDir = path.join(ROOT, 'packaging', 'browser-edition');
const dest = path.join(outDir, 'Life OS.html');

if (!fs.existsSync(src)) {
  console.error('dist/index.html not found — run `npm run build` first.');
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });
fs.copyFileSync(src, dest);
console.log(`wrote ${path.relative(ROOT, dest)} (${(fs.statSync(dest).size / 1024).toFixed(1)} KB)`);
