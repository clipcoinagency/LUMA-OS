// Wellness days, workouts, events and notes — small storage helpers used across the app.
import { addDays, nowIso, today, type DateKey } from '../util/dates';
import { get, getAll, getRange, put } from '../db/idb';
import { bump } from '../db/changes.svelte';
import type { CalendarEvent, Note, WellnessDay, Workout } from '../db/schema';

export function emptyDay(date: DateKey): WellnessDay {
  return { id: date, date, water: null, sleepHours: null, mood: null, steps: null, weight: null, note: '', updatedAt: nowIso() };
}

export async function getWellness(date: DateKey = today()): Promise<WellnessDay> {
  return (await get('wellness', date)) ?? emptyDay(date);
}

/** Upserts one day's wellness row (one row per date — past days stay as they were). */
export async function updateWellness(date: DateKey, patch: Partial<Omit<WellnessDay, 'id' | 'date'>>): Promise<WellnessDay> {
  const next = { ...(await getWellness(date)), ...patch, id: date, date, updatedAt: nowIso() };
  await put('wellness', next);
  bump();
  return next;
}

export async function wellnessRange(from: DateKey, to: DateKey): Promise<WellnessDay[]> {
  return getRange('wellness', 'by_date', from, to);
}

export async function workoutsRange(from: DateKey, to: DateKey): Promise<Workout[]> {
  return getRange('workouts', 'by_date', from, to);
}

export async function upcomingEvents(from: DateKey = today(), days = 14, limit = 5): Promise<CalendarEvent[]> {
  const rows = await getRange('events', 'by_date', from, addDays(from, days));
  return rows.sort((a, b) => a.date.localeCompare(b.date) || (a.allDay ? -1 : 0) - (b.allDay ? -1 : 0) || (a.startTime ?? '').localeCompare(b.startTime ?? '')).slice(0, limit);
}

export async function recentNotes(limit = 4): Promise<Note[]> {
  return (await getAll('notes')).sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt)).slice(0, limit);
}
