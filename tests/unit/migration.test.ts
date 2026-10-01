// Schema v1 → v2 must be purely additive: a user who upgrades keeps every row, and a brand-new
// install (which runs migrations 1 then 2) ends up with exactly the same set of stores.
import { describe, expect, it, afterEach } from 'vitest';
import { closeDB, openDB } from '../../src/lib/db/idb';
import { STORE_NAMES, STORES, V2_STORES } from '../../src/lib/db/schema';

const V1_STORES = STORE_NAMES.filter((s) => !V2_STORES.includes(s));

function rawV1(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of V1_STORES) {
        const os = db.createObjectStore(s, { keyPath: STORES[s].keyPath });
        for (const [idx, field] of Object.entries(STORES[s].indexes)) os.createIndex(idx, field);
      }
      req.transaction!.objectStore('tasks').put({ id: 'task_old', title: 'From v1', done: false, createdOn: '2026-01-01' });
    };
    req.onsuccess = () => { req.result.close(); resolve(); };
    req.onerror = () => reject(req.error);
  });
}

const storeNames = (db: IDBDatabase) => [...db.objectStoreNames].sort();

afterEach(async () => { await closeDB(); });

describe('schema migrations', () => {
  it('upgrading a v1 database adds the v2 stores and keeps existing rows', async () => {
    await rawV1('mig-upgrade');
    const db = await openDB('mig-upgrade', 2);
    expect(storeNames(db)).toEqual([...STORE_NAMES].sort());
    const row = await new Promise<unknown>((resolve) => {
      db.transaction('tasks').objectStore('tasks').get('task_old').onsuccess = (e) => resolve((e.target as IDBRequest).result);
    });
    expect(row).toMatchObject({ id: 'task_old', title: 'From v1' });
  });

  it('a fresh install ends up with the same stores as an upgrade', async () => {
    const db = await openDB('mig-fresh', 2);
    expect(storeNames(db)).toEqual([...STORE_NAMES].sort());
  });

  it('the v2 stores carry their indexes', async () => {
    const db = await openDB('mig-idx', 2);
    const t = db.transaction(['focus_sessions', 'projects', 'reviews']);
    expect([...t.objectStore('focus_sessions').indexNames]).toEqual(['by_date', 'by_task']);
    expect([...t.objectStore('projects').indexNames]).toEqual(['by_kind', 'by_status']);
    expect([...t.objectStore('reviews').indexNames]).toEqual(['by_date']);
  });
});
