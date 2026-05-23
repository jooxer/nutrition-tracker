import { setActivePinia, createPinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetDBForTests } from '@/db/db';
import { useSettingsStore } from '@/stores/settingsStore';
import { DEFAULT_MEAL_RATIOS } from '@/constants/goals';

beforeEach(async () => {
  await resetDBForTests();
  setActivePinia(createPinia());
});

describe('settingsStore', () => {
  it('load returns defaults when nothing saved', async () => {
    const s = useSettingsStore();
    await s.load();
    expect(s.ratios).toEqual(DEFAULT_MEAL_RATIOS);
  });

  it('saveRatios persists and survives reload', async () => {
    const s = useSettingsStore();
    await s.load();
    const next = JSON.parse(JSON.stringify(DEFAULT_MEAL_RATIOS));
    next.training.carb.breakfast = 25;
    next.training.carb.lunch = 35;
    await s.saveRatios(next);

    await s.reload();
    expect(s.ratios.training.carb.breakfast).toBe(25);
    expect(s.ratios.training.carb.lunch).toBe(35);
  });

  it('resetRatios clears back to defaults', async () => {
    const s = useSettingsStore();
    await s.load();
    const modified = JSON.parse(JSON.stringify(DEFAULT_MEAL_RATIOS));
    modified.rest.protein.snack = 99;
    await s.saveRatios(modified);

    await s.resetRatios();
    expect(s.ratios).toEqual(DEFAULT_MEAL_RATIOS);
  });
});
