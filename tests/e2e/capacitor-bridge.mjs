// Phase 8 e2e: proves the Capacitor packaging fix actually works, against the real built
// dist/index.html. The single-file build can't inline the native Filesystem/Share bridge (it's
// platform-specific glue, bundled separately by packaging/android's build step into a sibling
// dist/native-capacitor.js) — src/lib/platform/platform.ts's saveTextFile() has to dynamically
// load that script the first time a save is attempted on Capacitor. This test drops a stand-in
// bridge file next to the real dist/index.html, spoofs `window.Capacitor` the way the real
// Android WebView would expose it, and checks that a real "Back up now" click actually reaches
// the bridge — not the browser-download fallback.
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const url = pathToFileURL(path.join(ROOT, 'dist', 'index.html')).href;
const bridgePath = path.join(ROOT, 'dist', 'native-capacitor.js');
const channel = process.argv.find((a) => a.startsWith('--only='))?.slice(7) ?? 'msedge';

let failed = 0;
const check = (ok, name, detail = '') => { if (!ok) failed++; console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`); };
const errors = [];

// Stand-in for packaging/android/bridge-src.js's esbuild output: records what it was asked to
// save instead of actually touching the filesystem/share sheet (this test only needs to prove
// platform.ts finds and calls it, not that Capacitor's own native plugins work).
const stubBridge = `window.LifeOSNative = {
  saveTextFile: async (name, text) => {
    window.__bridgeCalls = window.__bridgeCalls || [];
    window.__bridgeCalls.push({ name, text });
    return { ok: true, via: 'stub-android-share-sheet', where: 'test' };
  },
};`;

console.log(`▶ ${channel}`);
await fs.writeFile(bridgePath, stubBridge, 'utf8');

const browser = await chromium.launch({ channel });
const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
// Spoof the Capacitor global the way the real Android WebView injects it, before any app script runs.
await page.addInitScript(() => { window.Capacitor = { getPlatform: () => 'android' }; });

await page.goto(url);
await page.getByRole('button', { name: /Set up my workspace/ }).click();
for (let i = 0; i < 4; i++) await page.getByRole('button', { name: /^(Continue|Create workspace)$/ }).click();
await page.getByRole('button', { name: /Open my workspace/ }).click();
await page.getByRole('heading', { level: 1, name: /^Good/ }).waitFor();

check(await page.evaluate(() => window.Capacitor?.getPlatform?.() === 'android'), 'window.Capacitor is present (simulating the Android WebView)');
check(!(await page.evaluate(() => 'LifeOSNative' in window)), 'window.LifeOSNative is NOT yet defined (bridge not loaded until a save is attempted)');

await page.goto(url.split('#')[0] + '#/settings');
await page.reload();
await page.getByRole('heading', { name: 'Settings', level: 1 }).waitFor();
check((await page.getByText('Android app').count()) > 0, 'Settings "Running as" correctly reads the spoofed platform as Android app');

await page.getByRole('button', { name: 'Back up now' }).click();
await page.waitForFunction(() => (window.__bridgeCalls?.length ?? 0) > 0, null, { timeout: 5000 }).catch(() => {});
const calls = await page.evaluate(() => window.__bridgeCalls ?? []);
check(calls.length === 1, 'saveTextFile dynamically loaded native-capacitor.js and called window.LifeOSNative exactly once', JSON.stringify(calls.map((c) => c.name)));
check(!!calls[0] && /^LifeOS-Backup-\d{4}-\d{2}-\d{2}\.json$/.test(calls[0].name), 'The bridge received a correctly-named backup file', calls[0]?.name);
check(!!calls[0] && calls[0].text.includes('"format":"lifeos-backup"'), 'The bridge received real backup JSON, not an empty payload');
check(await page.evaluate(() => 'LifeOSNative' in window), 'window.LifeOSNative is now defined after the dynamic load');

// A second save must reuse the already-loaded bridge rather than injecting the <script> again.
await page.getByRole('button', { name: 'Back up now' }).click();
await page.waitForFunction(() => (window.__bridgeCalls?.length ?? 0) > 1, null, { timeout: 5000 }).catch(() => {});
const scriptTags = await page.evaluate(() => document.querySelectorAll('script[src="native-capacitor.js"]').length);
check(scriptTags === 1, 'The bridge script is only injected once across repeated saves, not re-loaded each time', String(scriptTags));

await browser.close();
await fs.rm(bridgePath, { force: true });
check(errors.length === 0, 'No console/page errors', [...new Set(errors)].slice(0, 4).join(' | '));
console.log(`\n${failed ? `${failed} FAILED` : 'All passed'}.`);
process.exit(failed ? 1 : 0);
