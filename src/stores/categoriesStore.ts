import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { CATEGORIES } from '@/constants/categories';
import { getSetting, setSetting } from '@/db/settings';

const KEY_CUSTOM = 'nutrition-tracker:customCategories';
const KEY_ORDER = 'nutrition-tracker:categoryOrder';

function loadCustom(): string[] {
  return getSetting<string[]>(KEY_CUSTOM) ?? [];
}
function loadOrder(): string[] {
  return getSetting<string[]>(KEY_ORDER) ?? [];
}

export const useCategoriesStore = defineStore('categories', () => {
  const custom = ref<string[]>(loadCustom());
  const order = ref<string[]>(loadOrder());

  const all = computed<string[]>(() => {
    const known = new Set<string>([...CATEGORIES, ...custom.value]);
    const result: string[] = [];
    for (const c of order.value) {
      if (known.has(c)) { result.push(c); known.delete(c); }
    }
    for (const c of CATEGORIES) {
      if (known.has(c)) { result.push(c); known.delete(c); }
    }
    for (const c of custom.value) {
      if (known.has(c)) { result.push(c); known.delete(c); }
    }
    return result;
  });

  function persistCustom() { setSetting(KEY_CUSTOM, custom.value); }
  function persistOrder() { setSetting(KEY_ORDER, order.value); }

  function addCustom(name: string): boolean {
    const trimmed = name.trim();
    if (!trimmed) return false;
    if ((CATEGORIES as readonly string[]).includes(trimmed)) return false;
    if (custom.value.includes(trimmed)) return false;
    custom.value = [...custom.value, trimmed];
    persistCustom();
    return true;
  }

  function removeCustom(name: string) {
    custom.value = custom.value.filter(c => c !== name);
    persistCustom();
    if (order.value.includes(name)) {
      order.value = order.value.filter(c => c !== name);
      persistOrder();
    }
  }

  function move(from: number, to: number) {
    const list = [...all.value];
    if (from === to) return;
    if (from < 0 || from >= list.length) return;
    if (to < 0 || to >= list.length) return;
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    order.value = list;
    persistOrder();
  }

  function resetOrder() {
    order.value = [];
    persistOrder();
  }

  function reload() {
    custom.value = loadCustom();
    order.value = loadOrder();
  }

  return { custom, order, all, addCustom, removeCustom, move, resetOrder, reload };
});
