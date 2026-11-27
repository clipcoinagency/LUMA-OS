import { describe, expect, it, beforeEach } from 'vitest';
import { closeDB, getAll } from '../../src/lib/db/idb';
import { addBill, billTotals, billViews, deleteBill, dueText, loadBillViews, monthlyEquivalent, nextOccurrence, payBill, restoreBill, undoPayBill, updateBill, yearlyEquivalent } from '../../src/lib/domain/bills';
import type { Bill } from '../../src/lib/db/schema';
import type { DateKey } from '../../src/lib/util/dates';

const D = (s: string) => s as DateKey;
const bill = (over: Partial<Bill> = {}): Bill => ({ id: 'b1', name: 'Netflix', amountMinor: 1599, currency: 'USD', cadence: 'monthly', anchor: D('2026-11-30'), nextDue: D('2026-11-30'), categoryId: null, note: '', paused: false, createdAt: '', updatedAt: '', ...over });

describe('bills: maths', () => {
  it('converts every cadence to a monthly and a yearly cost', () => {
    expect(monthlyEquivalent(1000, 'monthly')).toBe(1000);
    expect(monthlyEquivalent(12000, 'yearly')).toBe(1000);
    expect(monthlyEquivalent(1000, 'weekly')).toBe(4333);
    expect(yearlyEquivalent(1000, 'weekly')).toBe(52000);
    expect(yearlyEquivalent(1000, 'monthly')).toBe(12000);
    expect(yearlyEquivalent(12000, 'yearly')).toBe(12000);
    expect(monthlyEquivalent(-5, 'monthly')).toBe(0);
  });
  it('keeps the day of the month: the 31st survives a short month', () => {
    const b = { cadence: 'monthly' as const, anchor: D('2026-01-31') };
    expect(nextOccurrence(b, D('2026-01-31'))).toBe('2026-02-28');
    expect(nextOccurrence(b, D('2026-02-28'))).toBe('2026-03-31');
    expect(nextOccurrence(b, D('2026-03-31'))).toBe('2026-04-30');
    expect(nextOccurrence(b, D('2026-04-30'))).toBe('2026-05-31');
  });
  it('moves weekly by 7 days and yearly by a year (leap day safe)', () => {
    expect(nextOccurrence({ cadence: 'weekly', anchor: D('2026-11-02') }, D('2026-11-30'))).toBe('2026-12-07');
    const y = { cadence: 'yearly' as const, anchor: D('2024-02-29') };
    expect(nextOccurrence(y, D('2024-02-29'))).toBe('2025-02-28');
    expect(nextOccurrence(y, D('2027-02-28'))).toBe('2028-02-29');
  });
  it('always moves strictly forward, even from a date long past', () => {
    expect(nextOccurrence({ cadence: 'monthly', anchor: D('2026-01-15') }, D('2026-09-02'))).toBe('2026-09-15');
  });
  it('classifies overdue, soon, later and paused, in due order', () => {
    const v = billViews([
      bill({ id: 'later', nextDue: D('2026-12-20') }), bill({ id: 'paused', paused: true, nextDue: D('2026-11-01') }),
      bill({ id: 'soon', nextDue: D('2026-11-30') }), bill({ id: 'late', nextDue: D('2026-11-20') }), bill({ id: 'today', nextDue: D('2026-11-27') }),
    ], D('2026-11-27'));
    expect(v.map((x) => [x.bill.id, x.status])).toEqual([['late', 'overdue'], ['today', 'soon'], ['soon', 'soon'], ['later', 'later'], ['paused', 'paused']]);
    expect(dueText(v[0]!)).toBe('7 days overdue');
    expect(dueText(v[1]!)).toBe('Due today');
    expect(dueText(v[4]!)).toBe('Paused');
  });
  it('totals active bills per currency and what is due this week', () => {
    const v = billViews([
      bill({ id: 'a', amountMinor: 145000, nextDue: D('2026-11-28') }),
      bill({ id: 'b', amountMinor: 12000, cadence: 'yearly', nextDue: D('2027-03-01') }),
      bill({ id: 'c', amountMinor: 999, currency: 'EUR', nextDue: D('2026-11-20') }),
      bill({ id: 'd', amountMinor: 5000, paused: true }),
    ], D('2026-11-27'));
    const t = billTotals(v, 'USD');
    expect(t.map((x) => x.currency)).toEqual(['USD', 'EUR']);
    expect(t[0]).toMatchObject({ monthlyMinor: 146000, yearlyMinor: 145000 * 12 + 12000, dueSoonMinor: 145000, dueSoonCount: 1, activeCount: 2 });
    expect(t[1]).toMatchObject({ dueSoonMinor: 999, dueSoonCount: 1 });
    expect(billTotals([], 'JPY')[0]).toMatchObject({ currency: 'JPY', activeCount: 0 });
  });
});

describe('bills: storage', () => {
  beforeEach(async () => { await closeDB(); indexedDB.deleteDatabase('lifeos'); });

  it('paying records a real expense and moves the due date; undo reverses both', async () => {
    const b = await addBill({ name: '  Rent ', amountMinor: 145000, currency: 'USD', cadence: 'monthly', nextDue: D('2026-11-30'), categoryId: 'cat1', note: 'flat' });
    expect(b).toMatchObject({ name: 'Rent', anchor: '2026-11-30' });
    const p = await payBill(b.id, D('2026-11-28'));
    expect(p.bill.nextDue).toBe('2026-12-30');
    const tx = await getAll('transactions');
    expect(tx).toHaveLength(1);
    expect(tx[0]).toMatchObject({ type: 'expense', amountMinor: 145000, currency: 'USD', categoryId: 'cat1', note: 'Rent', date: '2026-11-28' });
    await undoPayBill(p);
    expect(await getAll('transactions')).toHaveLength(0);
    expect((await loadBillViews(D('2026-11-28')))[0]!.bill.nextDue).toBe('2026-11-30');
  });

  it('refuses bad input and a bill that no longer exists', async () => {
    await expect(addBill({ name: ' ', amountMinor: 100, currency: 'USD', cadence: 'monthly', nextDue: D('2026-11-30'), categoryId: null })).rejects.toThrow();
    await expect(addBill({ name: 'x', amountMinor: 0, currency: 'USD', cadence: 'monthly', nextDue: D('2026-11-30'), categoryId: null })).rejects.toThrow();
    await expect(payBill('nope')).rejects.toThrow(/no longer exists/);
  });

  it('re-anchors when the due date changes, keeps the anchor otherwise, and can pause', async () => {
    const b = await addBill({ name: 'Gym', amountMinor: 3000, currency: 'USD', cadence: 'monthly', nextDue: D('2026-01-31'), categoryId: null });
    const same = await updateBill(b, { name: 'Gym', amountMinor: 3500, currency: 'USD', cadence: 'monthly', nextDue: D('2026-01-31'), categoryId: null, paused: true });
    expect(same).toMatchObject({ anchor: '2026-01-31', amountMinor: 3500, paused: true });
    const moved = await updateBill(same, { name: 'Gym', amountMinor: 3500, currency: 'USD', cadence: 'monthly', nextDue: D('2026-02-10'), categoryId: null });
    expect(moved).toMatchObject({ anchor: '2026-02-10', nextDue: '2026-02-10', paused: false });
  });

  it('delete and Undo', async () => {
    const b = await addBill({ name: 'Insurance', amountMinor: 80000, currency: 'USD', cadence: 'yearly', nextDue: D('2027-01-15'), categoryId: null });
    const gone = await deleteBill(b.id);
    expect(await getAll('bills')).toHaveLength(0);
    await restoreBill(gone!);
    expect((await getAll('bills'))[0]).toMatchObject({ name: 'Insurance' });
  });
});
