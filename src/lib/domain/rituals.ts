// The new looks' rituals and rewards, all from the user's own records:
//  • Close the day — an evening ritual (in the spirit of Sunsama's shutdown): see what you finished,
//    send loose ends to tomorrow / next week / someday, write one line, glance at tomorrow. The
//    closing line is saved as a journal note (tag "closed-day"), so it lives with the rest of
//    your journal, is backed up, and shows up in "On this day".
//  • Seals — quiet milestones with no penalties: nothing is ever taken away for a missed day.
import { getAll, getRange } from '../db/idb';
import { bump } from '../db/changes.svelte';
import { put } from '../db/idb';
import type { CalendarEvent, Note, Task } from '../db/schema';
import { addDays, nowIso, startOfWeek, type DateKey } from '../util/dates';
import { newId } from '../util/ids';
import { isDueOn, listHabits, logsInRange } from './habits';
import { listTasks, setTaskDone, updateTask } from './tasks';
import { focusMinutesToday, formatMinutes } from './focus';
import { loadYearInk } from './almanac';

export const CLOSED_TAG = 'closed-day';

// ---------------------------------------------------------------- close the day
export type LooseMove = 'tomorrow' | 'next-week' | 'someday' | 'done';

/** Pure: where a loose end goes. "next-week" = the start of next week; "someday" = no date. */
export function moveTarget(day: DateKey, move: Exclude<LooseMove, 'done'>, weekStartsOn: 0 | 1 = 1): DateKey | null {
  if (move === 'tomorrow') return addDays(day, 1);
  if (move === 'next-week') return addDays(startOfWeek(day, weekStartsOn), 7);
  return null;
}

export interface DaySummary {
  day: DateKey;
  done: Task[];
  habitsDone: string[];
  habitsOpen: string[];
  focusMin: number;
  loose: Task[];                  // due today or earlier, not done
  tomorrowTasks: Task[];
  tomorrowEvents: CalendarEvent[];
  closing: Note | null;           // today's closing note, if the day was already closed
}

export async function loadDaySummary(day: DateKey): Promise<DaySummary> {
  const tomorrow = addDays(day, 1);
  const [tasks, habits, logs, focusMin, tEvents, notes] = await Promise.all([
    listTasks(), listHabits(), logsInRange(day, day), focusMinutesToday(day), getRange('events', 'by_date', tomorrow, tomorrow), getRange('notes', 'by_date', day, day),
  ]);
  const doneIds = new Set(logs.map((l) => l.habitId));
  const due = habits.filter((h) => isDueOn(h.frequency, day));
  return {
    day,
    done: tasks.filter((t) => t.done && t.completedOn === day),
    habitsDone: due.filter((h) => doneIds.has(h.id)).map((h) => h.name),
    habitsOpen: due.filter((h) => !doneIds.has(h.id)).map((h) => h.name),
    focusMin: Math.round(focusMin),
    loose: tasks.filter((t) => !t.done && t.dueDate !== null && t.dueDate <= day).sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '')),
    tomorrowTasks: tasks.filter((t) => !t.done && t.dueDate === tomorrow),
    tomorrowEvents: tEvents.sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? '')),
    closing: notes.find((n) => n.tags.includes(CLOSED_TAG)) ?? null,
  };
}

export async function moveLooseEnd(task: Task, move: LooseMove, day: DateKey, weekStartsOn: 0 | 1 = 1): Promise<void> {
  if (move === 'done') { await setTaskDone(task.id, true, day); return; }
  await updateTask(task.id, { dueDate: moveTarget(day, move, weekStartsOn), remindedOn: null });
}

/** Pure: the short factual summary written under the user's own line. */
export function closingSummary(s: Pick<DaySummary, 'done' | 'habitsDone' | 'focusMin'>): string {
  const parts: string[] = [];
  if (s.done.length) parts.push(`${s.done.length} task${s.done.length === 1 ? '' : 's'} done`);
  if (s.habitsDone.length) parts.push(`${s.habitsDone.length} habit${s.habitsDone.length === 1 ? '' : 's'} checked`);
  if (s.focusMin) parts.push(`${formatMinutes(s.focusMin)} of focus`);
  return parts.length ? parts.join(' · ') : 'A quiet day.';
}

/** Saves (or updates) today's closing note. */
export async function closeTheDay(s: DaySummary, line: string, mood: 1 | 2 | 3 | 4 | 5 | null): Promise<Note> {
  const now = nowIso();
  const text = line.trim();
  const note: Note = {
    ...(s.closing ?? { id: newId('n_'), createdAt: now, pinned: false, projectId: null }),
    title: 'Day closed',            // the note's own date says which day
    content: `${text ? `${text}\n\n` : ''}— ${closingSummary(s)}`,
    date: s.day, tags: [CLOSED_TAG], kind: 'journal', mood, updatedAt: now,
  };
  await put('notes', note);
  bump();
  return note;
}

// ---------------------------------------------------------------- seals
export interface SealStats {
  tasksDone: number; focusMin: number; bestRun: number; resets: number; closings: number;
  booksFinished: number; journal: number; goalsDone: number; habitChecks: number;
}
export interface SealDef { id: string; name: string; line: string; stat: keyof SealStats; target: number; unit: string }
export interface Seal extends SealDef { value: number; earned: boolean }

export const SEAL_DEFS: SealDef[] = [
  { id: 'first-page', name: 'First page', line: 'Finish your first task.', stat: 'tasksDone', target: 1, unit: 'task' },
  { id: 'ten-done', name: 'Ten done', line: 'Finish ten tasks.', stat: 'tasksDone', target: 10, unit: 'tasks' },
  { id: 'century', name: 'A hundred done', line: 'Finish a hundred tasks.', stat: 'tasksDone', target: 100, unit: 'tasks' },
  { id: 'deep-hour', name: 'First deep hour', line: 'An hour of focus, in total.', stat: 'focusMin', target: 60, unit: 'min' },
  { id: 'deep-ten', name: 'Ten deep hours', line: 'Ten hours of focus, in total.', stat: 'focusMin', target: 600, unit: 'min' },
  { id: 'deep-hundred', name: 'A hundred hours', line: 'A hundred hours of focus, in total.', stat: 'focusMin', target: 6000, unit: 'min' },
  { id: 'run-7', name: 'A week unbroken', line: 'Seven days in a row with something done.', stat: 'bestRun', target: 7, unit: 'days' },
  { id: 'run-30', name: 'A month unbroken', line: 'Thirty days in a row with something done.', stat: 'bestRun', target: 30, unit: 'days' },
  { id: 'habit-50', name: 'Fifty check-ins', line: 'Check in on your habits fifty times.', stat: 'habitChecks', target: 50, unit: 'check-ins' },
  { id: 'reset-1', name: 'Clean slate', line: 'Do your first Weekly Reset.', stat: 'resets', target: 1, unit: 'reset' },
  { id: 'reset-4', name: 'A month of Sundays', line: 'Four Weekly Resets.', stat: 'resets', target: 4, unit: 'resets' },
  { id: 'close-1', name: 'Lights out', line: 'Close the day for the first time.', stat: 'closings', target: 1, unit: 'evening' },
  { id: 'close-7', name: 'Seven evenings', line: 'Close the day seven times.', stat: 'closings', target: 7, unit: 'evenings' },
  { id: 'journal-10', name: 'Ten lines', line: 'Write ten journal entries.', stat: 'journal', target: 10, unit: 'entries' },
  { id: 'book-1', name: 'The last page', line: 'Finish a book.', stat: 'booksFinished', target: 1, unit: 'book' },
  { id: 'goal-1', name: 'Summit', line: 'Reach a goal.', stat: 'goalsDone', target: 1, unit: 'goal' },
];

/** Pure: every seal with its progress. Earned seals stay earned (stats only ever grow). */
export function computeSeals(s: SealStats): Seal[] {
  return SEAL_DEFS.map((d) => ({ ...d, value: Math.min(d.target, Math.floor(s[d.stat])), earned: s[d.stat] >= d.target }));
}

/** Pure: longest run of consecutive days with a score above zero. */
export function longestRun(days: { score: number }[]): number {
  let best = 0, run = 0;
  for (const d of days) { run = d.score > 0 ? run + 1 : 0; best = Math.max(best, run); }
  return best;
}

export async function loadSealStats(today: DateKey, weekStartsOn: 0 | 1): Promise<SealStats> {
  const [tasks, sessions, reviews, notes, books, goals, habitLogs, ink] = await Promise.all([
    getAll('tasks'), getAll('focus_sessions'), getAll('reviews'), getAll('notes'), getAll('books'), getAll('goals'), getAll('habit_logs'), loadYearInk(today, weekStartsOn),
  ]);
  return {
    tasksDone: tasks.filter((t) => t.done).length,
    focusMin: sessions.reduce((n, s) => n + s.seconds, 0) / 60,
    bestRun: longestRun(ink.days),
    resets: reviews.length,
    closings: notes.filter((n) => n.tags.includes(CLOSED_TAG)).length,
    booksFinished: books.filter((b) => b.status === 'finished').length,
    journal: notes.filter((n) => n.kind === 'journal').length,
    goalsDone: goals.filter((g) => g.status === 'completed').length,
    habitChecks: habitLogs.length,
  };
}
