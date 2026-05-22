<script setup lang="ts">
import { computed } from 'vue';
import { monthRange } from '@/lib/date';

const props = defineProps<{ yearMonth: string; statusByDate: Record<string, 'green' | 'red' | 'gray' | 'none'> }>();
defineEmits<{ select: [date: string] }>();

const days = computed(() => monthRange(props.yearMonth));
const firstWeekday = computed(() => {
  const [y, m] = props.yearMonth.split('-').map(Number);
  return new Date(y, m - 1, 1).getDay(); // 0=Sun
});
const colors: Record<string, string> = {
  green: 'bg-emerald-500',
  red: 'bg-red-400',
  gray: 'bg-slate-300',
  none: 'bg-transparent border border-slate-200'
};
</script>

<template>
  <div class="grid grid-cols-7 gap-2 text-xs text-center">
    <div v-for="w in ['日','一','二','三','四','五','六']" :key="w" class="text-slate-400">{{ w }}</div>
    <div v-for="i in firstWeekday" :key="'pad'+i"></div>
    <button v-for="d in days" :key="d" class="aspect-square flex items-center justify-center"
      @click="$emit('select', d)">
      <span :class="['w-7 h-7 rounded-full flex items-center justify-center text-white text-xs', colors[statusByDate[d] ?? 'none'], (statusByDate[d] ?? 'none') === 'none' ? 'text-slate-500' : '']">
        {{ Number(d.slice(-2)) }}
      </span>
    </button>
  </div>
</template>
