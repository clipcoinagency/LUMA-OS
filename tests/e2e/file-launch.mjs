// End-to-end: the BUILT product (dist/index.html) opened from file:// in installed browsers,
// driven through the real UI like a customer: onboarding → relaunch → customise → backup →
// delete everything → restore from onboarding → phone navigation. Captures screenshots.
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const url = pathToFileURL(path.join(ROOT, 'dist', 'index.html')).href;
const SHOTS = path.join(ROOT, 'tests', 'e2e', 'screenshots');
const channels = (process.argv.find((a) => a.startsWith('--only='))?.slice(7) ?? 'msedge,chrome').split(',');
await fs.mkdir(SHOTS, { recursive: true });

let failed = 0;
const check = (ok, name, detail = '') => { if (!ok) failed++; console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`); };
const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
const theme = (page) => page.evaluate(() => document.documentElement.dataset.theme);
const navLabels = (page) => page.locator('aside.sidebar nav a').allInnerTexts();

for (const channel of channels) {
  console.log(`\n▶ ${channel}`);
  const profile = path.join(os.tmpdir(), `lifeos-e2e-${channel}-${Date.now()}`);
  const errors = [];
  const launch = async (viewport = { width: 1280, height: 860 }) => {
    const ctx = await chromium.launchPersistentContext(profile, { channel, viewport, acceptDownloads: true, colorScheme: 'light' });
    const page = ctx.pages()[0];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(url);
    return { ctx, page };
  };
  const snap = channel === channels[0];

  // ---------------------------------------------------------------- launch 1: onboarding
  let { ctx, page } = await launch();
  await page.getByRole('heading', { name: /Your life\.\s*Your system\./ }).waitFor({ timeout: 15000 });
  check(true, 'First launch opens onboarding (Welcome)');
  if (snap) { await page.waitForTimeout(700); await shot(page, 'ob-1-welcome-soft'); }
  await page.getByRole('button', { name: /Set up my workspace/ }).click();

  await page.getByRole('heading', { name: 'What do you want to organize?' }).waitFor();
  await page.getByRole('checkbox', { name: /Finance/ }).click();
  await page.getByRole('checkbox', { name: /^Notes/ }).click();
  check((await page.getByRole('checkbox', { checked: true }).count()) === 5, 'Modules: Finance + Notes switched off (5 on)');
  if (snap) await shot(page, 'ob-2-modules');
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.getByRole('heading', { name: 'Pick your look' }).waitFor();
  await page.getByRole('radio', { name: /^Dark/ }).click();
  await page.waitForTimeout(450);
  check((await theme(page)) === 'dark', 'Theme preview applies live (Dark)');
  if (snap) await shot(page, 'ob-3-theme-dark');
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.getByRole('heading', { name: 'Make it yours' }).waitFor();
  check(!(await page.getByLabel('Currency for Finance').count()), 'Currency hidden when Finance is off');
  await page.getByLabel('What should we call you?').fill('Alex');
  if (snap) await shot(page, 'ob-4-about');
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.getByRole('heading', { name: 'Design your dashboard' }).waitFor();
  await page.getByRole('radio', { name: /^Focus/ }).click();
  await page.getByRole('button', { name: 'Move Habits up' }).click();
  await page.getByRole('button', { name: 'Move Habits up' }).click();
  check((await page.locator('ul[aria-label="Module order"] .lbl').first().innerText()) === 'Habits', 'Module reordered (Habits first)');
  if (snap) await shot(page, 'ob-5-dashboard');
  await page.getByRole('button', { name: 'Create workspace' }).click();

  await page.getByRole('heading', { name: /Ready when you are, Alex/ }).waitFor();
  if (snap) { await page.waitForTimeout(1200); await shot(page, 'ob-6-done'); }
  await page.getByRole('button', { name: /Open my workspace/ }).click();
  await page.getByRole('heading', { name: /, Alex$/ }).waitFor();
  check(true, 'Dashboard greets by name');
  let nav = await navLabels(page);
  check(nav[1]?.trim() === 'Habits' && !nav.join().includes('Finance') && !nav.join().includes('Notes'), 'Navigation follows chosen modules + order', nav.map((s) => s.trim()).join(' | '));
  check(!(await page.getByRole('heading', { name: 'This month' }).count()), 'No Finance widget when Finance is off');
  if (snap) await shot(page, 'app-dashboard-dark');
  await ctx.close();

  // ---------------------------------------------------------------- launch 2: everything persisted
  ({ ctx, page } = await launch());
  await page.getByRole('heading', { name: /, Alex$/ }).waitFor({ timeout: 15000 });
  check((await theme(page)) === 'dark', 'Relaunch: onboarding skipped, theme + name kept');
  nav = await navLabels(page);
  check(nav[1]?.trim() === 'Habits', 'Relaunch: module order kept');
  check(await page.locator('.dash.focus').count() === 1, 'Relaunch: Focus layout kept');

  // settings: turn Finance on → widget + nav appear; Habits off → gone
  await page.locator('aside.sidebar').getByRole('link', { name: 'Settings' }).click();
  await page.getByRole('heading', { name: 'Settings', level: 1 }).waitFor();
  await page.getByRole('checkbox', { name: /Finance/ }).click();
  await page.getByRole('checkbox', { name: /^Habits/ }).click();
  await page.waitForFunction(() => {
    const labels = [...document.querySelectorAll('aside.sidebar nav a')].map((a) => a.textContent ?? '').join();
    return labels.includes('Finance') && !labels.includes('Habits');
  }, null, { timeout: 3000 }).catch(() => {});
  nav = await navLabels(page);
  check(nav.join().includes('Finance') && !nav.join().includes('Habits'), 'Settings: enabling/disabling modules updates navigation', nav.map((s) => s.trim()).join(' | '));
  await page.getByRole('radio', { name: /^Soft/ }).click();
  await page.waitForTimeout(450);
  check((await theme(page)) === 'soft', 'Settings: theme switch');
  if (snap) await page.screenshot({ path: path.join(SHOTS, 'app-settings-soft.png'), fullPage: true });
  await page.locator('aside.sidebar').getByRole('link', { name: 'Dashboard' }).click();
  await page.getByRole('heading', { name: 'This month' }).waitFor();
  check(!(await page.getByRole('heading', { name: 'Habit check-in' }).count()), 'Dashboard adapts: Finance widget shown, Habits widget hidden');
  if (snap) await shot(page, 'app-dashboard-soft');

  // data: sample history → backup
  await page.goto(url.split('#')[0] + '#/dev/data');
  await page.getByRole('button', { name: /Add 90 days of sample data/ }).click();
  await page.getByText(/Added sample history/).waitFor();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Back up now' }).click()]);
  const backupPath = path.join(os.tmpdir(), `e2e-${channel}-${dl.suggestedFilename()}`);
  await dl.saveAs(backupPath);
  check(/^LifeOS-Backup-\d{4}-\d{2}-\d{2}\.json$/.test(dl.suggestedFilename()), 'Backup downloaded', dl.suggestedFilename());

  // invalid backup via Settings is rejected
  await page.goto(url.split('#')[0] + '#/settings');
  const junk = path.join(os.tmpdir(), 'not-a-backup.json');
  await fs.writeFile(junk, '{"hello":"world"}');
  const [fc1] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: /Restore from backup/ }).click()]);
  await fc1.setFiles(junk);
  await page.getByText(/isn't a Life OS backup\. Nothing was changed/).waitFor();
  check(true, 'Invalid backup rejected with friendly message');

  // delete everything (type DELETE) → back to onboarding
  await page.getByRole('button', { name: /Delete everything/ }).click();
  const del = page.getByRole('button', { name: 'Delete everything', exact: true });
  check(await del.isDisabled(), 'Delete-everything locked until "DELETE" typed');
  await page.getByLabel('Type "DELETE" to confirm').fill('delete');
  await del.click();
  await page.getByRole('heading', { name: /Your life\.\s*Your system\./ }).waitFor();
  check(true, 'Delete everything returns to first-time setup');

  // restore from the Welcome screen
  const [fc2] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: /I have a backup/ }).click()]);
  await fc2.setFiles(backupPath);
  await page.getByRole('heading', { name: 'Restore this backup?' }).waitFor();
  await page.getByRole('button', { name: /^Restore$|Replace my data/ }).click();
  await page.getByRole('heading', { name: /, Alex$/ }).waitFor();
  nav = await navLabels(page);
  check(nav.join().includes('Finance') && (await theme(page)) === 'soft', 'Restore from Welcome brings back workspace, theme and modules');
  await ctx.close();

  // ---------------------------------------------------------------- launch 3: phone
  ({ ctx, page } = await launch({ width: 390, height: 844 }));
  await page.getByRole('heading', { name: /, Alex$/ }).waitFor({ timeout: 15000 });
  const bottom = page.locator('nav.bottom');
  check(await bottom.isVisible() && !(await page.locator('aside.sidebar').isVisible()), 'Phone: bottom navigation instead of sidebar');
  const items = await bottom.locator('a, button').allInnerTexts();
  check(items.length === 5 && items[0]?.includes('Home') && items.at(-1)?.includes('More'), 'Phone: Home + 3 modules + More', items.map((s) => s.trim()).join(' | '));
  check(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), 'Phone: no horizontal scrolling');
  if (snap) await shot(page, 'phone-dashboard-soft');
  await bottom.getByRole('button', { name: 'More' }).click();
  await page.getByRole('heading', { name: 'More' }).waitFor();
  if (snap) { await page.waitForTimeout(400); await shot(page, 'phone-more-sheet'); }
  await page.locator('dialog[open]').getByRole('link', { name: 'Settings' }).click();
  await page.getByRole('heading', { name: 'Settings', level: 1 }).waitFor();
  check(true, 'Phone: More sheet → Settings');
  await ctx.close();
  check(errors.length === 0, 'No console/page errors', errors.slice(0, 3).join(' | '));
}
console.log(`\n${failed ? `${failed} FAILED` : 'All passed'}. Screenshots: tests/e2e/screenshots/`);
process.exit(failed ? 1 : 0);
