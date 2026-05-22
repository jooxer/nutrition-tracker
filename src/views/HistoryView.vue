<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref } from 'vue';
import { listLogsBetween } from '@/db/logs';
import { kcalOf, sumTotals, entryTotals } from '@/lib/calc';
import { targetsFor } from '@/constants/goals';
import { monthRange } from '@/lib/date';
import { useFoodStore } from '@/stores/foodStore';
import CalendarHeatmap from '@/components/CalendarHeatmap.vue';
const TrendChart = defineAsyncComponent(() => import('@/components/TrendChart.vue'));
import { useRouter } from 'vue-router';
import type { DailyLogRow, Entry } from '@/db/db';

const router = useRouter();
const foods = useFoodStore();
const tab = ref<'calendar' | 'trend'>('calendar');
const month = ref((() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; })());
const logs = ref<DailyLogRow[]>([]);

onMounted(async () => { await foods.load(); await reload(); });
async function reload() {
  const days = monthRange(month.value);
  logs.value = await listLogsBetween(days[0], days[days.length - 1]);
}

function nutrientsFor(e: Entry) {
  if (e.kind === 'adhoc') return entryTotals({ carb: e.carb, protein: e.protein, fat: e.fat }, e.amount);
  const f = foods.byId(e.foodId);
  if (!f || f.deleted) return { carb: 0, protein: 0, fat: 0 };
  return entryTotals({ carb: f.carb, protein: f.protein, fat: f.fat }, e.amount);
}

const statusByDate = computed<Record<string, 'green' | 'red' | 'gray' | 'none'>>(() => {
  const out: Record<string, 'green' | 'red' | 'gray' | 'none'> = {};
  for (const log of logs.value) {
    const totals = sumTotals(log.entries.map(nutrientsFor));
    const kc = kcalOf(totals);
    const target = targetsFor(log.dayType).kcal;
    const ratio = kc / target;
    out[log.date] = ratio < 0.9 ? 'gray' : ratio > 1.1 ? 'red' : 'green';
  }
  return out;
});

function shiftMonth(delta: number) {
  const [y, m] = month.value.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  month.value = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  reload();
}
function go(date: string) { router.push(`/history/${date}`); }
</script>

<template>
  <div class="p-4 space-y-3">
    <div class="flex justify-between items-center">
      <button class="px-3 py-1 text-sm" @click="shiftMonth(-1)">&#8249;</button>
      <div class="font-semibold">{{ month }}</div>
      <button class="px-3 py-1 text-sm" @click="shiftMonth(1)">&#8250;</button>
    </div>
    <div class="flex gap-2">
      <button @click="tab = 'calendar'" :class="['px-3 py-1 rounded-full text-sm', tab === 'calendar' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500']">日历</button>
      <button @click="tab = 'trend'" :class="['px-3 py-1 rounded-full text-sm', tab === 'trend' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500']">趋势</button>
    </div>
    <div v-if="tab === 'calendar'" class="rounded-2xl bg-white shadow-sm p-3">
      <CalendarHeatmap :year-month="month" :status-by-date="statusByDate" @select="go" />
      <div class="mt-3 text-xs text-slate-500 flex gap-4 justify-center">
        <span><span class="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1" />达标</span>
        <span><span class="inline-block w-2 h-2 rounded-full bg-slate-300 mr-1" />不足</span>
        <span><span class="inline-block w-2 h-2 rounded-full bg-red-400 mr-1" />超标</span>
      </div>
    </div>
    <div v-else>
      <TrendChart :logs="logs" :foods="foods.foods" />
    </div>
  </div>
</template>
