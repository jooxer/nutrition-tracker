<script setup lang="ts">
import type { Entry, FoodRow } from '@/db/db';
import { entryTotals } from '@/lib/calc';
import { computed } from 'vue';

const props = defineProps<{ entry: Entry; food?: FoodRow }>();
defineEmits<{ remove: [string] }>();

const d = computed(() => {
  if (props.entry.kind === 'food') {
    if (!props.food) return { name: '已删除食物', spec: '', n: { carb: 0, protein: 0, fat: 0 } };
    const n = entryTotals(
      { carb: props.food.carb, protein: props.food.protein, fat: props.food.fat },
      props.entry.amount
    );
    return { name: props.food.name, spec: `${props.food.spec} × ${props.entry.amount}`, n };
  }
  const n = entryTotals(
    { carb: props.entry.carb, protein: props.entry.protein, fat: props.entry.fat },
    props.entry.amount
  );
  return {
    name: props.entry.name + ' (临时)',
    spec: `${props.entry.spec} × ${props.entry.amount}`,
    n
  };
});
</script>

<template>
  <div class="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-100">
    <div>
      <div class="text-sm font-medium">{{ d.name }}</div>
      <div class="text-xs text-slate-500">{{ d.spec }}</div>
    </div>
    <div class="flex items-center gap-3">
      <div class="text-right text-xs text-slate-600 leading-tight">
        <div>碳 {{ d.n.carb.toFixed(1) }}　蛋 {{ d.n.protein.toFixed(1) }}　脂 {{ d.n.fat.toFixed(1) }}</div>
      </div>
      <button class="text-slate-400 px-2" @click="$emit('remove', entry.id)">✕</button>
    </div>
  </div>
</template>
