// Screenshots of the polish pass: Get started, shortcuts sheet, CSV export card, fixed Finance chip,
// fixed Insights chart. Usage: node scripts/promo/polish-preview.mjs <outDir>  (needs `npm run build`)
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

const OUT = path.resolve(process.argv[2]);
fs.mkdirSync(OUT, { recursive: true });
const html = fs.readFileSync('dist/index.html');
const server = http.createServer((_q, r) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(html); });
await new Promise((ok) => server.listen(47891, ok));
const URL = 'http://localhost:47891/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ channel: 'msedge' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5, colorScheme: 'light', locale: 'en-US' });
const page = await ctx.newPage();
const clickText = (sel, src) => page.evaluate(([s, src]) => { const re = new RegExp(src); const el = [...document.querySelectorAll(s)].find((e) => re.test(e.textContent.trim()) && !e.disabled); el?.click(); return !!el; }, [sel, src]);
const theme = async (label) => { await page.goto(URL + '#/settings'); await page.locator('main h1').first().waitFor(); await page.evaluate((l) => [...document.querySelectorAll('[role=radio]')].find((b) => b.querySelector('.name')?.textContent.trim() === l)?.click(), label); await sleep(700); };
const shot = async (name, hash, { scroll = 0 } = {}) => { await page.goto(URL + hash); await page.locator('main h1').first().waitFor(); await sleep(1800); await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), scroll); await sleep(500); await page.screenshot({ path: path.join(OUT, name) }); console.log('wrote', name); };

await page.goto(URL);
await page.getByRole('button', { name: /Set up my workspace/ }).click(); await sleep(400);
await clickText('button, [role=radio]', '^Founder'); await sleep(300);
for (let i = 0; i < 7; i++) { if (!(await clickText('button', '^(Continue|Create workspace)$'))) break; await sleep(450); }
await clickText('button', 'Open my workspace'); await sleep(900);
await theme('Nebula');
await shot('1-get-started-nebula.png', '#/dashboard', { scroll: 300 });
await theme('Paper');
await shot('2-get-started-paper.png', '#/dashboard', { scroll: 420 });

await page.goto(URL + '#/dev/data'); await page.getByRole('button', { name: /sample data/i }).click(); await sleep(6000);
await page.goto(URL + '#/settings'); const n = page.getByLabel(/name/i).first(); await n.fill('Alex'); await n.blur(); await sleep(500);
await theme('Nebula');
await page.goto(URL + '#/dashboard'); await page.locator('main h1').first().waitFor(); await sleep(1500);
await page.locator('body').click({ position: { x: 700, y: 8 } }).catch(() => {});
await page.keyboard.press('?'); await sleep(900); await page.screenshot({ path: path.join(OUT, '3-shortcuts-sheet-nebula.png') }); console.log('wrote 3-shortcuts-sheet-nebula.png');
await page.keyboard.press('Escape'); await sleep(400);
await page.goto(URL + '#/settings'); await page.getByRole('heading', { name: 'Export to a spreadsheet' }).scrollIntoViewIfNeeded(); await page.evaluate(() => window.scrollBy(0, -90)); await sleep(700);
await page.screenshot({ path: path.join(OUT, '4-csv-export-nebula.png') }); console.log('wrote 4-csv-export-nebula.png');
await shot('5-finance-nebula.png', '#/finance');
await theme('Paper');
await shot('6-insights-paper.png', '#/insights');
await shot('7-finance-paper.png', '#/finance');
await browser.close(); server.close();
