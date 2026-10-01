// Flashcards (Study & Read → Flashcards): decks of cards reviewed with spaced repetition.
// The scheduler is a simplified SM-2 and is a pure function (unit-tested): rating a card returns its
// next due day, interval and ease. Every review is also a dated row, so "cards reviewed" and the
// study streak are reconstructed from real activity.
import { addDays, nowIso, today, type DateKey } from '../util/dates';
import { newId } from '../util/ids';
import { get, getAll, getByIndex, getRange, put, transact } from '../db/idb';
import { bump } from '../db/changes.svelte';
import type { Card, CardRating, CardReview, Deck } from '../db/schema';

export const DECK_COLORS = ['#7a5cf0', '#3b82c4', '#1f9d8a', '#c2653a', '#b8486f', '#a07d2a', '#4c8f4c', '#5a6b8c'];
export const RATINGS: { id: CardRating; label: string; key: string }[] = [
  { id: 'again', label: 'Again', key: '1' }, { id: 'hard', label: 'Hard', key: '2' }, { id: 'good', label: 'Good', key: '3' }, { id: 'easy', label: 'Easy', key: '4' },
];
export const MASTERED_DAYS = 21;
const MIN_EASE = 1.3, MAX_EASE = 3.0, START_EASE = 2.5;

type Sched = Pick<Card, 'due' | 'interval' | 'ease' | 'reps' | 'lapses' | 'lastReviewed'>;

/** Pure: the card's new schedule after a rating on `day`. */
export function schedule(card: Pick<Card, 'interval' | 'ease' | 'reps' | 'lapses'>, rating: CardRating, day: DateKey): Sched {
  const clamp = (e: number) => Math.min(MAX_EASE, Math.max(MIN_EASE, Math.round(e * 100) / 100));
  let { interval, ease, reps, lapses } = card;
  if (rating === 'again') { reps = 0; lapses += 1; ease = clamp(ease - 0.2); interval = 1; }
  else if (rating === 'hard') { reps = Math.max(1, reps); ease = clamp(ease - 0.15); interval = Math.max(1, Math.round(Math.max(1, interval) * 1.2)); }
  else if (rating === 'good') { interval = reps === 0 ? 1 : reps === 1 ? 3 : Math.max(interval + 1, Math.round(interval * ease)); reps += 1; }
  else { interval = reps === 0 ? 3 : reps === 1 ? 6 : Math.max(interval + 2, Math.round(interval * ease * 1.3)); reps += 1; ease = clamp(ease + 0.15); }
  return { due: addDays(day, interval), interval, ease, reps, lapses, lastReviewed: day };
}

/** Short labels for the four buttons ("1d", "3d", "2w"…) so the user sees what each choice means. */
export function intervalLabel(days: number): string {
  if (days < 7) return `${days}d`;
  if (days < 30) return `${Math.round(days / 7)}w`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${Math.round(days / 365)}y`;
}
export function previewLabels(card: Pick<Card, 'interval' | 'ease' | 'reps' | 'lapses'>, day: DateKey): Record<CardRating, string> {
  const l = (r: CardRating) => intervalLabel(schedule(card, r, day).interval);
  return { again: l('again'), hard: l('hard'), good: l('good'), easy: l('easy') };
}

/** Parse pasted text: one card per line, "front :: back" (a tab or " | " also works). Blank/incomplete lines are skipped. */
export function parseCards(text: string): { front: string; back: string }[] {
  const out: { front: string; back: string }[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^(.*?)(?:\s*::\s*|\t+|\s+\|\s+)(.+)$/);
    if (m && m[1]!.trim() && m[2]!.trim()) out.push({ front: m[1]!.trim(), back: m[2]!.trim() });
  }
  return out;
}

export const isDue = (c: Pick<Card, 'due'>, day: DateKey) => c.due <= day;
export const isNew = (c: Pick<Card, 'lastReviewed'>) => c.lastReviewed === null;
export const isMastered = (c: Pick<Card, 'interval' | 'lastReviewed'>) => c.lastReviewed !== null && c.interval >= MASTERED_DAYS;

/** Consecutive days with at least one review, ending today — or yesterday, since today isn't over. */
export function studyStreak(dates: Iterable<DateKey>, todayKey: DateKey): number {
  const set = new Set(dates);
  let day = set.has(todayKey) ? todayKey : addDays(todayKey, -1);
  let n = 0;
  while (set.has(day)) { n++; day = addDays(day, -1); }
  return n;
}

// ---------------------------------------------------------------- storage

export interface DeckRow { deck: Deck; total: number; due: number; fresh: number; mastered: number }

export async function loadDecks(day: DateKey = today()): Promise<DeckRow[]> {
  const [decks, cards] = await Promise.all([getAll('decks'), getAll('cards')]);
  return decks
    .map((deck) => {
      const mine = cards.filter((c) => c.deckId === deck.id);
      return { deck, total: mine.length, due: mine.filter((c) => isDue(c, day)).length, fresh: mine.filter(isNew).length, mastered: mine.filter(isMastered).length };
    })
    .sort((a, b) => b.due - a.due || a.deck.title.localeCompare(b.deck.title));
}

export async function saveDeck(input: Partial<Deck> & Pick<Deck, 'title'>): Promise<Deck> {
  const at = nowIso();
  const existing = input.id ? await get('decks', input.id) : undefined;
  const deck: Deck = { id: existing?.id ?? newId('deck'), color: DECK_COLORS[0]!, subjectId: null, description: '', createdOn: today(), ...existing, ...input, title: input.title.trim(), createdAt: existing?.createdAt ?? at, updatedAt: at } as Deck;
  await put('decks', deck);
  bump();
  return deck;
}

export async function deleteDeck(id: string): Promise<void> {
  const cards = await getByIndex('cards', 'by_deck', id);
  const reviews = (await getAll('card_reviews')).filter((r) => r.deckId === id);
  await transact<void>(['decks', 'cards', 'card_reviews'], 'readwrite', (t) => {
    t.objectStore('decks').delete(id);
    for (const c of cards) t.objectStore('cards').delete(c.id);
    for (const r of reviews) t.objectStore('card_reviews').delete(r.id);
  });
  bump();
}

export const listCards = async (deckId: string): Promise<Card[]> =>
  (await getByIndex('cards', 'by_deck', deckId)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));

export async function addCards(deckId: string, pairs: { front: string; back: string }[]): Promise<number> {
  const at = nowIso(), day = today();
  const rows: Card[] = pairs.filter((p) => p.front.trim() && p.back.trim()).map((p, i) => ({
    id: newId('card'), deckId, front: p.front.trim(), back: p.back.trim(), due: day, interval: 0, ease: START_EASE, reps: 0, lapses: 0, lastReviewed: null, createdOn: day,
    createdAt: new Date(Date.parse(at) + i).toISOString(), updatedAt: at, // distinct, ordered timestamps keep list order stable
  }));
  if (!rows.length) return 0;
  await transact<void>('cards', 'readwrite', (t) => { for (const r of rows) t.objectStore('cards').put(r); });
  bump();
  return rows.length;
}

export async function saveCard(card: Card): Promise<void> {
  await put('cards', { ...card, front: card.front.trim(), back: card.back.trim(), updatedAt: nowIso() });
  bump();
}

export async function deleteCard(id: string): Promise<void> {
  await transact<void>('cards', 'readwrite', (t) => { t.objectStore('cards').delete(id); });
  bump();
}

/** Cards to review now (due today or earlier), oldest-due first, optionally limited to one deck. */
export async function dueCards(deckId: string | null, day: DateKey = today(), limit = 100): Promise<Card[]> {
  const all = deckId ? await getByIndex('cards', 'by_deck', deckId) : await getAll('cards');
  return all.filter((c) => isDue(c, day)).sort((a, b) => a.due.localeCompare(b.due) || a.createdAt.localeCompare(b.createdAt)).slice(0, limit);
}

/** Rate a card: stores its new schedule and the dated review row, together. */
export async function reviewCard(card: Card, rating: CardRating, day: DateKey = today()): Promise<Card> {
  const next: Card = { ...card, ...schedule(card, rating, day), updatedAt: nowIso() };
  const rev: CardReview = { id: newId('rev'), cardId: card.id, deckId: card.deckId, date: day, rating, createdAt: nowIso() };
  await transact<void>(['cards', 'card_reviews'], 'readwrite', (t) => { t.objectStore('cards').put(next); t.objectStore('card_reviews').put(rev); });
  bump();
  return next;
}

export interface StudySnap { due: number; reviewedToday: number; streak: number; decks: number }
export async function studySnapshot(day: DateKey = today()): Promise<StudySnap> {
  const [decks, cards, reviews] = await Promise.all([getAll('decks'), getAll('cards'), getAll('card_reviews')]);
  return { due: cards.filter((c) => isDue(c, day)).length, reviewedToday: reviews.filter((r) => r.date === day).length, streak: studyStreak(reviews.map((r) => r.date), day), decks: decks.length };
}

export async function reviewsInRange(from: DateKey, to: DateKey): Promise<CardReview[]> {
  return getRange('card_reviews', 'by_date', from, to);
}
