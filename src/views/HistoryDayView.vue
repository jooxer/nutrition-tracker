<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { getLog } from '@/db/logs';
import { useFoodStore } from '@/stores/foodStore';
import { entryTotals, kcalOf, multipliers, sumTotals } from '@/lib/calc';
import { WEIGHT_KG, MEALS, mealTargetsFor } from '@/constants/goals';
import { groupByMeal } from '@/lib/meals';
import { friendlyDate } from '@/lib/date';
import { useSettingsStore } from '@/stores/settingsStore';
import type { DailyLogRow, Entry } from '@/db/db';
import MetabolicDial from '@/components/MetabolicDial.vue';
import MealGroup from '@/components/MealGroup.vue';
import EntryRow from '@/components/EntryRow.vue';

const route = useRoute();
const date = computed(() => String(route.params.date));
const log = ref<DailyLogRow | null>(null);
const foods = useFoodStore();
const settings = useSettingsStore();

onMounted(async () => {
  await Promise.all([foods.load(), settings.load()]);
  log.value = (await getLog(date.value)) ?? null;
});

function nutrientsFor(e: Entry) {
  if (e.kind === 'adhoc') return entryTotals({ carb: e.carb, protein: e.protein, fat: e.fat }, e.amount);
  const f = foods.byId(e.foodId);
  if (!f || f.deleted) return { carb: 0, protein: 0, fat: 0 };
  return entryTotals({ carb: f.carb, protein: f.protein, fat: f.fat }, e.amount);
}
const totals = computed(() => log.value ? sumTotals(log.value.entries.map(nutrientsFor)) : { carb: 0, protein: 0, fat: 0 });
const kcal = computed(() => kcalOf(totals.value));
const muls = computed(() => multipliers(totals.value, WEIGHT_KG));
const dayType = computed(() => log.value?.dayType ?? 'rest');
const targets = computed(() => settings.targetsFor(dayType.value));
const targetMuls = computed(() => ({
  carb: targets.value.carb / WEIGHT_KG,
  protein: targets.value.protein / WEIGHT_KG,
  fat: targets.value.fat / WEIGHT_KG
}));
const byMeal = computed(() => groupByMeal(log.value?.entries ?? [], nutrientsFor));
function targetOf(meal: typeof MEALS[number]['value']) {
  return mealTargetsFor(dayType.value, meal, settings.ratios);
}
</script>

<template>
  <div class="p-4 space-y-3">
    <div class="text-sm text-slate-500">
      <span class="text-slate-700 font-medium">{{ friendlyDate(date) }}</span>
      <span class="ml-2">{{ log?.dayType === 'training' ? '力训日' : '休息日' }}</span>
    </div>
    <div v-if="!log" class="text-center text-slate-400 py-8">无记录</div>
    <template v-else>
      <MetabolicDial :totals="totals" :targets="targets" :kcal="kcal" :muls="muls" :target-muls="targetMuls" />

      <MealGroup v-for="m in MEALS" :key="m.value"
        readonly
        :label="m.label"
        :entries="byMeal[m.value].entries"
        :totals="byMeal[m.value].totals"
        :target="targetOf(m.value)"
        :food-by-id="foods.byId" />

      <div v-if="byMeal.unset.entries.length" class="rounded-2xl bg-white shadow-sm overflow-hidden">
        <div class="px-4 py-2 border-b border-slate-100 text-xs text-slate-500">未分类</div>
        <EntryRow v-for="e in byMeal.unset.entries" :key="e.id"
          readonly
          :entry="e" :food="e.kind === 'food' ? foods.byId(e.foodId) : undefined" />
      </div>
    </template>
  </div>
</template>
