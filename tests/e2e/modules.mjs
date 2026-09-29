// Phase 4 e2e: every module's core flows on the BUILT file from file:// (installed browser).
// create → edit → complete/log → search/filter → delete (confirm) → undo → relaunch persistence,
// plus phone-width overflow checks and screenshots of each module with sample data.
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const url = pathToFileURL(path.join(ROOT, 'dist', 'index.html')).href;
const base = url.split('#')[0];
const SHOTS = path.join(ROOT, 'tests', 'e2e', 'screenshots');
const channel = process.argv.find((a) => a.startsWith('--only='))?.slice(7) ?? 'msedge';
await fs.mkdir(SHOTS, { recursive: true });

let failed = 0;
const check = (ok, name, detail = '') => { if (!ok) failed++; console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`); };
const soft = async (name, fn) => { try { await fn(); } catch (e) { check(false, name, e.message.split('\n')[0]); } };
const profile = path.join(os.tmpdir(), `lifeos-mod-${channel}-${Date.now()}`);
const errors = [];
async function launch(viewport = { width: 1360, height: 900 }) {
  const ctx = await chromium.launchPersistentContext(profile, { channel, viewport, colorScheme: 'light', locale: 'en-US' });
  const page = ctx.pages()[0];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url);
  return { ctx, page };
}
// fresh page per module so one failed step (e.g. a dialog left open) can't cascade into the next module
const go = async (page, hash, ready = (p) => p.locator('main h1').first().waitFor()) => { await page.goto(`${base}#/${hash}`); await page.reload(); await ready(page); };
const dlg = (page) => page.locator('dialog[open]').last();
const closed = (page) => page.waitForFunction(() => !document.querySelector('dialog[open]'), null, { timeout: 5000 });
const toastText = (page, re) => page.locator('.toast').filter({ hasText: re }).first().waitFor({ timeout: 5000 });
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
// Wellness's water/sleep fields load asynchronously per day (getWellness(day).then(...)), while the
// "Today"/"Yesterday" heading updates synchronously off local state — on a slower machine (CI) there's
// a real window where the heading has already flipped but the fields still show the previous day's
// values. Poll instead of checking immediately after the heading appears.
const waitInputValue = (locator, expected) => locator.evaluate((el, v) => new Promise((res) => {
  let n = 0;
  const tick = () => { if (el.value === v || ++n > 180) res(el.value === v); else requestAnimationFrame(tick); };
  tick();
}), expected);
const waitText = (locator, expected) => locator.evaluate((el, v) => new Promise((res) => {
  let n = 0;
  const tick = () => { if (el.innerText.trim() === v || ++n > 180) res(el.innerText.trim() === v); else requestAnimationFrame(tick); };
  tick();
}), expected);

console.log(`▶ ${channel}`);
let { ctx, page } = await launch();
await page.getByRole('button', { name: /Set up my workspace/ }).click();
for (let i = 0; i < 4; i++) await page.getByRole('button', { name: /^(Continue|Create workspace)$/ }).click();
await page.getByRole('button', { name: /Open my workspace/ }).click();
await page.getByRole('heading', { level: 1, name: /^Good/ }).waitFor();

// ---------------------------------------------------------------- Tasks
await soft('Tasks flow', async () => {
  await go(page, 'tasks');
  check(await page.getByText('Nothing due today').isVisible(), 'Tasks: empty state');
  await page.getByRole('button', { name: 'Add task' }).first().click();
  await dlg(page).getByLabel('Task', { exact: true }).fill('Prepare slides');
  await dlg(page).getByRole('radio', { name: 'Tomorrow' }).click();
  await dlg(page).getByRole('radio', { name: 'High' }).click();
  await dlg(page).getByLabel('Tags (optional)').fill('work, #urgent');
  await dlg(page).getByRole('button', { name: 'Add task' }).click();
  await page.locator('main').getByRole('radio', { name: /^Upcoming/ }).click();
  await page.getByRole('heading', { name: /^Tomorrow/ }).waitFor();
  check(await page.getByText('#work').isVisible() && await page.getByText('#urgent').isVisible(), 'Tasks: created with due date + tags, shown under Upcoming › Tomorrow');
  await page.getByRole('searchbox', { name: 'Search tasks' }).fill('#work');
  check(await page.getByText('Prepare slides').isVisible(), 'Tasks: search by #tag');
  await page.getByRole('searchbox', { name: 'Search tasks' }).fill('zzz');
  check(await page.getByText('No matching tasks').isVisible(), 'Tasks: search with no match shows empty state');
  await page.getByRole('searchbox', { name: 'Search tasks' }).fill('');
  // edit
  await page.getByRole('button', { name: /Prepare slides/ }).click();
  await dlg(page).getByLabel('Task', { exact: true }).fill('Prepare board slides');
  await dlg(page).getByRole('radio', { name: 'Today' }).click();
  await dlg(page).getByRole('button', { name: 'Save' }).click();
  await closed(page);
  await page.locator('main').getByRole('radio', { name: /^Today/ }).click();
  await page.locator('main').getByText('Prepare board slides').waitFor();
  check(true, 'Tasks: edit title + move to Today');
  // priority filter
  await page.locator('main').getByLabel('Priority').selectOption('low');
  check(await page.getByText('No matching tasks').isVisible(), 'Tasks: priority filter');
  await page.locator('main').getByLabel('Priority').selectOption('all');
  // complete → Completed view
  await page.getByRole('checkbox', { name: /Complete: Prepare board slides/ }).click();
  await page.locator('main').getByRole('radio', { name: 'Completed' }).click();
  await page.locator('main').getByText('Prepare board slides').waitFor();
  check(true, 'Tasks: completed task listed in Completed (by completion day)');
  // delete with confirmation, then undo
  await page.getByRole('button', { name: /Prepare board slides/ }).click();
  await dlg(page).getByRole('button', { name: 'Delete' }).click();
  await dlg(page).getByRole('heading', { name: 'Delete this task?' }).waitFor();
  check(true, 'Tasks: delete asks for confirmation');
  await dlg(page).getByRole('button', { name: 'Delete task' }).click();
  await closed(page);
  await toastText(page, /Task deleted/);
  check(!(await page.locator('main').getByText('Prepare board slides').count()), 'Tasks: deleted');
  await page.getByRole('button', { name: 'Undo' }).last().click();
  await page.locator('main').getByText('Prepare board slides').waitFor();
  check(true, 'Tasks: undo restores the deleted task');
});

// ---------------------------------------------------------------- Habits
await soft('Habits flow', async () => {
  await go(page, 'habits');
  await page.getByRole('button', { name: 'Create your first habit' }).click();
  await dlg(page).getByLabel('Habit', { exact: true }).fill('Stretch');
  await dlg(page).getByRole('button', { name: 'Create habit' }).click();
  await page.getByRole('checkbox', { name: 'Stretch done today' }).click();
  const card = page.locator('li.habit').filter({ hasText: 'Stretch' });
  await card.getByText('1 day', { exact: true }).first().waitFor();
  check(true, 'Habits: created + checked in → current streak 1 day');
  // fix yesterday in the history calendar
  await card.getByRole('button', { name: /Stretch/ }).first().click();
  await dlg(page).getByRole('grid').waitFor();
  const yesterday = await page.evaluate(() => { const d = new Date(); d.setDate(d.getDate() - 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
  if (!(await dlg(page).locator(`[data-day="${yesterday}"]`).count())) await dlg(page).getByRole('button', { name: 'Previous month' }).click();
  await dlg(page).locator(`[data-day="${yesterday}"]`).click();
  await page.keyboard.press('Escape');
  await card.getByText('2 days', { exact: true }).first().waitFor({ timeout: 5000 });
  check(true, 'Habits: history calendar lets you fix yesterday → streak 2 days');
  const tomorrow = await page.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
  await card.getByRole('button', { name: /Stretch/ }).first().click();
  if (await dlg(page).locator(`[data-day="${tomorrow}"]`).count()) {
    await dlg(page).locator(`[data-day="${tomorrow}"]`).click();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    check(await card.getByText('2 days', { exact: true }).first().isVisible(), 'Habits: future days cannot be checked');
  } else { await page.keyboard.press('Escape'); }
  // archive keeps history
  await card.getByRole('button', { name: 'Edit Stretch' }).click();
  await dlg(page).getByRole('button', { name: 'Archive' }).click();
  await page.getByRole('button', { name: /Show archived \(1\)/ }).waitFor();
  check(true, 'Habits: archive moves habit to archived list');
});

// ---------------------------------------------------------------- Goals
await soft('Goals flow', async () => {
  await go(page, 'goals');
  await page.getByRole('button', { name: 'Set a goal' }).click();
  await dlg(page).getByLabel('Goal', { exact: true }).fill('Read 10 books');
  await dlg(page).getByLabel('Target').fill('10');
  await dlg(page).getByLabel('Unit (optional)').fill('books');
  await dlg(page).getByRole('button', { name: 'Create goal' }).click();
  await page.getByText('0 / 10 books').waitFor();
  await page.getByRole('button', { name: 'Log progress' }).click();
  await dlg(page).getByLabel(/Where are you now/).fill('4');
  await dlg(page).getByLabel('Note (optional)').fill('Finished Dune');
  await dlg(page).getByRole('button', { name: 'Save progress' }).click();
  await page.getByText('4 / 10 books').waitFor();
  check(true, 'Goals: numeric goal + progress logged (4 / 10 books)');
  await page.getByRole('button', { name: 'History' }).click();
  // goalHistory() is an async re-fetch triggered by the dialog opening (detailId change), not
  // populated synchronously with the click — wait for it rather than checking immediately.
  await dlg(page).getByText('Finished Dune').waitFor({ timeout: 3000 }).catch(() => {});
  check(await dlg(page).getByText('Finished Dune').isVisible(), 'Goals: dated progress history with note');
  await page.keyboard.press('Escape');
  // milestone goal
  await page.getByRole('button', { name: 'New goal' }).click();
  await dlg(page).getByLabel('Goal', { exact: true }).fill('Launch website');
  await dlg(page).getByRole('radio', { name: 'Milestones' }).click();
  await dlg(page).getByLabel('Milestone 1', { exact: true }).fill('Design');
  await dlg(page).getByLabel('Milestone 2', { exact: true }).fill('Publish');
  await dlg(page).getByRole('button', { name: 'Create goal' }).click();
  await page.getByRole('checkbox', { name: 'Milestone: Design' }).click();
  await page.getByText('1 of 2 milestones').waitFor();
  check(true, 'Goals: milestone ticked → 1 of 2 milestones');
  // delete with confirmation
  await page.getByRole('button', { name: 'Launch website' }).click();
  await dlg(page).getByRole('button', { name: 'Delete' }).click();
  await dlg(page).getByRole('button', { name: 'Delete goal and history' }).click();
  await toastText(page, /Deleted "Launch website"/);
  check(!(await page.locator('.goal .title').getByText('Launch website').count()), 'Goals: delete (confirmed) removes goal');
});

// ---------------------------------------------------------------- Calendar
await soft('Calendar flow', async () => {
  await go(page, 'calendar');
  await page.getByRole('button', { name: 'Add event' }).first().click();
  await dlg(page).getByLabel('Event', { exact: true }).fill('Yoga class');
  await dlg(page).getByRole('button', { name: 'Add event' }).click();
  await page.locator('.agenda').getByText('Yoga class').waitFor();
  // month-grid cells show a count chip ("1 event"), not the title — check the selected (today) cell got one
  check(await page.locator('.day.sel .chip').getByText('1 event').isVisible(), 'Calendar: event in agenda + month grid count');
  const label = await page.locator('.mn .label').innerText();
  await page.getByRole('button', { name: 'Next month' }).click();
  check((await page.locator('.mn .label').innerText()) !== label, 'Calendar: browse to next month');
  await page.getByRole('button', { name: 'This month' }).click();
  await page.locator('.agenda').getByText('Yoga class').click();
  await dlg(page).getByLabel('Event', { exact: true }).fill('Evening yoga');
  await dlg(page).getByRole('button', { name: 'Save' }).click();
  await page.locator('.agenda').getByText('Evening yoga').waitFor();
  check(true, 'Calendar: edit event');
  await page.locator('.agenda').getByText('Evening yoga').click();
  await dlg(page).getByRole('button', { name: 'Delete' }).click();
  await dlg(page).getByRole('button', { name: 'Delete event' }).click();
  await toastText(page, /Event deleted/);
  check(!(await page.locator('.agenda').getByText('Evening yoga').count()), 'Calendar: delete (confirmed)');
});

// ---------------------------------------------------------------- Notes
await soft('Notes flow', async () => {
  await go(page, 'notes');
  await page.getByRole('button', { name: 'Write your first note' }).click();
  await page.getByLabel('Note title').fill('Trip ideas');
  await page.getByLabel('Note text').fill('Lisbon in spring\nPorto after');
  await page.getByText('Saved', { exact: true }).waitFor({ timeout: 5000 });
  check(true, 'Notes: autosave');
  // an empty new note is discarded when leaving it
  await page.getByRole('button', { name: 'New note' }).click();
  await page.waitForTimeout(300);
  await page.locator('.item').filter({ hasText: 'Trip ideas' }).click();
  await page.waitForTimeout(400);
  check((await page.locator('.item').count()) === 1, 'Notes: empty new note discarded');
  await page.getByRole('searchbox', { name: 'Search notes' }).fill('porto');
  check(await page.locator('.item').filter({ hasText: 'Trip ideas' }).isVisible(), 'Notes: search matches body text');
  await page.getByRole('searchbox', { name: 'Search notes' }).fill('');
});

// ---------------------------------------------------------------- Wellness
await soft('Wellness flow', async () => {
  await go(page, 'wellness');
  await page.getByRole('button', { name: 'More water' }).click();
  await page.getByRole('button', { name: 'More water' }).click();
  await page.getByLabel(/Sleep \(hours\)/).fill('7.5');
  await page.getByLabel(/Sleep \(hours\)/).press('Tab');
  await page.getByRole('radio', { name: 'Good' }).click();
  check(await waitText(page.locator('.stepper .big'), '2'), 'Wellness: water logged (2)');
  await page.getByRole('button', { name: 'Previous day' }).click();
  await page.getByRole('heading', { name: 'Yesterday' }).waitFor();
  const yesterdaySleepEmpty = await waitInputValue(page.getByLabel(/Sleep \(hours\)/), '');
  const yesterdayWaterEmpty = await waitText(page.locator('.stepper .big'), '0');
  check(yesterdaySleepEmpty && yesterdayWaterEmpty, "Wellness: yesterday is its own day (today's values not copied)");
  await page.getByRole('button', { name: 'Next day' }).click();
  await page.getByRole('heading', { name: 'Today' }).waitFor();
  check(await waitInputValue(page.getByLabel(/Sleep \(hours\)/), '7.5'), 'Wellness: today kept its values');
  await page.getByRole('button', { name: 'Log workout' }).first().click();
  await dlg(page).getByRole('radio', { name: 'Run' }).click();
  await dlg(page).getByLabel('Minutes').fill('35');
  await dlg(page).getByRole('button', { name: 'Log workout' }).click();
  await page.locator('.wos').getByText('Run').waitFor();
  check(await page.getByText('35 min').first().isVisible(), 'Wellness: workout logged (Run, 35 min)');
});

// ---------------------------------------------------------------- Finance
await soft('Finance flow', async () => {
  await go(page, 'finance');
  await page.getByRole('button', { name: 'Record money' }).click();
  await dlg(page).getByLabel(/^Amount/).fill('20');
  await dlg(page).getByLabel('Category').selectOption({ label: 'Groceries' });
  await dlg(page).getByRole('button', { name: 'Save' }).click();
  await page.getByRole('button', { name: 'Record', exact: true }).click();
  await dlg(page).getByRole('radio', { name: 'Income' }).click();
  await dlg(page).getByLabel(/^Amount/).fill('1000');
  await dlg(page).getByRole('button', { name: 'Save' }).click();
  await page.locator('.summary').getByText('$980.00').waitFor();
  check(await page.locator('.summary').getByText('$20.00').isVisible() && await page.locator('.summary').getByText('$1,000.00').isVisible(), 'Finance: spent $20, income $1,000, left $980');
  // edit amount
  await page.locator('.list').getByRole('button', { name: /Groceries/ }).click();
  await dlg(page).getByLabel(/^Amount/).fill('25.50');
  await dlg(page).getByRole('button', { name: 'Save' }).click();
  await page.locator('.summary').getByText('$25.50').waitFor();
  check(await page.locator('.summary').getByText('$974.50').isVisible(), 'Finance: edit recalculates (spent $25.50, left $974.50)');
  // previous month is separate
  await page.getByRole('button', { name: 'Previous month' }).click();
  await page.getByText(/Nothing recorded in/).waitFor();
  check(true, 'Finance: previous month browsable and separate');
  await page.getByRole('button', { name: 'This month' }).click();
  // delete (confirmed) + undo
  await page.locator('.list').getByRole('button', { name: /Groceries/ }).click();
  await dlg(page).getByRole('button', { name: 'Delete' }).click();
  await dlg(page).getByRole('button', { name: 'Delete transaction' }).click();
  await toastText(page, /Transaction deleted/);
  await page.locator('.summary').getByText('$1,000.00').first().waitFor();
  check(!(await page.locator('.list').getByRole('button', { name: /Groceries/ }).count()), 'Finance: delete (confirmed)');
  await page.getByRole('button', { name: 'Undo' }).click();
  await page.locator('.list').getByRole('button', { name: /Groceries/ }).waitFor();
  check(true, 'Finance: undo restores transaction');
  // categories
  await page.getByRole('button', { name: 'Categories' }).click();
  await dlg(page).getByLabel('New category').fill('Pets');
  await dlg(page).getByRole('button', { name: 'Add' }).click();
  await toastText(page, /Category added/);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Record', exact: true }).click();
  const opts = await dlg(page).getByLabel('Category').locator('option').allInnerTexts();
  check(opts.includes('Pets'), 'Finance: new category available when recording');
  await page.keyboard.press('Escape');
});
await ctx.close();

// ---------------------------------------------------------------- relaunch persistence
({ ctx, page } = await launch());
await page.getByRole('heading', { level: 1, name: /^Good/ }).waitFor();
const persisted = [];
await go(page, 'notes'); persisted.push(await page.locator('.item').filter({ hasText: 'Trip ideas' }).isVisible());
await go(page, 'goals'); persisted.push(await page.getByText('4 / 10 books').isVisible());
await go(page, 'finance'); persisted.push(await page.locator('.summary').getByText('$974.50').isVisible());
await go(page, 'wellness'); persisted.push((await page.getByLabel(/Sleep \(hours\)/).inputValue()) === '7.5');
check(persisted.every(Boolean), 'Relaunch: notes, goal progress, finance, wellness all persisted', persisted.join(','));

// sample data → screenshots + phone overflow per module
await go(page, 'dev/data', (p) => p.getByRole('button', { name: /Add 90 days of sample data/ }).waitFor());
await page.getByRole('button', { name: /Add 90 days of sample data/ }).click();
await page.getByText(/Added sample history/).waitFor();
const MODS = ['tasks', 'goals', 'habits', 'calendar', 'notes', 'wellness', 'finance'];
for (const m of MODS) { await go(page, m); await page.waitForTimeout(700); await page.screenshot({ path: path.join(SHOTS, `mod-${m}-desktop-soft.png`), fullPage: true }); }
await ctx.close();
({ ctx, page } = await launch({ width: 360, height: 780 }));
await page.getByRole('heading', { level: 1, name: /^Good/ }).waitFor();
await go(page, 'settings');
await page.getByRole('radio', { name: /^Dark/ }).click();
const overflowing = [];
for (const m of MODS) {
  await go(page, m);
  await page.waitForTimeout(700);
  if (!(await noOverflow(page))) overflowing.push(m);
  await page.screenshot({ path: path.join(SHOTS, `mod-${m}-phone-dark.png`), fullPage: true });
}
check(overflowing.length === 0, 'Phone 360px: no horizontal scrolling on any module', overflowing.join(', '));
await ctx.close();

check(errors.length === 0, 'No console/page errors', [...new Set(errors)].slice(0, 4).join(' | '));
console.log(`\n${failed ? `${failed} FAILED` : 'All passed'}.`);
process.exit(failed ? 1 : 0);
