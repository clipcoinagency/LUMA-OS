// What should ring, and when — pure and unit-tested. One plan feeds both engines in
// lib/notifications.svelte.ts: the in-page one (fires what just came due while the app is open) and
// the Android one (hands the next few days to the OS alarm scheduler so they fire with the app closed).
// Facts only: a reminder's text comes from the user's own data, never invented.
import type { CalendarEvent, NotifyPrefs, Task } from '../db/schema';
import type { DateKey } from '../util/dates';

export const DEFAULT_NOTIFY: NotifyPrefs = {
  enabled: false, tasks: true, events: true, eventLeadMin: 10,
  habits: true, habitTime: '20:00', morning: true, morningTime: '08:00', reset: true, focus: true,
};

export interface Planned { key: string; at: number; title: string; body: string; route: string }

export interface PlanInput {
  now: Date;
  fromMs: number;                 // include items at/after this moment …
  toMs: number;                   // … and before this one
  prefs: NotifyPrefs;
  tasksOn: boolean;               // task reminders become notifications (kept separate for old installs)
  weekStartsOn: 0 | 1;
  name: string;
  tasks: Pick<Task, 'id' | 'title' | 'done' | 'reminder' | 'dueDate' | 'dueTime' | 'remindedOn'>[];
  events: Pick<CalendarEvent, 'id' | 'title' | 'date' | 'startTime' | 'allDay'>[];
  habitsActive: boolean;          // the user tracks at least one habit
  habitsOpenToday: string[];      // names due today and not yet done
  headlineToday: string;          // home.ts buildHeadline — the same sentence Home shows
  resetDoneThisWeek: boolean;
  focus: { endsAt: number; label: string; key: string } | null;
  timeLabel: (hm: string) => string;
}

const DAY = 86_400_000;
export const keyOf = (d: Date): DateKey => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` as DateKey;
/** Local wall-clock time on a given date → epoch ms (DST-safe: built from local parts). */
export function atLocal(day: DateKey, hm: string): number {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const [h = 0, min = 0] = hm.split(':').map(Number);
  return new Date(y, m - 1, d, h, min, 0, 0).getTime();
}
function addDays(day: DateKey, n: number): DateKey {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return keyOf(new Date(y, m - 1, d + n));
}
const listNames = (names: string[]) => names.length <= 2 ? names.join(' and ') : `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`;

/** A stable 31-bit id for Android (which needs integers) from a reminder's key. */
export function idFor(key: string): number {
  let h = 7;
  for (let i = 0; i < key.length; i++) h = (Math.imul(h, 31) + key.charCodeAt(i)) | 0;
  return (h & 0x7fffffff) || 1;
}

export function planNotifications(i: PlanInput): Planned[] {
  const out: Planned[] = [];
  const p = i.prefs;
  const today = keyOf(i.now);
  const days = Math.max(1, Math.ceil((i.toMs - i.now.getTime()) / DAY) + 1);
  const push = (x: Planned) => { if (x.at >= i.fromMs && x.at < i.toMs) out.push(x); };

  if (i.tasksOn) {
    for (const t of i.tasks) {
      if (!t.reminder || t.done || !t.dueDate || !t.dueTime || t.remindedOn === t.dueDate) continue;
      push({ key: `task|${t.id}|${t.dueDate}|${t.dueTime}`, at: atLocal(t.dueDate, t.dueTime), title: 'Reminder', body: t.title, route: '#/tasks' });
    }
  }
  if (!p.enabled) return out.sort((a, b) => a.at - b.at);

  if (p.events) {
    for (const e of i.events) {
      if (e.allDay || !e.startTime) continue;
      const start = atLocal(e.date, e.startTime);
      const lead = Math.max(0, p.eventLeadMin);
      push({ key: `event|${e.id}|${e.date}|${e.startTime}|${lead}`, at: start - lead * 60_000, title: e.title,
        body: lead ? `Starts at ${i.timeLabel(e.startTime)} — in ${lead} minutes.` : `Starting now (${i.timeLabel(e.startTime)}).`, route: '#/calendar' });
    }
  }

  for (let n = 0; n < days; n++) {
    const day = addDays(today, n);
    const isToday = n === 0;
    if (p.morning) {
      push({ key: `morning|${day}`, at: atLocal(day, p.morningTime), title: `Good morning${i.name ? `, ${i.name}` : ''}`,
        body: isToday && i.headlineToday ? i.headlineToday : 'Your day is ready. Open Life OS for today’s plan.', route: '#/dashboard' });
    }
    if (p.habits && i.habitsActive) {
      if (!isToday) push({ key: `habits|${day}`, at: atLocal(day, p.habitTime), title: 'Evening check-in', body: 'A minute to tick off today’s habits.', route: '#/habits' });
      else if (i.habitsOpenToday.length) {
        const n2 = i.habitsOpenToday.length;
        push({ key: `habits|${day}`, at: atLocal(day, p.habitTime), title: `${n2} habit${n2 === 1 ? '' : 's'} still open`,
          body: `${listNames(i.habitsOpenToday)} — still time today.`, route: '#/habits' });
      }
    }
    // the evening before the week starts (Sunday for Monday-first weeks, Saturday for Sunday-first)
    if (p.reset && new Date(atLocal(day, '12:00')).getDay() === (i.weekStartsOn === 1 ? 0 : 6)) {
      // resetDoneThisWeek is only ever true inside the reset weekend, so it can only cover today/tomorrow
      const alreadyDone = i.resetDoneThisWeek && n <= 1;
      if (!alreadyDone) push({ key: `reset|${day}`, at: atLocal(day, '18:00'), title: 'Weekly Reset', body: 'Ten minutes to look back, clear loose ends and plan the week ahead.', route: '#/reset' });
    }
  }

  if (p.focus && i.focus) push({ key: i.focus.key, at: i.focus.endsAt, title: 'Focus session complete', body: i.focus.label || 'Nice work. Take a short break.', route: '#/dashboard' });
  return out.sort((a, b) => a.at - b.at);
}
