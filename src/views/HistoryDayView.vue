<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { getLog, setDayType, removeEntry } from '@/db/logs';
import { useFoodStore } from '@/stores/foodStore';
import { entryTotals, kcalOf, multipliers, sumTotals } from '@/lib/calc';
import { WEIGHT_KG, MEALS, type DayType } from '@/constants/goals';
import { groupByMeal } from '@/lib/meals';
import { friendlyDate } from '@/lib/date';
import { useSettingsStore } from '@/stores/settingsStore';
import { useToast } from '@/stores/toastStore';
import type { DailyLogRow, Entry } from '@/db/db';
import MetabolicDial from '@/components/MetabolicDial.vue';
import EntryRow from '@/components/EntryRow.vue';
import SegmentedControl from '@/components/SegmentedControl.vue';

const route = useRoute();
const date = computed(() => String(route.params.date));
const log = ref<DailyLogRow | null>(null);
const foods = useFoodStore();
const settings = useSettingsStore();
const toast = useToast();

const selecting = ref(false);
const selectedIds = ref<Set<string>>(new Set());

onMounted(async () => {
  await Promise.all([foods.load()]);
  settings.load();
  log.value = (await getLog(date.value)) ?? null;
});

function nutrientsFor(e: Entry) {
  if (e.kind === 'adhoc') return entryTotals({ carb: e.carb, protein: e.protein, fat: e.fat }, e.amount);
  const f = foods.byId(e.foodId);
  if (!f || f.deleted) return { carb: 0, protein: 0, fat: 0 };
  return entryTotals({ carb: f.carb, protein: f.protein, fat: f.fat }, e.amount);
}
const totals = computed(() => log.value ? sumTotals(log.value.entries.map(nutrientsFor)) : { carb: 0, protein: 0, fat: 0 });
const kcal = computed(() => kcalOf(totals.value));
const muls = computed(() => multipliers(totals.value, WEIGHT_KG));
const dayType = computed<DayType>({
  get: () => log.value?.dayType ?? 'rest',
  set: async (v) => {
    if (!log.value) return;
    await setDayType(log.value.date, v);
    log.value = { ...log.value, dayType: v };
    toast.show(v === 'training' ? '已切换为力训日' : '已切换为休息日');
  }
});
const targets = computed(() => settings.targetsFor(dayType.value));
const targetMuls = computed(() => ({
  carb: targets.value.carb / WEIGHT_KG,
  protein: targets.value.protein / WEIGHT_KG,
  fat: targets.value.fat / WEIGHT_KG
}));
const byMeal = computed(() => groupByMeal(log.value?.entries ?? [], nutrientsFor));

function toggleSelect(id: string) {
  const next = new Set(selectedIds.value);
  if (next.has(id)) next.delete(id); else next.add(id);
  selectedIds.value = next;
}
function cancelSelect() {
  selecting.value = false;
  selectedIds.value = new Set();
}
async function deleteSelected() {
  if (!log.value || !selectedIds.value.size) return;
  if (!confirm(`删除选中的 ${selectedIds.value.size} 条记录？`)) return;
  for (const id of selectedIds.value) {
    await removeEntry(log.value.date, id);
  }
  log.value = (await getLog(date.value)) ?? null;
  toast.show(`已删除 ${selectedIds.value.size} 条`);
  cancelSelect();
}
</script>

<template>
  <div class="p-4 space-y-3 pb-24">
    <div class="flex items-center justify-between">
      <div class="text-sm text-slate-700 font-medium">{{ friendlyDate(date) }}</div>
      <div class="flex items-center gap-2">
        <button v-if="log && log.entries.length && !selecting"
          class="text-xs px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600"
          @click="selecting = true">选择</button>
        <button v-if="selecting"
          class="text-xs px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600"
          @click="cancelSelect">取消</button>
        <SegmentedControl v-if="log && !selecting" v-model="dayType" :options="[
          { value: 'training', label: '力训日' },
          { value: 'rest',     label: '休息日' }
        ]" />
      </div>
    </div>
    <div v-if="!log" class="text-center text-slate-400 py-8">无记录</div>
    <template v-else>
      <MetabolicDial v-if="!selecting" :totals="totals" :targets="targets" :kcal="kcal" :muls="muls" :target-muls="targetMuls" />

      <div v-for="m in MEALS" :key="m.value">
        <div v-if="byMeal[m.value].entries.length" class="rounded-2xl bg-white shadow-sm overflow-hidden mb-3">
          <div class="px-4 py-2 text-xs text-slate-500 bg-slate-50">{{ m.label }}</div>
          <div v-for="e in byMeal[m.value].entries" :key="e.id"
            :class="['flex items-center px-4 py-3 border-b border-slate-50', selecting ? 'cursor-pointer' : '']"
            @click="selecting ? toggleSelect(e.id) : undefined">
            <span v-if="selecting" :class="['w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center mr-3',
              selectedIds.has(e.id) ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300']">
              <svg v-if="selectedIds.has(e.id)" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>
            </span>
            <EntryRow readonly :entry="e" :food="e.kind === 'food' ? foods.byId(e.foodId) : undefined"
              class="flex-1 !px-0 !border-0" />
          </div>
        </div>
      </div>

      <div v-if="byMeal.unset.entries.length" class="rounded-2xl bg-white shadow-sm overflow-hidden">
        <div class="px-4 py-2 border-b border-slate-100 text-xs text-slate-500">未分类</div>
        <div v-for="e in byMeal.unset.entries" :key="e.id"
          :class="['flex items-center px-4 py-3 border-b border-slate-50', selecting ? 'cursor-pointer' : '']"
          @click="selecting ? toggleSelect(e.id) : undefined">
          <span v-if="selecting" :class="['w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center mr-3',
            selectedIds.has(e.id) ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300']">
            <svg v-if="selectedIds.has(e.id)" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>
          </span>
          <EntryRow readonly :entry="e" :food="e.kind === 'food' ? foods.byId(e.foodId) : undefined"
            class="flex-1 !px-0 !border-0" />
        </div>
      </div>
    </template>

    <!-- 底部操作栏 -->
    <div v-if="selecting && selectedIds.size > 0"
      class="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 flex items-center gap-3 z-30">
      <span class="text-sm text-slate-600 flex-1">已选 {{ selectedIds.size }} 项</span>
      <button class="px-4 py-2 rounded-full bg-red-500 text-white text-sm" @click="deleteSelected">删除</button>
    </div>
  </div>
</template>
