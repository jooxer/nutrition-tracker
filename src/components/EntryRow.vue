<script setup lang="ts">
import type { Entry, FoodRow } from '@/db/db';
import { entryTotals } from '@/lib/calc';
import { computed } from 'vue';

const props = defineProps<{ entry: Entry; food?: FoodRow }>();
defineEmits<{ remove: [string] }>();

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
  <div class="px-4 py-3 bg-white border-b border-slate-100 last:border-b-0">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <span class="text-sm font-medium truncate">{{ d.name }}</span>
          <span v-if="d.adhoc" class="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 flex-shrink-0">临时</span>
        </div>
        <div class="flex items-baseline justify-between gap-2 mt-0.5">
          <span class="text-xs text-slate-400 truncate">{{ d.spec }}</span>
          <span v-if="d.weight" class="text-xs text-slate-600 font-medium flex-shrink-0">{{ d.weight }}</span>
        </div>
      </div>
      <button
        class="text-slate-300 hover:text-red-500 -mt-1 -mr-1 px-2 py-1 text-lg leading-none flex-shrink-0"
        aria-label="删除"
        @click="$emit('remove', entry.id)"
      >✕</button>
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
  </div>
</template>
