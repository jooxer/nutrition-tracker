<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch, nextTick } from 'vue';
import * as echarts from 'echarts/core';
import { BarChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { DailyLogRow, Entry, FoodRow } from '@/db/db';
import { entryTotals, kcalOf, sumTotals } from '@/lib/calc';

echarts.use([BarChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

const props = defineProps<{ logs: DailyLogRow[]; foods: FoodRow[] }>();
const kcalEl = ref<HTMLDivElement | null>(null);
const nutEl = ref<HTMLDivElement | null>(null);
let kcalChart: echarts.ECharts | null = null;
let nutChart: echarts.ECharts | null = null;

const foodMap = computed(() => new Map(props.foods.map(f => [f.id, f])));

function nutrientsFor(e: Entry) {
  if (e.kind === 'adhoc') return entryTotals({ carb: e.carb, protein: e.protein, fat: e.fat }, e.amount);
  const f = foodMap.value.get(e.foodId);
  if (!f || f.deleted) return { carb: 0, protein: 0, fat: 0 };
  return entryTotals({ carb: f.carb, protein: f.protein, fat: f.fat }, e.amount);
}

const series = computed(() => {
  const sorted = [...props.logs].sort((a, b) => a.date.localeCompare(b.date));
  const dates = sorted.map(l => l.date);
  const carb: number[] = [], protein: number[] = [], fat: number[] = [], kcal: number[] = [];
  for (const log of sorted) {
    const t = sumTotals(log.entries.map(nutrientsFor));
    carb.push(+t.carb.toFixed(1));
    protein.push(+t.protein.toFixed(1));
    fat.push(+t.fat.toFixed(1));
    kcal.push(Math.round(kcalOf(t)));
  }
  return { dates, carb, protein, fat, kcal };
});

const averages = computed(() => {
  const s = series.value;
  const days = s.dates.filter((_, i) => s.kcal[i] > 0).length || 1;
  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
  return {
    kcal: Math.round(sum(s.kcal) / days),
    carb: Math.round(sum(s.carb) / days),
    protein: Math.round(sum(s.protein) / days),
    fat: Math.round(sum(s.fat) / days)
  };
});

function shortLabel(date: string) {
  const [, , d] = date.split('-');
  return `${Number(d)}日`;
}

const baseAxisStyle = {
  axisLine: { show: false },
  axisTick: { show: false },
  axisLabel: { color: '#94a3b8', fontSize: 11, interval: 'auto' as const }
};

function renderKcal() {
  if (!kcalChart) return;
  const s = series.value;
  kcalChart.setOption({
    tooltip: {
      trigger: 'item',
      backgroundColor: '#fff',
      borderColor: '#e2e8f0',
      textStyle: { color: '#334155', fontSize: 12 },
      formatter: (p: any) => `<b>${p.value}千卡</b><br/>${s.dates[p.dataIndex]}`
    },
    grid: { top: 20, left: 40, right: 16, bottom: 28 },
    xAxis: { type: 'category', data: s.dates.map(shortLabel), ...baseAxisStyle },
    yAxis: {
      type: 'value',
      ...baseAxisStyle,
      splitLine: { lineStyle: { color: '#f1f5f9' } }
    },
    series: [{
      type: 'bar',
      data: s.kcal,
      color: '#3b82f6',
      barWidth: '50%',
      itemStyle: { borderRadius: [4, 4, 0, 0] },
      emphasis: { itemStyle: { color: '#2563eb' } }
    }]
  }, true);
}

function renderNut() {
  if (!nutChart) return;
  const s = series.value;
  nutChart.setOption({
    tooltip: {
      trigger: 'item',
      backgroundColor: '#fff',
      borderColor: '#e2e8f0',
      textStyle: { color: '#334155', fontSize: 12 },
      formatter: (p: any) => `<b>${p.seriesName}: ${p.value}g</b><br/>${s.dates[p.dataIndex]}`
    },
    legend: {
      data: ['碳水', '蛋白质', '脂肪'],
      top: 0,
      itemGap: 14,
      itemWidth: 10,
      itemHeight: 10,
      textStyle: { fontSize: 11, color: '#64748b' }
    },
    grid: { top: 36, left: 40, right: 16, bottom: 28 },
    xAxis: { type: 'category', data: s.dates.map(shortLabel), ...baseAxisStyle },
    yAxis: {
      type: 'value',
      ...baseAxisStyle,
      splitLine: { lineStyle: { color: '#f1f5f9' } }
    },
    series: [
      { name: '碳水', type: 'bar', data: s.carb, color: '#a855f7', barGap: '20%', itemStyle: { borderRadius: [3, 3, 0, 0] } },
      { name: '蛋白质', type: 'bar', data: s.protein, color: '#eab308', itemStyle: { borderRadius: [3, 3, 0, 0] } },
      { name: '脂肪', type: 'bar', data: s.fat, color: '#f97316', itemStyle: { borderRadius: [3, 3, 0, 0] } }
    ]
  }, true);
}

function renderAll() { renderKcal(); renderNut(); }
function onResize() { kcalChart?.resize(); nutChart?.resize(); }

onMounted(async () => {
  await nextTick();
  if (kcalEl.value) kcalChart = echarts.init(kcalEl.value);
  if (nutEl.value) nutChart = echarts.init(nutEl.value);
  renderAll();
  window.addEventListener('resize', onResize);
});
onBeforeUnmount(() => {
  kcalChart?.dispose();
  nutChart?.dispose();
  window.removeEventListener('resize', onResize);
});
watch(() => props.logs, renderAll, { deep: true });
</script>

<template>
  <div class="space-y-3">
    <div class="rounded-2xl bg-white shadow-sm p-4">
      <div class="text-sm font-semibold text-slate-700 mb-3">均值（每日）</div>
      <div class="grid grid-cols-4 gap-2 text-center">
        <div>
          <div class="text-xl font-bold text-slate-800 tabular-nums">{{ averages.kcal }}</div>
          <div class="text-[11px] text-slate-400 mt-1">热量(千卡)</div>
        </div>
        <div>
          <div class="text-xl font-bold text-slate-800 tabular-nums">{{ averages.carb }}</div>
          <div class="text-[11px] text-slate-400 mt-1">碳水(g)</div>
        </div>
        <div>
          <div class="text-xl font-bold text-slate-800 tabular-nums">{{ averages.protein }}</div>
          <div class="text-[11px] text-slate-400 mt-1">蛋白(g)</div>
        </div>
        <div>
          <div class="text-xl font-bold text-slate-800 tabular-nums">{{ averages.fat }}</div>
          <div class="text-[11px] text-slate-400 mt-1">脂肪(g)</div>
        </div>
      </div>
    </div>

    <div class="rounded-2xl bg-white shadow-sm p-4">
      <div class="flex items-center justify-between mb-2">
        <div class="text-sm font-semibold text-slate-700">卡路里</div>
        <div class="text-[11px] text-slate-400">单位：千卡</div>
      </div>
      <div ref="kcalEl" class="w-full h-56"></div>
    </div>

    <div class="rounded-2xl bg-white shadow-sm p-4">
      <div class="flex items-center justify-between mb-2">
        <div class="text-sm font-semibold text-slate-700">营养素</div>
        <div class="text-[11px] text-slate-400">单位：克</div>
      </div>
      <div ref="nutEl" class="w-full h-56"></div>
    </div>

    <div v-if="!series.dates.length" class="text-center text-sm text-slate-400 py-4">该时段暂无数据</div>
  </div>
</template>
