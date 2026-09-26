// Habit rules — pure functions (unit-tested) + thin storage helpers.
//
// Streak semantics (honest, no gamification tricks):
//  • A streak counts consecutive DUE periods that were completed.
//  • Today not being done yet does not break the streak — the day isn't over.
//  • daily / weekdays: the period is a due day.
//  • times-per-week: the period is a week (weekStartsOn) with at least `times` check-ins;
//    the current week counts once its target is met and never breaks the streak while in progress.
import { addDays, diffDays, startOfWeek, today as todayKey, weekday, nowIso, type DateKey } from '../util/dates';
import { newId } from '../util/ids';
import { getAll, getByIndex, getRange, put, remove, transact } from '../db/idb';
import { bump } from '../db/changes.svelte';
import type { Habit, HabitFrequency, HabitLog } from '../db/schema';

export const logId = (habitId: string, date: DateKey) => `${habitId}|${date}`;

export function isDueOn(freq: HabitFrequency, date: DateKey): boolean {
  if (freq.kind === 'daily') return true;
  if (freq.kind === 'weekdays') return freq.days.includes(weekday(date));
  return true; // times-per-week: any day can count toward the week
}

export function frequencyLabel(freq: HabitFrequency): string {
  if (freq.kind === 'daily') return 'Every day';
  if (freq.kind === 'times-per-week') return `${freq.times}× a week`;
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const d = [...freq.days].sort();
  if (d.join() === '1,2,3,4,5') return 'Weekdays';
  if (d.join() === '0,6') return 'Weekends';
  return d.map((i) => names[i]).join(', ');
}

export interface HabitStats {
  current: number;
  best: number;
  unit: 'day' | 'week';
  /** completed due periods / due periods, over the window (0–1), null if nothing was due */
  rate: number | null;
  doneToday: boolean;
  dueToday: boolean;
  weekCount: number; // check-ins in the current week
}

export function habitStats(habit: Habit, doneDates: Set<string>, today: DateKey, weekStartsOn: 0 | 1 = 1, windowDays = 30): HabitStats {
  const f = habit.frequency;
  const start = habit.createdOn > addDays(today, -3650) ? habit.createdOn : addDays(today, -3650);
  const doneToday = doneDates.has(today);
  const wkStart = startOfWeek(today, weekStartsOn);
  let weekCount = 0;
  for (let d = wkStart; d <= today; d = addDays(d, 1)) if (doneDates.has(d)) weekCount++;

  if (f.kind === 'times-per-week') {
    const weekOk = (ws: DateKey) => {
      let n = 0;
      for (let i = 0; i < 7; i++) if (doneDates.has(addDays(ws, i))) n++;
      return n >= f.times;
    };
    const firstWeek = startOfWeek(start, weekStartsOn);
    // current: this week counts if met; otherwise start from last week
    let current = 0;
    let w = weekOk(wkStart) ? wkStart : addDays(wkStart, -7);
    while (w >= firstWeek && weekOk(w)) { current++; w = addDays(w, -7); }
    let best = 0, run = 0;
    for (let ws = firstWeek; ws <= wkStart; ws = addDays(ws, 7)) {
      if (weekOk(ws)) { run++; best = Math.max(best, run); } else if (ws !== wkStart) run = 0;
    }
    const weeks = Math.max(1, Math.min(Math.ceil(windowDays / 7), Math.floor(diffDays(firstWeek, wkStart) / 7)));
    let met = 0;
    for (let i = 1; i <= weeks; i++) if (weekOk(addDays(wkStart, -7 * i))) met++;
    const rate = diffDays(firstWeek, wkStart) >= 7 ? met / weeks : null;
    return { current, best: Math.max(best, current), unit: 'week', rate, doneToday, dueToday: true, weekCount };
  }

  // daily / weekdays
  const due = (d: DateKey) => isDueOn(f, d);
  let current = 0;
  let d = doneToday || !due(today) ? today : addDays(today, -1);
  for (; d >= start; d = addDays(d, -1)) {
    if (!due(d)) continue;
    if (doneDates.has(d)) current++;
    else break;
  }
  let best = 0, run = 0;
  for (let x = start; x <= today; x = addDays(x, 1)) {
    if (!due(x)) continue;
    if (doneDates.has(x)) { run++; best = Math.max(best, run); } else if (x !== today) run = 0;
  }
  let dueN = 0, doneN = 0;
  const from = addDays(today, -(windowDays - 1)) > start ? addDays(today, -(windowDays - 1)) : start;
  for (let x = from; x <= today; x = addDays(x, 1)) {
    if (!due(x) || (x === today && !doneToday)) continue; // today only counts once done
    dueN++;
    if (doneDates.has(x)) doneN++;
  }
  return { current, best: Math.max(best, current), unit: 'day', rate: dueN ? doneN / dueN : null, doneToday, dueToday: due(today), weekCount };
}

// ---------------------------------------------------------------- storage

export async function listHabits(includeArchived = false): Promise<Habit[]> {
  const all = await getAll('habits');
  return all.filter((h) => includeArchived || !h.archived).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

export async function logsByHabit(habitId: string): Promise<Set<string>> {
  const rows = await getByIndex('habit_logs', 'by_habit', habitId);
  return new Set(rows.map((r) => r.date));
}

export async function logsInRange(from: DateKey, to: DateKey): Promise<HabitLog[]> {
  return getRange('habit_logs', 'by_date', from, to);
}

/** Marks/unmarks a habit for a day. Returns the new state. */
export async function setHabitDone(habitId: string, date: DateKey, done: boolean): Promise<boolean> {
  if (done) await put('habit_logs', { id: logId(habitId, date), habitId, date, createdAt: nowIso() });
  else await remove('habit_logs', logId(habitId, date));
  bump();
  return done;
}

export async function saveHabit(input: Partial<Habit> & Pick<Habit, 'name' | 'frequency'>): Promise<Habit> {
  const at = nowIso();
  const existing = input.id ? (await getAll('habits')).find((h) => h.id === input.id) : undefined;
  const order = existing?.order ?? (await getAll('habits')).length;
  const habit: Habit = {
    id: existing?.id ?? newId('hab'), color: '#4f8f75', icon: 'repeat', archived: false, createdOn: input.createdOn ?? todayKey(),
    ...existing, ...input, order, createdAt: existing?.createdAt ?? at, updatedAt: at,
  } as Habit;
  await put('habits', habit);
  bump();
  return habit;
}

/** Deletes a habit AND its history in one transaction. */
export async function deleteHabit(habitId: string): Promise<void> {
  const logs = await getByIndex('habit_logs', 'by_habit', habitId);
  await transact<void>(['habits', 'habit_logs'], 'readwrite', (t) => {
    t.objectStore('habits').delete(habitId);
    const ls = t.objectStore('habit_logs');
    for (const l of logs) ls.delete(l.id);
  });
  bump();
}

