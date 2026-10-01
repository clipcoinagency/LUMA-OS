// The Command Center's brain. `loadHomeSnapshot()` gathers today's facts from the user's own data;
// `buildBriefing()` turns them into a few honest, prioritised sentences ("what is happening in my
// life today, and what should I focus on?"). Nothing is invented: every line is computed from a
// real record, and a line only appears when there is something true to say.
import { diffDays, today as todayKey, weekday, type DateKey } from '../util/dates';
import { formatMoney } from '../util/money';
import { getAll } from '../db/idb';
import type { CalendarEvent, ModuleId, Task } from '../db/schema';
import { listTasks, splitToday } from './tasks';
import { habitStats, listHabits, logsByHabit } from './habits';
import { goalFraction, goalPace, listGoals, type Pace } from './goals';
import { focusMinutesToday, formatMinutes } from './focus';
import { getWellness, upcomingEvents, workoutsRange } from './daily';
import { monthSummary } from './finance';
import { resetNudge, type ResetNudge } from './review';
import { studySnapshot } from './flashcards';
import { readingSnapshot } from './reading';
import type { Route } from '../router.svelte';

export const DEFAULT_FOCUS_TARGET_MIN = 120;

export interface HabitSnap { id: string; name: string; color: string; current: number; unit: 'day' | 'week'; dueToday: boolean; doneToday: boolean; weekCount: number }
export interface GoalSnap { id: string; title: string; fraction: number; pace: Pace; daysLeft: number | null }

export interface HomeSnapshot {
  day: DateKey;
  minutes: number;                // minutes since local midnight
  weekday: number;
  name: string;
  enabled: ModuleId[];
  tasks: { today: Task[]; overdue: Task[]; doneToday: number };
  habits: HabitSnap[];
  goals: GoalSnap[];
  events: Pick<CalendarEvent, 'id' | 'title' | 'date' | 'startTime' | 'allDay'>[];   // today → +7 days
  focus: { minutes: number; target: number };
  wellness: { logged: number; total: number } | null;
  finance: { spentMinor: number; incomeMinor: number; currency: string; count: number } | null;
  reset: ResetNudge;
  study?: { cardsDue: number; readingStreak: number; readToday: boolean } | null;   // Study & Read, when enabled
}

export type BriefTone = 'warn' | 'info' | 'good' | 'nudge';
export type BriefIcon = 'alert' | 'clock' | 'flame' | 'focus' | 'target' | 'wallet' | 'droplet' | 'refresh' | 'check' | 'sparkles' | 'calendar' | 'book';
export type BriefAction = { label: string; route: Route } | { label: string; focus: true };

export interface BriefLine {
  id: string;
  tone: BriefTone;
  icon: BriefIcon;
  text: string;
  action?: BriefAction;
  rank: number;                   // lower = more important
}

// ---------------------------------------------------------------- loading

export interface LoadOptions {
  enabled: ModuleId[];
  name: string;
  currency: string;
  weekStartsOn: 0 | 1;
  focusTargetMin?: number;
  now?: Date;
}

export async function loadHomeSnapshot(o: LoadOptions): Promise<HomeSnapshot> {
  const now = o.now ?? new Date();
  const day = todayKey();
  const on = (m: ModuleId) => o.enabled.includes(m);

  const [studyBits, allTasks, habitRows, goalRows, events, focusMin, wellnessDay, workouts, fin, reviews] = await Promise.all([
    on('study') ? Promise.all([studySnapshot(day), readingSnapshot(day)]) : Promise.resolve(null),
    on('tasks') ? listTasks() : Promise.resolve([] as Task[]),
    on('habits') ? listHabits() : Promise.resolve([]),
    on('goals') ? listGoals() : Promise.resolve([]),
    on('calendar') ? upcomingEvents(day, 7, 12) : Promise.resolve([] as CalendarEvent[]),
    focusMinutesToday(day),
    on('wellness') ? getWellness(day) : Promise.resolve(null),
    on('wellness') ? workoutsRange(day, day) : Promise.resolve([]),
    on('finance') ? monthSummary(o.currency, day) : Promise.resolve(null),
    getAll('reviews'),
  ]);

  const split = splitToday(allTasks, day);
  const habits: HabitSnap[] = await Promise.all(habitRows.map(async (h) => {
    const s = habitStats(h, await logsByHabit(h.id), day, o.weekStartsOn);
    return { id: h.id, name: h.name, color: h.color, current: s.current, unit: s.unit, dueToday: s.dueToday, doneToday: s.doneToday, weekCount: s.weekCount };
  }));
  const goals: GoalSnap[] = goalRows.filter((g) => g.status === 'active').map((g) => ({
    id: g.id, title: g.title, fraction: goalFraction(g), pace: goalPace(g, day), daysLeft: g.deadline ? diffDays(day, g.deadline) : null,
  }));

  let wellness: HomeSnapshot['wellness'] = null;
  if (wellnessDay) {
    const checks = [(wellnessDay.water ?? 0) > 0, wellnessDay.sleepHours !== null, wellnessDay.mood !== null, workouts.length > 0 || (wellnessDay.steps ?? 0) > 0];
    wellness = { logged: checks.filter(Boolean).length, total: checks.length };
  }

  return {
    day, minutes: now.getHours() * 60 + now.getMinutes(), weekday: weekday(day), name: o.name, enabled: o.enabled,
    tasks: { today: split.today, overdue: split.overdue, doneToday: split.doneToday.length },
    habits, goals,
    events: events.map((e) => ({ id: e.id, title: e.title, date: e.date, startTime: e.startTime, allDay: e.allDay })),
    focus: { minutes: focusMin, target: o.focusTargetMin ?? DEFAULT_FOCUS_TARGET_MIN },
    wellness,
    finance: fin ? { spentMinor: fin.expenseMinor, incomeMinor: fin.incomeMinor, currency: o.currency, count: fin.count } : null,
    reset: on('tasks') || on('habits') || on('goals') ? resetNudge(day, o.weekStartsOn, new Set(reviews.map((r) => r.date))) : null,
    study: studyBits ? { cardsDue: studyBits[0].due, readingStreak: studyBits[1].streak, readToday: studyBits[1].loggedToday } : null,
  };
}

// ---------------------------------------------------------------- the briefing (pure)

const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;

export function timeLabel(hm: string): string {
  const [h = 0, m = 0] = hm.split(':').map(Number);
  const d = new Date(2000, 0, 1, h, m);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** The one sentence under the greeting. Facts only. */
export function buildHeadline(s: HomeSnapshot): string {
  const open = s.tasks.today.length + s.tasks.overdue.length;
  const hasTasks = s.enabled.includes('tasks');
  const parts: string[] = [];
  if (hasTasks) {
    if (open > 0) {
      parts.push(s.tasks.overdue.length > 0 && s.tasks.today.length > 0
        ? `${plural(s.tasks.today.length, 'thing')} to do today, plus ${s.tasks.overdue.length} overdue`
        : s.tasks.today.length > 0 ? `${plural(s.tasks.today.length, 'thing')} to do today` : `${plural(s.tasks.overdue.length, 'overdue task')} waiting`);
    } else if (s.tasks.doneToday > 0) parts.push(`all ${s.tasks.doneToday} of today's tasks are done`);
  }
  const todays = s.events.filter((e) => e.date === s.day);
  const next = todays.find((e) => !e.allDay && e.startTime && toMinutes(e.startTime) >= s.minutes);
  if (next) parts.push(`${next.title} at ${timeLabel(next.startTime!)}`);
  else if (todays.length) parts.push(plural(todays.length, 'event') + ' today');
  if (!parts.length) return hasTasks ? 'A clear day. Plan something, or enjoy the space.' : 'Here is where your day stands.';
  const text = parts.join(' · ');
  return text.charAt(0).toUpperCase() + text.slice(1) + '.';
}

const toMinutes = (hm: string) => { const [h = 0, m = 0] = hm.split(':').map(Number); return h * 60 + m; };

export function buildBriefing(s: HomeSnapshot, max = 4): BriefLine[] {
  const out: BriefLine[] = [];
  const evening = s.minutes >= 17 * 60;
  const on = (m: ModuleId) => s.enabled.includes(m);

  // overdue pile
  const od = s.tasks.overdue.length;
  if (on('tasks') && od > 0) {
    out.push(od >= 5
      ? { id: 'overdue', tone: 'warn', icon: 'alert', rank: 10, text: `${od} tasks have slipped past their date. A Weekly Reset is the quickest way to clear them.`, action: { label: 'Open Reset', route: { name: 'reset' } } }
      : { id: 'overdue', tone: 'warn', icon: 'alert', rank: 10, text: `${plural(od, 'task is', 'tasks are')} overdue.`, action: { label: 'Review', route: { name: 'module', module: 'tasks' } } });
  }

  // reset nudge
  if (s.reset === 'ready') out.push({ id: 'reset', tone: 'nudge', icon: 'refresh', rank: 12, text: 'Your week is wrapping up — a ten-minute reset sets you up for the next one.', action: { label: 'Start reset', route: { name: 'reset' } } });
  else if (s.reset === 'catch-up') out.push({ id: 'reset', tone: 'nudge', icon: 'refresh', rank: 13, text: 'Last week was never reset. Do it now and start this one clear.', action: { label: 'Start reset', route: { name: 'reset' } } });

  // next timed event today
  const todays = s.events.filter((e) => e.date === s.day);
  const next = todays.find((e) => !e.allDay && e.startTime && toMinutes(e.startTime) >= s.minutes);
  if (next) {
    const inMin = toMinutes(next.startTime!) - s.minutes;
    out.push({ id: 'next-event', tone: 'info', icon: 'calendar', rank: inMin <= 90 ? 8 : 30, text: `${next.title} ${inMin <= 90 ? `starts in ${formatMinutes(inMin)}` : `is at ${timeLabel(next.startTime!)}`}.`, action: { label: 'Calendar', route: { name: 'module', module: 'calendar' } } });
  }

  // a streak that today's check-in protects
  const risk = s.habits.filter((h) => h.dueToday && !h.doneToday && h.current >= 3 && h.unit === 'day').sort((a, b) => b.current - a.current)[0];
  if (on('habits') && risk) {
    out.push({ id: 'streak', tone: 'nudge', icon: 'flame', rank: evening ? 11 : 24, text: `Your ${risk.current}-day “${risk.name}” streak needs today's check-in.`, action: { label: 'Check in', route: { name: 'module', module: 'habits' } } });
  } else if (on('habits')) {
    const due = s.habits.filter((h) => h.dueToday);
    const left = due.filter((h) => !h.doneToday).length;
    if (due.length && left === 0) out.push({ id: 'habits-done', tone: 'good', icon: 'check', rank: 40, text: `Every habit is done for today (${due.length} of ${due.length}).` });
    else if (left > 0 && evening) out.push({ id: 'habits-left', tone: 'nudge', icon: 'flame', rank: 26, text: `${plural(left, 'habit')} left to check in tonight.`, action: { label: 'Habits', route: { name: 'module', module: 'habits' } } });
  }

  // focus
  const open = s.tasks.today.length + s.tasks.overdue.length;
  if (s.focus.minutes > 0) {
    out.push({ id: 'focus', tone: 'good', icon: 'focus', rank: 38, text: `${formatMinutes(s.focus.minutes)} of focus so far${s.focus.minutes >= s.focus.target ? ' — goal reached.' : ` (goal ${formatMinutes(s.focus.target)}).`}` });
  } else if (open > 0 && !evening) {
    out.push({ id: 'focus', tone: 'info', icon: 'focus', rank: 32, text: 'No focus time yet. One 25-minute session on your top task is a good start.', action: { label: 'Start focus', focus: true } });
  }

  // goal that needs attention
  const behind = s.goals.filter((g) => g.pace === 'behind' || g.pace === 'overdue').sort((a, b) => (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999))[0];
  if (on('goals') && behind) {
    out.push({ id: 'goal', tone: 'warn', icon: 'target', rank: 20, text: behind.pace === 'overdue' ? `“${behind.title}” has passed its deadline at ${Math.round(behind.fraction * 100)}%.` : `“${behind.title}” is behind pace — ${Math.round(behind.fraction * 100)}% with ${plural(behind.daysLeft ?? 0, 'day')} left.`, action: { label: 'Goals', route: { name: 'module', module: 'goals' } } });
  }

  // money (a fact, not a verdict)
  if (on('finance') && s.finance && s.finance.count > 0 && s.finance.incomeMinor > 0) {
    const left = s.finance.incomeMinor - s.finance.spentMinor;
    out.push({ id: 'money', tone: left < 0 ? 'warn' : 'info', icon: 'wallet', rank: left < 0 ? 18 : 50, text: left < 0 ? `You've spent ${formatMoney(-left, s.finance.currency)} more than you've earned this month.` : `${formatMoney(left, s.finance.currency)} left of this month's income.`, action: { label: 'Finance', route: { name: 'module', module: 'finance' } } });
  }

  // wellness
  if (on('wellness') && s.wellness && s.wellness.logged === 0 && s.minutes >= 12 * 60) {
    out.push({ id: 'wellness', tone: 'nudge', icon: 'droplet', rank: 45, text: 'Nothing logged for wellness today — water, sleep or mood takes a few seconds.', action: { label: 'Wellness', route: { name: 'module', module: 'wellness' } } });
  }

  // Study & Read: cards that are due, a reading streak that today's pages protect
  if (on('study') && s.study) {
    if (s.study.cardsDue > 0) out.push({ id: 'cards', tone: 'nudge', icon: 'book', rank: s.study.cardsDue >= 20 ? 22 : 28, text: `${plural(s.study.cardsDue, 'flashcard is', 'flashcards are')} due for review.`, action: { label: 'Review', route: { name: 'module', module: 'study' } } });
    if (s.study.readingStreak >= 2 && !s.study.readToday && evening) out.push({ id: 'reading-streak', tone: 'nudge', icon: 'flame', rank: 27, text: `Your ${s.study.readingStreak}-day reading streak needs a few pages today.`, action: { label: 'Library', route: { name: 'module', module: 'study' } } });
  }

  // all clear
  if (on('tasks') && open === 0 && s.tasks.doneToday > 0) out.push({ id: 'clear', tone: 'good', icon: 'sparkles', rank: 5, text: `All caught up — ${plural(s.tasks.doneToday, 'task')} done today.` });

  // brand new
  const nothing = s.tasks.today.length + s.tasks.overdue.length + s.tasks.doneToday + s.habits.length + s.goals.length === 0;
  if (nothing && (on('tasks') || on('habits') || on('goals'))) out.push({ id: 'start', tone: 'info', icon: 'sparkles', rank: 1, text: 'Your workspace is empty. Add one task, one habit or one goal and Home starts to come alive.' });

  return out.sort((a, b) => a.rank - b.rank).slice(0, max);
}

export function greetingFor(hour: number): string {
  return hour < 5 ? 'Good night' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
}

