// Life OS 2 e2e on the BUILT file from file://: persona onboarding → Command Center (briefing + Orbit) →
// command palette → Focus Mode (timer, pause, minimise, log) → Weekly Reset (full flow, saved) →
// Insights ("still learning") → Study subjects + linked assignments → Journal entry with mood.
import { chromium } from 'playwright';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const url = pathToFileURL(path.join(ROOT, 'dist', 'index.html')).href;
const channel = process.argv.find((a) => a.startsWith('--only='))?.slice(7) ?? 'msedge';

let failed = 0;
const check = (ok, name, detail = '') => { if (!ok) failed++; console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`); };
const errors = [];

console.log(`▶ ${channel}`);
const profile = path.join(os.tmpdir(), `lifeos-v2-${channel}-${Date.now()}`);
const ctx = await chromium.launchPersistentContext(profile, { channel, viewport: { width: 1360, height: 900 }, colorScheme: 'dark', locale: 'en-US' });
const page = ctx.pages()[0];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.clock.install();
await page.goto(url);
const sidebar = page.locator('aside.sidebar');
const nextBtn = (n = 'Continue') => page.getByRole('button', { name: n, exact: true });

// ---------------------------------------------------------------- persona onboarding
await page.getByRole('button', { name: /Set up my workspace/ }).click();
await page.getByRole('heading', { name: 'Where would you like to start?' }).waitFor();
await page.getByRole('radio', { name: /Student/ }).click();
await nextBtn().click();
await page.getByRole('heading', { name: 'Fine-tune your areas' }).waitFor();
check((await page.getByRole('checkbox', { name: /^Study/ }).getAttribute('aria-checked')) === 'true' && (await page.getByRole('checkbox', { name: /^Work/ }).getAttribute('aria-checked')) === 'false', 'Student starting point turns Study on and leaves Work off');
await nextBtn().click();                       // theme
await nextBtn().click();                       // about
await page.getByLabel('What should we call you?').fill('Sam');
await nextBtn().click();                       // dashboard
await nextBtn('Create workspace').click();
await page.getByRole('button', { name: /Open my workspace/ }).click();
await page.getByRole('heading', { level: 1, name: /, Sam$/ }).waitFor();
const links = await sidebar.locator('nav a').allInnerTexts();
check(links[1]?.trim() === 'Study & Read', 'Study comes first in the navigation for a student', links.map((s) => s.trim()).join(' | '));

// ---------------------------------------------------------------- command center
const hero = page.getByRole('region', { name: 'Today', exact: true });
check(await hero.getByText(/Your workspace is empty/).isVisible(), 'Home briefing welcomes an empty workspace instead of showing nothing');
check((await page.getByRole('list', { name: 'Today by area' }).getByRole('button').count()) === 4, 'Orbit legend shows Tasks, Habits, Focus and Wellness', '4 areas');
check(!(await hero.getByText(/score/i).count()), 'No combined "life score" anywhere on Home');
check((await page.getByRole('region', { name: 'Focus', exact: true }).isVisible()) && (await page.getByRole('region', { name: 'Progress', exact: true }).isVisible()), 'Home shows the Focus and Progress graph tiles');
check(await page.getByRole('region', { name: 'Wellbeing', exact: true }).getByText('Not enough data yet').isVisible(), 'Wellbeing tile admits there is not enough data instead of drawing a made-up curve');
await page.getByPlaceholder('Add a task for today…').fill('Write essay');
await page.keyboard.press('Enter');
await page.getByPlaceholder('Add a task for today…').fill('Read chapter');
await page.keyboard.press('Enter');
await hero.getByText(/2 things to do today/).waitFor();
check(true, 'Headline updates from real data (2 things to do today)');

// ---------------------------------------------------------------- command palette
await page.keyboard.press('Control+k');
await page.getByRole('dialog', { name: 'Command palette' }).waitFor();
await page.getByRole('combobox', { name: 'Search or jump to' }).fill('tasks');
await page.keyboard.press('Enter');
await page.getByRole('heading', { level: 1, name: 'Tasks' }).waitFor();
check(true, 'Ctrl+K palette jumps to a page');
await sidebar.getByRole('link', { name: 'Home', exact: true }).click();
await page.getByRole('heading', { level: 1, name: /, Sam$/ }).waitFor();

// ---------------------------------------------------------------- focus mode
await sidebar.getByRole('button', { name: /Start focus/ }).click();
const room = page.locator('dialog.focus');
await room.getByRole('radio', { name: /Write essay/ }).click();
await room.getByRole('button', { name: /Start \d+-minute focus/ }).click();
await room.getByRole('timer').waitFor();
check(/^2[45]:\d\d/.test((await room.getByRole('timer').innerText()).trim()), 'Focus timer counts down from 25:00');
await room.getByRole('button', { name: 'Pause' }).click();
check(await room.getByRole('button', { name: 'Resume' }).isVisible(), 'Pause switches to Resume');
await room.getByRole('button', { name: 'Resume' }).click();
await room.getByRole('button', { name: /Minimise/ }).click();
const pill = page.getByRole('button', { name: /Focus session in progress/ });
await pill.waitFor();
check(true, 'Minimising keeps the session running as a floating pill');
await page.reload();
await page.getByRole('heading', { level: 1, name: /, Sam$/ }).waitFor();
check(await page.getByRole('button', { name: /Focus session in progress/ }).isVisible(), 'A running focus session survives a reload');
await page.clock.fastForward(95_000);
await page.getByRole('button', { name: /Focus session in progress/ }).click();
await page.locator('dialog.focus').getByRole('button', { name: 'Stop and log this session' }).click();
await page.getByText(/Logged \d+m of focus/).waitFor();
check(true, 'Stopping records the focus time automatically');
const focusVal = page.getByRole('list', { name: 'Today by area' }).getByRole('button', { name: /Focus/ });
check(/[1-9]\d*m/.test(await focusVal.innerText()), 'Focus time appears in the Orbit', (await focusVal.innerText()).replace(/\s+/g, ' '));

// ---------------------------------------------------------------- weekly reset
await sidebar.getByRole('link', { name: 'Weekly Reset' }).click();
await page.getByRole('heading', { level: 1, name: 'Weekly Reset' }).waitFor();
await page.getByRole('button', { name: /Start Weekly Reset/ }).click();
const reset = page.locator('dialog.reset');
await reset.getByRole('heading', { name: 'How did last week go?' }).waitFor();
await reset.getByRole('button', { name: "Let's go" }).click();
await reset.getByRole('heading', { name: 'What went well' }).waitFor();
await reset.getByRole('button', { name: 'Continue' }).click();
await reset.getByRole('heading', { name: /Nothing left behind|What did not get done/ }).waitFor();
await reset.getByRole('button', { name: 'Continue' }).click();
await reset.getByRole('heading', { name: 'What matters most?' }).waitFor();
await reset.locator('.chips button', { hasText: 'Write essay' }).click();
await reset.getByRole('radiogroup', { name: /Day for Write essay/ }).getByRole('radio', { name: 'Mon' }).click();
await reset.getByRole('button', { name: 'Continue' }).click();
await reset.getByRole('heading', { name: 'Your week at a glance' }).waitFor();
await reset.getByRole('textbox', { name: /One sentence to carry/ }).fill('Start the hard thing first.');
await reset.getByRole('button', { name: 'Plan my week' }).click();
await reset.getByRole('heading', { name: 'Your week is ready.' }).waitFor();
check(await reset.locator('.sum').getByText('Write essay').isVisible() && await reset.locator('.sum').getByText(/Start the hard thing first/).isVisible(), 'The finale summarises priorities and the reflection');
await reset.getByRole('button', { name: 'Done' }).click();
await page.getByRole('heading', { name: 'Your week is planned.' }).waitFor();
check(true, 'Weekly Reset saves and the page shows it as done');
await page.locator('button.row').first().click();
check(await page.getByText('Write essay').first().isVisible(), 'Past resets list the saved week');

// ---------------------------------------------------------------- insights
await sidebar.getByRole('link', { name: 'Insights' }).click();
await page.getByRole('heading', { level: 1, name: 'Insights' }).waitFor();
check(await page.getByText("We're still learning your patterns.").isVisible(), 'Insights never fabricate: a new workspace says it is still learning');

// ---------------------------------------------------------------- study subjects
await sidebar.getByRole('link', { name: 'Study & Read' }).click();
await page.getByRole('heading', { level: 1, name: 'Study & Read' }).waitFor();
await page.getByRole('button', { name: 'New subject' }).first().click();
await page.getByLabel('Subject', { exact: true }).fill('Biology');
await page.getByRole('button', { name: 'Create subject' }).click();
await page.getByText('Biology').first().waitFor();
await page.locator('button.card', { hasText: 'Biology' }).click();
await page.getByPlaceholder('Add an assignment…').fill('Lab report');
await page.keyboard.press('Enter');
await page.getByRole('button', { name: 'Lab report', exact: true }).waitFor();
check(true, 'An assignment added inside a subject is linked to it');
// "Add exam" / "Add meeting" open the event form preset to that type (regression: they crashed the page)
await page.getByRole('button', { name: 'Add exam' }).click();
const examDlg = page.locator('dialog[open]').last();
await examDlg.getByLabel('Event', { exact: true }).fill('Midterm');
check((await examDlg.getByLabel('Type').inputValue()) === 'exam', 'Add exam opens the event form with the type set to Exam');
await examDlg.getByRole('button', { name: 'Add event' }).click();
await page.waitForFunction(() => !document.querySelector('dialog[open]'), null, { timeout: 8000 });
await page.getByText('Midterm').first().waitFor();
check(true, 'An exam added inside a subject appears under it');
await page.getByRole('button', { name: /^Study$|Subjects/ }).first().click();
await page.getByText(/0 of 1 assignments/).waitFor();
check(true, 'The subject card rolls up its assignments');

// ---------------------------------------------------------------- journal
await sidebar.getByRole('link', { name: 'Notes' }).click();
await page.getByRole('heading', { level: 1, name: 'Notes' }).waitFor();
await page.getByRole('button', { name: 'Journal entry' }).click();
await page.getByRole('radio', { name: 'Good' }).click();
await page.getByLabel('Note text').fill('A calm, productive day.');
await page.getByText('Saved').waitFor();
check((await page.getByRole('radio', { name: 'Good' }).getAttribute('aria-checked')) === 'true', 'A journal entry keeps its mood');
check(await page.getByRole('radio', { name: 'Journal' }).first().isVisible(), 'Journal filter appears once an entry exists');

// three themes
await page.goto(url + '#/settings');
await page.getByRole('heading', { level: 1, name: 'Settings' }).waitFor();
check((await page.getByRole('radiogroup', { name: 'Theme' }).getByRole('radio').count()) === 3, 'Settings offers three themes (Light, Soft, Dark)');
await page.getByRole('radiogroup', { name: 'Theme' }).getByRole('radio', { name: /^Light/ }).click();
check((await page.evaluate(() => document.documentElement.dataset.theme)) === 'light', 'Choosing Light applies the light theme');
await page.getByRole('radiogroup', { name: 'Theme' }).getByRole('radio', { name: /^Soft/ }).click();
check((await page.evaluate(() => document.documentElement.dataset.theme)) === 'soft', 'Choosing Soft applies the soft theme');

check(errors.length === 0, 'No console/page errors', [...new Set(errors)].slice(0, 4).join(' | '));
await ctx.close();
console.log(`\n${failed ? `${failed} FAILED` : 'All passed'}.`);
process.exit(failed ? 1 : 0);
