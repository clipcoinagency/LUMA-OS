// Backup reminder — a quiet, dismissible nudge, never a blocker. Pure decision logic lives here
// (easy to unit-test); the thin IO wrapper below reads what it needs and is used by app state.
import { toDateKey, diffDays, type DateKey } from '../util/dates';
import { get, countAll } from '../db/idb';
import { BACKUP_STORES, CONFIG_STORES } from '../db/schema';

export interface BackupReminderInput {
  /** settings.backupReminderDays — 0 disables the reminder entirely. */
  reminderDays: number;
  lastBackupAt: string | null;
  /** Always set after first boot; the fallback baseline when a backup has never been made. */
  installedAt: string | null;
  /** Set when the user dismisses the reminder; snoozing restarts the same interval. */
  snoozedAt: string | null;
  /** Nothing to lose yet → nothing to nag about. */
  totalRecords: number;
  now: Date;
}

/** Pure: no I/O, no clock reads beyond the `now` passed in — safe to unit-test exhaustively. */
export function isBackupReminderDue(input: BackupReminderInput): boolean {
  const { reminderDays, lastBackupAt, installedAt, snoozedAt, totalRecords, now } = input;
  if (reminderDays <= 0 || totalRecords <= 0) return false;
  const baseline = lastBackupAt ?? installedAt;
  if (!baseline) return false; // nothing to measure from (shouldn't happen post-boot)
  const today: DateKey = toDateKey(now);
  const since = (iso: string) => diffDays(toDateKey(new Date(iso)), today);
  const days = snoozedAt ? Math.min(since(baseline), since(snoozedAt)) : since(baseline);
  return days >= reminderDays;
}

export async function checkBackupReminder(reminderDays: number, now: Date = new Date()): Promise<boolean> {
  if (reminderDays <= 0) return false;
  const [lastBackupAt, installedAt, snoozedAt, counts] = await Promise.all([
    get('meta', 'lastBackupAt'), get('meta', 'installedAt'), get('meta', 'backupReminderSnoozedAt'),
    countAll(BACKUP_STORES.filter((s) => !CONFIG_STORES.includes(s))),
  ]);
  const totalRecords = Object.values(counts).reduce((a, b) => a + b, 0);
  return isBackupReminderDue({
    reminderDays,
    lastBackupAt: (lastBackupAt?.value as string) ?? null,
    installedAt: (installedAt?.value as string) ?? null,
    snoozedAt: (snoozedAt?.value as string) ?? null,
    totalRecords,
    now,
  });
}
