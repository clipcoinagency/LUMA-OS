// End-to-end test of the BUILT product (dist/index.html) opened from file:// in installed browsers,
// through the real UI: boot → theme persists across relaunch → sample data → backup download →
// guarded reset → restore via file picker → undo. Also captures screenshots of both themes.
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
const recordsText = async (page) => (await page.locator('.counts').innerText()).replace(/\s+/g, ' ');
const total = async (page) => Number((await page.getByText(/\d+ records$/).first().innerText()).replace(/\D/g, ''));

for (const channel of channels) {
  console.log(`\n▶ ${channel}`);
  const profile = path.join(os.tmpdir(), `lifeos-e2e-${channel}-${Date.now()}`);
  const errors = [];
  const launch = async (viewport = { width: 1280, height: 860 }) => {
    const ctx = await chromium.launchPersistentContext(profile, { channel, viewport, acceptDownloads: true });
    const page = ctx.pages()[0];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(url);
    await page.getByRole('heading', { name: /Design system/ }).waitFor({ timeout: 15000 });
    return { ctx, page };
  };

  // launch 1: first run, switch theme
  let { ctx, page } = await launch();
  const theme1 = await page.evaluate(() => document.documentElement.dataset.theme);
  await page.getByRole('button', { name: /Switch to (Dark|Soft) theme/ }).click();
  await page.waitForTimeout(450);
  const theme2 = await page.evaluate(() => document.documentElement.dataset.theme);
  check(theme1 !== theme2, 'Theme switches', `${theme1} → ${theme2}`);
  await ctx.close();

  // launch 2: theme persisted
  ({ ctx, page } = await launch());
  const theme3 = await page.evaluate(() => document.documentElement.dataset.theme);
  check(theme3 === theme2, 'Theme choice survives full browser restart', theme3);
  check(/launch #2/.test(await page.locator('.brand .meta').innerText()), 'Launch counter = 2');

  // screenshots of the design system in both themes (desktop)
  for (const t of ['soft', 'dark']) {
    if ((await page.evaluate(() => document.documentElement.dataset.theme)) !== t) {
      await page.getByRole('button', { name: /Switch to (Dark|Soft) theme/ }).click();
      await page.waitForTimeout(500);
    }
    await page.screenshot({ path: path.join(SHOTS, `desktop-design-${t}.png`), fullPage: true });
  }

  // data lab: sample data → backup
  await page.getByRole('radio', { name: 'Data & backup' }).click();
  await page.getByRole('button', { name: /Add 90 days of sample data/ }).click();
  await page.getByText(/Added sample history/).waitFor();
  const seeded = await total(page);
  check(seeded > 500, 'Sample history written', `${seeded} records`);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Back up now' }).click()]);
  const backupPath = path.join(os.tmpdir(), `e2e-${channel}-${dl.suggestedFilename()}`);
  await dl.saveAs(backupPath);
  check(/^LifeOS-Backup-\d{4}-\d{2}-\d{2}\.json$/.test(dl.suggestedFilename()), 'Backup downloads with dated name', dl.suggestedFilename());
  await page.getByText(/Last backup:/).waitFor();
  check(true, 'UI shows last backup time');
  await page.screenshot({ path: path.join(SHOTS, `desktop-data-${channel}.png`), fullPage: true });

  // reset requires typing DELETE
  await page.getByRole('button', { name: /Delete all data/ }).click();
  const del = page.getByRole('button', { name: 'Delete everything' });
  check(await del.isDisabled(), 'Delete is disabled until "DELETE" is typed');
  await page.getByLabel('Type "DELETE" to confirm').fill('DELETE');
  await del.click();
  await page.getByText(/Workspace cleared/).waitFor();
  check((await total(page)) === 0, 'Reset clears all records');

  // restore via file picker, with preview + confirm
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: /Restore from a backup file/ }).click()]);
  await chooser.setFiles(backupPath);
  await page.getByRole('heading', { name: 'Restore this backup?' }).waitFor();
  const preview = (await page.locator('dialog[open]').innerText()).replace(/\s+/g, ' ');
  check(/replace/i.test(preview) && new RegExp(`${seeded} records`).test(preview), 'Restore preview shows counts + replace warning');
  await page.getByRole('button', { name: 'Replace my data' }).click();
  const outcome = page.getByText(/Backup restored|Restore didn't complete/);
  await outcome.first().waitFor();
  check((await outcome.first().innerText()).includes('Backup restored'), 'Restore reports success', await outcome.first().innerText());
  await page.getByRole('radio', { name: 'Data & backup' }).click();
  await page.waitForTimeout(300);
  check((await total(page)) === seeded, 'Restore brings every record back', `${await total(page)}`);

  // invalid file is rejected without changes
  const junk = path.join(os.tmpdir(), 'not-a-backup.json');
  await fs.writeFile(junk, '{"hello":"world"}');
  const [chooser2] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: /Restore from a backup file/ }).click()]);
  await chooser2.setFiles(junk);
  await page.getByText(/isn't a Life OS backup/).waitFor();
  check((await total(page)) === seeded, 'Invalid file rejected, data unchanged');
  await ctx.close();

  // launch 3: restored data persisted; phone layout screenshots
  ({ ctx, page } = await launch({ width: 390, height: 844 }));
  await page.getByRole('radio', { name: 'Data & backup' }).click();
  await page.waitForTimeout(300);
  check((await total(page)) === seeded, 'Restored data survives restart', await recordsText(page).then((t) => t.slice(0, 60) + '…'));
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check(!overflow, 'No horizontal scrolling at 390px width');
  for (const t of ['soft', 'dark']) {
    if ((await page.evaluate(() => document.documentElement.dataset.theme)) !== t) {
      await page.getByRole('button', { name: /Switch to (Dark|Soft) theme/ }).click();
      await page.waitForTimeout(500);
    }
    await page.getByRole('radio', { name: 'Design system' }).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(SHOTS, `phone-design-${t}.png`), fullPage: false });
  }
  await ctx.close();
  check(errors.length === 0, 'No console/page errors', errors.slice(0, 3).join(' | '));
}
console.log(`\n${failed ? `${failed} FAILED` : 'All passed'}. Screenshots: tests/e2e/screenshots/`);
process.exit(failed ? 1 : 0);
