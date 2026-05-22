import { defineStore } from 'pinia';
import { ref } from 'vue';
import * as recipesDb from '@/db/recipes';
import type { RecipeRow } from '@/db/db';

export const useRecipeStore = defineStore('recipe', () => {
  const recipes = ref<RecipeRow[]>([]);
  async function load() { recipes.value = await recipesDb.listRecipes(); }
  async function add(input: recipesDb.RecipeInput) { await recipesDb.addRecipe(input); await load(); }
  async function update(id: string, patch: Partial<recipesDb.RecipeInput>) { await recipesDb.updateRecipe(id, patch); await load(); }
  async function remove(id: string) { await recipesDb.deleteRecipe(id); await load(); }
  return { recipes, load, add, update, remove };
});
