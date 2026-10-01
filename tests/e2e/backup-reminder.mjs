// Phase 6 e2e: the backup reminder banner, on the BUILT file from file://.
// A fresh workspace never nags immediately; backdating the install date makes it overdue; the
// banner offers a real backup (real download) or a snooze; disabling the setting hides it.
import { chromium } from 'playwright';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const url = pathToFileURL(path.join(ROOT, 'dist', 'index.html')).href;
const channel = process.argv.find((a) => a.startsWith('--only='))?.slice(7) ?? 'msedge';

let failed = 0;
const check = (ok, name, detail = '') => { if (!ok) failed++; console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`); };
const profile = path.join(os.tmpdir(), `lifeos-reminder-${channel}-${Date.now()}`);
const errors = [];

async function launch() {
  const ctx = await chromium.launchPersistentContext(profile, { channel, viewport: { width: 1200, height: 900 }, acceptDownloads: true });
  const page = ctx.pages()[0];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url);
  return { ctx, page };
}
const reminder = (page) => page.locator('.reminder');

// Directly rewrites a meta row's value in IndexedDB — the only way to simulate "N days ago"
// without actually waiting days, or reaching into the app's private module state.
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
let { ctx, page } = await launch();
await page.getByRole('button', { name: /Set up my workspace/ }).click();
for (let i = 0; i < 5; i++) await page.getByRole('button', { name: /^(Continue|Create workspace)$/ }).click();
await page.getByRole('button', { name: /Open my workspace/ }).click();
await page.getByRole('heading', { level: 1, name: /^Good/ }).waitFor();

await page.goto(url.split('#')[0] + '#/dev/data');
await page.reload();
await page.getByRole('button', { name: /Add 90 days of sample data/ }).click();
await page.getByText(/Added sample history/).waitFor();

// a fresh install (installedAt ~= now) with real data must not nag immediately
await page.goto(url.split('#')[0] + '#/dashboard');
await page.reload();
await page.getByRole('heading', { level: 1, name: /^Good/ }).waitFor();
await page.waitForTimeout(300);
check(!(await reminder(page).count()), 'A brand-new workspace does not show the backup reminder immediately');

// backdate the install date past the default 14-day interval, then re-check on a fresh boot
await setMeta(page, 'installedAt', daysAgoIso(20));
await page.reload();
await page.getByRole('heading', { level: 1, name: /^Good/ }).waitFor();
await page.waitForTimeout(400);
check(await reminder(page).isVisible(), 'Backing installedAt 20 days back (default 14-day interval) makes the reminder show');

// "Not now" snoozes it — the banner disappears immediately and stays gone across a reload
await reminder(page).getByRole('button', { name: 'Not now' }).click();
await page.waitForTimeout(300);
check(!(await reminder(page).count()), 'Dismissing hides the banner immediately');
await page.reload();
await page.getByRole('heading', { level: 1, name: /^Good/ }).waitFor();
await page.waitForTimeout(400);
check(!(await reminder(page).count()), 'The snooze persists across a reload (does not immediately re-nag)');

// force it due again, then use "Back up now" — a real download, and the banner clears
await setMeta(page, 'backupReminderSnoozedAt', daysAgoIso(20));
await page.reload();
await page.getByRole('heading', { level: 1, name: /^Good/ }).waitFor();
await page.waitForTimeout(400);
check(await reminder(page).isVisible(), 'Once the snooze itself expires, the reminder returns');

// regression guard: the fixed-position desktop sidebar must not be covered by the banner, and
// must still stay pinned to the viewport while the page scrolls (not just "not overlapping").
{
  const bannerBox = await reminder(page).boundingBox();
  const sidebarBefore = await page.locator('.sidebar').boundingBox();
  check(!!bannerBox && !!sidebarBefore && sidebarBefore.y >= bannerBox.y + bannerBox.height - 1, 'Sidebar starts at or below the banner, no overlap', JSON.stringify({ bannerBox, sidebarBefore }));
  await page.mouse.wheel(0, 800);
  await page.waitForTimeout(300);
  const sidebarAfter = await page.locator('.sidebar').boundingBox();
  check(!!sidebarAfter && !!sidebarBefore && Math.abs(sidebarAfter.y - sidebarBefore.y) < 2, 'Sidebar stays pinned to the viewport while the page scrolls (does not scroll away)', JSON.stringify(sidebarAfter));
  await page.mouse.wheel(0, -800);
}
const [dl] = await Promise.all([page.waitForEvent('download'), reminder(page).getByRole('button', { name: 'Back up now' }).click()]);
check(/^LifeOS-Backup-\d{4}-\d{2}-\d{2}\.json$/.test(dl.suggestedFilename()), 'Back up now from the banner triggers a real, correctly-named download', dl.suggestedFilename());
await page.waitForTimeout(300);
check(!(await reminder(page).count()), 'A successful backup clears the reminder immediately');
await page.reload();
await page.getByRole('heading', { level: 1, name: /^Good/ }).waitFor();
await page.waitForTimeout(400);
check(!(await reminder(page).count()), 'The cleared reminder stays gone after a reload (lastBackupAt now recent)');

// Settings: "Never remind me" hides it even when it would otherwise be overdue
await setMeta(page, 'lastBackupAt', daysAgoIso(999));
await page.goto(url.split('#')[0] + '#/settings');
await page.reload();
await page.getByRole('heading', { name: 'Settings', level: 1 }).waitFor();
await page.getByLabel('Backup reminder').selectOption('0');
await page.waitForFunction(() => !document.querySelector('.reminder'), null, { timeout: 3000 }).catch(() => {});
check(!(await reminder(page).count()), '"Never remind me" hides an otherwise-overdue reminder immediately');
await page.getByLabel('Backup reminder').selectOption('14');
await reminder(page).waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
check(await reminder(page).isVisible(), 'Turning the reminder back on re-shows it (already overdue)');

await ctx.close();
check(errors.length === 0, 'No console/page errors', [...new Set(errors)].slice(0, 4).join(' | '));
console.log(`\n${failed ? `${failed} FAILED` : 'All passed'}.`);
process.exit(failed ? 1 : 0);
