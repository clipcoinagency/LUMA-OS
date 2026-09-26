// Guards the single-file contract: fails if the build references anything outside itself.
import fs from 'node:fs';
const html = fs.readFileSync('dist/index.html', 'utf8');
const problems = [];
if (/<script[^>]+\bsrc=/i.test(html)) problems.push('external <script src>');
if (/<link[^>]+rel=["']?(stylesheet|modulepreload)/i.test(html)) problems.push('external stylesheet/modulepreload');
if (/\b(https?:)?\/\/(fonts\.|cdn\.|unpkg|jsdelivr|googleapis)/i.test(html)) problems.push('CDN / remote URL');
if (/\bimport\s*\(\s*["'][./]/.test(html)) problems.push('dynamic import of a sibling file');
const kb = (Buffer.byteLength(html) / 1024).toFixed(1);
console.log(problems.length ? `FAIL: ${problems.join(', ')}` : `OK: dist/index.html is self-contained (${kb} KB)`);
process.exitCode = problems.length ? 1 : 0;
