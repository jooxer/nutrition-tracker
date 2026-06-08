<script setup lang="ts">
import { computed, ref } from 'vue';
import { useWeighingStore } from '@/stores/weighingStore';
import { useFoodStore } from '@/stores/foodStore';
import { useDailyStore } from '@/stores/dailyStore';
import { useToast } from '@/stores/toastStore';
import { MEALS, type MealType, MEAL_LABEL } from '@/constants/goals';
import { parseSpecGrams } from '@/lib/spec';
import type { FoodRow, WeighingItemRow } from '@/db/db';

const tray = useWeighingStore();
const foods = useFoodStore();
const daily = useDailyStore();
const toast = useToast();

const collapsed = ref(false);
const showAdd = ref(false);
const addQuery = ref('');
const addMeal = ref<MealType>('breakfast');
const addFoodId = ref<string>('');
const addBefore = ref<number | null>(null);

const editingId = ref<string | null>(null);
const editAfter = ref<number | null>(null);
const editBefore = ref<number | null>(null);
const editMeal = ref<MealType>('breakfast');

const liveFoods = computed(() => foods.foods.filter(f => !f.deleted));
const filtered = computed(() => {
  const q = addQuery.value.trim();
  if (!q) return liveFoods.value.slice(0, 30);
  return liveFoods.value.filter(f => f.name.includes(q)).slice(0, 30);
});

const hasItems = computed(() => tray.items.length > 0);
const summaryText = computed(() => {
  if (!hasItems.value) return '';
  const pending = tray.pendingCount;
  const ready = tray.readyCount;
  const parts: string[] = [];
  if (pending) parts.push(`${pending} 待称`);
  if (ready) parts.push(`${ready} 待入账`);
  return parts.join(' · ');
});

function foodOf(id: string): FoodRow | undefined {
  return foods.byId(id);
}

function consumed(it: WeighingItemRow): number {
  if (it.after == null) return 0;
  return Math.max(0, it.before - it.after);
}

function openAdd() {
  addQuery.value = '';
  addFoodId.value = '';
  addBefore.value = null;
  addMeal.value = currentMealGuess();
  showAdd.value = true;
}

function currentMealGuess(): MealType {
  const h = new Date().getHours();
  if (h < 10) return 'breakfast';
  if (h < 14) return 'lunch';
  if (h < 20) return 'dinner';
  return 'snack';
}

async function confirmAdd() {
  if (!addFoodId.value) { toast.show('请选择食物', 'error'); return; }
  if (!addBefore.value || addBefore.value <= 0) { toast.show('请输入餐前重量(g)', 'error'); return; }
  await tray.addItem({ foodId: addFoodId.value, mealType: addMeal.value, before: addBefore.value });
  showAdd.value = false;
  toast.show('已加入称重台');
}

function startEdit(it: WeighingItemRow) {
  editingId.value = it.id;
  editAfter.value = it.after;
  editBefore.value = it.before;
  editMeal.value = it.mealType;
}

async function saveEdit() {
  if (!editingId.value) return;
  if (editBefore.value == null || editBefore.value <= 0) { toast.show('餐前重量需大于 0', 'error'); return; }
  await tray.updateItem(editingId.value, {
    before: editBefore.value,
    after: editAfter.value,
    mealType: editMeal.value
  });
  editingId.value = null;
}

async function quickAfter(it: WeighingItemRow, value: number) {
  await tray.updateItem(it.id, { after: value });
}

async function finalize(it: WeighingItemRow) {
  const food = foodOf(it.foodId);
  if (!food) { toast.show('食物不存在', 'error'); return; }
  if (it.after == null) { toast.show('请先填写餐后重量', 'error'); return; }
  const grams = consumed(it);
  if (grams <= 0) { toast.show('餐后应小于餐前', 'error'); return; }
  const unitGrams = parseSpecGrams(food.spec);
  const amount = grams / unitGrams;
  await daily.addFoodEntry(it.foodId, amount, it.mealType);
  await tray.removeItem(it.id);
  toast.show(`已记入${MEAL_LABEL[it.mealType]} ${grams.toFixed(1)}g`);
}

async function removeOne(id: string) {
  if (!confirm('删除该称重项？餐前数据将丢失')) return;
  await tray.removeItem(id);
  if (editingId.value === id) editingId.value = null;
}
</script>

<template>
  <div class="rounded-2xl bg-white shadow-sm overflow-hidden">
    <div class="px-4 py-2.5 flex items-center gap-2 bg-slate-50">
      <button class="flex items-center gap-1.5 flex-1 text-left" @click="collapsed = !collapsed">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-slate-500">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="6" x2="12" y2="12"/>
          <line x1="12" y1="12" x2="16" y2="14"/>
        </svg>
        <span class="text-sm font-semibold text-slate-700">称重台</span>
        <span v-if="summaryText" class="text-xs text-slate-400">{{ summaryText }}</span>
        <svg :class="['w-4 h-4 ml-auto text-slate-400 transition-transform', collapsed ? '' : 'rotate-180']"
             viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      <button class="px-2.5 py-1 rounded-full bg-emerald-500 text-white text-xs flex items-center gap-1 active:scale-95" @click="openAdd">
        <span class="text-base leading-none">+</span><span>称重</span>
      </button>
    </div>

    <div v-if="!collapsed">
      <div v-if="!hasItems" class="px-4 py-4 text-xs text-slate-400 text-center">
        点击右上角「+ 称重」记录餐前重量；吃完后回来填餐后重量并入账。
      </div>

      <div v-for="it in tray.items" :key="it.id" class="px-4 py-2.5 border-t border-slate-100">
        <div v-if="editingId !== it.id" class="space-y-2">
          <div class="flex items-center gap-2">
            <span class="text-sm font-medium text-slate-700 truncate flex-1">
              {{ foodOf(it.foodId)?.name ?? '已删除' }}
              <span class="ml-1 text-[11px] text-slate-400">{{ MEAL_LABEL[it.mealType] }}</span>
            </span>
            <button class="text-xs text-slate-400 px-1.5 py-0.5" @click="startEdit(it)">编辑</button>
            <button class="text-xs text-red-400 px-1.5 py-0.5" @click="removeOne(it.id)">删</button>
          </div>
          <div class="flex items-center gap-2 text-xs">
            <div class="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-slate-50 flex-1">
              <span class="text-slate-400">餐前</span>
              <span class="font-semibold text-slate-700 tabular-nums">{{ it.before }}</span>
              <span class="text-slate-400">g</span>
            </div>
            <span class="text-slate-300">→</span>
            <div class="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-slate-50 flex-1">
              <span class="text-slate-400">餐后</span>
              <input
                :value="it.after ?? ''"
                @change="quickAfter(it, Number(($event.target as HTMLInputElement).value))"
                type="number" step="0.1" inputmode="decimal" placeholder="待填"
                class="w-16 bg-transparent font-semibold text-slate-700 tabular-nums outline-none" />
              <span class="text-slate-400">g</span>
            </div>
            <button v-if="it.after != null && consumed(it) > 0"
                    class="px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-medium active:scale-95"
                    @click="finalize(it)">
              入账
            </button>
            <button v-else disabled class="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-300 text-xs">入账</button>
          </div>
          <div v-if="it.after != null" class="text-[11px] text-slate-400 px-1">
            实际食用 <span class="text-emerald-600 font-medium tabular-nums">{{ consumed(it).toFixed(1) }}</span> g
          </div>
        </div>

        <div v-else class="space-y-2">
          <div class="text-sm font-medium text-slate-700">
            {{ foodOf(it.foodId)?.name ?? '已删除' }}
          </div>
          <div class="grid grid-cols-2 gap-2 text-xs">
            <label class="block">
              <span class="text-slate-400">餐前(g)</span>
              <input v-model.number="editBefore" type="number" step="0.1" inputmode="decimal"
                     class="mt-0.5 w-full px-2 py-1.5 rounded-lg bg-slate-100 tabular-nums" />
            </label>
            <label class="block">
              <span class="text-slate-400">餐后(g)</span>
              <input v-model.number="editAfter" type="number" step="0.1" inputmode="decimal"
                     class="mt-0.5 w-full px-2 py-1.5 rounded-lg bg-slate-100 tabular-nums" />
            </label>
          </div>
          <div class="flex gap-1.5 flex-wrap">
            <button v-for="m in MEALS" :key="m.value" @click="editMeal = m.value"
                    :class="['px-3 py-1 rounded-full text-xs',
                             editMeal === m.value ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500']">
              {{ m.label }}
            </button>
          </div>
          <div class="flex gap-2">
            <button class="flex-1 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs" @click="editingId = null">取消</button>
            <button class="flex-1 py-1.5 rounded-lg bg-emerald-500 text-white text-xs" @click="saveEdit">保存</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 新增称重项 sheet -->
    <div v-if="showAdd" class="fixed inset-0 z-50 bg-black/40 flex items-end" @click.self="showAdd = false">
      <div class="w-full bg-white rounded-t-2xl p-4 space-y-3 animate-slide-up max-h-[80vh] overflow-hidden flex flex-col">
        <div class="flex items-center justify-between">
          <span class="text-base font-semibold">添加称重</span>
          <button class="text-sm text-slate-400" @click="showAdd = false">取消</button>
        </div>
        <input v-model="addQuery" placeholder="搜索食物..."
               class="w-full px-3 py-2 rounded-lg bg-slate-100 text-sm" />
        <div class="flex-1 min-h-0 overflow-y-auto -mx-4 px-4">
          <div class="space-y-1">
            <button v-for="f in filtered" :key="f.id"
                    @click="addFoodId = f.id"
                    :class="['w-full text-left px-3 py-2 rounded-lg flex items-center justify-between',
                             addFoodId === f.id ? 'bg-emerald-50' : 'active:bg-slate-50']">
              <div class="min-w-0 flex-1">
                <div class="text-sm truncate">{{ f.name }}</div>
                <div class="text-[11px] text-slate-400 truncate">{{ f.spec }} · 碳{{ f.carb }} 蛋{{ f.protein }} 脂{{ f.fat }}</div>
              </div>
              <svg v-if="addFoodId === f.id" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-emerald-500">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </button>
            <div v-if="!filtered.length" class="text-center text-xs text-slate-400 py-4">没有匹配的食物</div>
          </div>
        </div>
        <div class="space-y-2 pt-2 border-t border-slate-100">
          <div>
            <div class="text-xs text-slate-400 mb-1">餐次</div>
            <div class="flex gap-1.5">
              <button v-for="m in MEALS" :key="m.value" @click="addMeal = m.value"
                      :class="['flex-1 py-1.5 rounded-full text-xs',
                               addMeal === m.value ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500']">
                {{ m.label }}
              </button>
            </div>
          </div>
          <label class="block">
            <div class="text-xs text-slate-400 mb-1">餐前重量 (g)</div>
            <input v-model.number="addBefore" type="number" step="0.1" inputmode="decimal" placeholder="例如 280.5"
                   class="w-full px-3 py-2 rounded-lg bg-slate-100 text-sm tabular-nums" />
          </label>
        </div>
        <button class="w-full py-2.5 rounded-full bg-emerald-500 text-white text-sm font-medium" @click="confirmAdd">
          加入称重台
        </button>
      </div>
    </div>
  </div>
</template>
