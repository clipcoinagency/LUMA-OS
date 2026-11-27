// Spreadsheet export (CSV) of the user's own records — tasks, money, habit check-ins, focus sessions,
// journal & notes. Opens cleanly in Excel, Numbers and Google Sheets:
//   • UTF-8 with a byte-order mark and CRLF line ends (what Excel expects);
//   • RFC 4180 quoting for commas, quotes and line breaks;
//   • text that starts with = + - @ is prefixed with an apostrophe so a note can never run as a formula;
//   • money is written in major units with the currency's real number of decimals (¥ 0, $ 2, KWD 3).
import { getAll } from '../db/idb';
import type { Bill, Debt, DebtPayment, FinanceCategory, FocusSession, Habit, HabitLog, Note, Task, Transaction } from '../db/schema';
import { minorDigits } from '../util/money';
import { today } from '../util/dates';

export type Cell = string | number | boolean | null | undefined;

export function csvCell(v: Cell): string {
  if (v === null || v === undefined) return '';
  let s = typeof v === 'string' ? v : String(v);
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: Cell[][]): string {
  return '﻿' + [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

const yn = (b: boolean) => (b ? 'yes' : 'no');
const money = (minor: number, currency: string) => (minor / 10 ** minorDigits(currency)).toFixed(minorDigits(currency));
const MOOD = ['', 'Awful', 'Low', 'Okay', 'Good', 'Great'];

export function tasksCsv(tasks: Task[]): string {
  const rows = [...tasks].sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || a.title.localeCompare(b.title));
  return toCsv(['Task', 'Done', 'Completed on', 'Due date', 'Due time', 'Priority', 'Tags', 'Notes', 'Created on'],
    rows.map((t) => [t.title, yn(t.done), t.completedOn, t.dueDate, t.dueTime, t.priority === 'none' ? '' : t.priority, t.tags.join('; '), t.notes, t.createdOn]));
}

export function transactionsCsv(txns: Transaction[], cats: FinanceCategory[]): string {
  const name = new Map(cats.map((c) => [c.id, c.name]));
  const rows = [...txns].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
  return toCsv(['Date', 'Type', 'Amount', 'Currency', 'Category', 'Note'],
    rows.map((t) => [t.date, t.type, money(t.amountMinor, t.currency), t.currency, t.categoryId ? name.get(t.categoryId) ?? '' : '', t.note]));
}

/** One row per debt: who, which way, the original amount, what has been repaid and what is left. */
export function debtsCsv(debts: Debt[], payments: DebtPayment[]): string {
  const paid = new Map<string, number>();
  for (const p of payments) paid.set(p.debtId, (paid.get(p.debtId) ?? 0) + p.amountMinor);
  const rows = [...debts].sort((a, b) => a.date.localeCompare(b.date) || a.person.localeCompare(b.person));
  return toCsv(['Person', 'Direction', 'Amount', 'Repaid', 'Balance', 'Currency', 'Started', 'Due', 'Settled on', 'Note'],
    rows.map((d) => { const p = Math.min(d.amountMinor, paid.get(d.id) ?? 0); return [d.person, d.direction === 'owe' ? 'I owe them' : 'They owe me', money(d.amountMinor, d.currency), money(p, d.currency), money(d.amountMinor - p, d.currency), d.currency, d.date, d.dueDate, d.settledOn, d.note]; }));
}

export function billsCsv(bills: Bill[], cats: FinanceCategory[]): string {
  const name = new Map(cats.map((c) => [c.id, c.name]));
  const rows = [...bills].sort((a, b) => a.nextDue.localeCompare(b.nextDue) || a.name.localeCompare(b.name));
  return toCsv(['Bill', 'Amount', 'Currency', 'Repeats', 'Next due', 'Category', 'Paused', 'Note'],
    rows.map((b) => [b.name, money(b.amountMinor, b.currency), b.currency, b.cadence, b.nextDue, b.categoryId ? name.get(b.categoryId) ?? '' : '', yn(b.paused), b.note]));
}

export function habitCheckinsCsv(habits: Habit[], logs: HabitLog[]): string {
  const name = new Map(habits.map((h) => [h.id, h.name]));
  const rows = [...logs].sort((a, b) => a.date.localeCompare(b.date) || (name.get(a.habitId) ?? '').localeCompare(name.get(b.habitId) ?? ''));
  return toCsv(['Date', 'Habit'], rows.map((l) => [l.date, name.get(l.habitId) ?? '(deleted habit)']));
}

export function focusCsv(sessions: FocusSession[]): string {
  const rows = [...sessions].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  return toCsv(['Date', 'Started', 'Ended', 'Minutes focused', 'Planned minutes', 'What for'],
    rows.map((s) => [s.date, s.startedAt, s.endedAt, Math.round((s.seconds / 60) * 10) / 10, s.plannedMin, s.label]));
}

export function notesCsv(notes: Note[]): string {
  const rows = [...notes].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
  return toCsv(['Date', 'Kind', 'Title', 'Text', 'Tags', 'Mood'],
    rows.map((n) => [n.date, n.kind === 'journal' ? 'journal' : 'note', n.title, n.content, n.tags.join('; '), n.mood ? `${n.mood} ${MOOD[n.mood]}` : '']));
}

export type ExportKind = 'tasks' | 'money' | 'bills' | 'debts' | 'habits' | 'focus' | 'notes';
export const EXPORTS: { id: ExportKind; label: string; hint: string; module: string | null }[] = [
  { id: 'tasks', label: 'Tasks', hint: 'Every task with its dates and tags', module: 'tasks' },
  { id: 'money', label: 'Money', hint: 'Every transaction with its category', module: 'finance' },
  { id: 'bills', label: 'Bills & subscriptions', hint: 'What repeats, how often, next due date', module: 'finance' },
  { id: 'debts', label: 'Debts', hint: 'Who owes whom, repaid and balance', module: 'finance' },
  { id: 'habits', label: 'Habit check-ins', hint: 'One row per habit per day', module: 'habits' },
  { id: 'focus', label: 'Focus sessions', hint: 'Start, end and minutes focused', module: null },
  { id: 'notes', label: 'Journal & notes', hint: 'Text, tags and mood', module: 'notes' },
];

/** Reads the records and builds one CSV file: { name, text, rows }. */
export async function buildExport(kind: ExportKind): Promise<{ name: string; text: string; rows: number }> {
  const stamp = today();
  switch (kind) {
    case 'tasks': { const r = await getAll('tasks'); return { name: `LifeOS-tasks-${stamp}.csv`, text: tasksCsv(r), rows: r.length }; }
    case 'money': { const [r, c] = await Promise.all([getAll('transactions'), getAll('finance_categories')]); return { name: `LifeOS-money-${stamp}.csv`, text: transactionsCsv(r, c), rows: r.length }; }
    case 'bills': { const [b, c] = await Promise.all([getAll('bills'), getAll('finance_categories')]); return { name: `LifeOS-bills-${stamp}.csv`, text: billsCsv(b, c), rows: b.length }; }
    case 'debts': { const [d, p] = await Promise.all([getAll('debts'), getAll('debt_payments')]); return { name: `LifeOS-debts-${stamp}.csv`, text: debtsCsv(d, p), rows: d.length }; }
    case 'habits': { const [h, l] = await Promise.all([getAll('habits'), getAll('habit_logs')]); return { name: `LifeOS-habit-checkins-${stamp}.csv`, text: habitCheckinsCsv(h, l), rows: l.length }; }
    case 'focus': { const r = await getAll('focus_sessions'); return { name: `LifeOS-focus-${stamp}.csv`, text: focusCsv(r), rows: r.length }; }
    case 'notes': { const r = await getAll('notes'); return { name: `LifeOS-notes-${stamp}.csv`, text: notesCsv(r), rows: r.length }; }
  }
}
