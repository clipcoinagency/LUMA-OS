// Runs the in-page "Run full self-test" button (what a tester taps on a phone) in installed Edge/Chrome.
import { chromium } from 'playwright';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const url = pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'web', 'index.html')).href;
let failed = 0;
for (const channel of ['msedge', 'chrome']) {
  const ctx = await chromium.launchPersistentContext(path.join(os.tmpdir(), `lifeos-selftest-${channel}-${Date.now()}`), { channel });
  const page = ctx.pages()[0];
  await page.goto(url);
  await page.waitForFunction(() => window.lifeosPocReady === true);
  await page.click('#btnSelfTest');
  await page.waitForFunction(() => /^selftest:/.test(document.body.dataset.lastOp || ''), null, { timeout: 60000 });
  const rows = await page.$$eval('#selfTestList li', (lis) => lis.map((li) => li.innerText.replace(/\s+/g, ' ')));
  console.log(`\n${channel}:`); rows.forEach((r) => console.log('  ' + r));
  failed += rows.filter((r) => /^fail/i.test(r)).length;
  await ctx.close();
}
process.exitCode = failed ? 1 : 0;
