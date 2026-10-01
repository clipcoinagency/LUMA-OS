import { describe, expect, it } from 'vitest';
import { computeWeekReport, detectWins, type RawWeekData } from '../../src/lib/domain/weekReport';
import type { Goal, GoalProgress, Habit, HabitLog, Task, FocusSession } from '../../src/lib/db/schema';

// Week under review: Mon 2026-09-28 … Sun 2026-10-04 (the week before: 2026-09-21 … 09-27)
const START = '2026-09-28';
const task = (id: string, over: Partial<Task> = {}): Task => ({
  id, title: id, notes: '', priority: 'none', dueDate: null, dueTime: null, reminder: false, remindedOn: null, tags: [], done: false,
  completedOn: null, createdOn: '2026-09-01', createdAt: '', updatedAt: '', ...over,
});
const done = (id: string, on: string) => task(id, { done: true, completedOn: on, dueDate: on });
const habit = (id: string, over: Partial<Habit> = {}): Habit => ({
  id, name: id, frequency: { kind: 'daily' }, color: '#fff', icon: 'x', archived: false, order: 0, createdOn: '2026-01-01', createdAt: '', updatedAt: '', ...over,
});
const logs = (habitId: string, dates: string[]): HabitLog[] => dates.map((date) => ({ id: `${habitId}|${date}`, habitId, date, createdAt: '' }));
const session = (date: string, minutes: number): FocusSession => ({ id: 's' + date + minutes, date, startedAt: '', endedAt: '', seconds: minutes * 60, plannedMin: minutes, taskId: null, projectId: null, label: 'x', createdAt: '' });

const raw = (over: Partial<RawWeekData> = {}): RawWeekData => ({
  start: START, weekStartsOn: 1, enabled: ['tasks', 'goals', 'habits', 'calendar', 'notes', 'wellness', 'finance'], currency: 'USD',
  tasks: [], habits: [], habitLogs: [], sessions: [], workouts: [], wellness: [], transactions: [], goals: [], goalProgress: [], ...over,
});

describe('week report', () => {
  it('counts tasks completed inside the week, and compares with the week before', () => {
    const r = computeWeekReport(raw({ tasks: [done('a', '2026-09-29'), done('b', '2026-09-30'), done('c', '2026-10-04'), done('old', '2026-09-22'), done('out', '2026-10-06')] }));
    expect(r.tasksDone).toBe(3);
    expect(r.tasksDonePrev).toBe(1);
    expect(r.days.map((d) => d.tasksDone)).toEqual([0, 1, 1, 0, 0, 0, 1]);
    expect(r.bestDay?.score).toBe(1);
  });

  it('measures habits as completed ÷ due and finds perfect days', () => {
    const h = habit('read');
    const r = computeWeekReport(raw({ habits: [h], habitLogs: logs('read', ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01']) }));
    expect(r.habitRate).toBeCloseTo(4 / 7);
    expect(r.perfectHabitDays).toBe(4);
  });

  it('does not count days before a habit existed', () => {
    const h = habit('new', { createdOn: '2026-10-02' });
    const r = computeWeekReport(raw({ habits: [h], habitLogs: logs('new', ['2026-10-02']) }));
    // due 10-02..10-04 = 3 days, 1 done
    expect(r.habitRate).toBeCloseTo(1 / 3);
  });

  it('treats times-per-week habits against their weekly target', () => {
    const h = habit('gym', { frequency: { kind: 'times-per-week', times: 3 } });
    const r = computeWeekReport(raw({ habits: [h], habitLogs: logs('gym', ['2026-09-29', '2026-10-01', '2026-10-03', '2026-10-04']) }));
    expect(r.habitRate).toBe(1); // 4 check-ins, target 3 → capped at the target
  });

  it('is null (not zero) when there is nothing to measure', () => {
    const r = computeWeekReport(raw());
    expect(r.habitRate).toBeNull();
    expect(r.moodAvg).toBeNull();
    expect(r.spentMinor).toBeNull();
    expect(r.hasAnyActivity).toBe(false);
  });

  it('sums focus time and sessions, with the previous week for comparison', () => {
    const r = computeWeekReport(raw({ sessions: [session('2026-09-29', 25), session('2026-09-29', 50), session('2026-10-02', 45), session('2026-09-23', 30)] }));
    expect(r.focusMin).toBe(120);
    expect(r.focusSessions).toBe(3);
    expect(r.focusMinPrev).toBe(30);
  });

  it('reports unfinished work: open tasks due on or before the end of the week, oldest first', () => {
    const r = computeWeekReport(raw({ tasks: [task('later', { dueDate: '2026-10-09' }), task('late', { dueDate: '2026-09-10' }), task('thu', { dueDate: '2026-10-01' }), task('nodate'), done('fin', '2026-09-30')] }));
    expect(r.unfinished.map((t) => t.id)).toEqual(['late', 'thu']);
  });

  it('shows how far a goal moved this week', () => {
    const goal: Goal = { id: 'g', title: 'Read 12 books', description: '', target: 12, unit: 'books', current: 6, deadline: null, status: 'active', milestones: [], createdOn: '2026-01-01', completedOn: null, createdAt: '', updatedAt: '' };
    const progress: GoalProgress[] = [
      { id: '1', goalId: 'g', date: '2026-09-15', value: 3, note: '', createdAt: '', updatedAt: '' },
      { id: '2', goalId: 'g', date: '2026-10-02', value: 6, note: '', createdAt: '', updatedAt: '' },
    ];
    const r = computeWeekReport(raw({ goals: [goal], goalProgress: progress }));
    expect(r.goalMoves).toEqual([{ goalId: 'g', title: 'Read 12 books', fromPct: 25, toPct: 50 }]);
  });

  it('respects disabled modules', () => {
    const r = computeWeekReport(raw({ enabled: ['notes'], tasks: [task('open', { dueDate: '2026-09-29' })], habits: [habit('h')] }));
    expect(r.unfinished).toEqual([]);
    expect(r.habitRate).toBeNull();
  });
});

describe('wins', () => {
  it('only reports what the numbers support', () => {
    expect(detectWins(computeWeekReport(raw()))).toEqual([]);
  });
  it('finds real highlights', () => {
    const r = computeWeekReport(raw({
      tasks: [done('a', '2026-09-29'), done('b', '2026-09-29'), done('c', '2026-09-29')],
      habits: [habit('read')], habitLogs: logs('read', ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']),
      sessions: [session('2026-09-30', 90)],
    }));
    const text = detectWins(r).map((w) => w.text).join(' | ');
    expect(text).toContain('Completed 3 tasks');
    expect(text).toContain('7-day streak on “read”');
    expect(text).toContain('7 days with every habit done');
    expect(text).toContain('1h 30m of focus');
    expect(text).toContain('Tuesday was your strongest day');
  });
});
