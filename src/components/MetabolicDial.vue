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
  { key: 'carb',    label: '碳水',   color: '#3b82f6', cur: props.totals.carb,    tgt: props.targets.carb,
    mul: props.muls?.carb,    tmul: props.targetMuls?.carb },
  { key: 'protein', label: '蛋白质', color: '#10b981', cur: props.totals.protein, tgt: props.targets.protein,
    mul: props.muls?.protein, tmul: props.targetMuls?.protein },
  { key: 'fat',     label: '脂肪',   color: '#f59e0b', cur: props.totals.fat,     tgt: props.targets.fat,
    mul: props.muls?.fat,     tmul: props.targetMuls?.fat }
]);

const hasMuls = computed(() => props.muls && props.targetMuls);

const R = 46;
const C = 2 * Math.PI * R;
function dasharray(p: number) {
  return `${C * Math.min(Math.max(p, 0), 1)} ${C}`;
}
</script>

<template>
  <div class="rounded-2xl bg-white p-4 shadow-sm">
    <div class="text-sm font-semibold text-slate-700 mb-3">营养目标</div>

    <div class="flex items-center gap-5">
      <!-- kcal ring -->
      <div class="relative flex-shrink-0">
        <svg width="116" height="116" viewBox="0 0 116 116">
          <circle cx="58" cy="58" :r="R" stroke="#e5e7eb" stroke-width="9" fill="none" />
          <circle cx="58" cy="58" :r="R" :stroke="overKcal ? '#ef4444' : '#3b82f6'" stroke-width="9" fill="none"
            stroke-linecap="round" :stroke-dasharray="dasharray(kcalPct)"
            transform="rotate(-90 58 58)" />
        </svg>
        <div class="absolute inset-0 flex flex-col items-center justify-center">
          <div class="text-2xl font-bold tabular-nums leading-none text-slate-900">{{ remainingKcal }}</div>
          <div class="text-[10px] text-slate-400 mt-1">剩余 千卡</div>
        </div>
      </div>

      <!-- right side -->
      <div class="flex-1 min-w-0 space-y-3">
        <div>
          <div class="text-[11px] text-slate-400 leading-tight">已摄入 / 目标</div>
          <div class="text-sm font-semibold tabular-nums text-slate-800 leading-tight">
            {{ Math.round(kcal) }}<span class="text-slate-400 font-normal"> / {{ Math.round(targets.kcal) }} 千卡</span>
          </div>
        </div>

        <div class="grid grid-cols-3 gap-3">
          <div v-for="m in macros" :key="m.key">
            <div class="flex items-center gap-1 mb-1">
              <span class="w-1.5 h-1.5 rounded-full" :style="{ background: m.color }"></span>
              <span class="text-[11px] text-slate-500">{{ m.label }}</span>
            </div>
            <div class="text-[12px] tabular-nums leading-tight text-slate-800">
              <span class="font-semibold">{{ m.cur.toFixed(0) }}</span><span class="text-slate-400">/{{ m.tgt.toFixed(0) }}g</span>
            </div>
            <div class="h-1 bg-slate-100 rounded-full overflow-hidden mt-1.5">
              <div class="h-full rounded-full" :style="{
                width: Math.min(100, m.tgt > 0 ? (m.cur / m.tgt * 100) : 0) + '%',
                background: m.color
              }"></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- /kg row -->
    <div v-if="hasMuls" class="mt-4 pt-3 border-t border-slate-100 grid grid-cols-3 gap-3">
      <div v-for="m in macros" :key="m.key" class="text-[11px] tabular-nums">
        <span class="text-slate-400">{{ m.label }} </span>
        <span class="font-semibold text-slate-700">{{ m.mul!.toFixed(2) }}</span><span class="text-slate-400">/{{ m.tmul!.toFixed(2) }}</span>
      </div>
    </div>
  </div>
</template>
