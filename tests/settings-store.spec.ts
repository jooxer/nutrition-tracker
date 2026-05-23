import { setActivePinia, createPinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { useSettingsStore } from '@/stores/settingsStore';
import { DEFAULT_MEAL_RATIOS } from '@/constants/goals';

beforeEach(() => {
  localStorage.clear();
  setActivePinia(createPinia());
});

describe('settingsStore', () => {
  it('load returns defaults when nothing saved', () => {
    const s = useSettingsStore();
    s.load();
    expect(s.ratios).toEqual(DEFAULT_MEAL_RATIOS);
  });

  it('saveRatios persists and survives reload', () => {
    const s = useSettingsStore();
    s.load();
    const next = JSON.parse(JSON.stringify(DEFAULT_MEAL_RATIOS));
    next.training.carb.breakfast = 25;
    next.training.carb.lunch = 35;
    s.saveRatios(next);

    s.reload();
    expect(s.ratios.training.carb.breakfast).toBe(25);
    expect(s.ratios.training.carb.lunch).toBe(35);
  });

  it('resetRatios clears back to defaults', () => {
    const s = useSettingsStore();
    s.load();
    const modified = JSON.parse(JSON.stringify(DEFAULT_MEAL_RATIOS));
    modified.rest.protein.snack = 99;
    s.saveRatios(modified);

    s.resetRatios();
    expect(s.ratios).toEqual(DEFAULT_MEAL_RATIOS);
  });
});
