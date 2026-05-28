<script setup lang="ts">
import { computed, reactive, ref, watch, nextTick } from 'vue';
import { useFoodStore } from '@/stores/foodStore';
import { useRecipeStore } from '@/stores/recipeStore';
import { useCategoriesStore } from '@/stores/categoriesStore';
import { useFoodOrderStore } from '@/stores/foodOrderStore';
import { getRecentFoods, type RecentFood } from '@/lib/recentFoods';
import { lookupBarcode } from '@/lib/barcode';
import { ocrImage, parseNutritionText } from '@/lib/nutritionOcr';
import type { FoodRow, RecipeRow } from '@/db/db';
import { MEALS, type MealType } from '@/constants/goals';
import BarcodeScanner from './BarcodeScanner.vue';

const props = defineProps<{ open: boolean; defaultMeal?: MealType }>();
const emit = defineEmits<{
  close: [];
  pickFood: [foodId: string, amount: number, mealType: MealType];
  pickFoods: [items: { foodId: string; amount: number }[], mealType: MealType];
  pickRecipe: [recipe: RecipeRow, mealType: MealType];
  pickAdhoc: [data: { name: string; spec: string; carb: number; protein: number; fat: number; amount: number; mealType: MealType }];
}>();

const foods = useFoodStore();
const recipes = useRecipeStore();
const cats = useCategoriesStore();
const order = useFoodOrderStore();
const tab = ref<'recent' | 'food' | 'recipe' | 'adhoc'>('recent');
const query = ref('');
const meal = ref<MealType>(props.defaultMeal ?? 'breakfast');
const collapsed = ref<Set<string>>(new Set(cats.all));
const multi = ref(false);
const selected = ref<Map<string, number>>(new Map());
const stage = ref<'list' | 'amounts'>('list');

// 最近添加
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
const quickPicking = ref<string | null>(null);
const quickAmount = ref(1);
const quickAmountInput = ref<HTMLInputElement | null>(null);

watch(quickPicking, async (val) => {
  if (val) {
    await nextTick();
    quickAmountInput.value?.select();
  }
});

watch(() => props.open, async (open) => {
  if (open) {
    meal.value = props.defaultMeal ?? meal.value;
    multi.value = false;
    selected.value = new Map();
    stage.value = 'list';
    picked.value = null;
    query.value = '';
    tab.value = 'recent';
    recentList.value = await getRecentFoods();
  }
});

const liveFoods = computed(() => foods.foods.filter(f => !f.deleted));
const grouped = computed(() => {
  const q = query.value.trim();
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
const searching = computed(() => query.value.trim().length > 0);

function toggleCat(cat: string) {
  const next = new Set(collapsed.value);
  if (next.has(cat)) next.delete(cat); else next.add(cat);
  collapsed.value = next;
}
function expandAll() { collapsed.value = new Set(); }
function collapseAll() { collapsed.value = new Set(cats.all); }
function isCollapsed(cat: string) { return !searching.value && collapsed.value.has(cat); }

function toggleMulti() {
  multi.value = !multi.value;
  selected.value = new Map();
  picked.value = null;
}
function toggleSelect(f: FoodRow) {
  const next = new Map(selected.value);
  if (next.has(f.id)) next.delete(f.id); else next.set(f.id, 1);
  selected.value = next;
}
function isSelected(id: string) { return selected.value.has(id); }

const selectedFoods = computed(() =>
  [...selected.value.entries()].map(([id, amt]) => ({
    food: foods.byId(id),
    amount: amt
  })).filter(x => x.food)
);

function goAmounts() {
  if (selected.value.size === 0) return;
  stage.value = 'amounts';
}
function backToList() { stage.value = 'list'; }
function setAmt(id: string, v: number) {
  const next = new Map(selected.value);
  next.set(id, v);
  selected.value = next;
}
function submitMulti() {
  const items = [...selected.value.entries()].map(([foodId, amount]) => ({ foodId, amount }));
  emit('pickFoods', items, meal.value);
  selected.value = new Map();
  stage.value = 'list';
  emit('close');
}

const picked = ref<FoodRow | null>(null);
const amount = ref(1);
function pick(f: FoodRow) {
  if (multi.value) { toggleSelect(f); return; }
  picked.value = f; amount.value = 1;
}
function confirm() {
  if (!picked.value) return;
  emit('pickFood', picked.value.id, amount.value, meal.value);
  picked.value = null; query.value = ''; emit('close');
}
function confirmRecipe(r: RecipeRow) { emit('pickRecipe', r, meal.value); emit('close'); }

const adhoc = reactive({ name: '', spec: '一份', carb: 0, protein: 0, fat: 0, amount: 1 });
function confirmAdhoc() {
  if (!adhoc.name.trim()) return;
  emit('pickAdhoc', { ...adhoc, name: adhoc.name.trim(), spec: adhoc.spec || '一份', mealType: meal.value });
  Object.assign(adhoc, { name: '', spec: '一份', carb: 0, protein: 0, fat: 0, amount: 1 });
  emit('close');
}

function quickAdd(foodId: string) {
  quickPicking.value = foodId;
  quickAmount.value = 1;
}
function confirmQuickAdd() {
  if (!quickPicking.value) return;
  emit('pickFood', quickPicking.value, quickAmount.value, meal.value);
  quickPicking.value = null;
}

// 扫码 / 拍配料表
const showScanner = ref(false);
const scanLoading = ref(false);
const scanError = ref('');

async function onScanned(barcode: string) {
  showScanner.value = false;
  scanLoading.value = true;
  scanError.value = '';
  try {
    const result = await lookupBarcode(barcode);
    if (!result) {
      scanError.value = `未找到条码 ${barcode} 对应食品`;
      return;
    }
    tab.value = 'adhoc';
    Object.assign(adhoc, {
      name: result.name,
      spec: result.spec || '100g',
      carb: result.carb,
      protein: result.protein,
      fat: result.fat,
      amount: 1
    });
  } catch (e: any) {
    scanError.value = e?.message || '查询失败';
  } finally {
    scanLoading.value = false;
  }
}

async function onCaptured(imageDataUrl: string) {
  showScanner.value = false;
  scanLoading.value = true;
  scanError.value = '';
  try {
    const text = await ocrImage(imageDataUrl);
    const facts = parseNutritionText(text);
    if (!facts) {
      scanError.value = '未能识别营养成分，请手动输入';
      return;
    }
    tab.value = 'adhoc';
    Object.assign(adhoc, {
      name: '',
      spec: facts.per || '100g',
      carb: facts.carb,
      protein: facts.protein,
      fat: facts.fat,
      amount: 1
    });
  } catch (e: any) {
    scanError.value = e?.message || 'OCR 识别失败';
  } finally {
    scanLoading.value = false;
  }
}
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-40 bg-black/40 flex items-end" @click.self="$emit('close')">
    <div class="w-full bg-white rounded-t-2xl max-h-[85vh] flex flex-col">
      <div class="px-3 pt-3 pb-2 flex flex-wrap gap-1.5 border-b border-slate-100">
        <button v-for="m in MEALS" :key="m.value"
          @click="meal = m.value"
          :class="['px-3 py-1 rounded-full text-xs',
            meal === m.value ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500']">
          {{ m.label }}
        </button>
        <button class="ml-auto px-3 py-1 rounded-full text-xs bg-blue-50 text-blue-600 flex items-center gap-1"
          @click="showScanner = true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 7V5a2 2 0 012-2h2"/><path d="M17 3h2a2 2 0 012 2v2"/><path d="M21 17v2a2 2 0 01-2 2h-2"/><path d="M7 21H5a2 2 0 01-2-2v-2"/><line x1="7" y1="12" x2="17" y2="12"/></svg>
          扫码
        </button>
      </div>
      <div class="flex border-b border-slate-100">
        <button v-for="t in (['recent','food','recipe','adhoc'] as const)" :key="t" @click="tab = t"
          :class="['py-3 flex-1 text-sm', tab === t ? 'text-emerald-600 font-semibold border-b-2 border-emerald-500' : 'text-slate-500']">
          {{ t === 'recent' ? '最近' : t === 'food' ? '食物' : t === 'recipe' ? '菜谱' : '临时项' }}
        </button>
      </div>

      <!-- 最近添加 -->
      <div v-if="tab === 'recent'" class="flex-1 overflow-y-auto flex flex-col">
        <div class="px-3 py-2 flex items-center justify-between border-b border-slate-50">
          <span class="text-xs text-slate-400">按{{ recentSort === 'count' ? '添加次数' : '最新添加' }}排序</span>
          <button class="text-xs px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600"
            @click="recentSort = recentSort === 'count' ? 'latest' : 'count'">
            切换{{ recentSort === 'count' ? '最新' : '次数' }}
          </button>
        </div>
        <div v-if="!recentSorted.length" class="flex-1 flex items-center justify-center text-sm text-slate-400">暂无记录</div>
        <div v-else class="flex-1 overflow-y-auto">
          <div v-for="r in recentSorted" :key="r.foodId"
               class="flex items-center px-4 py-2.5 border-b border-slate-50 gap-3">
            <div class="flex-1 min-w-0">
              <div class="text-sm truncate">{{ foods.byId(r.foodId)?.name }}</div>
              <div class="text-xs text-slate-400 truncate">
                {{ foods.byId(r.foodId)?.spec }} · {{ r.count }}次
              </div>
            </div>
            <button class="w-8 h-8 rounded-full bg-emerald-500 text-white text-lg flex items-center justify-center flex-shrink-0 active:bg-emerald-600"
              @click="quickAdd(r.foodId)">+</button>
          </div>
        </div>
        <!-- 分量确认弹窗 -->
        <div v-if="quickPicking" class="absolute inset-0 bg-black/30 flex items-center justify-center z-10 rounded-t-2xl">
          <div class="bg-white rounded-2xl p-4 w-64 space-y-3 shadow-xl">
            <div class="text-sm font-medium truncate">{{ foods.byId(quickPicking)?.name }}</div>
            <div class="text-xs text-slate-400">{{ foods.byId(quickPicking)?.spec }}</div>
            <label class="block text-xs text-slate-500">分量倍数</label>
            <input ref="quickAmountInput" v-model.number="quickAmount" type="number" step="0.1" min="0"
              class="w-full px-3 py-2 rounded-lg bg-slate-100 text-base text-center" />
            <div class="flex gap-2">
              <button class="flex-1 py-2 rounded-full border border-slate-200 text-slate-600 text-sm" @click="quickPicking = null">取消</button>
              <button class="flex-1 py-2 rounded-full bg-emerald-500 text-white text-sm" @click="confirmQuickAdd">添加</button>
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="tab === 'food'" class="flex-1 overflow-y-auto flex flex-col">
        <!-- 多选: 分量编辑步骤 -->
        <template v-if="multi && stage === 'amounts'">
          <div class="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <button class="text-sm text-slate-500" @click="backToList">← 返回</button>
            <span class="text-xs text-slate-400">已选 {{ selected.size }} 项</span>
          </div>
          <div class="flex-1 overflow-y-auto">
            <div v-for="row in selectedFoods" :key="row.food!.id"
                 class="px-4 py-3 border-b border-slate-50 flex items-center gap-3">
              <div class="flex-1 min-w-0">
                <div class="text-sm truncate">{{ row.food!.name }}</div>
                <div class="text-xs text-slate-400">{{ row.food!.spec }}</div>
              </div>
              <button class="w-8 h-8 rounded-lg bg-slate-100 text-slate-600"
                      @click="setAmt(row.food!.id, Math.max(0, Math.round((row.amount - 0.5) * 10) / 10))">−</button>
              <input type="number" step="0.1" min="0"
                :value="row.amount"
                @input="setAmt(row.food!.id, Number(($event.target as HTMLInputElement).value))"
                class="w-16 px-2 py-1.5 rounded-lg bg-slate-100 text-center tabular-nums text-sm" />
              <button class="w-8 h-8 rounded-lg bg-slate-100 text-slate-600"
                      @click="setAmt(row.food!.id, Math.round((row.amount + 0.5) * 10) / 10)">+</button>
            </div>
          </div>
          <div class="p-3 border-t border-slate-100">
            <button class="w-full py-2.5 rounded-full bg-emerald-500 text-white" @click="submitMulti">
              添加 {{ selected.size }} 项到{{ MEALS.find(m => m.value === meal)?.label }}
            </button>
          </div>
        </template>

        <!-- 列表步骤 -->
        <template v-else>
          <div class="p-3 flex items-center gap-2">
            <input v-model="query" placeholder="搜索食物..." class="flex-1 px-3 py-2 rounded-lg bg-slate-100 text-sm" />
            <button v-if="!searching && !picked"
              class="text-xs px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-500 flex-shrink-0"
              @click="collapsed.size ? expandAll() : collapseAll()">
              {{ collapsed.size ? '全部展开' : '全部收起' }}
            </button>
            <button v-if="!picked"
              :class="['text-xs px-2.5 py-1.5 rounded-lg flex-shrink-0',
                       multi ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500']"
              @click="toggleMulti">
              {{ multi ? '退出多选' : '多选' }}
            </button>
          </div>
          <template v-if="!picked">
            <div class="flex-1 overflow-y-auto">
              <div v-for="[cat, list] in grouped" :key="cat">
                <button class="w-full px-4 py-2 flex items-center justify-between bg-slate-50 active:bg-slate-100 transition"
                  @click="toggleCat(cat)">
                  <span class="text-xs text-slate-500">{{ cat }}<span class="ml-1.5 text-slate-400">{{ list.length }}</span></span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
                    stroke-linecap="round" stroke-linejoin="round"
                    :class="['text-slate-400 transition-transform', isCollapsed(cat) ? '' : 'rotate-90']">
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </button>
                <div v-show="!isCollapsed(cat)">
                  <button v-for="f in list" :key="f.id"
                    :class="['flex w-full text-left px-4 py-2 border-b border-slate-50 active:bg-slate-50 items-center gap-3',
                             multi && isSelected(f.id) ? 'bg-emerald-50' : '']"
                    @click="pick(f)">
                    <span v-if="multi"
                      :class="['w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center',
                               isSelected(f.id) ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300']">
                      <svg v-if="isSelected(f.id)" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>
                    </span>
                    <span class="flex-1 min-w-0">
                      <span class="block text-sm truncate">{{ f.name }}</span>
                      <span class="block text-xs text-slate-400">{{ f.spec }} · 碳{{ f.carb }} 蛋{{ f.protein }} 脂{{ f.fat }}</span>
                    </span>
                  </button>
                </div>
              </div>
            </div>
            <div v-if="multi && selected.size > 0" class="p-3 border-t border-slate-100 flex items-center gap-2">
              <span class="flex-1 text-xs text-slate-500">已选 <b class="text-slate-700">{{ selected.size }}</b> 项</span>
              <button class="px-4 py-2 rounded-full bg-emerald-500 text-white text-sm" @click="goAmounts">下一步 →</button>
            </div>
          </template>
          <div v-else class="p-4">
            <div class="text-sm">已选：<b>{{ picked.name }}</b></div>
            <div class="text-xs text-slate-500 mb-3">{{ picked.spec }} · 碳{{ picked.carb }} 蛋{{ picked.protein }} 脂{{ picked.fat }}</div>
            <label class="block text-xs text-slate-500 mb-1">分量倍数</label>
            <input v-model.number="amount" type="number" step="0.1" min="0" class="w-full px-3 py-2 rounded-lg bg-slate-100 text-base" />
            <div class="flex gap-2 mt-3">
              <button class="flex-1 py-2 rounded-full border border-slate-200 text-slate-600" @click="picked = null">返回</button>
              <button class="flex-1 py-2 rounded-full bg-emerald-500 text-white" @click="confirm">添加</button>
            </div>
          </div>
        </template>
      </div>

      <div v-else-if="tab === 'recipe'" class="flex-1 overflow-y-auto p-3 space-y-2">
        <div v-if="!recipes.recipes.length" class="text-center text-slate-400 text-sm py-8">没有菜谱</div>
        <button v-for="r in recipes.recipes" :key="r.id" class="w-full text-left bg-slate-50 rounded-xl p-3" @click="confirmRecipe(r)">
          <div class="font-medium text-sm">{{ r.name }}</div>
          <div class="text-xs text-slate-500">{{ r.items.length }} 项</div>
        </button>
      </div>

      <div v-else class="flex-1 overflow-y-auto p-3 space-y-2">
        <label class="block text-sm">名称<input v-model="adhoc.name" class="mt-1 w-full px-3 py-2 rounded-lg bg-slate-100" /></label>
        <label class="block text-sm">规格<input v-model="adhoc.spec" class="mt-1 w-full px-3 py-2 rounded-lg bg-slate-100" placeholder="一份" /></label>
        <div class="grid grid-cols-3 gap-2 text-sm">
          <label>碳水<input v-model.number="adhoc.carb" type="number" step="0.1" class="mt-1 w-full px-3 py-2 rounded-lg bg-slate-100" /></label>
          <label>蛋白质<input v-model.number="adhoc.protein" type="number" step="0.1" class="mt-1 w-full px-3 py-2 rounded-lg bg-slate-100" /></label>
          <label>脂肪<input v-model.number="adhoc.fat" type="number" step="0.1" class="mt-1 w-full px-3 py-2 rounded-lg bg-slate-100" /></label>
        </div>
        <label class="block text-sm">分量<input v-model.number="adhoc.amount" type="number" step="0.1" min="0" class="mt-1 w-full px-3 py-2 rounded-lg bg-slate-100" /></label>
        <button class="w-full py-2 mt-2 rounded-full bg-emerald-500 text-white" @click="confirmAdhoc">添加</button>
      </div>

      <button class="py-3 text-slate-500 border-t border-slate-100" @click="$emit('close')">关闭</button>
    </div>

    <!-- 扫码加载中 -->
    <div v-if="scanLoading" class="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center">
      <div class="bg-white rounded-2xl p-6 flex flex-col items-center gap-3">
        <div class="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <span class="text-sm text-slate-600">识别中...</span>
      </div>
    </div>

    <!-- 扫码错误 -->
    <div v-if="scanError" class="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4" @click.self="scanError = ''">
      <div class="bg-white rounded-2xl p-4 w-full max-w-xs space-y-3">
        <div class="text-sm text-red-600">{{ scanError }}</div>
        <button class="w-full py-2 rounded-full bg-slate-100 text-slate-700 text-sm" @click="scanError = ''">关闭</button>
      </div>
    </div>

    <BarcodeScanner :open="showScanner" @close="showScanner = false" @scanned="onScanned" @captured="onCaptured" />
  </div>
</template>
