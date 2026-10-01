// Reading list (Study & Read → Library): books, articles, papers and courses with honest progress.
// Pure rules (unit-tested) + thin storage helpers. Progress is counted in pages when the total is known,
// otherwise as a percentage; every bit of progress is also a dated ReadingLog row, so streaks and weekly
// charts are reconstructed from what really happened — never estimated.
import { addDays, eachDay, nowIso, today, type DateKey } from '../util/dates';
import { newId } from '../util/ids';
import { get, getAll, getByIndex, put, transact } from '../db/idb';
import { bump } from '../db/changes.svelte';
import type { Book, BookKind, BookStatus, Highlight, ReadingLog } from '../db/schema';

export const BOOK_COLORS = ['#7a5cf0', '#3b82c4', '#1f9d8a', '#c2653a', '#b8486f', '#5a6b8c', '#a07d2a', '#4c8f4c'];
export const KIND_LABEL: Record<BookKind, string> = { book: 'Book', article: 'Article', paper: 'Paper', course: 'Course', other: 'Other' };
export const STATUS_LABEL: Record<BookStatus, string> = { want: 'Want to read', reading: 'Reading', finished: 'Finished', paused: 'Paused' };

type Prog = Pick<Book, 'total' | 'progress'>;
/** Where "100%" sits for this item: the page count, or 100 when tracked as a percentage. */
export const maxOf = (b: Prog) => (b.total && b.total > 0 ? b.total : 100);
export const fractionOf = (b: Prog) => Math.max(0, Math.min(1, b.progress / maxOf(b)));
export const unitOf = (b: Prog) => (b.total && b.total > 0 ? 'pages' : '%');
export const remainingOf = (b: Prog) => Math.max(0, maxOf(b) - b.progress);

/** Pure: add progress on a day, moving the status along (want/paused → reading, reaching the end → finished). */
export function applyProgress(book: Book, amount: number, date: DateKey): Book {
  const progress = Math.max(0, Math.min(maxOf(book), book.progress + amount));
  const finished = progress >= maxOf(book);
  const status: BookStatus = finished ? 'finished' : book.status === 'finished' ? 'reading' : book.status === 'want' || book.status === 'paused' ? 'reading' : book.status;
  return {
    ...book, progress, status,
    startedOn: book.startedOn ?? (amount > 0 ? date : null),
    finishedOn: finished ? (book.finishedOn ?? date) : null,
  };
}

/** Consecutive days with reading, ending today — or yesterday, since today isn't over yet. */
export function readingStreak(dates: Iterable<DateKey>, todayKey: DateKey): number {
  const set = new Set(dates);
  let day = set.has(todayKey) ? todayKey : addDays(todayKey, -1);
  let n = 0;
  while (set.has(day)) { n++; day = addDays(day, -1); }
  return n;
}

/** Pages (or percentage points) read per day for the last `days` days ending `end`; zeros are real zeros. */
export function amountSeries(logs: Pick<ReadingLog, 'date' | 'amount'>[], end: DateKey, days = 7): { date: DateKey; value: number }[] {
  const per = new Map<DateKey, number>();
  for (const l of logs) per.set(l.date, (per.get(l.date) ?? 0) + l.amount);
  return eachDay(addDays(end, -(days - 1)), end).map((date) => ({ date, value: per.get(date) ?? 0 }));
}

export const finishedInYear = (books: Pick<Book, 'status' | 'finishedOn'>[], year: number) =>
  books.filter((b) => b.status === 'finished' && b.finishedOn?.startsWith(`${year}-`)).length;

// ---------------------------------------------------------------- storage

export interface LibraryData { books: Book[]; logs: ReadingLog[] }

export async function loadLibrary(): Promise<LibraryData> {
  const [books, logs] = await Promise.all([getAll('books'), getAll('reading_logs')]);
  return { books, logs };
}

export async function saveBook(input: Partial<Book> & Pick<Book, 'title'>): Promise<Book> {
  const at = nowIso();
  const existing = input.id ? await get('books', input.id) : undefined;
  const book: Book = {
    id: existing?.id ?? newId('book'), author: '', kind: 'book', status: 'want', total: null, progress: 0, rating: null, startedOn: null, finishedOn: null,
    subjectId: null, color: BOOK_COLORS[0]!, notes: '', highlights: [], createdOn: today(),
    ...existing, ...input, title: input.title.trim(), createdAt: existing?.createdAt ?? at, updatedAt: at,
  } as Book;
  if (book.total !== null && (!Number.isFinite(book.total) || book.total <= 0)) book.total = null;
  book.progress = Math.max(0, Math.min(maxOf(book), Number.isFinite(book.progress) ? book.progress : 0));
  if (book.status === 'reading' && !book.startedOn) book.startedOn = today();
  if (book.status === 'finished') { book.finishedOn = book.finishedOn ?? today(); book.progress = maxOf(book); } // finished means complete
  else book.finishedOn = null;
  await put('books', book);
  bump();
  return book;
}

export async function deleteBook(id: string): Promise<void> {
  const logs = await getByIndex('reading_logs', 'by_book', id);
  await transact<void>(['books', 'reading_logs'], 'readwrite', (t) => {
    t.objectStore('books').delete(id);
    for (const l of logs) t.objectStore('reading_logs').delete(l.id);
  });
  bump();
}

/** Record reading: updates the book's progress/status and writes the dated log row, together. */
export async function logReading(bookId: string, amount: number, date: DateKey = today()): Promise<Book | null> {
  const book = await get('books', bookId);
  if (!book || !Number.isFinite(amount) || amount <= 0) return null;
  const before = book.progress;
  const next = { ...applyProgress(book, amount, date), updatedAt: nowIso() };
  const gained = next.progress - before; // clamped at the end of the book
  if (gained <= 0) return next;
  const log: ReadingLog = { id: newId('rlog'), bookId, date, amount: gained, createdAt: nowIso() };
  await transact<void>(['books', 'reading_logs'], 'readwrite', (t) => { t.objectStore('books').put(next); t.objectStore('reading_logs').put(log); });
  bump();
  return next;
}

/** Set progress to an absolute value (e.g. "I'm on page 120"). Only forward movement is logged as reading. */
export async function setProgress(bookId: string, value: number, date: DateKey = today()): Promise<Book | null> {
  const book = await get('books', bookId);
  if (!book || !Number.isFinite(value)) return null;
  const v = Math.max(0, Math.min(maxOf(book), value));
  if (v > book.progress) return logReading(bookId, v - book.progress, date);
  const next = { ...book, progress: v, status: (v >= maxOf(book) ? 'finished' : book.status === 'finished' ? 'reading' : book.status) as BookStatus, finishedOn: v >= maxOf(book) ? book.finishedOn : null, updatedAt: nowIso() };
  await put('books', next);
  bump();
  return next;
}

export async function finishBook(bookId: string, rating: Book['rating'] = null): Promise<Book | null> {
  const book = await get('books', bookId);
  if (!book) return null;
  const rest = remainingOf(book);
  if (rest > 0) await logReading(bookId, rest);
  const cur = (await get('books', bookId))!;
  const next: Book = { ...cur, status: 'finished', finishedOn: cur.finishedOn ?? today(), rating: rating ?? cur.rating, updatedAt: nowIso() };
  await put('books', next);
  bump();
  return next;
}

export async function addHighlight(bookId: string, text: string, page: number | null): Promise<void> {
  const book = await get('books', bookId);
  if (!book || !text.trim()) return;
  const h: Highlight = { id: newId('hl'), text: text.trim(), page: page && page > 0 ? Math.round(page) : null, at: nowIso() };
  await put('books', { ...book, highlights: [h, ...book.highlights], updatedAt: nowIso() });
  bump();
}

export async function removeHighlight(bookId: string, highlightId: string): Promise<void> {
  const book = await get('books', bookId);
  if (!book) return;
  await put('books', { ...book, highlights: book.highlights.filter((h) => h.id !== highlightId), updatedAt: nowIso() });
  bump();
}

/** What Home needs: what you're reading now, the streak, and whether today already has reading. */
export interface ReadingSnap { reading: Book[]; streak: number; loggedToday: boolean; finishedThisYear: number; any: boolean }
export async function readingSnapshot(day: DateKey = today()): Promise<ReadingSnap> {
  const { books, logs } = await loadLibrary();
  const dates = logs.map((l) => l.date);
  const reading = books.filter((b) => b.status === 'reading').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return { reading, streak: readingStreak(dates, day), loggedToday: dates.includes(day), finishedThisYear: finishedInYear(books, Number(day.slice(0, 4))), any: books.length > 0 };
}
