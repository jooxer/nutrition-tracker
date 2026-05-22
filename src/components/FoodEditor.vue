<script setup lang="ts">
import { reactive, watch } from 'vue';
import type { FoodRow } from '@/db/db';
import { CATEGORIES, type Category } from '@/constants/categories';

const props = defineProps<{ open: boolean; initial?: FoodRow | null }>();
const emit = defineEmits<{
  close: [];
  save: [data: { name: string; category: Category; spec: string; carb: number; protein: number; fat: number; note: string | null; builtin: boolean }];
}>();

const form = reactive({
  name: '', category: '其他' as Category, spec: '100g',
  carb: 0, protein: 0, fat: 0, note: '' as string
});

watch(() => props.initial, (v) => {
  if (v) Object.assign(form, { name: v.name, category: v.category, spec: v.spec, carb: v.carb, protein: v.protein, fat: v.fat, note: v.note ?? '' });
  else Object.assign(form, { name: '', category: '其他', spec: '100g', carb: 0, protein: 0, fat: 0, note: '' });
}, { immediate: true });

function save() {
  if (!form.name.trim()) return;
  emit('save', {
    name: form.name.trim(),
    category: form.category, spec: form.spec || '一份',
    carb: Number(form.carb) || 0, protein: Number(form.protein) || 0, fat: Number(form.fat) || 0,
    note: form.note.trim() ? form.note.trim() : null,
    builtin: props.initial?.builtin ?? false
  });
}
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-40 bg-black/40 flex items-center" @click.self="$emit('close')">
    <div class="m-4 w-full bg-white rounded-2xl p-4">
      <div class="text-lg font-semibold mb-3">{{ initial ? '编辑食物' : '新增食物' }}</div>
      <div class="space-y-2 text-sm">
        <label class="block">名称<input v-model="form.name" class="mt-1 w-full px-3 py-2 rounded-lg bg-slate-100" /></label>
        <label class="block">分类
          <select v-model="form.category" class="mt-1 w-full px-3 py-2 rounded-lg bg-slate-100">
            <option v-for="c in CATEGORIES" :key="c" :value="c">{{ c }}</option>
          </select>
        </label>
        <label class="block">规格<input v-model="form.spec" class="mt-1 w-full px-3 py-2 rounded-lg bg-slate-100" /></label>
        <div class="grid grid-cols-3 gap-2">
          <label class="block">碳水 (g)<input v-model.number="form.carb" type="number" step="0.1" class="mt-1 w-full px-3 py-2 rounded-lg bg-slate-100" /></label>
          <label class="block">蛋白质 (g)<input v-model.number="form.protein" type="number" step="0.1" class="mt-1 w-full px-3 py-2 rounded-lg bg-slate-100" /></label>
          <label class="block">脂肪 (g)<input v-model.number="form.fat" type="number" step="0.1" class="mt-1 w-full px-3 py-2 rounded-lg bg-slate-100" /></label>
        </div>
        <label class="block">备注<input v-model="form.note" class="mt-1 w-full px-3 py-2 rounded-lg bg-slate-100" /></label>
      </div>
      <div class="flex gap-2 mt-4">
        <button class="flex-1 py-2 rounded-full border border-slate-200 text-slate-600" @click="$emit('close')">取消</button>
        <button class="flex-1 py-2 rounded-full bg-emerald-500 text-white" @click="save">保存</button>
      </div>
    </div>
  </div>
</template>
