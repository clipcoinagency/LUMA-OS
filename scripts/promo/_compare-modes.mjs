// Proof that Light / Soft / Dark are unchanged: renders the SAME pages with the SAME data and a frozen
// clock in two builds (A = main, B = this branch) and compares the screenshots pixel by pixel.
// Usage: node scripts/promo/_compare-modes.mjs <A dist/index.html> <B dist/index.html> <outDir>
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

const [A, B, OUT] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
const serve = (file, port) => new Promise((ok) => { const html = fs.readFileSync(file); const s = http.createServer((_q, r) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(html); }); s.listen(port, () => ok(s)); });
const servers = [await serve(A, 47871), await serve(B, 47872)];
const PAGES = (all) => (process.env.PAGES ? all.filter(([, l]) => process.env.PAGES.split(',').includes(l)) : all);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const FIXED = new Date(2026, 10, 23, 10, 30, 0);

const browser = await chromium.launch({ channel: 'msedge' });
const clickText = (page, sel, src) => page.evaluate(([s, src]) => { const re = new RegExp(src); const el = [...document.querySelectorAll(s)].find((e) => re.test(e.textContent.trim()) && !e.disabled); el?.click(); return !!el; }, [sel, src]);

async function prepare(port) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light', reducedMotion: 'reduce' });
  await ctx.addInitScript(() => {
    let a = 42; Math.random = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    let n = 0; crypto.randomUUID = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
  });
  const page = await ctx.newPage();
  await page.clock.setFixedTime(FIXED);
  const url = `http://localhost:${port}/`;
  await page.goto(url);
  await page.getByRole('button', { name: /Set up my workspace/ }).click(); await sleep(400);
  await clickText(page, 'button, [role=radio]', '^Founder'); await sleep(300);
  for (let i = 0; i < 6; i++) { if (!(await clickText(page, 'button', '^(Continue|Create workspace)$'))) break; await sleep(450); }
  await clickText(page, 'button', 'Open my workspace'); await sleep(800);
  await page.goto(url + '#/dev/data');
  await page.getByRole('button', { name: /sample data/i }).click(); await sleep(6000);
  await page.goto(url + '#/settings');
  await page.locator('main h1').first().waitFor();
  const name = page.getByLabel(/name/i).first(); await name.fill('Alex'); await name.blur(); await sleep(500);
  return { page, url };
}
async function setTheme(page, url, label) {
  await page.goto(url + '#/settings'); await page.locator('main h1').first().waitFor();
  await page.evaluate((l) => { [...document.querySelectorAll('[role=radio]')].find((b) => b.querySelector('.name')?.textContent.trim() === l)?.click(); }, label);
  await sleep(700);
}
// wait until the page has truly settled: no loading placeholders, and two captures in a row agree
async function shot(page, url, hash) {
  // a fresh load for every capture: no state (scroll watchers, focus) carried over from the previous page
  await page.goto(url + hash); await page.reload(); await page.locator('main h1').first().waitFor(); await sleep(1500);
  await page.mouse.move(0, 0);
  // start every capture from the top, with the sticky bar's scroll state settled (it follows real scrolling)
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' })); await sleep(300);
  await page.evaluate(() => window.scrollTo({ top: 1, behavior: 'instant' })); await sleep(200);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' })); await sleep(500);
  await page.waitForFunction(() => !document.querySelector('main [aria-busy="true"]'), null, { timeout: 60000 }).catch(() => {});
  let prev = await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' });
  for (let i = 0; i < 10; i++) {
    await sleep(900);
    const next = await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' });
    if (next.equals(prev)) return next;
    prev = next;
  }
  return prev;
}

const a = await prepare(47871), b = await prepare(47872);
const cmp = await (await browser.newContext()).newPage();
const results = [];
for (const theme of (process.env.THEMES ?? 'Light,Soft,Dark').split(',')) {
  await setTheme(a.page, a.url, theme); await setTheme(b.page, b.url, theme);
  for (const [hash, label] of PAGES([['#/dashboard', 'home'], ['#/tasks', 'tasks'], ['#/calendar', 'calendar'], ['#/finance', 'finance'], ['#/habits', 'habits'], ['#/goals', 'goals'], ['#/insights', 'insights'], ['#/notes', 'notes'], ['#/reset', 'reset'], ['#/work', 'work']])) {
    const [ia, ib] = [await shot(a.page, a.url, hash), await shot(b.page, b.url, hash)];
    const same = ia.equals(ib);
    let diff = 0, total = 0;
    if (!same) {
      ({ diff, total } = await cmp.evaluate(async ([x, y]) => {
        const load = (b64) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = 'data:image/png;base64,' + b64; });
        const [p, q] = await Promise.all([load(x), load(y)]);
        if (p.width !== q.width || p.height !== q.height) return { diff: -1, total: p.width * p.height };
        const c = document.createElement('canvas'); c.width = p.width; c.height = p.height; const g = c.getContext('2d');
        g.drawImage(p, 0, 0); const d1 = g.getImageData(0, 0, c.width, c.height).data;
        g.clearRect(0, 0, c.width, c.height); g.drawImage(q, 0, 0); const d2 = g.getImageData(0, 0, c.width, c.height).data;
        let n = 0; for (let i = 0; i < d1.length; i += 4) if (Math.abs(d1[i] - d2[i]) + Math.abs(d1[i + 1] - d2[i + 1]) + Math.abs(d1[i + 2] - d2[i + 2]) > 6) n++;
        return { diff: n, total: d1.length / 4 };
      }, [ia.toString('base64'), ib.toString('base64')]));
      fs.writeFileSync(path.join(OUT, `${theme}-${label}-A.png`), ia);
      fs.writeFileSync(path.join(OUT, `${theme}-${label}-B.png`), ib);
    }
    results.push({ theme, page: label, identical: same || diff === 0, diffPixels: diff });
    console.log(`${theme.padEnd(5)} ${label.padEnd(9)} ${same ? 'IDENTICAL (byte-for-byte)' : diff === 0 ? 'IDENTICAL (pixels)' : diff === -1 ? 'DIFFERENT SIZE' : `DIFF ${diff} px of ${total}`}`);
  }
}
fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2));
await browser.close();
for (const s of servers) s.close();
