import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { CATEGORIES } from '@/constants/categories';
import { getSetting, setSetting } from '@/db/settings';

const KEY = 'nutrition-tracker:customCategories';

function loadCustom(): string[] {
  return getSetting<string[]>(KEY) ?? [];
}

export const useCategoriesStore = defineStore('categories', () => {
  const custom = ref<string[]>(loadCustom());

  const all = computed<string[]>(() => {
    const merged: string[] = [...CATEGORIES];
    for (const c of custom.value) {
      if (!merged.includes(c)) merged.push(c);
    }
    return merged;
  });

  function addCustom(name: string): boolean {
    const trimmed = name.trim();
    if (!trimmed) return false;
    if ((CATEGORIES as readonly string[]).includes(trimmed)) return false;
    if (custom.value.includes(trimmed)) return false;
    custom.value = [...custom.value, trimmed];
    setSetting(KEY, custom.value);
    return true;
  }

  function removeCustom(name: string) {
    custom.value = custom.value.filter(c => c !== name);
    setSetting(KEY, custom.value);
  }

  function reload() {
    custom.value = loadCustom();
  }

  return { custom, all, addCustom, removeCustom, reload };
});
