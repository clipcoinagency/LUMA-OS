// Bug tour of the new looks: every page + the main dialogs/pickers in Paper, Night Ink and Nebula, on
// desktop and phone. Collects console/page errors and horizontal overflow, saves screenshots.
// Usage: node scripts/promo/_bugtour.mjs <outDir>
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

const OUT = path.resolve(process.argv[2] ?? 'bugtour');
fs.mkdirSync(OUT, { recursive: true });
const html = fs.readFileSync('dist/index.html');
const server = http.createServer((_q, r) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(html); });
await new Promise((ok) => server.listen(47881, ok));
const URL = 'http://localhost:47881/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const issues = [];
const browser = await chromium.launch({ channel: 'msedge' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
const page = await ctx.newPage();
let where = 'start';
page.on('pageerror', (e) => issues.push(`[pageerror @ ${where}] ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') issues.push(`[console @ ${where}] ${m.text()}`); });

const clickText = (sel, src) => page.evaluate(([s, src]) => { const re = new RegExp(src); const el = [...document.querySelectorAll(s)].find((e) => re.test(e.textContent.trim()) && !e.disabled); el?.click(); return !!el; }, [sel, src]);
async function setup() {
  await page.goto(URL);
  await page.getByRole('button', { name: /Set up my workspace/ }).click(); await sleep(400);
  await clickText('button, [role=radio]', '^Founder'); await sleep(300);
  await clickText('button', '^Continue$'); await sleep(400);
  await page.evaluate(() => { for (const name of ['Study & Read', 'Work']) { const el = [...document.querySelectorAll('[aria-checked]')].find((e) => (e.closest('label,button,[role]')?.textContent || '').trim().startsWith(name)); if (el && el.getAttribute('aria-checked') === 'false') el.click(); } });
  for (let i = 0; i < 6; i++) { if (!(await clickText('button', '^(Continue|Create workspace)$'))) break; await sleep(450); }
  await clickText('button', 'Open my workspace'); await sleep(800);
  await page.goto(URL + '#/dev/data'); await page.getByRole('button', { name: /sample data/i }).click(); await sleep(6000);
  await page.goto(URL + '#/settings'); await page.locator('main h1').first().waitFor();
  const n = page.getByLabel(/name/i).first(); await n.fill('Alex'); await n.blur(); await sleep(400);
}
async function theme(label) {
  await page.goto(URL + '#/settings'); await page.locator('main h1').first().waitFor();
  await page.evaluate((l) => [...document.querySelectorAll('[role=radio]')].find((b) => b.querySelector('.name')?.textContent.trim() === l)?.click(), label);
  await page.locator('[role=radio][aria-checked=true]', { has: page.locator('.name', { hasText: new RegExp('^' + label + '$') }) }).waitFor();
}
async function overflow(tag) {
  const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (o > 0) issues.push(`[overflow ${o}px @ ${tag}]`);
}
async function snap(name) { await sleep(900); await page.screenshot({ path: path.join(OUT, `${name}.png`) }); }

await setup();
const ROUTES = ['dashboard', 'tasks', 'calendar', 'goals', 'habits', 'study', 'work', 'finance', 'wellness', 'notes', 'insights', 'reset', 'close', 'seals', 'settings'];
for (const [label, slug] of [['Paper', 'paper'], ['Night Ink', 'ink'], ['Nebula', 'nebula']]) {
  for (const [vw, vh, dev] of [[1440, 900, 'desk'], [390, 844, 'phone']]) {
    await page.setViewportSize({ width: vw, height: vh });
    await theme(label);
    for (const r of ROUTES) {
      where = `${slug}/${dev}/${r}`;
      await page.goto(URL + '#/' + r); await page.locator('main h1').first().waitFor({ timeout: 8000 }).catch(() => issues.push(`[no h1 @ ${where}]`));
      await sleep(700); await overflow(where);
      if (dev === 'desk' || ['dashboard', 'close', 'seals', 'calendar', 'finance'].includes(r)) await snap(`${slug}-${dev}-${r}`);
    }
    // dialogs and pickers
    where = `${slug}/${dev}/new-task`;
    await page.goto(URL + '#/tasks'); await page.locator('main h1').first().waitFor(); await sleep(500);
    await page.getByRole('button', { name: /^(Add task|New task)$/ }).first().click().catch(() => issues.push(`[no Add task @ ${where}]`));
    await sleep(600); await snap(`${slug}-${dev}-task-form`);
    const cal = page.locator('dialog[open]').getByRole('button', { name: 'Open calendar' }).first();
    if (await cal.count()) { await cal.click(); await snap(`${slug}-${dev}-date-picker`); await page.keyboard.press('Escape'); await sleep(300); }
    const tim = page.locator('dialog[open]').getByRole('button', { name: /Open time|time picker|Pick a time/i }).first();
    if (await tim.count()) { await tim.click(); await snap(`${slug}-${dev}-time-picker`); await page.keyboard.press('Escape'); await sleep(300); }
    await page.keyboard.press('Escape'); await sleep(400);
    where = `${slug}/${dev}/create`;
    await page.goto(URL + '#/dashboard'); await page.locator('main h1').first().waitFor(); await sleep(500);
    await page.getByRole('button', { name: 'New', exact: true }).first().click().catch(() => {}); await snap(`${slug}-${dev}-create-sheet`); await page.keyboard.press('Escape'); await sleep(300);
    where = `${slug}/${dev}/palette`;
    if (dev === 'desk') { await page.keyboard.press('Control+k'); await snap(`${slug}-${dev}-palette`); await page.keyboard.press('Escape'); await sleep(300); }
    where = `${slug}/${dev}/focus`;
    await page.getByRole('button', { name: /Start focus/ }).first().click().catch(() => {}); await snap(`${slug}-${dev}-focus`); await page.keyboard.press('Escape'); await sleep(400);
    where = `${slug}/${dev}/breathe`;
    await page.getByRole('button', { name: /^Breathe/ }).click().catch(() => {}); await snap(`${slug}-${dev}-breathe`); await page.keyboard.press('Escape'); await sleep(300);
  }
}
fs.writeFileSync(path.join(OUT, 'issues.txt'), issues.join('\n') || 'none');
console.log(issues.length ? issues.join('\n') : 'no issues');
await browser.close(); server.close();
