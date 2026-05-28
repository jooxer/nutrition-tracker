<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import type { FoodRow } from '@/db/db';
import { type Category } from '@/constants/categories';
import { useCategoriesStore } from '@/stores/categoriesStore';
import { useToast } from '@/stores/toastStore';
import { recognizeNutritionLabel } from '@/lib/nutritionOcr';
import BarcodeScanner from './BarcodeScanner.vue';

const NEW_TOKEN = '__new__';

const props = defineProps<{
  open: boolean;
  initial?: FoodRow | null;
  scanned?: { name: string; spec: string; carb: number; protein: number; fat: number } | null;
}>();
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
const showScanner = ref(false);
const scanLoading = ref(false);

watch(() => props.open, (o) => {
  if (!o) return;
  if (props.initial) {
    Object.assign(form, { name: props.initial.name, category: props.initial.category, spec: props.initial.spec, carb: props.initial.carb, protein: props.initial.protein, fat: props.initial.fat, note: props.initial.note ?? '' });
  } else if (props.scanned) {
    Object.assign(form, { name: props.scanned.name, category: '其他', spec: props.scanned.spec, carb: props.scanned.carb, protein: props.scanned.protein, fat: props.scanned.fat, note: '' });
  } else {
    Object.assign(form, { name: '', category: '其他', spec: '100g', carb: 0, protein: 0, fat: 0, note: '' });
  }
  adding.value = false;
  newCatName.value = '';
}, { immediate: true });

async function onCaptured(imageDataUrl: string) {
  showScanner.value = false;
  scanLoading.value = true;
  try {
    const facts = await recognizeNutritionLabel(imageDataUrl);
    if (!facts) { toast.show('未能识别营养成分', 'error'); return; }
    if (facts.name) form.name = facts.name;
    if (facts.per) form.spec = facts.per;
    form.carb = facts.carb;
    form.protein = facts.protein;
    form.fat = facts.fat;
    toast.show('已识别，请检查数据');
  } catch (e: any) {
    console.error('OCR error:', e);
    toast.show(e?.message || '识别失败', 'error');
  } finally {
    scanLoading.value = false;
  }
}

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
      <div class="flex items-center justify-between mb-3">
        <div class="text-lg font-semibold">{{ initial ? '编辑食物' : '新增食物' }}</div>
        <button class="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 text-xs flex items-center gap-1"
          @click="showScanner = true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
          拍照识别
        </button>
      </div>
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

    <BarcodeScanner :open="showScanner" @close="showScanner = false" @captured="onCaptured" />

    <div v-if="scanLoading" class="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center">
      <div class="bg-white rounded-2xl p-6 flex flex-col items-center gap-3">
        <div class="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <span class="text-sm text-slate-600">识别中...</span>
      </div>
    </div>
  </div>
</template>
