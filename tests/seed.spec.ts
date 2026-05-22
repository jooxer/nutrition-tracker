import { beforeEach, describe, expect, it } from 'vitest';
import { resetDBForTests } from '@/db/db';
import { listFoods } from '@/db/foods';
import { runSeedIfEmpty } from '@/lib/seed';

beforeEach(async () => { await resetDBForTests(); });

describe('seed', () => {
  it('seeds 96 foods on first run', async () => {
    await runSeedIfEmpty();
    const foods = await listFoods({ includeDeleted: true });
    expect(foods.length).toBe(96);
    expect(foods.every(f => f.builtin)).toBe(true);
  });

  it('is idempotent: second call does not duplicate', async () => {
    await runSeedIfEmpty();
    await runSeedIfEmpty();
    const foods = await listFoods({ includeDeleted: true });
    expect(foods.length).toBe(96);
  });

  it('preserves user data: when foods exist, skip seed', async () => {
    await runSeedIfEmpty();
    const beforeIds = (await listFoods({ includeDeleted: true })).map(f => f.id).sort();
    await runSeedIfEmpty();
    const afterIds = (await listFoods({ includeDeleted: true })).map(f => f.id).sort();
    expect(afterIds).toEqual(beforeIds);
  });
});
