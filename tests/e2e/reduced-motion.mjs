// Phase 7 e2e: reduced motion is actually honoured, not just declared. Svelte's fly/fade/flip
// transitions and the Tween-based progress ring run in JS and bypass CSS `prefers-reduced-motion`
// entirely unless every call is wrapped in dur() (src/lib/motion.ts) — this proves it, by reading
// back the configured animation duration (via the Web Animations API) with motion on vs off,
// under both the OS-level media query and the app's own "Reduce motion" setting.
import { chromium } from 'playwright';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const url = pathToFileURL(path.join(ROOT, 'dist', 'index.html')).href;
const channel = process.argv.find((a) => a.startsWith('--only='))?.slice(7) ?? 'msedge';

let failed = 0;
const check = (ok, name, detail = '') => { if (!ok) failed++; console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`); };
const errors = [];

async function onboardedPage(browser, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 }, ...opts });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url);
  await page.getByRole('button', { name: /Set up my workspace/ }).click();
  for (let i = 0; i < 5; i++) await page.getByRole('button', { name: /^(Continue|Create workspace)$/ }).click();
  await page.getByRole('button', { name: /Open my workspace/ }).click();
  await page.getByRole('heading', { level: 1, name: /^Good/ }).waitFor();
  return { ctx, page };
}

const dlg = (page) => page.locator('dialog[open]').last();
const closed = (page) => page.waitForFunction(() => !document.querySelector('dialog[open]'), null, { timeout: 5000 });

// Creates a task via the Add task modal, then completes it (fires the "Done" toast with an Undo
// action), and reads back the CONFIGURED duration of the toast's fly-in transition via the Web
// Animations API (element.getAnimations()). Svelte's css-returning transitions compile to
// element.animate(...) calls, which bypass CSS `prefers-reduced-motion` entirely — the duration
// passed to dur() at transition-start time is what's baked into the Animation's effect timing,
// so reading it back is a deterministic check, unlike polling computed opacity against a
// wall-clock budget (which is at the mercy of Playwright's own polling interval and any async
// IndexedDB/re-render latency between the click and the transition actually starting).
async function toastAnimationDurationMs(page) {
  const title = `Timing probe ${Date.now()}`;
  await page.getByRole('button', { name: 'Add task' }).first().click();
  await dlg(page).getByLabel('Task', { exact: true }).fill(title);
  await dlg(page).getByRole('button', { name: 'Add task' }).click();
  await closed(page);
  await page.getByText(title).waitFor();
  await page.getByRole('checkbox', { name: new RegExp(`Complete: ${title}`) }).click();
  const toast = page.locator('.toast').filter({ hasText: `Done: ${title}` });
  await toast.waitFor({ state: 'attached', timeout: 2000 });
  // DOM attachment and the fly-in's element.animate() call both happen during the toast's mount,
  // but not necessarily in the same tick under a loaded/slow runner — reading getAnimations()
  // right after 'attached' can catch it before animate() has actually run yet (real, observed
  // on GitHub's macOS runners; never locally). Poll for the Animation to actually exist first,
  // same "wait for the real condition, not a fixed instant" fix as Gotcha #6 elsewhere in this repo.
  await page.waitForFunction((sel) => (document.querySelector(sel)?.getAnimations().length ?? 0) > 0, '.toast', { timeout: 2000 }).catch(() => {});
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    const anims = el ? el.getAnimations() : [];
    const durations = anims.map((a) => a.effect.getTiming().duration);
    return durations.length ? Math.max(...durations.map(Number)) : 0;
  }, '.toast');
}

const browser = await chromium.launch({ channel });
console.log(`▶ ${channel}`);

// baseline: motion IS on by default — the toast should take a real, non-trivial amount of time
{
  const { ctx, page } = await onboardedPage(browser);
  await page.goto(url.split('#')[0] + '#/tasks');
  await page.reload();
  await page.locator('main h1').first().waitFor();
  const ms = await toastAnimationDurationMs(page);
  check(ms >= 100, 'Baseline (motion on): toast fly-in animates with a real duration, not zero', `${ms}ms`);
  await ctx.close();
}

// OS-level prefers-reduced-motion, emulated before the app ever loads
{
  const { ctx, page } = await onboardedPage(browser, { reducedMotion: 'reduce' });
  await page.goto(url.split('#')[0] + '#/tasks');
  await page.reload();
  await page.locator('main h1').first().waitFor();
  const ms = await toastAnimationDurationMs(page);
  check(ms === 0, 'OS-level prefers-reduced-motion: toast fly-in duration is zero', `${ms}ms`);
  await ctx.close();
}

// the app's own in-product "Reduce motion" toggle (Settings), independent of the OS setting
{
  const { ctx, page } = await onboardedPage(browser);
  await page.goto(url.split('#')[0] + '#/settings');
  await page.reload();
  await page.getByRole('heading', { name: 'Settings', level: 1 }).waitFor();
  await page.getByRole('switch', { name: 'Reduce motion' }).click();
  await page.waitForTimeout(150);
  check((await page.locator('html').getAttribute('data-reduce-motion')) === 'true', 'Settings toggle sets data-reduce-motion on <html>');
  await page.goto(url.split('#')[0] + '#/tasks');
  await page.reload();
  await page.locator('main h1').first().waitFor();
  const ms = await toastAnimationDurationMs(page);
  check(ms === 0, 'In-app "Reduce motion" setting: toast fly-in duration is zero (independent of the OS)', `${ms}ms`);

  // CSS-only motion (no JS transition directive) is also neutralized: a dashboard widget's
  // entrance animation and a hover/focus transition should report ~0 duration once computed.
  await page.goto(url.split('#')[0] + '#/dashboard');
  await page.reload();
  await page.getByRole('heading', { level: 1, name: /^Good/ }).waitFor();
  const anim = await page.evaluate(() => {
    const el = document.querySelector('.cell');
    if (!el) return null;
    const cs = getComputedStyle(el);
    return { duration: cs.animationDuration, delay: cs.animationDelay };
  });
  check(!!anim && anim.duration === '0.001s' && anim.delay === '0s', 'CSS entrance animation duration/delay neutralized under in-app reduced motion', JSON.stringify(anim));
  await ctx.close();
}

await browser.close();
check(errors.length === 0, 'No console/page errors', [...new Set(errors)].slice(0, 4).join(' | '));
console.log(`\n${failed ? `${failed} FAILED` : 'All passed'}.`);
process.exit(failed ? 1 : 0);
