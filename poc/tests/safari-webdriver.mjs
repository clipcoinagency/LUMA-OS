// macOS only: drives REAL Safari (not Playwright WebKit) via safaridriver against the file:// PoC.
// Limitation: Safari WebDriver sessions use isolated, ephemeral website data, so this proves
// "IndexedDB + backup logic work in real Safari from file://" within a session. Persistence across a
// real Safari quit/relaunch still needs the 2-minute manual test on a Mac (see docs).
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const URL_ = pathToFileURL(path.join(HERE, '..', 'web', 'index.html')).href;
const BASE = 'http://127.0.0.1:4444';
const checks = [];
const add = (status, name, detail = '') => { checks.push({ status, name, detail: String(detail) }); console.log(`[${status}] ${name} ${detail}`); };

const driver = spawn('safaridriver', ['-p', '4444'], { stdio: 'inherit' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function wd(method, p, body) {
  const res = await fetch(BASE + p, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json();
  if (json.value && json.value.error) throw new Error(json.value.error + ': ' + json.value.message);
  return json.value;
}
const execAsync = (sid, fnBody) => wd('POST', `/session/${sid}/execute/async`, {
  script: `const done = arguments[arguments.length - 1]; (async () => { ${fnBody} })().then((v) => done({ ok: true, v }), (e) => done({ ok: false, e: String(e && (e.name + ': ' + e.message)) }));`, args: [],
});
const waitReady = `for (let i = 0; i < 100 && !window.lifeosPocReady && !window.lifeosPocError; i++) await new Promise((r) => setTimeout(r, 100)); if (window.lifeosPocError) throw new Error(window.lifeosPocError);`;

let sid;
try {
  for (let i = 0; i < 50; i++) { try { await wd('GET', '/status'); break; } catch { await sleep(200); } }
  const s = await wd('POST', '/session', { capabilities: { alwaysMatch: { browserName: 'safari' } } });
  sid = s.sessionId;
  add('info', 'Safari version', s.capabilities.browserVersion);
  await wd('POST', `/session/${sid}/url`, { url: URL_ });
  let r = await execAsync(sid, `${waitReady} const p = await window.lifeosPoc.writeProbe(); await window.lifeosPoc.addRecords(1000); return { token: p.token, ua: navigator.userAgent, secure: isSecureContext };`);
  if (!r.ok) throw new Error('write: ' + r.e);
  add('pass', 'Real Safari: IndexedDB opens + writes on file://', `secure=${r.v.secure}`);
  const token = r.v.token;
  await wd('POST', `/session/${sid}/url`, { url: 'about:blank' });
  await wd('POST', `/session/${sid}/url`, { url: URL_ });
  r = await execAsync(sid, `${waitReady} const p = await window.lifeosPoc.readProbe(); const c = await window.lifeosPoc.counts(); return { token: p && p.token, records: c.records };`);
  add(r.ok && r.v.token === token && r.v.records === 1000 ? 'pass' : 'fail', 'Real Safari: data survives navigating away + reopening (same session)', JSON.stringify(r.v || r.e));
  r = await execAsync(sid, `${waitReady} return await window.lifeosPoc.selfTest();`);
  if (!r.ok) add('fail', 'Real Safari: in-page self-test', r.e);
  else for (const t of r.v) add(t.status, 'Real Safari self-test: ' + t.name, t.detail);
  r = await execAsync(sid, `${waitReady} return await window.lifeosPoc.storageInfo();`);
  add('info', 'Real Safari: storage persisted / estimate', JSON.stringify(r.v || r.e));
} catch (e) {
  add('fail', 'Safari WebDriver run', e.message);
} finally {
  if (sid) await wd('DELETE', `/session/${sid}`).catch(() => {});
  driver.kill();
}
await fs.mkdir(path.join(HERE, 'results'), { recursive: true });
await fs.writeFile(path.join(HERE, 'results', 'safari-webdriver.json'), JSON.stringify({ at: new Date().toISOString(), url: URL_, checks }, null, 2));
process.exitCode = checks.some((c) => c.status === 'fail') ? 1 : 0;
