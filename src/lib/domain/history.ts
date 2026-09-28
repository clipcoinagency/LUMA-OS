// Day/month history — reconstructs "what happened" on any date across every module.
// Nothing here is a separate copy of data: every fact was already stored on its own dated row
// (a habit check-in, a goal check-in, a transaction, a wellness day, …); this module only reads
// and assembles it. That's the whole point of never overwriting "today" — any past day can be
// rebuilt exactly the same way "today" is shown.
import { getAll, getRange } from '../db/idb';
import { isDueOn, listHabits } from './habits';
import { today, type DateKey } from '../util/dates';
import type { CalendarEvent, Goal, GoalProgress, Habit, ModuleId, Note, Task, Transaction, WellnessDay, Workout } from '../db/schema';

export interface DayHistory {
  date: DateKey;
  isFuture: boolean;
  isToday: boolean;
  events: CalendarEvent[];
  tasksDue: Task[];
  tasksCompleted: Task[];
  habits: { habit: Habit; done: boolean }[];
  goalCheckins: { row: GoalProgress; goal: Goal | undefined }[];
  transactions: Transaction[];
  wellness: WellnessDay | null;
  workouts: Workout[];
  notes: Note[];
  /** True once anything below is non-empty — decides between "nothing here" and the sections. */
  hasAnything: boolean;
}

export interface DeepAggregate {
  events: CalendarEvent[];
  tasksByDue: Map<string, Task[]>;
  tasksByCompleted: Map<string, Task[]>;
  habits: Habit[];
  logsByDate: Map<string, Set<string>>; // date -> set of habitIds done that day
  goalsById: Map<string, Goal>;
  goalCheckinsByDate: Map<string, GoalProgress[]>;
  transactionsByDate: Map<string, Transaction[]>;
  wellnessByDate: Map<string, WellnessDay>;
  workoutsByDate: Map<string, Workout[]>;
  notesByDate: Map<string, Note[]>;
}

function bucket<T>(rows: T[], keyOf: (r: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const r of rows) { const k = keyOf(r); m.set(k, [...(m.get(k) ?? []), r]); }
  return m;
}

/**
 * One set of range queries (a handful of IndexedDB reads, each a `by_date` index scan — Phase 0
 * measured ~60ms for a month on 21k rows) covers an entire month. Every day in that month is then
 * assembled from these maps with no further store access — safe to call once per month view.
 */
export async function loadMonthAggregate(from: DateKey, to: DateKey, enabledModules: ModuleId[]): Promise<DeepAggregate> {
  const has = (m: ModuleId) => enabledModules.includes(m);
  const [events, tasksDue, tasksDone, habits, logs, goals, checkins, txns, wellness, workouts, notes] = await Promise.all([
    has('calendar') ? getRange('events', 'by_date', from, to) : Promise.resolve([]),
    has('tasks') ? getRange('tasks', 'by_due', from, to) : Promise.resolve([]),
    has('tasks') ? getRange('tasks', 'by_completed', from, to) : Promise.resolve([]),
    has('habits') ? listHabits(true) : Promise.resolve([]),
    has('habits') ? getRange('habit_logs', 'by_date', from, to) : Promise.resolve([]),
    has('goals') ? getAll('goals') : Promise.resolve([]),
    has('goals') ? getRange('goal_progress', 'by_date', from, to) : Promise.resolve([]),
    has('finance') ? getRange('transactions', 'by_date', from, to) : Promise.resolve([]),
    has('wellness') ? getRange('wellness', 'by_date', from, to) : Promise.resolve([]),
    has('wellness') ? getRange('workouts', 'by_date', from, to) : Promise.resolve([]),
    has('notes') ? getRange('notes', 'by_date', from, to) : Promise.resolve([]),
  ]);
  const logsByDate = new Map<string, Set<string>>();
  for (const l of logs) logsByDate.set(l.date, new Set([...(logsByDate.get(l.date) ?? []), l.habitId]));
  return {
    events,
    tasksByDue: bucket(tasksDue.filter((t) => t.dueDate), (t) => t.dueDate!),
    tasksByCompleted: bucket(tasksDone.filter((t) => t.completedOn), (t) => t.completedOn!),
    habits,
    logsByDate,
    goalsById: new Map(goals.map((g: Goal) => [g.id, g])),
    goalCheckinsByDate: bucket(checkins, (c) => c.date),
    transactionsByDate: bucket(txns, (t) => t.date),
    wellnessByDate: new Map(wellness.map((w) => [w.date, w])),
    workoutsByDate: bucket(workouts, (w) => w.date),
    notesByDate: bucket(notes, (n) => n.date),
  };
}

export function dayFromAggregate(date: DateKey, agg: DeepAggregate, weekStartsOn: 0 | 1 = 1): DayHistory {
  void weekStartsOn; // reserved: a future "week" rollup can reuse this aggregate
  const habits = agg.habits
    .filter((h) => h.createdOn <= date && isDueOn(h.frequency, date))
    .map((h) => ({ habit: h, done: agg.logsByDate.get(date)?.has(h.id) ?? false }));
  const goalCheckins = (agg.goalCheckinsByDate.get(date) ?? []).map((row) => ({ row, goal: agg.goalsById.get(row.goalId) }));
  const tasksDue = agg.tasksByDue.get(date) ?? [];
  const tasksCompleted = agg.tasksByCompleted.get(date) ?? [];
  const events = agg.events.filter((e) => e.date === date);
  const transactions = agg.transactionsByDate.get(date) ?? [];
  const wellness = agg.wellnessByDate.get(date) ?? null;
  const workouts = agg.workoutsByDate.get(date) ?? [];
  const notes = agg.notesByDate.get(date) ?? [];
  const wellnessLogged = !!wellness && (wellness.water !== null || wellness.sleepHours !== null || wellness.steps !== null || wellness.weight !== null || wellness.mood !== null || wellness.note.trim() !== '');
  const t = today();
  return {
    date, isFuture: date > t, isToday: date === t,
    events, tasksDue, tasksCompleted, habits, goalCheckins, transactions, wellness, workouts, notes,
    hasAnything: events.length > 0 || tasksDue.length > 0 || tasksCompleted.length > 0 || habits.some((h) => h.done)
      || goalCheckins.length > 0 || transactions.length > 0 || wellnessLogged || workouts.length > 0 || notes.length > 0,
  };
}

export interface TaskCheckItem { task: Task; doneThatDay: boolean }

/**
 * Tasks due that day and tasks completed that day, merged into one checklist. A task can be
 * "done" live (task.done) yet NOT done as of this particular day — e.g. completed later — so
 * doneThatDay is computed from completedOn === date, never from the task's current state.
 */
export function mergedTaskChecklist(h: Pick<DayHistory, 'date' | 'tasksDue' | 'tasksCompleted'>): TaskCheckItem[] {
  const byId = new Map<string, TaskCheckItem>();
  for (const task of h.tasksDue) byId.set(task.id, { task, doneThatDay: task.completedOn === h.date });
  for (const task of h.tasksCompleted) byId.set(task.id, { task, doneThatDay: true });
  return [...byId.values()].sort((a, b) => Number(a.doneThatDay) - Number(b.doneThatDay) || a.task.title.localeCompare(b.task.title));
}

/** Convenience for a single day (e.g. a deep link) without a separate query shape to maintain. */
export async function loadDayHistory(date: DateKey, enabledModules: ModuleId[], weekStartsOn: 0 | 1 = 1): Promise<DayHistory> {
  const agg = await loadMonthAggregate(date, date, enabledModules);
  return dayFromAggregate(date, agg, weekStartsOn);
}

/** Days within range that have ANY recorded activity — for the month-grid "something happened" dot. */
export function activityDays(agg: DeepAggregate): Set<DateKey> {
  const days = new Set<DateKey>();
  const add = (keys: Iterable<string>) => { for (const k of keys) days.add(k as DateKey); };
  add(agg.tasksByCompleted.keys());
  for (const [d, ids] of agg.logsByDate) if (ids.size > 0) days.add(d as DateKey);
  add(agg.goalCheckinsByDate.keys());
  add(agg.transactionsByDate.keys());
  for (const [d, w] of agg.wellnessByDate) if (w.water !== null || w.sleepHours !== null || w.steps !== null || w.weight !== null || w.mood !== null || w.note.trim() !== '') days.add(d as DateKey);
  add(agg.workoutsByDate.keys());
  add(agg.notesByDate.keys());
  return days;
}
