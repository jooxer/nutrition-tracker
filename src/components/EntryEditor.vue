<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { Entry, FoodRow } from '@/db/db';
import { entryTotals } from '@/lib/calc';
import { MEALS, type MealType } from '@/constants/goals';

const props = defineProps<{ entry: Entry | null; food?: FoodRow }>();
const emit = defineEmits<{
  close: [];
  save: [id: string, patch: { amount: number; mealType: MealType }];
  remove: [id: string];
}>();

const amount = ref(1);
const meal = ref<MealType>('breakfast');

watch(() => props.entry, (e) => {
  if (!e) return;
  amount.value = e.amount;
  meal.value = e.mealType ?? 'breakfast';
}, { immediate: true });

const display = computed(() => {
  const e = props.entry;
  if (!e) return null;
  if (e.kind === 'food') {
    if (!props.food) return { name: '已删除食物', spec: '', n: { carb: 0, protein: 0, fat: 0 } };
    return {
      name: props.food.name,
      spec: props.food.spec,
      n: entryTotals({ carb: props.food.carb, protein: props.food.protein, fat: props.food.fat }, amount.value)
    };
  }
  return {
    name: e.name,
    spec: e.spec,
    n: entryTotals({ carb: e.carb, protein: e.protein, fat: e.fat }, amount.value)
  };
});

function step(d: number) {
  const next = Math.max(0, Math.round((amount.value + d) * 10) / 10);
  amount.value = next;
}
function save() {
  if (!props.entry) return;
  emit('save', props.entry.id, { amount: amount.value, mealType: meal.value });
}
function remove() {
  if (!props.entry) return;
  emit('remove', props.entry.id);
}
</script>

<template>
  <div v-if="entry" class="fixed inset-0 z-40 bg-black/40 flex items-end" @click.self="$emit('close')">
    <div class="w-full bg-white rounded-t-2xl pb-[env(safe-area-inset-bottom)]">
      <div class="px-4 pt-4 pb-3 border-b border-slate-100">
        <div class="text-base font-semibold">{{ display?.name }}</div>
        <div class="text-xs text-slate-400 mt-0.5">{{ display?.spec }}</div>
      </div>

      <div class="p-4 space-y-4">
        <div>
          <div class="text-xs text-slate-500 mb-2">餐次</div>
          <div class="flex flex-wrap gap-1.5">
            <button v-for="m in MEALS" :key="m.value"
              @click="meal = m.value"
              :class="['px-3 py-1 rounded-full text-xs',
                meal === m.value ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500']">
              {{ m.label }}
            </button>
          </div>
        </div>

        <div>
          <div class="text-xs text-slate-500 mb-2">分量倍数</div>
          <div class="flex items-center gap-2">
            <button class="w-10 h-10 rounded-lg bg-slate-100 text-slate-600 text-xl active:bg-slate-200" @click="step(-0.5)">−</button>
            <input v-model.number="amount" type="number" step="0.1" min="0"
              class="flex-1 px-3 py-2 rounded-lg bg-slate-100 text-base text-center tabular-nums" />
            <button class="w-10 h-10 rounded-lg bg-slate-100 text-slate-600 text-xl active:bg-slate-200" @click="step(0.5)">+</button>
          </div>
        </div>

        <div class="flex gap-1.5 text-[11px]">
          <span class="px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
            碳水 <b class="font-semibold">{{ display?.n.carb.toFixed(1) }}</b>g
          </span>
          <span class="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
            蛋白质 <b class="font-semibold">{{ display?.n.protein.toFixed(1) }}</b>g
          </span>
          <span class="px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">
            脂肪 <b class="font-semibold">{{ display?.n.fat.toFixed(1) }}</b>g
          </span>
        </div>
      </div>

      <div class="px-4 pb-4 flex gap-2">
        <button class="px-4 py-2 rounded-full border border-red-200 text-red-500 active:bg-red-50" @click="remove">删除</button>
        <button class="flex-1 py-2 rounded-full border border-slate-200 text-slate-600" @click="$emit('close')">取消</button>
        <button class="flex-1 py-2 rounded-full bg-emerald-500 text-white active:bg-emerald-600" @click="save">保存</button>
      </div>
    </div>
  </div>
</template>
