import { nowIso, today, type DateKey } from '../util/dates';
import { newId } from '../util/ids';
import { get, getAll, getByIndex, put, remove } from '../db/idb';
import { bump } from '../db/changes.svelte';
import type { Priority, Task } from '../db/schema';

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2, none: 3 };

/** Overdue first, then priority, then due date, then oldest. */
export function sortTasks(a: Task, b: Task): number {
  const ad = a.dueDate ?? '9999-12-31', bd = b.dueDate ?? '9999-12-31';
  return ad.localeCompare(bd) || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.createdAt.localeCompare(b.createdAt);
}

export interface TodayTasks {
  overdue: Task[];
  today: Task[];
  doneToday: Task[];
}

/** Pure: split tasks for "today". Tasks without a due date aren't "today" unless created today. */
export function splitToday(tasks: Task[], day: DateKey): TodayTasks {
  const open = tasks.filter((t) => !t.done);
  return {
    overdue: open.filter((t) => t.dueDate !== null && t.dueDate < day).sort(sortTasks),
    today: open.filter((t) => t.dueDate === day || (t.dueDate === null && t.createdOn === day)).sort(sortTasks),
    doneToday: tasks.filter((t) => t.done && t.completedOn === day),
  };
}

export async function listTasks(): Promise<Task[]> {
  return getAll('tasks');
}

export async function tasksCompletedOn(from: DateKey, to: DateKey): Promise<Task[]> {
  return getByIndex('tasks', 'by_completed', IDBKeyRange.bound(from, to));
}

export async function createTask(input: { title: string; dueDate?: DateKey | null; dueTime?: string | null; reminder?: boolean; priority?: Priority; notes?: string; tags?: string[]; projectId?: string | null }): Promise<Task> {
  const at = nowIso();
  const task: Task = {
    id: newId('task'), title: input.title.trim(), notes: input.notes ?? '', priority: input.priority ?? 'none',
    dueDate: input.dueDate === undefined ? today() : input.dueDate, dueTime: input.dueTime ?? null, reminder: input.reminder ?? false, remindedOn: null,
    tags: input.tags ?? [], projectId: input.projectId ?? null, done: false, completedOn: null,
    createdOn: today(), createdAt: at, updatedAt: at,
  };
  await put('tasks', task);
  bump();
  return task;
}

export async function updateTask(id: string, patch: Partial<Omit<Task, 'id' | 'createdAt'>>): Promise<Task | undefined> {
  const cur = await get('tasks', id);
  if (!cur) return undefined;
  const next: Task = { ...cur, ...patch, updatedAt: nowIso() };
  await put('tasks', next);
  bump();
  return next;
}

/** Completion is recorded on the day it happened — that's what the history view shows. */
export function setTaskDone(id: string, done: boolean, on: DateKey = today()) {
  return updateTask(id, { done, completedOn: done ? on : null });
}

export async function deleteTask(id: string): Promise<Task | undefined> {
  const cur = await get('tasks', id);
  await remove('tasks', id);
  bump();
  return cur; // returned so the UI can offer Undo
}

export async function restoreTask(task: Task): Promise<void> {
  await put('tasks', task);
  bump();
}

/** Pure: whether a task's reminder should fire right now. `nowHM` is "HH:MM" 24h local time. */
export function isReminderDue(task: Task, day: DateKey, nowHM: string): boolean {
  return task.reminder && !task.done && task.dueDate === day && task.dueTime !== null && task.remindedOn !== day && task.dueTime <= nowHM;
}

/** Marks a reminder as fired for the given day, so it won't re-trigger until tomorrow. */
export function markReminded(id: string, on: DateKey = today()) {
  return updateTask(id, { remindedOn: on });
}

/** Re-arms the reminder to ring again in `minutes` from now, today. */
export async function snoozeReminder(id: string, minutes: number): Promise<Task | undefined> {
  const now = new Date();
  now.setMinutes(now.getMinutes() + minutes);
  const hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return updateTask(id, { dueTime: hm, remindedOn: null });
}
