<script setup lang="ts">
import { computed, ref } from 'vue';
import { useWeighingStore } from '@/stores/weighingStore';
import { useFoodStore } from '@/stores/foodStore';
import { useCategoriesStore } from '@/stores/categoriesStore';
import { useFoodOrderStore } from '@/stores/foodOrderStore';
import { useDailyStore } from '@/stores/dailyStore';
import { useToast } from '@/stores/toastStore';
import { getRecentFoods, type RecentFood } from '@/lib/recentFoods';
import { MEALS, type MealType, MEAL_LABEL } from '@/constants/goals';
import { parseSpecGrams } from '@/lib/spec';
import type { FoodRow, WeighingItemRow } from '@/db/db';

const tray = useWeighingStore();
const foods = useFoodStore();
const cats = useCategoriesStore();
const order = useFoodOrderStore();
const daily = useDailyStore();
const toast = useToast();

const collapsed = ref(false);
const showAdd = ref(false);
const addTab = ref<'recent' | 'food'>('recent');
const addQuery = ref('');
const addMeal = ref<MealType>('breakfast');
const addFoodId = ref<string>('');
const addBefore = ref<number | null>(null);

const editingId = ref<string | null>(null);
const editAfter = ref<number | null>(null);
const editBefore = ref<number | null>(null);
const editMeal = ref<MealType>('breakfast');

// 最近食物
const recentList = ref<RecentFood[]>([]);
const recentSort = ref<'count' | 'latest'>('count');
const recentSorted = computed(() => {
  const list = [...recentList.value];
  if (recentSort.value === 'count') list.sort((a, b) => b.count - a.count);
  else list.sort((a, b) => b.lastUsed.localeCompare(a.lastUsed));
  return list.filter(r => {
    const f = foods.byId(r.foodId);
    return f && !f.deleted;
  });
});

// 食物列表（分类分组）
const liveFoods = computed(() => foods.foods.filter(f => !f.deleted));
const catCollapsed = ref<Set<string>>(new Set(cats.all));
const searching = computed(() => addQuery.value.trim().length > 0);
const grouped = computed(() => {
  const q = addQuery.value.trim();
  const filtered = q ? liveFoods.value.filter(f => f.name.includes(q)) : liveFoods.value;
  const map = new Map<string, FoodRow[]>();
  for (const cat of cats.all) map.set(cat, []);
  for (const f of filtered) {
    if (!map.has(f.category)) map.set(f.category, []);
    map.get(f.category)!.push(f);
  }
  return [...map.entries()]
    .filter(([, v]) => v.length > 0)
    .map(([cat, list]) => [cat, order.sort(cat, list)] as const);
});

function toggleCat(cat: string) {
  const next = new Set(catCollapsed.value);
  if (next.has(cat)) next.delete(cat); else next.add(cat);
  catCollapsed.value = next;
}
function isCatCollapsed(cat: string) { return !searching.value && catCollapsed.value.has(cat); }
function expandAll() { catCollapsed.value = new Set(); }
function collapseAll() { catCollapsed.value = new Set(cats.all); }

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

async function openAdd() {
  addQuery.value = '';
  addFoodId.value = '';
  addBefore.value = null;
  addMeal.value = currentMealGuess();
  addTab.value = 'recent';
  recentList.value = await getRecentFoods();
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
      <div class="w-full bg-white rounded-t-2xl animate-slide-up max-h-[80vh] overflow-hidden flex flex-col">
        <div class="flex items-center justify-between px-4 pt-4 pb-2">
          <span class="text-base font-semibold">添加称重</span>
          <button class="text-sm text-slate-400" @click="showAdd = false">取消</button>
        </div>

        <div class="flex border-b border-slate-100">
          <button @click="addTab = 'recent'"
            :class="['py-2.5 flex-1 text-sm', addTab === 'recent' ? 'text-emerald-600 font-semibold border-b-2 border-emerald-500' : 'text-slate-500']">最近</button>
          <button @click="addTab = 'food'"
            :class="['py-2.5 flex-1 text-sm', addTab === 'food' ? 'text-emerald-600 font-semibold border-b-2 border-emerald-500' : 'text-slate-500']">食物</button>
        </div>

        <!-- 最近 tab -->
        <div v-if="addTab === 'recent'" class="flex-1 min-h-0 overflow-y-auto">
          <div class="px-3 py-2 flex items-center justify-between border-b border-slate-50">
            <span class="text-xs text-slate-400">按{{ recentSort === 'count' ? '添加次数' : '最新添加' }}排序</span>
            <button class="text-xs px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600"
              @click="recentSort = recentSort === 'count' ? 'latest' : 'count'">
              切换{{ recentSort === 'count' ? '最新' : '次数' }}
            </button>
          </div>
          <div v-if="!recentSorted.length" class="flex items-center justify-center text-sm text-slate-400 py-8">暂无记录</div>
          <div v-else>
            <button v-for="r in recentSorted" :key="r.foodId"
              @click="addFoodId = r.foodId"
              :class="['flex w-full text-left items-center px-4 py-2.5 border-b border-slate-50 gap-3',
                       addFoodId === r.foodId ? 'bg-emerald-50' : 'active:bg-slate-50']">
              <span class="flex-1 min-w-0">
                <span class="block text-sm truncate">{{ foods.byId(r.foodId)?.name }}</span>
                <span class="block text-xs text-slate-400 truncate">{{ foods.byId(r.foodId)?.spec }} · {{ r.count }}次</span>
              </span>
              <svg v-if="addFoodId === r.foodId" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-emerald-500 flex-shrink-0">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- 食物 tab -->
        <div v-else class="flex-1 min-h-0 overflow-y-auto flex flex-col">
          <div class="p-3 flex items-center gap-2">
            <input v-model="addQuery" placeholder="搜索食物..." class="flex-1 px-3 py-2 rounded-lg bg-slate-100 text-sm" />
            <button v-if="!searching"
              class="text-xs px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-500 flex-shrink-0"
              @click="catCollapsed.size ? expandAll() : collapseAll()">
              {{ catCollapsed.size ? '全部展开' : '全部收起' }}
            </button>
          </div>
          <div class="flex-1 overflow-y-auto">
            <div v-for="[cat, list] in grouped" :key="cat">
              <button class="w-full px-4 py-2 flex items-center justify-between bg-slate-50 active:bg-slate-100 transition"
                @click="toggleCat(cat)">
                <span class="text-xs text-slate-500">{{ cat }}<span class="ml-1.5 text-slate-400">{{ list.length }}</span></span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
                  stroke-linecap="round" stroke-linejoin="round"
                  :class="['text-slate-400 transition-transform', isCatCollapsed(cat) ? '' : 'rotate-90']">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </button>
              <div v-show="!isCatCollapsed(cat)">
                <button v-for="f in list" :key="f.id"
                  @click="addFoodId = f.id"
                  :class="['flex w-full text-left px-4 py-2 border-b border-slate-50 active:bg-slate-50 items-center gap-3',
                           addFoodId === f.id ? 'bg-emerald-50' : '']">
                  <span class="flex-1 min-w-0">
                    <span class="block text-sm truncate">{{ f.name }}</span>
                    <span class="block text-xs text-slate-400">{{ f.spec }} · 碳{{ f.carb }} 蛋{{ f.protein }} 脂{{ f.fat }}</span>
                  </span>
                  <svg v-if="addFoodId === f.id" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-emerald-500 flex-shrink-0">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 底部表单 -->
        <div class="p-4 space-y-2 border-t border-slate-100">
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
          <button class="w-full py-2.5 rounded-full bg-emerald-500 text-white text-sm font-medium" @click="confirmAdd">
            加入称重台
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
