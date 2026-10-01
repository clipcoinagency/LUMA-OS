// Study & Read e2e on the BUILT file from file://: Reader persona → Library (add books, log pages,
// finish, highlight, streak, yearly goal) → Flashcards (deck, add + paste cards, review session with
// keyboard, scheduling persists) → Home widget + briefing → survives a reload → no console errors.
import { chromium } from 'playwright';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const url = pathToFileURL(path.join(ROOT, 'dist', 'index.html')).href;
const channel = process.argv.find((a) => a.startsWith('--only='))?.slice(7) ?? 'msedge';
const SHOTS = process.env.LIFEOS_SHOTS ?? path.join(ROOT, 'tests', 'e2e', 'screenshots');
await fs.mkdir(SHOTS, { recursive: true });
const shotTheme = process.env.LIFEOS_THEME ?? 'dark';

let failed = 0;
const check = (ok, name, detail = '') => { if (!ok) failed++; console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`); };
const errors = [];

console.log(`▶ ${channel}`);
const profile = path.join(os.tmpdir(), `lifeos-study-${channel}-${Date.now()}`);
const ctx = await chromium.launchPersistentContext(profile, { channel, viewport: { width: 1360, height: 900 }, colorScheme: shotTheme === 'dark' ? 'dark' : 'light', locale: 'en-US' });
const page = ctx.pages()[0];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(url);
const dlg = () => page.locator('dialog[open]').last();
const closed = () => page.waitForFunction(() => !document.querySelector('dialog[open]'), null, { timeout: 8000 });
const nextBtn = (n = 'Continue') => page.getByRole('button', { name: n, exact: true });

// ---------------------------------------------------------------- onboarding as a reader
await page.getByRole('button', { name: /Set up my workspace/ }).click();
await page.getByRole('heading', { name: 'Where would you like to start?' }).waitFor();
await page.getByRole('radio', { name: /Reader & learner/ }).click();
await nextBtn().click();
await page.getByRole('heading', { name: 'Fine-tune your areas' }).waitFor();
check((await page.getByRole('checkbox', { name: /^Study & Read/ }).getAttribute('aria-checked')) === 'true', 'Reader & learner turns Study & Read on');
await nextBtn().click();
await page.getByRole('radio', { name: new RegExp('^' + shotTheme[0].toUpperCase() + shotTheme.slice(1)) }).click();
await nextBtn().click();
await page.getByLabel('What should we call you?').fill('Sam');
await nextBtn().click();
await nextBtn('Create workspace').click();
await page.getByRole('button', { name: /Open my workspace/ }).click();
await page.getByRole('heading', { level: 1, name: /, Sam$/ }).waitFor();
const links = await page.locator('aside.sidebar nav a').allInnerTexts();
check(links.some((l) => l.trim() === 'Study & Read'), 'Navigation shows "Study & Read"', links.map((s) => s.trim()).join(' | '));
check(await page.getByRole('region', { name: 'Reading now', exact: true }).isVisible(), 'Home has a "Reading now" widget');

// ---------------------------------------------------------------- library
await page.locator('aside.sidebar nav').getByRole('link', { name: 'Study & Read' }).click();
await page.getByRole('heading', { level: 1, name: 'Study & Read' }).waitFor();
check(await page.getByRole('radio', { name: 'Library' }).isVisible() && await page.getByRole('radio', { name: 'Flashcards' }).isVisible() && await page.getByRole('radio', { name: 'Subjects' }).isVisible(), 'Study & Read has Subjects, Library and Flashcards tabs');
await page.getByRole('radio', { name: 'Library' }).click();
check(await page.getByText('Your library is empty').isVisible(), 'An empty library invites the first book');

async function addBook(title, author, total, status = 'Reading') {
  await page.getByRole('button', { name: /Add (your first )?book/ }).first().click();
  await dlg().getByLabel('Title').fill(title);
  await dlg().getByLabel('Author (optional)').fill(author);
  if (total) await dlg().getByLabel('Total pages').fill(String(total));
  await dlg().getByRole('radio', { name: status, exact: true }).click();
  await dlg().getByRole('button', { name: 'Add', exact: true }).click();
  await closed();
}
await addBook('Atomic Habits', 'James Clear', 320);
await page.getByRole('button', { name: /^Atomic Habits/ }).waitFor();
check(true, 'A new book appears on the shelf');
await addBook('The Pragmatic Programmer', 'Hunt & Thomas', 352, 'Want to read');
await addBook('Meditations', 'Marcus Aurelius', 0, 'Reading');
check((await page.getByRole('radio', { name: /^Reading \(2\)/ }).count()) === 1, 'Filter counts reflect the shelf (Reading 2)');
await page.getByRole('radio', { name: /^All \(3\)/ }).click();
check((await page.getByRole('list', { name: 'Books' }).getByRole('listitem').count()) === 3, 'All shows three books');
await page.getByRole('searchbox', { name: 'Search library' }).fill('pragmatic');
check((await page.getByRole('list', { name: 'Books' }).getByRole('listitem').count()) === 1, 'Search narrows the shelf');
await page.getByRole('searchbox', { name: 'Search library' }).fill('');
await page.screenshot({ path: path.join(SHOTS, `study-library-${shotTheme}.png`) });

// log pages
await page.getByRole('button', { name: /^Atomic Habits/ }).click();
check(await dlg().getByText('0 / 320 pages').isVisible(), 'Book detail shows 0 / 320 pages');
await dlg().getByRole('button', { name: '+25' }).click();
await dlg().getByText('25 / 320 pages').waitFor();
await dlg().getByLabel('Pages read', { exact: true }).fill('15');
await dlg().getByRole('button', { name: 'Log', exact: true }).click();
await dlg().getByText('40 / 320 pages').waitFor();
check(true, 'Logging pages updates progress (25 + 15 = 40)');
await dlg().getByLabel('I am on page').fill('100');
await dlg().getByRole('button', { name: 'Set', exact: true }).click();
await dlg().getByText('100 / 320 pages').waitFor();
check(true, 'Jumping to page 100 updates progress');
// highlight + rating
await dlg().getByLabel('A line worth keeping').fill('You do not rise to the level of your goals.');
await dlg().getByLabel('Page', { exact: true }).fill('27');
await dlg().getByRole('button', { name: 'Save highlight' }).click();
await dlg().getByText('You do not rise to the level of your goals.').waitFor();
check(true, 'A highlight is saved with its page');
await dlg().getByRole('radio', { name: '4 stars' }).click();
await dlg().locator('[role=radio][aria-label="4 stars"][aria-checked=true]').waitFor();
check(true, 'A rating can be set');
await page.screenshot({ path: path.join(SHOTS, `study-book-${shotTheme}.png`) });
await dlg().getByRole('button', { name: 'Mark finished' }).click();
await dlg().locator('p.done').waitFor();
check(true, 'Mark finished completes the book');
await page.keyboard.press('Escape');
await closed();
await page.getByRole('radio', { name: /^Finished \(1\)/ }).waitFor();
check(true, 'Finished shelf now has one book');
const finishedTile = page.getByRole('region', { name: 'Finished this year' });
check(/1/.test(await finishedTile.innerText()), 'The "Finished this year" tile counts it');
check(/1\s*day/.test(await page.getByRole('region', { name: 'Reading streak' }).innerText()), 'Reading streak is 1 day');
await finishedTile.getByRole('button', { name: 'Set a yearly goal' }).click();
await dlg().getByLabel('Books to finish this year').fill('12');
await dlg().getByRole('button', { name: 'Save goal' }).click();
await closed();
check(/12/.test(await finishedTile.innerText()), 'A yearly reading goal can be set (1 / 12)');

// ---------------------------------------------------------------- flashcards
await page.getByRole('radio', { name: 'Flashcards' }).click();
check(await page.getByText('No flashcard decks yet').isVisible(), 'No decks yet invites the first one');
await page.getByRole('button', { name: /(New deck|Create your first deck)/ }).first().click();
await dlg().getByLabel('Deck name').fill('Spanish basics');
await dlg().getByRole('button', { name: 'Create deck' }).click();
await closed();
await page.getByRole('button', { name: /^Open deck Spanish basics/ }).click();
await page.getByRole('heading', { name: 'Spanish basics' }).waitFor();
await page.getByLabel('Front', { exact: true }).first().fill('hello');
await page.getByLabel('Back', { exact: true }).first().fill('hola');
await page.getByRole('button', { name: 'Add card', exact: true }).click();
await page.getByText('hola').first().waitFor();
check(true, 'A card can be added with the quick form');
await page.getByRole('button', { name: 'Paste a list' }).click();
await dlg().getByLabel('Cards').fill('thank you :: gracias\ngoodbye | adiós\nno separator line\nplease :: por favor');
await dlg().getByText('3 cards ready to add').waitFor();
await dlg().getByRole('button', { name: /^Add 3 cards/ }).click();
await closed();
await page.getByText('por favor').first().waitFor();
check((await page.getByRole('list', { name: 'Cards in this deck' }).getByRole('listitem').count()) === 4, 'Pasting a list adds the valid lines (4 cards in total)');
await page.screenshot({ path: path.join(SHOTS, `study-deck-${shotTheme}.png`) });

// review with the keyboard
await page.getByRole('button', { name: /^Review 4 due/ }).click();
const room = dlg();
await room.getByText('1 / 4').waitFor();
check(await room.getByRole('button', { name: /Show answer/ }).isVisible(), 'Review starts on the question with a Show answer button');
await page.keyboard.press('Space');
await room.getByRole('group', { name: 'How well did you know it?' }).waitFor();
check(true, 'Space reveals the answer and shows the four rating buttons');
check((await room.getByRole('button', { name: /^Good/ }).innerText()).includes('1d'), 'The Good button previews when the card returns (1d)');
await page.screenshot({ path: path.join(SHOTS, `study-review-${shotTheme}.png`) });
await page.keyboard.press('3');            // good
await room.getByText('2 / 4').waitFor();
await page.keyboard.press('Space'); await page.keyboard.press('1');   // again → card comes back later
await room.getByText('3 / 5').waitFor();
check(true, '"Again" re-queues the card at the end of the session (5 in the queue)');
await page.keyboard.press('Space'); await page.keyboard.press('4');   // easy
await room.getByText('4 / 5').waitFor();
await page.keyboard.press('Space'); await page.keyboard.press('3');
await room.getByText('5 / 5').waitFor();
await page.keyboard.press('Space'); await page.keyboard.press('3');
await room.getByRole('heading', { name: 'Session complete' }).waitFor();
check(/reviewed 5 cards/i.test(await room.innerText()), 'The session summary counts 5 reviews');
await page.screenshot({ path: path.join(SHOTS, `study-done-${shotTheme}.png`) });
await room.getByRole('button', { name: 'Done' }).click();
await closed();
check(await page.getByRole('button', { name: 'All caught up' }).first().isVisible(), 'After reviewing everything the deck says all caught up');

// ---------------------------------------------------------------- persistence + Home
await page.reload();
await page.getByRole('heading', { level: 1, name: 'Study & Read' }).waitFor();
await page.getByRole('radio', { name: 'Library' }).click();
await page.getByRole('radio', { name: /^Finished \(1\)/ }).waitFor();
check(true, 'The library survives a reload');
await page.goto(url + '#/dashboard');
await page.getByRole('heading', { level: 1, name: /, Sam$/ }).waitFor();
await page.getByRole('region', { name: 'Reading now', exact: true }).getByText('Meditations').first().waitFor();
check(true, 'Home "Reading now" lists the book still in progress');
await page.getByRole('region', { name: 'Reading now', exact: true }).getByRole('button', { name: /Log 5 percent of Meditations/ }).click();
await page.getByRole('region', { name: 'Reading now', exact: true }).getByText(/5 \/ 100 %/).waitFor();
check(true, 'One-tap logging on Home updates the book (a percentage book)');
await page.screenshot({ path: path.join(SHOTS, `study-home-${shotTheme}.png`), fullPage: false });

// ---------------------------------------------------------------- reset study data keeps the app healthy
check(errors.length === 0, 'No console/page errors', [...new Set(errors)].slice(0, 4).join(' | '));
await ctx.close();
console.log(`\n${failed ? `${failed} FAILED` : 'All passed'}.`);
process.exit(failed ? 1 : 0);
