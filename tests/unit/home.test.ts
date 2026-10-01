import { describe, expect, it } from 'vitest';
import { buildBriefing, buildHeadline, greetingFor, type HomeSnapshot } from '../../src/lib/domain/home';
import { inResetSeason, resetNudge, weekToReview } from '../../src/lib/domain/review';
import type { Task } from '../../src/lib/db/schema';

const task = (id: string, over: Partial<Task> = {}): Task => ({
  id, title: id, notes: '', priority: 'none', dueDate: '2026-10-01', dueTime: null, reminder: false, remindedOn: null, tags: [], done: false,
  completedOn: null, createdOn: '2026-09-01', createdAt: '', updatedAt: '', ...over,
});
const habit = (over: Record<string, unknown> = {}) => ({ id: 'h', name: 'Read', color: '#fff', current: 1, unit: 'day' as const, dueToday: true, doneToday: false, weekCount: 1, ...over });
const snap = (over: Partial<HomeSnapshot> = {}): HomeSnapshot => ({
  day: '2026-10-01', minutes: 10 * 60, weekday: 4, name: 'Sam', enabled: ['tasks', 'goals', 'habits', 'calendar', 'notes', 'wellness', 'finance'],
  tasks: { today: [], overdue: [], doneToday: 0 }, habits: [], goals: [], events: [], focus: { minutes: 0, target: 120 }, wellness: null, finance: null, reset: null, ...over,
});

describe('greeting', () => {
  it('follows the hour', () => {
    expect([2, 8, 14, 20].map(greetingFor)).toEqual(['Good night', 'Good morning', 'Good afternoon', 'Good evening']);
  });
});

describe('headline', () => {
  it("states today's open work and the next event", () => {
    const h = buildHeadline(snap({ tasks: { today: [task('a'), task('b'), task('c')], overdue: [task('o')], doneToday: 0 }, events: [{ id: 'e', title: 'Standup', date: '2026-10-01', startTime: '11:30', allDay: false }] }));
    expect(h).toContain('3 things to do today');
    expect(h).toContain('1 overdue');
    expect(h).toContain('Standup');
  });
  it('is honest about an empty day', () => {
    expect(buildHeadline(snap())).toMatch(/clear day/i);
  });
  it('celebrates a finished day only when there was work', () => {
    expect(buildHeadline(snap({ tasks: { today: [], overdue: [], doneToday: 4 } }))).toMatch(/all 4/i);
  });
});

describe('briefing', () => {
  it('stays quiet about problems on a calm, populated day', () => {
    const b = buildBriefing(snap({ habits: [habit({ doneToday: true })], tasks: { today: [task('a')], overdue: [], doneToday: 0 } }));
    expect(b.find((l) => l.tone === 'warn')).toBeUndefined();
  });
  it('flags overdue tasks first', () => {
    const b = buildBriefing(snap({ tasks: { today: [], overdue: [task('a'), task('b')], doneToday: 0 } }));
    expect(b[0]!.id).toBe('overdue');
    expect(b[0]!.text).toContain('2 tasks are overdue');
  });
  it('points a big overdue pile at the Weekly Reset', () => {
    const b = buildBriefing(snap({ tasks: { today: [], overdue: Array.from({ length: 6 }, (_, i) => task('t' + i)), doneToday: 0 } }));
    expect(b[0]!.action).toMatchObject({ route: { name: 'reset' } });
  });
  it('warns when a streak of 3+ days is not yet checked in', () => {
    const b = buildBriefing(snap({ habits: [habit({ current: 12, weekCount: 3 })] }));
    expect(b.find((l) => l.id === 'streak')?.text).toContain('12-day');
  });
  it('does not nag about a streak that is already done today', () => {
    const b = buildBriefing(snap({ habits: [habit({ current: 12, doneToday: true, weekCount: 3 })] }));
    expect(b.find((l) => l.id === 'streak')).toBeUndefined();
  });
  it('reports focus time against the goal', () => {
    const b = buildBriefing(snap({ focus: { minutes: 80, target: 120 } }));
    expect(b.find((l) => l.id === 'focus')?.text).toContain('1h 20m');
  });
  it('treats overspending as a fact', () => {
    const b = buildBriefing(snap({ finance: { spentMinor: 200000, incomeMinor: 150000, currency: 'USD', count: 5 } }));
    expect(b.find((l) => l.id === 'money')?.tone).toBe('warn');
  });
  it('respects disabled modules', () => {
    const b = buildBriefing(snap({ enabled: ['notes'], tasks: { today: [], overdue: [task('a')], doneToday: 0 } }));
    expect(b.find((l) => l.id === 'overdue')).toBeUndefined();
  });
  it('welcomes a brand-new workspace instead of showing nothing', () => {
    expect(buildBriefing(snap())[0]!.id).toBe('start');
  });
  it('caps the list', () => {
    const b = buildBriefing(snap({
      tasks: { today: [task('a')], overdue: [task('o')], doneToday: 0 }, reset: 'ready',
      habits: [habit({ current: 9, weekCount: 3 })],
      goals: [{ id: 'g', title: 'Run', fraction: 0.2, pace: 'behind', daysLeft: 9 }],
      finance: { spentMinor: 5000, incomeMinor: 100000, currency: 'USD', count: 2 },
    }), 3);
    expect(b.length).toBe(3);
  });
});

describe('weekly reset timing (Monday weeks)', () => {
  // 2026-09-28 is a Monday
  it('on the last days of a week, reviews that week and plans the next', () => {
    expect(weekToReview('2026-10-04', 1)).toEqual({ reviewWeek: '2026-09-28', planWeek: '2026-10-05' }); // Sunday
    expect(weekToReview('2026-10-03', 1)).toEqual({ reviewWeek: '2026-09-28', planWeek: '2026-10-05' }); // Saturday
  });
  it('early in the next week, catches up on the one that just ended', () => {
    expect(weekToReview('2026-10-06', 1)).toEqual({ reviewWeek: '2026-09-28', planWeek: '2026-10-05' }); // Tuesday
  });
  it('mid-week is not reset season', () => {
    expect(inResetSeason('2026-10-01', 1)).toBe(false); // Thursday
    expect(inResetSeason('2026-10-04', 1)).toBe(true);  // Sunday
    expect(inResetSeason('2026-10-05', 1)).toBe(true);  // Monday (grace)
    expect(inResetSeason('2026-10-07', 1)).toBe(false); // Wednesday
  });
  it('nudges "ready" at week end and "catch-up" after, and stops once reviewed', () => {
    expect(resetNudge('2026-10-04', 1, new Set())).toBe('ready');
    expect(resetNudge('2026-10-05', 1, new Set())).toBe('catch-up');
    expect(resetNudge('2026-10-04', 1, new Set(['2026-09-28']))).toBeNull();
    expect(resetNudge('2026-10-01', 1, new Set())).toBeNull();
  });
  it('handles Sunday-start weeks', () => {
    // 2026-10-04 is a Sunday: the first day of a Sunday-start week; Saturday the 10th is its last day
    expect(weekToReview('2026-10-10', 0)).toEqual({ reviewWeek: '2026-10-04', planWeek: '2026-10-11' });
  });
});
