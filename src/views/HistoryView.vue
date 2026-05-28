<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref, watch } from 'vue';
import { listLogsBetween } from '@/db/logs';
import { kcalOf, sumTotals, entryTotals } from '@/lib/calc';
import { targetsFor } from '@/constants/goals';
import { monthRange, todayKey, addDays } from '@/lib/date';
import { useFoodStore } from '@/stores/foodStore';
import CalendarHeatmap from '@/components/CalendarHeatmap.vue';
const StatsChart = defineAsyncComponent(() => import('@/components/StatsChart.vue'));
import { useRouter } from 'vue-router';
import type { DailyLogRow, Entry } from '@/db/db';

const router = useRouter();
const foods = useFoodStore();
const tab = ref<'calendar' | 'stats'>('calendar');
const month = ref((() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; })());
const calendarLogs = ref<DailyLogRow[]>([]);
const statsLogs = ref<DailyLogRow[]>([]);

type RangeKey = 'week' | 'month' | 'half' | 'year' | 'custom';
const rangeKey = ref<RangeKey>('week');
const rangePickerOpen = ref(false);
const customFrom = ref(addDays(todayKey(), -6));
const customTo = ref(todayKey());

const RANGE_LABEL: Record<RangeKey, string> = {
  week: '近一周', month: '近一个月', half: '近半年', year: '近一年', custom: '自定义'
};

const rangeDates = computed<{ from: string; to: string }>(() => {
  const today = todayKey();
  if (rangeKey.value === 'week')   return { from: addDays(today, -6), to: today };
  if (rangeKey.value === 'month')  return { from: addDays(today, -29), to: today };
  if (rangeKey.value === 'half')   return { from: addDays(today, -179), to: today };
  if (rangeKey.value === 'year')   return { from: addDays(today, -364), to: today };
  return { from: customFrom.value, to: customTo.value };
});

onMounted(async () => {
  await foods.load();
  await Promise.all([reloadCalendar(), reloadStats()]);
});

async function reloadCalendar() {
  const days = monthRange(month.value);
  calendarLogs.value = await listLogsBetween(days[0], days[days.length - 1]);
}
async function reloadStats() {
  const r = rangeDates.value;
  if (!r.from || !r.to || r.from > r.to) { statsLogs.value = []; return; }
  statsLogs.value = await fillRange(r.from, r.to);
}

async function fillRange(from: string, to: string): Promise<DailyLogRow[]> {
  const real = await listLogsBetween(from, to);
  const map = new Map(real.map(l => [l.date, l]));
  const out: DailyLogRow[] = [];
  let cursor = from;
  let safety = 0;
  while (cursor <= to && safety < 800) {
    out.push(map.get(cursor) ?? { date: cursor, dayType: 'rest', entries: [] });
    cursor = addDays(cursor, 1);
    safety++;
  }
  return out;
}

watch([rangeKey, customFrom, customTo], () => { reloadStats(); });

function nutrientsFor(e: Entry) {
  if (e.kind === 'adhoc') return entryTotals({ carb: e.carb, protein: e.protein, fat: e.fat }, e.amount);
  const f = foods.byId(e.foodId);
  if (!f || f.deleted) return { carb: 0, protein: 0, fat: 0 };
  return entryTotals({ carb: f.carb, protein: f.protein, fat: f.fat }, e.amount);
}

const statusByDate = computed<Record<string, 'green' | 'red' | 'gray' | 'none'>>(() => {
  const out: Record<string, 'green' | 'red' | 'gray' | 'none'> = {};
  for (const log of calendarLogs.value) {
    if (!log.entries.length) continue;
    const totals = sumTotals(log.entries.map(nutrientsFor));
    const kc = kcalOf(totals);
    const target = targetsFor(log.dayType).kcal;
    if (kc > target) out[log.date] = 'red';
    else if (kc < target * 0.95) out[log.date] = 'gray';
    else out[log.date] = 'green';
  }
  return out;
});

function shiftMonth(delta: number) {
  const [y, m] = month.value.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  month.value = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  reloadCalendar();
}
function go(date: string) { router.push(`/history/${date}`); }

function chooseRange(k: RangeKey) {
  rangeKey.value = k;
  if (k !== 'custom') rangePickerOpen.value = false;
}
</script>

<template>
  <div class="p-4 space-y-3">
    <div class="flex items-center gap-2">
      <div class="flex gap-2 flex-1">
        <button @click="tab = 'calendar'" :class="['px-3 py-1 rounded-full text-sm', tab === 'calendar' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500']">日历</button>
        <button @click="tab = 'stats'" :class="['px-3 py-1 rounded-full text-sm', tab === 'stats' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500']">统计</button>
      </div>
      <div v-if="tab === 'calendar'" class="flex items-center gap-1">
        <button class="px-2 py-1 text-sm text-slate-500" @click="shiftMonth(-1)">&#8249;</button>
        <div class="text-sm font-semibold tabular-nums">{{ month }}</div>
        <button class="px-2 py-1 text-sm text-slate-500" @click="shiftMonth(1)">&#8250;</button>
      </div>
      <div v-else class="relative">
        <button class="px-3 py-1 rounded-full bg-slate-100 text-sm text-slate-600 flex items-center gap-1"
                @click="rangePickerOpen = !rangePickerOpen">
          {{ RANGE_LABEL[rangeKey] }}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <div v-if="rangePickerOpen"
             class="absolute right-0 top-full mt-2 w-32 rounded-xl bg-white shadow-lg border border-slate-100 z-30 overflow-hidden">
          <button v-for="k in (['week','month','half','year','custom'] as const)" :key="k"
                  class="w-full text-left px-3 py-2 text-sm flex items-center justify-between active:bg-slate-50"
                  :class="rangeKey === k ? 'text-emerald-600 font-medium' : 'text-slate-600'"
                  @click="chooseRange(k)">
            <span>{{ RANGE_LABEL[k] }}</span>
            <svg v-if="rangeKey === k" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </button>
        </div>
      </div>
    </div>

    <div v-if="rangePickerOpen" class="fixed inset-0 z-20" @click="rangePickerOpen = false"></div>

    <div v-if="tab === 'calendar'" class="rounded-2xl bg-white shadow-sm p-3">
      <CalendarHeatmap :year-month="month" :status-by-date="statusByDate" @select="go" />
      <div class="mt-3 text-xs text-slate-500 flex gap-4 justify-center">
        <span><span class="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1" />达标</span>
        <span><span class="inline-block w-2 h-2 rounded-full bg-slate-300 mr-1" />不足</span>
        <span><span class="inline-block w-2 h-2 rounded-full bg-red-400 mr-1" />超标</span>
      </div>
    </div>
    <div v-else>
      <div v-if="rangeKey === 'custom'" class="rounded-2xl bg-white shadow-sm p-3 flex items-center gap-2 text-sm">
        <span class="text-slate-500 text-xs">从</span>
        <input v-model="customFrom" type="date" class="flex-1 min-w-0 px-2 py-1.5 rounded-lg bg-slate-100 text-sm" />
        <span class="text-slate-500 text-xs">到</span>
        <input v-model="customTo" type="date" class="flex-1 min-w-0 px-2 py-1.5 rounded-lg bg-slate-100 text-sm" />
      </div>
      <StatsChart :logs="statsLogs" :foods="foods.foods" />
    </div>
  </div>
</template>
