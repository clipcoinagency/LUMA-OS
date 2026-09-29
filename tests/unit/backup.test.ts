import { beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { boot } from '../../src/lib/db/defaults';
import { closeDB, count, get, getAll, getRange, put } from '../../src/lib/db/idb';
import {
  createBackup, latestSafetySnapshot, resetModule, resetWorkspace, restoreBackup, serializeBackup, validateBackupText,
} from '../../src/lib/backup/backup';
import { fnv1a } from '../../src/lib/util/checksum';
import type { Task, Transaction } from '../../src/lib/db/schema';

const now = '2026-09-26T10:00:00.000Z';
const task = (id: string, createdOn = '2026-09-26'): Task => ({
  id, title: 'Task ' + id, notes: '', priority: 'medium', dueDate: null, dueTime: null, reminder: false, remindedOn: null, tags: [], done: false,
  completedOn: null, createdOn, createdAt: now, updatedAt: now,
});
const txn = (id: string, date: string, amountMinor: number): Transaction => ({
  id, date, type: 'expense', amountMinor, currency: 'USD', categoryId: null, note: '', createdAt: now, updatedAt: now,
});
const resign = (b: { data: unknown; checksum: string }) => { b.checksum = 'fnv1a32:' + fnv1a(JSON.stringify(b.data)); return b; };

beforeEach(async () => {
  await closeDB();
  globalThis.indexedDB = new IDBFactory();
});

describe('database', () => {
  it('seeds defaults on first run and counts launches', async () => {
    const a = await boot();
    expect(a.firstRun).toBe(true);
    expect(a.workspace.enabledModules).toHaveLength(7);
    expect(await count('finance_categories')).toBeGreaterThan(5);
    const b = await boot();
    expect(b.firstRun).toBe(false);
    expect(b.launches).toBe(2);
  });

  it('queries history by date range', async () => {
    await boot();
    await put('transactions', txn('t1', '2026-08-31', 100));
    await put('transactions', txn('t2', '2026-09-01', 200));
    await put('transactions', txn('t3', '2026-09-30', 300));
    await put('transactions', txn('t4', '2026-10-01', 400));
    const sept = await getRange('transactions', 'by_date', '2026-09-01', '2026-09-30');
    expect(sept.map((t) => t.id).sort()).toEqual(['t2', 't3']);
  });
});

describe('backup / restore', () => {
  it('round-trips every record and excludes device-only data', async () => {
    await boot();
    await put('tasks', task('a'));
    await put('tasks', task('b'));
    const backup = await createBackup();
    expect(backup.format).toBe('lifeos-backup');
    expect(backup.counts.tasks).toBe(2);
    expect((backup.data.meta as { key: string }[]).some((m) => m.key === 'launches')).toBe(false);
    expect(backup.data.safety).toBeUndefined();

    const v = validateBackupText(serializeBackup(backup));
    expect(v.ok).toBe(true);
    await resetWorkspace();
    expect(await count('tasks')).toBe(0);
    if (!v.ok) throw new Error('invalid');
    await restoreBackup(v.backup);
    expect(await count('tasks')).toBe(2);
    expect((await get('settings', 'settings'))?.id).toBe('settings');
    expect((await get('meta', 'launches'))?.value).toBe(1); // device counter preserved
  });

  it('keeps a safety snapshot before restore', async () => {
    await boot();
    await put('tasks', task('before'));
    const empty = await createBackup();
    empty.data.tasks = [];
    resign(empty);
    await restoreBackup(empty);
    expect(await count('tasks')).toBe(0);
    const snap = await latestSafetySnapshot();
    expect(snap?.reason).toBe('before-restore');
    expect((snap?.backup as { data: { tasks: Task[] } }).data.tasks[0]?.id).toBe('before');
  });

  it('rejects damaged, foreign, newer and invalid backups with friendly reasons', async () => {
    await boot();
    await put('tasks', task('a'));
    const good = serializeBackup(await createBackup());
    const b = JSON.parse(good);
    const cases: Record<string, string> = {
      empty: '',
      notJson: 'PK\u0003\u0004 zip header',
      wrongKind: JSON.stringify({ hello: 'world' }),
      newer: JSON.stringify({ ...b, schemaVersion: 99 }),
      edited: good.replace('Task a', 'Task hacked'),
      truncated: good.slice(0, good.length / 2),
    };
    for (const [name, text] of Object.entries(cases)) {
      const r = validateBackupText(text);
      expect(r.ok, name).toBe(false);
      if (!r.ok) expect(r.reason.length, name).toBeGreaterThan(10);
    }
    // structurally invalid rows are caught even with a valid checksum
    const badDate = resign({ ...b, data: { ...b.data, tasks: [{ ...b.data.tasks[0], createdOn: '2026-02-30' }] } });
    expect(validateBackupText(JSON.stringify(badDate)).ok).toBe(false);
    const dup = resign({ ...b, data: { ...b.data, tasks: [b.data.tasks[0], b.data.tasks[0]] } });
    expect(validateBackupText(JSON.stringify(dup)).ok).toBe(false);
    const unknown = resign({ ...b, data: { ...b.data, secrets: [] } });
    expect(validateBackupText(JSON.stringify(unknown)).ok).toBe(false);
  });

  it('restore is atomic: a failing write leaves existing data untouched', async () => {
    await boot();
    await put('tasks', task('keep-me'));
    const backup = await createBackup();
    // an unstorable value (a function) makes put() throw mid-transaction
    backup.data.tasks = [task('x'), { ...task('y'), bad: () => 1 } as unknown as Task];
    await expect(restoreBackup(backup, { snapshot: false })).rejects.toBeTruthy();
    const tasks = await getAll('tasks');
    expect(tasks.map((t) => t.id)).toEqual(['keep-me']);
  });

  it('resets one module without touching others', async () => {
    await boot();
    await put('tasks', task('a'));
    await put('transactions', txn('t1', '2026-09-01', 100));
    await resetModule('finance');
    expect(await count('transactions')).toBe(0);
    expect(await count('finance_categories')).toBe(0);
    expect(await count('tasks')).toBe(1);
  });
});
