// The new looks (Paper, Night Ink, Nebula) e2e on the BUILT file from file:// — their extra sections
// work, and the original three themes stay exactly as they were (no new sections, no new pages).
//  Paper: masthead + contents numbers → quick capture (plain English) → Breathe → Close the day
//  (move a loose end, one line, mood, close → journal note) → Seals → Nebula: year in light →
//  Light: none of the extras, /close redirects home, no notifications card → phone 360 → no errors.
import { chromium } from 'playwright';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const url = pathToFileURL(path.join(ROOT, 'dist', 'index.html')).href;
const base = url.split('#')[0];
const channel = process.argv.find((a) => a.startsWith('--only='))?.slice(7) ?? 'msedge';

let failed = 0;
const check = (ok, name, detail = '') => { if (!ok) failed++; console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`); };
const errors = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

console.log(`▶ ${channel}`);
const profile = path.join(os.tmpdir(), `lifeos-newlooks-${channel}-${Date.now()}`);
const ctx = await chromium.launchPersistentContext(profile, { channel, viewport: { width: 1360, height: 900 }, colorScheme: 'light', locale: 'en-US' });
const page = ctx.pages()[0];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const go = async (hash) => { await page.goto(`${base}#/${hash}`); await page.locator('main h1').first().waitFor(); };
const themeRadio = (name) => page.locator('[role=radio]', { has: page.locator('.name', { hasText: new RegExp(`^${name}$`) }) });
// the colours switch at once, but the saved setting lands a moment later (slower on CI runners) —
// wait for the picker to show it as chosen, which is driven by the saved setting itself
const setTheme = async (name) => {
  await go('settings');
  await themeRadio(name).click();
  await page.waitForFunction((n) => document.documentElement.dataset.theme === n, name === 'Night Ink' ? 'ink' : name.toLowerCase());
  await page.locator('[role=radio][aria-checked=true]', { has: page.locator('.name', { hasText: new RegExp('^' + name + '$') }) }).waitFor();
};
const closed = () => page.waitForFunction(() => !document.querySelector('dialog[open]'), null, { timeout: 8000 });
// for a failing width check: which (unclipped) elements stick out past the viewport
const overflowers = () => page.evaluate(() => { const vw = document.documentElement.clientWidth; const out = []; for (const el of document.querySelectorAll('body *')) { const b = el.getBoundingClientRect(); if (!b.width || b.right <= vw + 0.5 || getComputedStyle(el).position === 'fixed') continue; let p = el, clipped = false; while ((p = p.parentElement)) { const cs = getComputedStyle(p); if (cs.position === 'fixed' || /auto|scroll|hidden|clip/.test(cs.overflowX)) { clipped = true; break; } } if (!clipped) out.push(el.tagName + '.' + String(el.className?.baseVal ?? el.className).slice(0, 40) + '@' + Math.round(b.right) + ' in .' + String(el.parentElement?.className).slice(0, 30) + ' "' + (el.textContent || '').trim().slice(0, 50) + '"'); } return out.slice(0, 5).join(', '); });

try {
  // ---------------------------------------------------------------- onboarding straight into Paper
  await page.goto(url);
  await page.getByRole('button', { name: /Set up my workspace/ }).click();
  await page.getByRole('heading', { name: 'Where would you like to start?' }).waitFor();
  const next = () => page.getByRole('button', { name: 'Continue', exact: true });
  await next().click();                                       // persona
  await page.getByRole('heading', { name: 'Fine-tune your areas' }).waitFor();
  await next().click();                                       // modules
  await page.getByRole('heading', { name: 'Pick your look' }).waitFor();
  // count inside the theme picker only — on a slow runner the previous step's cards are still fading out
  const looks = page.getByRole('radiogroup', { name: 'Theme' }).getByRole('radio');
  check((await looks.count()) === 6, 'Onboarding offers six looks', String(await looks.count()));
  await themeRadio('Paper').click();
  await next().click();
  await page.getByLabel('What should we call you?').fill('Sam');
  await next().click();
  await page.getByRole('button', { name: 'Create workspace', exact: true }).click();
  await page.getByRole('button', { name: /Open my workspace/ }).click();
  await page.getByRole('heading', { level: 1, name: /, Sam$/ }).waitFor();
  check((await page.evaluate(() => document.documentElement.dataset.style)) === 'almanac', 'Paper uses the Almanac style');
  check(await page.locator('.mast').isVisible(), 'Paper: the masthead is on Home');
  check(/no\. \d+/i.test(await page.locator('.mast').innerText()), 'Paper: masthead shows the day number' /* shown in capitals */, await page.locator('.mast').innerText());
  check((await page.locator('aside nav a .pg').first().getAttribute('data-pg')) === 'i', 'Paper: contents numbers in the sidebar');
  check(await page.getByRole('link', { name: 'Close the day' }).isVisible(), 'New looks add "Close the day" to Reflect');

  // ---------------------------------------------------------------- Get started checklist
  const gs = page.getByRole('region', { name: 'Get started' });
  await gs.waitFor();
  check(/^0 of \d+ done/.test((await gs.locator('.meta').innerText()).trim()), 'Get started: a new workspace starts at 0 done', (await gs.locator('.meta').innerText()).trim());

  // ---------------------------------------------------------------- quick capture
  const qc = page.getByPlaceholder(/Add anything/);
  await qc.fill('Call mom tomorrow 6pm #family !high');
  check(await page.locator('.qc .chip', { hasText: 'Tomorrow' }).isVisible(), 'Quick capture: understands "tomorrow"');
  check(await page.locator('.qc .chip', { hasText: '6:00 PM' }).isVisible(), 'Quick capture: understands "6pm"');
  await qc.press('Enter');
  await page.getByText(/Added “Call mom”/).waitFor();
  check(true, 'Quick capture: adds the task with a confirmation');
  await qc.fill('Water plants');
  await qc.press('Enter');
  await page.getByText(/Added “Water plants”/).waitFor();
  await go('tasks');
  await page.getByRole('radio', { name: /^All/ }).click();
  const mom = page.locator('main').getByText('Call mom', { exact: true });
  await mom.waitFor();
  check(await mom.isVisible(), 'Quick capture: the task is in Tasks');
  await go('dashboard');
  await page.locator('.gs li.on', { hasText: 'Add your first task' }).waitFor({ timeout: 6000 });
  check(true, 'Get started: "Add your first task" ticks itself');
  await page.getByRole('button', { name: 'Hide the Get started list' }).click();
  await page.getByRole('region', { name: 'Get started' }).waitFor({ state: 'detached', timeout: 4000 });
  check(true, 'Get started: can be hidden');

  // ---------------------------------------------------------------- breathe
  await go('dashboard');
  await page.getByRole('button', { name: /^Breathe/ }).click();
  const dlg = page.locator('dialog[open]').last();
  await dlg.getByRole('button', { name: /Start · 1 minute/ }).click();
  await dlg.getByText('Breathe in').waitFor({ timeout: 3000 });
  check(true, 'Breathe: the guided minute starts');
  await page.keyboard.press('Escape');
  await closed();

  // ---------------------------------------------------------------- close the day
  await page.getByRole('button', { name: /^Close the day/ }).click();
  await page.getByRole('heading', { level: 1, name: 'Close the day' }).waitFor();
  const loose = page.locator('.loose li', { hasText: 'Water plants' });
  await loose.waitFor();
  await loose.getByRole('button', { name: 'Tomorrow' }).click();
  await page.getByText('“Water plants” → tomorrow').waitFor();
  await page.waitForFunction(() => ![...document.querySelectorAll('.loose li')].some((l) => l.textContent.includes('Water plants')));
  check(true, 'Close the day: a loose end moves to tomorrow');
  check(await page.locator('.tom').getByText('Water plants').isVisible(), 'Close the day: it now shows under Tomorrow');
  await page.getByPlaceholder(/What mattered today/).fill('A calm, good day.');
  await page.getByRole('radio', { name: 'Good' }).click();
  await page.getByRole('button', { name: 'Close the day', exact: true }).click();
  await page.getByRole('heading', { level: 1, name: /, Sam$/ }).waitFor();
  await page.getByRole('button', { name: /^Day closed/ }).waitFor();
  check(true, 'Close the day: Home shows "Day closed"');
  await go('notes');
  const note = page.getByText('Day closed', { exact: true }).first();
  await note.waitFor();
  check(await note.isVisible(), 'Close the day: the line is saved as a journal note');

  // ---------------------------------------------------------------- seals
  await go('seals');
  const lights = page.locator('.seal.earned', { hasText: 'Lights out' });
  await lights.waitFor();
  check(await lights.isVisible(), 'Seals: "Lights out" is earned after closing the day');

  // ---------------------------------------------------------------- keyboard shortcuts (new looks)
  await go('dashboard');
  await page.locator('body').click({ position: { x: 700, y: 8 } }).catch(() => {});
  await page.keyboard.press('?');
  const sheet = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
  await sheet.waitFor();
  check(await sheet.getByText('Go to a page').isVisible(), 'Shortcuts: "?" opens the cheat sheet');
  await page.keyboard.press('Escape'); await closed();
  await page.keyboard.press('g'); await page.keyboard.press('t');
  await page.waitForFunction(() => location.hash === '#/tasks', null, { timeout: 4000 });
  check(true, 'Shortcuts: "g" then "t" goes to Tasks');
  await page.keyboard.press('n');
  await page.getByRole('heading', { name: /New task/ }).waitFor({ timeout: 4000 });
  check(true, 'Shortcuts: "n" opens a new task');
  await page.keyboard.press('Escape'); await closed();
  await go('dashboard');
  await page.getByPlaceholder(/Add anything/).fill('');
  await page.getByPlaceholder(/Add anything/).pressSequentially('gtn?f');
  check((await page.getByPlaceholder(/Add anything/).inputValue()) === 'gtn?f' && (await page.evaluate(() => location.hash)) === '#/dashboard' && !(await page.locator('dialog[open]').count()),
    'Shortcuts: typing in a text box never triggers them');
  await page.getByPlaceholder(/Add anything/).fill('');

  // ---------------------------------------------------------------- CSV export (new looks)
  await go('settings');
  await page.getByRole('heading', { name: 'Export to a spreadsheet' }).waitFor();
  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('li', { hasText: 'Every task with its dates' }).getByRole('button', { name: 'Export .csv' }).click(),
  ]);
  const csvPath = await dl.path();
  const csv = fs.readFileSync(csvPath, 'utf8');
  check(/^LifeOS-tasks-\d{4}-\d{2}-\d{2}\.csv$/.test(dl.suggestedFilename()), 'CSV export: sensible file name', dl.suggestedFilename());
  check(csv.startsWith('\uFEFFTask,Done,Completed on,Due date') && csv.includes('Call mom,no,') && csv.includes('\r\n'), 'CSV export: header, a real task row and spreadsheet line ends');

  // ---------------------------------------------------------------- Nebula
  await setTheme('Nebula');
  check((await page.evaluate(() => document.documentElement.dataset.style)) === 'nebula', 'Nebula uses its own style');
  check(await page.getByRole('heading', { name: 'Reminders & notifications' }).isVisible(), 'New looks: Settings has Reminders & notifications');
  await go('dashboard');
  await page.getByRole('heading', { name: 'The year in light' }).waitFor();
  check(true, 'Nebula: "The year in light" on Home');
  check(await page.getByRole('heading', { name: 'Today, hour by hour' }).isVisible(), 'Nebula: the day timeline on Home');

  // ---------------------------------------------------------------- the original themes stay as they were
  await setTheme('Light');
  check((await page.evaluate(() => document.documentElement.dataset.style)) === 'aurora', 'Light keeps the original style');
  await page.getByRole('heading', { name: 'Reminders & notifications' }).waitFor({ state: 'detached', timeout: 8000 }).catch(() => {});
  check(!(await page.getByRole('heading', { name: 'Reminders & notifications' }).count()), 'Light: Settings unchanged (no notifications card)');
  await go('dashboard');
  check(!(await page.getByPlaceholder(/Add anything/).count()) && !(await page.locator('.gs').count()), 'Light: no quick capture or checklist on Home');
  check(!(await page.locator('.mast').isVisible()), 'Light: no masthead');
  check(!(await page.getByRole('link', { name: 'Close the day' }).count()), 'Light: navigation unchanged');
  await page.goto(`${base}#/close`);
  await page.waitForFunction(() => location.hash === '#/dashboard', null, { timeout: 5000 });
  check(true, 'Light: the new pages are not reachable');
  await page.keyboard.press('?');
  await page.keyboard.press('g'); await page.keyboard.press('t');
  await sleep(500);
  check(!(await page.locator('dialog[open]').count()) && (await page.evaluate(() => location.hash)) === '#/dashboard', 'Light: shortcuts do nothing');
  await go('settings');
  check(!(await page.getByRole('heading', { name: 'Export to a spreadsheet' }).count()), 'Light: Settings unchanged (no export card)');

  // ---------------------------------------------------------------- phone
  await setTheme('Nebula');
  await page.setViewportSize({ width: 360, height: 780 });
  for (const h of ['dashboard', 'close', 'seals']) {
    await go(h); await sleep(600);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(over <= 0, `Phone 360px: no horizontal scrolling on ${h} (Nebula)`, over > 0 ? `${over}px: ${await overflowers()}` : '0px');
  }
  await setTheme('Paper');
  for (const h of ['dashboard', 'close']) {
    await go(h); await sleep(600);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(over <= 0, `Phone 360px: no horizontal scrolling on ${h} (Paper)`, `${over}px`);
  }
} catch (e) {
  check(false, 'Flow threw', e.message.split('\n')[0]);
}

check(errors.length === 0, 'No console/page errors', errors.slice(0, 3).join(' | '));
await ctx.close();
console.log(failed ? `\n${failed} FAILED.` : '\nAll passed.');
process.exit(failed ? 1 : 0);
