// Everything the Weekly Reset says about a finished week, computed from the user's own records.
// `computeWeekReport` is pure (unit-tested); `loadWeekReport` just gathers the rows. No number here is
// invented, estimated or scored — they are counts, sums and honest comparisons with the week before.
import { addDays, eachDay, formatDateKey, type DateKey } from '../util/dates';
import { getAll, getRange } from '../db/idb';
import type { Goal, GoalProgress, Habit, HabitLog, FocusSession, ModuleId, Task, Transaction, WellnessDay, Workout } from '../db/schema';
import { isDueOn, habitStats } from './habits';
import { formatMinutes, sumMinutes } from './focus';
import { formatMoney } from '../util/money';

export interface RawWeekData {
  start: DateKey;
  weekStartsOn: 0 | 1;
  enabled: ModuleId[];
  currency: string;
  tasks: Task[];
  habits: Habit[];
  habitLogs: HabitLog[];            // all logs (streaks need history)
  sessions: FocusSession[];         // at least the week and the week before
  workouts: Workout[];
  wellness: WellnessDay[];
  transactions: Transaction[];
  goals: Goal[];
  goalProgress: GoalProgress[];
}

export interface DayStat { date: DateKey; tasksDone: number; habitChecks: number; focusMin: number }
export interface GoalMove { goalId: string; title: string; fromPct: number; toPct: number }

export interface WeekReport {
  start: DateKey;
  end: DateKey;
  days: DayStat[];
  tasksDone: number;
  tasksDonePrev: number;
  habitRate: number | null;         // completed ÷ due, 0–1
  habitRatePrev: number | null;
  perfectHabitDays: number;
  focusMin: number;
  focusMinPrev: number;
  focusSessions: number;
  workouts: number;
  spentMinor: number | null;
  spentMinorPrev: number | null;
  moodAvg: number | null;
  bestDay: { date: DateKey; score: number } | null;
  streaks: { name: string; current: number }[];
  goalMoves: GoalMove[];
  unfinished: Task[];
  hasAnyActivity: boolean;
}

const inRange = (d: string | null, from: DateKey, to: DateKey) => d !== null && d >= from && d <= to;

function habitRate(habits: Habit[], logs: HabitLog[], from: DateKey, to: DateKey): { rate: number | null; perfectDays: number } {
  const byHabit = new Map<string, Set<string>>();
  for (const l of logs) { if (!byHabit.has(l.habitId)) byHabit.set(l.habitId, new Set()); byHabit.get(l.habitId)!.add(l.date); }
  let due = 0, done = 0, perfectDays = 0;
  const days = eachDay(from, to);
  const perDayDue = new Map<string, number>(), perDayDone = new Map<string, number>();
  for (const h of habits) {
    const set = byHabit.get(h.id) ?? new Set<string>();
    if (h.frequency.kind === 'times-per-week') {
      if (h.createdOn > to) continue;
      const n = days.filter((d) => set.has(d)).length;
      due += h.frequency.times; done += Math.min(n, h.frequency.times);
      continue;
    }
    for (const d of days) {
      if (d < h.createdOn && !set.has(d)) continue;
      if (!isDueOn(h.frequency, d)) continue;
      due++;
      perDayDue.set(d, (perDayDue.get(d) ?? 0) + 1);
      if (set.has(d)) { done++; perDayDone.set(d, (perDayDone.get(d) ?? 0) + 1); }
    }
  }
  for (const [d, n] of perDayDue) if (n > 0 && perDayDone.get(d) === n) perfectDays++;
  return { rate: due ? done / due : null, perfectDays };
}

function valueBefore(rows: GoalProgress[], goalId: string, before: DateKey): number | null {
  let best: GoalProgress | null = null;
  for (const r of rows) if (r.goalId === goalId && r.date < before && (!best || r.date > best.date || (r.date === best.date && r.createdAt > best.createdAt))) best = r;
  return best ? best.value : null;
}
function valueAsOf(rows: GoalProgress[], goalId: string, asOf: DateKey): number | null {
  let best: GoalProgress | null = null;
  for (const r of rows) if (r.goalId === goalId && r.date <= asOf && (!best || r.date > best.date || (r.date === best.date && r.createdAt > best.createdAt))) best = r;
  return best ? best.value : null;
}

export function computeWeekReport(raw: RawWeekData): WeekReport {
  const start = raw.start;
  const end = addDays(start, 6);
  const prevStart = addDays(start, -7), prevEnd = addDays(start, -1);
  const on = (m: ModuleId) => raw.enabled.includes(m);

  const doneIn = (a: DateKey, b: DateKey) => raw.tasks.filter((t) => t.done && inRange(t.completedOn, a, b)).length;
  const activeHabits = raw.habits.filter((h) => !h.archived);

  const days: DayStat[] = eachDay(start, end).map((d) => ({
    date: d,
    tasksDone: raw.tasks.filter((t) => t.done && t.completedOn === d).length,
    habitChecks: raw.habitLogs.filter((l) => l.date === d).length,
    focusMin: sumMinutes(raw.sessions.filter((s) => s.date === d)),
  }));

  const hr = on('habits') ? habitRate(activeHabits, raw.habitLogs, start, end) : { rate: null, perfectDays: 0 };
  const hrPrev = on('habits') ? habitRate(activeHabits, raw.habitLogs, prevStart, prevEnd) : { rate: null, perfectDays: 0 };

  const weekSessions = raw.sessions.filter((s) => inRange(s.date, start, end));
  const prevSessions = raw.sessions.filter((s) => inRange(s.date, prevStart, prevEnd));

  const spent = (a: DateKey, b: DateKey) => {
    const rows = raw.transactions.filter((t) => t.type === 'expense' && t.currency === raw.currency && inRange(t.date, a, b));
    return rows.length ? rows.reduce((n, t) => n + t.amountMinor, 0) : null;
  };

  const moods = raw.wellness.filter((w) => inRange(w.date, start, end) && w.mood !== null).map((w) => w.mood as number);

  let bestDay: WeekReport['bestDay'] = null;
  for (const d of days) {
    const score = d.tasksDone + d.habitChecks;
    if (score > 0 && (!bestDay || score > bestDay.score)) bestDay = { date: d.date, score };
  }

  const streaks = on('habits')
    ? activeHabits.map((h) => ({ name: h.name, current: habitStats(h, new Set(raw.habitLogs.filter((l) => l.habitId === h.id).map((l) => l.date)), end, raw.weekStartsOn).current }))
        .filter((s) => s.current >= 3).sort((a, b) => b.current - a.current).slice(0, 3)
    : [];

  const goalMoves: GoalMove[] = on('goals')
    ? raw.goals.filter((g) => g.status === 'active' || g.status === 'completed').flatMap((g) => {
        if (g.target === null || g.target <= 0) return [];
        const after = valueAsOf(raw.goalProgress, g.id, end);
        if (after === null) return [];
        const before = valueBefore(raw.goalProgress, g.id, start) ?? 0;
        if (after === before) return [];
        const pct = (v: number) => Math.round(Math.max(0, Math.min(1, v / g.target!)) * 100);
        return [{ goalId: g.id, title: g.title, fromPct: pct(before), toPct: pct(after) }];
      })
    : [];

  const unfinished = on('tasks')
    ? raw.tasks.filter((t) => !t.done && t.dueDate !== null && t.dueDate <= end).sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))
    : [];

  const tasksDone = doneIn(start, end);
  const focusMin = sumMinutes(weekSessions);
  const workouts = on('wellness') ? raw.workouts.filter((w) => inRange(w.date, start, end)).length : 0;

  return {
    start, end, days,
    tasksDone, tasksDonePrev: doneIn(prevStart, prevEnd),
    habitRate: hr.rate, habitRatePrev: hrPrev.rate, perfectHabitDays: hr.perfectDays,
    focusMin, focusMinPrev: sumMinutes(prevSessions), focusSessions: weekSessions.length,
    workouts,
    spentMinor: on('finance') ? spent(start, end) : null, spentMinorPrev: on('finance') ? spent(prevStart, prevEnd) : null,
    moodAvg: moods.length >= 2 ? Math.round((moods.reduce((a, b) => a + b, 0) / moods.length) * 10) / 10 : null,
    bestDay, streaks, goalMoves, unfinished,
    hasAnyActivity: tasksDone > 0 || days.some((d) => d.habitChecks > 0) || focusMin > 0 || workouts > 0,
  };
}

// ---------------------------------------------------------------- wins

export interface Win { id: string; text: string; detail?: string }

/** Genuine highlights only — each one is backed by a number in the report. */
export function detectWins(r: WeekReport, currency = 'USD'): Win[] {
  const wins: Win[] = [];
  if (r.tasksDone > 0) wins.push({ id: 'tasks', text: `Completed ${r.tasksDone} task${r.tasksDone === 1 ? '' : 's'}`, detail: r.tasksDonePrev > 0 ? (r.tasksDone > r.tasksDonePrev ? `up from ${r.tasksDonePrev} the week before` : r.tasksDone === r.tasksDonePrev ? 'same as the week before' : `${r.tasksDonePrev} the week before`) : undefined });
  if (r.streaks[0]) wins.push({ id: 'streak', text: `${r.streaks[0].current}-day streak on “${r.streaks[0].name}”` });
  if (r.perfectHabitDays > 0) wins.push({ id: 'perfect', text: `${r.perfectHabitDays} day${r.perfectHabitDays === 1 ? '' : 's'} with every habit done` });
  else if (r.habitRate !== null && r.habitRate >= 0.8) wins.push({ id: 'habit-rate', text: `${Math.round(r.habitRate * 100)}% of habits done` });
  if (r.focusMin >= 30) wins.push({ id: 'focus', text: `${formatMinutes(r.focusMin)} of focus`, detail: `${r.focusSessions} session${r.focusSessions === 1 ? '' : 's'}` });
  for (const g of r.goalMoves.filter((m) => m.toPct > m.fromPct).slice(0, 2)) wins.push({ id: `goal-${g.goalId}`, text: `“${g.title}” moved from ${g.fromPct}% to ${g.toPct}%` });
  if (r.workouts > 0) wins.push({ id: 'workouts', text: `${r.workouts} workout${r.workouts === 1 ? '' : 's'}` });
  if (r.moodAvg !== null && r.moodAvg >= 4) wins.push({ id: 'mood', text: `A good week for mood (average ${r.moodAvg} of 5)` });
  if (r.spentMinor !== null && r.spentMinorPrev !== null && r.spentMinor < r.spentMinorPrev) wins.push({ id: 'spend', text: `Spent ${formatMoney(r.spentMinorPrev - r.spentMinor, currency)} less than the week before` });
  if (r.bestDay && r.bestDay.score >= 3) wins.push({ id: 'best-day', text: `${formatDateKey(r.bestDay.date, { weekday: 'long' })} was your strongest day`, detail: `${r.bestDay.score} things done` });
  return wins.slice(0, 7);
}

// ---------------------------------------------------------------- loading

export async function loadWeekReport(start: DateKey, o: { weekStartsOn: 0 | 1; enabled: ModuleId[]; currency: string }): Promise<WeekReport> {
  const prevStart = addDays(start, -7), end = addDays(start, 6);
  const [tasks, habits, habitLogs, sessions, workouts, wellness, transactions, goals, goalProgress] = await Promise.all([
    getAll('tasks'), getAll('habits'), getAll('habit_logs'), getRange('focus_sessions', 'by_date', prevStart, end),
    getRange('workouts', 'by_date', prevStart, end), getRange('wellness', 'by_date', prevStart, end), getRange('transactions', 'by_date', prevStart, end),
    getAll('goals'), getAll('goal_progress'),
  ]);
  return computeWeekReport({ start, weekStartsOn: o.weekStartsOn, enabled: o.enabled, currency: o.currency, tasks, habits, habitLogs, sessions, workouts, wellness, transactions, goals, goalProgress });
}

