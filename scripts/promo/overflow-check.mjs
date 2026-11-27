// Finds pages that scroll sideways on a phone, and says which elements stick out.
// Usage: node scripts/promo/overflow-check.mjs <baseUrl> <themes> <hashes> [width]   e.g. http://localhost:5173/ Dark,Soft finance,finance:debts,finance:bills 360
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:5173/';
const THEMES = (process.argv[3] ?? 'Dark').split(',');
const PAGES = (process.argv[4] ?? 'dashboard,finance').split(',');
const WIDTH = Number(process.argv[5] ?? 360);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ channel: 'msedge' });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'light', locale: 'en-US', reducedMotion: 'reduce' });
const page = await ctx.newPage();
const clickText = (sel, src) => page.evaluate(([s, src]) => { const re = new RegExp(src); const el = [...document.querySelectorAll(s)].find((e) => re.test(e.textContent.trim()) && !e.disabled); el?.click(); return !!el; }, [sel, src]);

await page.goto(BASE);
await page.getByRole('button', { name: /Set up my workspace/ }).click(); await sleep(400);
await clickText('button, [role=radio]', '^Founder'); await sleep(300);
for (let i = 0; i < 7; i++) { if (!(await clickText('button', '^(Continue|Create workspace)$'))) break; await sleep(450); }
await clickText('button', 'Open my workspace'); await sleep(900);
await page.goto(BASE + '#/dev/data'); await page.getByRole('button', { name: /sample data/i }).click(); await sleep(6000);
await page.setViewportSize({ width: WIDTH, height: 780 });

let bad = 0;
for (const theme of THEMES) {
  await page.goto(BASE + '#/settings'); await page.locator('main h1').first().waitFor();
  await page.evaluate((l) => [...document.querySelectorAll('[role=radio]')].find((b) => b.querySelector('.name')?.textContent.trim() === l)?.click(), theme); await sleep(800);
  for (const p of PAGES) {
    const [hash, tab] = p.split(':');
    await page.goto(BASE + '#/' + hash); await page.locator('main h1').first().waitFor(); await sleep(900);
    if (tab) { await page.getByRole('radio', { name: new RegExp('^' + tab, 'i') }).click(); await sleep(700); }
    const r = await page.evaluate(() => {
      const over = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      const vw = document.documentElement.clientWidth;
      const out = [];
      if (over > 0) for (const el of document.querySelectorAll('body *')) { const b = el.getBoundingClientRect(); if (b.width > 0 && b.right > vw + 1) out.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} right=${Math.round(b.right)}`); }
      return { over, out: out.slice(0, 6) };
    });
    if (r.over > 0) bad++;
    console.log(`${theme.padEnd(8)} ${p.padEnd(16)} ${r.over > 0 ? 'OVERFLOW ' + r.over + 'px  ' + r.out.join(' | ') : 'ok'}`);
  }
}
await browser.close();
process.exit(bad ? 1 : 0);
