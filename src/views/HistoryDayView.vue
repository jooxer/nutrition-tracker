<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { getLog } from '@/db/logs';
import { useFoodStore } from '@/stores/foodStore';
import { entryTotals, kcalOf, multipliers, sumTotals } from '@/lib/calc';
import { WEIGHT_KG, targetsFor } from '@/constants/goals';
import type { DailyLogRow, Entry } from '@/db/db';
import MetabolicDial from '@/components/MetabolicDial.vue';
import EntryRow from '@/components/EntryRow.vue';

const route = useRoute();
const date = computed(() => String(route.params.date));
const log = ref<DailyLogRow | null>(null);
const foods = useFoodStore();

onMounted(async () => { await foods.load(); log.value = (await getLog(date.value)) ?? null; });

function nutrientsFor(e: Entry) {
  if (e.kind === 'adhoc') return entryTotals({ carb: e.carb, protein: e.protein, fat: e.fat }, e.amount);
  const f = foods.byId(e.foodId);
  if (!f || f.deleted) return { carb: 0, protein: 0, fat: 0 };
  return entryTotals({ carb: f.carb, protein: f.protein, fat: f.fat }, e.amount);
}
const totals = computed(() => log.value ? sumTotals(log.value.entries.map(nutrientsFor)) : { carb: 0, protein: 0, fat: 0 });
const kcal = computed(() => kcalOf(totals.value));
const muls = computed(() => multipliers(totals.value, WEIGHT_KG));
const targets = computed(() => targetsFor(log.value?.dayType ?? 'rest'));
</script>

<template>
  <div class="p-4 space-y-3">
    <div class="text-sm text-slate-500">{{ date }}（{{ log?.dayType === 'training' ? '力训日' : '休息日' }}）</div>
    <div v-if="!log" class="text-center text-slate-400 py-8">无记录</div>
    <template v-else>
      <MetabolicDial :totals="totals" :targets="targets" :kcal="kcal" :muls="muls" />
      <div class="rounded-2xl bg-white shadow-sm overflow-hidden">
        <div class="px-4 py-2 text-xs text-slate-500 border-b border-slate-100">明细</div>
        <EntryRow v-for="e in log.entries" :key="e.id"
          :entry="e" :food="e.kind === 'food' ? foods.byId(e.foodId) : undefined"
          @remove="() => {}" />
      </div>
    </template>
  </div>
</template>
