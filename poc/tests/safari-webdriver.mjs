// macOS only: drives REAL Safari (not Playwright WebKit) via safaridriver against the file:// PoC.
// Limitation: Safari WebDriver sessions use isolated, ephemeral website data, so this proves
// "IndexedDB + backup logic work in real Safari from file://" within a session. Persistence across a
// real Safari quit/relaunch still needs the 2-minute manual test on a Mac (see docs).
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { startServer } from './serve.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FILE_URL = pathToFileURL(path.join(HERE, '..', 'web', 'index.html')).href;
const HTTP_URL = 'http://127.0.0.1:4817/index.html';
let URL_ = FILE_URL;
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
  const server = await startServer(4817);
  // Diagnose file:// first: does Safari (under WebDriver) load and run the page at all?
  const probeState = 'return { href: location.href, title: document.title, ready: document.readyState, poc: typeof window.lifeosPoc, ok: window.lifeosPocReady === true, err: window.lifeosPocError || null, idb: !!window.indexedDB };';
  for (const u of [FILE_URL, HTTP_URL]) {
    try {
      await wd('POST', `/session/${sid}/url`, { url: u });
      await sleep(2500);
      const st = await wd('POST', `/session/${sid}/execute/sync`, { script: probeState, args: [] });
      const works = st.poc === 'object' && (st.ok || st.err);
      add(works && st.ok ? 'pass' : 'info', `Real Safari loads PoC via ${u.startsWith('file') ? 'file://' : 'http://localhost'}`, JSON.stringify(st));
      if (u === FILE_URL && works && st.ok) { URL_ = FILE_URL; break; }
      URL_ = HTTP_URL;
    } catch (e) {
      add('info', `Real Safari navigation to ${u.startsWith('file') ? 'file://' : 'http'}`, e.message);
      URL_ = HTTP_URL;
    }
  }
  add('info', 'Persistence steps below run against', URL_);
  await wd('POST', `/session/${sid}/url`, { url: URL_ });
  let r = await execAsync(sid, `${waitReady} const p = await window.lifeosPoc.writeProbe(); await window.lifeosPoc.addRecords(1000); return { token: p.token, ua: navigator.userAgent, secure: isSecureContext };`);
  if (!r.ok) throw new Error('write: ' + r.e);
  add('pass', `Real Safari: IndexedDB opens + writes (${URL_.startsWith('file') ? 'file://' : 'http://localhost'})`, `secure=${r.v.secure}`);
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
process.exit(checks.some((c) => c.status === "fail") ? 1 : 0);  // exit even though the local server is still open
