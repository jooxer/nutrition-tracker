<script setup lang="ts">
import type { Entry, FoodRow } from '@/db/db';
import { entryTotals } from '@/lib/calc';
import { computed } from 'vue';

const props = defineProps<{ entry: Entry; food?: FoodRow }>();
defineEmits<{ edit: [Entry] }>();

function totalWeight(spec: string, amount: number): string | null {
  const m = spec.match(/(\d+(?:\.\d+)?)\s*g\b/i);
  if (!m) return null;
  const grams = Number(m[1]) * amount;
  return `${Number.isInteger(grams) ? grams : grams.toFixed(1)} g`;
}

const d = computed(() => {
  if (props.entry.kind === 'food') {
    if (!props.food) return { name: '已删除食物', spec: '', weight: null, n: { carb: 0, protein: 0, fat: 0 }, adhoc: false };
    const n = entryTotals(
      { carb: props.food.carb, protein: props.food.protein, fat: props.food.fat },
      props.entry.amount
    );
    return {
      name: props.food.name,
      spec: `${props.food.spec} × ${props.entry.amount}`,
      weight: totalWeight(props.food.spec, props.entry.amount),
      n,
      adhoc: false
    };
  }
  const n = entryTotals(
    { carb: props.entry.carb, protein: props.entry.protein, fat: props.entry.fat },
    props.entry.amount
  );
  return {
    name: props.entry.name,
    spec: `${props.entry.spec} × ${props.entry.amount}`,
    weight: totalWeight(props.entry.spec, props.entry.amount),
    n,
    adhoc: true
  };
});
</script>

<template>
  <button type="button"
    class="block w-full text-left px-4 py-3 bg-white border-b border-slate-100 last:border-b-0 active:bg-slate-50 transition"
    @click="$emit('edit', entry)">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <span class="text-sm font-medium truncate">{{ d.name }}</span>
          <span v-if="d.adhoc" class="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 flex-shrink-0">临时</span>
        </div>
        <div class="text-xs text-slate-400 mt-0.5">{{ d.spec }}</div>
      </div>
      <div class="flex items-center gap-1 flex-shrink-0">
        <span v-if="d.weight" class="text-sm font-bold text-slate-800">{{ d.weight }}</span>
        <svg class="text-slate-300" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>
      </div>
    </div>
    <div class="flex gap-1.5 mt-2 text-[11px]">
      <span class="px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
        碳水 <b class="font-semibold">{{ d.n.carb.toFixed(1) }}</b>g
      </span>
      <span class="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
        蛋白质 <b class="font-semibold">{{ d.n.protein.toFixed(1) }}</b>g
      </span>
      <span class="px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">
        脂肪 <b class="font-semibold">{{ d.n.fat.toFixed(1) }}</b>g
      </span>
    </div>
  </button>
</template>
