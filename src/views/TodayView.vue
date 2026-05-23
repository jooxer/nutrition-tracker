<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useDailyStore } from '@/stores/dailyStore';
import { useFoodStore } from '@/stores/foodStore';
import { useRecipeStore } from '@/stores/recipeStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useToast } from '@/stores/toastStore';
import { todayKey, friendlyDate } from '@/lib/date';
import { WEIGHT_KG, targetsFor, mealTargetsFor, MEALS, type MealType } from '@/constants/goals';
import type { RecipeRow, Entry } from '@/db/db';
import MetabolicDial from '@/components/MetabolicDial.vue';
import MealGroup from '@/components/MealGroup.vue';
import EntryRow from '@/components/EntryRow.vue';
import EntryEditor from '@/components/EntryEditor.vue';
import SegmentedControl from '@/components/SegmentedControl.vue';
import FoodPicker from '@/components/FoodPicker.vue';

const daily = useDailyStore();
const foods = useFoodStore();
const recipeStore = useRecipeStore();
const settings = useSettingsStore();
const toast = useToast();
const showPicker = ref(false);
const pickerMeal = ref<MealType>('breakfast');
const editing = ref<Entry | null>(null);

onMounted(async () => {
  await foods.load();
  await recipeStore.load();
  await settings.load();
  await daily.loadDay(todayKey());
});

const targets = computed(() => targetsFor(daily.log?.dayType ?? 'rest'));
const targetMuls = computed(() => ({
  carb: targets.value.carb / WEIGHT_KG,
  protein: targets.value.protein / WEIGHT_KG,
  fat: targets.value.fat / WEIGHT_KG
}));
const dayType = computed({
  get: () => daily.log?.dayType ?? 'rest',
  set: async (v) => { await daily.changeDayType(v); }
});

function targetOf(meal: MealType) {
  return mealTargetsFor(daily.log?.dayType ?? 'rest', meal, settings.ratios);
}

function openPicker(meal: MealType) {
  pickerMeal.value = meal;
  showPicker.value = true;
}

async function onPickFood(foodId: string, amount: number, meal: MealType) {
  await daily.addFoodEntry(foodId, amount, meal);
}
async function onPickFoods(items: { foodId: string; amount: number }[], meal: MealType) {
  for (const it of items) {
    if (it.amount <= 0) continue;
    await daily.addFoodEntry(it.foodId, it.amount, meal);
  }
}
function onEdit(e: Entry) { editing.value = e; }
async function onSaveEdit(id: string, patch: { amount: number; mealType: MealType }) {
  await daily.updateEntry(id, patch);
  editing.value = null;
}
async function onRemoveEdit(id: string) {
  await daily.removeEntry(id);
  editing.value = null;
}

async function onPickRecipe(r: RecipeRow, meal: MealType) {
  let skipped = 0;
  for (const item of r.items) {
    const f = foods.byId(item.foodId);
    if (!f || f.deleted) { skipped++; continue; }
    await daily.addFoodEntry(item.foodId, item.amount, meal);
  }
  if (skipped > 0) toast.show(`跳过 ${skipped} 项已删除食物`, 'error');
}
async function onPickAdhoc(d: { name: string; spec: string; carb: number; protein: number; fat: number; amount: number; mealType: MealType }) {
  await daily.addAdhocEntry(d);
}

const editingFood = computed(() => {
  const e = editing.value;
  if (!e || e.kind !== 'food') return undefined;
  return foods.byId(e.foodId);
});
</script>

<template>
  <div class="p-4 space-y-3 pb-24">
    <div class="flex items-center justify-between">
      <div class="text-sm">
        <span class="text-slate-700 font-medium">{{ daily.log ? friendlyDate(daily.log.date) : '' }}</span>
      </div>
      <SegmentedControl v-model="dayType" :options="[
        { value: 'training', label: '力训日' },
        { value: 'rest',     label: '休息日' }
      ]" />
    </div>

    <MetabolicDial :totals="daily.totals" :targets="targets" :kcal="daily.kcal" :muls="daily.muls" :target-muls="targetMuls" />

    <MealGroup v-for="m in MEALS" :key="m.value"
      :label="m.label"
      :entries="daily.byMeal[m.value].entries"
      :totals="daily.byMeal[m.value].totals"
      :target="targetOf(m.value)"
      :food-by-id="foods.byId"
      @edit="onEdit"
      @add="openPicker(m.value)" />

    <div v-if="daily.byMeal.unset.entries.length" class="rounded-2xl bg-white shadow-sm overflow-hidden">
      <div class="px-4 py-2 border-b border-slate-100 text-xs text-slate-500">未分类</div>
      <EntryRow v-for="e in daily.byMeal.unset.entries" :key="e.id"
        :entry="e" :food="e.kind === 'food' ? foods.byId(e.foodId) : undefined"
        @edit="onEdit" />
    </div>

    <button class="fixed bottom-20 right-5 w-14 h-14 rounded-full bg-emerald-500 text-white text-3xl shadow-lg active:scale-95 transition"
      @click="openPicker('breakfast')">+</button>

    <FoodPicker :open="showPicker" :default-meal="pickerMeal" @close="showPicker = false"
      @pick-food="onPickFood" @pick-foods="onPickFoods" @pick-recipe="onPickRecipe" @pick-adhoc="onPickAdhoc" />

    <EntryEditor :entry="editing" :food="editingFood"
      @close="editing = null" @save="onSaveEdit" @remove="onRemoveEdit" />
  </div>
</template>
