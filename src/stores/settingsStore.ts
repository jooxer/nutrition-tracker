import { defineStore } from 'pinia';
import { ref } from 'vue';
import { getMealRatios, setMealRatios } from '@/db/settings';
import {
  DEFAULT_MEAL_RATIOS, targetsFor as defaultTargetsFor,
  type DayType, type MealRatios
} from '@/constants/goals';

function clone(r: MealRatios): MealRatios {
  return JSON.parse(JSON.stringify(r));
}

export const useSettingsStore = defineStore('settings', () => {
  const ratios = ref<MealRatios>(clone(DEFAULT_MEAL_RATIOS));
  const loaded = ref(false);

  function load() {
    if (loaded.value) return;
    ratios.value = getMealRatios();
    loaded.value = true;
  }

  function reload() {
    loaded.value = false;
    load();
  }

  function saveRatios(next: MealRatios) {
    ratios.value = clone(next);
    setMealRatios(ratios.value);
  }

  function resetRatios() {
    ratios.value = clone(DEFAULT_MEAL_RATIOS);
    setMealRatios(ratios.value);
  }

  function targetsFor(dt: DayType) { return defaultTargetsFor(dt); }

  return { ratios, loaded, load, reload, saveRatios, resetRatios, targetsFor };
});
