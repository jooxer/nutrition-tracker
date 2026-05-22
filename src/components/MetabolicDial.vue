<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  totals: { carb: number; protein: number; fat: number };
  targets: { carb: number; protein: number; fat: number; kcal: number };
  kcal: number;
  muls: { carb: number; protein: number; fat: number };
}>();

const items = computed(() => [
  { key: 'carb',    label: '碳水',   color: '#3b82f6', cur: props.totals.carb,    tgt: props.targets.carb,    unit: 'g' },
  { key: 'protein', label: '蛋白质', color: '#10b981', cur: props.totals.protein, tgt: props.targets.protein, unit: 'g' },
  { key: 'fat',     label: '脂肪',   color: '#f59e0b', cur: props.totals.fat,     tgt: props.targets.fat,     unit: 'g' }
]);

function pct(cur: number, tgt: number) { return tgt > 0 ? Math.min(cur / tgt, 1.5) : 0; }
function dasharray(cur: number, tgt: number) {
  const c = 2 * Math.PI * 36;
  return `${c * Math.min(pct(cur, tgt), 1)} ${c}`;
}
</script>

<template>
  <div class="rounded-2xl bg-white p-4 shadow-sm">
    <div class="grid grid-cols-3 gap-2 mb-3">
      <div v-for="i in items" :key="i.key" class="flex flex-col items-center">
        <svg width="80" height="80" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="36" stroke="#e5e7eb" stroke-width="6" fill="none" />
          <circle cx="40" cy="40" r="36" :stroke="i.color" stroke-width="6" fill="none"
            stroke-linecap="round" :stroke-dasharray="dasharray(i.cur, i.tgt)"
            transform="rotate(-90 40 40)" />
        </svg>
        <div class="mt-1 text-xs text-slate-500">{{ i.label }}</div>
        <div class="text-sm font-semibold">{{ i.cur.toFixed(1) }}<span class="text-slate-400 text-xs"> / {{ i.tgt.toFixed(0) }}{{ i.unit }}</span></div>
      </div>
    </div>
    <div class="flex justify-between items-start border-t border-slate-100 pt-3 gap-3">
      <div>
        <div class="text-xs text-slate-500">总热量</div>
        <div class="text-lg font-semibold">{{ Math.round(kcal) }}<span class="text-slate-400 text-sm"> / {{ Math.round(targets.kcal) }} kcal</span></div>
      </div>
      <div class="text-right text-xs text-slate-500 leading-relaxed">
        <div>碳水 <b class="text-slate-700 font-semibold">{{ muls.carb.toFixed(2) }}×</b> /kg</div>
        <div>蛋白质 <b class="text-slate-700 font-semibold">{{ muls.protein.toFixed(2) }}×</b> /kg</div>
        <div>脂肪 <b class="text-slate-700 font-semibold">{{ muls.fat.toFixed(2) }}×</b> /kg</div>
      </div>
    </div>
  </div>
</template>
