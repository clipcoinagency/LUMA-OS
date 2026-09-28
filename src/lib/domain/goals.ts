import { diffDays, nowIso, today, type DateKey } from '../util/dates';
import { newId } from '../util/ids';
import { get, getAll, getByIndex, put, transact } from '../db/idb';
import { bump } from '../db/changes.svelte';
import type { Goal, GoalProgress } from '../db/schema';

/** 0–1. Numeric goals use current/target; milestone goals use milestones done. */
export function goalFraction(g: Goal): number {
  if (g.status === 'completed') return 1;
  if (g.target !== null && g.target > 0) return Math.max(0, Math.min(1, g.current / g.target));
  if (g.milestones.length) return g.milestones.filter((m) => m.done).length / g.milestones.length;
  return 0;
}

export type Pace = 'done' | 'ahead' | 'on-track' | 'behind' | 'overdue' | 'no-deadline';

/** Honest pace check: compares progress to time elapsed between start and deadline. */
export function goalPace(g: Goal, day: DateKey = today()): Pace {
  const f = goalFraction(g);
  if (f >= 1 || g.status === 'completed') return 'done';
  if (!g.deadline) return 'no-deadline';
  if (day > g.deadline) return 'overdue';
  const total = Math.max(1, diffDays(g.createdOn, g.deadline));
  const elapsed = Math.max(0, diffDays(g.createdOn, day)) / total;
  if (f >= elapsed + 0.1) return 'ahead';
  if (f >= elapsed - 0.1) return 'on-track';
  return 'behind';
}

export async function listGoals(): Promise<Goal[]> {
  return (await getAll('goals')).sort((a, b) => (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999'));
}

export async function goalHistory(goalId: string): Promise<GoalProgress[]> {
  return (await getByIndex('goal_progress', 'by_goal', goalId)).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
}

/** Records a dated check-in AND updates the goal, atomically (history is never overwritten). */
export async function recordProgress(goalId: string, value: number, note = '', on: DateKey = today()): Promise<void> {
  const g = await get('goals', goalId);
  if (!g) return;
  const at = nowIso();
  const reached = g.target !== null && value >= g.target;
  const next: Goal = { ...g, current: value, updatedAt: at, status: reached ? 'completed' : g.status === 'completed' ? 'active' : g.status, completedOn: reached ? (g.completedOn ?? on) : null };
  const row: GoalProgress = { id: newId('gp'), goalId, date: on, value, note, createdAt: at, updatedAt: at };
  await transact<void>(['goals', 'goal_progress'], 'readwrite', (t) => {
    t.objectStore('goals').put(next);
    t.objectStore('goal_progress').put(row);
  });
  bump();
}

export async function saveGoal(g: Goal): Promise<void> {
  await put('goals', { ...g, updatedAt: nowIso() });
  bump();
}

/** Ticks/unticks a milestone and records the new milestone count as a dated check-in. */
export async function toggleMilestone(goalId: string, milestoneId: string, done: boolean, on: DateKey = today()): Promise<void> {
  const g = await get('goals', goalId);
  if (!g) return;
  const milestones = g.milestones.map((m) => (m.id === milestoneId ? { ...m, done, doneOn: done ? on : null } : m));
  const doneN = milestones.filter((m) => m.done).length;
  const allDone = milestones.length > 0 && doneN === milestones.length && g.target === null;
  const at = nowIso();
  const next: Goal = { ...g, milestones, updatedAt: at, status: allDone ? 'completed' : g.status === 'completed' ? 'active' : g.status, completedOn: allDone ? (g.completedOn ?? on) : null };
  const row: GoalProgress = { id: newId('gp'), goalId, date: on, value: doneN, note: `${done ? 'Completed' : 'Reopened'}: ${milestones.find((m) => m.id === milestoneId)?.title ?? ''}`, createdAt: at, updatedAt: at };
  await transact<void>(['goals', 'goal_progress'], 'readwrite', (t) => {
    t.objectStore('goals').put(next);
    t.objectStore('goal_progress').put(row);
  });
  bump();
}

export async function setGoalStatus(goalId: string, status: Goal['status'], on: DateKey = today()): Promise<void> {
  const g = await get('goals', goalId);
  if (!g) return;
  // Completing stamps (or keeps) the date; reactivating a completed goal reopens it (clears the
  // date); archiving/pausing otherwise leaves completedOn exactly as it was.
  const completedOn = status === 'completed' ? (g.completedOn ?? on) : status === 'active' ? null : g.completedOn;
  await put('goals', { ...g, status, completedOn, updatedAt: nowIso() });
  bump();
}

/** Deletes a goal and its whole progress history in one transaction. */
export async function deleteGoal(goalId: string): Promise<void> {
  const rows = await getByIndex('goal_progress', 'by_goal', goalId);
  await transact<void>(['goals', 'goal_progress'], 'readwrite', (t) => {
    t.objectStore('goals').delete(goalId);
    const gp = t.objectStore('goal_progress');
    for (const r of rows) gp.delete(r.id);
  });
  bump();
}
