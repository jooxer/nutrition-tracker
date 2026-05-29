<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { getDB, resetDBForTests, DB_VERSION } from '@/db/db';
import { useFoodStore } from '@/stores/foodStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useCategoriesStore } from '@/stores/categoriesStore';
import { useToast } from '@/stores/toastStore';
import { getSetting, setSetting } from '@/db/settings';
import { runSeedIfEmpty } from '@/lib/seed';
import { MEALS, DEFAULT_MEAL_RATIOS, type DayType, type MealType, type MealRatios } from '@/constants/goals';

const foods = useFoodStore();
const settings = useSettingsStore();
const cats = useCategoriesStore();
const toast = useToast();
const showDeleted = ref<boolean>(false);
const draft = ref<MealRatios>(JSON.parse(JSON.stringify(DEFAULT_MEAL_RATIOS)));
const zhipuKey = ref(localStorage.getItem('nutrition-tracker:zhipuKey') || '');
const moonshotKey = ref(localStorage.getItem('nutrition-tracker:moonshotKey') || '');
const geminiKey = ref(localStorage.getItem('nutrition-tracker:geminiKey') || '');
const testResult = ref('');

function saveApiKey(provider: 'zhipu' | 'moonshot' | 'gemini') {
  const keyMap = { zhipu: zhipuKey, moonshot: moonshotKey, gemini: geminiKey };
  const k = keyMap[provider].value.trim();
  if (k) localStorage.setItem(`nutrition-tracker:${provider}Key`, k);
  else localStorage.removeItem(`nutrition-tracker:${provider}Key`);
  toast.show('已保存');
}

async function testApiKey(provider: 'zhipu' | 'moonshot' | 'gemini') {
  testResult.value = '测试中...';
  const keyMap = { zhipu: zhipuKey, moonshot: moonshotKey, gemini: geminiKey };
  const key = keyMap[provider].value.trim();
  if (!key) { testResult.value = '请先输入 API Key'; return; }

  try {
    // 临时保存到 localStorage 供测试使用
    const oldKey = localStorage.getItem(`nutrition-tracker:${provider}Key`);
    localStorage.setItem(`nutrition-tracker:${provider}Key`, key);

    const testImg = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const { recognizeNutritionLabel } = await import('@/lib/nutritionOcr');
    await recognizeNutritionLabel(testImg);

    // 恢复旧值（测试成功后不自动保存）
    if (oldKey) localStorage.setItem(`nutrition-tracker:${provider}Key`, oldKey);
    else localStorage.removeItem(`nutrition-tracker:${provider}Key`);

    testResult.value = `${provider} API 连接成功 ✓`;
  } catch (e: any) {
    console.error(`[Test] ${provider} failed:`, e);
    let msg = e.message || '未知错误';
    if (e.message === 'Failed to fetch' || e.name === 'TypeError') {
      msg = '网络连接失败';
    }
    testResult.value = `${provider} 测试失败: ${msg}`;
  }
}

async function diagNetwork() {
  testResult.value = '诊断中...';
  const results: string[] = [];
  const endpoints = [
    { name: '智谱', url: 'https://open.bigmodel.cn' },
    { name: 'Moonshot', url: 'https://api.moonshot.cn' },
    { name: 'Gemini', url: 'https://generativelanguage.googleapis.com' }
  ];

  for (const ep of endpoints) {
    try {
      await fetch(ep.url, { method: 'HEAD', mode: 'no-cors', signal: AbortSignal.timeout(5000) });
      results.push(`${ep.name}: 可达 ✓`);
    } catch (e: any) {
      results.push(`${ep.name}: ${e.message}`);
    }
  }
  testResult.value = results.join(' | ');
}

onMounted(async () => {
  await foods.load();
  settings.load();
  draft.value = JSON.parse(JSON.stringify(settings.ratios));
});

function sumOf(dt: DayType, kind: 'carb' | 'protein') {
  return MEALS.reduce((s, m) => s + (Number(draft.value[dt][kind][m.value]) || 0), 0);
}
const dirty = computed(() => JSON.stringify(draft.value) !== JSON.stringify(settings.ratios));
const allValid = computed(() =>
  ['training','rest'].every(dt =>
    (['carb','protein'] as const).every(k => sumOf(dt as DayType, k) === 100)
  )
);

async function saveRatios() {
  if (!allValid.value) { toast.show('每行需合计 100', 'error'); return; }
  await settings.saveRatios(draft.value);
  toast.show('已保存');
}
async function resetRatios() {
  if (!confirm('恢复默认占比？')) return;
  await settings.resetRatios();
  draft.value = JSON.parse(JSON.stringify(settings.ratios));
  toast.show('已恢复默认');
}

async function exportJson() {
  const db = await getDB();
  const data: Record<string, any> = {
    schemaVersion: DB_VERSION,
    foods: await db.getAll('foods'),
    recipes: await db.getAll('recipes'),
    daily_logs: await db.getAll('daily_logs'),
    preferences: {
      foodOrder: getSetting<any>('nutrition-tracker:foodOrder'),
      categoryOrder: getSetting<any>('nutrition-tracker:categoryOrder'),
      customCategories: getSetting<any>('nutrition-tracker:customCategories'),
      mealRatios: getSetting<any>('nutrition-tracker:mealRatios')
    }
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
  if (![1, 2].includes(data.schemaVersion)) { toast.show(`版本不支持（${data.schemaVersion}）`, 'error'); return; }
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
  if (data.preferences) {
    const p = data.preferences;
    if (p.foodOrder) setSetting('nutrition-tracker:foodOrder', p.foodOrder);
    if (p.categoryOrder) setSetting('nutrition-tracker:categoryOrder', p.categoryOrder);
    if (p.customCategories) setSetting('nutrition-tracker:customCategories', p.customCategories);
    if (p.mealRatios) setSetting('nutrition-tracker:mealRatios', p.mealRatios);
  }
  await foods.load();
  settings.reload();
  cats.reload();
  draft.value = JSON.parse(JSON.stringify(settings.ratios));
  toast.show('已导入');
}

async function resetAll() {
  if (!confirm('清空所有数据并重新导入预置食物？')) return;
  await resetDBForTests();
  await runSeedIfEmpty();
  await foods.load();
  settings.reload();
  draft.value = JSON.parse(JSON.stringify(settings.ratios));
  toast.show('已重置');
}

async function restore(id: string) {
  await foods.restore(id);
  toast.show('已恢复');
}

const dayLabels: Record<DayType, string> = { training: '力训日', rest: '休息日' };
const kindLabels = { carb: '碳水', protein: '蛋白质' } as const;
</script>

<template>
  <div class="p-4 space-y-4">
    <div class="rounded-2xl bg-white shadow-sm p-4 space-y-3">
      <div class="flex items-center justify-between">
        <div class="font-semibold">餐次占比</div>
        <button class="text-xs text-slate-500" @click="resetRatios">恢复默认</button>
      </div>
      <div class="text-xs text-slate-400">每行需合计 100%</div>

      <div v-for="dt in (['training','rest'] as const)" :key="dt" class="space-y-2">
        <div class="text-xs font-semibold text-slate-600 mt-1">{{ dayLabels[dt] }}</div>
        <div v-for="k in (['carb','protein'] as const)" :key="k"
             class="flex items-center gap-1.5 text-xs">
          <span class="w-12 text-slate-500 flex-shrink-0">{{ kindLabels[k] }}</span>
          <input v-for="m in MEALS" :key="m.value"
            v-model.number="draft[dt][k][m.value as MealType]"
            type="number" min="0" max="100"
            class="flex-1 min-w-0 px-2 py-1.5 rounded-lg bg-slate-100 text-center tabular-nums" />
          <span :class="['w-10 text-right tabular-nums flex-shrink-0',
                         sumOf(dt, k) === 100 ? 'text-slate-400' : 'text-red-500 font-semibold']">
            {{ sumOf(dt, k) }}%
          </span>
        </div>
      </div>

      <div class="flex gap-2 pt-1">
        <span class="flex-1 text-[11px] text-slate-400 self-center">
          列：{{ MEALS.map(m => m.label).join(' / ') }}
        </span>
        <button class="px-4 py-2 rounded-full bg-emerald-500 text-white disabled:opacity-40"
          :disabled="!dirty || !allValid" @click="saveRatios">保存</button>
      </div>
    </div>

    <div class="rounded-2xl bg-white shadow-sm p-4 space-y-3">
      <div class="font-semibold">拍照识别（AI 视觉）</div>
      <div class="text-xs text-slate-400">配置任一 API Key 后，拍营养成分表可自动识别碳蛋脂数据。优先级：智谱 > Kimi > Gemini</div>
      <div v-if="testResult" class="text-xs p-2 rounded-lg bg-slate-50 text-slate-600 break-all">{{ testResult }}</div>
      <button class="text-xs text-blue-500 underline" @click="diagNetwork">诊断网络连通性</button>

      <div class="space-y-2">
        <div class="text-xs font-semibold text-slate-600">智谱 GLM-4V（推荐，国内直连）</div>
        <div class="flex gap-2">
          <input v-model="zhipuKey" type="password" placeholder="输入智谱 API Key"
            class="flex-1 px-3 py-2 rounded-lg bg-slate-100 text-sm" />
          <button class="px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm flex-shrink-0" @click="saveApiKey('zhipu')">保存</button>
          <button class="px-3 py-2 rounded-lg bg-blue-50 text-blue-600 text-xs flex-shrink-0" @click="testApiKey('zhipu')">测试</button>
        </div>
        <a href="https://open.bigmodel.cn/usercenter/apikeys" target="_blank" class="text-xs text-blue-500 underline">获取智谱 API Key（免费注册）→</a>
        <div class="text-xs text-amber-600">⚠️ 注意：免费额度有限，403 错误通常表示额度用完或频率超限</div>
      </div>

      <div class="space-y-2">
        <div class="text-xs font-semibold text-slate-600">Kimi (Moonshot)（国内直连）</div>
        <div class="flex gap-2">
          <input v-model="moonshotKey" type="password" placeholder="输入 Moonshot API Key"
            class="flex-1 px-3 py-2 rounded-lg bg-slate-100 text-sm" />
          <button class="px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm flex-shrink-0" @click="saveApiKey('moonshot')">保存</button>
          <button class="px-3 py-2 rounded-lg bg-blue-50 text-blue-600 text-xs flex-shrink-0" @click="testApiKey('moonshot')">测试</button>
        </div>
        <a href="https://platform.moonshot.cn/console/api-keys" target="_blank" class="text-xs text-blue-500 underline">获取 Moonshot API Key →</a>
      </div>

      <div class="space-y-2">
        <div class="text-xs font-semibold text-slate-600">Google Gemini</div>
        <div class="flex gap-2">
          <input v-model="geminiKey" type="password" placeholder="输入 Gemini API Key"
            class="flex-1 px-3 py-2 rounded-lg bg-slate-100 text-sm" />
          <button class="px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm flex-shrink-0" @click="saveApiKey('gemini')">保存</button>
          <button class="px-3 py-2 rounded-lg bg-blue-50 text-blue-600 text-xs flex-shrink-0" @click="testApiKey('gemini')">测试</button>
        </div>
        <a href="https://aistudio.google.com/apikey" target="_blank" class="text-xs text-blue-500 underline">获取 Gemini API Key →</a>
      </div>
    </div>

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

    <div class="text-xs text-slate-400 text-center">v0.2.0</div>
  </div>
</template>
