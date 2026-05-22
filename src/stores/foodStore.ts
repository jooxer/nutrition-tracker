import { defineStore } from 'pinia';
import { ref } from 'vue';
import * as foodsDb from '@/db/foods';
import type { FoodRow } from '@/db/db';

export const useFoodStore = defineStore('food', () => {
  const foods = ref<FoodRow[]>([]);
  const loaded = ref(false);

  async function load() {
    foods.value = await foodsDb.listFoods({ includeDeleted: true });
    loaded.value = true;
  }
  async function add(input: foodsDb.FoodInput) {
    await foodsDb.addFood(input); await load();
  }
  async function update(id: string, patch: Partial<foodsDb.FoodInput>) {
    await foodsDb.updateFood(id, patch); await load();
  }
  async function softDelete(id: string) {
    await foodsDb.softDeleteFood(id); await load();
  }
  async function restore(id: string) {
    await foodsDb.restoreFood(id); await load();
  }
  function byId(id: string) { return foods.value.find(f => f.id === id); }

  return { foods, loaded, load, add, update, softDelete, restore, byId };
});
