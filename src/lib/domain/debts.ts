// Debts: money you borrowed (you owe) and money you lent (they owe you). Integer minor units only; currencies are
// never mixed. The balance is never stored — it is the original amount minus the repayment rows — so history is
// always consistent and a mistaken repayment can simply be deleted.
import { diffDays, nowIso, today, type DateKey } from '../util/dates';
import { newId } from '../util/ids';
import { getAll, put, transact } from '../db/idb';
import { bump } from '../db/changes.svelte';
import type { Debt, DebtDirection, DebtPayment } from '../db/schema';

export type DebtStatus = 'open' | 'overdue' | 'settled';

export interface DebtView {
  debt: Debt;
  payments: DebtPayment[];        // newest first
  paidMinor: number;
  balanceMinor: number;
  /** 0–1: how much has been repaid */
  progress: number;
  status: DebtStatus;
  /** days until due (negative = overdue); null when there is no due date or it is settled */
  daysToDue: number | null;
}

export interface DebtTotals {
  currency: string;
  /** what you still owe other people */
  oweMinor: number;
  /** what other people still owe you */
  owedMinor: number;
  /** owed − owe: positive means you are net owed money */
  netMinor: number;
  openCount: number;
  overdueCount: number;
}

export interface PersonBalance {
  person: string;
  currency: string;
  /** positive: they owe you · negative: you owe them */
  netMinor: number;
  openCount: number;
}

const safe = (n: number) => (Number.isSafeInteger(n) && n > 0 ? n : 0);

/** Combine each debt with its repayments. Bad rows (negative or unsafe amounts) never corrupt a total. */
export function debtViews(debts: Debt[], payments: DebtPayment[], on: DateKey = today()): DebtView[] {
  const by = new Map<string, DebtPayment[]>();
  for (const p of payments) by.set(p.debtId, [...(by.get(p.debtId) ?? []), p]);
  const out = debts.map((debt): DebtView => {
    const mine = (by.get(debt.id) ?? []).slice().sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
    const principal = safe(debt.amountMinor);
    const paid = Math.min(principal, mine.reduce((s, p) => s + safe(p.amountMinor), 0));
    const balance = principal - paid;
    const settled = balance === 0 || debt.settledOn !== null;
    const daysToDue = !settled && debt.dueDate ? diffDays(on, debt.dueDate) : null;
    return {
      debt, payments: mine, paidMinor: paid, balanceMinor: settled ? 0 : balance,
      progress: principal ? paid / principal : 1,
      status: settled ? 'settled' : daysToDue !== null && daysToDue < 0 ? 'overdue' : 'open',
      daysToDue,
    };
  });
  return sortViews(out);
}

/** Open debts first (overdue, then soonest due, then newest), settled ones last (most recently settled first). */
export function sortViews(views: DebtView[]): DebtView[] {
  const rank = (v: DebtView) => (v.status === 'overdue' ? 0 : v.status === 'open' ? 1 : 2);
  return views.slice().sort((a, b) => {
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    if (a.status === 'settled') return (b.debt.settledOn ?? '').localeCompare(a.debt.settledOn ?? '') || b.debt.date.localeCompare(a.debt.date);
    const da = a.daysToDue ?? Infinity, db = b.daysToDue ?? Infinity;
    if (da !== db) return da - db;
    return b.debt.date.localeCompare(a.debt.date) || b.debt.createdAt.localeCompare(a.debt.createdAt);
  });
}

/** One row per currency present among the OPEN debts (the preferred currency always first, even if empty). */
export function totalsByCurrency(views: DebtView[], preferred: string): DebtTotals[] {
  const m = new Map<string, DebtTotals>();
  const row = (c: string) => { let r = m.get(c); if (!r) { r = { currency: c, oweMinor: 0, owedMinor: 0, netMinor: 0, openCount: 0, overdueCount: 0 }; m.set(c, r); } return r; };
  row(preferred);
  for (const v of views) {
    if (v.status === 'settled') continue;
    const r = row(v.debt.currency);
    if (v.debt.direction === 'owe') r.oweMinor += v.balanceMinor; else r.owedMinor += v.balanceMinor;
    r.openCount++;
    if (v.status === 'overdue') r.overdueCount++;
  }
  for (const r of m.values()) r.netMinor = r.owedMinor - r.oweMinor;
  return [...m.values()].sort((a, b) => (a.currency === preferred ? -1 : b.currency === preferred ? 1 : b.openCount - a.openCount || a.currency.localeCompare(b.currency)));
}

const key = (name: string) => name.trim().toLocaleLowerCase();

/** Net position per person (and currency), so "Sam owes me 50, I owe Sam 20" reads as "Sam owes you 30". Largest first. */
export function personBalances(views: DebtView[]): PersonBalance[] {
  const m = new Map<string, PersonBalance>();
  for (const v of views) {
    if (v.status === 'settled' || v.balanceMinor === 0) continue;
    const k = `${key(v.debt.person)}|${v.debt.currency}`;
    const r = m.get(k) ?? { person: v.debt.person.trim(), currency: v.debt.currency, netMinor: 0, openCount: 0 };
    r.netMinor += v.debt.direction === 'owed' ? v.balanceMinor : -v.balanceMinor;
    r.openCount++;
    m.set(k, r);
  }
  return [...m.values()].sort((a, b) => Math.abs(b.netMinor) - Math.abs(a.netMinor) || a.person.localeCompare(b.person));
}

/** "Due in 3 days" · "Due today" · "5 days overdue" · null when there is nothing to say. */
export function dueLabel(v: DebtView): string | null {
  const n = v.daysToDue;
  if (n === null) return null;
  if (n === 0) return 'Due today';
  if (n === 1) return 'Due tomorrow';
  if (n > 1) return `Due in ${n} days`;
  return n === -1 ? '1 day overdue' : `${-n} days overdue`;
}

// ---------------------------------------------------------------- writes

export interface DebtInput {
  person: string;
  direction: DebtDirection;
  amountMinor: number;
  currency: string;
  date?: DateKey;
  dueDate?: DateKey | null;
  note?: string;
}

function clean(input: DebtInput) {
  const person = input.person.trim();
  if (!person) throw new Error('Who is this with?');
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) throw new Error('Amount must be a positive whole number of minor units');
  const date = input.date ?? today();
  if (input.dueDate && input.dueDate < date) throw new Error('The due date can’t be before the day it started.');
  return { person, date };
}

export async function addDebt(input: DebtInput): Promise<Debt> {
  const { person, date } = clean(input);
  const at = nowIso();
  const d: Debt = { id: newId('debt'), person, direction: input.direction, amountMinor: input.amountMinor, currency: input.currency, date, dueDate: input.dueDate ?? null, note: (input.note ?? '').trim(), settledOn: null, createdAt: at, updatedAt: at };
  await put('debts', d);
  bump();
  return d;
}

/** Edit a debt. Lowering the amount below what has already been repaid is refused. */
export async function updateDebt(debt: Debt, input: DebtInput, paidMinor: number): Promise<Debt> {
  const { person, date } = clean(input);
  if (input.amountMinor < paidMinor) throw new Error('That is less than has already been repaid. Delete or change a repayment first.');
  const next: Debt = {
    ...debt, person, direction: input.direction, amountMinor: input.amountMinor, currency: input.currency, date, dueDate: input.dueDate ?? null, note: (input.note ?? '').trim(),
    settledOn: input.amountMinor === paidMinor ? debt.settledOn ?? date : null,
    updatedAt: nowIso(),
  };
  await put('debts', next);
  bump();
  return next;
}

/** Record a repayment. Refuses more than the remaining balance; settles the debt when it reaches zero. */
export async function recordPayment(debtId: string, amountMinor: number, date: DateKey = today(), note = ''): Promise<DebtPayment> {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) throw new Error('Amount must be a positive whole number of minor units');
  const [debts, payments] = await Promise.all([getAll('debts'), getAll('debt_payments')]);
  const debt = debts.find((d) => d.id === debtId);
  if (!debt) throw new Error('That debt no longer exists.');
  const paid = payments.filter((p) => p.debtId === debtId).reduce((s, p) => s + safe(p.amountMinor), 0);
  if (amountMinor > debt.amountMinor - paid) throw new Error('That is more than the remaining balance.');
  const row: DebtPayment = { id: newId('dpay'), debtId, date, amountMinor, note: note.trim(), createdAt: nowIso() };
  const settled = paid + amountMinor === debt.amountMinor;
  await transact<void>(['debts', 'debt_payments'], 'readwrite', (t) => {
    t.objectStore('debt_payments').put(row);
    if (settled) t.objectStore('debts').put({ ...debt, settledOn: date, updatedAt: nowIso() });
  });
  bump();
  return row;
}

/** Pay off whatever is left, as one dated repayment. */
export async function settleInFull(debtId: string, date: DateKey = today()): Promise<DebtPayment | null> {
  const [debts, payments] = await Promise.all([getAll('debts'), getAll('debt_payments')]);
  const debt = debts.find((d) => d.id === debtId);
  if (!debt) return null;
  const paid = payments.filter((p) => p.debtId === debtId).reduce((s, p) => s + safe(p.amountMinor), 0);
  const left = debt.amountMinor - paid;
  if (left <= 0) return null;
  return recordPayment(debtId, left, date, 'Settled in full');
}

/** Delete a repayment; the debt reopens if that brings the balance back above zero. */
export async function deletePayment(paymentId: string): Promise<DebtPayment | undefined> {
  const [debts, payments] = await Promise.all([getAll('debts'), getAll('debt_payments')]);
  const pay = payments.find((p) => p.id === paymentId);
  if (!pay) return undefined;
  const debt = debts.find((d) => d.id === pay.debtId);
  await transact<void>(['debts', 'debt_payments'], 'readwrite', (t) => {
    t.objectStore('debt_payments').delete(paymentId);
    if (debt && debt.settledOn !== null) t.objectStore('debts').put({ ...debt, settledOn: null, updatedAt: nowIso() });
  });
  bump();
  return pay;
}

export interface DeletedDebt { debt: Debt; payments: DebtPayment[] }

/** Delete a debt together with its repayments. Returns what was removed so the UI can offer Undo. */
export async function deleteDebt(debtId: string): Promise<DeletedDebt | undefined> {
  const [debts, payments] = await Promise.all([getAll('debts'), getAll('debt_payments')]);
  const debt = debts.find((d) => d.id === debtId);
  if (!debt) return undefined;
  const mine = payments.filter((p) => p.debtId === debtId);
  await transact<void>(['debts', 'debt_payments'], 'readwrite', (t) => {
    for (const p of mine) t.objectStore('debt_payments').delete(p.id);
    t.objectStore('debts').delete(debtId);
  });
  bump();
  return { debt, payments: mine };
}

export async function restoreDebt(d: DeletedDebt): Promise<void> {
  await transact<void>(['debts', 'debt_payments'], 'readwrite', (t) => {
    t.objectStore('debts').put(d.debt);
    for (const p of d.payments) t.objectStore('debt_payments').put(p);
  });
  bump();
}

export async function loadDebtViews(on: DateKey = today()): Promise<DebtView[]> {
  const [debts, payments] = await Promise.all([getAll('debts'), getAll('debt_payments')]);
  return debtViews(debts, payments, on);
}

/** Put a deleted repayment back (Undo). Re-settles the debt if that brings the balance to zero. */
export async function restorePayment(pay: DebtPayment): Promise<void> {
  const [debts, payments] = await Promise.all([getAll('debts'), getAll('debt_payments')]);
  const debt = debts.find((d) => d.id === pay.debtId);
  if (!debt) return;
  const paid = payments.filter((p) => p.debtId === pay.debtId && p.id !== pay.id).reduce((s, p) => s + safe(p.amountMinor), 0) + safe(pay.amountMinor);
  await transact<void>(['debts', 'debt_payments'], 'readwrite', (t) => {
    t.objectStore('debt_payments').put(pay);
    if (paid >= debt.amountMinor) t.objectStore('debts').put({ ...debt, settledOn: pay.date, updatedAt: nowIso() });
  });
  bump();
}
