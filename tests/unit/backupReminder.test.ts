import { describe, expect, it } from 'vitest';
import { isBackupReminderDue } from '../../src/lib/domain/backupReminder';

const now = new Date('2026-09-28T12:00:00.000Z');
const daysAgo = (n: number, from = now) => new Date(from.getTime() - n * 86_400_000).toISOString();
const base = { reminderDays: 14, lastBackupAt: null, installedAt: null, snoozedAt: null, totalRecords: 10, now };

describe('backup reminder', () => {
  it('never nags when the reminder is turned off', () => {
    expect(isBackupReminderDue({ ...base, reminderDays: 0, lastBackupAt: daysAgo(999) })).toBe(false);
  });

  it('never nags a genuinely empty workspace — nothing to lose yet', () => {
    expect(isBackupReminderDue({ ...base, totalRecords: 0, installedAt: daysAgo(999) })).toBe(false);
  });

  it('has nothing to measure from if neither a backup nor an install date is known (should not happen post-boot)', () => {
    expect(isBackupReminderDue({ ...base, lastBackupAt: null, installedAt: null })).toBe(false);
  });

  it('falls back to installedAt when a backup has never been made', () => {
    expect(isBackupReminderDue({ ...base, installedAt: daysAgo(13) })).toBe(false); // not yet due
    expect(isBackupReminderDue({ ...base, installedAt: daysAgo(14) })).toBe(true);  // due today
    expect(isBackupReminderDue({ ...base, installedAt: daysAgo(30) })).toBe(true);  // overdue
  });

  it('a real backup always takes priority over installedAt once one exists', () => {
    expect(isBackupReminderDue({ ...base, installedAt: daysAgo(999), lastBackupAt: daysAgo(1) })).toBe(false);
    expect(isBackupReminderDue({ ...base, installedAt: daysAgo(1), lastBackupAt: daysAgo(20) })).toBe(true);
  });

  it('is due exactly at the boundary, not one day early', () => {
    expect(isBackupReminderDue({ ...base, lastBackupAt: daysAgo(13, now) })).toBe(false);
    expect(isBackupReminderDue({ ...base, lastBackupAt: daysAgo(14, now) })).toBe(true);
  });

  it('snoozing restarts the same interval, overriding a stale backup date', () => {
    const overdue = { ...base, lastBackupAt: daysAgo(30) };
    expect(isBackupReminderDue(overdue)).toBe(true);
    expect(isBackupReminderDue({ ...overdue, snoozedAt: daysAgo(1) })).toBe(false);
    expect(isBackupReminderDue({ ...overdue, snoozedAt: daysAgo(14) })).toBe(true); // snooze itself has expired
  });

  it('a fresh backup after an old snooze wins (the snooze becomes irrelevant)', () => {
    expect(isBackupReminderDue({ ...base, snoozedAt: daysAgo(20), lastBackupAt: daysAgo(1) })).toBe(false);
  });

  it('respects each configurable interval', () => {
    expect(isBackupReminderDue({ ...base, reminderDays: 7, lastBackupAt: daysAgo(6) })).toBe(false);
    expect(isBackupReminderDue({ ...base, reminderDays: 7, lastBackupAt: daysAgo(7) })).toBe(true);
    expect(isBackupReminderDue({ ...base, reminderDays: 30, lastBackupAt: daysAgo(29) })).toBe(false);
    expect(isBackupReminderDue({ ...base, reminderDays: 30, lastBackupAt: daysAgo(30) })).toBe(true);
  });

  it('is stable across a DST boundary (calendar-day math, not 24h math)', () => {
    // US "spring forward": 2026-03-08 -> 2026-03-09 is only 23 real hours in America/New_York,
    // but must still count as exactly one calendar day.
    const dstNow = new Date('2026-03-09T12:00:00.000Z');
    const lastBackup = new Date('2026-02-23T12:00:00.000Z').toISOString(); // 14 calendar days before dstNow
    expect(isBackupReminderDue({ ...base, now: dstNow, lastBackupAt: lastBackup })).toBe(true);
  });
});
