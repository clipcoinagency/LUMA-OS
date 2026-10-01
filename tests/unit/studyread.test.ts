import { describe, expect, it, beforeEach } from 'vitest';
import { closeDB, getAll } from '../../src/lib/db/idb';
import { applyProgress, amountSeries, deleteBook, finishBook, finishedInYear, fractionOf, logReading, readingSnapshot, readingStreak, saveBook, setProgress, addHighlight } from '../../src/lib/domain/reading';
import { addCards, dueCards, deleteDeck, intervalLabel, loadDecks, parseCards, previewLabels, reviewCard, saveDeck, schedule, studySnapshot, studyStreak } from '../../src/lib/domain/flashcards';
import type { Book, Card } from '../../src/lib/db/schema';
import { today } from '../../src/lib/util/dates';

const book = (over: Partial<Book> = {}): Book => ({ id: 'b1', title: 'Dune', author: 'Herbert', kind: 'book', status: 'want', total: 400, progress: 0, rating: null, startedOn: null, finishedOn: null, subjectId: null, color: '#000', notes: '', highlights: [], createdOn: '2026-09-01', createdAt: '', updatedAt: '', ...over });

describe('reading: progress rules', () => {
  it('moves a book from want to reading on first progress and records the start day', () => {
    const b = applyProgress(book(), 30, '2026-10-01');
    expect(b).toMatchObject({ progress: 30, status: 'reading', startedOn: '2026-10-01', finishedOn: null });
  });
  it('finishes at the end of the book and never overshoots', () => {
    const b = applyProgress(book({ status: 'reading', progress: 390, startedOn: '2026-09-20' }), 50, '2026-10-01');
    expect(b).toMatchObject({ progress: 400, status: 'finished', finishedOn: '2026-10-01', startedOn: '2026-09-20' });
  });
  it('tracks a percentage when there is no page count', () => {
    const b = book({ total: null, progress: 40 });
    expect(fractionOf(b)).toBeCloseTo(0.4);
    expect(applyProgress(b, 70, '2026-10-01').progress).toBe(100);
  });
  it('counts a reading streak that survives a not-yet-logged today', () => {
    const d = ['2026-09-29', '2026-09-30', '2026-09-27'] as never[];
    expect(readingStreak(d, '2026-10-01')).toBe(2);          // today not logged yet: still 2
    expect(readingStreak([...d, '2026-10-01' as never], '2026-10-01')).toBe(3);
    expect(readingStreak(d, '2026-10-05')).toBe(0);          // a real gap breaks it
  });
  it('builds a 7-day series with real zeros and counts finished books per year', () => {
    const s = amountSeries([{ date: '2026-10-01' as never, amount: 20 }, { date: '2026-10-01' as never, amount: 5 }, { date: '2026-09-28' as never, amount: 10 }], '2026-10-01' as never);
    expect(s).toHaveLength(7);
    expect(s.at(-1)!.value).toBe(25);
    expect(s.filter((d) => d.value === 0)).toHaveLength(5);
    expect(finishedInYear([book({ status: 'finished', finishedOn: '2026-03-02' }), book({ status: 'finished', finishedOn: '2025-12-30' }), book({ status: 'reading' })], 2026)).toBe(1);
  });
});

describe('reading: storage', () => {
  beforeEach(async () => { await closeDB(); indexedDB.deleteDatabase('lifeos'); });

  it('logs reading as dated rows and updates the book together', async () => {
    const b = await saveBook({ title: 'Atomic Habits', total: 300, status: 'reading' });
    await logReading(b.id, 25, '2026-10-01' as never);
    await logReading(b.id, 15, '2026-10-02' as never);
    const [stored] = await getAll('books');
    expect(stored!.progress).toBe(40);
    expect((await getAll('reading_logs')).map((l) => l.amount).sort()).toEqual([15, 25]);
  });
  it('logs only the pages actually gained when the end of the book is hit', async () => {
    const b = await saveBook({ title: 'Short', total: 50, status: 'reading', progress: 45 });
    await logReading(b.id, 20, '2026-10-01' as never);
    expect((await getAll('reading_logs'))[0]!.amount).toBe(5);
    expect((await getAll('books'))[0]!.status).toBe('finished');
  });
  it('setProgress only logs forward movement; finishing fills the rest and keeps the rating', async () => {
    const b = await saveBook({ title: 'X', total: 100, status: 'reading', progress: 10 });
    await setProgress(b.id, 60, '2026-10-01' as never);
    await setProgress(b.id, 40, '2026-10-02' as never); // going back (e.g. a correction) is not "reading"
    expect((await getAll('reading_logs')).reduce((n, l) => n + l.amount, 0)).toBe(50);
    expect((await getAll('books'))[0]!.progress).toBe(40);
    await finishBook(b.id, 5);
    expect((await getAll('books'))[0]).toMatchObject({ status: 'finished', progress: 100, rating: 5 });
  });
  it('keeps highlights and deletes a book together with its reading history', async () => {
    const b = await saveBook({ title: 'Quoted', total: 200, status: 'reading' });
    await addHighlight(b.id, '  A line worth keeping  ', 42);
    expect((await getAll('books'))[0]!.highlights[0]).toMatchObject({ text: 'A line worth keeping', page: 42 });
    await logReading(b.id, 10);
    await deleteBook(b.id);
    expect(await getAll('books')).toHaveLength(0);
    expect(await getAll('reading_logs')).toHaveLength(0);
  });
  it('summarises what you are reading now, honestly', async () => {
    expect((await readingSnapshot()).any).toBe(false);
    const b = await saveBook({ title: 'Now', total: 100, status: 'reading' });
    await logReading(b.id, 10);
    const s = await readingSnapshot();
    expect(s).toMatchObject({ any: true, loggedToday: true, streak: 1 });
    expect(s.reading.map((x) => x.title)).toEqual(['Now']);
  });
});

describe('flashcards: scheduler', () => {
  const fresh = { interval: 0, ease: 2.5, reps: 0, lapses: 0 };
  it('graduates a new card: good → 1 day, then 3, then grows by ease', () => {
    const a = schedule(fresh, 'good', '2026-10-01' as never);
    expect(a).toMatchObject({ interval: 1, reps: 1, due: '2026-10-02', lastReviewed: '2026-10-01' });
    const b = schedule(a, 'good', '2026-10-02' as never);
    expect(b.interval).toBe(3);
    const c = schedule(b, 'good', '2026-10-05' as never);
    expect(c.interval).toBe(8);   // round(3 × 2.5)
    expect(c.reps).toBe(3);
  });
  it('again resets the streak, counts a lapse and lowers ease (never below 1.3)', () => {
    let s = { interval: 20, ease: 1.4, reps: 5, lapses: 0 };
    const r = schedule(s, 'again', '2026-10-01' as never);
    expect(r).toMatchObject({ reps: 0, lapses: 1, interval: 1, ease: 1.3 });
  });
  it('easy jumps further than good, hard less', () => {
    const base = { interval: 10, ease: 2.5, reps: 4, lapses: 0 };
    const [h, g, e] = (['hard', 'good', 'easy'] as const).map((r) => schedule(base, r, '2026-10-01' as never).interval);
    expect(h!).toBeLessThan(g!);
    expect(g!).toBeLessThan(e!);
  });
  it('labels intervals and previews each button', () => {
    expect([intervalLabel(1), intervalLabel(10), intervalLabel(45), intervalLabel(400)]).toEqual(['1d', '1w', '2mo', '1y']);
    expect(previewLabels(fresh, '2026-10-01' as never).good).toBe('1d');
  });
  it('parses pasted cards and skips lines without a back', () => {
    const t = 'Capital of France :: Paris\n\nmitochondria | powerhouse of the cell\nno separator here\n  H2O\tWater  \nbroken ::';
    expect(parseCards(t)).toEqual([
      { front: 'Capital of France', back: 'Paris' }, { front: 'mitochondria', back: 'powerhouse of the cell' }, { front: 'H2O', back: 'Water' },
    ]);
  });
  it('study streak mirrors the reading rule', () => {
    expect(studyStreak(['2026-09-30', '2026-10-01'] as never[], '2026-10-01' as never)).toBe(2);
    expect(studyStreak(['2026-09-25'] as never[], '2026-10-01' as never)).toBe(0);
  });
});

describe('flashcards: storage', () => {
  beforeEach(async () => { await closeDB(); indexedDB.deleteDatabase('lifeos'); });

  it('new cards are due today; reviewing schedules them and logs a dated review', async () => {
    const d = await saveDeck({ title: 'Biology' });
    expect(await addCards(d.id, [{ front: 'a', back: '1' }, { front: 'b', back: '2' }, { front: '', back: 'skipped' }])).toBe(2);
    expect((await dueCards(d.id)).map((c) => c.front)).toEqual(['a', 'b']);
    const [first] = await dueCards(d.id);
    const next = await reviewCard(first as Card, 'good');
    expect(next).toMatchObject({ interval: 1, reps: 1 });
    expect((await dueCards(d.id)).map((c) => c.front)).toEqual(['b']);      // 'a' is now due tomorrow
    expect(await getAll('card_reviews')).toHaveLength(1);
    const rows = await loadDecks();
    expect(rows[0]).toMatchObject({ total: 2, due: 1, fresh: 1 });
    expect(await studySnapshot()).toMatchObject({ due: 1, reviewedToday: 1, streak: 1, decks: 1 });
    expect(today()).toBeTruthy();
  });
  it('deleting a deck removes its cards and review history', async () => {
    const d = await saveDeck({ title: 'Temp' });
    await addCards(d.id, [{ front: 'x', back: 'y' }]);
    const [c] = await dueCards(d.id);
    await reviewCard(c as Card, 'easy');
    await deleteDeck(d.id);
    expect(await getAll('decks')).toHaveLength(0);
    expect(await getAll('cards')).toHaveLength(0);
    expect(await getAll('card_reviews')).toHaveLength(0);
  });
});
