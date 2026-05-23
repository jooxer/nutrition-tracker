<script setup lang="ts">
import { computed } from 'vue';
import type { Entry, FoodRow } from '@/db/db';
import EntryRow from './EntryRow.vue';

const props = defineProps<{
  label: string;
  entries: Entry[];
  totals: { carb: number; protein: number; fat: number };
  target: { carb: number; protein: number; carbPct: number; proteinPct: number };
  foodById: (id: string) => FoodRow | undefined;
}>();
defineEmits<{ remove: [string]; add: [] }>();

function pctOf(cur: number, tgt: number) {
  return tgt > 0 ? Math.min(100, Math.round((cur / tgt) * 100)) : 0;
}

const carbStatus = computed(() => statusOf(props.totals.carb, props.target.carb));
const proteinStatus = computed(() => statusOf(props.totals.protein, props.target.protein));
function statusOf(cur: number, tgt: number): 'empty' | 'partial' | 'done' | 'over' {
  if (tgt <= 0 || cur === 0) return 'empty';
  const r = cur / tgt;
  if (r < 0.95) return 'partial';
  if (r <= 1.1) return 'done';
  return 'over';
}
</script>

<template>
  <div class="rounded-2xl bg-white shadow-sm overflow-hidden">
    <div class="px-4 pt-3 pb-2.5 border-b border-slate-100">
      <div class="flex items-center justify-between mb-2.5">
        <div class="flex items-baseline gap-2">
          <span class="text-sm font-semibold text-slate-700">{{ label }}</span>
          <span v-if="entries.length" class="text-[11px] text-slate-400">{{ entries.length }} 项</span>
        </div>
        <button
          class="text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 active:bg-emerald-100 transition"
          @click="$emit('add')"
        >+ 添加</button>
      </div>

      <div class="space-y-1.5">
        <div class="flex items-center gap-2 text-[11px]">
          <span class="text-slate-500 w-12 flex-shrink-0">碳水</span>
          <div class="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div class="h-full rounded-full transition-all duration-300"
              :class="{
                'bg-blue-500': carbStatus === 'partial',
                'bg-emerald-500': carbStatus === 'done',
                'bg-red-400': carbStatus === 'over',
                'bg-transparent': carbStatus === 'empty'
              }"
              :style="{ width: pctOf(totals.carb, target.carb) + '%' }"></div>
          </div>
          <span class="text-slate-700 font-medium tabular-nums w-[88px] text-right">
            {{ totals.carb.toFixed(1) }}<span class="text-slate-400"> / {{ target.carb.toFixed(1) }}g</span>
          </span>
          <span class="text-slate-400 tabular-nums w-9 text-right">{{ target.carbPct }}%</span>
        </div>
        <div class="flex items-center gap-2 text-[11px]">
          <span class="text-slate-500 w-12 flex-shrink-0">蛋白质</span>
          <div class="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div class="h-full rounded-full transition-all duration-300"
              :class="{
                'bg-emerald-400': proteinStatus === 'partial',
                'bg-emerald-600': proteinStatus === 'done',
                'bg-red-400': proteinStatus === 'over',
                'bg-transparent': proteinStatus === 'empty'
              }"
              :style="{ width: pctOf(totals.protein, target.protein) + '%' }"></div>
          </div>
          <span class="text-slate-700 font-medium tabular-nums w-[88px] text-right">
            {{ totals.protein.toFixed(1) }}<span class="text-slate-400"> / {{ target.protein.toFixed(1) }}g</span>
          </span>
          <span class="text-slate-400 tabular-nums w-9 text-right">{{ target.proteinPct }}%</span>
        </div>
      </div>
    </div>

    <div v-if="!entries.length" class="px-4 py-5 text-center text-xs text-slate-300">未添加</div>
    <EntryRow v-for="e in entries" :key="e.id"
      :entry="e" :food="e.kind === 'food' ? foodById(e.foodId) : undefined"
      @remove="(id) => $emit('remove', id)" />
  </div>
</template>
