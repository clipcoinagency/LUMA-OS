// Insights: patterns found in the user's OWN records. The rules are strict on purpose:
//   • every insight has a minimum amount of data behind it; below that it is reported as "still
//     learning" with how much more is needed — never as a guess;
//   • numbers are counts, averages and shares of real rows (no scores, no predictions);
//   • cross-pattern comparisons need a real sample on both sides and a meaningful gap, and are worded as
//     tendencies ("tends to"), never as cause.
import { addDays, diffDays, eachDay, weekday, startOfWeek, type DateKey } from '../util/dates';
import { formatMoney } from '../util/money';
import { getAll } from '../db/idb';
import type { FinanceCategory, FocusSession, Goal, GoalProgress, Habit, HabitLog, ModuleId, Task, Transaction, WellnessDay, Workout } from '../db/schema';
import { habitStats, isDueOn } from './habits';
import { formatMinutes, sumMinutes } from './focus';
import { goalPace } from './goals';

export interface InsightsData {
  today: DateKey;
  weekStartsOn: 0 | 1;
  enabled: ModuleId[];
  currency: string;
  tasks: Task[];
  habits: Habit[];
  habitLogs: HabitLog[];
  sessions: FocusSession[];
  workouts: Workout[];
  wellness: WellnessDay[];
  transactions: Transaction[];
  categories: FinanceCategory[];
  goals: Goal[];
  goalProgress: GoalProgress[];
}

export type SeriesFormat = 'count' | 'minutes' | 'percent' | 'money';
export interface Insight {
  id: string;
  area: 'tasks' | 'habits' | 'focus' | 'goals' | 'spending' | 'wellness' | 'patterns';
  title: string;
  headline: string;
  detail?: string;
  series?: { label: string; value: number; hint?: string }[];
  format?: SeriesFormat;
  note?: string;
}
export interface Learning { id: string; area: Insight['area']; title: string; need: string; progress: number }
export interface InsightsResult { ready: Insight[]; learning: Learning[]; daysOfData: number }

const DAY = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const pct = (x: number) => `${Math.round(x * 100)}%`;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** Days between the earliest record we hold and today — how long the app has been learning. */
export function daysOfData(d: InsightsData): number {
  const dates: string[] = [];
  for (const t of d.tasks) dates.push(t.createdOn);
  for (const l of d.habitLogs) dates.push(l.date);
  for (const s of d.sessions) dates.push(s.date);
  for (const w of d.wellness) dates.push(w.date);
  for (const x of d.transactions) dates.push(x.date);
  for (const h of d.habits) dates.push(h.createdOn);
  if (!dates.length) return 0;
  const first = dates.reduce((a, b) => (a < b ? a : b));
  return Math.max(0, diffDays(first, d.today) + 1);
}

export function computeInsights(d: InsightsData): InsightsResult {
  const ready: Insight[] = [];
  const learning: Learning[] = [];
  const on = (m: ModuleId) => d.enabled.includes(m);
  const days = daysOfData(d);

  // ---------------------------------------------------------------- tasks
  if (on('tasks')) {
    const done = d.tasks.filter((t) => t.done && t.completedOn);
    const wkStart = startOfWeek(d.today, d.weekStartsOn);
    const weeks = Array.from({ length: 8 }, (_, i) => addDays(wkStart, -7 * (7 - i)));
    const counts = weeks.map((w) => done.filter((t) => t.completedOn! >= w && t.completedOn! <= addDays(w, 6)).length);
    const total = counts.reduce((a, b) => a + b, 0);
    if (total >= 8 && days >= 10) {
      const recent = counts.slice(4), before = counts.slice(0, 4);
      const rA = avg(recent), bA = avg(before);
      let detail: string | undefined;
      if (bA > 0 && before.some((c) => c > 0)) {
        const ch = (rA - bA) / bA;
        if (Math.abs(ch) >= 0.15) detail = `${ch > 0 ? 'Up' : 'Down'} ${Math.round(Math.abs(ch) * 100)}% on the four weeks before.`;
      }
      ready.push({
        id: 'tasks-trend', area: 'tasks', title: 'Task completion', headline: `You finish about ${rA.toFixed(rA >= 10 ? 0 : 1)} tasks a week.`, detail,
        series: weeks.map((w, i) => ({ label: new Date(w + 'T00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' }), value: counts[i]! })), format: 'count',
        note: 'Tasks completed per week, last 8 weeks.',
      });
      if (done.length >= 14) {
        const by = Array.from({ length: 7 }, () => 0);
        for (const t of done) by[weekday(t.completedOn!)]!++;
        const best = by.indexOf(Math.max(...by));
        const share = by[best]! / done.length;
        if (share >= 0.22) ready.push({
          id: 'tasks-weekday', area: 'tasks', title: 'Your best day for getting things done', headline: `${DAY[best]} are your most productive day.`, detail: `${pct(share)} of the ${done.length} tasks you've completed were finished on a ${DAY[best]!.slice(0, -1)}.`,
          series: orderWeek(d.weekStartsOn).map((i) => ({ label: DAY_SHORT[i]!, value: by[i]! })), format: 'count',
        });
      }
    } else learning.push({ id: 'tasks-trend', area: 'tasks', title: 'Task completion', need: `Complete ${Math.max(1, 8 - total)} more task${8 - total === 1 ? '' : 's'} over at least 10 days to see your weekly rhythm.`, progress: clamp01(Math.min(total / 8, days / 10)) });
  }

  // ---------------------------------------------------------------- habits
  if (on('habits')) {
    const habits = d.habits.filter((h) => !h.archived);
    const stats = habits.map((h) => ({ h, s: habitStats(h, new Set(d.habitLogs.filter((l) => l.habitId === h.id).map((l) => l.date)), d.today, d.weekStartsOn) })).filter((x) => x.s.rate !== null);
    if (stats.length && d.habitLogs.length >= 12 && days >= 14) {
      const sorted = [...stats].sort((a, b) => (b.s.rate ?? 0) - (a.s.rate ?? 0));
      const top = sorted[0]!, low = sorted[sorted.length - 1]!;
      ready.push({
        id: 'habits-consistency', area: 'habits', title: 'Habit consistency', headline: stats.length === 1 ? `You've kept “${top.h.name}” up ${pct(top.s.rate!)} of the time.` : `“${top.h.name}” is your most consistent habit (${pct(top.s.rate!)}).`,
        detail: stats.length > 1 && low !== top ? `“${low.h.name}” has the most room to grow at ${pct(low.s.rate!)}.` : undefined,
        series: sorted.map((x) => ({ label: x.h.name, value: Math.round((x.s.rate ?? 0) * 100) })), format: 'percent', note: 'Share of due days completed, last 30 days.',
      });
      // weekday pattern across all daily/weekday habits over the last 8 weeks
      const from = addDays(d.today, -55);
      const due = Array.from({ length: 7 }, () => 0), made = Array.from({ length: 7 }, () => 0);
      const logSet = new Set(d.habitLogs.map((l) => `${l.habitId}|${l.date}`));
      for (const h of habits) {
        if (h.frequency.kind === 'times-per-week') continue;
        for (const day of eachDay(from < h.createdOn ? h.createdOn : from, addDays(d.today, -1))) {
          if (!isDueOn(h.frequency, day)) continue;
          due[weekday(day)]!++;
          if (logSet.has(`${h.id}|${day}`)) made[weekday(day)]!++;
        }
      }
      const rates = due.map((n, i) => (n >= 6 ? made[i]! / n : null));
      const known = rates.map((r, i) => ({ r, i })).filter((x): x is { r: number; i: number } => x.r !== null);
      if (known.length >= 5) {
        const best = known.reduce((a, b) => (b.r > a.r ? b : a)), worst = known.reduce((a, b) => (b.r < a.r ? b : a));
        if (best.r - worst.r >= 0.2) ready.push({
          id: 'habits-weekday', area: 'habits', title: 'Your habit rhythm', headline: `${DAY[best.i]} are strongest (${pct(best.r)}), ${DAY[worst.i]} weakest (${pct(worst.r)}).`,
          series: orderWeek(d.weekStartsOn).map((i) => ({ label: DAY_SHORT[i]!, value: rates[i] === null ? 0 : Math.round(rates[i]! * 100) })), format: 'percent', note: 'Share of due habits completed, by weekday, last 8 weeks.',
        });
      }
    } else if (habits.length) learning.push({ id: 'habits-consistency', area: 'habits', title: 'Habit consistency', need: `Check in on habits for ${Math.max(1, 14 - days)} more day${14 - days === 1 ? '' : 's'} (and at least 12 check-ins in total).`, progress: clamp01(Math.min(d.habitLogs.length / 12, days / 14)) });
  }

  // ---------------------------------------------------------------- focus
  {
    const s = d.sessions;
    if (s.length >= 5 && days >= 7) {
      const series = Array.from({ length: 14 }, (_, i) => { const day = addDays(d.today, -(13 - i)); return { day, min: sumMinutes(s.filter((x) => x.date === day)) }; });
      const activeDays = series.filter((x) => x.min > 0);
      ready.push({
        id: 'focus-trend', area: 'focus', title: 'Focus time', headline: activeDays.length ? `${formatMinutes(avg(activeDays.map((x) => x.min)))} on the days you focus.` : 'No focus sessions in the last two weeks.',
        detail: `${plural(activeDays.length, 'day')} with focus in the last 14 · ${formatMinutes(sumMinutes(s.filter((x) => x.date >= series[0]!.day)))} in total.`,
        series: series.map((x) => ({ label: new Date(x.day + 'T00:00').toLocaleDateString(undefined, { day: 'numeric' }), value: Math.round(x.min) })), format: 'minutes',
      });
      if (s.length >= 8) {
        const parts = { morning: 0, afternoon: 0, evening: 0 };
        for (const x of s) { const h = new Date(x.startedAt).getHours(); parts[h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening'] += x.seconds; }
        const tot = parts.morning + parts.afternoon + parts.evening;
        const top = (Object.entries(parts) as [string, number][]).sort((a, b) => b[1] - a[1])[0]!;
        if (tot > 0 && top[1] / tot >= 0.45) ready.push({
          id: 'focus-time-of-day', area: 'focus', title: 'When you focus best', headline: `Most of your focus happens in the ${top[0]}.`, detail: `${pct(top[1] / tot)} of your focused time, across ${s.length} sessions.`,
          series: [['Morning', parts.morning], ['Afternoon', parts.afternoon], ['Evening', parts.evening]].map(([label, v]) => ({ label: label as string, value: Math.round((v as number) / 60) })), format: 'minutes',
        });
      }
    } else learning.push({ id: 'focus-trend', area: 'focus', title: 'Focus time', need: `Complete ${Math.max(1, 5 - s.length)} more focus session${5 - s.length === 1 ? '' : 's'} to see your pattern.`, progress: clamp01(s.length / 5) });
  }

  // ---------------------------------------------------------------- goals
  if (on('goals')) {
    const active = d.goals.filter((g) => g.status === 'active');
    const withProgress = active.filter((g) => d.goalProgress.some((p) => p.goalId === g.id));
    if (withProgress.length) {
      const paces = withProgress.map((g) => goalPace(g, d.today));
      const behind = paces.filter((p) => p === 'behind' || p === 'overdue').length;
      const ahead = paces.filter((p) => p === 'ahead' || p === 'done').length;
      ready.push({
        id: 'goals-pace', area: 'goals', title: 'Goal pace', headline: behind === 0 ? `All ${plural(withProgress.length, 'goal')} with check-ins are on pace or better.` : `${behind} of ${plural(withProgress.length, 'goal')} ${behind === 1 ? 'is' : 'are'} behind pace.`,
        detail: ahead ? `${ahead} ${ahead === 1 ? 'is' : 'are'} ahead.` : undefined,
      });
    } else if (active.length) learning.push({ id: 'goals-pace', area: 'goals', title: 'Goal pace', need: 'Log a progress check-in on a goal to see how you are pacing.', progress: 0.1 });
  }

  // ---------------------------------------------------------------- spending
  if (on('finance')) {
    const month = d.today.slice(0, 7);
    const prevMonth = addDays((month + '-01') as DateKey, -1).slice(0, 7);
    const exp = (m: string) => d.transactions.filter((t) => t.type === 'expense' && t.currency === d.currency && t.date.startsWith(m));
    const cur = exp(month), prev = exp(prevMonth);
    const byCat = (rows: Transaction[]) => { const m = new Map<string, number>(); for (const t of rows) m.set(t.categoryId ?? '', (m.get(t.categoryId ?? '') ?? 0) + t.amountMinor); return m; };
    if (cur.length >= 3 && prev.length >= 3) {
      const a = byCat(cur), b = byCat(prev);
      const name = (id: string) => d.categories.find((c) => c.id === id)?.name ?? 'Uncategorised';
      const moves = [...a.keys()].filter((k) => b.has(k)).map((k) => ({ k, now: a.get(k)!, before: b.get(k)!, ch: (a.get(k)! - b.get(k)!) / b.get(k)! })).filter((m) => Math.abs(m.now - m.before) >= 2000 && Math.abs(m.ch) >= 0.2).sort((x, y) => Math.abs(y.now - y.before) - Math.abs(x.now - x.before));
      const totalNow = cur.reduce((n, t) => n + t.amountMinor, 0), totalPrev = prev.reduce((n, t) => n + t.amountMinor, 0);
      const dayOfMonth = Number(d.today.slice(8, 10));
      ready.push({
        id: 'spending-month', area: 'spending', title: 'Spending this month', headline: moves[0] ? `${name(moves[0].k)} is ${moves[0].ch > 0 ? 'up' : 'down'} ${Math.round(Math.abs(moves[0].ch) * 100)}% on last month.` : `Your spending is steady against last month.`,
        detail: `${formatMoney(totalNow, d.currency)} so far (day ${dayOfMonth}) vs ${formatMoney(totalPrev, d.currency)} for all of last month.`,
        series: [...a.entries()].sort((x, y) => y[1] - x[1]).slice(0, 5).map(([k, v]) => ({ label: name(k), value: v / 100 })), format: 'money', note: 'Top categories this month.',
      });
    } else if (cur.length || prev.length) learning.push({ id: 'spending-month', area: 'spending', title: 'Spending patterns', need: 'Record spending in two consecutive months (3+ entries each) to compare them.', progress: clamp01((cur.length + prev.length) / 6) });
  }

  // ---------------------------------------------------------------- wellness
  if (on('wellness')) {
    const win = (from: number, to: number) => d.wellness.filter((w) => w.date >= addDays(d.today, -from) && w.date <= addDays(d.today, -to));
    const mood = (rows: WellnessDay[]) => rows.filter((w) => w.mood !== null).map((w) => w.mood as number);
    const recent = mood(win(13, 0)), before = mood(win(27, 14));
    if (recent.length >= 6 && before.length >= 6) {
      const r = avg(recent), b = avg(before);
      ready.push({ id: 'wellness-mood', area: 'wellness', title: 'Mood', headline: Math.abs(r - b) < 0.2 ? `Your mood has been steady (about ${r.toFixed(1)} of 5).` : `Your mood averaged ${r.toFixed(1)} of 5 — ${r > b ? 'up' : 'down'} from ${b.toFixed(1)} the fortnight before.`, detail: `Based on ${recent.length + before.length} mood entries over four weeks.` });
    } else learning.push({ id: 'wellness-mood', area: 'wellness', title: 'Mood', need: 'Log your mood on at least 6 days in each of two fortnights.', progress: clamp01(recent.length / 6 / 2 + before.length / 6 / 2) });
  }

  // ---------------------------------------------------------------- patterns across areas
  if (on('tasks') && on('wellness')) {
    const doneBy = new Map<string, number>();
    for (const t of d.tasks) if (t.done && t.completedOn) doneBy.set(t.completedOn, (doneBy.get(t.completedOn) ?? 0) + 1);
    const slept = d.wellness.filter((w) => w.sleepHours !== null && w.date < d.today);
    const good = slept.filter((w) => (w.sleepHours as number) >= 7).map((w) => doneBy.get(w.date) ?? 0);
    const poor = slept.filter((w) => (w.sleepHours as number) < 7).map((w) => doneBy.get(w.date) ?? 0);
    if (good.length >= 8 && poor.length >= 8) {
      const g = avg(good), p = avg(poor);
      if (g - p >= 0.5 && g >= p * 1.25) ready.push({
        id: 'pattern-sleep-tasks', area: 'patterns', title: 'Sleep and getting things done', headline: `On days after 7+ hours of sleep you tend to complete more tasks.`,
        detail: `About ${g.toFixed(1)} tasks on those days vs ${p.toFixed(1)} after less sleep (${good.length} and ${poor.length} days).`, note: 'A pattern in your own data — not proof of cause.',
      });
    }
    const moodDays = d.wellness.filter((w) => w.mood !== null);
    const moved = new Set(d.workouts.map((w) => w.date));
    const m1 = moodDays.filter((w) => moved.has(w.date)).map((w) => w.mood as number), m0 = moodDays.filter((w) => !moved.has(w.date)).map((w) => w.mood as number);
    if (m1.length >= 8 && m0.length >= 8 && avg(m1) - avg(m0) >= 0.4) ready.push({
      id: 'pattern-workout-mood', area: 'patterns', title: 'Movement and mood', headline: 'Your mood tends to be higher on days you work out.',
      detail: `${avg(m1).toFixed(1)} on workout days vs ${avg(m0).toFixed(1)} on other days (${m1.length} and ${m0.length} days).`, note: 'A pattern in your own data — not proof of cause.',
    });
  }

  return { ready, learning, daysOfData: days };
}

/** Day indices in the user's week order (Mon-first or Sun-first). */
function orderWeek(ws: 0 | 1): number[] { return Array.from({ length: 7 }, (_, i) => (i + ws) % 7); }

export async function loadInsightsData(o: { today: DateKey; weekStartsOn: 0 | 1; enabled: ModuleId[]; currency: string }): Promise<InsightsData> {
  const [tasks, habits, habitLogs, sessions, workouts, wellness, transactions, categories, goals, goalProgress] = await Promise.all([
    getAll('tasks'), getAll('habits'), getAll('habit_logs'), getAll('focus_sessions'), getAll('workouts'), getAll('wellness'),
    getAll('transactions'), getAll('finance_categories'), getAll('goals'), getAll('goal_progress'),
  ]);
  return { ...o, tasks, habits, habitLogs, sessions, workouts, wellness, transactions, categories, goals, goalProgress };
}
