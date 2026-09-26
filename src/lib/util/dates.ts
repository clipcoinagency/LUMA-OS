// Date strategy (validated in Phase 0 across time zones + DST):
//   • A calendar day is a local "YYYY-MM-DD" string (DateKey). It sorts correctly and is timezone-free.
//   • Never derive a day from toISOString() — that is UTC and shifts the day near midnight.
//   • Moments (createdAt/updatedAt) are ISO UTC timestamps; they are never used to decide "which day".

export type DateKey = string & { readonly __brand?: 'DateKey' };

const pad = (n: number) => String(n).padStart(2, '0');
export const DATE_KEY_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export function toDateKey(d: Date = new Date()): DateKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function today(): DateKey {
  return toDateKey(new Date());
}

/** Local midnight of the key. (new Date("YYYY-MM-DD") would be UTC midnight — a classic bug.) */
export function fromDateKey(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

export function isDateKey(v: unknown): v is DateKey {
  if (typeof v !== 'string' || !DATE_KEY_RE.test(v)) return false;
  return toDateKey(fromDateKey(v)) === v; // rejects 2026-02-30
}

export function addDays(key: DateKey, n: number): DateKey {
  const d = fromDateKey(key);
  d.setDate(d.getDate() + n);
  return toDateKey(d);
}

export function addMonths(key: DateKey, n: number): DateKey {
  const d = fromDateKey(key);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  d.setDate(Math.min(day, daysInMonth(d.getFullYear(), d.getMonth())));
  return toDateKey(d);
}

export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/** Whole calendar days from a to b (b - a). DST-safe because it works on calendar dates. */
export function diffDays(a: DateKey, b: DateKey): number {
  const [ay, am, ad] = a.split('-').map(Number) as [number, number, number];
  const [by, bm, bd] = b.split('-').map(Number) as [number, number, number];
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

export function startOfMonth(key: DateKey): DateKey {
  return key.slice(0, 8) + '01';
}

export function endOfMonth(key: DateKey): DateKey {
  const d = fromDateKey(key);
  return toDateKey(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

/** 0 = Sunday … 6 = Saturday */
export function weekday(key: DateKey): number {
  return fromDateKey(key).getDay();
}

export function startOfWeek(key: DateKey, weekStartsOn: 0 | 1 = 1): DateKey {
  const offset = (weekday(key) - weekStartsOn + 7) % 7;
  return addDays(key, -offset);
}

export function eachDay(from: DateKey, to: DateKey): DateKey[] {
  const out: DateKey[] = [];
  for (let k = from; k <= to; k = addDays(k, 1)) out.push(k);
  return out;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function formatDateKey(key: DateKey, opts: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric' }, locale?: string): string {
  return new Intl.DateTimeFormat(locale, opts).format(fromDateKey(key));
}
