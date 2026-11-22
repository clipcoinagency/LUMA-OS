// Almanac (Paper / Night Ink) extras — the things a printed almanac carries, computed offline:
//  • the moon's phase for a date (pure astronomy, no network)
//  • the year so far ("Day 327 of 365")
//  • "The year in ink": one mark per day for everything you actually did — from your own records only.
import { getRange } from '../db/idb';
import { addDays, startOfWeek, type DateKey } from '../util/dates';

// ---------------------------------------------------------------- moon
const SYNODIC = 29.530588853;                         // days, mean new moon → new moon
const NEW_MOON_REF = Date.UTC(2000, 0, 6, 18, 14);   // a known new moon

export interface MoonPhase { name: string; age: number; fraction: number; illumination: number }

/** Phase at local noon of the given day. fraction 0 = new, 0.5 = full; illumination 0–1. */
export function moonPhase(day: DateKey): MoonPhase {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const t = new Date(y, m - 1, d, 12).getTime();
  const age = (((t - NEW_MOON_REF) / 86_400_000) % SYNODIC + SYNODIC) % SYNODIC;
  const fraction = age / SYNODIC;
  const illumination = (1 - Math.cos(2 * Math.PI * fraction)) / 2;
  const name = fraction < 0.0339 || fraction >= 0.9661 ? 'New moon'
    : fraction < 0.216 ? 'Waxing crescent' : fraction < 0.284 ? 'First quarter' : fraction < 0.466 ? 'Waxing gibbous'
    : fraction < 0.534 ? 'Full moon' : fraction < 0.716 ? 'Waning gibbous' : fraction < 0.784 ? 'Last quarter' : 'Waning crescent';
  return { name, age, fraction, illumination };
}

/** SVG path for the lit part of the moon (radius r, centred at cx,cy). Empty at new moon. */
export function moonPath(fraction: number, cx = 12, cy = 12, r = 9): string {
  if (fraction < 0.0339 || fraction >= 0.9661) return '';
  const waxing = fraction < 0.5;
  const rx = Math.abs(Math.cos(2 * Math.PI * fraction)) * r;
  const crescent = waxing ? fraction < 0.25 : fraction > 0.75;
  const outer = waxing ? 1 : 0;                       // lit limb: right side when waxing, left when waning
  const inner = waxing ? (crescent ? 0 : 1) : (crescent ? 1 : 0);
  const f = (n: number) => n.toFixed(2);
  return `M${f(cx)},${f(cy - r)} A${f(r)},${f(r)} 0 0 ${outer} ${f(cx)},${f(cy + r)} A${f(rx)},${f(r)} 0 0 ${inner} ${f(cx)},${f(cy - r)} Z`;
}

// ---------------------------------------------------------------- the year so far
export function yearProgress(day: DateKey): { dayOfYear: number; daysInYear: number; left: number; fraction: number } {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const dayOfYear = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86_400_000) + 1;
  const daysInYear = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 366 : 365;
  return { dayOfYear, daysInYear, left: daysInYear - dayOfYear, fraction: dayOfYear / daysInYear };
}

// ---------------------------------------------------------------- the year in ink
export interface InkDay { date: DateKey; tasks: number; habits: number; focusMin: number; reading: number; notes: number; score: number }
export interface InkSource {
  tasksDone: { completedOn: DateKey | null }[];
  habitLogs: { date: DateKey }[];
  focus: { date: DateKey; seconds: number }[];
  reading: { date: DateKey }[];
  notes: { date: DateKey }[];
}

/** Pure: buckets records into one entry per day from `from` to `to` (inclusive). A focus mark is 25 min. */
export function bucketInk(from: DateKey, to: DateKey, src: InkSource): InkDay[] {
  const days = new Map<DateKey, InkDay>();
  for (let d = from; d <= to; d = addDays(d, 1)) days.set(d, { date: d, tasks: 0, habits: 0, focusMin: 0, reading: 0, notes: 0, score: 0 });
  const at = (k: DateKey | null | undefined) => (k ? days.get(k) : undefined);
  for (const t of src.tasksDone) { const x = at(t.completedOn); if (x) x.tasks++; }
  for (const h of src.habitLogs) { const x = at(h.date); if (x) x.habits++; }
  for (const f of src.focus) { const x = at(f.date); if (x) x.focusMin += f.seconds / 60; }
  for (const r of src.reading) { const x = at(r.date); if (x) x.reading++; }
  for (const n of src.notes) { const x = at(n.date); if (x) x.notes++; }
  for (const x of days.values()) { x.focusMin = Math.round(x.focusMin); x.score = x.tasks + x.habits + x.reading + x.notes + Math.floor(x.focusMin / 25); }
  return [...days.values()];
}

/** The last 53 weeks up to `end`, starting on the user's first day of the week. */
export async function loadYearInk(end: DateKey, weekStartsOn: 0 | 1): Promise<{ from: DateKey; days: InkDay[] }> {
  const from = startOfWeek(addDays(end, -364), weekStartsOn);
  const [tasksDone, habitLogs, focus, reading, notes] = await Promise.all([
    getRange('tasks', 'by_completed', from, end),
    getRange('habit_logs', 'by_date', from, end),
    getRange('focus_sessions', 'by_date', from, end),
    getRange('reading_logs', 'by_date', from, end),
    getRange('notes', 'by_date', from, end),
  ]);
  return { from, days: bucketInk(from, end, { tasksDone, habitLogs, focus, reading, notes }) };
}
