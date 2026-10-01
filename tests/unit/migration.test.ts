// Schema upgrades must be purely additive: a user who upgrades keeps every row, and a brand-new
// install (which runs every migration in order) ends up with exactly the same set of stores.
import { describe, expect, it, afterEach } from 'vitest';
import { closeDB, openDB } from '../../src/lib/db/idb';
import { STORE_NAMES, STORES, V2_STORES, V3_STORES, SCHEMA_VERSION } from '../../src/lib/db/schema';

const V1_STORES = STORE_NAMES.filter((s) => !V2_STORES.includes(s) && !V3_STORES.includes(s));

/** Creates a database as an older release would have left it (only the given stores), with one old task. */
function rawOld(name: string, version: number, stores: typeof STORE_NAMES): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, version);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of stores) {
        const os = db.createObjectStore(s, { keyPath: STORES[s].keyPath });
        for (const [idx, field] of Object.entries(STORES[s].indexes)) os.createIndex(idx, field);
      }
      req.transaction!.objectStore('tasks').put({ id: 'task_old', title: 'From an older version', done: false, createdOn: '2026-01-01' });
    };
    req.onsuccess = () => { req.result.close(); resolve(); };
    req.onerror = () => reject(req.error);
  });
}

const storeNames = (db: IDBDatabase) => [...db.objectStoreNames].sort();
const oldTask = (db: IDBDatabase) => new Promise<unknown>((resolve) => {
  db.transaction('tasks').objectStore('tasks').get('task_old').onsuccess = (e) => resolve((e.target as IDBRequest).result);
});

afterEach(async () => { await closeDB(); });

describe('schema migrations', () => {
  it('is at schema version 3', () => { expect(SCHEMA_VERSION).toBe(3); });

  it('upgrading a v1 database adds the v2 and v3 stores and keeps existing rows', async () => {
    await rawOld('mig-upgrade-1', 1, V1_STORES);
    const db = await openDB('mig-upgrade-1', SCHEMA_VERSION);
    expect(storeNames(db)).toEqual([...STORE_NAMES].sort());
    expect(await oldTask(db)).toMatchObject({ id: 'task_old', title: 'From an older version' });
  });

  it('upgrading a v2 database adds only the Study & Read stores and keeps existing rows', async () => {
    await rawOld('mig-upgrade-2', 2, [...V1_STORES, ...V2_STORES]);
    const db = await openDB('mig-upgrade-2', SCHEMA_VERSION);
    expect(storeNames(db)).toEqual([...STORE_NAMES].sort());
    expect(await oldTask(db)).toMatchObject({ id: 'task_old' });
    for (const s of V3_STORES) expect(db.objectStoreNames.contains(s)).toBe(true);
  });

  it('a fresh install ends up with the same stores as an upgrade', async () => {
    const db = await openDB('mig-fresh', SCHEMA_VERSION);
    expect(storeNames(db)).toEqual([...STORE_NAMES].sort());
  });

  it('the v2 and v3 stores carry their indexes', async () => {
    const db = await openDB('mig-idx', SCHEMA_VERSION);
    const t = db.transaction(['focus_sessions', 'projects', 'reviews', 'books', 'reading_logs', 'decks', 'cards', 'card_reviews']);
    expect([...t.objectStore('focus_sessions').indexNames]).toEqual(['by_date', 'by_task']);
    expect([...t.objectStore('projects').indexNames]).toEqual(['by_kind', 'by_status']);
    expect([...t.objectStore('reviews').indexNames]).toEqual(['by_date']);
    expect([...t.objectStore('books').indexNames]).toEqual(['by_status', 'by_updated']);
    expect([...t.objectStore('reading_logs').indexNames]).toEqual(['by_book', 'by_date']);
    expect([...t.objectStore('cards').indexNames]).toEqual(['by_deck', 'by_due']);
    expect([...t.objectStore('card_reviews').indexNames]).toEqual(['by_card', 'by_date']);
  });
});
