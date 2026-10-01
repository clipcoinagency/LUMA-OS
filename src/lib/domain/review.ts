// Weekly Reset rules. A "reset" looks back at one week and plans the next. Which week to review
// depends on when you do it: at the end of a week you review the week that's finishing; early in the
// next week (catching up) you review the one that just ended. Pure + unit-tested.
import { addDays, startOfWeek, weekday, type DateKey } from '../util/dates';

export interface WeekPair {
  /** Start of the week being looked back on. */
  reviewWeek: DateKey;
  /** Start of the week being planned. */
  planWeek: DateKey;
}

/** How many of a week's final days count as "end of the week" (reset season begins here). */
const END_DAYS = 2;
/** …and how many days into the next week a reset still counts as timely. */
const GRACE_DAYS = 2;

export function weekToReview(day: DateKey, weekStartsOn: 0 | 1 = 1): WeekPair {
  const thisWeek = startOfWeek(day, weekStartsOn);
  const dayIndex = (weekday(day) - weekStartsOn + 7) % 7; // 0 = first day of the week
  const inEnd = dayIndex >= 7 - END_DAYS;
  const reviewWeek = inEnd ? thisWeek : addDays(thisWeek, -7);
  return { reviewWeek, planWeek: addDays(reviewWeek, 7) };
}

/** Is it reset season (end of a week, or the first days of the next)? */
export function inResetSeason(day: DateKey, weekStartsOn: 0 | 1 = 1): boolean {
  const dayIndex = (weekday(day) - weekStartsOn + 7) % 7;
  return dayIndex >= 7 - END_DAYS || dayIndex < GRACE_DAYS;
}

export type ResetNudge = 'ready' | 'catch-up' | null;

/**
 * Should Home nudge toward a reset? Only in season, and only if the relevant week isn't already done.
 * 'ready' = the week is ending; 'catch-up' = it ended a day or two ago and wasn't reset.
 */
export function resetNudge(day: DateKey, weekStartsOn: 0 | 1, reviewedWeeks: Set<DateKey>): ResetNudge {
  if (!inResetSeason(day, weekStartsOn)) return null;
  const { reviewWeek } = weekToReview(day, weekStartsOn);
  if (reviewedWeeks.has(reviewWeek)) return null;
  const dayIndex = (weekday(day) - weekStartsOn + 7) % 7;
  return dayIndex >= 7 - END_DAYS ? 'ready' : 'catch-up';
}

export const reviewId = (reviewWeek: DateKey) => `week|${reviewWeek}`;
