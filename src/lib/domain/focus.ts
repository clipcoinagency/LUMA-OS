// Focus sessions. The timer is computed from timestamps (never counted by an interval), so a
// backgrounded tab, a sleeping laptop or a page reload can't make it drift or lose the session.
// The running session is parked in `meta` (device-local) until it ends; only finished sessions are
// real records — that's what feeds focus time on Home, in Insights and in the Weekly Reset.
import { addDays, nowIso, today, type DateKey } from '../util/dates';
import { newId } from '../util/ids';
import { get, getRange, getByIndex, put, remove } from '../db/idb';
import { bump } from '../db/changes.svelte';
import type { FocusSession } from '../db/schema';

export interface ActiveFocus {
  startedAt: string;
  plannedMin: number;
  extraMin: number;               // "keep going" time added after the plan was reached
  taskId: string | null;
  projectId: string | null;
  label: string;
  pausedAt: string | null;        // set while paused
  pausedMs: number;               // total time spent paused
}

/** Sessions shorter than this are treated as accidental taps and not recorded. */
export const MIN_RECORDED_SECONDS = 30;

export function elapsedMs(a: ActiveFocus, nowMs: number): number {
  const end = a.pausedAt ? Date.parse(a.pausedAt) : nowMs;
  return Math.max(0, end - Date.parse(a.startedAt) - a.pausedMs);
}
export const targetMs = (a: ActiveFocus) => (a.plannedMin + a.extraMin) * 60_000;
export const remainingMs = (a: ActiveFocus, nowMs: number) => Math.max(0, targetMs(a) - elapsedMs(a, nowMs));
export const progressOf = (a: ActiveFocus, nowMs: number) => (targetMs(a) > 0 ? Math.min(1, elapsedMs(a, nowMs) / targetMs(a)) : 0);

export function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60), s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** "1h 20m" / "45m" / "—" for zero. */
export function formatMinutes(min: number): string {
  const m = Math.round(min);
  if (m <= 0) return '0m';
  const h = Math.floor(m / 60), r = m % 60;
  return h ? (r ? `${h}h ${r}m` : `${h}h`) : `${r}m`;
}

export function pausedState(a: ActiveFocus, nowMs: number): ActiveFocus {
  return a.pausedAt ? a : { ...a, pausedAt: new Date(nowMs).toISOString() };
}
export function resumedState(a: ActiveFocus, nowMs: number): ActiveFocus {
  if (!a.pausedAt) return a;
  return { ...a, pausedAt: null, pausedMs: a.pausedMs + Math.max(0, nowMs - Date.parse(a.pausedAt)) };
}

// ---------------------------------------------------------------- parked running session (device-local)

export async function loadActive(): Promise<ActiveFocus | null> {
  const row = await get('meta', 'activeFocus');
  return (row?.value as ActiveFocus | undefined) ?? null;
}
export async function saveActive(a: ActiveFocus): Promise<void> {
  await put('meta', { key: 'activeFocus', value: a });
}
export async function clearActive(): Promise<void> {
  await remove('meta', 'activeFocus');
}

// ---------------------------------------------------------------- finished sessions

export async function recordSession(a: ActiveFocus, endedAtMs: number): Promise<FocusSession | null> {
  const seconds = Math.round(elapsedMs(a, endedAtMs) / 1000);
  if (seconds < MIN_RECORDED_SECONDS) return null;
  const startedDay = a.startedAt.slice(0, 10) as DateKey;
  const s: FocusSession = {
    id: newId('focus'), date: localDay(a.startedAt) ?? startedDay, startedAt: a.startedAt, endedAt: new Date(endedAtMs).toISOString(),
    seconds, plannedMin: a.plannedMin + a.extraMin, taskId: a.taskId, projectId: a.projectId, label: a.label, createdAt: nowIso(),
  };
  await put('focus_sessions', s);
  bump();
  return s;
}

/** The user's local calendar day for an ISO instant. */
export function localDay(iso: string): DateKey | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export const sessionsInRange = (from: DateKey, to: DateKey) => getRange('focus_sessions', 'by_date', from, to);
export const sessionsForTask = (taskId: string) => getByIndex('focus_sessions', 'by_task', taskId);

export const sumMinutes = (sessions: Pick<FocusSession, 'seconds'>[]) => sessions.reduce((n, s) => n + s.seconds, 0) / 60;

/** Minutes per day (only days with focus appear). */
export function minutesByDay(sessions: Pick<FocusSession, 'date' | 'seconds'>[]): Map<DateKey, number> {
  const out = new Map<DateKey, number>();
  for (const s of sessions) out.set(s.date, (out.get(s.date) ?? 0) + s.seconds / 60);
  return out;
}

export async function focusMinutesToday(day: DateKey = today()): Promise<number> {
  return sumMinutes(await sessionsInRange(day, day));
}

/** Last `days` days (ending today) as an ordered series — zeros are real zeros, not gaps. */
export async function focusSeries(days: number, end: DateKey = today()): Promise<{ date: DateKey; minutes: number }[]> {
  const start = addDays(end, -(days - 1));
  const map = minutesByDay(await sessionsInRange(start, end));
  return Array.from({ length: days }, (_, i) => { const d = addDays(start, i); return { date: d, minutes: map.get(d) ?? 0 }; });
}
