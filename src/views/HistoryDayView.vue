<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { getLog, setDayType, removeEntry, updateEntry, addEntry } from '@/db/logs';
import { useFoodStore } from '@/stores/foodStore';
import { useRecipeStore } from '@/stores/recipeStore';
import { entryTotals, kcalOf, multipliers, sumTotals } from '@/lib/calc';
import { WEIGHT_KG, MEALS, mealTargetsFor, type DayType, type MealType } from '@/constants/goals';
import { groupByMeal } from '@/lib/meals';
import { friendlyDate } from '@/lib/date';
import { useSettingsStore } from '@/stores/settingsStore';
import { useToast } from '@/stores/toastStore';
import type { DailyLogRow, Entry } from '@/db/db';
import MetabolicDial from '@/components/MetabolicDial.vue';
import MealGroup from '@/components/MealGroup.vue';
import EntryRow from '@/components/EntryRow.vue';
import EntryEditor from '@/components/EntryEditor.vue';
import SegmentedControl from '@/components/SegmentedControl.vue';

const route = useRoute();
const date = computed(() => String(route.params.date));
const log = ref<DailyLogRow | null>(null);
const foods = useFoodStore();
const recipeStore = useRecipeStore();
const settings = useSettingsStore();
const toast = useToast();

const selecting = ref(false);
const selectedIds = ref<Set<string>>(new Set());
const editing = ref<Entry | null>(null);

// 复制弹窗
const showCopyDialog = ref(false);
const copyDate = ref('');
const copyMeal = ref<MealType>('breakfast');
// 保存食谱弹窗
const showSaveRecipe = ref(false);
const recipeName = ref('');

onMounted(async () => {
  await Promise.all([foods.load(), recipeStore.load()]);
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
function targetOf(meal: MealType) {
  return mealTargetsFor(dayType.value, meal, settings.ratios);
}
const editingFood = computed(() => {
  const e = editing.value;
  if (!e || e.kind !== 'food') return undefined;
  return foods.byId(e.foodId);
});

function onLongPress(e: Entry) {
  selecting.value = true;
  selectedIds.value = new Set([e.id]);
}
function toggleSelect(id: string) {
  const next = new Set(selectedIds.value);
  if (next.has(id)) next.delete(id); else next.add(id);
  selectedIds.value = next;
}
function cancelSelect() { selecting.value = false; selectedIds.value = new Set(); }
function onEdit(e: Entry) { if (!selecting.value) editing.value = e; }
async function onSaveEdit(id: string, patch: { amount: number; mealType: MealType }) {
  await updateEntry(date.value, id, patch);
  log.value = (await getLog(date.value)) ?? null;
  editing.value = null;
}
async function onRemoveEdit(id: string) {
  await removeEntry(date.value, id);
  log.value = (await getLog(date.value)) ?? null;
  editing.value = null;
}
async function deleteSelected() {
  if (!log.value || !selectedIds.value.size) return;
  if (!confirm(`删除选中的 ${selectedIds.value.size} 条？`)) return;
  for (const id of selectedIds.value) await removeEntry(log.value.date, id);
  log.value = (await getLog(date.value)) ?? null;
  toast.show(`已删除`);
  cancelSelect();
}
const copyDates = computed(() => {
  const dates: { label: string; value: string }[] = [];
  const today = new Date();
  for (let i = -3; i <= 7; i++) {
    const d = new Date(today); d.setDate(d.getDate() + i);
    const val = d.toISOString().split('T')[0];
    let label = `${d.getMonth() + 1}/${d.getDate()}`;
    if (i === 0) label = '今天'; else if (i === 1) label = '明天'; else if (i === -1) label = '昨天';
    dates.push({ label, value: val });
  }
  return dates;
});
function openCopyDialog() {
  copyDate.value = new Date().toISOString().split('T')[0];
  copyMeal.value = 'breakfast';
  showCopyDialog.value = true;
}
async function confirmCopy() {
  if (!copyDate.value || !selectedIds.value.size || !log.value) return;
  const entries = log.value.entries.filter(e => selectedIds.value.has(e.id));
  for (const e of entries) { const { id, ...rest } = e; await addEntry(copyDate.value, { ...rest, mealType: copyMeal.value }); }
  toast.show(`已复制 ${entries.length} 条`);
  showCopyDialog.value = false; cancelSelect();
}
function openSaveRecipe() { recipeName.value = ''; showSaveRecipe.value = true; }
async function confirmSaveRecipe() {
  if (!recipeName.value.trim() || !selectedIds.value.size || !log.value) return;
  const entries = log.value.entries.filter(e => selectedIds.value.has(e.id) && e.kind === 'food');
  if (!entries.length) { toast.show('需要至少一个食物条目', 'error'); return; }
  await recipeStore.add({ name: recipeName.value.trim(), items: entries.map(e => ({ foodId: (e as any).foodId, amount: e.amount })) });
  toast.show('已保存为食谱'); showSaveRecipe.value = false; cancelSelect();
}
</script>

<template>
  <div class="p-4 space-y-3 pb-24">
    <div class="flex items-center justify-between">
      <div class="text-sm text-slate-700 font-medium">{{ friendlyDate(date) }}</div>
      <SegmentedControl v-if="log && !selecting" v-model="dayType" :options="[
        { value: 'training', label: '力训日' },
        { value: 'rest',     label: '休息日' }
      ]" />
      <span v-else-if="selecting" class="text-xs text-slate-400">长按选择 · 点击切换</span>
    </div>
    <div v-if="!log" class="text-center text-slate-400 py-8">无记录</div>
    <template v-else>
      <MetabolicDial v-if="!selecting" :totals="totals" :targets="targets" :kcal="kcal" :muls="muls" :target-muls="targetMuls" />

      <!-- 非选中模式 -->
      <template v-if="!selecting">
        <MealGroup v-for="m in MEALS" :key="m.value"
          :label="m.label"
          :entries="byMeal[m.value].entries"
          :totals="byMeal[m.value].totals"
          :target="targetOf(m.value)"
          :food-by-id="foods.byId"
          @edit="onEdit"
          @longpress="onLongPress" />
      </template>

      <!-- 选中模式 -->
      <template v-else>
        <div v-for="m in MEALS" :key="m.value">
          <div v-if="byMeal[m.value].entries.length" class="rounded-2xl bg-white shadow-sm overflow-hidden mb-3">
            <div class="px-4 py-2 text-xs text-slate-500 bg-slate-50">{{ m.label }}</div>
            <div v-for="e in byMeal[m.value].entries" :key="e.id"
              class="flex items-center px-4 py-3 border-b border-slate-50 select-none cursor-pointer active:bg-slate-50"
              @click="toggleSelect(e.id)">
              <span :class="['w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center mr-3',
                selectedIds.has(e.id) ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300']">
                <svg v-if="selectedIds.has(e.id)" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>
              </span>
              <EntryRow readonly :entry="e" :food="e.kind === 'food' ? foods.byId(e.foodId) : undefined" class="flex-1 !px-0 !border-0" />
            </div>
          </div>
        </div>
      </template>
    </template>

    <!-- 底部操作栏 -->
    <div v-if="selecting" class="fixed bottom-[68px] left-0 right-0 bg-white border-t border-slate-200 p-3 flex items-center gap-2 z-40 shadow-lg">
      <button class="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-sm" @click="cancelSelect">取消</button>
      <span class="text-sm text-slate-500 flex-1 text-center">{{ selectedIds.size }} 项</span>
      <button :disabled="!selectedIds.size" :class="['px-3 py-1.5 rounded-lg text-sm', selectedIds.size ? 'bg-slate-100 text-slate-700' : 'bg-slate-50 text-slate-300']" @click="openCopyDialog">复制</button>
      <button :disabled="!selectedIds.size" :class="['px-3 py-1.5 rounded-lg text-sm', selectedIds.size ? 'bg-emerald-500 text-white' : 'bg-slate-50 text-slate-300']" @click="openSaveRecipe">食谱</button>
      <button :disabled="!selectedIds.size" :class="['px-3 py-1.5 rounded-lg text-sm', selectedIds.size ? 'bg-red-500 text-white' : 'bg-slate-50 text-slate-300']" @click="deleteSelected">删除</button>
    </div>

    <EntryEditor :entry="editing" :food="editingFood" @close="editing = null" @save="onSaveEdit" @remove="onRemoveEdit" />

    <!-- 复制 sheet -->
    <div v-if="showCopyDialog" class="fixed inset-0 z-50 bg-black/40 flex items-end" @click.self="showCopyDialog = false">
      <div class="w-full bg-white rounded-t-2xl p-4 space-y-4 animate-slide-up">
        <div class="flex items-center justify-between"><span class="text-base font-semibold">复制到</span><button class="text-sm text-slate-400" @click="showCopyDialog = false">取消</button></div>
        <div><div class="text-xs text-slate-400 mb-2">选择日期</div><div class="flex flex-wrap gap-2"><button v-for="d in copyDates" :key="d.value" @click="copyDate = d.value" :class="['px-3 py-1.5 rounded-full text-xs transition', copyDate === d.value ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600']">{{ d.label }}</button></div></div>
        <div><div class="text-xs text-slate-400 mb-2">选择餐次</div><div class="flex gap-2"><button v-for="m in MEALS" :key="m.value" @click="copyMeal = m.value" :class="['px-4 py-2 rounded-full text-sm flex-1 transition', copyMeal === m.value ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600']">{{ m.label }}</button></div></div>
        <button class="w-full py-3 rounded-full bg-emerald-500 text-white text-sm font-medium" @click="confirmCopy">确认复制</button>
      </div>
    </div>

    <!-- 保存食谱 -->
    <div v-if="showSaveRecipe" class="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" @click.self="showSaveRecipe = false">
      <div class="bg-white rounded-2xl p-4 w-full max-w-sm space-y-3">
        <div class="text-base font-semibold">保存为食谱</div>
        <input v-model="recipeName" placeholder="输入食谱名称" class="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" />
        <div class="flex gap-2">
          <button class="flex-1 px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm" @click="showSaveRecipe = false">取消</button>
          <button class="flex-1 px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm" @click="confirmSaveRecipe">确定</button>
        </div>
      </div>
    </div>
  </div>
</template>
