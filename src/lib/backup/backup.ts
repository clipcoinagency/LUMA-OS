// Backup / restore — format and pipeline validated in Phase 0.
//
// Restore pipeline: size → parse → format marker → version (newer = refuse, older = migrate)
// → structure + per-row validation → checksum → [UI preview + confirm] → safety snapshot
// → ONE atomic transaction (any failure leaves existing data untouched).

import { fnv1a } from '../util/checksum';
import { isDateKey, nowIso, today } from '../util/dates';
import { newId } from '../util/ids';
import { transact, getAll } from '../db/idb';
import { APP_VERSION } from '../db/defaults';
import {
  BACKUP_STORES, CONFIG_STORES, DEVICE_META_KEYS, SCHEMA_VERSION, STORES,
  type ModuleId, type SafetySnapshot, type StoreName,
} from '../db/schema';

export const BACKUP_FORMAT = 'lifeos-backup';
export const BACKUP_FORMAT_VERSION = 1;
export const MAX_BACKUP_BYTES = 200 * 1024 * 1024;
const SAFETY_KEEP = 3;

export type BackupData = Partial<Record<StoreName, unknown[]>>;

export interface Backup {
  format: typeof BACKUP_FORMAT;
  formatVersion: number;
  app: 'Life OS';
  appVersion: string;
  schemaVersion: number;
  exportedAt: string;
  exportedLocalDate: string;
  counts: Record<string, number>;
  checksum: string;
  data: BackupData;
}

export interface BackupSummary {
  exportedAt: string;
  appVersion: string;
  schemaVersion: number;
  counts: Record<string, number>;
  totalRecords: number;
}

export type ValidationResult =
  | { ok: true; backup: Backup; summary: BackupSummary }
  | { ok: false; reason: string };

export function backupFileName(date = today()): string {
  return `LifeOS-Backup-${date}.json`;
}

const checksumOf = (data: BackupData) => 'fnv1a32:' + fnv1a(JSON.stringify(data));

export async function createBackup(): Promise<Backup> {
  const data = await transact<BackupData>(BACKUP_STORES, 'readonly', (t, set) => {
    const out: BackupData = {};
    for (const s of BACKUP_STORES) t.objectStore(s).getAll().onsuccess = (e) => { out[s] = (e.target as IDBRequest).result; };
    set(out);
  });
  data.meta = (data.meta as { key: string }[]).filter((r) => !DEVICE_META_KEYS.includes(r.key));
  const counts = Object.fromEntries(BACKUP_STORES.map((s) => [s, data[s]?.length ?? 0]));
  return {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    app: 'Life OS',
    appVersion: APP_VERSION,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: nowIso(),
    exportedLocalDate: today(),
    counts,
    checksum: checksumOf(data),
    data,
  };
}

export function serializeBackup(b: Backup): string {
  return JSON.stringify(b);
}

/** Older backups are upgraded here, one schema step at a time. */
const BACKUP_MIGRATIONS: Record<number, (data: BackupData) => BackupData> = {
  // v2 only ADDED stores (projects, focus_sessions, reviews) and optional fields: a v1 backup is already
  // valid v2 data, the new stores are simply empty.
  2: (data) => data,
};

function fail(reason: string): ValidationResult {
  return { ok: false, reason };
}

export function validateBackupText(text: string): ValidationResult {
  if (typeof text !== 'string' || !text.trim()) return fail('This file is empty.');
  let obj: unknown;
  try {
    obj = JSON.parse(text);
  } catch {
    return fail("This file couldn't be read as a Life OS backup. It may be damaged, cut off during download, or a different kind of file.");
  }
  const b = obj as Partial<Backup> | null;
  if (!b || typeof b !== 'object' || b.format !== BACKUP_FORMAT) return fail("This file isn't a Life OS backup.");
  if (!Number.isInteger(b.schemaVersion) || (b.schemaVersion as number) < 1) return fail('This backup is missing its version information, so it cannot be restored safely.');
  if ((b.schemaVersion as number) > SCHEMA_VERSION) {
    return fail(`This backup was made with a newer version of Life OS (${b.appVersion ?? 'unknown'}). Please update Life OS, then restore it.`);
  }
  if (!b.data || typeof b.data !== 'object') return fail('This backup is incomplete.');
  if (b.checksum !== checksumOf(b.data)) return fail('This backup appears damaged or was edited (integrity check failed).');

  let data = b.data as BackupData;
  for (let v = (b.schemaVersion as number) + 1; v <= SCHEMA_VERSION; v++) {
    const step = BACKUP_MIGRATIONS[v];
    if (step) data = step(data);
  }

  for (const store of Object.keys(data)) {
    if (!(BACKUP_STORES as string[]).includes(store)) return fail(`This backup contains unknown data ("${store}").`);
  }
  const counts: Record<string, number> = {};
  let total = 0;
  for (const store of BACKUP_STORES) {
    const rows = data[store] ?? [];
    if (!Array.isArray(rows)) return fail(`This backup's ${store} section is damaged.`);
    const def = STORES[store];
    const seen = new Set<string>();
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] as Record<string, unknown> | null;
      if (!row || typeof row !== 'object') return fail(`This backup contains an invalid ${store} entry (#${i + 1}).`);
      const key = row[def.keyPath];
      if (typeof key !== 'string' || !key) return fail(`This backup contains a ${store} entry without an id (#${i + 1}).`);
      if (seen.has(key)) return fail(`This backup contains duplicate ${store} entries.`);
      seen.add(key);
      if (def.dateField && !isDateKey(row[def.dateField])) return fail(`This backup contains a ${store} entry with an invalid date (#${i + 1}).`);
    }
    counts[store] = rows.length;
    if (!CONFIG_STORES.includes(store)) total += rows.length;
  }
  if ((data.settings?.length ?? 0) > 1 || (data.workspace?.length ?? 0) > 1) return fail('This backup contains conflicting settings.');

  const backup: Backup = { ...(b as Backup), schemaVersion: SCHEMA_VERSION, data };
  return {
    ok: true,
    backup,
    summary: { exportedAt: b.exportedAt ?? '', appVersion: b.appVersion ?? '?', schemaVersion: b.schemaVersion as number, counts, totalRecords: total },
  };
}

// ---------------------------------------------------------------- safety snapshots

export async function takeSafetySnapshot(reason: SafetySnapshot['reason']): Promise<SafetySnapshot> {
  const backup = await createBackup();
  const snap: SafetySnapshot = { id: newId('safety'), createdAt: nowIso(), reason, appVersion: APP_VERSION, schemaVersion: SCHEMA_VERSION, backup };
  const existing = await getAll('safety');
  await transact<void>('safety', 'readwrite', (t) => {
    const os = t.objectStore('safety');
    os.put(snap);
    existing.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(SAFETY_KEEP - 1).forEach((old) => os.delete(old.id));
  });
  return snap;
}

export async function latestSafetySnapshot(): Promise<SafetySnapshot | undefined> {
  const all = await getAll('safety');
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

// ---------------------------------------------------------------- restore / reset

/** Replaces all workspace data with the backup in ONE transaction. Device meta is preserved. */
export async function restoreBackup(backup: Backup, { snapshot = true } = {}): Promise<void> {
  if (snapshot) await takeSafetySnapshot('before-restore');
  await transact<void>(BACKUP_STORES, 'readwrite', (t) => {
    const meta = t.objectStore('meta');
    const keep: unknown[] = [];
    for (const k of DEVICE_META_KEYS) meta.get(k).onsuccess = (e) => { const r = (e.target as IDBRequest).result; if (r) keep.push(r); };
    // Requests on one store run in order, so this fires after the gets above.
    meta.count().onsuccess = () => {
      for (const store of BACKUP_STORES) {
        const os = t.objectStore(store);
        os.clear();
        for (const row of backup.data[store] ?? []) {
          if (store === 'meta' && DEVICE_META_KEYS.includes((row as { key: string }).key)) continue;
          os.put(row);
        }
      }
      for (const row of keep) meta.put(row);
      meta.put({ key: 'lastRestoreAt', value: nowIso() });
    };
  });
}

/** Deletes one module's records (not its settings). Takes a safety snapshot first. */
export async function resetModule(module: ModuleId): Promise<void> {
  const stores = (Object.keys(STORES) as StoreName[]).filter((s) => STORES[s].module === module);
  await takeSafetySnapshot('before-reset');
  await transact<void>(stores, 'readwrite', (t) => { for (const s of stores) t.objectStore(s).clear(); });
}

/** Deletes EVERYTHING including settings (back to first-run). Safety snapshot is kept locally. */
export async function resetWorkspace(): Promise<void> {
  await takeSafetySnapshot('before-reset');
  await transact<void>(BACKUP_STORES, 'readwrite', (t) => {
    for (const s of BACKUP_STORES) {
      if (s === 'meta') continue;
      t.objectStore(s).clear();
    }
    t.objectStore('meta').put({ key: 'lastResetAt', value: nowIso() });
  });
}

export async function markBackupDone(): Promise<void> {
  await transact<void>('meta', 'readwrite', (t) => { t.objectStore('meta').put({ key: 'lastBackupAt', value: nowIso() }); });
}
