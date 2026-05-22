import { beforeEach, describe, expect, it } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { resetDBForTests } from '@/db/db';
import { addFood } from '@/db/foods';
import { useDailyStore } from '@/stores/dailyStore';

beforeEach(async () => {
  setActivePinia(createPinia());
  await resetDBForTests();
});

describe('dailyStore', () => {
  it('loadDay creates an empty rest log when none exists', async () => {
    const s = useDailyStore();
    await s.loadDay('2026-05-22');
    expect(s.log?.dayType).toBe('rest');
    expect(s.log?.entries).toEqual([]);
  });

  it('addFoodEntry sums totals against food row', async () => {
    const id = await addFood({ name: 'X', category: '主食', spec: '100g', carb: 10, protein: 2, fat: 1, note: null, builtin: false });
    const s = useDailyStore();
    await s.loadDay('2026-05-22');
    await s.addFoodEntry(id, 2);
    expect(s.totals).toEqual({ carb: 20, protein: 4, fat: 2 });
    expect(s.kcal).toBeCloseTo(20*4.1 + 4*4.1 + 2*9.3, 6);
  });

  it('addAdhocEntry contributes to totals', async () => {
    const s = useDailyStore();
    await s.loadDay('2026-05-22');
    await s.addAdhocEntry({ name: 'Z', spec: '一份', carb: 5, protein: 5, fat: 5, amount: 1 });
    expect(s.totals).toEqual({ carb: 5, protein: 5, fat: 5 });
  });

  it('removeEntry recomputes totals', async () => {
    const s = useDailyStore();
    await s.loadDay('2026-05-22');
    await s.addAdhocEntry({ name: 'A', spec: '一份', carb: 1, protein: 1, fat: 1, amount: 1 });
    const eid = s.log!.entries[0].id;
    await s.removeEntry(eid);
    expect(s.totals).toEqual({ carb: 0, protein: 0, fat: 0 });
  });

  it('changeDayType persists', async () => {
    const s = useDailyStore();
    await s.loadDay('2026-05-22');
    await s.changeDayType('training');
    expect(s.log?.dayType).toBe('training');
  });

  it('totals skip soft-deleted foods', async () => {
    const id = await addFood({ name: 'X', category: '主食', spec: '100g', carb: 10, protein: 2, fat: 1, note: null, builtin: false });
    const s = useDailyStore();
    await s.loadDay('2026-05-22');
    await s.addFoodEntry(id, 1);
    const { softDeleteFood } = await import('@/db/foods');
    await softDeleteFood(id);
    await s.loadDay('2026-05-22');
    expect(s.totals).toEqual({ carb: 0, protein: 0, fat: 0 });
  });
});
