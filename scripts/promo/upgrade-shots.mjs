// Screenshots for the upgrade pass. Usage: node scripts/promo/upgrade-shots.mjs <outDir> [baseUrl] [themes] [pages]
//   themes: comma list of theme names (Soft,Light,Dark,Paper,Night Ink,Nebula)  pages: comma list of shot ids
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve(process.argv[2] ?? 'shots');
const BASE = process.argv[3] ?? 'http://localhost:5173/';
const THEMES = (process.argv[4] ?? 'Dark').split(',');
const ONLY = process.argv[5] ? process.argv[5].split(',') : null;
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ channel: 'msedge' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light', locale: 'en-US', reducedMotion: 'reduce' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
const clickText = (sel, src) => page.evaluate(([s, src]) => { const re = new RegExp(src); const el = [...document.querySelectorAll(s)].find((e) => re.test(e.textContent.trim()) && !e.disabled); el?.click(); return !!el; }, [sel, src]);

await page.goto(BASE);
await page.getByRole('button', { name: /Set up my workspace/ }).click(); await sleep(400);
await clickText('button, [role=radio]', '^Founder'); await sleep(300);
for (let i = 0; i < 7; i++) { if (!(await clickText('button', '^(Continue|Create workspace)$'))) break; await sleep(450); }
await clickText('button', 'Open my workspace'); await sleep(900);
await page.goto(BASE + '#/dev/data'); await page.getByRole('button', { name: /sample data/i }).click(); await sleep(6000);
await page.goto(BASE + '#/settings'); const n = page.getByLabel(/name/i).first(); await n.fill('Alex'); await n.blur(); await sleep(500);

const setTheme = async (label) => { await page.goto(BASE + '#/settings'); await page.locator('main h1').first().waitFor(); await page.evaluate((l) => [...document.querySelectorAll('[role=radio]')].find((b) => b.querySelector('.name')?.textContent.trim() === l)?.click(), label); await sleep(800); };
const shot = async (theme, id, fn, { full = false } = {}) => {
  if (ONLY && !ONLY.includes(id)) return;
  await fn(); await sleep(1500);
  const file = path.join(OUT, `${theme.replace(/\s+/g, '')}-${id}.png`);
  await page.screenshot({ path: file, fullPage: full }); console.log('wrote', path.basename(file));
};
const goto = async (hash) => { await page.goto(BASE + hash); await page.locator('main h1').first().waitFor(); await sleep(1200); };

for (const theme of THEMES) {
  await setTheme(theme);
  await shot(theme, 'home', () => goto('#/dashboard'), { full: true });
  await shot(theme, 'finance', () => goto('#/finance'), { full: true });
  await shot(theme, 'debts', async () => { await goto('#/finance'); await page.getByRole('radio', { name: 'Debts' }).click(); await sleep(800); }, { full: true });
  await shot(theme, 'debt-form', async () => { await goto('#/finance'); await page.getByRole('radio', { name: 'Debts' }).click(); await sleep(500); await page.getByRole('button', { name: 'Add debt' }).first().click(); await sleep(700); });
  await page.keyboard.press('Escape'); await sleep(400);
  await shot(theme, 'debt-pay', async () => { await goto('#/finance'); await page.getByRole('radio', { name: 'Debts' }).click(); await sleep(500); await page.getByRole('button', { name: /^(Pay|Received)$/ }).first().click(); await sleep(700); });
  await page.keyboard.press('Escape');
}
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console/page errors');
await browser.close();
