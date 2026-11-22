import { describe, expect, it } from 'vitest';
import { closingSummary, computeSeals, longestRun, moveTarget, SEAL_DEFS } from '../../src/lib/domain/rituals';
import type { DateKey } from '../../src/lib/util/dates';
import type { Task } from '../../src/lib/db/schema';

const D = (s: string) => s as DateKey;

describe('close the day', () => {
  it('sends loose ends to tomorrow, the start of next week, or someday', () => {
    expect(moveTarget(D('2026-11-23'), 'tomorrow')).toBe('2026-11-24');
    expect(moveTarget(D('2026-11-25'), 'next-week', 1)).toBe('2026-11-30'); // Wed → next Monday
    expect(moveTarget(D('2026-11-25'), 'next-week', 0)).toBe('2026-11-29'); // Sunday-first weeks
    expect(moveTarget(D('2026-11-25'), 'someday')).toBeNull();
  });
  it('writes a short factual summary', () => {
    const t = { id: 'x' } as Task;
    expect(closingSummary({ done: [t, t], habitsDone: ['Read'], focusMin: 50 })).toBe('2 tasks done · 1 habit checked · 50m of focus');
    expect(closingSummary({ done: [], habitsDone: [], focusMin: 0 })).toBe('A quiet day.');
  });
});

describe('seals', () => {
  const zero = { tasksDone: 0, focusMin: 0, bestRun: 0, resets: 0, closings: 0, booksFinished: 0, journal: 0, goalsDone: 0, habitChecks: 0 };
  it('earns a seal exactly at its target and caps progress there', () => {
    const s = computeSeals({ ...zero, tasksDone: 10, focusMin: 59.9 });
    expect(s.find((x) => x.id === 'first-page')).toMatchObject({ earned: true, value: 1 });
    expect(s.find((x) => x.id === 'ten-done')).toMatchObject({ earned: true, value: 10 });
    expect(s.find((x) => x.id === 'century')).toMatchObject({ earned: false, value: 10 });
    expect(s.find((x) => x.id === 'deep-hour')).toMatchObject({ earned: false, value: 59 });
  });
  it('starts with nothing earned', () => {
    expect(computeSeals(zero).filter((x) => x.earned)).toEqual([]);
    expect(computeSeals(zero)).toHaveLength(SEAL_DEFS.length);
  });
  it('finds the longest run of active days', () => {
    expect(longestRun([1, 1, 0, 1, 1, 1, 0].map((score) => ({ score })))).toBe(3);
    expect(longestRun([])).toBe(0);
  });
});
