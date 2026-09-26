// Backup actions shared by Settings, onboarding and the backup reminder.
import { get } from '../../lib/db/idb';
import { backupFileName, createBackup, latestSafetySnapshot, markBackupDone, restoreBackup, serializeBackup, validateBackupText } from '../../lib/backup/backup';
import { saveTextFile } from '../../lib/platform/platform';
import { toast } from '../../lib/ui/toast.svelte';
import { app } from '../../lib/app.svelte';

export async function backUpNow(): Promise<boolean> {
  try {
    const res = await saveTextFile(backupFileName(), serializeBackup(await createBackup()));
    if (res.cancelled) return false;
    await markBackupDone();
    toast(`Backup saved to ${res.where}`, { tone: 'success' });
    return true;
  } catch (e) {
    console.error('Backup failed', e);
    toast("Couldn't create the backup. Please try again.", { tone: 'danger' });
    return false;
  }
}

/** Puts back the automatic safety copy taken before the last restore or reset. */
export async function undoLastChange(): Promise<void> {
  const snap = await latestSafetySnapshot();
  if (!snap) { toast('Nothing to undo.'); return; }
  const v = validateBackupText(JSON.stringify(snap.backup));
  if (!v.ok) { toast("The safety copy couldn't be used.", { tone: 'danger' }); return; }
  try {
    await restoreBackup(v.backup, { snapshot: false });
    await app.reload();
    toast('Your data is back to how it was before', { tone: 'success' });
  } catch (e) {
    console.error('Undo failed', e);
    toast("Couldn't undo. Your current data wasn't changed.", { tone: 'danger' });
  }
}

export async function lastBackupAt(): Promise<string | null> {
  return ((await get('meta', 'lastBackupAt'))?.value as string | undefined) ?? null;
}
