// Proves the chosen build stack (Svelte 5 + Vite + singlefile) runs from file:// in installed
// Edge/Chrome: renders, stays interactive, and keeps IndexedDB data across a full browser restart.
import { chromium } from 'playwright';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const url = pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'stack-check', 'dist', 'index.html')).href;
let failed = 0;
const check = (ok, name, detail = '') => { if (!ok) failed++; console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`); };

for (const channel of ['msedge', 'chrome']) {
  console.log(channel);
  const profile = path.join(os.tmpdir(), `lifeos-stack-${channel}-${Date.now()}`);
  const errors = [];
  for (const expected of [1, 2]) {
    const ctx = await chromium.launchPersistentContext(profile, { channel });
    const page = ctx.pages()[0];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(url);
    await page.waitForFunction(() => window.stackCheck, null, { timeout: 15000 });
    const sc = await page.evaluate(() => window.stackCheck);
    check(sc.ok && sc.launches === expected, `Svelte app renders + IndexedDB launch #${expected}`, JSON.stringify(sc));
    if (expected === 2) {
      const before = await page.$$eval('li', (l) => l.map((x) => x.textContent).join(','));
      await page.click('#rotate');
      await page.waitForTimeout(300);
      const after = await page.$$eval('li', (l) => l.map((x) => x.textContent).join(','));
      check(before !== after && after === 'Goals,Habits,Tasks', 'Interactive (reactivity + animate:flip)', after);
    }
    await ctx.close();
  }
  check(errors.length === 0, 'No console/page errors from file://', errors.join(' | '));
}
process.exitCode = failed ? 1 : 0;
