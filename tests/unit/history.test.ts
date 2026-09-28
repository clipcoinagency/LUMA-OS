import { describe, expect, it } from 'vitest';
import { activityDays, dayFromAggregate, loadMonthAggregate, mergedTaskChecklist } from '../../src/lib/domain/history';
import { beforeEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { closeDB, put } from '../../src/lib/db/idb';
import type { CalendarEvent, Goal, GoalProgress, Habit, HabitLog, Note, Task, Transaction, WellnessDay, Workout } from '../../src/lib/db/schema';

const at = '2026-09-01T10:00:00.000Z';
const ALL: Array<'tasks' | 'goals' | 'habits' | 'calendar' | 'notes' | 'wellness' | 'finance'> = ['tasks', 'goals', 'habits', 'calendar', 'notes', 'wellness', 'finance'];

beforeEach(async () => {
  await closeDB();
  globalThis.indexedDB = new IDBFactory();
});

describe('day history reconstruction', () => {
  it('an empty range yields hasAnything: false for every day', async () => {
    const agg = await loadMonthAggregate('2026-09-01', '2026-09-03', ALL);
    for (const d of ['2026-09-01', '2026-09-02', '2026-09-03'] as const) {
      expect(dayFromAggregate(d, agg).hasAnything).toBe(false);
    }
  });

  it('reconstructs a day that touches every module from its dated rows only', async () => {
    const day = '2026-09-15';
    const task: Task = { id: 't1', title: 'Report', notes: '', priority: 'medium', dueDate: day, tags: [], done: true, completedOn: day, createdOn: '2026-09-01', createdAt: at, updatedAt: at };
    const habit: Habit = { id: 'h1', name: 'Walk', frequency: { kind: 'daily' }, color: '#000', icon: '', archived: false, order: 0, createdOn: '2026-09-01', createdAt: at, updatedAt: at };
    const log: HabitLog = { id: 'h1|2026-09-15', habitId: 'h1', date: day, createdAt: at };
    const goal: Goal = { id: 'g1', title: 'Read', description: '', target: 10, unit: 'books', current: 3, deadline: null, status: 'active', milestones: [], createdOn: '2026-09-01', completedOn: null, createdAt: at, updatedAt: at };
    const gp: GoalProgress = { id: 'gp1', goalId: 'g1', date: day, value: 3, note: 'ch3', createdAt: at, updatedAt: at };
    const tx: Transaction = { id: 'tx1', date: day, type: 'expense', amountMinor: 1250, currency: 'USD', categoryId: null, note: 'Lunch', createdAt: at, updatedAt: at };
    const wellness: WellnessDay = { id: day, date: day, water: 4, sleepHours: 7, mood: 4, steps: 8000, weight: null, note: '', updatedAt: at };
    const workout: Workout = { id: 'w1', date: day, type: 'Run', durationMin: 30, intensity: 'moderate', note: '', createdAt: at, updatedAt: at };
    const note: Note = { id: 'n1', title: 'Idea', content: 'Ship it', date: day, pinned: false, tags: [], createdAt: at, updatedAt: at };
    const event: CalendarEvent = { id: 'e1', title: 'Dentist', date: day, allDay: false, startTime: '09:00', endTime: null, notes: '', color: '#000', createdAt: at, updatedAt: at };
    await Promise.all([
      put('tasks', task), put('habits', habit), put('habit_logs', log), put('goals', goal), put('goal_progress', gp),
      put('transactions', tx), put('wellness', wellness), put('workouts', workout), put('notes', note), put('events', event),
    ]);

    const agg = await loadMonthAggregate('2026-09-01', '2026-09-30', ALL);
    const h = dayFromAggregate(day, agg);
    expect(h.hasAnything).toBe(true);
    expect(h.tasksCompleted.map((t) => t.id)).toEqual(['t1']);
    expect(h.tasksDue.map((t) => t.id)).toEqual(['t1']);
    expect(h.habits).toEqual([{ habit, done: true }]);
    expect(h.goalCheckins).toEqual([{ row: gp, goal }]);
    expect(h.transactions.map((t) => t.id)).toEqual(['tx1']);
    expect(h.wellness?.water).toBe(4);
    expect(h.workouts.map((w) => w.id)).toEqual(['w1']);
    expect(h.notes.map((n) => n.id)).toEqual(['n1']);
    expect(h.events.map((e) => e.id)).toEqual(['e1']);

    // a neighbouring day in the same range stays untouched
    const empty = dayFromAggregate('2026-09-16', agg);
    expect(empty.hasAnything).toBe(false);
  });

  it('habits only appear once created, and only on days they are due', async () => {
    const mwf: Habit['frequency'] = { kind: 'weekdays', days: [1, 3, 5] }; // Mon/Wed/Fri
    const habit: Habit = { id: 'h1', name: 'Gym', frequency: mwf, color: '#000', icon: '', archived: false, order: 0, createdOn: '2026-09-16', createdAt: at, updatedAt: at };
    await put('habits', habit);
    const agg = await loadMonthAggregate('2026-09-01', '2026-09-30', ['habits']);
    expect(dayFromAggregate('2026-09-14', agg).habits).toEqual([]); // before createdOn
    expect(dayFromAggregate('2026-09-16', agg).habits).toEqual([{ habit, done: false }]); // Wed, due
    expect(dayFromAggregate('2026-09-17', agg).habits).toEqual([]); // Thu, not due
  });

  it('a disabled module contributes nothing, even if it has data in range', async () => {
    await put('transactions', { id: 'tx1', date: '2026-09-10', type: 'expense', amountMinor: 500, currency: 'USD', categoryId: null, note: '', createdAt: at, updatedAt: at });
    const agg = await loadMonthAggregate('2026-09-01', '2026-09-30', ['tasks', 'habits']); // no 'finance'
    expect(dayFromAggregate('2026-09-10', agg).transactions).toEqual([]);
    expect(dayFromAggregate('2026-09-10', agg).hasAnything).toBe(false);
  });

  it('activityDays flags every day with real content but ignores an empty wellness row', async () => {
    await put('wellness', { id: '2026-09-05', date: '2026-09-05', water: null, sleepHours: null, mood: null, steps: null, weight: null, note: '', updatedAt: at });
    await put('wellness', { id: '2026-09-06', date: '2026-09-06', water: 3, sleepHours: null, mood: null, steps: null, weight: null, note: '', updatedAt: at });
    await put('notes', { id: 'n1', title: 'X', content: '', date: '2026-09-07', pinned: false, tags: [], createdAt: at, updatedAt: at });
    const agg = await loadMonthAggregate('2026-09-01', '2026-09-30', ['wellness', 'notes']);
    const days = activityDays(agg);
    expect(days.has('2026-09-05')).toBe(false); // a row exists but every field is empty
    expect(days.has('2026-09-06')).toBe(true);
    expect(days.has('2026-09-07')).toBe(true);
  });

  it('a task completed LATE shows undone on its due date but done on the day it was actually finished', async () => {
    const task: Task = { id: 't1', title: 'Taxes', notes: '', priority: 'none', dueDate: '2026-09-10', tags: [], done: true, completedOn: '2026-09-12', createdOn: '2026-09-01', createdAt: at, updatedAt: at };
    await put('tasks', task);
    const agg = await loadMonthAggregate('2026-09-01', '2026-09-30', ['tasks']);
    const dueDay = dayFromAggregate('2026-09-10', agg);
    const doneDay = dayFromAggregate('2026-09-12', agg);
    expect(mergedTaskChecklist(dueDay)).toEqual([{ task, doneThatDay: false }]);
    expect(mergedTaskChecklist(doneDay)).toEqual([{ task, doneThatDay: true }]);
  });

  it('a task due and completed the same day appears once, checked', async () => {
    const task: Task = { id: 't1', title: 'Call bank', notes: '', priority: 'none', dueDate: '2026-09-10', tags: [], done: true, completedOn: '2026-09-10', createdOn: '2026-09-01', createdAt: at, updatedAt: at };
    await put('tasks', task);
    const agg = await loadMonthAggregate('2026-09-01', '2026-09-30', ['tasks']);
    const day = dayFromAggregate('2026-09-10', agg);
    expect(mergedTaskChecklist(day)).toEqual([{ task, doneThatDay: true }]);
  });

  it('marks today, past and future days correctly', async () => {
    const agg = await loadMonthAggregate('2000-01-01', '2100-01-01', []);
    const { today } = await import('../../src/lib/util/dates');
    const t = today();
    expect(dayFromAggregate(t, agg).isToday).toBe(true);
    expect(dayFromAggregate(t, agg).isFuture).toBe(false);
    expect(dayFromAggregate('2099-12-31', agg).isFuture).toBe(true);
  });
});
