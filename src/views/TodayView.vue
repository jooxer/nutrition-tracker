<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useDailyStore } from '@/stores/dailyStore';
import { useFoodStore } from '@/stores/foodStore';
import { useRecipeStore } from '@/stores/recipeStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useToast } from '@/stores/toastStore';
import { todayKey, friendlyDate } from '@/lib/date';
import { WEIGHT_KG, targetsFor, MEALS, type MealType } from '@/constants/goals';
import { addEntry } from '@/db/logs';
import type { RecipeRow, Entry } from '@/db/db';
import MetabolicDial from '@/components/MetabolicDial.vue';
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
  await daily.loadDay(todayKey());
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
function onTouchStart(id: string) {
  if (selecting.value) return;
  longPressTimer.value = window.setTimeout(() => {
    selecting.value = true;
    selectedIds.value = new Set([id]);
    longPressTimer.value = null;
  }, 500);
}
function onTouchEnd() {
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
      <div class="text-sm">
        <span class="text-slate-700 font-medium">{{ daily.log ? friendlyDate(daily.log.date) : '' }}</span>
      </div>
      <div class="flex items-center gap-2">
        <button v-if="selecting" class="text-xs px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600" @click="cancelSelect">取消</button>
        <SegmentedControl v-if="!selecting" v-model="dayType" :options="[
          { value: 'training', label: '力训日' },
          { value: 'rest',     label: '休息日' }
        ]" />
      </div>
    </div>

    <MetabolicDial v-if="!selecting" :totals="daily.totals" :targets="targets" :kcal="daily.kcal" :muls="daily.muls" :target-muls="targetMuls" />

    <div v-for="m in MEALS" :key="m.value">
      <div v-if="daily.byMeal[m.value].entries.length" class="rounded-2xl bg-white shadow-sm overflow-hidden mb-3">
        <div class="px-4 py-2 text-xs text-slate-500 bg-slate-50 flex items-center justify-between">
          <span>{{ m.label }}</span>
          <button v-if="!selecting" class="text-emerald-600 text-lg" @click="openPicker(m.value)">+</button>
        </div>
        <div v-for="e in daily.byMeal[m.value].entries" :key="e.id"
          :class="['flex items-center px-4 py-3 border-b border-slate-50', selecting ? 'cursor-pointer' : '']"
          @touchstart="onTouchStart(e.id)" @touchend="onTouchEnd" @touchcancel="onTouchEnd"
          @click="selecting ? toggleSelect(e.id) : undefined">
          <span v-if="selecting" :class="['w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center mr-3',
            selectedIds.has(e.id) ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300']">
            <svg v-if="selectedIds.has(e.id)" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>
          </span>
          <EntryRow :entry="e" :food="e.kind === 'food' ? foods.byId(e.foodId) : undefined"
            @edit="onEdit" class="flex-1 !px-0 !border-0" />
        </div>
      </div>
    </div>

    <div v-if="daily.byMeal.unset.entries.length" class="rounded-2xl bg-white shadow-sm overflow-hidden">
      <div class="px-4 py-2 border-b border-slate-100 text-xs text-slate-500">未分类</div>
      <div v-for="e in daily.byMeal.unset.entries" :key="e.id"
        :class="['flex items-center px-4 py-3 border-b border-slate-50', selecting ? 'cursor-pointer' : '']"
        @touchstart="onTouchStart(e.id)" @touchend="onTouchEnd" @touchcancel="onTouchEnd"
        @click="selecting ? toggleSelect(e.id) : undefined">
        <span v-if="selecting" :class="['w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center mr-3',
          selectedIds.has(e.id) ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300']">
          <svg v-if="selectedIds.has(e.id)" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>
        </span>
        <EntryRow :entry="e" :food="e.kind === 'food' ? foods.byId(e.foodId) : undefined"
          @edit="onEdit" class="flex-1 !px-0 !border-0" />
      </div>
    </div>

    <button v-if="!selecting" class="fixed bottom-20 right-5 w-14 h-14 rounded-full bg-emerald-500 text-white text-3xl shadow-lg active:scale-95 transition"
      @click="openPicker('breakfast')">+</button>

    <!-- 底部操作栏 -->
    <div v-if="selecting && selectedIds.size > 0"
      class="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-3 flex items-center gap-2 z-30">
      <span class="text-sm text-slate-600 flex-1">已选 {{ selectedIds.size }} 项</span>
      <button class="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-sm" @click="openCopyDialog">复制到...</button>
      <button class="px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-sm" @click="openSaveRecipe">保存食谱</button>
      <button class="px-3 py-1.5 rounded-lg bg-red-500 text-white text-sm" @click="deleteSelected">删除</button>
    </div>

    <FoodPicker :open="showPicker" :default-meal="pickerMeal" @close="showPicker = false"
      @pick-food="onPickFood" @pick-foods="onPickFoods" @pick-recipe="onPickRecipe" @pick-adhoc="onPickAdhoc" />

    <EntryEditor :entry="editing" :food="editingFood"
      @close="editing = null" @save="onSaveEdit" @remove="onRemoveEdit" />

    <!-- 复制到日期弹窗 -->
    <div v-if="showCopyDialog" class="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" @click.self="showCopyDialog = false">
      <div class="bg-white rounded-2xl p-4 w-full max-w-sm space-y-3">
        <div class="text-base font-semibold">复制到日期</div>
        <input v-model="copyDate" type="date" class="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" />
        <div class="flex flex-wrap gap-1.5">
          <button v-for="m in MEALS" :key="m.value" @click="copyMeal = m.value"
            :class="['px-3 py-1 rounded-full text-xs', copyMeal === m.value ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500']">
            {{ m.label }}
          </button>
        </div>
        <div class="flex gap-2">
          <button class="flex-1 px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm" @click="showCopyDialog = false">取消</button>
          <button class="flex-1 px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm" @click="confirmCopy">确定</button>
        </div>
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
  </div>
</template>
