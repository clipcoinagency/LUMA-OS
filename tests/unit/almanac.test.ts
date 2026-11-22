import { describe, expect, it } from 'vitest';
import { bucketInk, moonPath, moonPhase, yearProgress } from '../../src/lib/domain/almanac';
import type { DateKey } from '../../src/lib/util/dates';

const D = (s: string) => s as DateKey;

describe('almanac: moon', () => {
  it('names the phase on known 2026 dates', () => {
    expect(moonPhase(D('2026-01-03')).name).toBe('Full moon');
    expect(moonPhase(D('2026-01-18')).name).toBe('New moon');
    expect(moonPhase(D('2026-11-17')).name).toBe('First quarter');
    expect(moonPhase(D('2026-11-24')).name).toBe('Full moon');
    expect(moonPhase(D('2026-12-01')).name).toBe('Last quarter');
  });
  it('is fully lit at full moon and dark at new moon', () => {
    expect(moonPhase(D('2026-11-24')).illumination).toBeGreaterThan(0.95);
    expect(moonPhase(D('2026-01-18')).illumination).toBeLessThan(0.05);
    expect(moonPath(0)).toBe('');
    expect(moonPath(0.5)).toMatch(/^M12\.00,3\.00 A9\.00,9\.00 0 0 0 12\.00,21\.00/); // full: lit limb on the left half + a full right bulge
    expect(moonPath(0.1)).toContain(' 0 0 1 12.00,21.00'); // waxing: the lit limb is on the right
  });
});

describe('almanac: the year so far', () => {
  it('counts the day of the year and what is left, leap years included', () => {
    expect(yearProgress(D('2026-01-01'))).toMatchObject({ dayOfYear: 1, daysInYear: 365, left: 364 });
    expect(yearProgress(D('2026-11-23'))).toMatchObject({ dayOfYear: 327, left: 38 });
    expect(yearProgress(D('2028-12-31'))).toMatchObject({ dayOfYear: 366, daysInYear: 366, left: 0 });
  });
});

describe('almanac: the year in ink', () => {
  it('puts each record on its own day and scores 25 focus minutes as one mark', () => {
    const days = bucketInk(D('2026-11-01'), D('2026-11-03'), {
      tasksDone: [{ completedOn: D('2026-11-01') }, { completedOn: D('2026-11-01') }, { completedOn: null }, { completedOn: D('2026-10-31') }],
      habitLogs: [{ date: D('2026-11-02') }],
      focus: [{ date: D('2026-11-02'), seconds: 30 * 60 }, { date: D('2026-11-02'), seconds: 25 * 60 }],
      reading: [{ date: D('2026-11-03') }],
      notes: [],
    });
    expect(days.map((d) => d.date)).toEqual(['2026-11-01', '2026-11-02', '2026-11-03']);
    expect(days[0]).toMatchObject({ tasks: 2, score: 2 });
    expect(days[1]).toMatchObject({ habits: 1, focusMin: 55, score: 3 }); // 1 habit + floor(55/25)
    expect(days[2]).toMatchObject({ reading: 1, score: 1 });
  });
  it('leaves a day with nothing recorded blank', () => {
    const [d] = bucketInk(D('2026-11-05'), D('2026-11-05'), { tasksDone: [], habitLogs: [], focus: [], reading: [], notes: [] });
    expect(d!.score).toBe(0);
  });
});
