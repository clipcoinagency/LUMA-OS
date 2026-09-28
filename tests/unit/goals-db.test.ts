import { beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { boot } from '../../src/lib/db/defaults';
import { closeDB, getAll, getByIndex, put } from '../../src/lib/db/idb';
import { deleteGoal, setGoalStatus, toggleMilestone } from '../../src/lib/domain/goals';
import type { Goal } from '../../src/lib/db/schema';

const at = '2026-09-01T10:00:00.000Z';
const goal = (patch: Partial<Goal> = {}): Goal => ({
  id: 'g1', title: 'Read 10 books', description: '', target: 10, unit: 'books', current: 4, deadline: '2026-12-31',
  status: 'active', milestones: [], createdOn: '2026-09-01', completedOn: null, createdAt: at, updatedAt: at, ...patch,
});

beforeEach(async () => {
  await closeDB();
  globalThis.indexedDB = new IDBFactory();
  await boot();
});

describe('goal status transitions (against a live database)', () => {
  it('completing stamps a date; archiving/pausing never erases it', async () => {
    await put('goals', goal());
    await setGoalStatus('g1', 'completed', '2026-09-15');
    let g = (await getAll('goals')).find((x) => x.id === 'g1')!;
    expect(g.status).toBe('completed');
    expect(g.completedOn).toBe('2026-09-15');

    await setGoalStatus('g1', 'archived', '2026-09-20');
    g = (await getAll('goals')).find((x) => x.id === 'g1')!;
    expect(g.status).toBe('archived');
    expect(g.completedOn).toBe('2026-09-15'); // NOT erased by archiving

    await setGoalStatus('g1', 'paused', '2026-09-21');
    g = (await getAll('goals')).find((x) => x.id === 'g1')!;
    expect(g.completedOn).toBe('2026-09-15'); // NOT erased by pausing either
  });

  it('reactivating a completed goal reopens it (clears the completion date)', async () => {
    await put('goals', goal({ status: 'completed', completedOn: '2026-09-15' }));
    await setGoalStatus('g1', 'active');
    const g = (await getAll('goals')).find((x) => x.id === 'g1')!;
    expect(g.status).toBe('active');
    expect(g.completedOn).toBeNull();
  });

  it('a goal that was never completed stays completedOn: null through archive/pause', async () => {
    await put('goals', goal({ completedOn: null }));
    await setGoalStatus('g1', 'archived');
    const g = (await getAll('goals')).find((x) => x.id === 'g1')!;
    expect(g.completedOn).toBeNull();
  });
});

describe('milestone toggling', () => {
  it('records a dated progress check-in and completes the goal once every milestone is done', async () => {
    await put('goals', goal({ target: null, current: 0, milestones: [{ id: 'm1', title: 'Design', done: false, doneOn: null }, { id: 'm2', title: 'Publish', done: false, doneOn: null }] }));
    await toggleMilestone('g1', 'm1', true, '2026-09-10');
    let g = (await getAll('goals')).find((x) => x.id === 'g1')!;
    expect(g.status).toBe('active');
    let hist = await getByIndex('goal_progress', 'by_goal', 'g1');
    expect(hist.map((h) => h.value)).toEqual([1]);

    await toggleMilestone('g1', 'm2', true, '2026-09-12');
    g = (await getAll('goals')).find((x) => x.id === 'g1')!;
    expect(g.status).toBe('completed');
    expect(g.completedOn).toBe('2026-09-12');
    hist = await getByIndex('goal_progress', 'by_goal', 'g1');
    expect(hist).toHaveLength(2);
  });
});

describe('deleteGoal', () => {
  it('removes the goal and every one of its progress rows, leaving other goals untouched', async () => {
    await put('goals', goal({ id: 'g1' }));
    await put('goals', goal({ id: 'g2', title: 'Other goal' }));
    await put('goal_progress', { id: 'p1', goalId: 'g1', date: '2026-09-05', value: 2, note: '', createdAt: at, updatedAt: at });
    await put('goal_progress', { id: 'p2', goalId: 'g1', date: '2026-09-06', value: 3, note: '', createdAt: at, updatedAt: at });
    await put('goal_progress', { id: 'p3', goalId: 'g2', date: '2026-09-06', value: 1, note: '', createdAt: at, updatedAt: at });

    await deleteGoal('g1');

    const goals = await getAll('goals');
    expect(goals.map((g) => g.id)).toEqual(['g2']);
    const progress = await getAll('goal_progress');
    expect(progress.map((p) => p.id)).toEqual(['p3']);
  });
});
