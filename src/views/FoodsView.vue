<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useFoodStore } from '@/stores/foodStore';
import { useCategoriesStore } from '@/stores/categoriesStore';
import { useToast } from '@/stores/toastStore';
import type { FoodRow } from '@/db/db';
import FoodEditor from '@/components/FoodEditor.vue';

const foods = useFoodStore();
const cats = useCategoriesStore();
const toast = useToast();
const query = ref('');
const editorOpen = ref(false);
const editing = ref<FoodRow | null>(null);

onMounted(() => foods.load());

const grouped = computed(() => {
  const q = query.value.trim();
  const live = foods.foods.filter(f => !f.deleted && (!q || f.name.includes(q)));
  const known = new Set(cats.all);
  const order = [...cats.all];
  for (const f of live) if (!known.has(f.category)) { order.push(f.category); known.add(f.category); }
  return order.map(c => [c, live.filter(f => f.category === c)] as const).filter(([, l]) => l.length > 0);
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
</script>

<template>
  <div class="p-4 space-y-3">
    <input v-model="query" placeholder="搜索食物..." class="w-full px-3 py-2 rounded-lg bg-white shadow-sm text-sm" />
    <div v-for="[cat, list] in grouped" :key="cat" class="rounded-2xl bg-white shadow-sm overflow-hidden">
      <div class="px-4 py-2 text-xs text-slate-500 bg-slate-50">{{ cat }}（{{ list.length }}）</div>
      <div v-for="f in list" :key="f.id" class="flex items-center justify-between px-4 py-2 border-b border-slate-50">
        <div class="flex-1">
          <div class="text-sm">{{ f.name }}<span v-if="!f.builtin" class="ml-2 text-xs text-emerald-600">自建</span></div>
          <div class="text-xs text-slate-400">{{ f.spec }} · 碳{{ f.carb }} 蛋{{ f.protein }} 脂{{ f.fat }}</div>
        </div>
        <div class="flex gap-2">
          <button class="text-xs text-slate-500 px-2 py-1" @click="openEdit(f)">编辑</button>
          <button class="text-xs text-red-500 px-2 py-1" @click="onDelete(f)">删除</button>
        </div>
      </div>
    </div>
    <button class="fixed bottom-20 right-5 w-14 h-14 rounded-full bg-emerald-500 text-white text-3xl shadow-lg" @click="openNew">+</button>
    <FoodEditor :open="editorOpen" :initial="editing" @close="editorOpen = false" @save="onSave" />
  </div>
</template>