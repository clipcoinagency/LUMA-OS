import { beforeEach, describe, expect, it } from 'vitest';
import { closeDB } from '../../src/lib/db/idb';
import { getWellness, updateWellness } from '../../src/lib/domain/daily';

const DAY = '2026-10-03' as never;

describe('wellness updates', () => {
  beforeEach(async () => { await closeDB(); indexedDB.deleteDatabase('lifeos'); });

  it('keeps every field when several updates are fired at once (no lost writes)', async () => {
    // exactly what the Wellness page does in quick succession: two water taps, a sleep edit, a mood pick, steps
    await Promise.all([
      updateWellness(DAY, { water: 1 }),
      updateWellness(DAY, { water: 2 }),
      updateWellness(DAY, { sleepHours: 7.5 }),
      updateWellness(DAY, { mood: 4 }),
      updateWellness(DAY, { steps: 8400 }),
    ]);
    expect(await getWellness(DAY)).toMatchObject({ water: 2, sleepHours: 7.5, mood: 4, steps: 8400 });
  });

  it('a failing update does not block the ones queued behind it', async () => {
    const bad = updateWellness(DAY, { water: 1, ...({ id: undefined } as object) } as never);
    const good = updateWellness(DAY, { mood: 5 });
    await Promise.allSettled([bad, good]);
    expect((await getWellness(DAY)).mood).toBe(5);
  });
});
