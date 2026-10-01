import { describe, it, expect } from 'vitest';
import { buildMood, buildProgress } from '../../src/lib/domain/pulse';
import type { DateKey } from '../../src/lib/util/dates';

const d = (s: string) => s as DateKey;

describe('pulse: progress', () => {
  it('sums the last 7 days and compares with the 7 before', () => {
    const counts = new Map<DateKey, number>([[d('2026-10-01'), 4], [d('2026-09-30'), 2], [d('2026-09-24'), 3], [d('2026-09-20'), 3]]);
    const p = buildProgress(counts, d('2026-10-01'));
    expect(p.days).toHaveLength(7);
    expect(p.days.at(-1)).toEqual({ date: '2026-10-01', value: 4 });
    expect(p.thisWeek).toBe(6);
    expect(p.lastWeek).toBe(6);
    expect(p.deltaPct).toBe(0);
  });
  it('has no percentage when last week had nothing (never divides by zero or invents a trend)', () => {
    const p = buildProgress(new Map([[d('2026-10-01'), 5]]), d('2026-10-01'));
    expect(p.lastWeek).toBe(0);
    expect(p.deltaPct).toBeNull();
  });
  it('reports a drop as a negative number', () => {
    const p = buildProgress(new Map([[d('2026-10-01'), 2], [d('2026-09-23'), 4]]), d('2026-10-01'));
    expect(p.deltaPct).toBe(-50);
  });
});

describe('pulse: mood', () => {
  it('keeps gaps as null, averages the last 7 days only', () => {
    const m = buildMood([{ date: d('2026-10-01'), mood: 4 }, { date: d('2026-09-29'), mood: 2 }, { date: d('2026-09-10'), mood: 5 }], d('2026-10-01'));
    expect(m.points).toHaveLength(14);
    expect(m.logged).toBe(2); // 09-10 is outside the 14-day window
    expect(m.avg7).toBe(3);
    expect(m.latest).toBe(4);
    expect(m.points.filter((p) => p.value === null)).toHaveLength(12);
  });
  it('is empty-safe', () => {
    const m = buildMood([], d('2026-10-01'));
    expect(m).toMatchObject({ logged: 0, avg7: null, latest: null });
  });
});
