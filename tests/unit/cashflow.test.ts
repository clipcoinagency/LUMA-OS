import { describe, expect, it } from 'vitest';
import { monthlyCashflow, savingsRate } from '../../src/lib/domain/finance';
import type { Transaction } from '../../src/lib/db/schema';
import type { DateKey } from '../../src/lib/util/dates';

const tx = (date: string, type: Transaction['type'], amountMinor: number, currency = 'USD'): Transaction => ({ id: date + type + amountMinor, date: date as DateKey, type, amountMinor, currency, categoryId: null, note: '', createdAt: '', updatedAt: '' });

describe('cashflow', () => {
  it('sums income and spending per month, oldest first, with real zeros', () => {
    const rows = monthlyCashflow([tx('2026-11-01', 'income', 400000), tx('2026-11-03', 'expense', 145000), tx('2026-11-10', 'expense', 5000), tx('2026-09-15', 'income', 100), tx('2026-11-05', 'saving', 25000), tx('2026-11-06', 'expense', 999, 'EUR')], 'USD', 3, '2026-11-20' as DateKey);
    expect(rows.map((r) => r.month)).toEqual(['2026-09-01', '2026-10-01', '2026-11-01']);
    expect(rows[0]).toMatchObject({ incomeMinor: 100, expenseMinor: 0 });
    expect(rows[1]).toMatchObject({ incomeMinor: 0, expenseMinor: 0 });
    expect(rows[2]).toMatchObject({ incomeMinor: 400000, expenseMinor: 150000 });   // savings and other currencies are not spending
  });
  it('crosses a year boundary and ignores bad rows', () => {
    const rows = monthlyCashflow([tx('2025-12-31', 'expense', 700), tx('2026-01-02', 'expense', -50), tx('2026-01-03', 'expense', NaN)], 'USD', 2, '2026-01-15' as DateKey);
    expect(rows.map((r) => [r.month, r.expenseMinor])).toEqual([['2025-12-01', 700], ['2026-01-01', 0]]);
  });
  it('savings rate is the share of income kept, or null without income', () => {
    expect(savingsRate(400000, 150000)).toBeCloseTo(0.625);
    expect(savingsRate(1000, 1500)).toBeCloseTo(-0.5);
    expect(savingsRate(0, 500)).toBeNull();
  });
});
