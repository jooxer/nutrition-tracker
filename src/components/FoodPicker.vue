<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useFoodStore } from '@/stores/foodStore';
import { useRecipeStore } from '@/stores/recipeStore';
import type { FoodRow, RecipeRow } from '@/db/db';
import { CATEGORIES } from '@/constants/categories';
import { MEALS, type MealType } from '@/constants/goals';

const props = defineProps<{ open: boolean; defaultMeal?: MealType }>();
const emit = defineEmits<{
  close: [];
  pickFood: [foodId: string, amount: number, mealType: MealType];
  pickRecipe: [recipe: RecipeRow, mealType: MealType];
  pickAdhoc: [data: { name: string; spec: string; carb: number; protein: number; fat: number; amount: number; mealType: MealType }];
}>();

const foods = useFoodStore();
const recipes = useRecipeStore();
const tab = ref<'food' | 'recipe' | 'adhoc'>('food');
const query = ref('');
const meal = ref<MealType>(props.defaultMeal ?? 'breakfast');

watch(() => props.open, (open) => {
  if (open) meal.value = props.defaultMeal ?? meal.value;
});

const liveFoods = computed(() => foods.foods.filter(f => !f.deleted));
const grouped = computed(() => {
  const q = query.value.trim();
  const filtered = q ? liveFoods.value.filter(f => f.name.includes(q)) : liveFoods.value;
  const map = new Map<string, FoodRow[]>();
  for (const cat of CATEGORIES) map.set(cat, []);
  for (const f of filtered) (map.get(f.category) ?? map.get('其他')!).push(f);
  return [...map.entries()].filter(([, v]) => v.length > 0);
});

const picked = ref<FoodRow | null>(null);
const amount = ref(1);
function pick(f: FoodRow) { picked.value = f; amount.value = 1; }
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

      <div v-if="tab === 'food'" class="flex-1 overflow-y-auto">
        <div class="p-3"><input v-model="query" placeholder="搜索食物..." class="w-full px-3 py-2 rounded-lg bg-slate-100 text-sm" /></div>
        <template v-if="!picked">
          <div v-for="[cat, list] in grouped" :key="cat">
            <div class="px-4 py-1 text-xs text-slate-500 bg-slate-50">{{ cat }}</div>
            <button v-for="f in list" :key="f.id" class="block w-full text-left px-4 py-2 border-b border-slate-50" @click="pick(f)">
              <div class="text-sm">{{ f.name }}</div>
              <div class="text-xs text-slate-400">{{ f.spec }} · 碳{{ f.carb }} 蛋{{ f.protein }} 脂{{ f.fat }}</div>
            </button>
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
