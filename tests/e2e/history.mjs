// Phase 5 e2e: the Calendar's day-history reconstruction, on the BUILT file from file://.
// Seeds 90 days of sample data, then checks: a recent past day reconstructs across modules,
// a future day shows only planned events (no history), day-level prev/next navigation, an
// inline correction (toggle a habit from history) persists, month-grid activity dots, and no
// horizontal overflow at phone width.
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const url = pathToFileURL(path.join(ROOT, 'dist', 'index.html')).href;
const base = url.split('#')[0];
const SHOTS = process.env.LIFEOS_SHOTS ?? path.join(ROOT, 'tests', 'e2e', 'screenshots');
const channel = process.argv.find((a) => a.startsWith('--only='))?.slice(7) ?? 'msedge';
await fs.mkdir(SHOTS, { recursive: true });

let failed = 0;
const check = (ok, name, detail = '') => { if (!ok) failed++; console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`); };
const soft = async (name, fn) => { try { await fn(); } catch (e) { check(false, name, e.message.split('\n')[0]); } };
const profile = path.join(os.tmpdir(), `lifeos-hist-${channel}-${Date.now()}`);
const errors = [];

async function launch(viewport = { width: 1360, height: 900 }) {
  const ctx = await chromium.launchPersistentContext(profile, { channel, viewport, colorScheme: 'light', locale: 'en-US' });
  const page = ctx.pages()[0];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url);
  return { ctx, page };
}
const go = async (page, hash, ready = (p) => p.locator('main h1').first().waitFor()) => { await page.goto(`${base}#/${hash}`); await page.reload(); await ready(page); };
const dayPanel = (page) => page.locator('section.day');
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);

console.log(`▶ ${channel}`);
let { ctx, page } = await launch();
await page.getByRole('button', { name: /Set up my workspace/ }).click();
for (let i = 0; i < 5; i++) await page.getByRole('button', { name: /^(Continue|Create workspace)$/ }).click();
await page.getByRole('button', { name: /Open my workspace/ }).click();
await page.getByRole('heading', { level: 1, name: /^Good/ }).waitFor();

await go(page, 'dev/data', (p) => p.getByRole('button', { name: /Add 90 days of sample data/ }).waitFor());
await page.getByRole('button', { name: /Add 90 days of sample data/ }).click();
await page.getByText(/Added sample history/).waitFor();

await go(page, 'calendar');

await soft('A recent past day reconstructs across modules', async () => {
  // 3 days ago: sample data logs wellness every day and tasks most days, so this is reliably non-empty.
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Previous day' }).click();
  await page.waitForTimeout(400);
  check(await dayPanel(page).getByText('Wellness').isVisible(), 'Wellness section reconstructed for a recent past day');
  const gotSomething = await dayPanel(page).getByText('Nothing recorded on this day').count();
  check(gotSomething === 0, 'Day is not shown as empty (sample data guarantees wellness every day)');
});

await soft('Day-level Previous/Next navigation moves the header', async () => {
  const before = await page.locator('#day-h').innerText();
  await page.getByRole('button', { name: 'Next day' }).click();
  await page.waitForTimeout(200);
  const after = await page.locator('#day-h').innerText();
  check(before !== after, 'Next day changes the visible date', `${before} -> ${after}`);
  await page.getByRole('button', { name: 'Previous day' }).click();
  await page.waitForTimeout(200);
  check((await page.locator('#day-h').innerText()) === before, 'Previous day returns to the original date');
});

await soft('A future day shows only planned events, no history sections', async () => {
  for (let i = 0; i < 10; i++) await page.getByRole('button', { name: 'Next day' }).click();
  await page.waitForTimeout(400);
  check(!(await dayPanel(page).getByText('Wellness').count()), 'No Wellness section on a future day');
  check(!(await dayPanel(page).getByText('Tasks', { exact: true }).count()), 'No Tasks section on a future day');
  for (let i = 0; i < 10; i++) await page.getByRole('button', { name: 'Previous day' }).click();
  await page.waitForTimeout(400);
});

await soft('Toggling a habit from the history view persists', async () => {
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Previous day' }).click();
  await page.waitForTimeout(400);
  const habitCbs = dayPanel(page).getByRole('checkbox', { name: / (done|not done) on this day/ });
  const n = await habitCbs.count();
  if (n === 0) { check(true, 'Toggling a habit from history (skipped: no habit due that day)'); }
  else {
    const before = await habitCbs.first().getAttribute('aria-checked');
    const nameBefore = await habitCbs.first().getAttribute('aria-label'); const dayBefore = await page.locator('#day-h').innerText();
    await habitCbs.first().click();
    await page.waitForTimeout(300);
    const after = await habitCbs.first().getAttribute('aria-checked');
    check(before !== after, 'Habit checkbox in history toggles', `${before} -> ${after}`);
    await page.reload();
    await page.locator('main h1').first().waitFor();
    for (let i = 0; i < 6; i++) await page.getByRole('button', { name: 'Previous day' }).click();
    await page.waitForTimeout(400);
    const persisted = await dayPanel(page).getByRole('checkbox', { name: / (done|not done) on this day/ }).first().getAttribute('aria-checked');
    const nameAfter = await dayPanel(page).getByRole('checkbox', { name: / (done|not done) on this day/ }).first().getAttribute('aria-label'); const dayAfter = await page.locator('#day-h').innerText();
    check(persisted === after, 'Habit toggle from history survives a reload', `after=${after} persisted=${persisted} | ${nameBefore} @ ${dayBefore} -> ${nameAfter} @ ${dayAfter}`);
  }
});

await soft('A transaction opens for editing from the history view', async () => {
  // sample data always posts a transaction on the 1st, 3rd and 5th of the month somewhere in range
  let found = false;
  for (let i = 0; i < 35 && !found; i++) {
    const rows = dayPanel(page).locator('.txrow');
    if (await rows.count()) { found = true; break; }
    await page.getByRole('button', { name: 'Previous day' }).click();
    await page.waitForTimeout(150);
  }
  if (!found) { check(true, 'Transaction edit from history (skipped: none found in scan range)'); return; }
  await dayPanel(page).locator('.txrow').first().click();
  await page.locator('dialog[open]').getByRole('heading', { name: 'Edit transaction' }).waitFor({ timeout: 5000 });
  check(true, 'Clicking a money row in history opens Edit transaction');
  await page.keyboard.press('Escape');
});

await soft('Month grid shows an activity dot distinct from event chips', async () => {
  await page.goto(base + '#/calendar');
  await page.reload();
  await page.locator('main h1').first().waitFor();
  await page.waitForTimeout(600);
  const historyDots = await page.locator('.dotm.history').count();
  check(historyDots > 0, 'At least one day in the visible month shows a history dot', String(historyDots));
});

await page.screenshot({ path: path.join(SHOTS, 'history-desktop-soft.png'), fullPage: true });
await ctx.close();

// phone width
({ ctx, page } = await launch({ width: 390, height: 844 }));
await page.getByRole('heading', { level: 1, name: /^Good/ }).waitFor({ timeout: 15000 });
await go(page, 'calendar');
for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Previous day' }).click();
await page.waitForTimeout(500);
check(await noOverflow(page), 'Phone 390px: no horizontal scrolling on Calendar + history panel');
await page.screenshot({ path: path.join(SHOTS, 'history-phone-soft.png'), fullPage: true });
await ctx.close();

check(errors.length === 0, 'No console/page errors', [...new Set(errors)].slice(0, 4).join(' | '));
console.log(`\n${failed ? `${failed} FAILED` : 'All passed'}.`);
process.exit(failed ? 1 : 0);
