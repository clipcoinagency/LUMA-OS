// Date picker, time wheel and currency picker e2e on the BUILT file from file://.
// The friendly pickers sit on top of real native inputs, so typing/fill still works (checked too).
import { chromium } from 'playwright';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const url = pathToFileURL(path.join(ROOT, 'dist', 'index.html')).href;
const channel = process.argv.find((a) => a.startsWith('--only='))?.slice(7) ?? 'msedge';
const SHOTS = process.env.LIFEOS_SHOTS ?? path.join(ROOT, 'tests', 'e2e', 'screenshots');
await fs.mkdir(SHOTS, { recursive: true });
const theme = process.env.LIFEOS_THEME ?? 'dark';

let failed = 0;
const check = (ok, name, detail = '') => { if (!ok) failed++; console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`); };
const errors = [];
const pad = (n) => String(n).padStart(2, '0');
const key = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

console.log(`▶ ${channel}`);
const profile = path.join(os.tmpdir(), `lifeos-pick-${channel}-${Date.now()}`);
const mobile = process.env.LIFEOS_VIEW === 'mobile';
const ctx = await chromium.launchPersistentContext(profile, { channel, viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile, colorScheme: theme === 'dark' ? 'dark' : 'light', locale: 'en-US' });
const page = ctx.pages()[0];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(url);
const dlg = () => page.locator('dialog[open]').last();
const closed = () => page.waitForFunction(() => !document.querySelector('dialog[open]'), null, { timeout: 8000 });
const popOpen = () => page.locator('[popover]:popover-open');

await page.getByRole('button', { name: /Set up my workspace/ }).click();
for (let i = 0; i < 5; i++) await page.getByRole('button', { name: /^(Continue|Create workspace)$/ }).click();
await page.getByRole('button', { name: /Open my workspace/ }).click();
await page.getByRole('heading', { level: 1, name: /^Good/ }).waitFor();

// ---------------------------------------------------------------- date picker
await page.goto(url + '#/tasks'); await page.reload(); await page.locator('main h1').first().waitFor();
await page.getByRole('button', { name: 'Add task' }).first().click();
await dlg().getByLabel('Task', { exact: true }).fill('Pick a date');
await dlg().getByRole('radio', { name: 'Pick date' }).click();
const due = dlg().getByRole('button', { name: 'Open calendar' });
check(await due.isVisible(), 'Task form shows the calendar field instead of a bare date input');
await due.click();
await popOpen().getByRole('button', { name: 'Tomorrow' }).waitFor();
check((await popOpen().getByRole('button', { name: /^Today$/ }).count()) === 1, 'Calendar offers shortcut chips (Today, Tomorrow, Next week…)');
await page.screenshot({ path: path.join(SHOTS, `picker-date-${theme}${mobile ? "-mobile" : ""}.png`) });
const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
await popOpen().getByRole('button', { name: 'Tomorrow' }).click();
check((await dlg().getByLabel('Due date').inputValue()) === key(tomorrow), 'Choosing Tomorrow sets the real date value', await dlg().getByLabel('Due date').inputValue());
check(/Tomorrow/.test(await dlg().getByRole('button', { name: 'Open calendar' }).innerText()), 'The field reads the date in words with "Tomorrow"');
// day grid + month paging + keyboard
await dlg().getByRole('button', { name: 'Open calendar' }).click();
await popOpen().getByRole('button', { name: 'Next month' }).click();
const next = new Date(); next.setMonth(next.getMonth() + 1, 15);
await popOpen().locator(`[data-day="${key(next)}"]`).click();
check((await dlg().getByLabel('Due date').inputValue()) === key(next), 'Paging to next month and tapping a day selects it', await dlg().getByLabel('Due date').inputValue());
// typing still works through the native input
await dlg().getByLabel('Due date').fill('2026-12-24');
check(/24/.test(await dlg().getByRole('button', { name: 'Open calendar' }).innerText()), 'Typing a date into the underlying input updates the field');
// keyboard: open, arrow right, enter
await dlg().getByRole('button', { name: 'Open calendar' }).click();
await page.keyboard.press('ArrowRight');
await page.keyboard.press('Enter');
check((await dlg().getByLabel('Due date').inputValue()) === '2026-12-25', 'Arrow keys + Enter pick a day from the keyboard', await dlg().getByLabel('Due date').inputValue());

// ---------------------------------------------------------------- time wheel
const timeBtn = dlg().getByRole('button', { name: 'Open time picker' });
check(await timeBtn.isVisible(), 'Task form shows the time field');
await timeBtn.click();
await popOpen().getByRole('group', { name: 'Choose hour and minute' }).waitFor();
await page.screenshot({ path: path.join(SHOTS, `picker-time-${theme}${mobile ? "-mobile" : ""}.png`) });
await popOpen().getByRole('group', { name: 'Quick times' }).getByRole('button', { name: /^3:00\s?pm$/i }).click();
check((await dlg().getByLabel('Time (optional)').inputValue()) === '15:00', 'A time shortcut chip sets 15:00', await dlg().getByLabel('Time (optional)').inputValue());
check(/3:00\s?pm/i.test(await dlg().getByRole('button', { name: 'Open time picker' }).innerText()) && /Afternoon/.test(await dlg().getByRole('button', { name: 'Open time picker' }).innerText()), 'The field reads "3:00 PM · Afternoon"');
await dlg().getByRole('button', { name: 'Open time picker' }).click();
const hour = popOpen().getByRole('spinbutton', { name: 'Hour' });
await hour.focus();
await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown');   // 3 → 5
const minute = popOpen().getByRole('spinbutton', { name: 'Minute' });
await minute.focus();
await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown');   // 00 → 10
check((await dlg().getByLabel('Time (optional)').inputValue()) === '17:10', 'The hour and minute wheels move with the arrow keys', await dlg().getByLabel('Time (optional)').inputValue());
await popOpen().getByRole('spinbutton', { name: 'AM or PM' }).focus();
await page.keyboard.press('ArrowUp');
check((await dlg().getByLabel('Time (optional)').inputValue()) === '05:10', 'The AM/PM wheel flips the period', await dlg().getByLabel('Time (optional)').inputValue());
await popOpen().getByRole('button', { name: 'Done' }).click();
await dlg().getByLabel('Time (optional)').fill('18:45');
check(/6:45\s?pm/i.test(await dlg().getByRole('button', { name: 'Open time picker' }).innerText()), 'Typing a time into the underlying input updates the field');
await dlg().getByRole('button', { name: 'Add task', exact: true }).click();
await closed();
check(true, 'The task saves with the picked date and time');

// ---------------------------------------------------------------- currency picker
await page.goto(url + '#/finance'); await page.reload(); await page.locator('main h1').first().waitFor();
const pill = page.getByRole('button', { name: /^Currency: USD/ });
check(await pill.isVisible(), 'Finance has a currency switcher in its header (USD)');
await pill.click();
await popOpen().getByRole('searchbox').waitFor();
check((await popOpen().getByRole('list', { name: 'Currencies' }).getByRole('listitem').count()) >= 60, 'The picker offers 60+ currencies');
await page.screenshot({ path: path.join(SHOTS, `picker-currency-${theme}${mobile ? "-mobile" : ""}.png`) });
await popOpen().getByRole('searchbox').fill('rupee');
const names = await popOpen().getByRole('list', { name: 'Currencies' }).innerText();
check(/Indian Rupee/.test(names) && /Pakistani Rupee/.test(names), 'Searching "rupee" finds the rupees', names.replace(/\s+/g, ' ').slice(0, 80));
await popOpen().getByRole('button', { name: /Indian Rupee \(INR\)/ }).click();
await page.getByRole('button', { name: /^Currency: INR/ }).waitFor();
check(true, 'Choosing Indian Rupee switches the currency');
await page.getByRole('button', { name: 'Record', exact: true }).click();
check(await dlg().getByLabel(/^Amount \(INR\)/).isVisible(), 'New transactions use the chosen currency (Amount (INR))');
await dlg().getByLabel(/^Amount \(INR\)/).fill('1250.50');
await dlg().getByText('₹1,250.50').waitFor();
check(true, 'The amount preview shows the ₹ symbol');
await page.screenshot({ path: path.join(SHOTS, `picker-rupee-${theme}.png`) });
await dlg().getByRole('button', { name: 'Cancel' }).click();
await closed();
// euro too, from Settings
await page.goto(url + '#/settings'); await page.reload(); await page.getByRole('heading', { level: 1, name: 'Settings' }).waitFor();
await page.getByRole('button', { name: 'Currency', exact: true }).click();
await popOpen().getByRole('button', { name: /Euro \(EUR\)/ }).first().click();
await page.getByText('Euro').first().waitFor();
check(true, 'Settings uses the same picker (switched to Euro)');

check(errors.length === 0, 'No console/page errors', [...new Set(errors)].slice(0, 4).join(' | '));
await ctx.close();
console.log(`\n${failed ? `${failed} FAILED` : 'All passed'}.`);
process.exit(failed ? 1 : 0);
