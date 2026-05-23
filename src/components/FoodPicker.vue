<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useFoodStore } from '@/stores/foodStore';
import { useRecipeStore } from '@/stores/recipeStore';
import { useCategoriesStore } from '@/stores/categoriesStore';
import type { FoodRow, RecipeRow } from '@/db/db';
import { MEALS, type MealType } from '@/constants/goals';

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
const tab = ref<'food' | 'recipe' | 'adhoc'>('food');
const query = ref('');
const meal = ref<MealType>(props.defaultMeal ?? 'breakfast');
const collapsed = ref<Set<string>>(new Set(cats.all));
const multi = ref(false);
const selected = ref<Map<string, number>>(new Map());
const stage = ref<'list' | 'amounts'>('list');

watch(() => props.open, (open) => {
  if (open) {
    meal.value = props.defaultMeal ?? meal.value;
    multi.value = false;
    selected.value = new Map();
    stage.value = 'list';
    picked.value = null;
    query.value = '';
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
  return [...map.entries()].filter(([, v]) => v.length > 0);
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
      </div>
      <div class="flex border-b border-slate-100">
        <button v-for="t in (['food','recipe','adhoc'] as const)" :key="t" @click="tab = t"
          :class="['py-3 flex-1 text-sm', tab === t ? 'text-emerald-600 font-semibold border-b-2 border-emerald-500' : 'text-slate-500']">
          {{ t === 'food' ? '食物' : t === 'recipe' ? '菜谱' : '临时项' }}
        </button>
      </div>

      <div v-if="tab === 'food'" class="flex-1 overflow-y-auto flex flex-col">
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
  </div>
</template>
