<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useDailyStore } from '@/stores/dailyStore';
import { useFoodStore } from '@/stores/foodStore';
import { useRecipeStore } from '@/stores/recipeStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useToast } from '@/stores/toastStore';
import { todayKey, friendlyDate, addDays } from '@/lib/date';
import { WEIGHT_KG, targetsFor, mealTargetsFor, MEALS, type MealType } from '@/constants/goals';
import { addEntry } from '@/db/logs';
import type { RecipeRow, Entry } from '@/db/db';
import MetabolicDial from '@/components/MetabolicDial.vue';
import MealGroup from '@/components/MealGroup.vue';
import EntryRow from '@/components/EntryRow.vue';
import EntryEditor from '@/components/EntryEditor.vue';
import SegmentedControl from '@/components/SegmentedControl.vue';
import FoodPicker from '@/components/FoodPicker.vue';

const daily = useDailyStore();
const foods = useFoodStore();
const recipeStore = useRecipeStore();
const settings = useSettingsStore();
const toast = useToast();
const showPicker = ref(false);
const pickerMeal = ref<MealType>('breakfast');
const editing = ref<Entry | null>(null);

// 日期导航
const currentDate = ref(todayKey());
const showDatePicker = ref(false);
const pickerYear = ref(new Date().getFullYear());
const pickerMonth = ref(new Date().getMonth() + 1);
const pickerDay = ref(new Date().getDate());

const isToday = computed(() => currentDate.value === todayKey());

function goPrev() {
  currentDate.value = addDays(currentDate.value, -1);
  daily.loadDay(currentDate.value);
}
function goNext() {
  currentDate.value = addDays(currentDate.value, 1);
  daily.loadDay(currentDate.value);
}
function openDatePicker() {
  const [y, m, d] = currentDate.value.split('-').map(Number);
  pickerYear.value = y;
  pickerMonth.value = m;
  pickerDay.value = d;
  showDatePicker.value = true;
}
function jumpToToday() {
  const t = todayKey();
  const [y, m, d] = t.split('-').map(Number);
  pickerYear.value = y;
  pickerMonth.value = m;
  pickerDay.value = d;
}
function confirmDatePicker() {
  const daysInMonth = new Date(pickerYear.value, pickerMonth.value, 0).getDate();
  const day = Math.min(pickerDay.value, daysInMonth);
  const key = `${pickerYear.value}-${String(pickerMonth.value).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  currentDate.value = key;
  showDatePicker.value = false;
  daily.loadDay(key);
}
const pickerDaysInMonth = computed(() => new Date(pickerYear.value, pickerMonth.value, 0).getDate());

// 多选模式
const selecting = ref(false);
const selectedIds = ref<Set<string>>(new Set());
const longPressTimer = ref<number | null>(null);

// 复制/保存弹窗
const showCopyDialog = ref(false);
const copyDate = ref('');
const copyMeal = ref<MealType>('breakfast');
const showSaveRecipe = ref(false);
const recipeName = ref('');

onMounted(async () => {
  await foods.load();
  await recipeStore.load();
  settings.load();
  await daily.loadDay(currentDate.value);
});

const targets = computed(() => targetsFor(daily.log?.dayType ?? 'rest'));
const targetMuls = computed(() => ({
  carb: targets.value.carb / WEIGHT_KG,
  protein: targets.value.protein / WEIGHT_KG,
  fat: targets.value.fat / WEIGHT_KG
}));
const dayType = computed({
  get: () => daily.log?.dayType ?? 'rest',
  set: async (v) => { await daily.changeDayType(v); }
});

function targetOf(meal: MealType) {
  return mealTargetsFor(daily.log?.dayType ?? 'rest', meal, settings.ratios);
}

function openPicker(meal: MealType) {
  pickerMeal.value = meal;
  showPicker.value = true;
}

async function onPickFood(foodId: string, amount: number, meal: MealType) {
  await daily.addFoodEntry(foodId, amount, meal);
}
async function onPickFoods(items: { foodId: string; amount: number }[], meal: MealType) {
  for (const it of items) {
    if (it.amount <= 0) continue;
    await daily.addFoodEntry(it.foodId, it.amount, meal);
  }
}
function onEdit(e: Entry) {
  if (selecting.value) return;
  editing.value = e;
}

function onLongPress(e: Entry) {
  selecting.value = true;
  selectedIds.value = new Set([e.id]);
}
async function onSaveEdit(id: string, patch: { amount: number; mealType: MealType }) {
  await daily.updateEntry(id, patch);
  editing.value = null;
}
async function onRemoveEdit(id: string) {
  await daily.removeEntry(id);
  editing.value = null;
}

async function onPickRecipe(r: RecipeRow, meal: MealType) {
  let skipped = 0;
  for (const item of r.items) {
    const f = foods.byId(item.foodId);
    if (!f || f.deleted) { skipped++; continue; }
    await daily.addFoodEntry(item.foodId, item.amount, meal);
  }
  if (skipped > 0) toast.show(`跳过 ${skipped} 项已删除食物`, 'error');
}
async function onPickAdhoc(d: { name: string; spec: string; carb: number; protein: number; fat: number; amount: number; mealType: MealType }) {
  await daily.addAdhocEntry(d);
}

const editingFood = computed(() => {
  const e = editing.value;
  if (!e || e.kind !== 'food') return undefined;
  return foods.byId(e.foodId);
});

// 长按开始
function onPointerDown(id: string) {
  if (selecting.value) return;
  longPressTimer.value = window.setTimeout(() => {
    selecting.value = true;
    selectedIds.value = new Set([id]);
    longPressTimer.value = null;
    if (navigator.vibrate) navigator.vibrate(30);
  }, 400);
}
function onPointerUp() {
  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value);
    longPressTimer.value = null;
  }
}
function toggleSelect(id: string) {
  if (!selecting.value) return;
  const next = new Set(selectedIds.value);
  if (next.has(id)) next.delete(id); else next.add(id);
  selectedIds.value = next;
}
function cancelSelect() {
  selecting.value = false;
  selectedIds.value = new Set();
}

// 删除选中
async function deleteSelected() {
  if (!selectedIds.value.size) return;
  if (!confirm(`删除选中的 ${selectedIds.value.size} 条记录？`)) return;
  for (const id of selectedIds.value) {
    await daily.removeEntry(id);
  }
  toast.show(`已删除 ${selectedIds.value.size} 条`);
  cancelSelect();
}

// 复制到其他日期
const copyDates = computed(() => {
  const dates: { label: string; value: string }[] = [];
  const today = new Date();
  for (let i = -3; i <= 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const val = d.toISOString().split('T')[0];
    let label = `${d.getMonth() + 1}/${d.getDate()}`;
    if (i === 0) label = '今天';
    else if (i === -1) label = '昨天';
    else if (i === 1) label = '明天';
    else if (i === 2) label = '后天';
    dates.push({ label, value: val });
  }
  return dates;
});
function openCopyDialog() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  copyDate.value = tomorrow.toISOString().split('T')[0];
  copyMeal.value = 'breakfast';
  showCopyDialog.value = true;
}
async function confirmCopy() {
  if (!copyDate.value || !selectedIds.value.size) return;
  const entries = (daily.log?.entries ?? []).filter(e => selectedIds.value.has(e.id));
  for (const e of entries) {
    const { id, ...rest } = e;
    await addEntry(copyDate.value, { ...rest, mealType: copyMeal.value });
  }
  toast.show(`已复制 ${entries.length} 条到 ${copyDate.value}`);
  showCopyDialog.value = false;
  cancelSelect();
}

// 保存为食谱
function openSaveRecipe() {
  recipeName.value = '';
  showSaveRecipe.value = true;
}
async function confirmSaveRecipe() {
  if (!recipeName.value.trim() || !selectedIds.value.size) return;
  const entries = (daily.log?.entries ?? []).filter(e => selectedIds.value.has(e.id) && e.kind === 'food');
  if (!entries.length) { toast.show('请选择至少一个食物条目', 'error'); return; }
  const items = entries.map(e => ({ foodId: (e as any).foodId, amount: e.amount }));
  await recipeStore.add({ name: recipeName.value.trim(), items });
  toast.show('已保存为食谱');
  showSaveRecipe.value = false;
  cancelSelect();
}
</script>

<template>
  <div class="p-4 space-y-3 pb-24">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-1">
        <button class="w-8 h-8 flex items-center justify-center rounded-full active:bg-slate-100 text-slate-400" @click="goPrev">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <button class="text-sm text-slate-700 font-medium px-2 py-1 rounded-lg active:bg-slate-100" @click="openDatePicker">
          {{ daily.log ? friendlyDate(daily.log.date) : '' }}
        </button>
        <button class="w-8 h-8 flex items-center justify-center rounded-full active:bg-slate-100 text-slate-400" @click="goNext">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 18l6-6-6-6"/></svg>
        </button>
        <button v-if="!isToday" class="text-xs text-emerald-500 ml-1" @click="currentDate = todayKey(); daily.loadDay(currentDate)">今天</button>
      </div>
      <SegmentedControl v-if="!selecting" v-model="dayType" :options="[
        { value: 'training', label: '力训日' },
        { value: 'rest',     label: '休息日' }
      ]" />
      <span v-else class="text-xs text-slate-400">长按选择 · 点击切换</span>
    </div>

    <MetabolicDial v-if="!selecting" :totals="daily.totals" :targets="targets" :kcal="daily.kcal" :muls="daily.muls" :target-muls="targetMuls" />

    <!-- 非选中模式：使用 MealGroup -->
    <template v-if="!selecting">
      <MealGroup v-for="m in MEALS" :key="m.value"
        :label="m.label"
        :entries="daily.byMeal[m.value].entries"
        :totals="daily.byMeal[m.value].totals"
        :target="targetOf(m.value)"
        :food-by-id="foods.byId"
        @edit="onEdit"
        @add="openPicker(m.value)"
        @longpress="onLongPress" />

      <div v-if="daily.byMeal.unset.entries.length" class="rounded-2xl bg-white shadow-sm overflow-hidden">
        <div class="px-4 py-2 border-b border-slate-100 text-xs text-slate-500">未分类</div>
        <EntryRow v-for="e in daily.byMeal.unset.entries" :key="e.id"
          :entry="e" :food="e.kind === 'food' ? foods.byId(e.foodId) : undefined"
          @edit="onEdit" />
      </div>
    </template>

    <!-- 选中模式：自定义布局 -->
    <template v-else>
      <div v-for="m in MEALS" :key="m.value">
        <div v-if="daily.byMeal[m.value].entries.length" class="rounded-2xl bg-white shadow-sm overflow-hidden mb-3">
          <div class="px-4 py-2 text-xs text-slate-500 bg-slate-50">{{ m.label }}</div>
          <div v-for="e in daily.byMeal[m.value].entries" :key="e.id"
            :class="['flex items-center px-4 py-3 border-b border-slate-50 select-none cursor-pointer active:bg-slate-50']"
            @pointerdown="onPointerDown(e.id)" @pointerup="onPointerUp" @pointercancel="onPointerUp"
            @click="toggleSelect(e.id)">
            <span :class="['w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center mr-3',
              selectedIds.has(e.id) ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300']">
            <svg v-if="selectedIds.has(e.id)" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>
            </span>
            <EntryRow readonly :entry="e" :food="e.kind === 'food' ? foods.byId(e.foodId) : undefined"
              class="flex-1 !px-0 !border-0" />
          </div>
      </div>
    </div>

      <div v-if="daily.byMeal.unset.entries.length" class="rounded-2xl bg-white shadow-sm overflow-hidden">
        <div class="px-4 py-2 border-b border-slate-100 text-xs text-slate-500">未分类</div>
        <div v-for="e in daily.byMeal.unset.entries" :key="e.id"
          :class="['flex items-center px-4 py-3 border-b border-slate-50 select-none cursor-pointer active:bg-slate-50']"
          @pointerdown="onPointerDown(e.id)" @pointerup="onPointerUp" @pointercancel="onPointerUp"
          @click="toggleSelect(e.id)">
          <span :class="['w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center mr-3',
            selectedIds.has(e.id) ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300']">
            <svg v-if="selectedIds.has(e.id)" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>
          </span>
          <EntryRow readonly :entry="e" :food="e.kind === 'food' ? foods.byId(e.foodId) : undefined"
            class="flex-1 !px-0 !border-0" />
        </div>
      </div>
    </template>

    <button v-if="!selecting" class="fixed bottom-20 right-5 w-14 h-14 rounded-full bg-emerald-500 text-white text-3xl shadow-lg active:scale-95 transition"
      @click="openPicker('breakfast')">+</button>

    <!-- 底部操作栏 -->
    <div v-if="selecting"
      class="fixed bottom-[68px] left-0 right-0 bg-white border-t border-slate-200 p-3 flex items-center gap-2 z-40 shadow-lg">
      <button class="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-sm" @click="cancelSelect">取消</button>
      <span class="text-sm text-slate-500 flex-1 text-center">{{ selectedIds.size }} 项</span>
      <button :disabled="!selectedIds.size" :class="['px-3 py-1.5 rounded-lg text-sm', selectedIds.size ? 'bg-slate-100 text-slate-700' : 'bg-slate-50 text-slate-300']" @click="openCopyDialog">复制</button>
      <button :disabled="!selectedIds.size" :class="['px-3 py-1.5 rounded-lg text-sm', selectedIds.size ? 'bg-emerald-500 text-white' : 'bg-slate-50 text-slate-300']" @click="openSaveRecipe">食谱</button>
      <button :disabled="!selectedIds.size" :class="['px-3 py-1.5 rounded-lg text-sm', selectedIds.size ? 'bg-red-500 text-white' : 'bg-slate-50 text-slate-300']" @click="deleteSelected">删除</button>
    </div>

    <FoodPicker :open="showPicker" :default-meal="pickerMeal" @close="showPicker = false"
      @pick-food="onPickFood" @pick-foods="onPickFoods" @pick-recipe="onPickRecipe" @pick-adhoc="onPickAdhoc" />

    <EntryEditor :entry="editing" :food="editingFood"
      @close="editing = null" @save="onSaveEdit" @remove="onRemoveEdit" />

    <!-- 复制到日期 - 底部 sheet -->
    <div v-if="showCopyDialog" class="fixed inset-0 z-50 bg-black/40 flex items-end" @click.self="showCopyDialog = false">
      <div class="w-full bg-white rounded-t-2xl p-4 space-y-4 animate-slide-up">
        <div class="flex items-center justify-between">
          <span class="text-base font-semibold">复制到</span>
          <button class="text-sm text-slate-400" @click="showCopyDialog = false">取消</button>
        </div>
        <div>
          <div class="text-xs text-slate-400 mb-2">选择日期</div>
          <div class="flex flex-wrap gap-2">
            <button v-for="d in copyDates" :key="d.value" @click="copyDate = d.value"
              :class="['px-3 py-1.5 rounded-full text-xs transition',
                copyDate === d.value ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600']">
              {{ d.label }}
            </button>
          </div>
        </div>
        <div>
          <div class="text-xs text-slate-400 mb-2">选择餐次</div>
          <div class="flex gap-2">
            <button v-for="m in MEALS" :key="m.value" @click="copyMeal = m.value"
              :class="['px-4 py-2 rounded-full text-sm flex-1 transition',
                copyMeal === m.value ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600']">
              {{ m.label }}
            </button>
          </div>
        </div>
        <button class="w-full py-3 rounded-full bg-emerald-500 text-white text-sm font-medium" @click="confirmCopy">
          确认复制
        </button>
      </div>
    </div>

    <!-- 保存食谱弹窗 -->
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

    <!-- 日期选择器 -->
    <div v-if="showDatePicker" class="fixed inset-0 z-50 bg-black/40 flex items-end" @click.self="showDatePicker = false">
      <div class="w-full bg-white rounded-t-2xl p-4 space-y-3 animate-slide-up">
        <div class="flex items-center justify-between">
          <button class="text-sm text-slate-400" @click="showDatePicker = false">取消</button>
          <button class="text-sm text-emerald-500 font-medium" @click="jumpToToday">今天</button>
          <button class="text-sm text-emerald-600 font-medium" @click="confirmDatePicker">确定</button>
        </div>
        <div class="flex gap-2 h-48 overflow-hidden">
          <div class="flex-1 overflow-y-auto snap-y snap-mandatory text-center" ref="yearCol">
            <div v-for="y in 5" :key="2023 + y - 1"
              :class="['py-3 snap-center text-sm cursor-pointer rounded-lg transition',
                pickerYear === 2023 + y - 1 ? 'bg-emerald-50 text-emerald-600 font-semibold' : 'text-slate-500']"
              @click="pickerYear = 2023 + y - 1">{{ 2023 + y - 1 }}年</div>
          </div>
          <div class="flex-1 overflow-y-auto snap-y snap-mandatory text-center">
            <div v-for="m in 12" :key="m"
              :class="['py-3 snap-center text-sm cursor-pointer rounded-lg transition',
                pickerMonth === m ? 'bg-emerald-50 text-emerald-600 font-semibold' : 'text-slate-500']"
              @click="pickerMonth = m">{{ m }}月</div>
          </div>
          <div class="flex-1 overflow-y-auto snap-y snap-mandatory text-center">
            <div v-for="d in pickerDaysInMonth" :key="d"
              :class="['py-3 snap-center text-sm cursor-pointer rounded-lg transition',
                pickerDay === d ? 'bg-emerald-50 text-emerald-600 font-semibold' : 'text-slate-500']"
              @click="pickerDay = d">{{ d }}日</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
