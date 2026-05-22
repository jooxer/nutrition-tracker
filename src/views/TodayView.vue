<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useDailyStore } from '@/stores/dailyStore';
import { useFoodStore } from '@/stores/foodStore';
import { useRecipeStore } from '@/stores/recipeStore';
import { useToast } from '@/stores/toastStore';
import { todayKey } from '@/lib/date';
import { targetsFor } from '@/constants/goals';
import type { RecipeRow } from '@/db/db';
import MetabolicDial from '@/components/MetabolicDial.vue';
import EntryRow from '@/components/EntryRow.vue';
import SegmentedControl from '@/components/SegmentedControl.vue';
import FoodPicker from '@/components/FoodPicker.vue';

const daily = useDailyStore();
const foods = useFoodStore();
const recipeStore = useRecipeStore();
const toast = useToast();
const showPicker = ref(false);

onMounted(async () => {
  await foods.load();
  await recipeStore.load();
  await daily.loadDay(todayKey());
});

const targets = computed(() => targetsFor(daily.log?.dayType ?? 'rest'));
const dayType = computed({
  get: () => daily.log?.dayType ?? 'rest',
  set: async (v) => { await daily.changeDayType(v); }
});

async function onPickFood(foodId: string, amount: number) {
  await daily.addFoodEntry(foodId, amount);
}
async function onRemove(id: string) { await daily.removeEntry(id); }

async function onPickRecipe(r: RecipeRow) {
  let skipped = 0;
  for (const item of r.items) {
    const f = foods.byId(item.foodId);
    if (!f || f.deleted) { skipped++; continue; }
    await daily.addFoodEntry(item.foodId, item.amount);
  }
  if (skipped > 0) toast.show(`跳过 ${skipped} 项已删除食物`, 'error');
}
async function onPickAdhoc(d: { name: string; spec: string; carb: number; protein: number; fat: number; amount: number }) {
  await daily.addAdhocEntry(d);
}
</script>

<template>
  <div class="p-4 space-y-3">
    <div class="flex items-center justify-between">
      <div class="text-sm text-slate-500">{{ daily.log?.date }}</div>
      <SegmentedControl v-model="dayType" :options="[
        { value: 'training', label: '力训日' },
        { value: 'rest',     label: '休息日' }
      ]" />
    </div>

    <MetabolicDial :totals="daily.totals" :targets="targets" :kcal="daily.kcal" :muls="daily.muls" />

    <div class="rounded-2xl bg-white shadow-sm overflow-hidden">
      <div class="px-4 py-2 text-xs text-slate-500 border-b border-slate-100">今日明细</div>
      <div v-if="!daily.log?.entries.length" class="px-4 py-8 text-center text-sm text-slate-400">暂无记录，点右下 + 添加</div>
      <EntryRow v-for="e in daily.log?.entries ?? []" :key="e.id"
        :entry="e" :food="e.kind === 'food' ? foods.byId(e.foodId) : undefined"
        @remove="onRemove" />
    </div>

    <button class="fixed bottom-20 right-5 w-14 h-14 rounded-full bg-emerald-500 text-white text-3xl shadow-lg"
      @click="showPicker = true">+</button>

    <FoodPicker :open="showPicker" @close="showPicker = false"
      @pick-food="onPickFood" @pick-recipe="onPickRecipe" @pick-adhoc="onPickAdhoc" />
  </div>
</template>
