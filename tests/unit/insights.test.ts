import { describe, expect, it } from 'vitest';
import { computeInsights, daysOfData, type InsightsData } from '../../src/lib/domain/insights';
import { addDays, type DateKey } from '../../src/lib/util/dates';
import type { Task, WellnessDay, Transaction, FocusSession } from '../../src/lib/db/schema';

const TODAY = '2026-10-01' as DateKey; // a Thursday
const ALL = ['tasks', 'goals', 'habits', 'calendar', 'notes', 'wellness', 'finance'] as InsightsData['enabled'];
const empty = (over: Partial<InsightsData> = {}): InsightsData => ({
  today: TODAY, weekStartsOn: 1, enabled: ALL, currency: 'USD', tasks: [], habits: [], habitLogs: [], sessions: [], workouts: [], wellness: [], transactions: [], categories: [], goals: [], goalProgress: [], ...over,
});
const doneTask = (i: number, on: string): Task => ({ id: 't' + i, title: 't', notes: '', priority: 'none', dueDate: on, dueTime: null, reminder: false, remindedOn: null, tags: [], done: true, completedOn: on, createdOn: '2026-08-01', createdAt: '', updatedAt: '' });
const well = (date: string, over: Partial<WellnessDay> = {}): WellnessDay => ({ id: date, date, water: null, sleepHours: null, mood: null, steps: null, weight: null, note: '', updatedAt: '', ...over });
const spend = (i: number, date: string, amountMinor: number, categoryId: string): Transaction => ({ id: 'x' + i, date, type: 'expense', amountMinor, currency: 'USD', categoryId, note: '', createdAt: '', updatedAt: '' });
const sess = (i: number, date: string, hour: number, minutes = 25): FocusSession => ({ id: 's' + i, date, startedAt: new Date(`${date}T${String(hour).padStart(2, '0')}:00:00`).toISOString(), endedAt: '', seconds: minutes * 60, plannedMin: minutes, taskId: null, projectId: null, label: 'x', createdAt: '' });

describe('insights never fabricate', () => {
  it('says it is still learning when there is no data', () => {
    const r = computeInsights(empty());
    expect(r.ready).toEqual([]);
    expect(r.learning.length).toBeGreaterThan(0);
    expect(r.daysOfData).toBe(0);
  });

  it('needs enough tasks AND enough days before showing a trend', () => {
    const few = Array.from({ length: 5 }, (_, i) => doneTask(i, addDays(TODAY, -i)));
    expect(computeInsights(empty({ tasks: few })).ready.find((i) => i.id === 'tasks-trend')).toBeUndefined();
    const learn = computeInsights(empty({ tasks: few })).learning.find((l) => l.id === 'tasks-trend');
    expect(learn?.progress).toBeGreaterThan(0);
    expect(learn?.progress).toBeLessThan(1);
  });

  it('shows a weekly task rhythm once the data exists', () => {
    const tasks = Array.from({ length: 30 }, (_, i) => doneTask(i, addDays(TODAY, -(i % 28))));
    const r = computeInsights(empty({ tasks }));
    const t = r.ready.find((i) => i.id === 'tasks-trend');
    expect(t).toBeDefined();
    expect(t!.series).toHaveLength(8);
    expect(t!.series!.reduce((n, s) => n + s.value, 0)).toBeLessThanOrEqual(30);
  });

  it('finds the weekday you finish the most on, only if it clearly stands out', () => {
    // 2026-09-29 is a Tuesday: put most completions there
    const tuesdays = ['2026-09-29', '2026-09-22', '2026-09-15', '2026-09-08'];
    const tasks = [...tuesdays.flatMap((d, k) => Array.from({ length: 5 }, (_, i) => doneTask(k * 10 + i, d))), doneTask(100, '2026-09-30'), doneTask(101, '2026-10-01')];
    const r = computeInsights(empty({ tasks }));
    expect(r.ready.find((i) => i.id === 'tasks-weekday')?.headline).toContain('Tuesdays');
  });

  it('skips disabled areas entirely', () => {
    const r = computeInsights(empty({ enabled: ['notes'], tasks: Array.from({ length: 30 }, (_, i) => doneTask(i, addDays(TODAY, -i))) }));
    expect(r.ready.find((i) => i.area === 'tasks')).toBeUndefined();
    expect(r.learning.find((i) => i.area === 'tasks')).toBeUndefined();
  });
});

describe('cross-pattern insights need a real sample on both sides', () => {
  const mk = (goodN: number, poorN: number, goodTasks: number, poorTasks: number) => {
    const wellness: WellnessDay[] = []; const tasks: Task[] = [];
    let k = 0;
    for (let i = 1; i <= goodN; i++) { const d = addDays(TODAY, -i); wellness.push(well(d, { sleepHours: 8 })); for (let j = 0; j < goodTasks; j++) tasks.push(doneTask(k++, d)); }
    for (let i = goodN + 1; i <= goodN + poorN; i++) { const d = addDays(TODAY, -i); wellness.push(well(d, { sleepHours: 5.5 })); for (let j = 0; j < poorTasks; j++) tasks.push(doneTask(k++, d)); }
    return empty({ wellness, tasks });
  };
  it('appears with a clear gap and enough days', () => {
    const r = computeInsights(mk(10, 10, 3, 1));
    const p = r.ready.find((i) => i.id === 'pattern-sleep-tasks');
    expect(p).toBeDefined();
    expect(p!.note).toMatch(/not proof of cause/);
  });
  it('does not appear with too few days on one side', () => {
    expect(computeInsights(mk(10, 4, 3, 1)).ready.find((i) => i.id === 'pattern-sleep-tasks')).toBeUndefined();
  });
  it('does not appear when the difference is small', () => {
    expect(computeInsights(mk(10, 10, 2, 2)).ready.find((i) => i.id === 'pattern-sleep-tasks')).toBeUndefined();
  });
});

describe('focus + spending', () => {
  it('reports when focus tends to happen, from real session hours', () => {
    const sessions = Array.from({ length: 10 }, (_, i) => sess(i, addDays(TODAY, -i), i < 8 ? 9 : 15));
    const r = computeInsights(empty({ sessions }));
    expect(r.ready.find((i) => i.id === 'focus-time-of-day')?.headline).toContain('morning');
  });
  it('compares spending only when both months have enough entries', () => {
    const cat = [{ id: 'c1', name: 'Eating out', type: 'expense' as const, color: '#fff', icon: 'x', order: 0, archived: false, createdAt: '', updatedAt: '' }];
    const prev = [spend(1, '2026-09-03', 5000, 'c1'), spend(2, '2026-09-12', 5000, 'c1'), spend(3, '2026-09-20', 5000, 'c1')];
    const cur = [spend(4, '2026-10-01', 9000, 'c1'), spend(5, '2026-10-01', 9000, 'c1'), spend(6, '2026-10-01', 9000, 'c1')];
    const r = computeInsights(empty({ transactions: [...prev, ...cur], categories: cat }));
    const s = r.ready.find((i) => i.id === 'spending-month');
    expect(s?.headline).toContain('Eating out');
    expect(s?.headline).toContain('up 80%');
    expect(computeInsights(empty({ transactions: cur, categories: cat })).ready.find((i) => i.id === 'spending-month')).toBeUndefined();
  });
});

describe('days of data', () => {
  it('counts from the earliest record', () => {
    expect(daysOfData(empty({ tasks: [doneTask(1, TODAY)] }))).toBeGreaterThan(30); // task created 2026-08-01
  });
});
