<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { getDB, resetDBForTests, DB_VERSION } from '@/db/db';
import { useFoodStore } from '@/stores/foodStore';
import { useToast } from '@/stores/toastStore';
import { runSeedIfEmpty } from '@/lib/seed';

const foods = useFoodStore();
const toast = useToast();
const showDeleted = ref<boolean>(false);

onMounted(() => foods.load());

async function exportJson() {
  const db = await getDB();
  const data = {
    schemaVersion: DB_VERSION,
    foods: await db.getAll('foods'),
    recipes: await db.getAll('recipes'),
    daily_logs: await db.getAll('daily_logs')
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const d = new Date();
  a.href = url;
  a.download = `nutrition-tracker-backup-${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function importJson(ev: Event) {
  const file = (ev.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const text = await file.text();
  let data: any;
  try { data = JSON.parse(text); } catch { toast.show('JSON 解析失败', 'error'); return; }
  if (data.schemaVersion !== DB_VERSION) { toast.show(`版本不符（${data.schemaVersion} vs ${DB_VERSION}）`, 'error'); return; }
  if (!Array.isArray(data.foods) || !Array.isArray(data.recipes) || !Array.isArray(data.daily_logs)) {
    toast.show('文件格式不正确', 'error'); return;
  }
  if (!confirm('将覆盖现有所有数据，继续？')) return;
  await resetDBForTests();
  const db = await getDB();
  const tx = db.transaction(['foods','recipes','daily_logs'], 'readwrite');
  for (const f of data.foods)       await tx.objectStore('foods').put(f);
  for (const r of data.recipes)     await tx.objectStore('recipes').put(r);
  for (const l of data.daily_logs)  await tx.objectStore('daily_logs').put(l);
  await tx.done;
  await foods.load();
  toast.show('已导入');
}

async function resetAll() {
  if (!confirm('清空所有数据并重新导入预置食物？')) return;
  await resetDBForTests();
  await runSeedIfEmpty();
  await foods.load();
  toast.show('已重置');
}

async function restore(id: string) {
  await foods.restore(id);
  toast.show('已恢复');
}
</script>

<template>
  <div class="p-4 space-y-4">
    <div class="rounded-2xl bg-white shadow-sm p-4 space-y-3">
      <div class="font-semibold">数据</div>
      <button class="w-full py-2 rounded-full bg-emerald-500 text-white" @click="exportJson">导出 JSON</button>
      <label class="block">
        <span class="block w-full py-2 rounded-full border border-slate-200 text-center text-slate-600">导入 JSON</span>
        <input type="file" accept="application/json" class="hidden" @change="importJson" />
      </label>
      <button class="w-full py-2 rounded-full border border-red-200 text-red-500" @click="resetAll">重置（恢复出厂）</button>
    </div>

    <div class="rounded-2xl bg-white shadow-sm p-4">
      <button class="text-sm font-semibold" @click="showDeleted = !showDeleted">{{ showDeleted ? '收起' : '展开' }}已删除食物</button>
      <div v-if="showDeleted" class="mt-3 space-y-2">
        <div v-for="f in foods.foods.filter(f => f.deleted)" :key="f.id"
             class="flex justify-between items-center text-sm">
          <div>{{ f.name }} <span class="text-xs text-slate-400">{{ f.spec }}</span></div>
          <button class="text-emerald-600 text-xs" @click="restore(f.id)">恢复</button>
        </div>
        <div v-if="!foods.foods.some(f => f.deleted)" class="text-sm text-slate-400">无</div>
      </div>
    </div>

    <div class="text-xs text-slate-400 text-center">v0.1.0</div>
  </div>
</template>
