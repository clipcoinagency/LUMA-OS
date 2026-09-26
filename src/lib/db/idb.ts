// Thin, typed IndexedDB layer (prototype proven in Phase 0 on Edge, Chrome, Firefox, WebKit, Safari).
//  • Migrations run in order inside the upgrade transaction and are never destructive.
//  • Writes use durability "strict": the promise resolves only after the data is on disk.
//  • Promises resolve when the TRANSACTION commits, not when a request succeeds.

import { DB_NAME, SCHEMA_VERSION, STORES, type StoreName, type StoreRecordMap } from './schema';

export type StorageErrorKind = 'unavailable' | 'blocked' | 'quota' | 'newer-version' | 'unknown';

export class StorageError extends Error {
  constructor(public kind: StorageErrorKind, message: string, public cause?: unknown) {
    super(message);
    this.name = 'StorageError';
  }
}

export function toStorageError(e: unknown): StorageError {
  if (e instanceof StorageError) return e;
  const name = (e as { name?: string } | null)?.name;
  if (name === 'QuotaExceededError') return new StorageError('quota', 'This device is out of storage space for Life OS.', e);
  if (name === 'VersionError') return new StorageError('newer-version', 'Your data was saved by a newer version of Life OS. Please open the newest version.', e);
  if (name === 'InvalidStateError' || name === 'SecurityError') return new StorageError('unavailable', 'Your browser is blocking storage here (for example a private/incognito window).', e);
  return new StorageError('unknown', 'Life OS could not access its storage. Closing and reopening your browser usually fixes this.', e);
}

type Migration = (db: IDBDatabase, tx: IDBTransaction) => void;

function createStore(db: IDBDatabase, name: StoreName) {
  const def = STORES[name];
  const os = db.createObjectStore(name, { keyPath: def.keyPath });
  for (const [idx, field] of Object.entries(def.indexes)) os.createIndex(idx, field);
}

/** MIGRATIONS[n] upgrades a database from version n-1 to n. Append only. */
export const MIGRATIONS: Record<number, Migration> = {
  1: (db) => {
    for (const name of Object.keys(STORES) as StoreName[]) createStore(db, name);
  },
};

let dbPromise: Promise<IDBDatabase> | null = null;
let onVersionChange: (() => void) | null = null;

export function setVersionChangeHandler(fn: () => void) {
  onVersionChange = fn;
}

export function openDB(name = DB_NAME, version = SCHEMA_VERSION): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined' || !indexedDB) {
      reject(new StorageError('unavailable', 'This browser does not support offline storage.'));
      return;
    }
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(name, version);
    } catch (e) {
      reject(toStorageError(e));
      return;
    }
    req.onupgradeneeded = (ev) => {
      const db = req.result;
      const tx = req.transaction!;
      for (let v = ev.oldVersion + 1; v <= version; v++) {
        const step = MIGRATIONS[v];
        if (!step) throw new Error(`Missing migration to v${v}`);
        step(db, tx);
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
        onVersionChange?.();
      };
      resolve(db);
    };
    req.onerror = () => reject(toStorageError(req.error));
    req.onblocked = () => reject(new StorageError('blocked', 'Please close other Life OS windows, then reopen this one.'));
  });
  dbPromise.catch(() => { dbPromise = null; });
  return dbPromise;
}

/** Test helper: forget the cached connection (and close it). */
export async function closeDB() {
  if (!dbPromise) return;
  const p = dbPromise;
  dbPromise = null;
  try { (await p).close(); } catch { /* ignore */ }
}

export async function transact<T>(
  stores: StoreName | StoreName[],
  mode: IDBTransactionMode,
  work: (tx: IDBTransaction, set: (v: T) => void) => void,
): Promise<T> {
  const db = await openDB();
  return new Promise<T>((resolve, reject) => {
    let result: T;
    let t: IDBTransaction;
    try {
      t = mode === 'readwrite' ? db.transaction(stores, mode, { durability: 'strict' }) : db.transaction(stores, mode);
    } catch (e) {
      reject(toStorageError(e));
      return;
    }
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(toStorageError(t.error));
    t.onabort = () => reject(toStorageError(t.error ?? new Error('Transaction aborted')));
    try {
      work(t, (v) => { result = v; });
    } catch (e) {
      try { t.abort(); } catch { /* already finished */ }
      reject(e);
    }
  });
}

// ---------------------------------------------------------------- generic operations

export function get<S extends StoreName>(store: S, key: IDBValidKey): Promise<StoreRecordMap[S] | undefined> {
  return transact<StoreRecordMap[S] | undefined>(store, 'readonly', (t, set) => {
    t.objectStore(store).get(key).onsuccess = (e) => set((e.target as IDBRequest).result);
  });
}

export function getAll<S extends StoreName>(store: S): Promise<StoreRecordMap[S][]> {
  return transact<StoreRecordMap[S][]>(store, 'readonly', (t, set) => {
    t.objectStore(store).getAll().onsuccess = (e) => set((e.target as IDBRequest).result);
  });
}

export function getByIndex<S extends StoreName>(store: S, index: string, query: IDBValidKey | IDBKeyRange): Promise<StoreRecordMap[S][]> {
  return transact<StoreRecordMap[S][]>(store, 'readonly', (t, set) => {
    t.objectStore(store).index(index).getAll(query).onsuccess = (e) => set((e.target as IDBRequest).result);
  });
}

/** Rows whose date index is within [from, to] (inclusive DateKeys). */
export function getRange<S extends StoreName>(store: S, index: string, from: string, to: string) {
  return getByIndex(store, index, IDBKeyRange.bound(from, to));
}

export function put<S extends StoreName>(store: S, value: StoreRecordMap[S]): Promise<void> {
  return transact<void>(store, 'readwrite', (t) => { t.objectStore(store).put(value); });
}

export function putMany<S extends StoreName>(store: S, values: StoreRecordMap[S][]): Promise<void> {
  return transact<void>(store, 'readwrite', (t) => {
    const os = t.objectStore(store);
    for (const v of values) os.put(v);
  });
}

export function remove(store: StoreName, key: IDBValidKey): Promise<void> {
  return transact<void>(store, 'readwrite', (t) => { t.objectStore(store).delete(key); });
}

export function count(store: StoreName): Promise<number> {
  return transact<number>(store, 'readonly', (t, set) => {
    t.objectStore(store).count().onsuccess = (e) => set((e.target as IDBRequest).result);
  });
}

export function countAll(stores: StoreName[]): Promise<Record<string, number>> {
  return transact<Record<string, number>>(stores, 'readonly', (t, set) => {
    const out: Record<string, number> = {};
    for (const s of stores) t.objectStore(s).count().onsuccess = (e) => { out[s] = (e.target as IDBRequest).result; };
    set(out);
  });
}
