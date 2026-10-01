// Finance maths — correctness first. Integer minor units only; never mixes currencies.
import { endOfMonth, nowIso, startOfMonth, today, type DateKey } from '../util/dates';
import { newId } from '../util/ids';
import { getAll, getRange, put } from '../db/idb';
import { bump } from '../db/changes.svelte';
import type { FinanceCategory, Transaction, TransactionType } from '../db/schema';

export interface CategoryTotal { categoryId: string | null; amountMinor: number }

export interface PeriodSummary {
  currency: string;
  incomeMinor: number;
  expenseMinor: number;
  savingMinor: number;
  /** income − expenses − savings: what's left to spend */
  balanceMinor: number;
  byCategory: CategoryTotal[];        // expenses, largest first
  count: number;
  otherCurrencyCount: number;         // transactions excluded because of a different currency
}

export function summarize(txns: Transaction[], currency: string): PeriodSummary {
  let income = 0, expense = 0, saving = 0, other = 0, count = 0;
  const cats = new Map<string | null, number>();
  for (const t of txns) {
    if (t.currency !== currency) { other++; continue; }
    if (!Number.isSafeInteger(t.amountMinor) || t.amountMinor < 0) continue; // defensive: bad row never corrupts totals
    count++;
    if (t.type === 'income') income += t.amountMinor;
    else if (t.type === 'saving') saving += t.amountMinor;
    else {
      expense += t.amountMinor;
      cats.set(t.categoryId, (cats.get(t.categoryId) ?? 0) + t.amountMinor);
    }
  }
  const byCategory = [...cats].map(([categoryId, amountMinor]) => ({ categoryId, amountMinor })).sort((a, b) => b.amountMinor - a.amountMinor);
  return { currency, incomeMinor: income, expenseMinor: expense, savingMinor: saving, balanceMinor: income - expense - saving, byCategory, count, otherCurrencyCount: other };
}

export async function transactionsInRange(from: DateKey, to: DateKey): Promise<Transaction[]> {
  return getRange('transactions', 'by_date', from, to);
}

export async function monthSummary(currency: string, day: DateKey = today()): Promise<PeriodSummary> {
  return summarize(await transactionsInRange(startOfMonth(day), endOfMonth(day)), currency);
}

export async function listCategories(): Promise<FinanceCategory[]> {
  return (await getAll('finance_categories')).filter((c) => !c.archived).sort((a, b) => a.order - b.order);
}

export async function addTransaction(input: { type: TransactionType; amountMinor: number; currency: string; categoryId: string | null; note?: string; date?: DateKey }): Promise<Transaction> {
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) throw new Error('Amount must be a positive whole number of minor units');
  const at = nowIso();
  const t: Transaction = { id: newId('tx'), date: input.date ?? today(), type: input.type, amountMinor: input.amountMinor, currency: input.currency, categoryId: input.categoryId, note: input.note ?? '', createdAt: at, updatedAt: at };
  await put('transactions', t);
  bump();
  return t;
}

// ---------------------------------------------------------------- budgets & trends (v2)

export interface BudgetRow {
  category: FinanceCategory;
  spentMinor: number;
  budgetMinor: number;
  /** spent ÷ budget (can exceed 1) */
  ratio: number;
  status: 'ok' | 'near' | 'over';
}

/** Budgets are per expense category, per month. 'near' = 80% or more used. */
export function budgetStatus(summary: Pick<PeriodSummary, 'byCategory'>, categories: FinanceCategory[]): BudgetRow[] {
  const spent = new Map(summary.byCategory.map((c) => [c.categoryId, c.amountMinor]));
  return categories
    .filter((c) => c.type === 'expense' && !c.archived && typeof c.budgetMinor === 'number' && c.budgetMinor > 0)
    .map((category) => {
      const budgetMinor = category.budgetMinor as number;
      const spentMinor = spent.get(category.id) ?? 0;
      const ratio = spentMinor / budgetMinor;
      return { category, spentMinor, budgetMinor, ratio, status: ratio > 1 ? 'over' as const : ratio >= 0.8 ? 'near' as const : 'ok' as const };
    })
    .sort((a, b) => b.ratio - a.ratio);
}

/** Expense totals for each of the last `months` months (ending with the month of `day`), oldest first. */
export function monthlyExpenseSeries(txns: Transaction[], currency: string, months: number, day: DateKey = today()): { month: DateKey; expenseMinor: number }[] {
  const out: { month: DateKey; expenseMinor: number }[] = [];
  const [y, m] = day.split('-').map(Number) as [number, number];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const total = txns.filter((t) => t.type === 'expense' && t.currency === currency && t.date.startsWith(key)).reduce((n, t) => n + t.amountMinor, 0);
    out.push({ month: `${key}-01` as DateKey, expenseMinor: total });
  }
  return out;
}
