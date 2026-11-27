// Bills & subscriptions: recurring costs. Integer minor units; currencies are never mixed. Paying a bill records a
// real expense (so Finance totals stay true) and moves the due date on; the previous state is returned so it can be undone.
import { addDays, addMonths, diffDays, fromDateKey, nowIso, today, type DateKey } from '../util/dates';
import { newId } from '../util/ids';
import { getAll, put, transact } from '../db/idb';
import { bump } from '../db/changes.svelte';
import type { Bill, BillCadence, Transaction } from '../db/schema';

export type BillStatus = 'overdue' | 'soon' | 'later' | 'paused';
export const SOON_DAYS = 7;

export interface BillView {
  bill: Bill;
  daysToDue: number;              // negative = overdue
  status: BillStatus;
  /** what this costs per month on average (weekly × 52 ÷ 12, yearly ÷ 12), rounded to whole minor units */
  monthlyMinor: number;
  /** what this costs over a year, exactly (weekly × 52, monthly × 12) */
  yearlyMinor: number;
}

export interface BillTotals {
  currency: string;
  monthlyMinor: number;
  yearlyMinor: number;
  /** due within the next SOON_DAYS days (or already overdue) */
  dueSoonMinor: number;
  dueSoonCount: number;
  activeCount: number;
}

export const CADENCE_LABEL: Record<BillCadence, string> = { weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' };

export function yearlyEquivalent(amountMinor: number, cadence: BillCadence): number {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) return 0;
  return cadence === 'weekly' ? amountMinor * 52 : cadence === 'monthly' ? amountMinor * 12 : amountMinor;
}

export function monthlyEquivalent(amountMinor: number, cadence: BillCadence): number {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) return 0;
  return Math.round(cadence === 'weekly' ? (amountMinor * 52) / 12 : cadence === 'yearly' ? amountMinor / 12 : amountMinor);
}

/** The due date after `current`, keeping the original day of the month (31st → 28th → back to 31st). */
export function nextOccurrence(bill: Pick<Bill, 'cadence' | 'anchor'>, current: DateKey): DateKey {
  if (bill.cadence === 'weekly') return addDays(current, 7);
  const a = fromDateKey(bill.anchor), c = fromDateKey(current);
  const months = (c.getFullYear() - a.getFullYear()) * 12 + (c.getMonth() - a.getMonth());
  const step = bill.cadence === 'yearly' ? 12 : 1;
  let n = Math.floor(months / step);
  let next = addMonths(bill.anchor, n * step);
  while (next <= current) next = addMonths(bill.anchor, (++n) * step); // the first occurrence strictly after current
  return next;
}

export function billViews(bills: Bill[], on: DateKey = today()): BillView[] {
  const out = bills.map((bill): BillView => {
    const daysToDue = diffDays(on, bill.nextDue);
    return { bill, daysToDue, status: bill.paused ? 'paused' : daysToDue < 0 ? 'overdue' : daysToDue <= SOON_DAYS ? 'soon' : 'later', monthlyMinor: monthlyEquivalent(bill.amountMinor, bill.cadence), yearlyMinor: yearlyEquivalent(bill.amountMinor, bill.cadence) };
  });
  const rank = (v: BillView) => (v.status === 'paused' ? 1 : 0);
  return out.sort((a, b) => rank(a) - rank(b) || a.daysToDue - b.daysToDue || a.bill.name.localeCompare(b.bill.name));
}

/** One row per currency among active bills; the preferred currency is always first, even when empty. */
export function billTotals(views: BillView[], preferred: string): BillTotals[] {
  const m = new Map<string, BillTotals>();
  const row = (c: string) => { let r = m.get(c); if (!r) { r = { currency: c, monthlyMinor: 0, yearlyMinor: 0, dueSoonMinor: 0, dueSoonCount: 0, activeCount: 0 }; m.set(c, r); } return r; };
  row(preferred);
  for (const v of views) {
    if (v.status === 'paused') continue;
    const r = row(v.bill.currency);
    r.monthlyMinor += v.monthlyMinor;
    r.yearlyMinor += v.yearlyMinor;
    r.activeCount++;
    if (v.status === 'overdue' || v.status === 'soon') { r.dueSoonMinor += v.bill.amountMinor; r.dueSoonCount++; }
  }
  return [...m.values()].sort((a, b) => (a.currency === preferred ? -1 : b.currency === preferred ? 1 : b.activeCount - a.activeCount || a.currency.localeCompare(b.currency)));
}

export function dueText(v: BillView): string {
  const n = v.daysToDue;
  if (v.status === 'paused') return 'Paused';
  if (n === 0) return 'Due today';
  if (n === 1) return 'Due tomorrow';
  if (n > 1) return `Due in ${n} days`;
  return n === -1 ? '1 day overdue' : `${-n} days overdue`;
}

// ---------------------------------------------------------------- writes

export interface BillInput { name: string; amountMinor: number; currency: string; cadence: BillCadence; nextDue: DateKey; categoryId: string | null; note?: string; paused?: boolean }

function clean(i: BillInput) {
  const name = i.name.trim();
  if (!name) throw new Error('What is this bill called?');
  if (!Number.isSafeInteger(i.amountMinor) || i.amountMinor <= 0) throw new Error('Amount must be a positive whole number of minor units');
  return name;
}

export async function addBill(i: BillInput): Promise<Bill> {
  const name = clean(i);
  const at = nowIso();
  const b: Bill = { id: newId('bill'), name, amountMinor: i.amountMinor, currency: i.currency, cadence: i.cadence, anchor: i.nextDue, nextDue: i.nextDue, categoryId: i.categoryId, note: (i.note ?? '').trim(), paused: !!i.paused, createdAt: at, updatedAt: at };
  await put('bills', b);
  bump();
  return b;
}

/** Edit a bill. Changing the due date (or how often it repeats) re-anchors the schedule on the new date. */
export async function updateBill(bill: Bill, i: BillInput): Promise<Bill> {
  const name = clean(i);
  const rescheduled = i.nextDue !== bill.nextDue || i.cadence !== bill.cadence;
  const next: Bill = { ...bill, name, amountMinor: i.amountMinor, currency: i.currency, cadence: i.cadence, nextDue: i.nextDue, anchor: rescheduled ? i.nextDue : bill.anchor, categoryId: i.categoryId, note: (i.note ?? '').trim(), paused: !!i.paused, updatedAt: nowIso() };
  await put('bills', next);
  bump();
  return next;
}

export interface BillPayment { bill: Bill; tx: Transaction; before: Bill }

/** Mark one cycle as paid: records the expense on `date` and moves nextDue to the following occurrence. */
export async function payBill(billId: string, date: DateKey = today()): Promise<BillPayment> {
  const bill = (await getAll('bills')).find((b) => b.id === billId);
  if (!bill) throw new Error('That bill no longer exists.');
  const at = nowIso();
  const tx: Transaction = { id: newId('tx'), date, type: 'expense', amountMinor: bill.amountMinor, currency: bill.currency, categoryId: bill.categoryId, note: bill.name, createdAt: at, updatedAt: at };
  const next: Bill = { ...bill, nextDue: nextOccurrence(bill, bill.nextDue), updatedAt: at };
  await transact<void>(['bills', 'transactions'], 'readwrite', (t) => { t.objectStore('transactions').put(tx); t.objectStore('bills').put(next); });
  bump();
  return { bill: next, tx, before: bill };
}

/** Undo payBill: remove the expense it recorded and put the bill back on its previous due date. */
export async function undoPayBill(p: BillPayment): Promise<void> {
  await transact<void>(['bills', 'transactions'], 'readwrite', (t) => { t.objectStore('transactions').delete(p.tx.id); t.objectStore('bills').put(p.before); });
  bump();
}

export async function deleteBill(id: string): Promise<Bill | undefined> {
  const bill = (await getAll('bills')).find((b) => b.id === id);
  if (!bill) return undefined;
  await transact<void>('bills', 'readwrite', (t) => { t.objectStore('bills').delete(id); });
  bump();
  return bill;
}

export async function restoreBill(b: Bill): Promise<void> {
  await put('bills', b);
  bump();
}

export async function loadBillViews(on: DateKey = today()): Promise<BillView[]> {
  return billViews(await getAll('bills'), on);
}
