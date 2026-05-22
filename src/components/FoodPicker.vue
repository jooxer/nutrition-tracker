<script setup lang="ts">
import { computed, ref } from 'vue';
import { useFoodStore } from '@/stores/foodStore';
import type { FoodRow } from '@/db/db';
import { CATEGORIES } from '@/constants/categories';

defineProps<{ open: boolean }>();
const emit = defineEmits<{
  close: [];
  pickFood: [foodId: string, amount: number];
}>();

const foods = useFoodStore();
const tab = ref<'food' | 'recipe' | 'adhoc'>('food');
const query = ref('');

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
  emit('pickFood', picked.value.id, amount.value);
  picked.value = null; query.value = ''; emit('close');
}
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-40 bg-black/40 flex items-end" @click.self="$emit('close')">
    <div class="w-full bg-white rounded-t-2xl max-h-[85vh] flex flex-col">
      <div class="flex justify-around border-b border-slate-100">
        <button v-for="t in (['food','recipe','adhoc'] as const)" :key="t"
          @click="tab = t"
          :class="['py-3 flex-1 text-sm', tab === t ? 'text-emerald-600 font-semibold border-b-2 border-emerald-500' : 'text-slate-500']">
          {{ t === 'food' ? '食物' : t === 'recipe' ? '菜谱' : '临时项' }}
        </button>
      </div>

      <div v-if="tab === 'food'" class="flex-1 overflow-y-auto">
        <div class="p-3"><input v-model="query" placeholder="搜索食物..." class="w-full px-3 py-2 rounded-lg bg-slate-100 text-sm" /></div>
        <template v-if="!picked">
          <div v-for="[cat, list] in grouped" :key="cat">
            <div class="px-4 py-1 text-xs text-slate-500 bg-slate-50">{{ cat }}</div>
            <button v-for="f in list" :key="f.id"
              class="block w-full text-left px-4 py-2 border-b border-slate-50"
              @click="pick(f)">
              <div class="text-sm">{{ f.name }}</div>
              <div class="text-xs text-slate-400">{{ f.spec }} · 碳{{ f.carb }} 蛋{{ f.protein }} 脂{{ f.fat }}</div>
            </button>
          </div>
        </template>
        <div v-else class="p-4">
          <div class="text-sm">已选：<b>{{ picked.name }}</b></div>
          <div class="text-xs text-slate-500 mb-3">单份：碳{{ picked.carb }} 蛋{{ picked.protein }} 脂{{ picked.fat }}（{{ picked.spec }}）</div>
          <label class="block text-xs text-slate-500 mb-1">分量倍数</label>
          <input v-model.number="amount" type="number" step="0.1" min="0" class="w-full px-3 py-2 rounded-lg bg-slate-100 text-base" />
          <div class="flex gap-2 mt-3">
            <button class="flex-1 py-2 rounded-full border border-slate-200 text-slate-600" @click="picked = null">返回</button>
            <button class="flex-1 py-2 rounded-full bg-emerald-500 text-white" @click="confirm">添加</button>
          </div>
        </div>
      </div>

      <div v-else class="flex-1 flex items-center justify-center text-slate-400 text-sm">（后续任务实现）</div>

      <button class="py-3 text-slate-500 border-t border-slate-100" @click="$emit('close')">取消</button>
    </div>
  </div>
</template>
