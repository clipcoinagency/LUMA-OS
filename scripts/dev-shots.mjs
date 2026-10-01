// Dev helper: onboard a throwaway profile (optionally with 90 days of sample data), then screenshot
// routes in a chosen theme/viewport so design work can be checked without clicking around.
//   node scripts/dev-shots.mjs --url=http://localhost:5173 --theme=dark --view=desktop --out=<dir> \
//        --routes=dashboard,tasks,goals --sample=1
import { openApp, SIZES } from './lib/session.mjs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const url = arg('url', 'http://localhost:5173');
const theme = arg('theme', 'dark');
const view = arg('view', 'desktop');
const out = arg('out', path.join(os.tmpdir(), 'lifeos-shots'));
const routes = arg('routes', 'dashboard').split(',');
const sample = arg('sample', '1') === '1';
const channel = arg('channel', 'msedge');
const size = SIZES[view];
const full = arg('full', '1') === '1';
const wait = Number(arg('wait', '700'));
await fs.mkdir(out, { recursive: true });

const { ctx, page, errors } = await openApp({ url, theme, view, sample, channel, name: arg('name', '') });
for (const r of routes) {
  await page.goto(url + '#/' + r);
  await page.waitForTimeout(wait);
  const file = path.join(out, `${r.replace(/\//g, '_')}-${theme}-${view}.png`);
  await page.screenshot({ path: file, fullPage: full });
  console.log('shot', file);
}
if (errors.length) console.log('ERRORS:\n' + [...new Set(errors)].join('\n'));
await ctx.close();
