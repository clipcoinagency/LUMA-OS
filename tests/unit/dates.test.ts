import { describe, expect, it } from 'vitest';
import { addDays, addMonths, diffDays, eachDay, endOfMonth, isDateKey, startOfWeek, toDateKey } from '../../src/lib/util/dates';

describe('date keys', () => {
  it('uses the local calendar day, not UTC', () => {
    expect(toDateKey(new Date(2026, 8, 15, 23, 59))).toBe('2026-09-15');
    expect(toDateKey(new Date(2026, 8, 16, 0, 1))).toBe('2026-09-16');
  });
  it('does day arithmetic across month/year/DST/leap boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(diffDays('2026-03-01', '2026-04-01')).toBe(31);
    expect(diffDays('2026-11-02', '2026-10-31')).toBe(-2);
  });
  it('clamps month arithmetic to the month length', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-03-15', -3)).toBe('2025-12-15');
    expect(endOfMonth('2026-02-10')).toBe('2026-02-28');
  });
  it('validates keys strictly', () => {
    expect(isDateKey('2026-09-26')).toBe(true);
    expect(isDateKey('2026-02-30')).toBe(false);
    expect(isDateKey('2026-9-26')).toBe(false);
    expect(isDateKey(20260926)).toBe(false);
  });
  it('computes week starts and day ranges', () => {
    expect(startOfWeek('2026-09-26', 1)).toBe('2026-09-21'); // Saturday → Monday
    expect(startOfWeek('2026-09-26', 0)).toBe('2026-09-20'); // → Sunday
    expect(eachDay('2026-09-29', '2026-10-02')).toEqual(['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02']);
  });
});
