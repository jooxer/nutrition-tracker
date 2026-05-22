<script setup lang="ts">
import { reactive, watch } from 'vue';
import type { RecipeRow } from '@/db/db';
import { useFoodStore } from '@/stores/foodStore';

const props = defineProps<{ open: boolean; initial?: RecipeRow | null }>();
const emit = defineEmits<{ close: []; save: [data: { name: string; items: { foodId: string; amount: number }[] }] }>();
const foods = useFoodStore();

const form = reactive<{ name: string; items: { foodId: string; amount: number }[] }>({ name: '', items: [] });

watch(() => props.initial, v => {
  form.name = v?.name ?? '';
  form.items = v ? v.items.map(i => ({ ...i })) : [];
}, { immediate: true });

function addLine() { form.items.push({ foodId: '', amount: 1 }); }
function removeLine(i: number) { form.items.splice(i, 1); }
function save() {
  if (!form.name.trim()) return;
  const items = form.items.filter(i => i.foodId && i.amount > 0);
  emit('save', { name: form.name.trim(), items });
}
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-40 bg-black/40 flex items-center" @click.self="$emit('close')">
    <div class="m-4 w-full bg-white rounded-2xl p-4 max-h-[85vh] overflow-y-auto">
      <div class="text-lg font-semibold mb-3">{{ initial ? '编辑菜谱' : '新建菜谱' }}</div>
      <label class="block text-sm">名称<input v-model="form.name" class="mt-1 w-full px-3 py-2 rounded-lg bg-slate-100" /></label>
      <div class="mt-3 text-sm font-medium">组成项</div>
      <div v-for="(it, i) in form.items" :key="i" class="flex gap-2 mt-2">
        <select v-model="it.foodId" class="flex-1 px-3 py-2 rounded-lg bg-slate-100 text-sm">
          <option value="">选择食物...</option>
          <option v-for="f in foods.foods.filter(f => !f.deleted)" :key="f.id" :value="f.id">{{ f.name }}（{{ f.spec }}）</option>
        </select>
        <input v-model.number="it.amount" type="number" step="0.1" min="0" class="w-20 px-2 py-2 rounded-lg bg-slate-100 text-sm" />
        <button class="text-red-500 px-2" @click="removeLine(i)">✕</button>
      </div>
      <button class="mt-2 text-sm text-emerald-600" @click="addLine">+ 加一条</button>
      <div class="flex gap-2 mt-4">
        <button class="flex-1 py-2 rounded-full border border-slate-200 text-slate-600" @click="$emit('close')">取消</button>
        <button class="flex-1 py-2 rounded-full bg-emerald-500 text-white" @click="save">保存</button>
      </div>
    </div>
  </div>
</template>
