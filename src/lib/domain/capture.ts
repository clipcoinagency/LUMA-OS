// Quick capture: one line of plain English → a task. "Call mom tomorrow 6pm #family !high" becomes
// "Call mom", due tomorrow at 18:00 with a reminder, tagged #family, high priority. Pure and offline;
// anything it doesn't recognise simply stays in the title. English words only (dates/times/tags).
import type { Priority } from '../db/schema';
import { addDays, type DateKey } from '../util/dates';

export interface Capture {
  title: string;
  dueDate: DateKey | null;        // null = no date mentioned (the caller decides; tasks default to today)
  dueTime: string | null;         // "HH:MM"
  reminder: boolean;              // a time was given (or the word "remind")
  priority: Priority | null;
  tags: string[];
}

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAY_RE = '(sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?)';
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MON_RE = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';

const pad = (n: number) => String(n).padStart(2, '0');
const weekdayOf = (k: DateKey) => { const [y, m, d] = k.split('-').map(Number) as [number, number, number]; return new Date(y, m - 1, d).getDay(); };
const dayIndex = (w: string) => DAYS.findIndex((d) => d.startsWith(w.slice(0, 3)));

export function parseCapture(input: string, today: DateKey): Capture {
  let s = ` ${input.trim()} `;
  const out: Capture = { title: '', dueDate: null, dueTime: null, reminder: false, priority: null, tags: [] };
  const take = (re: RegExp, fn: (m: RegExpMatchArray) => void) => {
    const m = s.match(re);
    if (!m) return false;
    fn(m);
    s = s.replace(m[0], ' ');
    return true;
  };

  // tags and priority
  s = s.replace(/(^|\s)#([\p{L}\p{N}_-]+)/gu, (_x, sp: string, t: string) => { out.tags.push(t.toLowerCase()); return sp; });
  take(/\s(!!!|!1|!high|!urgent)(?=\s)/i, () => { out.priority = 'high'; }) ||
    take(/\s(!!|!2|!med(?:ium)?)(?=\s)/i, () => { out.priority = 'medium'; }) ||
    take(/\s(!3|!low)(?=\s)/i, () => { out.priority = 'low'; });
  take(/\s(?:remind me|remind)(?=\s)/i, () => { out.reminder = true; });

  // time
  const setTime = (h: number, min: number) => { if (h >= 0 && h < 24 && min >= 0 && min < 60) out.dueTime = `${pad(h)}:${pad(min)}`; };
  take(/\s(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s?(am|pm)(?=\s)/i, (m) => {
    let h = Number(m[1]) % 12; if (m[3]!.toLowerCase() === 'pm') h += 12; setTime(h, Number(m[2] ?? 0));
  }) ||
    take(/\s(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)(?=\s)/, (m) => setTime(Number(m[1]), Number(m[2]))) ||
    take(/\sat\s+(\d{1,2})(?=\s)/i, (m) => setTime(Number(m[1]), 0)) ||
    take(/\s(?:at\s+)?noon(?=\s)/i, () => setTime(12, 0)) ||
    take(/\s(?:in the\s+)?morning(?=\s)/i, () => setTime(9, 0)) ||
    take(/\s(?:in the\s+)?afternoon(?=\s)/i, () => setTime(14, 0)) ||
    take(/\s(?:in the\s+|this\s+)?evening(?=\s)/i, () => setTime(18, 0));

  // date
  const setDate = (k: DateKey) => { out.dueDate = k; };
  take(/\s(?:the\s+)?day after tomorrow(?=\s)/i, () => setDate(addDays(today, 2))) ||
    take(/\s(?:tomorrow|tmrw|tmr)(?=\s)/i, () => setDate(addDays(today, 1))) ||
    take(/\stonight(?=\s)/i, () => { setDate(today); if (!out.dueTime) setTime(20, 0); }) ||
    take(/\stoday(?=\s)/i, () => setDate(today)) ||
    take(/\sin\s+(\d{1,3})\s+(day|days|week|weeks)(?=\s)/i, (m) => setDate(addDays(today, Number(m[1]) * (/week/i.test(m[2]!) ? 7 : 1)))) ||
    take(/\snext week(?=\s)/i, () => { const w = weekdayOf(today); setDate(addDays(today, ((8 - w) % 7) || 7)); }) ||
    take(/\s(?:this\s+)?weekend(?=\s)/i, () => { const w = weekdayOf(today); setDate(addDays(today, (6 - w + 7) % 7)); }) ||
    take(new RegExp(`\\s(?:on\\s+)?(next\\s+)?${DAY_RE}(?=\\s)`, 'i'), (m) => {
      const target = dayIndex(m[2]!.toLowerCase());
      let diff = (target - weekdayOf(today) + 7) % 7;
      if (diff === 0) diff = 7;                        // "friday" said on a Friday = next Friday
      if (m[1]) diff += diff < 7 ? 7 : 0;              // "next friday" = the one after this coming one
      setDate(addDays(today, diff));
    }) ||
    take(new RegExp(`\\s(?:on\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\s+${MON_RE}(?=\\s)`, 'i'), (m) => setDate(monthDay(today, m[2]!, Number(m[1])))) ||
    take(new RegExp(`\\s(?:on\\s+)?${MON_RE}\\s+(\\d{1,2})(?:st|nd|rd|th)?(?=\\s)`, 'i'), (m) => setDate(monthDay(today, m[1]!, Number(m[2]))));

  if (out.dueTime) out.reminder = true;
  if (out.dueTime && !out.dueDate) out.dueDate = today;
  out.title = s.replace(/\s+/g, ' ').trim().replace(/\s+(at|on|by|due)$/i, '').replace(/^(at|on|by)\s+/i, '');
  return out;
}

/** The next occurrence of a month + day (this year, or next year if it has passed). */
function monthDay(today: DateKey, mon: string, day: number): DateKey {
  const m = MONTHS.indexOf(mon.slice(0, 3).toLowerCase()) + 1;
  const [y] = today.split('-').map(Number) as [number];
  const fit = (yr: number) => `${yr}-${pad(m)}-${pad(Math.min(new Date(yr, m, 0).getDate(), Math.max(1, day)))}` as DateKey;
  const k = fit(y);
  return k < today ? fit(y + 1) : k;
}
