// "Pulse": the three graph tiles on Home — focus, wellbeing and progress. Everything here is
// computed from records the user actually logged; with too little data a tile says so instead of
// drawing a made-up curve. Pure builders (unit-tested) + one loader.
import type { ModuleId } from '../db/schema';
import { addDays, eachDay, type DateKey } from '../util/dates';
import { sessionsInRange, minutesByDay, sumMinutes } from './focus';
import { wellnessRange, workoutsRange } from './daily';
import { tasksCompletedOn } from './tasks';
import { logsInRange } from './habits';

export interface PulseDay { date: DateKey; value: number }
export interface FocusPulse { today: number; target: number; sessionsToday: number; week: PulseDay[]; weekTotal: number }
export interface MoodPulse { points: { date: DateKey; value: number | null }[]; logged: number; avg7: number | null; latest: number | null }
export interface ProgressPulse { days: PulseDay[]; thisWeek: number; lastWeek: number; deltaPct: number | null }
export interface Pulse { focus: FocusPulse; mood: MoodPulse | null; progress: ProgressPulse | null }

/** Minimum logged days before a mood curve is worth drawing. */
export const MIN_MOOD_POINTS = 3;

export function buildProgress(counts: Map<DateKey, number>, end: DateKey): ProgressPulse {
  const sum = (from: DateKey, to: DateKey) => eachDay(from, to).reduce((n, d) => n + (counts.get(d) ?? 0), 0);
  const days = eachDay(addDays(end, -6), end).map((date) => ({ date, value: counts.get(date) ?? 0 }));
  const thisWeek = sum(addDays(end, -6), end);
  const lastWeek = sum(addDays(end, -13), addDays(end, -7));
  return { days, thisWeek, lastWeek, deltaPct: lastWeek > 0 ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : null };
}

export function buildMood(rows: { date: DateKey; mood: number | null }[], end: DateKey): MoodPulse {
  const byDate = new Map(rows.map((r) => [r.date, r.mood]));
  const points = eachDay(addDays(end, -13), end).map((date) => ({ date, value: byDate.get(date) ?? null }));
  const logged = points.filter((p) => p.value !== null).length;
  const last7 = points.slice(-7).map((p) => p.value).filter((v): v is number => v !== null);
  const latest = [...points].reverse().find((p) => p.value !== null)?.value ?? null;
  return { points, logged, avg7: last7.length ? Math.round((last7.reduce((a, b) => a + b, 0) / last7.length) * 10) / 10 : null, latest };
}

export async function loadPulse(o: { enabled: ModuleId[]; today: DateKey; focusTargetMin: number }): Promise<Pulse> {
  const on = (m: ModuleId) => o.enabled.includes(m);
  const weekStart = addDays(o.today, -6);
  const twoWeeksAgo = addDays(o.today, -13);

  const sessions = await sessionsInRange(weekStart, o.today);
  const perDay = minutesByDay(sessions);
  const focus: FocusPulse = {
    today: perDay.get(o.today) ?? 0,
    target: o.focusTargetMin,
    sessionsToday: sessions.filter((s) => s.date === o.today).length,
    week: eachDay(weekStart, o.today).map((date) => ({ date, value: perDay.get(date) ?? 0 })),
    weekTotal: sumMinutes(sessions),
  };

  let mood: MoodPulse | null = null;
  if (on('wellness')) mood = buildMood(await wellnessRange(twoWeeksAgo, o.today), o.today);

  let progress: ProgressPulse | null = null;
  if (on('tasks') || on('habits') || on('wellness')) {
    const [tasks, logs, workouts] = await Promise.all([
      on('tasks') ? tasksCompletedOn(twoWeeksAgo, o.today) : [],
      on('habits') ? logsInRange(twoWeeksAgo, o.today) : [],
      on('wellness') ? workoutsRange(twoWeeksAgo, o.today) : [],
    ]);
    const counts = new Map<DateKey, number>();
    for (const d of [...tasks.map((t) => t.completedOn!), ...logs.map((l) => l.date), ...workouts.map((w) => w.date)]) counts.set(d, (counts.get(d) ?? 0) + 1);
    progress = buildProgress(counts, o.today);
  }
  return { focus, mood, progress };
}
