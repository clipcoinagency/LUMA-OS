// Build guard: the product must be ONE file with zero external references (works offline, from file://).
import fs from 'node:fs';
const html = fs.readFileSync('dist/index.html', 'utf8');
const problems = [];
if (/<script[^>]+\bsrc=/i.test(html)) problems.push('external <script src>');
if (/<link[^>]+rel=["']?(stylesheet|modulepreload|preload)/i.test(html)) problems.push('external stylesheet/preload');
if (/url\(\s*["']?(https?:)?\/\//i.test(html)) problems.push('remote url() in CSS');
if (/\b(fonts\.googleapis|fonts\.gstatic|cdn\.jsdelivr|unpkg\.com|cdnjs)/i.test(html)) problems.push('CDN reference');
if (/\bimport\s*\(\s*["'`][./]/.test(html)) problems.push('dynamic import of a sibling file');
if (/\bfetch\s*\(\s*["'`][./]/.test(html)) problems.push('fetch() of a sibling file');
const kb = (Buffer.byteLength(html) / 1024).toFixed(1);
if (problems.length) { console.error(`✖ dist/index.html is not self-contained: ${problems.join(', ')}`); process.exit(1); }
console.log(`✔ dist/index.html is self-contained (${kb} KB)`);
