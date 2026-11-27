// Takes the real-app screenshots used in the Etsy listing images and the START HERE guide.
//   node scripts/promo/store-shots.mjs [--out=<dir>]
// A fresh demo profile with every area switched on is seeded, then desktop (1440x1000 @2x) and phone
// (390x844 @3x) screenshots are taken in all three themes. Nothing here touches your own data.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const OUT = arg('out', path.join(ROOT, 'etsy-delivery-v2', 'images', 'raw'));
const PROFILE = path.join(os.tmpdir(), 'lifeos-store-profile');
const PORT = 47833, BASE = `http://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dayKey = (o) => { const d = new Date(); d.setDate(d.getDate() - o); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

const html = fs.readFileSync(path.join(ROOT, 'dist', 'index.html'));
const srv = http.createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(html); });
await new Promise((r) => srv.listen(PORT, '127.0.0.1', r));
await fsp.mkdir(OUT, { recursive: true });
if (arg('only', 'all') === 'all') await fsp.rm(PROFILE, { recursive: true, force: true });

// ---------------------------------------------------------------- seed
async function seed() {
  const ctx = await chromium.launchPersistentContext(PROFILE, { channel: 'msedge', viewport: { width: 1280, height: 900 }, locale: 'en-US', colorScheme: 'dark' });
  const page = ctx.pages()[0];
  const dlg = () => page.locator('dialog[open]').last();
  const closed = () => page.waitForFunction(() => !document.querySelector('dialog[open]'), null, { timeout: 8000 });
  const next = (n = 'Continue') => page.getByRole('button', { name: n, exact: true });
  await page.goto(BASE + '/');
  await page.getByRole('button', { name: /Set up my workspace/ }).click();
  await page.getByRole('radio', { name: /Organise my life/ }).click();
  await next().click();
  for (const m of ['Study & Read', 'Work']) {
    const cb = page.getByRole('checkbox', { name: new RegExp('^' + m.replace('&', '&')) });
    if ((await cb.getAttribute('aria-checked')) !== 'true') await cb.click();
  }
  await next().click();
  await page.getByRole('radio', { name: /^Dark/ }).click();
  await next().click();
  await page.getByLabel('What should we call you?').fill('Alex');
  await next().click();
  await next('Create workspace').click();
  await page.getByRole('button', { name: /Open my workspace/ }).click();
  await page.getByRole('heading', { level: 1, name: /, Alex$/ }).waitFor();

  await page.goto(BASE + '/#/dev/data');
  await page.getByRole('button', { name: /Add 90 days of sample data/ }).click();
  await page.getByText(/Added sample history/).waitFor();
  await page.goto(BASE + '/#/dashboard'); await page.reload();
  const tasks = page.getByRole('region', { name: /Today.s tasks/ });
  await tasks.waitFor();
  for (let i = 0; i < 12; i++) { const c = tasks.getByRole('checkbox'); if (!(await c.count())) break; await c.first().click(); await sleep(220); }
  await page.getByPlaceholder(/Add a task for today/).fill('Write the launch plan'); await page.keyboard.press('Enter'); await sleep(300);
  await page.getByPlaceholder(/Add a task for today/).fill('Review budget'); await page.keyboard.press('Enter'); await sleep(300);

  // a Work project and a Study subject
  await page.goto(BASE + '/#/work'); await page.reload();
  await page.getByRole('button', { name: 'New project' }).first().click();
  await page.getByLabel('Project', { exact: true }).fill('Website relaunch');
  await page.getByRole('button', { name: 'Create project' }).click(); await closed();
  await page.goto(BASE + '/#/study'); await page.reload();
  await page.getByRole('radio', { name: 'Subjects' }).click();
  await page.getByRole('button', { name: 'New subject' }).first().click();
  await page.getByLabel('Subject', { exact: true }).fill('Biology');
  await page.getByRole('button', { name: 'Create subject' }).click(); await closed();

  // library + deck
  await page.getByRole('radio', { name: 'Library' }).click();
  async function addBook(title, author, total, status, color) {
    await page.getByRole('button', { name: /Add (your first )?book/ }).first().click();
    await dlg().getByLabel('Title').fill(title); await dlg().getByLabel('Author (optional)').fill(author); await dlg().getByLabel('Total pages').fill(String(total));
    await dlg().getByRole('radio', { name: status, exact: true }).click(); await dlg().getByRole('radio', { name: color }).click();
    await dlg().getByRole('button', { name: 'Add', exact: true }).click(); await closed();
  }
  await addBook('Atomic Habits', 'James Clear', 320, 'Reading', '#7a5cf0');
  await addBook('Deep Work', 'Cal Newport', 296, 'Reading', '#3b82c4');
  await addBook('Meditations', 'Marcus Aurelius', 254, 'Finished', '#c2653a');
  await addBook('The Pragmatic Programmer', 'Hunt & Thomas', 352, 'Want to read', '#1f9d8a');
  await addBook('Thinking, Fast and Slow', 'Daniel Kahneman', 499, 'Want to read', '#b8486f');
  await page.getByRole('radio', { name: /^All/ }).click();
  for (const [title, p] of [['Atomic Habits', 136], ['Deep Work', 204]]) {
    await page.getByRole('button', { name: new RegExp('^' + title) }).click();
    await dlg().getByLabel('I am on page').fill(String(p)); await dlg().getByRole('button', { name: 'Set', exact: true }).click();
    await dlg().getByText(new RegExp('^' + p + ' / ')).waitFor(); await page.keyboard.press('Escape'); await closed();
  }
  await page.getByRole('radio', { name: 'Flashcards' }).click();
  await page.getByRole('button', { name: /(New deck|Create your first deck)/ }).first().click();
  await dlg().getByLabel('Deck name').fill('Spanish basics'); await dlg().getByRole('button', { name: 'Create deck' }).click(); await closed();
  await page.getByRole('button', { name: /^Open deck Spanish basics/ }).click();
  await page.getByRole('button', { name: 'Paste a list' }).click();
  await dlg().getByLabel('Cards').fill(['hello :: hola', 'thank you :: gracias', 'goodbye :: adiós', 'please :: por favor', 'good morning :: buenos días', 'see you soon :: hasta pronto', 'water :: agua', 'friend :: amigo'].join('\n'));
  await dlg().getByRole('button', { name: /^Add 8 cards/ }).click(); await closed();

  await page.goto(BASE + '/#/dashboard'); await page.reload(); await page.locator('main h1').first().waitFor();
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
}

// ---------------------------------------------------------------- shots
const THEME = (page, t) => page.evaluate((t) => { const r = document.documentElement; r.dataset.theme = t; }, t);
async function session(view, fn) {
  const phone = view === 'phone';
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    channel: 'msedge', viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, deviceScaleFactor: phone ? 3 : 2,
    isMobile: phone, hasTouch: phone, locale: 'en-US', colorScheme: 'dark',
  });
  const page = ctx.pages()[0];
  const shot = async (name, theme = 'dark', { full = false } = {}) => { await THEME(page, theme); await sleep(500); await page.screenshot({ path: path.join(OUT, `${view}-${name}.png`), fullPage: full }); console.log('shot', `${view}-${name}`); };
  const go = async (hash, wait = 2200) => { await page.goto(BASE + '/#/' + hash); await page.reload(); await page.locator('main h1, .hero, .tabs').first().waitFor(); await sleep(wait); };
  await fn({ page, shot, go });
  await ctx.close();
}

const ONLY = arg('only', 'all');
if (ONLY === 'all') await seed();
if (ONLY !== 'phone') await session('desktop', async ({ page, shot, go }) => {
  await go('dashboard');
  await shot('home-dark', 'dark'); await shot('home-soft', 'soft'); await shot('home-light', 'light');
  await go('study'); await page.getByRole('radio', { name: 'Library' }).click(); await page.locator('.shelf').waitFor(); await sleep(1500);
  await shot('library-dark', 'dark'); await shot('library-light', 'light');
  await page.getByRole('radio', { name: 'Flashcards' }).click(); await page.locator('.decks').waitFor(); await sleep(1200);
  await shot('flashcards-dark', 'dark');
  await page.getByRole('button', { name: 'Review Spanish basics' }).click(); await sleep(600);
  await page.getByRole('button', { name: /Show answer/ }).click(); await sleep(1100);
  await shot('review-dark', 'dark'); await page.keyboard.press('Escape'); await sleep(400);
  await go('finance'); await shot('finance-dark', 'dark'); await shot('finance-soft', 'soft');
  await page.getByRole('button', { name: /^Currency:/ }).click(); await sleep(700); await shot('currency-dark', 'dark'); await page.keyboard.press('Escape'); await sleep(300);
  await go('insights'); await shot('insights-dark', 'dark');
  await go('calendar'); await shot('calendar-light', 'light');
  await go('tasks'); await page.getByRole('button', { name: 'Add task' }).first().click(); await sleep(500);
  await page.locator('dialog[open]').getByRole('radio', { name: 'Pick date' }).click(); await sleep(300);
  await page.locator('dialog[open]').getByRole('button', { name: 'Open calendar' }).click(); await sleep(800); await shot('datepicker-dark', 'dark');
  await go('dashboard', 1200);
  await page.getByRole('button', { name: /^Start$/ }).first().click({ timeout: 3000 }).catch(() => {});
  await sleep(600); await page.getByRole('radio', { name: /Write the launch plan/ }).click().catch(() => {});
  await page.getByRole('button', { name: /-minute focus/ }).click().catch(() => {}); await sleep(1500); await shot('focus-dark', 'dark');
});
await session('phone', async ({ page, shot, go }) => {
  // drop any focus session the desktop shots left running so the phone shots don't show its pill
  await page.goto(BASE + '/#/dashboard');
  await page.evaluate(() => new Promise((res) => { const r = indexedDB.open('lifeos'); r.onsuccess = () => { const db = r.result; const tx = db.transaction('meta', 'readwrite'); tx.objectStore('meta').delete('activeFocus'); tx.oncomplete = () => { db.close(); res(); }; }; }));
  await go('dashboard');
  await shot('home-dark', 'dark'); await shot('home-soft', 'soft'); await shot('home-light', 'light');
  await page.evaluate(() => { const el = document.querySelector('.pulse'); if (el) window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - 70, behavior: 'instant' }); }); await sleep(900);
  await shot('pulse-dark', 'dark'); await shot('pulse-light', 'light');
  await go('study'); await page.getByRole('radio', { name: 'Library' }).click(); await page.locator('.shelf').waitFor(); await sleep(1200);
  await shot('library-dark', 'dark');
  await page.getByRole('radio', { name: 'Flashcards' }).click(); await page.locator('.decks').waitFor(); await sleep(1000);
  await page.getByRole('button', { name: 'Review Spanish basics' }).click(); await sleep(600);
  await page.getByRole('button', { name: /Show answer/ }).click(); await sleep(1100); await shot('review-dark', 'dark');
});
srv.close();
console.log('done ->', OUT);
