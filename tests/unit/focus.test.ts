import { describe, expect, it, beforeEach } from 'vitest';
import { closeDB } from '../../src/lib/db/idb';
import {
  elapsedMs, remainingMs, progressOf, formatClock, formatMinutes, pausedState, resumedState, recordSession, sessionsInRange,
  minutesByDay, sumMinutes, loadActive, saveActive, clearActive, localDay, MIN_RECORDED_SECONDS, type ActiveFocus,
} from '../../src/lib/domain/focus';

const T0 = Date.parse('2026-10-01T10:00:00.000Z');
const active = (over: Partial<ActiveFocus> = {}): ActiveFocus => ({
  startedAt: new Date(T0).toISOString(), plannedMin: 25, extraMin: 0, taskId: 'task_1', projectId: null, label: 'Write proposal', pausedAt: null, pausedMs: 0, ...over,
});

describe('focus timer math', () => {
  it('counts elapsed time from timestamps', () => {
    expect(elapsedMs(active(), T0 + 10 * 60_000)).toBe(10 * 60_000);
    expect(remainingMs(active(), T0 + 10 * 60_000)).toBe(15 * 60_000);
    expect(progressOf(active(), T0 + 5 * 60_000)).toBeCloseTo(0.2);
  });
  it('never goes negative or past the target', () => {
    expect(elapsedMs(active(), T0 - 5000)).toBe(0);
    expect(remainingMs(active(), T0 + 99 * 60_000)).toBe(0);
    expect(progressOf(active(), T0 + 99 * 60_000)).toBe(1);
  });
  it('excludes paused time, including a pause still in progress', () => {
    let a = pausedState(active(), T0 + 10 * 60_000);
    expect(elapsedMs(a, T0 + 40 * 60_000)).toBe(10 * 60_000); // frozen while paused
    a = resumedState(a, T0 + 20 * 60_000); // paused for 10 min
    expect(a.pausedMs).toBe(10 * 60_000);
    expect(elapsedMs(a, T0 + 25 * 60_000)).toBe(15 * 60_000);
  });
  it('"keep going" extends the target', () => {
    const a = active({ extraMin: 5 });
    expect(remainingMs(a, T0 + 25 * 60_000)).toBe(5 * 60_000);
  });
  it('formats clocks and durations', () => {
    expect(formatClock(25 * 60_000)).toBe('25:00');
    expect(formatClock(61_000)).toBe('01:01');
    expect(formatClock(0)).toBe('00:00');
    expect(formatMinutes(0)).toBe('0m');
    expect(formatMinutes(45)).toBe('45m');
    expect(formatMinutes(80)).toBe('1h 20m');
    expect(formatMinutes(120)).toBe('2h');
  });
});

describe('focus sessions', () => {
  beforeEach(async () => { await closeDB(); indexedDB.deleteDatabase('lifeos'); });

  it('records a finished session on its local day', async () => {
    const a = active({ startedAt: new Date(2026, 9, 1, 9, 0, 0).toISOString() });
    const s = await recordSession(a, new Date(2026, 9, 1, 9, 25, 0).getTime());
    expect(s?.seconds).toBe(25 * 60);
    expect(s?.date).toBe('2026-10-01');
    expect((await sessionsInRange('2026-10-01', '2026-10-01')).length).toBe(1);
  });
  it('ignores accidental taps shorter than the minimum', async () => {
    const a = active();
    expect(await recordSession(a, T0 + (MIN_RECORDED_SECONDS - 1) * 1000)).toBeNull();
    expect((await sessionsInRange('2000-01-01', '2100-01-01')).length).toBe(0);
  });
  it('sums minutes and groups by day', () => {
    const rows = [{ date: '2026-10-01', seconds: 1500 }, { date: '2026-10-01', seconds: 600 }, { date: '2026-10-02', seconds: 3000 }];
    expect(sumMinutes(rows)).toBe(85);
    expect([...minutesByDay(rows)]).toEqual([['2026-10-01', 35], ['2026-10-02', 50]]);
  });
  it('parks a running session and restores it', async () => {
    expect(await loadActive()).toBeNull();
    await saveActive(active());
    expect((await loadActive())?.label).toBe('Write proposal');
    await clearActive();
    expect(await loadActive()).toBeNull();
  });
  it('derives the local day from an instant', () => {
    expect(localDay(new Date(2026, 0, 5, 23, 59).toISOString())).toBe('2026-01-05');
    expect(localDay('not a date')).toBeNull();
  });
});
