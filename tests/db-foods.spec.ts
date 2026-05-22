import { beforeEach, describe, expect, it } from 'vitest';
import { resetDBForTests } from '@/db/db';
import { addFood, listFoods, updateFood, softDeleteFood, restoreFood, getFood } from '@/db/foods';

beforeEach(async () => { await resetDBForTests(); });

describe('foods CRUD', () => {
  it('addFood + getFood roundtrip', async () => {
    const id = await addFood({ name: '米饭', category: '主食', spec: '100g', carb: 30, protein: 2.8, fat: 0.39, note: null, builtin: false });
    const got = await getFood(id);
    expect(got?.name).toBe('米饭');
    expect(got?.builtin).toBe(false);
    expect(got?.deleted).toBe(false);
  });

  it('listFoods filters deleted by default', async () => {
    const a = await addFood({ name: 'A', category: '主食', spec: '1', carb: 1, protein: 1, fat: 1, note: null, builtin: false });
    const b = await addFood({ name: 'B', category: '主食', spec: '1', carb: 1, protein: 1, fat: 1, note: null, builtin: false });
    await softDeleteFood(b);
    const live = await listFoods();
    expect(live.map(f => f.id)).toEqual([a]);
    const all = await listFoods({ includeDeleted: true });
    expect(all.length).toBe(2);
  });

  it('updateFood patches and bumps updatedAt', async () => {
    const id = await addFood({ name: 'A', category: '主食', spec: '1', carb: 1, protein: 1, fat: 1, note: null, builtin: false });
    const before = (await getFood(id))!.updatedAt;
    await new Promise(r => setTimeout(r, 2));
    await updateFood(id, { name: 'B' });
    const after = await getFood(id);
    expect(after?.name).toBe('B');
    expect(after!.updatedAt).toBeGreaterThan(before);
  });

  it('restoreFood unsets deleted flag', async () => {
    const id = await addFood({ name: 'A', category: '主食', spec: '1', carb: 1, protein: 1, fat: 1, note: null, builtin: false });
    await softDeleteFood(id);
    await restoreFood(id);
    expect((await getFood(id))?.deleted).toBe(false);
  });
});
