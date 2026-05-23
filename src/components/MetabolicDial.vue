<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  totals: { carb: number; protein: number; fat: number };
  targets: { carb: number; protein: number; fat: number; kcal: number };
  kcal: number;
  muls?: { carb: number; protein: number; fat: number };
  targetMuls?: { carb: number; protein: number; fat: number };
}>();

const remainingKcal = computed(() => Math.max(0, Math.round(props.targets.kcal - props.kcal)));
const overKcal = computed(() => props.kcal > props.targets.kcal);
const kcalPct = computed(() => props.targets.kcal > 0 ? Math.min(props.kcal / props.targets.kcal, 1) : 0);

const macros = computed(() => [
  { key: 'carb',    label: '碳水', color: '#3b82f6', cur: props.totals.carb,    tgt: props.targets.carb },
  { key: 'protein', label: '蛋白质', color: '#a855f7', cur: props.totals.protein, tgt: props.targets.protein },
  { key: 'fat',     label: '脂肪', color: '#f59e0b', cur: props.totals.fat,     tgt: props.targets.fat }
]);

const R = 56;
const C = 2 * Math.PI * R;
function dasharray(p: number) {
  return `${C * Math.min(Math.max(p, 0), 1)} ${C}`;
}
</script>

<template>
  <div class="rounded-2xl bg-slate-900 text-white p-5 shadow-sm">
    <div class="text-sm font-semibold text-slate-200 mb-4">营养目标</div>

    <div class="flex items-center gap-5">
      <!-- big kcal ring -->
      <div class="relative flex-shrink-0">
        <svg width="140" height="140" viewBox="0 0 140 140">
          <circle cx="70" cy="70" :r="R" stroke="#1e293b" stroke-width="10" fill="none" />
          <circle cx="70" cy="70" :r="R" :stroke="overKcal ? '#ef4444' : '#3b82f6'" stroke-width="10" fill="none"
            stroke-linecap="round" :stroke-dasharray="dasharray(kcalPct)"
            transform="rotate(-90 70 70)" />
        </svg>
        <div class="absolute inset-0 flex flex-col items-center justify-center">
          <div class="text-3xl font-bold tabular-nums leading-none">{{ remainingKcal }}</div>
          <div class="text-[11px] text-slate-400 mt-1.5">剩余摄入(千卡)</div>
        </div>
      </div>

      <!-- right side: kcal current/target + macros -->
      <div class="flex-1 min-w-0 space-y-3">
        <div>
          <div class="text-[11px] text-slate-400">已摄入 / 目标</div>
          <div class="text-sm font-semibold tabular-nums">
            {{ Math.round(kcal) }}<span class="text-slate-500"> / {{ Math.round(targets.kcal) }}</span>
            <span class="text-[11px] text-slate-400 font-normal ml-1">千卡</span>
          </div>
        </div>

        <div class="grid grid-cols-3 gap-2">
          <div v-for="m in macros" :key="m.key" class="space-y-1">
            <div class="flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full" :style="{ background: m.color }"></span>
              <span class="text-[10px] text-slate-400">{{ m.label }}</span>
            </div>
            <div class="text-[11px] tabular-nums leading-tight">
              <span class="font-semibold">{{ m.cur.toFixed(0) }}</span><span class="text-slate-500">/{{ m.tgt.toFixed(0) }}g</span>
            </div>
            <div class="h-1 bg-slate-800 rounded-full overflow-hidden">
              <div class="h-full rounded-full" :style="{
                width: Math.min(100, m.tgt > 0 ? (m.cur / m.tgt * 100) : 0) + '%',
                background: m.color
              }"></div>
            </div>
            <div :class="['text-[10px] tabular-nums', m.cur > m.tgt ? 'text-red-400' : 'text-emerald-400']">
              {{ m.cur > m.tgt ? '超 ' : '剩余 ' }}{{ Math.abs(m.tgt - m.cur).toFixed(0) }}g
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
