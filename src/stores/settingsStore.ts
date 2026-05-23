import { defineStore } from 'pinia';
import { ref } from 'vue';
import { getSetting, setSetting } from '@/db/settings';
import {
  DEFAULT_MEAL_RATIOS, targetsFor as defaultTargetsFor,
  type DayType, type MealRatios
} from '@/constants/goals';

const KEY_RATIOS = 'mealRatios';

function clone(r: MealRatios): MealRatios {
  return JSON.parse(JSON.stringify(r));
}

export const useSettingsStore = defineStore('settings', () => {
  const ratios = ref<MealRatios>(clone(DEFAULT_MEAL_RATIOS));
  const loaded = ref(false);

  async function load() {
    if (loaded.value) return;
    const saved = await getSetting<MealRatios>(KEY_RATIOS);
    if (saved) ratios.value = saved;
    loaded.value = true;
  }

  async function reload() {
    loaded.value = false;
    await load();
  }

  async function saveRatios(next: MealRatios) {
    ratios.value = clone(next);
    await setSetting(KEY_RATIOS, ratios.value);
  }

  async function resetRatios() {
    ratios.value = clone(DEFAULT_MEAL_RATIOS);
    await setSetting(KEY_RATIOS, ratios.value);
  }

  function targetsFor(dt: DayType) { return defaultTargetsFor(dt); }

  return { ratios, loaded, load, reload, saveRatios, resetRatios, targetsFor };
});
