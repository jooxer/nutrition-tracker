<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import * as echarts from 'echarts/core';
import { LineChart, BarChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { DailyLogRow, Entry, FoodRow } from '@/db/db';
import { entryTotals, kcalOf, sumTotals } from '@/lib/calc';

echarts.use([LineChart, BarChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

const props = defineProps<{ logs: DailyLogRow[]; foods: FoodRow[] }>();
const el = ref<HTMLDivElement | null>(null);
let chart: echarts.ECharts | null = null;

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
    carb.push(+t.carb.toFixed(1)); protein.push(+t.protein.toFixed(1)); fat.push(+t.fat.toFixed(1));
    kcal.push(Math.round(kcalOf(t)));
  }
  return { dates, carb, protein, fat, kcal };
});

function render() {
  if (!chart) return;
  const s = series.value;
  chart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['碳水', '蛋白质', '脂肪', '热量'], top: 0 },
    grid: { top: 30, left: 40, right: 50, bottom: 30 },
    xAxis: { type: 'category', data: s.dates },
    yAxis: [
      { type: 'value', name: 'g' },
      { type: 'value', name: 'kcal', position: 'right' }
    ],
    series: [
      { name: '碳水', type: 'line', data: s.carb,    color: '#3b82f6', smooth: true },
      { name: '蛋白质', type: 'line', data: s.protein, color: '#10b981', smooth: true },
      { name: '脂肪', type: 'line', data: s.fat,     color: '#f59e0b', smooth: true },
      { name: '热量', type: 'bar',  data: s.kcal,    yAxisIndex: 1, color: '#cbd5e1', barWidth: 8 }
    ]
  });
}

onMounted(() => {
  if (el.value) { chart = echarts.init(el.value); render(); }
});
onBeforeUnmount(() => { chart?.dispose(); });
watch(() => props.logs, render, { deep: true });
</script>

<template>
  <div ref="el" class="w-full h-72 bg-white rounded-2xl shadow-sm p-2"></div>
</template>
