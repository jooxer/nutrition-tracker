<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import type { FoodRow } from '@/db/db';
import { type Category } from '@/constants/categories';
import { useCategoriesStore } from '@/stores/categoriesStore';
import { useToast } from '@/stores/toastStore';

const NEW_TOKEN = '__new__';

const props = defineProps<{ open: boolean; initial?: FoodRow | null }>();
const emit = defineEmits<{
  close: [];
  save: [data: { name: string; category: Category; spec: string; carb: number; protein: number; fat: number; note: string | null; builtin: boolean }];
}>();

const cats = useCategoriesStore();
const toast = useToast();

const form = reactive({
  name: '', category: '其他' as Category, spec: '100g',
  carb: 0, protein: 0, fat: 0, note: '' as string
});
const adding = ref(false);
const newCatName = ref('');

watch(() => props.initial, (v) => {
  if (v) Object.assign(form, { name: v.name, category: v.category, spec: v.spec, carb: v.carb, protein: v.protein, fat: v.fat, note: v.note ?? '' });
  else Object.assign(form, { name: '', category: '其他', spec: '100g', carb: 0, protein: 0, fat: 0, note: '' });
  adding.value = false;
  newCatName.value = '';
}, { immediate: true });

function onCategoryChange(v: string) {
  if (v === NEW_TOKEN) {
    adding.value = true;
    newCatName.value = '';
  } else {
    form.category = v;
  }
}

function confirmNewCategory() {
  const name = newCatName.value.trim();
  if (!name) { adding.value = false; return; }
  if (cats.addCustom(name) || cats.all.includes(name)) {
    form.category = name;
    adding.value = false;
    newCatName.value = '';
  } else {
    toast.show('分类已存在', 'error');
  }
}

function cancelNewCategory() {
  adding.value = false;
  newCatName.value = '';
}

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
        <div class="block">
          <span>分类</span>
          <div v-if="!adding" class="mt-1 flex gap-2">
            <select :value="form.category" @change="onCategoryChange(($event.target as HTMLSelectElement).value)"
              class="flex-1 px-3 py-2 rounded-lg bg-slate-100">
              <option v-for="c in cats.all" :key="c" :value="c">{{ c }}</option>
              <option :value="NEW_TOKEN">+ 新建分类...</option>
            </select>
          </div>
          <div v-else class="mt-1 flex gap-2">
            <input v-model="newCatName" placeholder="新分类名"
              class="flex-1 px-3 py-2 rounded-lg bg-slate-100"
              @keydown.enter.prevent="confirmNewCategory" />
            <button class="px-3 py-2 rounded-lg bg-slate-100 text-slate-500" @click="cancelNewCategory">取消</button>
            <button class="px-3 py-2 rounded-lg bg-emerald-500 text-white" @click="confirmNewCategory">确定</button>
          </div>
        </div>
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
