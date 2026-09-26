// Turns validation results into GitHub annotations (visible on the public run page without login).
import fs from 'node:fs';
const label = process.argv[2] || 'ci';
const esc = (s) => String(s).replace(/%/g, '%25').replace(/\r/g, '').replace(/\n/g, '%0A');
const lines = [];
const fails = [];
function load(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } }
const v = load('poc/tests/results/validation-results.json');
for (const x of v?.results || []) {
  const p = x.checks.filter((c) => c.status === 'pass').length;
  const f = x.checks.filter((c) => c.status === 'fail');
  const info = x.checks.filter((c) => c.status === 'info').map((c) => `${c.name}: ${c.detail}`).join(' | ');
  lines.push(`${f.length ? 'FAIL' : 'OK'} ${x.target}/${x.mode} ${x.browserVersion || ''}: ${p} passed, ${f.length} failed. ${info}`);
  for (const c of f) fails.push(`${x.target}/${x.mode}: ${c.name} — ${c.detail}`);
}
const s = load('poc/tests/results/safari-webdriver.json');
if (s) {
  const f = s.checks.filter((c) => c.status === 'fail');
  lines.push(`${f.length ? 'FAIL' : 'OK'} real-safari: ${s.checks.filter((c) => c.status === 'pass').length} passed, ${f.length} failed. ` + s.checks.filter((c) => c.status === 'info').map((c) => `${c.name}: ${c.detail}`).join(' | '));
  for (const c of f) fails.push(`real-safari: ${c.name} — ${c.detail}`);
}
if (!v && !s) lines.push('no results produced');
// GitHub shows max 10 annotations of each type per step.
lines.slice(0, 10).forEach((l, i) => console.log(`::notice title=${esc(label)} ${i + 1}::${esc(l)}`));
fails.slice(0, 10).forEach((l) => console.log(`::error title=${esc(label)} failed check::${esc(l)}`));
if (fails.length > 10) console.log(`::error title=${esc(label)}::${fails.length - 10} more failed checks (see ci-results branch)`);
