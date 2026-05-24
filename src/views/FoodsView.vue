<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useFoodStore } from '@/stores/foodStore';
import { useCategoriesStore } from '@/stores/categoriesStore';
import { useFoodOrderStore } from '@/stores/foodOrderStore';
import { useToast } from '@/stores/toastStore';
import type { FoodRow } from '@/db/db';
import FoodEditor from '@/components/FoodEditor.vue';

const foods = useFoodStore();
const cats = useCategoriesStore();
const order = useFoodOrderStore();
const toast = useToast();
const query = ref('');
const editorOpen = ref(false);
const editing = ref<FoodRow | null>(null);
const sorting = ref(false);

onMounted(() => foods.load());

const grouped = computed(() => {
  const q = query.value.trim();
  const live = foods.foods.filter(f => !f.deleted && (!q || f.name.includes(q)));
  const known = new Set(cats.all);
  const orderCats = [...cats.all];
  for (const f of live) if (!known.has(f.category)) { orderCats.push(f.category); known.add(f.category); }
  return orderCats
    .map(c => [c, order.sort(c, live.filter(f => f.category === c))] as const)
    .filter(([, l]) => l.length > 0);
});

function openNew() { editing.value = null; editorOpen.value = true; }
function openEdit(f: FoodRow) { editing.value = f; editorOpen.value = true; }
async function onSave(data: any) {
  if (editing.value) {
    await foods.update(editing.value.id, data); toast.show('已更新');
  } else {
    await foods.add(data); toast.show('已添加');
  }
  editorOpen.value = false;
}
async function onDelete(f: FoodRow) {
  if (!confirm(`删除「${f.name}」？`)) return;
  await foods.softDelete(f.id); toast.show('已删除（可在设置中恢复）');
}

function moveUp(cat: string, list: readonly FoodRow[], i: number) {
  if (i <= 0) return;
  order.move(cat, list.map(f => f.id), i, i - 1);
}
function moveDown(cat: string, list: readonly FoodRow[], i: number) {
  if (i >= list.length - 1) return;
  order.move(cat, list.map(f => f.id), i, i + 1);
}
function moveTop(cat: string, list: readonly FoodRow[], i: number) {
  if (i === 0) return;
  order.move(cat, list.map(f => f.id), i, 0);
}
function resetCat(cat: string) {
  if (!confirm(`恢复「${cat}」默认顺序？`)) return;
  order.reset(cat);
  toast.show('已恢复');
}

function catIndex(cat: string) {
  return cats.all.indexOf(cat);
}
function moveCat(cat: string, dir: 'up' | 'down' | 'top') {
  const list = cats.all;
  const i = list.indexOf(cat);
  if (i < 0) return;
  if (dir === 'up' && i > 0) cats.move(i, i - 1);
  else if (dir === 'down' && i < list.length - 1) cats.move(i, i + 1);
  else if (dir === 'top' && i > 0) cats.move(i, 0);
}
function resetAllCatOrder() {
  if (!confirm('恢复分类默认顺序？')) return;
  cats.resetOrder();
  toast.show('已恢复');
}
</script>

<template>
  <div class="p-4 space-y-3">
    <div class="flex gap-2">
      <input v-model="query" placeholder="搜索食物..." class="flex-1 px-3 py-2 rounded-lg bg-white shadow-sm text-sm" />
      <button :class="['px-3 py-2 rounded-lg text-sm flex-shrink-0',
                       sorting ? 'bg-emerald-500 text-white' : 'bg-white shadow-sm text-slate-600']"
              @click="sorting = !sorting">
        {{ sorting ? '完成' : '排序' }}
      </button>
    </div>
    <div v-if="sorting" class="flex items-center justify-between text-xs text-slate-400 px-1">
      <span>排序模式 · 分类与食物均可调整 · 搜索时不可排序</span>
      <button v-if="!query.trim()" class="text-emerald-600" @click="resetAllCatOrder">分类恢复默认</button>
    </div>

    <div v-for="[cat, list] in grouped" :key="cat" class="rounded-2xl bg-white shadow-sm overflow-hidden">
      <div class="px-4 py-2 text-xs text-slate-500 bg-slate-50 flex items-center gap-2">
        <span class="flex-1 truncate">{{ cat }}（{{ list.length }}）</span>
        <template v-if="sorting && !query.trim()">
          <div class="flex gap-1">
            <button class="w-7 h-7 rounded-md bg-white border border-slate-200 text-slate-600 disabled:opacity-30"
                    :disabled="catIndex(cat) === 0" @click="moveCat(cat, 'top')" aria-label="分类置顶">⤒</button>
            <button class="w-7 h-7 rounded-md bg-white border border-slate-200 text-slate-600 disabled:opacity-30"
                    :disabled="catIndex(cat) === 0" @click="moveCat(cat, 'up')" aria-label="分类上移">↑</button>
            <button class="w-7 h-7 rounded-md bg-white border border-slate-200 text-slate-600 disabled:opacity-30"
                    :disabled="catIndex(cat) === cats.all.length - 1" @click="moveCat(cat, 'down')" aria-label="分类下移">↓</button>
          </div>
          <button class="text-emerald-600 text-[11px] flex-shrink-0" @click="resetCat(cat)">食物默认</button>
        </template>
      </div>
      <div v-for="(f, i) in list" :key="f.id" class="flex items-center px-4 py-2 border-b border-slate-50">
        <div class="flex-1 min-w-0">
          <div class="text-sm truncate">
            {{ f.name }}<span v-if="!f.builtin" class="ml-2 text-xs text-emerald-600">自建</span>
          </div>
          <div class="text-xs text-slate-400 truncate">{{ f.spec }} · 碳{{ f.carb }} 蛋{{ f.protein }} 脂{{ f.fat }}</div>
        </div>
        <div v-if="sorting && !query.trim()" class="flex gap-1 flex-shrink-0">
          <button class="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 disabled:opacity-30"
                  :disabled="i === 0" @click="moveTop(cat, list, i)" aria-label="置顶">⤒</button>
          <button class="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 disabled:opacity-30"
                  :disabled="i === 0" @click="moveUp(cat, list, i)" aria-label="上移">↑</button>
          <button class="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 disabled:opacity-30"
                  :disabled="i === list.length - 1" @click="moveDown(cat, list, i)" aria-label="下移">↓</button>
        </div>
        <div v-else class="flex gap-2 flex-shrink-0">
          <button class="text-xs text-slate-500 px-2 py-1" @click="openEdit(f)">编辑</button>
          <button class="text-xs text-red-500 px-2 py-1" @click="onDelete(f)">删除</button>
        </div>
      </div>
    </div>

    <button v-if="!sorting" class="fixed bottom-20 right-5 w-14 h-14 rounded-full bg-emerald-500 text-white text-3xl shadow-lg" @click="openNew">+</button>
    <FoodEditor :open="editorOpen" :initial="editing" @close="editorOpen = false" @save="onSave" />
  </div>
</template>
