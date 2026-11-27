import { describe, expect, it, beforeEach } from 'vitest';
import { closeDB, getAll } from '../../src/lib/db/idb';
import { addDebt, debtViews, deleteDebt, deletePayment, dueLabel, loadDebtViews, personBalances, recordPayment, restoreDebt, settleInFull, totalsByCurrency, updateDebt } from '../../src/lib/domain/debts';
import type { Debt, DebtPayment } from '../../src/lib/db/schema';
import type { DateKey } from '../../src/lib/util/dates';

const D = (s: string) => s as DateKey;
const debt = (over: Partial<Debt> = {}): Debt => ({ id: 'd1', person: 'Sam', direction: 'owe', amountMinor: 10000, currency: 'USD', date: D('2026-11-01'), dueDate: null, note: '', settledOn: null, createdAt: '2026-11-01T00:00:00Z', updatedAt: '', ...over });
const pay = (over: Partial<DebtPayment> = {}): DebtPayment => ({ id: 'p1', debtId: 'd1', date: D('2026-11-05'), amountMinor: 2500, note: '', createdAt: '2026-11-05T00:00:00Z', ...over });

describe('debts: balances', () => {
  it('balance is the amount minus repayments, and progress is the repaid share', () => {
    const [v] = debtViews([debt()], [pay(), pay({ id: 'p2', amountMinor: 2500 })], D('2026-11-10'));
    expect(v).toMatchObject({ paidMinor: 5000, balanceMinor: 5000, progress: 0.5, status: 'open', daysToDue: null });
  });
  it('is settled at zero balance, or when marked settled', () => {
    expect(debtViews([debt()], [pay({ amountMinor: 10000 })], D('2026-11-10'))[0]).toMatchObject({ status: 'settled', balanceMinor: 0, progress: 1 });
    expect(debtViews([debt({ settledOn: D('2026-11-09') })], [], D('2026-11-10'))[0]).toMatchObject({ status: 'settled', balanceMinor: 0 });
  });
  it('never lets repayments exceed the amount, and ignores bad rows', () => {
    const [v] = debtViews([debt()], [pay({ amountMinor: 99999 }), pay({ id: 'p2', amountMinor: -5 }), pay({ id: 'p3', amountMinor: NaN })], D('2026-11-10'));
    expect(v!.paidMinor).toBe(10000);
    expect(v!.balanceMinor).toBe(0);
  });
  it('flags overdue and counts days to the due date', () => {
    const late = debtViews([debt({ dueDate: D('2026-11-07') })], [], D('2026-11-10'))[0]!;
    expect(late).toMatchObject({ status: 'overdue', daysToDue: -3 });
    expect(dueLabel(late)).toBe('3 days overdue');
    const soon = debtViews([debt({ dueDate: D('2026-11-12') })], [], D('2026-11-10'))[0]!;
    expect(soon).toMatchObject({ status: 'open', daysToDue: 2 });
    expect(dueLabel(soon)).toBe('Due in 2 days');
    expect(dueLabel(debtViews([debt({ dueDate: D('2026-11-10') })], [], D('2026-11-10'))[0]!)).toBe('Due today');
    expect(dueLabel(debtViews([debt()], [], D('2026-11-10'))[0]!)).toBeNull();
  });
  it('sorts overdue first, then soonest due, settled last', () => {
    const views = debtViews([
      debt({ id: 'settled', settledOn: D('2026-11-02') }),
      debt({ id: 'none' }),
      debt({ id: 'soon', dueDate: D('2026-11-12') }),
      debt({ id: 'late', dueDate: D('2026-11-01') }),
    ], [], D('2026-11-10'));
    expect(views.map((v) => v.debt.id)).toEqual(['late', 'soon', 'none', 'settled']);
  });
});

describe('debts: totals', () => {
  const views = debtViews([
    debt({ id: 'a', direction: 'owe', amountMinor: 10000 }),
    debt({ id: 'b', direction: 'owed', amountMinor: 30000, person: 'Priya' }),
    debt({ id: 'c', direction: 'owed', amountMinor: 5000, currency: 'EUR', person: 'Luca' }),
    debt({ id: 'd', direction: 'owe', amountMinor: 9999, settledOn: D('2026-11-02') }),
  ], [pay({ debtId: 'b', amountMinor: 10000 })], D('2026-11-10'));
  it('totals per currency, open debts only, preferred currency first', () => {
    const t = totalsByCurrency(views, 'USD');
    expect(t.map((x) => x.currency)).toEqual(['USD', 'EUR']);
    expect(t[0]).toMatchObject({ oweMinor: 10000, owedMinor: 20000, netMinor: 10000, openCount: 2 });
    expect(t[1]).toMatchObject({ oweMinor: 0, owedMinor: 5000, netMinor: 5000 });
  });
  it('always lists the preferred currency, even with nothing in it', () => {
    expect(totalsByCurrency([], 'JPY')).toEqual([{ currency: 'JPY', oweMinor: 0, owedMinor: 0, netMinor: 0, openCount: 0, overdueCount: 0 }]);
  });
  it('nets what one person owes you against what you owe them', () => {
    const nets = personBalances(debtViews([
      debt({ id: 'a', person: 'Sam', direction: 'owed', amountMinor: 5000 }),
      debt({ id: 'b', person: ' sam ', direction: 'owe', amountMinor: 2000 }),
      debt({ id: 'c', person: 'Ana', direction: 'owe', amountMinor: 9000 }),
    ], [], D('2026-11-10')));
    expect(nets).toEqual([{ person: 'Ana', currency: 'USD', netMinor: -9000, openCount: 1 }, { person: 'Sam', currency: 'USD', netMinor: 3000, openCount: 2 }]);
  });
});

describe('debts: storage', () => {
  beforeEach(async () => { await closeDB(); indexedDB.deleteDatabase('lifeos'); });

  it('adds a debt, records repayments and settles it when the balance reaches zero', async () => {
    const d = await addDebt({ person: '  Sam ', direction: 'owe', amountMinor: 10000, currency: 'USD', date: D('2026-11-01'), dueDate: D('2026-12-01'), note: ' rent ' });
    expect(d).toMatchObject({ person: 'Sam', note: 'rent', settledOn: null });
    await recordPayment(d.id, 4000, D('2026-11-05'));
    let [v] = await loadDebtViews(D('2026-11-06'));
    expect(v).toMatchObject({ paidMinor: 4000, balanceMinor: 6000, status: 'open' });
    await recordPayment(d.id, 6000, D('2026-11-20'), 'last bit');
    [v] = await loadDebtViews(D('2026-11-21'));
    expect(v).toMatchObject({ status: 'settled', balanceMinor: 0, debt: { settledOn: '2026-11-20' } });
  });

  it('refuses a repayment larger than the balance, and invalid input', async () => {
    const d = await addDebt({ person: 'Sam', direction: 'owed', amountMinor: 1000, currency: 'USD' });
    await expect(recordPayment(d.id, 1001)).rejects.toThrow(/more than the remaining/);
    await expect(recordPayment(d.id, 0)).rejects.toThrow();
    await expect(recordPayment('nope', 100)).rejects.toThrow(/no longer exists/);
    await expect(addDebt({ person: '  ', direction: 'owe', amountMinor: 100, currency: 'USD' })).rejects.toThrow();
    await expect(addDebt({ person: 'A', direction: 'owe', amountMinor: 0, currency: 'USD' })).rejects.toThrow();
    await expect(addDebt({ person: 'A', direction: 'owe', amountMinor: 100, currency: 'USD', date: D('2026-11-10'), dueDate: D('2026-11-01') })).rejects.toThrow(/due date/);
    expect(await getAll('debt_payments')).toHaveLength(0);
  });

  it('settle in full pays the remainder as one dated repayment', async () => {
    const d = await addDebt({ person: 'Sam', direction: 'owed', amountMinor: 5000, currency: 'USD', date: D('2026-11-01') });
    await recordPayment(d.id, 1500, D('2026-11-02'));
    const p = await settleInFull(d.id, D('2026-11-09'));
    expect(p).toMatchObject({ amountMinor: 3500, date: '2026-11-09', note: 'Settled in full' });
    expect((await loadDebtViews(D('2026-11-10')))[0]).toMatchObject({ status: 'settled', paidMinor: 5000 });
    expect(await settleInFull(d.id)).toBeNull(); // nothing left
  });

  it('deleting a repayment reopens a settled debt', async () => {
    const d = await addDebt({ person: 'Sam', direction: 'owe', amountMinor: 2000, currency: 'USD', date: D('2026-11-01') });
    const p = await recordPayment(d.id, 2000, D('2026-11-03'));
    expect((await loadDebtViews(D('2026-11-04')))[0]!.status).toBe('settled');
    await deletePayment(p.id);
    expect((await loadDebtViews(D('2026-11-04')))[0]).toMatchObject({ status: 'open', balanceMinor: 2000, debt: { settledOn: null } });
  });

  it('editing keeps the repayments, refuses an amount below what was repaid, and settles an exact match', async () => {
    const d = await addDebt({ person: 'Sam', direction: 'owe', amountMinor: 10000, currency: 'USD', date: D('2026-11-01') });
    await recordPayment(d.id, 6000, D('2026-11-02'));
    await expect(updateDebt(d, { person: 'Sam', direction: 'owe', amountMinor: 5000, currency: 'USD', date: d.date }, 6000)).rejects.toThrow(/already been repaid/);
    const next = await updateDebt(d, { person: 'Samuel', direction: 'owe', amountMinor: 6000, currency: 'USD', date: d.date }, 6000);
    expect(next).toMatchObject({ person: 'Samuel', settledOn: d.date });
    expect((await loadDebtViews(D('2026-11-10')))[0]).toMatchObject({ status: 'settled', paidMinor: 6000 });
  });

  it('delete removes the debt with its repayments and Undo brings everything back', async () => {
    const d = await addDebt({ person: 'Sam', direction: 'owe', amountMinor: 10000, currency: 'USD' });
    await recordPayment(d.id, 1000);
    await recordPayment(d.id, 2000);
    const gone = await deleteDebt(d.id);
    expect(gone?.payments).toHaveLength(2);
    expect(await getAll('debts')).toHaveLength(0);
    expect(await getAll('debt_payments')).toHaveLength(0);
    await restoreDebt(gone!);
    expect((await loadDebtViews())[0]).toMatchObject({ paidMinor: 3000, balanceMinor: 7000 });
  });
});
