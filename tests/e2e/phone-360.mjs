// Phase 7 e2e: a 360px-width overflow sweep (narrower than the 390px other suites already cover)
// focused on the two newer surfaces that have never been checked at phone width with real,
// populated content: the Calendar's day-history panel (Phase 5) and the backup-reminder banner
// (Phase 6) — both built after modules.mjs's own 360px pass was written, and both render
// meaningfully more content when there's actual history/overdue state to show, not just an empty
// shell.
import { chromium } from 'playwright';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const url = pathToFileURL(path.join(ROOT, 'dist', 'index.html')).href;
const base = url.split('#')[0];
const channel = process.argv.find((a) => a.startsWith('--only='))?.slice(7) ?? 'msedge';

let failed = 0;
const check = (ok, name, detail = '') => { if (!ok) failed++; console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`); };
const soft = async (name, fn) => { try { await fn(); } catch (e) { check(false, name, e.message.split('\n')[0]); } };
const profile = path.join(os.tmpdir(), `lifeos-phone360-${channel}-${Date.now()}`);
const errors = [];

async function launch(viewport) {
  const ctx = await chromium.launchPersistentContext(profile, { channel, viewport, colorScheme: 'light', locale: 'en-US' });
  const page = ctx.pages()[0];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url);
  return { ctx, page };
}
const go = async (page, hash, ready = (p) => p.locator('main h1').first().waitFor()) => { await page.goto(`${base}#/${hash}`); await page.reload(); await ready(page); };
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
const dayPanel = (page) => page.locator('section.day');
const reminder = (page) => page.locator('.reminder');

async function setMeta(page, key, value) {
  await page.evaluate(({ key, value }) => new Promise((resolve, reject) => {
    const req = indexedDB.open('lifeos');
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction('meta', 'readwrite');
      tx.objectStore('meta').put({ key, value });
      tx.oncomplete = () => resolve(undefined);
      tx.onerror = () => reject(tx.error);
    };
    req.onerror = () => reject(req.error);
  }), { key, value });
}
const daysAgoIso = (n) => new Date(Date.now() - n * 86_400_000).toISOString();

console.log(`▶ ${channel}`);

// ---- seed data + force the backup reminder overdue, at desktop width, on a persistent profile
// (so the same on-disk IndexedDB is still there once we relaunch at 360px below)
let { ctx, page } = await launch({ width: 1360, height: 900 });
await page.getByRole('button', { name: /Set up my workspace/ }).click();
for (let i = 0; i < 5; i++) await page.getByRole('button', { name: /^(Continue|Create workspace)$/ }).click();
await page.getByRole('button', { name: /Open my workspace/ }).click();
await page.getByRole('heading', { level: 1, name: /^Good/ }).waitFor();
await go(page, 'dev/data', (p) => p.getByRole('button', { name: /Add 90 days of sample data/ }).waitFor());
await page.getByRole('button', { name: /Add 90 days of sample data/ }).click();
await page.getByText(/Added sample history/).waitFor();
await setMeta(page, 'installedAt', daysAgoIso(20));
await ctx.close();

// ---- relaunch the same profile at 360px
({ ctx, page } = await launch({ width: 360, height: 780 }));
await page.getByRole('heading', { level: 1, name: /^Good/ }).waitFor({ timeout: 15000 });

await soft('Backup reminder banner at 360px', async () => {
  await go(page, 'dashboard');
  await page.waitForTimeout(400);
  check(await reminder(page).isVisible(), 'Backdated install date shows the overdue banner');
  check(await noOverflow(page), '360px: no horizontal scrolling with the banner showing');
  const notNow = reminder(page).getByRole('button', { name: 'Not now' });
  const backUp = reminder(page).getByRole('button', { name: 'Back up now' });
  check(await notNow.isVisible() && await backUp.isVisible(), 'Banner\'s actions ("Not now", "Back up now") are still visible, not clipped');
  const box = await backUp.boundingBox();
  check(!!box && box.x >= 0 && box.x + box.width <= 360 + 1, 'Banner action button stays within the 360px viewport', JSON.stringify(box));
});

await soft('Calendar day-history panel at 360px, with real populated content', async () => {
  await go(page, 'calendar');
  check(await noOverflow(page), '360px: no horizontal scrolling on Calendar\'s default (empty) day view');
  // sample data always posts a transaction on the 1st, 3rd and 5th of the month somewhere in range
  let found = false;
  for (let i = 0; i < 35 && !found; i++) {
    const rows = dayPanel(page).locator('.txrow');
    if (await rows.count()) { found = true; break; }
    await page.getByRole('button', { name: 'Previous day' }).click();
    await page.waitForTimeout(120);
  }
  check(found, 'Found a day with real history content (transactions) within scan range');
  if (found) {
    check(await noOverflow(page), '360px: no horizontal scrolling with a populated history day open');
    const panelBox = await dayPanel(page).boundingBox();
    check(!!panelBox && panelBox.x + panelBox.width <= 360 + 1, 'Day-history panel itself stays within the 360px viewport', JSON.stringify(panelBox));
    // the panel's own content (transaction rows, task checklist, mood row) must not force overflow
    const widestChild = await dayPanel(page).evaluate((el) => Math.max(0, ...[...el.querySelectorAll('*')].map((c) => c.getBoundingClientRect().right)));
    check(widestChild <= 360 + 1, 'No element inside the history panel extends past the 360px viewport', String(widestChild));
  }
});

await ctx.close();
check(errors.length === 0, 'No console/page errors', [...new Set(errors)].slice(0, 4).join(' | '));
console.log(`\n${failed ? `${failed} FAILED` : 'All passed'}.`);
process.exit(failed ? 1 : 0);
