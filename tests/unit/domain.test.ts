import { describe, expect, it } from 'vitest';
import { habitStats, isDueOn } from '../../src/lib/domain/habits';
import { splitToday } from '../../src/lib/domain/tasks';
import { summarize } from '../../src/lib/domain/finance';
import { goalFraction, goalPace } from '../../src/lib/domain/goals';
import { addDays } from '../../src/lib/util/dates';
import type { Goal, Habit, Task, Transaction } from '../../src/lib/db/schema';

const at = '2026-01-01T00:00:00.000Z';
const habit = (frequency: Habit['frequency'], createdOn = '2026-08-01'): Habit =>
  ({ id: 'h', name: 'H', frequency, color: '', icon: '', archived: false, order: 0, createdOn, createdAt: at, updatedAt: at });
const days = (from: string, n: number) => Array.from({ length: n }, (_, i) => addDays(from, i));

describe('habit streaks', () => {
  const today = '2026-09-26'; // Saturday

  it('daily: counts back from yesterday when today is not done yet', () => {
    const done = new Set(days('2026-09-20', 6)); // 20..25
    const s = habitStats(habit({ kind: 'daily' }), done, today);
    expect(s.current).toBe(6);
    expect(s.doneToday).toBe(false);
    done.add(today);
    expect(habitStats(habit({ kind: 'daily' }), done, today).current).toBe(7);
  });

  it('daily: a missed day breaks the streak; best streak is remembered', () => {
    const done = new Set([...days('2026-09-01', 10), ...days('2026-09-24', 2)]); // 1..10, 24..25
    const s = habitStats(habit({ kind: 'daily' }), done, today);
    expect(s.current).toBe(2);
    expect(s.best).toBe(10);
  });

  it('weekdays: non-due days never break the streak', () => {
    const mwf: Habit['frequency'] = { kind: 'weekdays', days: [1, 3, 5] };
    expect(isDueOn(mwf, '2026-09-26')).toBe(false); // Saturday
    const done = new Set(['2026-09-14', '2026-09-16', '2026-09-18', '2026-09-21', '2026-09-23', '2026-09-25']);
    const s = habitStats(habit(mwf), done, today);
    expect(s.current).toBe(6);
    expect(s.rate).not.toBeNull();
  });

  it('times-per-week: streak counts weeks that met the target', () => {
    const f = { kind: 'times-per-week', times: 3 } as const;
    // weeks starting Mon 2026-09-07, 09-14 met (3 each); current week (09-21) has 2 so far
    const done = new Set(['2026-09-07', '2026-09-09', '2026-09-11', '2026-09-14', '2026-09-15', '2026-09-17', '2026-09-22', '2026-09-24']);
    const s = habitStats(habit(f), done, today, 1);
    expect(s.unit).toBe('week');
    expect(s.current).toBe(2);   // in-progress week doesn't break it
    expect(s.weekCount).toBe(2);
    done.add('2026-09-26');
    expect(habitStats(habit(f), done, today, 1).current).toBe(3);
  });

  it('back-filled days before the habit was created still count', () => {
    const done = new Set(['2026-09-24', '2026-09-25', today]);
    const s = habitStats(habit({ kind: 'daily' }, today), done, today);
    expect(s.current).toBe(3);
    expect(s.best).toBe(3);
  });

  it('completion rate ignores today until it is done', () => {
    const done = new Set(days('2026-09-17', 9)); // 17..25 → every due day before today
    expect(habitStats(habit({ kind: 'daily' }, '2026-09-17'), done, today).rate).toBe(1);
  });
});

describe('today tasks', () => {
  const t = (id: string, patch: Partial<Task>): Task => ({ id, title: id, notes: '', priority: 'none', dueDate: null, tags: [], done: false, completedOn: null, createdOn: '2026-09-20', createdAt: at, updatedAt: at, ...patch });
  it('splits overdue, today and done-today, overdue sorted by date then priority', () => {
    const r = splitToday([
      t('late-low', { dueDate: '2026-09-20', priority: 'low' }),
      t('late-high', { dueDate: '2026-09-20', priority: 'high' }),
      t('older', { dueDate: '2026-09-10' }),
      t('today', { dueDate: '2026-09-26' }),
      t('future', { dueDate: '2026-09-30' }),
      t('undated-new', { createdOn: '2026-09-26' }),
      t('undated-old', {}),
      t('done', { done: true, completedOn: '2026-09-26', dueDate: '2026-09-25' }),
    ], '2026-09-26');
    expect(r.overdue.map((x) => x.id)).toEqual(['older', 'late-high', 'late-low']);
    expect(r.today.map((x) => x.id).sort()).toEqual(['today', 'undated-new']);
    expect(r.doneToday.map((x) => x.id)).toEqual(['done']);
  });
});

describe('finance summary', () => {
  const tx = (type: Transaction['type'], amountMinor: number, currency = 'USD', categoryId: string | null = 'c1'): Transaction =>
    ({ id: Math.random().toString(), date: '2026-09-10', type, amountMinor, currency, categoryId, note: '', createdAt: at, updatedAt: at });
  it('sums in integer cents, separates savings, excludes other currencies', () => {
    const s = summarize([tx('income', 420000), tx('expense', 10), tx('expense', 20), tx('expense', 145000, 'USD', 'rent'), tx('saving', 25000), tx('expense', 9999, 'EUR')], 'USD');
    expect(s.incomeMinor).toBe(420000);
    expect(s.expenseMinor).toBe(145030);
    expect(s.savingMinor).toBe(25000);
    expect(s.balanceMinor).toBe(420000 - 145030 - 25000);
    expect(s.otherCurrencyCount).toBe(1);
    expect(s.byCategory[0]).toEqual({ categoryId: 'rent', amountMinor: 145000 });
  });
  it('ignores corrupt rows instead of corrupting totals', () => {
    const s = summarize([tx('expense', 100), { ...tx('expense', 0), amountMinor: 1.5 }, { ...tx('expense', 0), amountMinor: -50 }], 'USD');
    expect(s.expenseMinor).toBe(100);
  });
});

describe('goals', () => {
  const g = (patch: Partial<Goal>): Goal => ({ id: 'g', title: 'G', description: '', target: 100, unit: '', current: 0, deadline: '2026-12-31', status: 'active', milestones: [], createdOn: '2026-01-01', completedOn: null, createdAt: at, updatedAt: at, ...patch });
  it('computes progress for numeric and milestone goals', () => {
    expect(goalFraction(g({ current: 25 }))).toBe(0.25);
    expect(goalFraction(g({ current: 250 }))).toBe(1);
    expect(goalFraction(g({ target: null, milestones: [{ id: '1', title: 'a', done: true, doneOn: null }, { id: '2', title: 'b', done: false, doneOn: null }] }))).toBe(0.5);
  });
  it('judges pace against time elapsed', () => {
    expect(goalPace(g({ current: 75 }), '2026-07-01')).toBe('ahead');
    expect(goalPace(g({ current: 50 }), '2026-07-01')).toBe('on-track');
    expect(goalPace(g({ current: 10 }), '2026-07-01')).toBe('behind');
    expect(goalPace(g({ current: 10 }), '2027-01-05')).toBe('overdue');
    expect(goalPace(g({ current: 100 }), '2026-07-01')).toBe('done');
  });
});
