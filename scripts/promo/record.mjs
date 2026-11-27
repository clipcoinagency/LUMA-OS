// Records the 15-second Life OS promo from the REAL app.
//   node scripts/promo/record.mjs --format=phone|desktop [--out=<dir>] [--only=1,3] [--no-seed] [--shots]
//
// How it works: the built app (dist/) is served on localhost and shown inside a branded wrapper page
// (aurora background, device frame, animated caption, a tap/cursor indicator). The wrapper is recorded
// with Chrome's screencast at full resolution (1080x1920 or 1920x1080) and the frames are encoded to
// WebM with the ffmpeg that ships with Playwright. Scenes are separate clips + one rough cut.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const flag = (k) => process.argv.includes(`--${k}`);
const FORMAT = arg('format', 'phone');
const OUT = arg('out', 'C:/Users/samiu/OneDrive/Desktop/ETSY/promo-video');
const ONLY = arg('only', '').split(',').filter(Boolean).map(Number);
const PROFILE = path.join(os.tmpdir(), 'lifeos-promo-profile-' + FORMAT);
const FRAMES = path.join(os.tmpdir(), 'lifeos-promo-frames-' + FORMAT);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const FMT = {
  phone: { vw: 1080, vh: 1920, aw: 390, ah: 844, scale: 1.9 },
  desktop: { vw: 1920, vh: 1080, aw: 1366, ah: 768, scale: 1.15 },
}[FORMAT];
if (!FMT) throw new Error('--format must be phone or desktop');

const FFMPEG = (() => {
  const base = path.join(process.env.LOCALAPPDATA ?? '', 'ms-playwright');
  const d = fs.readdirSync(base).find((x) => x.startsWith('ffmpeg-'));
  return path.join(base, d, 'ffmpeg-win64.exe');
})();

// ---------------------------------------------------------------- local server (app + wrapper)
const WRAPPER = String.raw`<!doctype html><html><head><meta charset="utf-8"><title>promo</title>
<style>
  html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#04050d;color:#eceffd;font-family:'Segoe UI',system-ui,-apple-system,sans-serif}
  .bg{position:fixed;inset:0;background:
    radial-gradient(60% 42% at 80% 6%,rgba(120,96,255,.50),transparent 70%),
    radial-gradient(55% 40% at 6% 94%,rgba(70,130,255,.38),transparent 70%),
    radial-gradient(40% 28% at 50% 55%,rgba(190,90,255,.16),transparent 70%),#04050d}
  .orb{position:fixed;border-radius:50%;background:radial-gradient(circle at 30% 26%,rgba(255,255,255,.75),rgba(255,255,255,.12) 24%,transparent 34%),radial-gradient(circle at 62% 72%,#7b6cff,#14164f 74%);box-shadow:inset -8px -10px 26px rgba(120,100,255,.4),0 0 60px rgba(120,100,255,.4);opacity:.7}
  .cap{position:fixed;left:0;right:0;text-align:center;padding:0 5%}
  .cap h1{margin:0;padding-bottom:.16em;font-weight:800;letter-spacing:-.03em;line-height:1.04;background:linear-gradient(100deg,#fff 10%,#b9b0ff 55%,#7fd6ff);-webkit-background-clip:text;background-clip:text;color:transparent;animation:up .7s cubic-bezier(.22,1,.36,1) both}
  .cap p{margin:.35em 0 0;color:#a9b0d2;font-weight:600;animation:up .7s .12s cubic-bezier(.22,1,.36,1) both}
  @keyframes up{from{opacity:0;transform:translateY(28px)}}
  .cap,.frame,.card{visibility:hidden}
  body.go .cap,body.go .frame,body.go .card{visibility:visible}
  .frame{position:fixed;background:#0a0d1c;border:1px solid rgba(190,180,255,.35);box-shadow:0 0 0 2px rgba(10,13,28,.9),0 40px 120px rgba(0,0,0,.6),0 0 90px rgba(120,100,255,.35);overflow:hidden;animation:rise .8s cubic-bezier(.22,1,.36,1) both}
  @keyframes rise{from{opacity:0;transform:translateY(40px) scale(.97)}}
  iframe{border:0;display:block;transform-origin:0 0;background:#04050d}
  #cur{position:fixed;left:0;top:0;width:var(--cs);height:var(--cs);margin:calc(var(--cs) / -2) 0 0 calc(var(--cs) / -2);border-radius:50%;background:rgba(255,255,255,.28);border:3px solid rgba(255,255,255,.95);box-shadow:0 6px 28px rgba(0,0,0,.45);pointer-events:none;opacity:0;z-index:50;transition:left .55s cubic-bezier(.22,1,.36,1),top .55s cubic-bezier(.22,1,.36,1),opacity .3s,transform .15s}
  #cur.down{transform:scale(.8)}
  .rip{position:fixed;border-radius:50%;border:4px solid rgba(255,255,255,.9);pointer-events:none;z-index:49;animation:rip .6s ease-out forwards}
  @keyframes rip{from{width:20px;height:20px;margin:-10px 0 0 -10px;opacity:.95}to{width:170px;height:170px;margin:-85px 0 0 -85px;opacity:0}}
  .card{position:fixed;inset:0;display:grid;place-content:center;justify-items:center;text-align:center;gap:26px}
  .card img{width:var(--lg);height:var(--lg);filter:drop-shadow(0 20px 70px rgba(110,100,255,.7));animation:pop .9s cubic-bezier(.3,1.25,.5,1) both}
  @keyframes pop{from{opacity:0;transform:scale(.6)}}
  .card h2{margin:0;font-size:var(--h2);font-weight:800;letter-spacing:-.03em;animation:up .7s .15s both}
  .card h3{margin:0;font-size:var(--h3);font-weight:600;color:#b9b0ff;animation:up .7s .3s both}
  .card .chips{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;animation:up .7s .45s both}
  .card .chips span{padding:10px 22px;border-radius:999px;border:1px solid rgba(190,180,255,.35);background:rgba(120,100,255,.14);font-weight:700;color:#d9d4ff;font-size:var(--chip)}
</style></head><body>
<div class="bg"></div>
<script>
  const q = new URLSearchParams(location.search);
  const fmt = q.get('fmt'), W = innerWidth, H = innerHeight;
  const cfg = fmt === 'phone' ? { aw: 390, ah: 844, s: 1.9, bez: 14, rad: 70, top: 262, cap: 'font-size:82px', sub: 'font-size:42px', capTop: 44, cs: '84px', lg: '330px', h2: '150px', h3: '56px', chip: '34px' }
    : { aw: 1366, ah: 768, s: 1.15, bez: 0, rad: 26, top: 152, cap: 'font-size:58px', sub: 'font-size:26px', capTop: 24, cs: '46px', lg: '260px', h2: '120px', h3: '42px', chip: '26px' };
  document.documentElement.style.setProperty('--cs', cfg.cs);
  document.documentElement.style.setProperty('--lg', cfg.lg);
  document.documentElement.style.setProperty('--h2', cfg.h2);
  document.documentElement.style.setProperty('--h3', cfg.h3);
  document.documentElement.style.setProperty('--chip', cfg.chip);
  const orbs = fmt === 'phone' ? [[120, 300, 150], [930, 170, 80], [960, 1760, 110]] : [[90, 120, 110], [1790, 160, 70], [1760, 900, 130]];
  for (const [x, y, d] of orbs) { const o = document.createElement('i'); o.className = 'orb'; o.style.cssText = 'left:' + (x - d / 2) + 'px;top:' + (y - d / 2) + 'px;width:' + d + 'px;height:' + d + 'px'; document.body.appendChild(o); }
  if (q.get('card')) {
    document.body.insertAdjacentHTML('beforeend', '<div class="card"><img src="/logo.svg" alt=""><h2>Life OS</h2><h3>Your entire life. One system.</h3><div class="chips"><span>Private</span><span>On your device</span><span>No account</span></div></div>');
  } else {
    const cap = document.createElement('div'); cap.className = 'cap'; cap.style.top = cfg.capTop + 'px';
    cap.innerHTML = '<h1 style="' + cfg.cap + '"></h1><p style="' + cfg.sub + '"></p>';
    cap.querySelector('h1').textContent = q.get('cap') || ''; cap.querySelector('p').textContent = q.get('sub') || '';
    document.body.appendChild(cap);
    const h1 = cap.querySelector('h1'); h1.style.whiteSpace = 'nowrap'; h1.style.display = 'inline-block';
    let fs0 = parseFloat(cfg.cap.split(':')[1]); while (h1.scrollWidth > W * 0.9 && fs0 > 30) { fs0 -= 2; h1.style.fontSize = fs0 + 'px'; }
    const fw = cfg.aw * cfg.s + cfg.bez * 2, fh = cfg.ah * cfg.s + cfg.bez * 2;
    const f = document.createElement('div'); f.className = 'frame';
    f.style.cssText = 'width:' + fw + 'px;height:' + fh + 'px;left:' + (W - fw) / 2 + 'px;top:' + cfg.top + 'px;border-radius:' + cfg.rad + 'px;padding:' + cfg.bez + 'px;box-sizing:border-box';
    const i = document.createElement('iframe'); i.id = 'app'; i.name = 'app'; i.src = q.get('src');
    i.style.cssText = 'width:' + cfg.aw + 'px;height:' + cfg.ah + 'px;transform:scale(' + cfg.s + ');border-radius:' + (fmt === 'phone' ? 58 / cfg.s : 0) + 'px';
    f.appendChild(i); document.body.appendChild(f);
    document.body.insertAdjacentHTML('beforeend', '<div id="cur"></div>');
    window.__cursor = (x, y) => { const c = document.getElementById('cur'); c.style.opacity = 1; c.style.left = x + 'px'; c.style.top = y + 'px'; };
    window.__tap = (x, y) => { const c = document.getElementById('cur'); c.classList.add('down'); setTimeout(() => c.classList.remove('down'), 160);
      const r = document.createElement('i'); r.className = 'rip'; r.style.left = x + 'px'; r.style.top = y + 'px'; document.body.appendChild(r); setTimeout(() => r.remove(), 700); };
    window.__origin = () => ({ x: f.offsetLeft + cfg.bez, y: f.offsetTop + cfg.bez });
    window.__hideCursor = () => { document.getElementById('cur').style.opacity = 0; };
  }
  window.__go = () => document.body.classList.add('go');
</script></body></html>`;

function startServer() {
  const types = { '.html': 'text/html; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };
  const files = { '/': path.join(ROOT, 'dist', 'index.html'), '/logo.svg': path.join(ROOT, 'packaging', 'pwa', 'favicon.svg') };
  const mem = new Map();
  const srv = http.createServer((req, res) => {
    const p = req.url.split('?')[0];
    if (p === '/promo.html') { res.writeHead(200, { 'Content-Type': types['.html'] }); return res.end(WRAPPER); }
    const f = files[p];
    if (!f || !fs.existsSync(f)) { res.writeHead(404); return res.end('nf'); }
    if (!mem.has(f)) mem.set(f, fs.readFileSync(f));
    res.writeHead(200, { 'Content-Type': types[path.extname(f)] ?? 'application/octet-stream' });
    res.end(mem.get(f));
  });
  return new Promise((resolve) => srv.listen(47831, '127.0.0.1', () => resolve({ srv, base: 'http://127.0.0.1:47831' })));
}

// ---------------------------------------------------------------- seeding (a believable, real profile)
const dayKey = (offset) => { const d = new Date(); d.setDate(d.getDate() - offset); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

async function seed(base) {
  console.log('seeding a demo profile…');
  await fsp.rm(PROFILE, { recursive: true, force: true });
  const ctx = await chromium.launchPersistentContext(PROFILE, { channel: 'msedge', viewport: { width: 1280, height: 900 }, locale: 'en-US', colorScheme: 'dark' });
  const page = ctx.pages()[0];
  const dlg = () => page.locator('dialog[open]').last();
  const closed = () => page.waitForFunction(() => !document.querySelector('dialog[open]'), null, { timeout: 8000 });
  const next = (n = 'Continue') => page.getByRole('button', { name: n, exact: true });
  await page.goto(base + '/');
  await page.getByRole('button', { name: /Set up my workspace/ }).click();
  await page.getByRole('radio', { name: /Student/ }).click();
  await next().click();
  await next().click();
  await page.getByRole('radio', { name: /^Dark/ }).click();
  await next().click();
  await page.getByLabel('What should we call you?').fill('Alex');
  await next().click();
  await next('Create workspace').click();
  await page.getByRole('button', { name: /Open my workspace/ }).click();
  await page.getByRole('heading', { level: 1, name: /, Alex$/ }).waitFor();

  await page.goto(base + '/#/dev/data');
  await page.getByRole('button', { name: /Add 90 days of sample data/ }).click();
  await page.getByText(/Added sample history/).waitFor();

  // clear the pile of overdue tasks so Home reads as a good day
  await page.goto(base + '/#/dashboard'); await page.reload();
  const tasks = page.getByRole('region', { name: /Today.s tasks/ });
  await tasks.waitFor();
  for (let i = 0; i < 12; i++) { const c = tasks.getByRole('checkbox'); if (!(await c.count())) break; await c.first().click(); await sleep(220); }

  await page.getByPlaceholder(/Add a task for today/).fill('Write the launch plan');
  await page.keyboard.press('Enter');
  await sleep(400);

  // library
  await page.goto(base + '/#/study'); await page.reload();
  await page.getByRole('radio', { name: 'Library' }).click();
  async function addBook(title, author, total, status, color) {
    await page.getByRole('button', { name: /Add (your first )?book/ }).first().click();
    await dlg().getByLabel('Title').fill(title);
    await dlg().getByLabel('Author (optional)').fill(author);
    await dlg().getByLabel('Total pages').fill(String(total));
    await dlg().getByRole('radio', { name: status, exact: true }).click();
    await dlg().getByRole('radio', { name: color }).click();
    await dlg().getByRole('button', { name: 'Add', exact: true }).click();
    await closed();
  }
  await addBook('Atomic Habits', 'James Clear', 320, 'Reading', '#7a5cf0');
  await addBook('Deep Work', 'Cal Newport', 296, 'Reading', '#3b82c4');
  await addBook('Meditations', 'Marcus Aurelius', 254, 'Finished', '#c2653a');
  await addBook('The Pragmatic Programmer', 'Hunt & Thomas', 352, 'Want to read', '#1f9d8a');
  await addBook('Thinking, Fast and Slow', 'Daniel Kahneman', 499, 'Want to read', '#b8486f');
  await page.getByRole('radio', { name: /^All/ }).click();
  for (const [title, p] of [['Atomic Habits', 136], ['Deep Work', 204]]) {
    await page.getByRole('button', { name: new RegExp('^' + title) }).click();
    await dlg().getByLabel('I am on page').fill(String(p));
    await dlg().getByRole('button', { name: 'Set', exact: true }).click();
    await dlg().getByText(new RegExp('^' + p + ' / ')).waitFor();
    await page.keyboard.press('Escape'); await closed();
  }

  // flashcards
  await page.getByRole('radio', { name: 'Flashcards' }).click();
  await page.getByRole('button', { name: /(New deck|Create your first deck)/ }).first().click();
  await dlg().getByLabel('Deck name').fill('Spanish basics');
  await dlg().getByRole('button', { name: 'Create deck' }).click(); await closed();
  await page.getByRole('button', { name: /^Open deck Spanish basics/ }).click();
  await page.getByRole('button', { name: 'Paste a list' }).click();
  await dlg().getByLabel('Cards').fill(['hello :: hola', 'thank you :: gracias', 'goodbye :: adiós', 'please :: por favor', 'good morning :: buenos días', 'see you soon :: hasta pronto', 'water :: agua', 'friend :: amigo'].join('\n'));
  await dlg().getByRole('button', { name: /^Add 8 cards/ }).click(); await closed();

  // history: focus sessions, reading logs and card reviews so streaks and charts are real
  await page.goto(base + '/#/dashboard'); await page.reload();
  await page.locator('main h1').first().waitFor();
  const mins = { 0: [25, 30], 1: [50], 2: [40, 25], 3: [60], 4: [30], 5: [45], 6: [20] };
  await page.evaluate(async ({ mins, days }) => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('lifeos'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const all = (tx, s) => new Promise((res) => { const q = tx.objectStore(s).getAll(); q.onsuccess = () => res(q.result); });
    const tx = db.transaction(['focus_sessions', 'reading_logs', 'card_reviews', 'books', 'cards'], 'readwrite');
    const books = await all(tx, 'books'); const cards = await all(tx, 'cards');
    const atomic = books.find((b) => b.title === 'Atomic Habits');
    let n = 0;
    for (const [off, list] of Object.entries(mins)) for (const m of list) {
      const date = days[off]; const start = new Date(date + 'T' + String(9 + (n % 6)).padStart(2, '0') + ':00:00').toISOString();
      tx.objectStore('focus_sessions').put({ id: 'seed_fs' + n++, date, startedAt: start, endedAt: start, seconds: m * 60, plannedMin: m, taskId: null, projectId: null, label: 'Deep work', createdAt: start });
    }
    for (const off of [1, 2, 3, 4, 5]) tx.objectStore('reading_logs').put({ id: 'seed_rl' + off, bookId: atomic.id, date: days[off], amount: 18 + off * 4, createdAt: new Date().toISOString() });
    for (const off of [1, 2, 3, 4]) for (let k = 0; k < 6; k++) tx.objectStore('card_reviews').put({ id: `seed_cr${off}_${k}`, cardId: cards[k].id, deckId: cards[k].deckId, date: days[off], rating: 'good', createdAt: new Date().toISOString() });
    await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    db.close();
  }, { mins, days: Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((o) => [o, dayKey(o)])) });
  await ctx.close();
  console.log('seeded.');
}


const FPS = 30;
function encodeFrames(paths, outFile) {
  return new Promise((resolve, reject) => {
    const p = spawn(FFMPEG, ['-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', 'pipe:0', '-vf', 'format=yuv420p', '-c:v', 'libvpx', '-b:v', '16M', '-crf', '6', '-auto-alt-ref', '0', '-an', outFile], { stdio: ['pipe', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => { err += d; });
    p.on('close', (c) => (c === 0 ? resolve() : reject(new Error('ffmpeg failed: ' + err.slice(-500)))));
    p.stdin.on('error', () => {});
    (async () => { for (const f of paths) { if (!p.stdin.write(fs.readFileSync(f))) await new Promise((r) => p.stdin.once('drain', r)); } p.stdin.end(); })();
  });
}

// ---------------------------------------------------------------- deterministic recording
// A real-time screencast cannot keep up at 1080x1920 on every machine, so time is virtual: a small shim
// replaces the page clock (performance.now, Date, timers, requestAnimationFrame) and drives every CSS /
// Web animation by hand. The recorder advances it 1/30 s at a time and takes a screenshot per step, so the
// result is an exact 30 fps no matter how long each frame takes to render.
const VT_SHIM = String.raw`(() => {
  if (window.__vt) return;
  window.__vt = true;
  const isTop = window.top === window;
  let now = 0;
  const base = Date.now();
  const RealDate = Date;
  class VDate extends RealDate { constructor(...a) { if (a.length === 0) super(base + now); else super(...a); } static now() { return base + now; } }
  window.Date = VDate;
  performance.now = () => now;
  let tid = 1, rid = 1;
  const timers = new Map(), rafs = new Map();
  window.setTimeout = (fn, ms = 0, ...a) => { const i = tid++; timers.set(i, { fn, at: now + Math.max(0, +ms || 0), a, iv: 0 }); return i; };
  window.setInterval = (fn, ms = 0, ...a) => { const i = tid++; const iv = Math.max(1, +ms || 1); timers.set(i, { fn, at: now + iv, a, iv }); return i; };
  window.clearTimeout = window.clearInterval = (i) => { timers.delete(i); };
  window.requestAnimationFrame = (fn) => { const i = rid++; rafs.set(i, fn); return i; };
  window.cancelAnimationFrame = (i) => { rafs.delete(i); };
  const seen = new WeakMap();
  window.__tick = (dt) => {
    const target = now + dt;
    for (;;) {
      let nxt = null;
      for (const [i, t] of timers) if (t.at <= target && (!nxt || t.at < nxt[1].at)) nxt = [i, t];
      if (!nxt) break;
      const [i, t] = nxt; now = Math.max(now, t.at);
      if (t.iv) t.at += t.iv; else timers.delete(i);
      try { t.fn(...t.a); } catch (e) { console.error(e); }
    }
    now = target;
    const cbs = [...rafs.values()]; rafs.clear();
    for (const fn of cbs) { try { fn(now); } catch (e) { console.error(e); } }
    for (const an of document.getAnimations()) {
      let st = seen.get(an);
      if (st === undefined) {
        // the wrapper's own animations start at the reveal; the app's start where they naturally were
        st = now - (isTop ? 0 : (+an.currentTime || 0));
        seen.set(an, st);
        try { an.pause(); } catch (e) {}
      }
      try { an.currentTime = now - st; } catch (e) {}
    }
  };
})();`;

let page, fr;            // current scene page + the app's frame
let frames = [];
let frameDir = '';
let capturing = false;
const STEP = 1000 / FPS;

async function tickBoth(wrapper) {
  const jobs = [fr.evaluate((d) => window.__tick(d), STEP)];
  if (wrapper) jobs.push(page.evaluate((d) => window.__tick(d), STEP));
  await Promise.all(jobs);
}
/** One 1/30 s step of virtual time (optionally captured). */
async function step({ capture = capturing, wrapper = true } = {}) {
  await tickBoth(wrapper);
  await sleep(14);                                  // let real async work (IndexedDB, layout) land
  if (capture) {
    const file = path.join(frameDir, String(frames.length).padStart(5, '0') + '.jpg');
    await fsp.writeFile(file, await page.screenshot({ type: 'jpeg', quality: 93 }));
    frames.push(file);
  }
}
const advance = async (ms) => { const n = Math.max(1, Math.round(ms / STEP)); for (let i = 0; i < n; i++) await step(); };
/** Wait (in virtual time, captured) until fn() is true. */
async function until(fn, maxMs = 6000) {
  for (let t = 0; t < maxMs; t += STEP) { if (await fn()) return; await step(); }
  throw new Error('timed out waiting for a condition in the scene');
}
const present = (sel) => async () => (await fr.locator(sel).count()) > 0;

async function center(sel, nth = 0) {
  const r = await fr.locator(sel).nth(nth).evaluate((el) => { const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; });
  const o = await page.evaluate(() => window.__origin());   // layout position (the reveal animation moves the live rect)
  if (flag('debug')) console.log('center', sel, JSON.stringify({ r, o, scrollY: await fr.evaluate(() => window.scrollY), iw: await fr.evaluate(() => innerWidth) }));
  return { x: o.x + (r.x + r.w / 2) * FMT.scale, y: o.y + (r.y + r.h / 2) * FMT.scale };
}
/** Move the cursor to an element, tap it with a ripple, then really click it. */
async function tap(sel, { move = 360, nth = 0 } = {}) {
  await until(present(sel)).catch((e) => { throw new Error(e.message + ' [' + sel + ']'); });
  await fr.locator(sel).nth(nth).evaluate((el, bar) => { const b = el.getBoundingClientRect(); if (b.bottom > innerHeight - bar || b.top < 60) el.scrollIntoView({ block: 'center', behavior: 'instant' }); }, FORMAT === 'phone' ? 130 : 20);
  await step({ capture: false, wrapper: false });
  const c = await center(sel, nth);
  await page.evaluate(([x, y]) => window.__cursor(x, y), [c.x, c.y]);
  await advance(move);
  await page.evaluate(([x, y]) => window.__tap(x, y), [c.x, c.y]);
  await page.mouse.click(c.x, c.y);
  await advance(100);
}
async function scrollTween(toY, ms) {
  const from = await fr.evaluate(() => window.scrollY);
  const n = Math.max(1, Math.round(ms / STEP));
  for (let i = 1; i <= n; i++) {
    const t = i / n, e = 1 - Math.pow(1 - t, 3);
    await fr.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), from + (toY - from) * e);
    await step();
  }
}
const yOf = (selector, offset) => fr.evaluate(({ selector, offset }) => { const el = document.querySelector(selector); return el ? Math.max(0, el.getBoundingClientRect().top + window.scrollY - offset) : 0; }, { selector, offset });
const jump = async (selector, offset) => { const y = await yOf(selector, offset); await fr.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), y); };

// selectors (CSS) for the app's own controls
const BTN = (name) => `button:has-text("${name}")`;

async function sceneHome() {
  await advance(FORMAT === 'phone' ? 700 : 900);
  await scrollTween(await yOf('.pulse', FORMAT === 'phone' ? 70 : 24), 800);
}
async function preFocus() { if (FORMAT === 'phone') await jump('.pulse', 70); await settle(200); }
async function sceneFocus() {
  await tap('.pulse button:has-text("Start")', { move: 380 });
  await tap('[role=radio]:has-text("Write the launch plan")', { move: 340 });
  await tap('button:has-text("-minute focus")', { move: 340 });
}
async function domClick(sel) { await fr.locator(sel).first().evaluate((el) => el.click()); }
async function waitQuiet(sel, maxMs = 9000) {
  for (let t = 0; t < maxMs; t += STEP) { if ((await fr.locator(sel).count()) > 0) return; await step({ capture: false, wrapper: false }); }
  throw new Error('pre-roll: ' + sel + ' never appeared');
}
async function preCards() {
  await domClick('[role=radio]:has-text("Flashcards")');
  await waitQuiet('button[aria-label="Review Spanish basics"]');
  await settle(300);
  if (FORMAT === 'phone') await jump('.hero.gcard', 70);
  await settle(150);
}
async function sceneCards() {
  await tap('button[aria-label="Review Spanish basics"]', { move: 340 });
  await tap('button:has-text("Show answer")', { move: 330 });
  await advance(600);
  await tap('button.rb.good', { move: 300 });
}
async function preLibrary() {
  await domClick('[role=radio]:has-text("Library")');
  await waitQuiet('.shelf .book');
  await settle(500);
  if (FORMAT === 'phone') await jump('.stats', 4);
  await settle(150);
}
async function sceneLibrary() {
  await advance(850);
  await tap('.shelf .book >> nth=0', { move: 380 });
  await tap('button.chip:has-text("+25")', { move: 330 });
}
async function sceneThemes() {
  const set = (t) => fr.evaluate((t) => { const r = document.documentElement; r.classList.add('theme-transition'); r.dataset.theme = t; setTimeout(() => r.classList.remove('theme-transition'), 450); }, t);
  await advance(420);
  await set('light'); await advance(780);
  await set('soft'); await advance(780);
  await set('dark');
}
/** Virtual time passes (app only, not captured) — used to position the app before the reveal. */
async function settle(ms) { const n = Math.round(ms / STEP); for (let i = 0; i < n; i++) await step({ capture: false, wrapper: false }); }

const SCENES = [
  { n: 1, name: 'home', cap: 'Your entire life.', sub: 'One system.', route: '#/dashboard', dur: 3000, pre: async () => {}, act: sceneHome },
  { n: 2, name: 'focus', cap: 'Deep focus, one tap.', sub: 'Time logged automatically.', route: '#/dashboard', dur: 2500, pre: preFocus, act: sceneFocus, cleanup: dropActiveFocus },
  { n: 3, name: 'flashcards', cap: 'Cards that stick.', sub: 'Flashcards with spaced repetition.', route: '#/study', dur: 2800, pre: preCards, act: sceneCards },
  { n: 4, name: 'library', cap: 'Every page tracked.', sub: 'Your library, highlights and streaks.', route: '#/study', dur: 2500, pre: preLibrary, act: sceneLibrary },
  { n: 5, name: 'themes', cap: 'Light. Soft. Dark.', sub: 'Make it yours.', route: '#/dashboard', dur: 2700, pre: preFocus, act: sceneThemes },
  { n: 6, name: 'endcard', card: true, dur: 1500, pre: async () => {}, act: async () => { await advance(1500); } },
];

/** The focus scene leaves a running session in the profile; remove it so later scenes start clean. */
async function dropActiveFocus() {
  await fr.evaluate(() => new Promise((res) => {
    const r = indexedDB.open('lifeos');
    r.onsuccess = () => { const db = r.result; const tx = db.transaction('meta', 'readwrite'); tx.objectStore('meta').delete('activeFocus'); tx.oncomplete = () => { db.close(); res(); }; };
  }));
}

async function recordScene(ctx, base, sc) {
  page = await ctx.newPage();
  await page.setViewportSize({ width: FMT.vw, height: FMT.vh });
  const q = new URLSearchParams({ fmt: FORMAT });
  if (sc.card) q.set('card', '1'); else { q.set('cap', sc.cap); q.set('sub', sc.sub); q.set('src', '/' + sc.route); }
  frames = []; capturing = false;
  frameDir = path.join(FRAMES, String(sc.n));
  await fsp.rm(frameDir, { recursive: true, force: true });
  await fsp.mkdir(frameDir, { recursive: true });
  await page.goto(`${base}/promo.html?${q}`, { waitUntil: 'domcontentloaded' });
  if (!sc.card) {
    await page.locator('#app').waitFor({ state: 'attached' });
    for (let i = 0; i < 80 && !fr; i++) { fr = page.frame({ name: 'app' }); if (!fr) await sleep(100); }
    // boot: advance the virtual clock (uncaptured) until the app has rendered
    for (let i = 0; i < 600; i++) {
      try { await tickBoth(false); } catch { /* frame still navigating */ }
      await sleep(25);
      if (await fr.locator('main h1, .hero, .tabs').count().catch(() => 0)) break;
    }
    if (flag('noblur')) await fr.addStyleTag({ content: '*,*::before,*::after{-webkit-backdrop-filter:none !important;backdrop-filter:none !important}' });
    await settle(1400);                     // the app's own entrance finishes before we position it
  } else { fr = page.mainFrame(); }
  await sc.pre();
  await page.evaluate(() => window.__go());
  capturing = true;
  await step();                              // first captured frame = the reveal at t = 0
  try { await sc.act(); if (!sc.card) await page.evaluate(() => window.__hideCursor && window.__hideCursor()); } catch (e) { await page.screenshot({ path: path.join(OUT, `error-${sc.n}.png`) }).catch(() => {}); throw e; }
  const want = Math.round((sc.dur / 1000) * FPS);
  if (frames.length > want) console.log(`  ! scene ${sc.n}: actions need ${(frames.length / FPS).toFixed(2)}s but the slot is ${sc.dur / 1000}s — trimming`);
  while (frames.length < want) await step();
  capturing = false;
  if (sc.cleanup) await sc.cleanup();
  const used = frames.slice(0, want);
  if (flag('shots')) { const d = path.join(OUT, `shots-${FORMAT}`); await fsp.mkdir(d, { recursive: true }); await fsp.copyFile(used.at(-1), path.join(d, `${sc.n}-${sc.name}.jpg`)); await fsp.copyFile(used[Math.floor(used.length / 2)], path.join(d, `${sc.n}-${sc.name}-mid.jpg`)); }
  const clips = path.join(OUT, `clips-${FORMAT}`);
  await fsp.mkdir(clips, { recursive: true });
  const file = path.join(clips, `${String(sc.n).padStart(2, '0')}-${sc.name}.webm`);
  await encodeFrames(used, file);
  await fsp.writeFile(path.join(frameDir, 'meta.json'), JSON.stringify({ frames: used.length }));
  console.log(`  scene ${sc.n} ${sc.name}: ${used.length} frames (${(used.length / FPS).toFixed(1)}s) -> ${path.basename(file)}`);
  await page.close();
  fr = null;
  return { file, seq: used, dir: frameDir };
}

/** Join the saved frames of scenes 1-6 (whatever has been recorded) into one rough cut. */
async function cutFinal() {
  const seq = [];
  const have = [];
  for (const sc of SCENES) {
    const dir = path.join(FRAMES, String(sc.n));
    try {
      const meta = JSON.parse(await fsp.readFile(path.join(dir, 'meta.json'), 'utf8'));
      const files = (await fsp.readdir(dir)).filter((x) => x.endsWith('.jpg')).sort().slice(0, meta.frames).map((x) => path.join(dir, x));
      seq.push(...files); have.push(sc.n);
    } catch { /* scene not recorded yet */ }
  }
  if (have.length !== SCENES.length) { console.log('rough cut skipped — scenes recorded so far:', have.join(',')); return; }
  const final = path.join(OUT, `lifeos-promo-15s-${FORMAT}.webm`);
  await encodeFrames(seq, final);
  console.log('rough cut:', final, `(${(seq.length / FPS).toFixed(1)}s)`);
}

async function main() {
  await fsp.mkdir(OUT, { recursive: true });
  const { srv, base } = await startServer();
  try {
    if (flag('cut')) { await cutFinal(); return; }
    if (!flag('no-seed')) await seed(base);
    const ctx = await chromium.launchPersistentContext(PROFILE, { channel: 'msedge', viewport: { width: FMT.vw, height: FMT.vh }, deviceScaleFactor: 1, locale: 'en-US', colorScheme: 'dark' });
    await ctx.addInitScript(VT_SHIM);
    for (const p of ctx.pages()) await p.close();
    const out = [];
    for (const sc of SCENES) { if (ONLY.length && !ONLY.includes(sc.n)) continue; out.push(await recordScene(ctx, base, sc)); }
    await ctx.close();
    await cutFinal();
  } finally { srv.close(); }
}
main().catch((e) => { console.error(e); process.exit(1); });
