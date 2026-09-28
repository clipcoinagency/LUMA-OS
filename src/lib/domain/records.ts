// Generic save/delete with change notification and Undo support for simple record stores.
import { nowIso } from '../util/dates';
import { get, put, remove } from '../db/idb';
import { bump } from '../db/changes.svelte';
import type { StoreName, StoreRecordMap } from '../db/schema';

type Editable = 'events' | 'notes' | 'workouts' | 'transactions' | 'finance_categories' | 'tasks' | 'goals' | 'habits';

export async function saveRecord<S extends Editable>(store: S, row: StoreRecordMap[S]): Promise<StoreRecordMap[S]> {
  const next = { ...row, updatedAt: nowIso() } as StoreRecordMap[S];
  await put(store, next);
  bump();
  return next;
}

/** Deletes and returns the old row so the UI can offer Undo. */
export async function deleteRecord<S extends Editable>(store: S, id: string): Promise<StoreRecordMap[S] | undefined> {
  const old = await get(store, id);
  await remove(store as StoreName, id);
  bump();
  return old;
}

export async function restoreRecord<S extends Editable>(store: S, row: StoreRecordMap[S]): Promise<void> {
  await put(store, row);
  bump();
}
