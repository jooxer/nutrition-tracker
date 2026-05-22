<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRecipeStore } from '@/stores/recipeStore';
import { useFoodStore } from '@/stores/foodStore';
import { useToast } from '@/stores/toastStore';
import type { RecipeRow } from '@/db/db';
import RecipeEditor from '@/components/RecipeEditor.vue';

const recipes = useRecipeStore();
const foods = useFoodStore();
const toast = useToast();
const open = ref(false);
const editing = ref<RecipeRow | null>(null);

onMounted(async () => { await foods.load(); await recipes.load(); });

function openNew() { editing.value = null; open.value = true; }
function openEdit(r: RecipeRow) { editing.value = r; open.value = true; }
async function onSave(data: any) {
  if (editing.value) { await recipes.update(editing.value.id, data); toast.show('已更新'); }
  else { await recipes.add(data); toast.show('已添加'); }
  open.value = false;
}
async function onDelete(r: RecipeRow) {
  if (!confirm(`删除菜谱「${r.name}」？`)) return;
  await recipes.remove(r.id); toast.show('已删除');
}
function preview(r: RecipeRow) {
  return r.items.map(i => foods.byId(i.foodId)?.name ?? '?').join(' / ');
}
</script>

<template>
  <div class="p-4 space-y-3">
    <div v-if="!recipes.recipes.length" class="text-center text-slate-400 text-sm py-8">还没有菜谱</div>
    <div v-for="r in recipes.recipes" :key="r.id" class="rounded-2xl bg-white shadow-sm p-4">
      <div class="flex justify-between items-start">
        <div class="flex-1">
          <div class="font-semibold">{{ r.name }}</div>
          <div class="text-xs text-slate-500 mt-1">{{ preview(r) || '（空）' }}</div>
        </div>
        <div class="flex gap-2 flex-shrink-0">
          <button class="text-xs text-slate-500 px-2" @click="openEdit(r)">编辑</button>
          <button class="text-xs text-red-500 px-2" @click="onDelete(r)">删除</button>
        </div>
      </div>
    </div>
    <button class="fixed bottom-20 right-5 w-14 h-14 rounded-full bg-emerald-500 text-white text-3xl shadow-lg" @click="openNew">+</button>
    <RecipeEditor :open="open" :initial="editing" @close="open = false" @save="onSave" />
  </div>
</template>
