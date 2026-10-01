// Dev helper: a throwaway, onboarded Life OS profile in a real browser (optionally with 90 days of
// sample data) for design checks and ad-hoc scripts.
import { chromium } from 'playwright';
import os from 'node:os';
import path from 'node:path';

export const SIZES = { desktop: { width: 1440, height: 900 }, tablet: { width: 820, height: 1100 }, mobile: { width: 390, height: 844 } };

export async function openApp({ url = 'http://localhost:5173', theme = 'dark', view = 'desktop', sample = true, channel = 'msedge', name = '' } = {}) {
  const size = SIZES[view];
  const profile = path.join(os.tmpdir(), `lifeos-dev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
  const ctx = await chromium.launchPersistentContext(profile, {
    channel, viewport: size, deviceScaleFactor: view === 'mobile' ? 2 : 1, colorScheme: theme === 'dark' ? 'dark' : 'light', locale: 'en-US',
    hasTouch: view === 'mobile', isMobile: view === 'mobile',
  });
  const page = ctx.pages()[0];
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(url);
  await page.getByRole('button', { name: /Set up my workspace/ }).click();
  await page.getByRole('button', { name: /^Continue$/ }).click();
  await page.getByRole('radio', { name: new RegExp(theme === 'dark' ? 'Dark' : 'Soft') }).click();
  if (name) { await page.getByRole('button', { name: /^Continue$/ }).click(); await page.getByLabel(/What should we call you/).fill(name); await page.getByRole('button', { name: /^Continue$/ }).click(); }
  else { await page.getByRole('button', { name: /^Continue$/ }).click(); await page.getByRole('button', { name: /^Continue$/ }).click(); }
  await page.getByRole('button', { name: /^(Continue|Create workspace)$/ }).click();
  await page.getByRole('button', { name: /Open my workspace/ }).click();
  await page.getByRole('heading', { level: 1 }).first().waitFor();
  if (sample) {
    await page.goto(url + '#/dev/data');
    await page.getByRole('button', { name: /Add 90 days of sample data/ }).click();
    await page.getByText(/Added sample history/).waitFor();
    await page.goto(url + '#/dashboard');
  }
  return { ctx, page, errors, url, profile };
}
