import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import * as weighingDb from '@/db/weighing';
import type { WeighingItemRow } from '@/db/db';
import type { MealType } from '@/constants/goals';

export const useWeighingStore = defineStore('weighing', () => {
  const items = ref<WeighingItemRow[]>([]);
  const loaded = ref(false);

  async function load() {
    items.value = await weighingDb.listWeighingItems();
    loaded.value = true;
  }

  async function addItem(input: { foodId: string; mealType: MealType; before: number }) {
    await weighingDb.addWeighingItem(input);
    await load();
  }

  async function updateItem(id: string, patch: { before?: number; after?: number | null; mealType?: MealType }) {
    await weighingDb.updateWeighingItem(id, patch);
    await load();
  }

  async function removeItem(id: string) {
    await weighingDb.deleteWeighingItem(id);
    await load();
  }

  const pendingCount = computed(() => items.value.filter(it => it.after == null).length);
  const readyCount = computed(() => items.value.filter(it => it.after != null && it.after >= 0 && it.before > (it.after ?? 0)).length);

  return { items, loaded, pendingCount, readyCount, load, addItem, updateItem, removeItem };
});
