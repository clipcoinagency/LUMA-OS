import { describe, expect, it } from 'vitest';
import { DEFAULT_NOTIFY, atLocal, idFor, planNotifications, type PlanInput } from '../../src/lib/domain/notifyPlan';
import type { DateKey } from '../../src/lib/util/dates';

// Wednesday 25 Nov 2026, 07:00 local
const NOW = new Date(2026, 10, 25, 7, 0, 0);
const D = (s: string) => s as DateKey;

function input(over: Partial<PlanInput> = {}): PlanInput {
  return {
    now: NOW, fromMs: NOW.getTime(), toMs: NOW.getTime() + 7 * 86_400_000,
    prefs: { ...DEFAULT_NOTIFY, enabled: true }, tasksOn: true, weekStartsOn: 1, name: 'Alex',
    tasks: [], events: [], habitsActive: false, habitsOpenToday: [], headlineToday: '2 things to do today.',
    resetDoneThisWeek: false, focus: null, timeLabel: (hm) => hm, ...over,
  };
}

describe('notification plan', () => {
  it('rings a task reminder at its own time, once', () => {
    const t = { id: 't1', title: 'Call the bank', done: false, reminder: true, dueDate: D('2026-11-25'), dueTime: '09:30', remindedOn: null };
    const plan = planNotifications(input({ tasks: [t, { ...t, id: 't2', done: true }, { ...t, id: 't3', reminder: false }, { ...t, id: 't4', remindedOn: D('2026-11-25') }] }));
    const tasks = plan.filter((p) => p.key.startsWith('task|'));
    expect(tasks).toHaveLength(1);
    expect(tasks[0]!.at).toBe(atLocal(D('2026-11-25'), '09:30'));
    expect(tasks[0]!.body).toBe('Call the bank');
  });

  it('keeps task reminders even with the master switch off when tasksOn (old installs)', () => {
    const t = { id: 't1', title: 'Pay rent', done: false, reminder: true, dueDate: D('2026-11-25'), dueTime: '10:00', remindedOn: null };
    const plan = planNotifications(input({ prefs: { ...DEFAULT_NOTIFY, enabled: false }, tasks: [t], events: [{ id: 'e', title: 'Dentist', date: D('2026-11-25'), startTime: '11:00', allDay: false }] }));
    expect(plan.map((p) => p.key.split('|')[0])).toEqual(['task']);
  });

  it('warns before events by the chosen lead time and skips all-day ones', () => {
    const plan = planNotifications(input({ prefs: { ...DEFAULT_NOTIFY, enabled: true, eventLeadMin: 15 }, events: [
      { id: 'e1', title: 'Dentist', date: D('2026-11-25'), startTime: '11:00', allDay: false },
      { id: 'e2', title: 'Holiday', date: D('2026-11-26'), startTime: null, allDay: true },
    ] }));
    const ev = plan.filter((p) => p.key.startsWith('event|'));
    expect(ev).toHaveLength(1);
    expect(ev[0]!.at).toBe(atLocal(D('2026-11-25'), '11:00') - 15 * 60_000);
    expect(ev[0]!.title).toBe('Dentist');
  });

  it('only nudges about habits today when some are still open', () => {
    const none = planNotifications(input({ habitsActive: true, habitsOpenToday: [], toMs: NOW.getTime() + 86_400_000 / 2 }));
    expect(none.some((p) => p.key === 'habits|2026-11-25')).toBe(false);
    const some = planNotifications(input({ habitsActive: true, habitsOpenToday: ['Read', 'Journal', 'Walk'] }));
    const today = some.find((p) => p.key === 'habits|2026-11-25')!;
    expect(today.title).toBe('3 habits still open');
    expect(today.body).toBe('Read, Journal and 1 more — still time today.');
  });

  it('uses the real headline for today’s morning briefing only', () => {
    const plan = planNotifications(input({ now: new Date(2026, 10, 25, 6, 0), fromMs: new Date(2026, 10, 25, 6, 0).getTime() }));
    const mornings = plan.filter((p) => p.key.startsWith('morning|'));
    expect(mornings[0]!.body).toBe('2 things to do today.');
    expect(mornings[0]!.title).toBe('Good morning, Alex');
    expect(mornings[1]!.body).not.toBe('2 things to do today.');
  });

  it('puts the Weekly Reset on the evening before the week starts, unless it is already done', () => {
    const monFirst = planNotifications(input()).filter((p) => p.key.startsWith('reset|'));
    expect(monFirst.map((p) => p.key)).toEqual(['reset|2026-11-29']); // Sunday
    const sunFirst = planNotifications(input({ weekStartsOn: 0 })).filter((p) => p.key.startsWith('reset|'));
    expect(sunFirst.map((p) => p.key)).toEqual(['reset|2026-11-28']); // Saturday
    const satNow = new Date(2026, 10, 28, 9, 0);
    const done = planNotifications(input({ now: satNow, fromMs: satNow.getTime(), toMs: satNow.getTime() + 7 * 86_400_000, resetDoneThisWeek: true })).filter((p) => p.key.startsWith('reset|'));
    expect(done).toHaveLength(0);
  });

  it('respects each switch and the window', () => {
    const off = planNotifications(input({ prefs: { ...DEFAULT_NOTIFY, enabled: true, morning: false, events: false, habits: false, reset: false, focus: false }, habitsActive: true, habitsOpenToday: ['Read'] }));
    expect(off).toEqual([]);
    const narrow = planNotifications(input({ toMs: NOW.getTime() + 60_000 }));
    expect(narrow).toEqual([]);
  });

  it('makes stable positive integer ids for Android', () => {
    expect(idFor('morning|2026-11-25')).toBe(idFor('morning|2026-11-25'));
    expect(idFor('a')).not.toBe(idFor('b'));
    for (const k of ['x', 'task|abc|2026-11-25|09:30', '']) { const id = idFor(k); expect(Number.isInteger(id) && id > 0 && id <= 0x7fffffff).toBe(true); }
  });
});
