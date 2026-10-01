// Task reminders e2e: a task with a due time in the near past + "Remind me" enabled must pop up
// a ReminderAlert (with a chime — checked indirectly via "no console errors", since Playwright
// can't assert on actual audio output) within a few seconds, offer Mark done / Snooze / Dismiss,
// and never re-fire once handled. Runs on the BUILT file from file://, real installed browser.
import { chromium } from 'playwright';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const url = pathToFileURL(path.join(ROOT, 'dist', 'index.html')).href;
const base = url.split('#')[0];
const channel = process.argv.find((a) => a.startsWith('--only='))?.slice(7) ?? 'msedge';

let failed = 0;
const check = (ok, name, detail = '') => { if (!ok) failed++; console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`); };
const errors = [];

const dlg = (page) => page.locator('dialog[open]').last();
const closed = (page) => page.waitForFunction(() => !document.querySelector('dialog[open]'), null, { timeout: 5000 });
const go = async (page, hash) => { await page.goto(`${base}#/${hash}`); await page.reload(); await page.locator('main h1').first().waitFor(); };

// A few minutes in the past, so the reminder is immediately due the moment the task is saved.
function pastTimeHM(minutesAgo) {
  const d = new Date(Date.now() - minutesAgo * 60_000);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

async function addReminderTask(page, title, minutesAgo = 2) {
  await page.getByRole('button', { name: 'Add task' }).first().click();
  await dlg(page).getByLabel('Task', { exact: true }).fill(title);
  await dlg(page).getByLabel('Time (optional)').fill(pastTimeHM(minutesAgo));
  await dlg(page).getByRole('switch', { name: 'Remind me' }).click();
  await dlg(page).getByRole('button', { name: 'Add task' }).click();
  // the reminder popup can open in the same frame the form closes, so wait for the form specifically
  await page.locator('dialog[open]').filter({ has: page.getByLabel('Time (optional)') }).waitFor({ state: 'hidden' });
  await page.locator('main').getByText(title).first().waitFor();
}

// The reminders engine's fast-path polls every 2s when changes.version has moved (creating the
// task bumps it), so the popup should appear well within this window — no need to wait a full 20s.
const reminderModal = (page) => page.getByRole('dialog', { name: 'Reminder' });

console.log(`▶ ${channel}`);
const browser = await chromium.launch({ channel });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(url);
await page.getByRole('button', { name: /Set up my workspace/ }).click();
for (let i = 0; i < 5; i++) await page.getByRole('button', { name: /^(Continue|Create workspace)$/ }).click();
await page.getByRole('button', { name: /Open my workspace/ }).click();
await page.getByRole('heading', { level: 1, name: /^Good/ }).waitFor();
await go(page, 'tasks');

// --- Time badge + bell icon shown on the list for a task with a reminder ---
await addReminderTask(page, 'Call the dentist');
await reminderModal(page).waitFor({ timeout: 8000 }); // let the just-created reminder fire first, so it doesn't interfere below
check(true, 'Reminder popped up for a task due in the past');
await page.getByRole('button', { name: 'Dismiss' }).click();
await closed(page);
const badge = page.locator('li', { hasText: 'Call the dentist' }).locator('.time');
check(await badge.isVisible(), 'Task list shows a time badge for the task with a reminder');
check((await badge.locator('svg').count()) > 0, 'Time badge shows a bell icon since the reminder is on');

// --- Mark done from the popup ---
await addReminderTask(page, 'Pay the water bill');
await reminderModal(page).waitFor({ timeout: 8000 });
check(await reminderModal(page).getByText('Pay the water bill').isVisible(), 'Reminder popup shows the task title');
await page.getByRole('button', { name: 'Mark done' }).click();
await closed(page);
check(!(await reminderModal(page).count()), 'Popup closes after "Mark done"');
await page.getByRole('checkbox', { name: /Mark not done: Pay the water bill/ }).waitFor({ timeout: 3000 });
check(true, 'Task is shown as done after "Mark done" from the reminder popup');

// --- Snooze from the popup ---
await addReminderTask(page, 'Water the plants');
await reminderModal(page).waitFor({ timeout: 8000 });
await page.getByRole('button', { name: 'Snooze 10 min' }).click();
await closed(page);
check(!(await reminderModal(page).count()), 'Popup closes after snooze');
await page.waitForTimeout(3000);
check(!(await reminderModal(page).count()), 'Snoozed reminder does not immediately re-fire (rescheduled ~10 min out)');

// --- No re-fire after reload for an already-fired-and-handled reminder ---
await page.reload();
await page.locator('main h1').first().waitFor();
await page.waitForTimeout(3000);
check(!(await reminderModal(page).count()), 'A reminder already marked done earlier does not re-fire after a reload');

await browser.close();
check(errors.length === 0, 'No console/page errors (chime playback did not throw)', [...new Set(errors)].slice(0, 4).join(' | '));
console.log(`\n${failed ? `${failed} FAILED` : 'All passed'}.`);
process.exit(failed ? 1 : 0);
