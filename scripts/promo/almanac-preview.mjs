// Preview shots of the Almanac style (Paper + Night Ink) from the built single file.
// Usage: node scripts/promo/almanac-preview.mjs <outDir>   (needs `npm run build` first)
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = path.resolve(process.argv[2] ?? path.join(ROOT, 'almanac-preview'));
fs.mkdirSync(OUT, { recursive: true });
const html = fs.readFileSync(path.join(ROOT, 'dist', 'index.html'));
const server = http.createServer((_q, r) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(html); });
await new Promise((ok) => server.listen(47861, ok));
const URL = 'http://localhost:47861/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clickText = (page, sel, re) => page.evaluate(([s, src]) => {
  const re = new RegExp(src);
  const el = [...document.querySelectorAll(s)].find((e) => re.test(e.textContent.trim()) && !e.disabled);
  el?.click();
  return !!el;
}, [sel, re.source]);

const browser = await chromium.launch({ channel: 'msedge' });

async function setup(page) {
  await page.goto(URL);
  await page.getByRole('button', { name: /Set up my workspace/ }).click();
  await sleep(500);
  await clickText(page, 'button, [role=radio]', /^Founder/); await sleep(300);
  await clickText(page, 'button', /^Continue$/); await sleep(500);
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('[aria-checked]')].find((e) => (e.closest('label,button,[role]')?.textContent || '').trim().startsWith('Study & Read'));
    if (el && el.getAttribute('aria-checked') === 'false') el.click();
  });
  for (let i = 0; i < 6; i++) { if (!(await clickText(page, 'button', /^(Continue|Create workspace)$/))) break; await sleep(500); }
  await clickText(page, 'button', /Open my workspace/); await sleep(800);
  await page.goto(URL + '#/dev/data');
  await page.getByRole('button', { name: /sample data/i }).click();
  await sleep(6000);
  await page.goto(URL + '#/settings');
  await page.locator('main h1').first().waitFor();
  const name = page.getByLabel(/name/i).first();
  await name.fill('Alex'); await name.blur(); await sleep(600);
}
async function shot(page, hash, file, { scrollTo = 0, full = false } = {}) {
  await page.goto(URL + hash);
  await page.locator('main h1').first().waitFor();
  await sleep(1500);
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), scrollTo);
  await sleep(500);
  await page.screenshot({ path: path.join(OUT, file), fullPage: full });
  console.log('wrote', file);
}
async function theme(page, label) {
  await page.goto(URL + '#/settings');
  await page.locator('main h1').first().waitFor();
  await page.evaluate((l) => { [...document.querySelectorAll('[role=radio]')].find((b) => b.querySelector('.name')?.textContent.trim() === l)?.click(); }, label);
  await sleep(600);
}

// desktop
const desk = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5, colorScheme: 'light', permissions: ['notifications'] });
const p = await desk.newPage();
await setup(p);
await theme(p, 'Paper');
await shot(p, '#/dashboard', '01-paper-home.png');
await shot(p, '#/dashboard', '02-paper-home-columns.png', { scrollTo: 820 });
await shot(p, '#/tasks', '03-paper-tasks.png');
await shot(p, '#/calendar', '04-paper-calendar.png');
await shot(p, '#/finance', '05-paper-finance.png');
await shot(p, '#/insights', '06-paper-insights.png');
await shot(p, '#/dashboard', '10-paper-home-full.png', { full: true });

// new in the Almanac: the year in ink, the DONE stamp, today's page in print, reminders
await p.goto(URL + '#/dashboard'); await p.locator('main h1').first().waitFor(); await sleep(1500);
await p.locator('.yi').scrollIntoViewIfNeeded(); await p.evaluate(() => window.scrollBy(0, -120));
const box = await p.locator('.yi rect.c.l3').first().boundingBox();
if (box) await p.mouse.move(box.x + 4, box.y + 4);
await sleep(500); await p.screenshot({ path: path.join(OUT, '13-paper-year-in-ink.png') }); console.log('wrote 13-paper-year-in-ink.png');
await p.goto(URL + '#/habits'); await p.locator('main h1').first().waitFor(); await sleep(1500);
await p.locator('main [role=checkbox][aria-checked=false]').first().click(); await sleep(260);
await p.screenshot({ path: path.join(OUT, '14-paper-done-stamp.png') }); console.log('wrote 14-paper-done-stamp.png');
await p.goto(URL + '#/dashboard'); await p.locator('main h1').first().waitFor(); await sleep(1500);
await p.emulateMedia({ media: 'print' }); await sleep(400);
await p.screenshot({ path: path.join(OUT, '15-paper-print-page.png'), fullPage: true }); console.log('wrote 15-paper-print-page.png');
await p.emulateMedia({ media: 'screen' });
await p.goto(URL + '#/settings'); await p.locator('main h1').first().waitFor(); await sleep(1200);
await p.getByRole('switch', { name: /^Notifications/ }).click().catch(() => {}); await sleep(600);
await p.getByRole('heading', { name: 'Reminders & notifications' }).scrollIntoViewIfNeeded(); await p.evaluate(() => window.scrollBy(0, -110)); await sleep(500);
await p.screenshot({ path: path.join(OUT, '16-paper-reminders-settings.png') }); console.log('wrote 16-paper-reminders-settings.png');

await theme(p, 'Night Ink');
await shot(p, '#/dashboard', '07-night-ink-home.png');
await shot(p, '#/habits', '08-night-ink-habits.png');
await shot(p, '#/dashboard', '09-night-ink-home-full.png', { full: true });
// Nebula + the new sections
await theme(p, 'Nebula');
await shot(p, '#/dashboard', '20-nebula-home.png');
await shot(p, '#/dashboard', '21-nebula-rituals-timeline.png', { scrollTo: 700 });
await p.evaluate(() => { const y = document.querySelector('.yi'); if (y) window.scrollTo({ top: y.getBoundingClientRect().top + window.scrollY - 90, behavior: 'instant' }); }); await sleep(500);
await p.screenshot({ path: path.join(OUT, '22-nebula-year-in-light.png') }); console.log('wrote 22-nebula-year-in-light.png');
await shot(p, '#/close', '23-nebula-close-the-day.png');
await shot(p, '#/seals', '24-nebula-seals.png');
await shot(p, '#/tasks', '25-nebula-tasks.png');
await shot(p, '#/dashboard', '26-nebula-home-full.png', { full: true });
await p.goto(URL + '#/dashboard'); await p.locator('main h1').first().waitFor(); await sleep(1200);
await p.getByPlaceholder(/Add anything/).fill('Call mom tomorrow 6pm #family !high'); await sleep(400);
await p.screenshot({ path: path.join(OUT, '27-nebula-quick-capture.png') }); console.log('wrote 27-nebula-quick-capture.png');
await p.getByPlaceholder(/Add anything/).fill('');
await p.getByRole('button', { name: /^Breathe/ }).click(); await p.getByRole('button', { name: /Start · 1 minute/ }).click(); await sleep(2600);
await p.screenshot({ path: path.join(OUT, '28-nebula-breathe.png') }); console.log('wrote 28-nebula-breathe.png');
await p.keyboard.press('Escape'); await sleep(400);
await theme(p, 'Paper');
await shot(p, '#/close', '17-paper-close-the-day.png');
await shot(p, '#/seals', '18-paper-seals.png');
await shot(p, '#/dashboard', '19-paper-rituals-timeline.png', { scrollTo: 980 });
const state = await desk.storageState({ indexedDB: true });

// phone — same data, carried over with the storage state
const phone = await browser.newContext({ storageState: state, viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, colorScheme: 'light', isMobile: true, hasTouch: true });
const q = await phone.newPage();
await shot(q, '#/dashboard', '11-phone-paper-home.png');
await shot(q, '#/tasks', '12-phone-paper-tasks.png');
await theme(q, 'Nebula');
await shot(q, '#/dashboard', '29-phone-nebula-home.png');
await theme(q, 'Paper');

// a fresh visitor sees the cover page
const fresh = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5, colorScheme: 'light' });
const f = await fresh.newPage();
await f.goto(URL);
await f.getByRole('button', { name: /Set up my workspace/ }).waitFor();
await sleep(1200);
await f.screenshot({ path: path.join(OUT, '00-paper-welcome.png') });
console.log('wrote 00-paper-welcome.png');

await browser.close();
server.close();
