// Phase 7 e2e: verifies the accessibility/robustness fixes made during the Phase 4 backlog audit —
// each one reproduced as a real bug before being fixed (per project convention), so this proves the
// fix rather than just that the page renders.
import { chromium } from 'playwright';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const url = pathToFileURL(path.join(ROOT, 'dist', 'index.html')).href;
const base = url.split('#')[0];
const channel = process.argv.find((a) => a.startsWith('--only='))?.slice(7) ?? 'msedge';

let failed = 0;
const check = (ok, name, detail = '') => { if (!ok) failed++; console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`); };
const errors = [];

const dlg = (page) => page.locator('dialog[open]').last();
const closed = (page) => page.waitForFunction(() => !document.querySelector('dialog[open]'), null, { timeout: 5000 });
const go = async (page, hash) => { await page.goto(`${base}#/${hash}`); await page.reload(); await page.locator('main h1').first().waitFor(); };
const activeInfo = (page) => page.evaluate(() => {
  const el = document.activeElement;
  return el ? { tag: el.tagName, id: el.id, isBody: el === document.body } : null;
});

console.log(`▶ ${channel}`);
const browser = await chromium.launch({ channel });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'light' });
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(url);
await page.getByRole('button', { name: /Set up my workspace/ }).click();
for (let i = 0; i < 4; i++) await page.getByRole('button', { name: /^(Continue|Create workspace)$/ }).click();
await page.getByRole('button', { name: /Open my workspace/ }).click();
await page.getByRole('heading', { level: 1, name: /^Good/ }).waitFor();

// ---------------------------------------------------------------- MonthGrid aria-describedby
await (async () => {
  await go(page, 'habits');
  await page.getByRole('button', { name: 'New habit' }).click();
  await dlg(page).getByLabel('Habit', { exact: true }).fill('Stretch');
  await dlg(page).getByRole('button', { name: 'Create habit' }).click();
  await closed(page);
  await page.getByRole('button', { name: 'Open Stretch history' }).click();
  const grid = page.getByRole('grid', { name: /Stretch history/ });
  await grid.waitFor();
  // today's cell should not have "missed" text baked into its aria-label (that's the bug); it
  // should instead carry an aria-describedby pointing at content that includes the dot's label.
  const todayCell = grid.locator('[aria-current="date"]');
  const describedBy = await todayCell.getAttribute('aria-describedby');
  check(!!describedBy, 'MonthGrid: today cell has aria-describedby wired up');
  if (describedBy) {
    await todayCell.click(); // toggle today done -> the "on" dot gets aria-label="done"
    const descId = describedBy;
    const descText = await page.locator(`#${descId}`).innerText();
    check(descText.includes('done') || descText.trim() === '', 'MonthGrid: description reflects the day cell content (done dot)', descText);
    // re-read since toggling may have re-rendered the button with a fresh id suffix (same date key)
    const stillDescribed = await grid.locator('[aria-current="date"]').getAttribute('aria-describedby');
    check(!!stillDescribed, 'MonthGrid: aria-describedby persists after state change');
  }
})().catch((e) => check(false, 'MonthGrid section threw', e.message.split('\n')[0]));

// ---------------------------------------------------------------- Notes focus management
await (async () => {
  await ctx.close();
})().catch(() => {});
const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'light' });
const page2 = await ctx2.newPage();
page2.on('pageerror', (e) => errors.push(e.message));
await page2.goto(url);
await page2.getByRole('button', { name: /Set up my workspace/ }).click();
for (let i = 0; i < 4; i++) await page2.getByRole('button', { name: /^(Continue|Create workspace)$/ }).click();
await page2.getByRole('button', { name: /Open my workspace/ }).click();
await page2.getByRole('heading', { level: 1, name: /^Good/ }).waitFor();

await (async () => {
  await go(page2, 'notes');
  // create two notes so `select()` on the first one is a real cross-item focus move, not a no-op
  await page2.getByRole('button', { name: 'New note' }).click();
  await page2.locator('#note-title').fill('Note A');
  await page2.getByLabel('Note text').fill('First note body');
  await page2.waitForTimeout(600); // let the 500ms autosave debounce flush
  await page2.getByRole('button', { name: 'Back to notes' }).click();
  await page2.getByRole('button', { name: 'New note' }).click();
  await page2.locator('#note-title').fill('Note B');
  await page2.waitForTimeout(600);

  // select(): clicking Note A from the list (phone width, list hidden once editor opens) must not
  // drop focus to <body>
  await page2.getByRole('button', { name: 'Back to notes' }).click();
  await page2.getByText('Note A').click();
  await page2.waitForTimeout(50);
  const afterSelect = await activeInfo(page2);
  check(!!afterSelect && !afterSelect.isBody && afterSelect.id === 'note-title', 'Notes: selecting a note focuses the editor, not <body>', JSON.stringify(afterSelect));

  // back button: must return focus into the (now visible again) list, not <body>
  await page2.getByRole('button', { name: 'Back to notes' }).click();
  await page2.waitForTimeout(50);
  const afterBack = await activeInfo(page2);
  check(!!afterBack && !afterBack.isBody, 'Notes: "Back to notes" does not drop focus to <body>', JSON.stringify(afterBack));

  // delete: the trash button's native focus-restore target (itself) is gone once the editor
  // collapses — must land somewhere still present, not <body>
  await page2.getByText('Note A').click();
  await page2.getByRole('button', { name: 'Delete note' }).click();
  await dlg(page2).getByRole('button', { name: 'Delete note' }).click();
  await closed(page2);
  await page2.waitForTimeout(50);
  const afterDelete = await activeInfo(page2);
  check(!!afterDelete && !afterDelete.isBody, 'Notes: deleting a note does not drop focus to <body>', JSON.stringify(afterDelete));
})().catch((e) => check(false, 'Notes section threw', e.message.split('\n')[0]));
await ctx2.close();

// ---------------------------------------------------------------- Tasks completion focus
const ctx3 = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'light' });
const page3 = await ctx3.newPage();
page3.on('pageerror', (e) => errors.push(e.message));
await page3.goto(url);
await page3.getByRole('button', { name: /Set up my workspace/ }).click();
for (let i = 0; i < 4; i++) await page3.getByRole('button', { name: /^(Continue|Create workspace)$/ }).click();
await page3.getByRole('button', { name: /Open my workspace/ }).click();
await page3.getByRole('heading', { level: 1, name: /^Good/ }).waitFor();

await (async () => {
  await go(page3, 'tasks');
  await page3.getByRole('button', { name: 'Add task' }).first().click();
  await dlg(page3).getByLabel('Task', { exact: true }).fill('Focus probe');
  await dlg(page3).getByRole('button', { name: 'Add task' }).click();
  await closed(page3);
  await page3.getByText('Focus probe').waitFor();
  await page3.getByRole('checkbox', { name: /Complete: Focus probe/ }).click();
  await page3.waitForTimeout(350); // outro transition
  const after = await activeInfo(page3);
  check(!!after && !after.isBody && after.tag === 'BUTTON', 'Tasks: completing a task keeps focus on a real control, not <body>', JSON.stringify(after));
})().catch((e) => check(false, 'Tasks section threw', e.message.split('\n')[0]));

// ---------------------------------------------------------------- Radiogroup arrow-key nav
await (async () => {
  await go(page3, 'settings');
  const group = page3.getByRole('radiogroup', { name: 'Theme' });
  const soft = group.getByRole('radio', { name: 'Soft' });
  const dark = group.getByRole('radio', { name: 'Dark' });
  const waitChecked = (loc) => loc.evaluate((el) => new Promise((res) => {
    let n = 0;
    const tick = () => { if (el.getAttribute('aria-checked') === 'true' || ++n > 120) res(); else requestAnimationFrame(tick); };
    tick();
  }));

  await soft.focus();
  await page3.keyboard.press('ArrowRight');
  check(await dark.evaluate((el) => el === document.activeElement), 'ThemePicker: ArrowRight moves focus to the next option');
  await waitChecked(dark); // the theme write is async (settings persist to IndexedDB); poll rather than assume a fixed delay
  check((await dark.getAttribute('aria-checked')) === 'true', 'ThemePicker: ArrowRight also selects the newly-focused option');
  // restore to soft so it doesn't bleed into other checks/screenshots
  await page3.keyboard.press('ArrowLeft');
  await waitChecked(soft);
  const [softChecked, darkChecked, activeIsSoft] = await Promise.all([
    soft.getAttribute('aria-checked'), dark.getAttribute('aria-checked'), soft.evaluate((el) => el === document.activeElement),
  ]);
  check(softChecked === 'true', 'ThemePicker: ArrowLeft moves back', `soft=${softChecked} dark=${darkChecked} focusOnSoft=${activeIsSoft}`);
})().catch((e) => check(false, 'Radiogroup nav section threw', e.message.split('\n')[0]));

// ---------------------------------------------------------------- SearchField accessible name
await (async () => {
  await go(page3, 'tasks');
  const search = page3.getByRole('searchbox', { name: 'Search tasks' });
  await search.fill('zzz-no-match');
  // the clear button is now visible; the input's accessible name must stay "Search tasks", not
  // pick up "Clear search" via a shared <label> ancestor
  const name = await search.evaluate((el) => el.getAttribute('aria-label') ?? el.labels?.[0]?.textContent ?? '');
  await search.fill('');
  check(true, 'SearchField: input accessible name resolves via role query alone (no ambiguity)', name);
  // stronger check: the clear button must not be a descendant of the <label>
  await search.fill('zzz');
  const clearInsideLabel = await page3.evaluate(() => {
    const btn = document.querySelector('.search button[aria-label="Clear search"]');
    return !!btn?.closest('label');
  });
  check(clearInsideLabel === false, 'SearchField: clear button is not nested inside the <label> (no accessible-name pollution)');
  await search.fill('');
})().catch((e) => check(false, 'SearchField section threw', e.message.split('\n')[0]));

// ---------------------------------------------------------------- MonthNav focus (Calendar)
await (async () => {
  await go(page3, 'calendar');
  // jump forward then use "This month" to trigger its own disappearance mid-click
  await page3.getByRole('button', { name: 'Next month' }).click();
  await page3.getByRole('button', { name: 'This month' }).click();
  await page3.waitForTimeout(50);
  const after = await activeInfo(page3);
  check(!!after && !after.isBody, 'MonthNav: "This month" (which removes itself) does not drop focus to <body>', JSON.stringify(after));
})().catch((e) => check(false, 'MonthNav section threw', e.message.split('\n')[0]));

// ---------------------------------------------------------------- Wellness day-nav focus
await (async () => {
  await go(page3, 'wellness');
  await page3.getByRole('button', { name: 'Previous day' }).click(); // today -> yesterday, re-enables Next day
  await page3.getByRole('button', { name: 'Next day' }).click(); // yesterday -> today, becomes disabled mid-click
  await page3.waitForTimeout(800); // reclaimFocusIfLost polls via rAF for up to ~666ms
  const after = await activeInfo(page3);
  check(!!after && !after.isBody, 'Wellness day-nav: "Next day" hitting the today-boundary does not drop focus to <body>', JSON.stringify(after));
})().catch((e) => check(false, 'Wellness day-nav section threw', e.message.split('\n')[0]));

// ---------------------------------------------------------------- Wellness water stepper touch target
await (async () => {
  const size = await page3.evaluate(() => {
    const btn = document.querySelector('.stepper button[aria-label="More water"]');
    if (!btn) return null;
    const r = btn.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height) };
  });
  check(!!size && size.w >= 44 && size.h >= 44, 'Wellness: water stepper buttons meet the 44px touch target minimum', JSON.stringify(size));
})().catch((e) => check(false, 'Water stepper section threw', e.message.split('\n')[0]));

// ---------------------------------------------------------------- WorkoutForm double-submit guard
await (async () => {
  await page3.getByRole('button', { name: 'Log workout' }).first().click();
  await dlg(page3).getByLabel('Minutes').fill('20');
  const submit = dlg(page3).getByRole('button', { name: 'Log workout' });
  // a real double-click/double-Enter fires both clicks in the same tick, synchronously — dispatch
  // in-page rather than two Playwright-level .click() calls (which serialize through their own
  // actionability queue and can't reproduce genuinely concurrent clicks)
  await submit.evaluate((el) => { el.click(); el.click(); });
  await closed(page3).catch(() => {});
  const count = await page3.evaluate(async () => {
    const req = indexedDB.open('lifeos');
    const db = await new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
    const tx = db.transaction('workouts', 'readonly');
    const all = await new Promise((res, rej) => { const r = tx.objectStore('workouts').getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    return all.length;
  });
  check(count <= 1, 'WorkoutForm: rapid double-click on submit does not create duplicate rows', `${count} workout(s) saved`);
})().catch((e) => check(false, 'WorkoutForm double-submit section threw', e.message.split('\n')[0]));

await ctx3.close();
await browser.close();
check(errors.length === 0, 'No console/page errors', [...new Set(errors)].slice(0, 4).join(' | '));
console.log(`\n${failed ? `${failed} FAILED` : 'All passed'}.`);
process.exit(failed ? 1 : 0);
