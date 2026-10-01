// Phase 3 e2e: live dashboard on the BUILT file from file://. Fresh user → every quick action →
// widgets update → relaunch persists → sample-data screenshots for all layouts, both themes, phone.
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const url = pathToFileURL(path.join(ROOT, 'dist', 'index.html')).href;
const SHOTS = process.env.LIFEOS_SHOTS ?? path.join(ROOT, 'tests', 'e2e', 'screenshots');
const channel = process.argv.find((a) => a.startsWith('--only='))?.slice(7) ?? 'msedge';
await fs.mkdir(SHOTS, { recursive: true });

let failed = 0;
const check = (ok, name, detail = '') => { if (!ok) failed++; console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`); };
const profile = path.join(os.tmpdir(), `lifeos-dash-${channel}-${Date.now()}`);
const errors = [];
async function launch(viewport = { width: 1360, height: 900 }) {
  const ctx = await chromium.launchPersistentContext(profile, { channel, viewport, colorScheme: 'light', locale: 'en-US' });
  const page = ctx.pages()[0];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url);
  return { ctx, page };
}
const widget = (page, title) => page.locator('section.wc').filter({ has: page.getByRole('heading', { name: title, exact: true }) });

console.log(`▶ ${channel}`);
let { ctx, page } = await launch();
// fast onboarding with defaults
await page.getByRole('button', { name: /Set up my workspace/ }).click();
for (let i = 0; i < 5; i++) await page.getByRole('button', { name: /^(Continue|Create workspace)$/ }).click();
await page.getByRole('button', { name: /Open my workspace/ }).click();
await page.getByRole('heading', { level: 1, name: /^Good/ }).waitFor();

// empty states
for (const [title, text] of [["Today's tasks", 'Nothing due today'], ['Habit check-in', 'No habits yet'], ['Goal progress', 'No active goals'], ['Upcoming', 'Nothing in the next two weeks'], ['This month', /No money recorded/], ['Recent notes', 'No notes yet']]) {
  check(await widget(page, title).getByText(text).isVisible(), `Empty state: ${title}`);
}
await page.screenshot({ path: path.join(SHOTS, 'dash-empty-soft.png') });

// task via quick action form
await page.getByRole('region', { name: 'Quick actions' }).getByRole('button', { name: 'Add task' }).click();
await page.getByLabel('Task', { exact: true }).fill('Call the bank');
await page.getByRole('radio', { name: 'High' }).click();
await page.getByRole('button', { name: 'Add task', exact: true }).last().click();
await widget(page, "Today's tasks").getByText('Call the bank').waitFor();
check(await widget(page, "Today's tasks").getByText('High').isVisible(), 'Quick action → task form → appears in Today with priority');
// inline add
await page.getByPlaceholder('Add a task for today…').fill('Water the plants');
await page.keyboard.press('Enter');
await widget(page, "Today's tasks").getByText('Water the plants').waitFor();
check(true, 'Inline add (Enter) creates a task for today');
// complete + undo
await page.getByRole('checkbox', { name: 'Complete Call the bank' }).click();
await page.getByText('Done: Call the bank').waitFor();
await widget(page, "Today's tasks").getByText('Call the bank').waitFor({ state: 'detached' });
await widget(page, "Today's tasks").getByText('1/2').waitFor();
check(true, 'Ticking a task completes it (1/2 done)');
await page.getByRole('button', { name: 'Undo' }).click();
await widget(page, "Today's tasks").getByText('Call the bank').waitFor();
check(true, 'Undo brings the task back');

// habit via empty-state CTA, then check in
await widget(page, 'Habit check-in').getByRole('button', { name: 'Create a habit' }).click();
await page.getByLabel('Habit', { exact: true }).fill('Read 20 minutes');
await page.getByRole('button', { name: 'Create habit' }).click();
await widget(page, 'Habit check-in').getByText('Read 20 minutes').waitFor();
await page.getByRole('checkbox', { name: 'Read 20 minutes done today' }).click();
await widget(page, 'Habit check-in').getByText('1 of 1').waitFor();
check(await widget(page, 'Habit check-in').getByText('1-day streak').isVisible(), 'Habit created + checked in (1 of 1, 1-day streak)');

// money
await page.getByRole('region', { name: 'Quick actions' }).getByRole('button', { name: 'Spending' }).click();
await page.getByLabel(/^Amount/).fill('12.50');
await page.getByRole('button', { name: 'Save', exact: true }).click();
await widget(page, 'This month').getByText('$12.50').first().waitFor();
check(true, 'Record spending $12.50 → This month shows it');
// validation
await page.getByRole('region', { name: 'Quick actions' }).getByRole('button', { name: 'Spending' }).click();
await page.getByLabel(/^Amount/).fill('abc');
await page.getByRole('button', { name: 'Save', exact: true }).click();
check(await page.getByText('Enter an amount, like 12.50').isVisible(), 'Invalid amount is rejected with a clear message');
await page.getByRole('button', { name: 'Cancel' }).click();

// water
await page.getByRole('region', { name: 'Quick actions' }).getByRole('button', { name: 'Add water' }).click();
await page.getByText(/Water: 1 glasses today/).waitFor();
check((await widget(page, 'Wellness today').locator('.val').first().innerText()).startsWith('1'), 'Add water updates Wellness today');
await widget(page, 'Wellness today').getByRole('radio', { name: 'Good' }).click();
await page.waitForTimeout(200);
check((await widget(page, 'Wellness today').getByRole('radio', { name: 'Good' }).getAttribute('aria-checked')) === 'true', 'Mood logged');

// goal, event, note
await page.getByRole('region', { name: 'Quick actions' }).getByRole('button', { name: 'New goal' }).click();
await page.getByLabel('Goal', { exact: true }).fill('Read 12 books');
await page.getByLabel('Target').fill('12');
await page.getByLabel('Unit (optional)').fill('books');
await page.getByRole('button', { name: 'Create goal' }).click();
await widget(page, 'Goal progress').getByText('Read 12 books').waitFor();
check(await widget(page, 'Goal progress').getByText('0 / 12 books').isVisible(), 'Goal created (0 / 12 books)');
await page.getByRole('region', { name: 'Quick actions' }).getByRole('button', { name: 'Add event' }).click();
await page.getByLabel('Event', { exact: true }).fill('Dinner with Sam');
await page.getByRole('button', { name: 'Add event' }).last().click();
await widget(page, 'Upcoming').getByText('Dinner with Sam').waitFor();
check(await widget(page, 'Upcoming').getByText('Today').isVisible(), 'Event added for today appears in Upcoming');
await page.getByRole('region', { name: 'Quick actions' }).getByRole('button', { name: 'New note' }).click();
await page.getByLabel('Note', { exact: true }).fill('Idea: plan a weekend trip');
await page.getByRole('button', { name: 'Save note' }).click();
await widget(page, 'Recent notes').getByText(/Idea: plan a weekend trip/).first().waitFor();
check(true, 'Note saved → Recent notes');
check(await widget(page, 'Your week').getByText('1 of 7').isVisible(), 'Your week counts today (1 of 7 days)');
await page.screenshot({ path: path.join(SHOTS, 'dash-used-soft.png') });
await ctx.close();

// relaunch: all of it persisted
({ ctx, page } = await launch());
await page.getByRole('heading', { level: 1, name: /^Good/ }).waitFor();
const seen = (loc) => loc.waitFor({ timeout: 5000 }).then(() => true, () => false); // widgets load async
const persisted = await Promise.all([
  seen(widget(page, "Today's tasks").getByText('Call the bank')),
  seen(widget(page, 'Habit check-in').getByText('1 of 1')),
  seen(widget(page, 'This month').getByText('$12.50').first()),
  seen(widget(page, 'Goal progress').getByText('Read 12 books')),
]);
check(persisted.every(Boolean), 'After relaunch: task, habit check-in, spending, goal all still there', persisted.join(','));

// sample data → layouts + themes
await page.goto(url.split('#')[0] + '#/dev/data');
await page.getByRole('button', { name: /Add 90 days of sample data/ }).click();
await page.getByText(/Added sample history/).waitFor();
for (const layout of ['Balanced', 'Compact', 'Focus']) {
  await page.goto(url.split('#')[0] + '#/settings');
  await page.getByRole('radio', { name: new RegExp(`^${layout}`) }).click();
  await page.goto(url.split('#')[0] + '#/dashboard');
  await page.getByRole('heading', { level: 1, name: /^Good/ }).waitFor();
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(SHOTS, `dash-sample-${layout.toLowerCase()}-soft.png`), fullPage: true });
}
check((await page.locator('.dash.focus .dcol').count()) === 1, 'Focus layout = one column');
await page.goto(url.split('#')[0] + '#/settings');
await page.getByRole('radio', { name: /^Balanced/ }).click();
await page.getByRole('radio', { name: /^Dark/ }).click();
await page.goto(url.split('#')[0] + '#/dashboard');
await page.waitForTimeout(900);
check((await page.locator('.dash.balanced .dcol').count()) === 2, 'Balanced layout = two columns on desktop');
await page.screenshot({ path: path.join(SHOTS, 'dash-sample-balanced-dark.png'), fullPage: true });
await ctx.close();

// phone
({ ctx, page } = await launch({ width: 390, height: 844 }));
await page.getByRole('heading', { level: 1, name: /^Good/ }).waitFor();
await page.waitForTimeout(900);
check(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), 'Phone: no horizontal scrolling on the live dashboard');
check((await page.locator('.dash .dcol').count()) === 1, 'Phone: single column');
await page.screenshot({ path: path.join(SHOTS, 'dash-phone-dark.png'), fullPage: true });
await ctx.close();

check(errors.length === 0, 'No console/page errors', errors.slice(0, 3).join(' | '));
console.log(`\n${failed ? `${failed} FAILED` : 'All passed'}.`);
process.exit(failed ? 1 : 0);
