# Daily Nutrition Tracker PWA — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local-first PWA that replaces the user's Excel food/calorie tracking workflow with a mobile-installable web app.

**Architecture:** Vue 3 SFC + Pinia + IndexedDB. UI layer renders & dispatches; stores own in-memory state and call calc/db helpers; db layer wraps IndexedDB through `idb`; pure calc fns isolate logic for testing. PWA shell via `vite-plugin-pwa`.

**Tech Stack:** Vue 3 (Composition API) · Vite · TypeScript · Tailwind CSS · Pinia · vue-router · `idb` · vite-plugin-pwa · ECharts · Vitest · fake-indexeddb.

**Spec:** `docs/superpowers/specs/2026-05-22-daily-nutrition-tracker-design.md`

---

## File Structure

```
src/
  main.ts                  # Vue app bootstrap
  App.vue                  # root layout + tab bar
  router/index.ts          # routes: /, /foods, /recipes, /history, /history/:date, /settings
  views/
    TodayView.vue          # daily dial + entries + add button
    FoodsView.vue          # food library list + filter
    RecipesView.vue        # recipe list
    HistoryView.vue        # calendar/trend toggle
    HistoryDayView.vue     # read-only daily view by :date
    SettingsView.vue       # export/import/restore
  components/
    BottomTabBar.vue
    MetabolicDial.vue      # 3 nutrient rings + kcal + multipliers
    EntryRow.vue           # one row in today's entry list
    FoodPicker.vue         # add-entry modal: food/recipe/adhoc tabs
    FoodEditor.vue         # add/edit a food
    RecipeEditor.vue       # add/edit a recipe
    CalendarHeatmap.vue    # month grid with color dots
    TrendChart.vue         # ECharts line+bar
    SegmentedControl.vue   # generic 2-option toggle
    Toast.vue              # transient notice (mounted at App)
  stores/
    foodStore.ts
    dailyStore.ts
    recipeStore.ts
    toastStore.ts
  db/
    db.ts                  # open() + schema upgrades
    foods.ts               # CRUD on foods store
    recipes.ts             # CRUD on recipes store
    logs.ts                # CRUD on daily_logs store
  lib/
    calc.ts                # pure: totals, kcal, multipliers
    date.ts                # local YYYY-MM-DD, month range
    uuid.ts                # uuid v4
    seed.ts                # idempotent seed import
  constants/
    goals.ts
    categories.ts
  assets/
    seed_foods.json
tests/
  calc.spec.ts
  date.spec.ts
  db-foods.spec.ts
  db-recipes.spec.ts
  db-logs.spec.ts
  seed.spec.ts
  daily-store.spec.ts
```

---

## Milestone 1 — Scaffold + core engine

### Task 1: Initialize Vite + Vue + TS project

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `index.html`, `src/main.ts`, `src/App.vue`, `src/style.css`, `src/env.d.ts`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "nutrition-tracker",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc -b && vite build",
    "preview": "vite preview --host",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "vue": "^3.5.0",
    "vue-router": "^4.4.0",
    "pinia": "^2.2.0",
    "idb": "^8.0.0",
    "echarts": "^5.5.0"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.1.0",
    "typescript": "^5.5.0",
    "vue-tsc": "^2.1.0",
    "vite": "^5.4.0",
    "vite-plugin-pwa": "^0.20.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0",
    "vitest": "^2.1.0",
    "@vitest/ui": "^2.1.0",
    "fake-indexeddb": "^6.0.0",
    "jsdom": "^25.0.0"
  }
}
```

- [ ] **Step 2: Create `vite.config.ts`**

```ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: '营养计算',
        short_name: '营养',
        description: '每日饮食碳蛋脂记录',
        theme_color: '#10b981',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      }
    })
  ],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts']
  }
});
```

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": false,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "preserve",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["vitest/globals"],
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

- [ ] **Step 4: Create `index.html`**

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>营养计算</title>
  </head>
  <body class="bg-slate-50">
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 5: Create `src/main.ts`, `src/App.vue`, `src/style.css`, `src/env.d.ts`**

`src/env.d.ts`:
```ts
/// <reference types="vite/client" />
declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}
```

`src/style.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

`src/App.vue`:
```vue
<template>
  <div class="min-h-screen text-slate-900">Hello</div>
</template>
```

`src/main.ts`:
```ts
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import './style.css';

createApp(App).use(createPinia()).mount('#app');
```

- [ ] **Step 6: Run `pnpm install` (or `npm install`)**

Run: `cd /d/projects/nutrition-tracker && npm install`
Expected: deps installed without error.

- [ ] **Step 7: Verify dev server boots**

Run: `npm run dev` (Ctrl+C after seeing `Local: http://localhost:5173/`)
Expected: page shows "Hello".

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vue 3 + Vite + TS + PWA"
```

### Task 2: Tailwind setup

**Files:**
- Create: `tailwind.config.js`, `postcss.config.js`

- [ ] **Step 1: Create `tailwind.config.js`**

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        carb: '#3b82f6',
        protein: '#10b981',
        fat: '#f59e0b'
      }
    }
  },
  plugins: []
};
```

- [ ] **Step 2: Create `postcss.config.js`**

```js
export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
```

- [ ] **Step 3: Verify dev server still serves and tailwind class works**

Edit `src/App.vue` to `<div class="p-4 text-emerald-600">OK</div>`, run `npm run dev`, confirm green text. Revert.

- [ ] **Step 4: Commit**

```bash
git add tailwind.config.js postcss.config.js
git commit -m "chore: configure tailwind"
```

### Task 3: Constants — goals & categories

**Files:**
- Create: `src/constants/goals.ts`, `src/constants/categories.ts`

- [ ] **Step 1: Create `src/constants/goals.ts`**

```ts
export const WEIGHT_KG = 62;

export type DayType = 'training' | 'rest';

export interface Goal {
  carbMul: number;
  proteinMul: number;
  fatGram: number;
  totalKcal: number;
}

export const GOALS: Record<DayType, Goal> = {
  training: { carbMul: 2.2, proteinMul: 1.5, fatGram: 60, totalKcal: 2363 * 0.64 },
  rest:     { carbMul: 1.8, proteinMul: 1.5, fatGram: 60, totalKcal: 2163 * 0.64 }
};

export function targetsFor(dayType: DayType) {
  const g = GOALS[dayType];
  return {
    carb: g.carbMul * WEIGHT_KG,
    protein: g.proteinMul * WEIGHT_KG,
    fat: g.fatGram,
    kcal: g.totalKcal
  };
}
```

- [ ] **Step 2: Create `src/constants/categories.ts`**

```ts
export const CATEGORIES = [
  '主食', '水果', '碳水其他', '蛋白', '脂肪',
  '混合', 'KFC', '德克士', '喜茶', '茉莉奶白', '其他'
] as const;

export type Category = typeof CATEGORIES[number];
```

- [ ] **Step 3: Commit**

```bash
git add src/constants
git commit -m "feat: add goals and categories constants"
```

### Task 4: Pure calc functions (TDD)

**Files:**
- Create: `tests/calc.spec.ts`, `src/lib/calc.ts`

- [ ] **Step 1: Write failing test `tests/calc.spec.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { entryTotals, sumTotals, kcalOf, multipliers } from '@/lib/calc';

describe('calc', () => {
  it('entryTotals scales single nutrients by amount', () => {
    expect(entryTotals({ carb: 30, protein: 2.8, fat: 0.39 }, 2))
      .toEqual({ carb: 60, protein: 5.6, fat: 0.78 });
  });

  it('sumTotals on empty list is zero', () => {
    expect(sumTotals([])).toEqual({ carb: 0, protein: 0, fat: 0 });
  });

  it('sumTotals adds rows', () => {
    expect(sumTotals([
      { carb: 1, protein: 2, fat: 3 },
      { carb: 4, protein: 5, fat: 6 }
    ])).toEqual({ carb: 5, protein: 7, fat: 9 });
  });

  it('kcalOf uses 4.1 / 4.1 / 9.3', () => {
    expect(kcalOf({ carb: 100, protein: 50, fat: 10 }))
      .toBeCloseTo(100 * 4.1 + 50 * 4.1 + 10 * 9.3, 6);
  });

  it('multipliers divide by weight', () => {
    expect(multipliers({ carb: 124, protein: 93, fat: 60 }, 62))
      .toEqual({ carb: 2, protein: 1.5, fat: 60 / 62 });
  });
});
```

- [ ] **Step 2: Run tests — expect fail**

Run: `npm test -- calc`
Expected: fail "Cannot find module '@/lib/calc'".

- [ ] **Step 3: Implement `src/lib/calc.ts`**

```ts
export interface Nutrients { carb: number; protein: number; fat: number }

export function entryTotals(unit: Nutrients, amount: number): Nutrients {
  return { carb: unit.carb * amount, protein: unit.protein * amount, fat: unit.fat * amount };
}

export function sumTotals(list: Nutrients[]): Nutrients {
  return list.reduce(
    (acc, n) => ({ carb: acc.carb + n.carb, protein: acc.protein + n.protein, fat: acc.fat + n.fat }),
    { carb: 0, protein: 0, fat: 0 }
  );
}

export function kcalOf(n: Nutrients): number {
  return n.carb * 4.1 + n.protein * 4.1 + n.fat * 9.3;
}

export function multipliers(n: Nutrients, weightKg: number): Nutrients {
  return { carb: n.carb / weightKg, protein: n.protein / weightKg, fat: n.fat / weightKg };
}
```

- [ ] **Step 4: Run tests — expect pass**

Run: `npm test -- calc`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/calc.ts tests/calc.spec.ts
git commit -m "feat(calc): pure totals/kcal/multipliers"
```

### Task 5: Date helpers (TDD)

**Files:**
- Create: `tests/date.spec.ts`, `src/lib/date.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from 'vitest';
import { todayKey, monthRange, addDays } from '@/lib/date';

describe('date', () => {
  it('todayKey is YYYY-MM-DD in local tz', () => {
    const k = todayKey();
    expect(k).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const d = new Date();
    const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    expect(k).toBe(expected);
  });

  it('monthRange returns first..last day inclusive of given YYYY-MM', () => {
    const r = monthRange('2024-02'); // leap year
    expect(r[0]).toBe('2024-02-01');
    expect(r[r.length - 1]).toBe('2024-02-29');
    expect(r.length).toBe(29);
  });

  it('addDays handles month rollover', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});
```

- [ ] **Step 2: Run — expect fail**

Run: `npm test -- date`

- [ ] **Step 3: Implement `src/lib/date.ts`**

```ts
function pad2(n: number): string { return String(n).padStart(2, '0'); }

export function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function monthRange(yyyymm: string): string[] {
  const [y, m] = yyyymm.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  const out: string[] = [];
  for (let day = 1; day <= last; day++) out.push(`${y}-${pad2(m)}-${pad2(day)}`);
  return out;
}

export function addDays(key: string, delta: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d + delta);
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}
```

- [ ] **Step 4: Run — expect pass**

- [ ] **Step 5: Commit**

```bash
git add src/lib/date.ts tests/date.spec.ts
git commit -m "feat(date): local-tz date helpers"
```

### Task 6: UUID helper

**Files:**
- Create: `src/lib/uuid.ts`

- [ ] **Step 1: Implement `src/lib/uuid.ts`**

```ts
export function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/uuid.ts
git commit -m "feat(lib): uuid helper"
```

### Task 7: Test setup file (fake-indexeddb)

**Files:**
- Create: `tests/setup.ts`

- [ ] **Step 1: Create `tests/setup.ts`**

```ts
import 'fake-indexeddb/auto';
```

- [ ] **Step 2: Commit**

```bash
git add tests/setup.ts
git commit -m "test: wire fake-indexeddb"
```

### Task 8: IndexedDB schema + open

**Files:**
- Create: `src/db/db.ts`

- [ ] **Step 1: Implement `src/db/db.ts`**

```ts
import { openDB, type IDBPDatabase } from 'idb';
import type { Category } from '@/constants/categories';
import type { DayType } from '@/constants/goals';

export interface FoodRow {
  id: string;
  name: string;
  category: Category;
  spec: string;
  carb: number;
  protein: number;
  fat: number;
  note: string | null;
  builtin: boolean;
  deleted: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface RecipeRow {
  id: string;
  name: string;
  items: { foodId: string; amount: number }[];
  createdAt: number;
  updatedAt: number;
}

export type Entry =
  | { id: string; kind: 'food'; foodId: string; amount: number }
  | {
      id: string; kind: 'adhoc';
      name: string; spec: string;
      carb: number; protein: number; fat: number;
      amount: number;
    };

export interface DailyLogRow {
  date: string;
  dayType: DayType;
  entries: Entry[];
}

export interface Schema {
  foods: { key: string; value: FoodRow; indexes: { byCategory: string; byName: string; byDeleted: string } };
  recipes: { key: string; value: RecipeRow };
  daily_logs: { key: string; value: DailyLogRow };
}

export const DB_NAME = 'nutrition-tracker';
export const DB_VERSION = 1;

let _db: IDBPDatabase<Schema> | null = null;

export async function getDB(): Promise<IDBPDatabase<Schema>> {
  if (_db) return _db;
  _db = await openDB<Schema>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      const foods = db.createObjectStore('foods', { keyPath: 'id' });
      foods.createIndex('byCategory', 'category');
      foods.createIndex('byName', 'name');
      foods.createIndex('byDeleted', 'deleted');
      db.createObjectStore('recipes', { keyPath: 'id' });
      db.createObjectStore('daily_logs', { keyPath: 'date' });
    }
  });
  return _db;
}

export async function resetDBForTests(): Promise<void> {
  if (_db) { _db.close(); _db = null; }
  await new Promise<void>((res, rej) => {
    const r = indexedDB.deleteDatabase(DB_NAME);
    r.onsuccess = () => res(); r.onerror = () => rej(r.error); r.onblocked = () => res();
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/db/db.ts
git commit -m "feat(db): schema and open helper"
```

### Task 9: foods CRUD (TDD)

**Files:**
- Create: `tests/db-foods.spec.ts`, `src/db/foods.ts`

- [ ] **Step 1: Write failing test**

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { resetDBForTests } from '@/db/db';
import { addFood, listFoods, updateFood, softDeleteFood, restoreFood, getFood } from '@/db/foods';

beforeEach(async () => { await resetDBForTests(); });

describe('foods CRUD', () => {
  it('addFood + getFood roundtrip', async () => {
    const id = await addFood({ name: '米饭', category: '主食', spec: '100g', carb: 30, protein: 2.8, fat: 0.39, note: null, builtin: false });
    const got = await getFood(id);
    expect(got?.name).toBe('米饭');
    expect(got?.builtin).toBe(false);
    expect(got?.deleted).toBe(false);
  });

  it('listFoods filters deleted by default', async () => {
    const a = await addFood({ name: 'A', category: '主食', spec: '1', carb: 1, protein: 1, fat: 1, note: null, builtin: false });
    const b = await addFood({ name: 'B', category: '主食', spec: '1', carb: 1, protein: 1, fat: 1, note: null, builtin: false });
    await softDeleteFood(b);
    const live = await listFoods();
    expect(live.map(f => f.id)).toEqual([a]);
    const all = await listFoods({ includeDeleted: true });
    expect(all.length).toBe(2);
  });

  it('updateFood patches and bumps updatedAt', async () => {
    const id = await addFood({ name: 'A', category: '主食', spec: '1', carb: 1, protein: 1, fat: 1, note: null, builtin: false });
    const before = (await getFood(id))!.updatedAt;
    await new Promise(r => setTimeout(r, 2));
    await updateFood(id, { name: 'B' });
    const after = await getFood(id);
    expect(after?.name).toBe('B');
    expect(after!.updatedAt).toBeGreaterThan(before);
  });

  it('restoreFood unsets deleted flag', async () => {
    const id = await addFood({ name: 'A', category: '主食', spec: '1', carb: 1, protein: 1, fat: 1, note: null, builtin: false });
    await softDeleteFood(id);
    await restoreFood(id);
    expect((await getFood(id))?.deleted).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect fail**

Run: `npm test -- db-foods`

- [ ] **Step 3: Implement `src/db/foods.ts`**

```ts
import { getDB, type FoodRow } from './db';
import { uuid } from '@/lib/uuid';

export type FoodInput = Omit<FoodRow, 'id' | 'deleted' | 'createdAt' | 'updatedAt'>;

export async function addFood(input: FoodInput): Promise<string> {
  const db = await getDB();
  const now = Date.now();
  const id = uuid();
  await db.put('foods', { ...input, id, deleted: false, createdAt: now, updatedAt: now });
  return id;
}

export async function getFood(id: string): Promise<FoodRow | undefined> {
  return (await getDB()).get('foods', id);
}

export async function listFoods(opts: { includeDeleted?: boolean } = {}): Promise<FoodRow[]> {
  const all = await (await getDB()).getAll('foods');
  return opts.includeDeleted ? all : all.filter(f => !f.deleted);
}

export async function updateFood(id: string, patch: Partial<FoodInput>): Promise<void> {
  const db = await getDB();
  const cur = await db.get('foods', id);
  if (!cur) throw new Error(`food ${id} not found`);
  await db.put('foods', { ...cur, ...patch, updatedAt: Date.now() });
}

export async function softDeleteFood(id: string): Promise<void> {
  const db = await getDB();
  const cur = await db.get('foods', id);
  if (!cur) throw new Error(`food ${id} not found`);
  await db.put('foods', { ...cur, deleted: true, updatedAt: Date.now() });
}

export async function restoreFood(id: string): Promise<void> {
  const db = await getDB();
  const cur = await db.get('foods', id);
  if (!cur) throw new Error(`food ${id} not found`);
  await db.put('foods', { ...cur, deleted: false, updatedAt: Date.now() });
}
```

- [ ] **Step 4: Run — expect pass**

- [ ] **Step 5: Commit**

```bash
git add src/db/foods.ts tests/db-foods.spec.ts
git commit -m "feat(db): foods CRUD with soft delete"
```

### Task 10: recipes CRUD (TDD)

**Files:**
- Create: `tests/db-recipes.spec.ts`, `src/db/recipes.ts`

- [ ] **Step 1: Write failing test**

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { resetDBForTests } from '@/db/db';
import { addRecipe, listRecipes, updateRecipe, deleteRecipe, getRecipe } from '@/db/recipes';

beforeEach(async () => { await resetDBForTests(); });

describe('recipes CRUD', () => {
  it('addRecipe + listRecipes', async () => {
    const id = await addRecipe({ name: '早餐A', items: [{ foodId: 'f1', amount: 1 }] });
    const list = await listRecipes();
    expect(list.length).toBe(1);
    expect(list[0].id).toBe(id);
    expect(list[0].items).toEqual([{ foodId: 'f1', amount: 1 }]);
  });

  it('updateRecipe replaces fields', async () => {
    const id = await addRecipe({ name: 'A', items: [] });
    await updateRecipe(id, { name: 'B', items: [{ foodId: 'x', amount: 2 }] });
    const r = await getRecipe(id);
    expect(r?.name).toBe('B');
    expect(r?.items).toEqual([{ foodId: 'x', amount: 2 }]);
  });

  it('deleteRecipe is hard delete', async () => {
    const id = await addRecipe({ name: 'A', items: [] });
    await deleteRecipe(id);
    expect(await getRecipe(id)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run — expect fail**

Run: `npm test -- db-recipes`

- [ ] **Step 3: Implement `src/db/recipes.ts`**

```ts
import { getDB, type RecipeRow } from './db';
import { uuid } from '@/lib/uuid';

export type RecipeInput = Pick<RecipeRow, 'name' | 'items'>;

export async function addRecipe(input: RecipeInput): Promise<string> {
  const db = await getDB();
  const now = Date.now();
  const id = uuid();
  await db.put('recipes', { ...input, id, createdAt: now, updatedAt: now });
  return id;
}

export async function getRecipe(id: string): Promise<RecipeRow | undefined> {
  return (await getDB()).get('recipes', id);
}

export async function listRecipes(): Promise<RecipeRow[]> {
  return (await getDB()).getAll('recipes');
}

export async function updateRecipe(id: string, patch: Partial<RecipeInput>): Promise<void> {
  const db = await getDB();
  const cur = await db.get('recipes', id);
  if (!cur) throw new Error(`recipe ${id} not found`);
  await db.put('recipes', { ...cur, ...patch, updatedAt: Date.now() });
}

export async function deleteRecipe(id: string): Promise<void> {
  await (await getDB()).delete('recipes', id);
}
```

- [ ] **Step 4: Run — expect pass**

- [ ] **Step 5: Commit**

```bash
git add src/db/recipes.ts tests/db-recipes.spec.ts
git commit -m "feat(db): recipes CRUD"
```

### Task 11: daily_logs CRUD (TDD)

**Files:**
- Create: `tests/db-logs.spec.ts`, `src/db/logs.ts`

- [ ] **Step 1: Write failing test**

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { resetDBForTests } from '@/db/db';
import { getOrCreateLog, addEntry, removeEntry, setDayType, listLogsBetween, getLog } from '@/db/logs';

beforeEach(async () => { await resetDBForTests(); });

describe('daily_logs', () => {
  it('getOrCreateLog creates with provided dayType', async () => {
    const log = await getOrCreateLog('2026-05-22', 'training');
    expect(log.date).toBe('2026-05-22');
    expect(log.dayType).toBe('training');
    expect(log.entries).toEqual([]);
  });

  it('getOrCreateLog returns existing log without overwriting dayType', async () => {
    await getOrCreateLog('2026-05-22', 'training');
    const log = await getOrCreateLog('2026-05-22', 'rest');
    expect(log.dayType).toBe('training');
  });

  it('addEntry appends to entries', async () => {
    await getOrCreateLog('2026-05-22', 'rest');
    await addEntry('2026-05-22', { kind: 'food', foodId: 'f1', amount: 1.5 });
    await addEntry('2026-05-22', { kind: 'adhoc', name: 'X', spec: '一份', carb: 1, protein: 1, fat: 1, amount: 1 });
    const log = await getLog('2026-05-22');
    expect(log!.entries.length).toBe(2);
    expect(log!.entries[0]).toMatchObject({ kind: 'food', foodId: 'f1', amount: 1.5 });
    expect(log!.entries[0].id).toBeDefined();
  });

  it('removeEntry by id', async () => {
    await getOrCreateLog('2026-05-22', 'rest');
    const eid = await addEntry('2026-05-22', { kind: 'food', foodId: 'f1', amount: 1 });
    await removeEntry('2026-05-22', eid);
    expect((await getLog('2026-05-22'))!.entries.length).toBe(0);
  });

  it('setDayType updates type', async () => {
    await getOrCreateLog('2026-05-22', 'rest');
    await setDayType('2026-05-22', 'training');
    expect((await getLog('2026-05-22'))!.dayType).toBe('training');
  });

  it('listLogsBetween filters inclusive', async () => {
    await getOrCreateLog('2026-05-20', 'rest');
    await getOrCreateLog('2026-05-21', 'rest');
    await getOrCreateLog('2026-05-22', 'rest');
    const out = await listLogsBetween('2026-05-21', '2026-05-22');
    expect(out.map(l => l.date)).toEqual(['2026-05-21', '2026-05-22']);
  });
});
```

- [ ] **Step 2: Run — expect fail**

Run: `npm test -- db-logs`

- [ ] **Step 3: Implement `src/db/logs.ts`**

```ts
import { getDB, type DailyLogRow, type Entry } from './db';
import type { DayType } from '@/constants/goals';
import { uuid } from '@/lib/uuid';

export async function getLog(date: string): Promise<DailyLogRow | undefined> {
  return (await getDB()).get('daily_logs', date);
}

export async function getOrCreateLog(date: string, dayType: DayType): Promise<DailyLogRow> {
  const db = await getDB();
  const existing = await db.get('daily_logs', date);
  if (existing) return existing;
  const fresh: DailyLogRow = { date, dayType, entries: [] };
  await db.put('daily_logs', fresh);
  return fresh;
}

export async function addEntry(date: string, input: Omit<Entry, 'id'>): Promise<string> {
  const db = await getDB();
  const log = await db.get('daily_logs', date);
  if (!log) throw new Error(`log ${date} not found`);
  const id = uuid();
  const entry = { id, ...input } as Entry;
  log.entries.push(entry);
  await db.put('daily_logs', log);
  return id;
}

export async function removeEntry(date: string, entryId: string): Promise<void> {
  const db = await getDB();
  const log = await db.get('daily_logs', date);
  if (!log) return;
  log.entries = log.entries.filter(e => e.id !== entryId);
  await db.put('daily_logs', log);
}

export async function setDayType(date: string, dayType: DayType): Promise<void> {
  const db = await getDB();
  const log = await db.get('daily_logs', date);
  if (!log) throw new Error(`log ${date} not found`);
  log.dayType = dayType;
  await db.put('daily_logs', log);
}

export async function listLogsBetween(fromDate: string, toDate: string): Promise<DailyLogRow[]> {
  const db = await getDB();
  const all = await db.getAll('daily_logs');
  return all
    .filter(l => l.date >= fromDate && l.date <= toDate)
    .sort((a, b) => a.date.localeCompare(b.date));
}
```

- [ ] **Step 4: Run — expect pass**

- [ ] **Step 5: Commit**

```bash
git add src/db/logs.ts tests/db-logs.spec.ts
git commit -m "feat(db): daily logs CRUD"
```

### Task 12: Seed import (TDD, idempotent)

**Files:**
- Copy: `docs/superpowers/specs/seed_foods.json` → `src/assets/seed_foods.json`
- Create: `tests/seed.spec.ts`, `src/lib/seed.ts`

- [ ] **Step 1: Copy seed JSON**

```bash
mkdir -p src/assets
cp docs/superpowers/specs/seed_foods.json src/assets/seed_foods.json
```

- [ ] **Step 2: Write failing test `tests/seed.spec.ts`**

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { resetDBForTests } from '@/db/db';
import { listFoods } from '@/db/foods';
import { runSeedIfEmpty } from '@/lib/seed';

beforeEach(async () => { await resetDBForTests(); });

describe('seed', () => {
  it('seeds 96 foods on first run', async () => {
    await runSeedIfEmpty();
    const foods = await listFoods({ includeDeleted: true });
    expect(foods.length).toBe(96);
    expect(foods.every(f => f.builtin)).toBe(true);
  });

  it('is idempotent: second call does not duplicate', async () => {
    await runSeedIfEmpty();
    await runSeedIfEmpty();
    const foods = await listFoods({ includeDeleted: true });
    expect(foods.length).toBe(96);
  });

  it('preserves user data: when foods exist, skip seed', async () => {
    await runSeedIfEmpty();
    const beforeIds = (await listFoods({ includeDeleted: true })).map(f => f.id).sort();
    await runSeedIfEmpty();
    const afterIds = (await listFoods({ includeDeleted: true })).map(f => f.id).sort();
    expect(afterIds).toEqual(beforeIds);
  });
});
```

- [ ] **Step 3: Run — expect fail**

Run: `npm test -- seed`

- [ ] **Step 4: Implement `src/lib/seed.ts`**

```ts
import seedFoods from '@/assets/seed_foods.json';
import { getDB } from '@/db/db';
import { uuid } from './uuid';
import type { Category } from '@/constants/categories';

interface SeedFood {
  name: string;
  category: Category;
  spec: string;
  carb: number;
  protein: number;
  fat: number;
  note: string | null;
}

export async function runSeedIfEmpty(): Promise<void> {
  const db = await getDB();
  const count = await db.count('foods');
  if (count > 0) return;
  const tx = db.transaction('foods', 'readwrite');
  const now = Date.now();
  for (const f of seedFoods as SeedFood[]) {
    await tx.store.put({
      ...f, id: uuid(), builtin: true, deleted: false,
      createdAt: now, updatedAt: now
    });
  }
  await tx.done;
}
```

- [ ] **Step 5: Run — expect pass**

- [ ] **Step 6: Commit**

```bash
git add src/assets/seed_foods.json src/lib/seed.ts tests/seed.spec.ts
git commit -m "feat(seed): idempotent seed import of 96 foods"
```

---

## Milestone 2 — Today view + food library

### Task 13: Toast store

**Files:**
- Create: `src/stores/toastStore.ts`, `src/components/Toast.vue`

- [ ] **Step 1: Create `src/stores/toastStore.ts`**

```ts
import { defineStore } from 'pinia';
import { ref } from 'vue';

interface ToastMsg { id: number; text: string; kind: 'info' | 'error' }

export const useToast = defineStore('toast', () => {
  const items = ref<ToastMsg[]>([]);
  let nextId = 1;
  function show(text: string, kind: 'info' | 'error' = 'info', ms = 2200) {
    const id = nextId++;
    items.value.push({ id, text, kind });
    setTimeout(() => { items.value = items.value.filter(t => t.id !== id); }, ms);
  }
  return { items, show };
});
```

- [ ] **Step 2: Create `src/components/Toast.vue`**

```vue
<script setup lang="ts">
import { useToast } from '@/stores/toastStore';
const toast = useToast();
</script>

<template>
  <div class="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 space-y-2 pointer-events-none">
    <div v-for="t in toast.items" :key="t.id"
         :class="['px-4 py-2 rounded-full text-sm shadow-lg',
                  t.kind === 'error' ? 'bg-red-600 text-white' : 'bg-slate-800 text-white']">
      {{ t.text }}
    </div>
  </div>
</template>
```

- [ ] **Step 3: Commit**

```bash
git add src/stores/toastStore.ts src/components/Toast.vue
git commit -m "feat: toast store + component"
```

### Task 14: Food store

**Files:**
- Create: `src/stores/foodStore.ts`

- [ ] **Step 1: Implement `src/stores/foodStore.ts`**

```ts
import { defineStore } from 'pinia';
import { ref } from 'vue';
import * as foodsDb from '@/db/foods';
import type { FoodRow } from '@/db/db';

export const useFoodStore = defineStore('food', () => {
  const foods = ref<FoodRow[]>([]);
  const loaded = ref(false);

  async function load() {
    foods.value = await foodsDb.listFoods({ includeDeleted: true });
    loaded.value = true;
  }
  async function add(input: foodsDb.FoodInput) {
    await foodsDb.addFood(input); await load();
  }
  async function update(id: string, patch: Partial<foodsDb.FoodInput>) {
    await foodsDb.updateFood(id, patch); await load();
  }
  async function softDelete(id: string) {
    await foodsDb.softDeleteFood(id); await load();
  }
  async function restore(id: string) {
    await foodsDb.restoreFood(id); await load();
  }
  function byId(id: string) { return foods.value.find(f => f.id === id); }

  return { foods, loaded, load, add, update, softDelete, restore, byId };
});
```

- [ ] **Step 2: Commit**

```bash
git add src/stores/foodStore.ts
git commit -m "feat(store): food store"
```

### Task 15: Daily store (TDD)

**Files:**
- Create: `tests/daily-store.spec.ts`, `src/stores/dailyStore.ts`

- [ ] **Step 1: Write failing test**

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { resetDBForTests } from '@/db/db';
import { addFood } from '@/db/foods';
import { useDailyStore } from '@/stores/dailyStore';

beforeEach(async () => {
  setActivePinia(createPinia());
  await resetDBForTests();
});

describe('dailyStore', () => {
  it('loadDay creates an empty rest log when none exists', async () => {
    const s = useDailyStore();
    await s.loadDay('2026-05-22');
    expect(s.log?.dayType).toBe('rest');
    expect(s.log?.entries).toEqual([]);
  });

  it('addFoodEntry sums totals against food row', async () => {
    const id = await addFood({ name: 'X', category: '主食', spec: '100g', carb: 10, protein: 2, fat: 1, note: null, builtin: false });
    const s = useDailyStore();
    await s.loadDay('2026-05-22');
    await s.addFoodEntry(id, 2);
    expect(s.totals).toEqual({ carb: 20, protein: 4, fat: 2 });
    expect(s.kcal).toBeCloseTo(20*4.1 + 4*4.1 + 2*9.3, 6);
  });

  it('addAdhocEntry contributes to totals', async () => {
    const s = useDailyStore();
    await s.loadDay('2026-05-22');
    await s.addAdhocEntry({ name: 'Z', spec: '一份', carb: 5, protein: 5, fat: 5, amount: 1 });
    expect(s.totals).toEqual({ carb: 5, protein: 5, fat: 5 });
  });

  it('removeEntry recomputes totals', async () => {
    const s = useDailyStore();
    await s.loadDay('2026-05-22');
    await s.addAdhocEntry({ name: 'A', spec: '一份', carb: 1, protein: 1, fat: 1, amount: 1 });
    const eid = s.log!.entries[0].id;
    await s.removeEntry(eid);
    expect(s.totals).toEqual({ carb: 0, protein: 0, fat: 0 });
  });

  it('changeDayType persists', async () => {
    const s = useDailyStore();
    await s.loadDay('2026-05-22');
    await s.changeDayType('training');
    expect(s.log?.dayType).toBe('training');
  });

  it('totals skip soft-deleted foods', async () => {
    const id = await addFood({ name: 'X', category: '主食', spec: '100g', carb: 10, protein: 2, fat: 1, note: null, builtin: false });
    const s = useDailyStore();
    await s.loadDay('2026-05-22');
    await s.addFoodEntry(id, 1);
    const { softDeleteFood } = await import('@/db/foods');
    await softDeleteFood(id);
    await s.loadDay('2026-05-22');
    expect(s.totals).toEqual({ carb: 0, protein: 0, fat: 0 });
  });
});
```

- [ ] **Step 2: Run — expect fail**

Run: `npm test -- daily-store`

- [ ] **Step 3: Implement `src/stores/dailyStore.ts`**

```ts
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import * as logsDb from '@/db/logs';
import * as foodsDb from '@/db/foods';
import type { DailyLogRow, Entry, FoodRow } from '@/db/db';
import type { DayType } from '@/constants/goals';
import { addDays } from '@/lib/date';
import { entryTotals, kcalOf, multipliers, sumTotals, type Nutrients } from '@/lib/calc';
import { WEIGHT_KG } from '@/constants/goals';

export const useDailyStore = defineStore('daily', () => {
  const log = ref<DailyLogRow | null>(null);
  const foodsCache = ref<Map<string, FoodRow>>(new Map());

  async function loadDay(date: string) {
    let existing = await logsDb.getLog(date);
    if (!existing) {
      const prior = await logsDb.getLog(addDays(date, -1));
      const dayType: DayType = prior?.dayType ?? 'rest';
      existing = await logsDb.getOrCreateLog(date, dayType);
    }
    log.value = existing;
    const all = await foodsDb.listFoods({ includeDeleted: true });
    foodsCache.value = new Map(all.map(f => [f.id, f]));
  }

  function nutrientsFor(e: Entry): Nutrients {
    if (e.kind === 'adhoc') return entryTotals({ carb: e.carb, protein: e.protein, fat: e.fat }, e.amount);
    const food = foodsCache.value.get(e.foodId);
    if (!food || food.deleted) return { carb: 0, protein: 0, fat: 0 };
    return entryTotals({ carb: food.carb, protein: food.protein, fat: food.fat }, e.amount);
  }

  const totals = computed<Nutrients>(() =>
    log.value ? sumTotals(log.value.entries.map(nutrientsFor)) : { carb: 0, protein: 0, fat: 0 }
  );
  const kcal = computed(() => kcalOf(totals.value));
  const muls = computed(() => multipliers(totals.value, WEIGHT_KG));

  async function addFoodEntry(foodId: string, amount: number) {
    if (!log.value) return;
    await logsDb.addEntry(log.value.date, { kind: 'food', foodId, amount });
    log.value = await logsDb.getLog(log.value.date) ?? null;
  }
  async function addAdhocEntry(input: Omit<Extract<Entry, { kind: 'adhoc' }>, 'id' | 'kind'>) {
    if (!log.value) return;
    await logsDb.addEntry(log.value.date, { kind: 'adhoc', ...input });
    log.value = await logsDb.getLog(log.value.date) ?? null;
  }
  async function removeEntry(entryId: string) {
    if (!log.value) return;
    await logsDb.removeEntry(log.value.date, entryId);
    log.value = await logsDb.getLog(log.value.date) ?? null;
  }
  async function changeDayType(t: DayType) {
    if (!log.value) return;
    await logsDb.setDayType(log.value.date, t);
    log.value = await logsDb.getLog(log.value.date) ?? null;
  }

  return { log, totals, kcal, muls, loadDay, addFoodEntry, addAdhocEntry, removeEntry, changeDayType };
});
```

- [ ] **Step 4: Run — expect pass**

- [ ] **Step 5: Commit**

```bash
git add src/stores/dailyStore.ts tests/daily-store.spec.ts
git commit -m "feat(store): daily store with totals/kcal/multipliers"
```

### Task 16: Router + bottom tab bar

**Files:**
- Create: `src/router/index.ts`, `src/components/BottomTabBar.vue`
- Create stub views: `src/views/TodayView.vue`, `FoodsView.vue`, `RecipesView.vue`, `HistoryView.vue`, `SettingsView.vue`
- Modify: `src/App.vue`, `src/main.ts`

- [ ] **Step 1: Create stub views**

Each file (`Today/Foods/Recipes/History/Settings`) is the same shape:
```vue
<template><div class="p-4"><h1 class="text-xl font-semibold">{{ title }}</h1></div></template>
<script setup lang="ts">const title = '今日';</script>
```
(replace `'今日'` with `'食物库' / '菜谱' / '历史' / '设置'`).

- [ ] **Step 2: Create `src/router/index.ts`**

```ts
import { createRouter, createWebHashHistory } from 'vue-router';

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/',         component: () => import('@/views/TodayView.vue') },
    { path: '/foods',    component: () => import('@/views/FoodsView.vue') },
    { path: '/recipes',  component: () => import('@/views/RecipesView.vue') },
    { path: '/history',  component: () => import('@/views/HistoryView.vue') },
    { path: '/history/:date', component: () => import('@/views/HistoryDayView.vue') },
    { path: '/settings', component: () => import('@/views/SettingsView.vue') }
  ]
});
```

- [ ] **Step 3: Create stub `HistoryDayView.vue`** (same template-shape as others, title = '当日明细')

- [ ] **Step 4: Create `src/components/BottomTabBar.vue`**

```vue
<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router';
const route = useRoute();
const tabs = [
  { to: '/',         label: '今日' },
  { to: '/foods',    label: '食物' },
  { to: '/recipes',  label: '菜谱' },
  { to: '/history',  label: '历史' },
  { to: '/settings', label: '设置' }
];
function active(to: string) {
  if (to === '/') return route.path === '/';
  return route.path.startsWith(to);
}
</script>

<template>
  <nav class="fixed bottom-0 left-0 right-0 grid grid-cols-5 bg-white border-t border-slate-200 pb-[env(safe-area-inset-bottom)]">
    <RouterLink v-for="t in tabs" :key="t.to" :to="t.to"
      :class="['py-2 text-center text-sm', active(t.to) ? 'text-emerald-600 font-semibold' : 'text-slate-500']">
      {{ t.label }}
    </RouterLink>
  </nav>
</template>
```

- [ ] **Step 5: Update `src/App.vue`**

```vue
<script setup lang="ts">
import { onMounted } from 'vue';
import { runSeedIfEmpty } from '@/lib/seed';
import BottomTabBar from '@/components/BottomTabBar.vue';
import Toast from '@/components/Toast.vue';
onMounted(async () => { await runSeedIfEmpty(); });
</script>

<template>
  <div class="min-h-screen pb-16 text-slate-900">
    <RouterView />
    <Toast />
    <BottomTabBar />
  </div>
</template>
```

- [ ] **Step 6: Update `src/main.ts` to use router**

```ts
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { router } from './router';
import './style.css';

createApp(App).use(createPinia()).use(router).mount('#app');
```

- [ ] **Step 7: Verify dev server**

Run: `npm run dev`. Tap each tab; URL changes; titles render. Refresh stays on same tab.

- [ ] **Step 8: Commit**

```bash
git add src/router src/components/BottomTabBar.vue src/views src/App.vue src/main.ts
git commit -m "feat: router + tab bar + stub views"
```

### Task 17: SegmentedControl component

**Files:**
- Create: `src/components/SegmentedControl.vue`

- [ ] **Step 1: Implement**

```vue
<script setup lang="ts" generic="T extends string">
defineProps<{
  modelValue: T;
  options: { value: T; label: string }[];
}>();
defineEmits<{ 'update:modelValue': [T] }>();
</script>

<template>
  <div class="inline-flex rounded-full bg-slate-100 p-1">
    <button v-for="o in options" :key="o.value"
      :class="['px-4 py-1.5 rounded-full text-sm transition',
               modelValue === o.value ? 'bg-white text-emerald-600 shadow-sm font-medium' : 'text-slate-500']"
      @click="$emit('update:modelValue', o.value)">
      {{ o.label }}
    </button>
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/SegmentedControl.vue
git commit -m "feat(ui): segmented control"
```

### Task 18: MetabolicDial component

**Files:**
- Create: `src/components/MetabolicDial.vue`

- [ ] **Step 1: Implement**

```vue
<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  totals: { carb: number; protein: number; fat: number };
  targets: { carb: number; protein: number; fat: number; kcal: number };
  kcal: number;
  muls: { carb: number; protein: number; fat: number };
}>();

const items = computed(() => [
  { key: 'carb',    label: '碳水', color: '#3b82f6', cur: props.totals.carb,    tgt: props.targets.carb,    unit: 'g' },
  { key: 'protein', label: '蛋白', color: '#10b981', cur: props.totals.protein, tgt: props.targets.protein, unit: 'g' },
  { key: 'fat',     label: '脂肪', color: '#f59e0b', cur: props.totals.fat,     tgt: props.targets.fat,     unit: 'g' }
]);

function pct(cur: number, tgt: number) { return tgt > 0 ? Math.min(cur / tgt, 1.5) : 0; }
function dasharray(cur: number, tgt: number) {
  const c = 2 * Math.PI * 36;
  return `${c * Math.min(pct(cur, tgt), 1)} ${c}`;
}
</script>

<template>
  <div class="rounded-2xl bg-white p-4 shadow-sm">
    <div class="grid grid-cols-3 gap-2 mb-3">
      <div v-for="i in items" :key="i.key" class="flex flex-col items-center">
        <svg width="80" height="80" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="36" stroke="#e5e7eb" stroke-width="6" fill="none" />
          <circle cx="40" cy="40" r="36" :stroke="i.color" stroke-width="6" fill="none"
            stroke-linecap="round" :stroke-dasharray="dasharray(i.cur, i.tgt)"
            transform="rotate(-90 40 40)" />
        </svg>
        <div class="mt-1 text-xs text-slate-500">{{ i.label }}</div>
        <div class="text-sm font-semibold">{{ i.cur.toFixed(1) }}<span class="text-slate-400 text-xs"> / {{ i.tgt.toFixed(0) }}{{ i.unit }}</span></div>
      </div>
    </div>
    <div class="flex justify-between items-baseline border-t border-slate-100 pt-3">
      <div>
        <div class="text-xs text-slate-500">总热量</div>
        <div class="text-lg font-semibold">{{ Math.round(kcal) }}<span class="text-slate-400 text-sm"> / {{ Math.round(targets.kcal) }} kcal</span></div>
      </div>
      <div class="text-right text-xs text-slate-500">
        <div>碳水 {{ muls.carb.toFixed(2) }}× · 蛋白 {{ muls.protein.toFixed(2) }}×</div>
        <div>脂肪 {{ muls.fat.toFixed(2) }}× / kg</div>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/MetabolicDial.vue
git commit -m "feat(ui): metabolic dial component"
```

### Task 19: EntryRow component

**Files:**
- Create: `src/components/EntryRow.vue`

- [ ] **Step 1: Implement**

```vue
<script setup lang="ts">
import type { Entry, FoodRow } from '@/db/db';
import { entryTotals } from '@/lib/calc';

const props = defineProps<{ entry: Entry; food?: FoodRow }>();
defineEmits<{ remove: [string] }>();

function display() {
  if (props.entry.kind === 'food') {
    if (!props.food) return { name: '已删除食物', spec: '', n: { carb: 0, protein: 0, fat: 0 } };
    const n = entryTotals({ carb: props.food.carb, protein: props.food.protein, fat: props.food.fat }, props.entry.amount);
    return { name: props.food.name, spec: `${props.food.spec} × ${props.entry.amount}`, n };
  }
  const n = entryTotals({ carb: props.entry.carb, protein: props.entry.protein, fat: props.entry.fat }, props.entry.amount);
  return { name: props.entry.name + ' (临时)', spec: `${props.entry.spec} × ${props.entry.amount}`, n };
}
const d = display();
</script>

<template>
  <div class="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-100">
    <div>
      <div class="text-sm font-medium">{{ d.name }}</div>
      <div class="text-xs text-slate-500">{{ d.spec }}</div>
    </div>
    <div class="flex items-center gap-3">
      <div class="text-right text-xs text-slate-600 leading-tight">
        <div>碳 {{ d.n.carb.toFixed(1) }}　蛋 {{ d.n.protein.toFixed(1) }}　脂 {{ d.n.fat.toFixed(1) }}</div>
      </div>
      <button class="text-slate-400 px-2" @click="$emit('remove', entry.id)">✕</button>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/EntryRow.vue
git commit -m "feat(ui): entry row component"
```

### Task 20: FoodPicker — food tab

**Files:**
- Create: `src/components/FoodPicker.vue` (food tab only; recipe & adhoc tabs added in later tasks)

- [ ] **Step 1: Implement initial version**

```vue
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/FoodPicker.vue
git commit -m "feat(ui): FoodPicker food tab"
```

### Task 21: TodayView wires it all together

**Files:**
- Replace stub: `src/views/TodayView.vue`

- [ ] **Step 1: Implement**

```vue
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useDailyStore } from '@/stores/dailyStore';
import { useFoodStore } from '@/stores/foodStore';
import { todayKey } from '@/lib/date';
import { targetsFor } from '@/constants/goals';
import MetabolicDial from '@/components/MetabolicDial.vue';
import EntryRow from '@/components/EntryRow.vue';
import SegmentedControl from '@/components/SegmentedControl.vue';
import FoodPicker from '@/components/FoodPicker.vue';

const daily = useDailyStore();
const foods = useFoodStore();
const showPicker = ref(false);

onMounted(async () => {
  await foods.load();
  await daily.loadDay(todayKey());
});

const targets = computed(() => targetsFor(daily.log?.dayType ?? 'rest'));
const dayType = computed({
  get: () => daily.log?.dayType ?? 'rest',
  set: async (v) => { await daily.changeDayType(v); }
});

async function onPickFood(foodId: string, amount: number) {
  await daily.addFoodEntry(foodId, amount);
}
async function onRemove(id: string) { await daily.removeEntry(id); }
</script>

<template>
  <div class="p-4 space-y-3">
    <div class="flex items-center justify-between">
      <div class="text-sm text-slate-500">{{ daily.log?.date }}</div>
      <SegmentedControl v-model="dayType" :options="[
        { value: 'training', label: '力训日' },
        { value: 'rest',     label: '休息日' }
      ]" />
    </div>

    <MetabolicDial :totals="daily.totals" :targets="targets" :kcal="daily.kcal" :muls="daily.muls" />

    <div class="rounded-2xl bg-white shadow-sm overflow-hidden">
      <div class="px-4 py-2 text-xs text-slate-500 border-b border-slate-100">今日明细</div>
      <div v-if="!daily.log?.entries.length" class="px-4 py-8 text-center text-sm text-slate-400">暂无记录，点右下 + 添加</div>
      <EntryRow v-for="e in daily.log?.entries ?? []" :key="e.id"
        :entry="e" :food="e.kind === 'food' ? foods.byId(e.foodId) : undefined"
        @remove="onRemove" />
    </div>

    <button class="fixed bottom-20 right-5 w-14 h-14 rounded-full bg-emerald-500 text-white text-3xl shadow-lg"
      @click="showPicker = true">+</button>

    <FoodPicker :open="showPicker" @close="showPicker = false" @pick-food="onPickFood" />
  </div>
</template>
```

- [ ] **Step 2: Manual verify**

Run `npm run dev`. Switch day type; pick 2 foods; values match hand-calc. Remove an entry; totals update.

- [ ] **Step 3: Commit**

```bash
git add src/views/TodayView.vue
git commit -m "feat(today): dial + entries + picker wiring"
```

### Task 22: FoodEditor + FoodsView

**Files:**
- Create: `src/components/FoodEditor.vue`
- Replace stub: `src/views/FoodsView.vue`

- [ ] **Step 1: Implement `FoodEditor.vue`**

```vue
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
          <label class="block">蛋白 (g)<input v-model.number="form.protein" type="number" step="0.1" class="mt-1 w-full px-3 py-2 rounded-lg bg-slate-100" /></label>
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
```

- [ ] **Step 2: Implement `src/views/FoodsView.vue`**

```vue
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useFoodStore } from '@/stores/foodStore';
import { useToast } from '@/stores/toastStore';
import type { FoodRow } from '@/db/db';
import { CATEGORIES } from '@/constants/categories';
import FoodEditor from '@/components/FoodEditor.vue';

const foods = useFoodStore();
const toast = useToast();
const query = ref('');
const editorOpen = ref(false);
const editing = ref<FoodRow | null>(null);

onMounted(() => foods.load());

const grouped = computed(() => {
  const q = query.value.trim();
  const live = foods.foods.filter(f => !f.deleted && (!q || f.name.includes(q)));
  return CATEGORIES.map(c => [c, live.filter(f => f.category === c)] as const).filter(([, l]) => l.length > 0);
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
```

- [ ] **Step 3: Manual verify**

Add a food → appears under chosen category. Edit → values persist. Delete → disappears from list.

- [ ] **Step 4: Commit**

```bash
git add src/components/FoodEditor.vue src/views/FoodsView.vue
git commit -m "feat(foods): library CRUD UI"
```

---

## Milestone 3 — Recipes + adhoc + history

### Task 23: Recipe store

**Files:**
- Create: `src/stores/recipeStore.ts`

- [ ] **Step 1: Implement**

```ts
import { defineStore } from 'pinia';
import { ref } from 'vue';
import * as recipesDb from '@/db/recipes';
import type { RecipeRow } from '@/db/db';

export const useRecipeStore = defineStore('recipe', () => {
  const recipes = ref<RecipeRow[]>([]);
  async function load() { recipes.value = await recipesDb.listRecipes(); }
  async function add(input: recipesDb.RecipeInput) { await recipesDb.addRecipe(input); await load(); }
  async function update(id: string, patch: Partial<recipesDb.RecipeInput>) { await recipesDb.updateRecipe(id, patch); await load(); }
  async function remove(id: string) { await recipesDb.deleteRecipe(id); await load(); }
  return { recipes, load, add, update, remove };
});
```

- [ ] **Step 2: Commit**

```bash
git add src/stores/recipeStore.ts
git commit -m "feat(store): recipe store"
```

### Task 24: RecipeEditor + RecipesView

**Files:**
- Create: `src/components/RecipeEditor.vue`
- Replace stub: `src/views/RecipesView.vue`

- [ ] **Step 1: Implement `RecipeEditor.vue`**

```vue
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
```

- [ ] **Step 2: Implement `src/views/RecipesView.vue`**

```vue
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
```

- [ ] **Step 3: Commit**

```bash
git add src/components/RecipeEditor.vue src/views/RecipesView.vue
git commit -m "feat(recipes): list + editor"
```

### Task 25: FoodPicker — recipe + adhoc tabs

**Files:**
- Modify: `src/components/FoodPicker.vue`
- Modify: `src/views/TodayView.vue`

- [ ] **Step 1: Update FoodPicker — replace the entire `<script setup>` and `<template>` with the version below**

```vue
<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useFoodStore } from '@/stores/foodStore';
import { useRecipeStore } from '@/stores/recipeStore';
import type { FoodRow, RecipeRow } from '@/db/db';
import { CATEGORIES } from '@/constants/categories';

defineProps<{ open: boolean }>();
const emit = defineEmits<{
  close: [];
  pickFood: [foodId: string, amount: number];
  pickRecipe: [recipe: RecipeRow];
  pickAdhoc: [data: { name: string; spec: string; carb: number; protein: number; fat: number; amount: number }];
}>();

const foods = useFoodStore();
const recipes = useRecipeStore();
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
function confirmRecipe(r: RecipeRow) { emit('pickRecipe', r); emit('close'); }

const adhoc = reactive({ name: '', spec: '一份', carb: 0, protein: 0, fat: 0, amount: 1 });
function confirmAdhoc() {
  if (!adhoc.name.trim()) return;
  emit('pickAdhoc', { ...adhoc, name: adhoc.name.trim(), spec: adhoc.spec || '一份' });
  Object.assign(adhoc, { name: '', spec: '一份', carb: 0, protein: 0, fat: 0, amount: 1 });
  emit('close');
}
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-40 bg-black/40 flex items-end" @click.self="$emit('close')">
    <div class="w-full bg-white rounded-t-2xl max-h-[85vh] flex flex-col">
      <div class="flex border-b border-slate-100">
        <button v-for="t in (['food','recipe','adhoc'] as const)" :key="t" @click="tab = t"
          :class="['py-3 flex-1 text-sm', tab === t ? 'text-emerald-600 font-semibold border-b-2 border-emerald-500' : 'text-slate-500']">
          {{ t === 'food' ? '食物' : t === 'recipe' ? '菜谱' : '临时项' }}
        </button>
      </div>

      <div v-if="tab === 'food'" class="flex-1 overflow-y-auto">
        <div class="p-3"><input v-model="query" placeholder="搜索食物..." class="w-full px-3 py-2 rounded-lg bg-slate-100 text-sm" /></div>
        <template v-if="!picked">
          <div v-for="[cat, list] in grouped" :key="cat">
            <div class="px-4 py-1 text-xs text-slate-500 bg-slate-50">{{ cat }}</div>
            <button v-for="f in list" :key="f.id" class="block w-full text-left px-4 py-2 border-b border-slate-50" @click="pick(f)">
              <div class="text-sm">{{ f.name }}</div>
              <div class="text-xs text-slate-400">{{ f.spec }} · 碳{{ f.carb }} 蛋{{ f.protein }} 脂{{ f.fat }}</div>
            </button>
          </div>
        </template>
        <div v-else class="p-4">
          <div class="text-sm">已选：<b>{{ picked.name }}</b></div>
          <div class="text-xs text-slate-500 mb-3">{{ picked.spec }} · 碳{{ picked.carb }} 蛋{{ picked.protein }} 脂{{ picked.fat }}</div>
          <label class="block text-xs text-slate-500 mb-1">分量倍数</label>
          <input v-model.number="amount" type="number" step="0.1" min="0" class="w-full px-3 py-2 rounded-lg bg-slate-100 text-base" />
          <div class="flex gap-2 mt-3">
            <button class="flex-1 py-2 rounded-full border border-slate-200 text-slate-600" @click="picked = null">返回</button>
            <button class="flex-1 py-2 rounded-full bg-emerald-500 text-white" @click="confirm">添加</button>
          </div>
        </div>
      </div>

      <div v-else-if="tab === 'recipe'" class="flex-1 overflow-y-auto p-3 space-y-2">
        <div v-if="!recipes.recipes.length" class="text-center text-slate-400 text-sm py-8">没有菜谱</div>
        <button v-for="r in recipes.recipes" :key="r.id" class="w-full text-left bg-slate-50 rounded-xl p-3" @click="confirmRecipe(r)">
          <div class="font-medium text-sm">{{ r.name }}</div>
          <div class="text-xs text-slate-500">{{ r.items.length }} 项</div>
        </button>
      </div>

      <div v-else class="flex-1 overflow-y-auto p-3 space-y-2">
        <label class="block text-sm">名称<input v-model="adhoc.name" class="mt-1 w-full px-3 py-2 rounded-lg bg-slate-100" /></label>
        <label class="block text-sm">规格<input v-model="adhoc.spec" class="mt-1 w-full px-3 py-2 rounded-lg bg-slate-100" placeholder="一份" /></label>
        <div class="grid grid-cols-3 gap-2 text-sm">
          <label>碳水<input v-model.number="adhoc.carb" type="number" step="0.1" class="mt-1 w-full px-3 py-2 rounded-lg bg-slate-100" /></label>
          <label>蛋白<input v-model.number="adhoc.protein" type="number" step="0.1" class="mt-1 w-full px-3 py-2 rounded-lg bg-slate-100" /></label>
          <label>脂肪<input v-model.number="adhoc.fat" type="number" step="0.1" class="mt-1 w-full px-3 py-2 rounded-lg bg-slate-100" /></label>
        </div>
        <label class="block text-sm">分量<input v-model.number="adhoc.amount" type="number" step="0.1" min="0" class="mt-1 w-full px-3 py-2 rounded-lg bg-slate-100" /></label>
        <button class="w-full py-2 mt-2 rounded-full bg-emerald-500 text-white" @click="confirmAdhoc">添加</button>
      </div>

      <button class="py-3 text-slate-500 border-t border-slate-100" @click="$emit('close')">关闭</button>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Update `TodayView.vue` to wire new emits**

Add these handlers in the `<script setup>` and pass them to the FoodPicker. Replace the existing `<FoodPicker ...>` line and add the handlers:

```ts
import { useRecipeStore } from '@/stores/recipeStore';
import { useToast } from '@/stores/toastStore';
import type { RecipeRow } from '@/db/db';

const recipeStore = useRecipeStore();
const toast = useToast();

onMounted(async () => { await recipeStore.load(); });

async function onPickRecipe(r: RecipeRow) {
  let skipped = 0;
  for (const item of r.items) {
    const f = foods.byId(item.foodId);
    if (!f || f.deleted) { skipped++; continue; }
    await daily.addFoodEntry(item.foodId, item.amount);
  }
  if (skipped > 0) toast.show(`跳过 ${skipped} 项已删除食物`, 'error');
}
async function onPickAdhoc(d: { name: string; spec: string; carb: number; protein: number; fat: number; amount: number }) {
  await daily.addAdhocEntry(d);
}
```

Update the picker tag in template:
```html
<FoodPicker :open="showPicker" @close="showPicker = false"
  @pick-food="onPickFood" @pick-recipe="onPickRecipe" @pick-adhoc="onPickAdhoc" />
```

- [ ] **Step 3: Manual verify**

Create a recipe → on TodayView, open + → 菜谱 tab → tap recipe → entries appear. Open + → 临时项 → fill form → add.

- [ ] **Step 4: Commit**

```bash
git add src/components/FoodPicker.vue src/views/TodayView.vue
git commit -m "feat(picker): recipe + adhoc tabs"
```

### Task 26: CalendarHeatmap component

**Files:**
- Create: `src/components/CalendarHeatmap.vue`

- [ ] **Step 1: Implement**

```vue
<script setup lang="ts">
import { computed } from 'vue';
import { monthRange } from '@/lib/date';

const props = defineProps<{ yearMonth: string; statusByDate: Record<string, 'green' | 'red' | 'gray' | 'none'> }>();
defineEmits<{ select: [date: string] }>();

const days = computed(() => monthRange(props.yearMonth));
const firstWeekday = computed(() => {
  const [y, m] = props.yearMonth.split('-').map(Number);
  return new Date(y, m - 1, 1).getDay(); // 0=Sun
});
const colors: Record<string, string> = {
  green: 'bg-emerald-500',
  red: 'bg-red-400',
  gray: 'bg-slate-300',
  none: 'bg-transparent border border-slate-200'
};
</script>

<template>
  <div class="grid grid-cols-7 gap-2 text-xs text-center">
    <div v-for="w in ['日','一','二','三','四','五','六']" :key="w" class="text-slate-400">{{ w }}</div>
    <div v-for="i in firstWeekday" :key="'pad'+i"></div>
    <button v-for="d in days" :key="d" class="aspect-square flex items-center justify-center"
      @click="$emit('select', d)">
      <span :class="['w-7 h-7 rounded-full flex items-center justify-center text-white text-xs', colors[statusByDate[d] ?? 'none'], (statusByDate[d] ?? 'none') === 'none' ? 'text-slate-500' : '']">
        {{ Number(d.slice(-2)) }}
      </span>
    </button>
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/CalendarHeatmap.vue
git commit -m "feat(ui): calendar heatmap"
```

### Task 27: HistoryView (calendar) + HistoryDayView

**Files:**
- Replace: `src/views/HistoryView.vue`, `src/views/HistoryDayView.vue`

- [ ] **Step 1: Implement `HistoryView.vue`**

```vue
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { listLogsBetween } from '@/db/logs';
import { kcalOf, sumTotals, entryTotals } from '@/lib/calc';
import { targetsFor } from '@/constants/goals';
import { monthRange } from '@/lib/date';
import { useFoodStore } from '@/stores/foodStore';
import CalendarHeatmap from '@/components/CalendarHeatmap.vue';
import TrendChart from '@/components/TrendChart.vue';
import { useRouter } from 'vue-router';
import type { DailyLogRow, Entry } from '@/db/db';

const router = useRouter();
const foods = useFoodStore();
const tab = ref<'calendar' | 'trend'>('calendar');
const month = ref((() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; })());
const logs = ref<DailyLogRow[]>([]);

onMounted(async () => { await foods.load(); await reload(); });
async function reload() {
  const days = monthRange(month.value);
  logs.value = await listLogsBetween(days[0], days[days.length - 1]);
}

function nutrientsFor(e: Entry) {
  if (e.kind === 'adhoc') return entryTotals({ carb: e.carb, protein: e.protein, fat: e.fat }, e.amount);
  const f = foods.byId(e.foodId);
  if (!f || f.deleted) return { carb: 0, protein: 0, fat: 0 };
  return entryTotals({ carb: f.carb, protein: f.protein, fat: f.fat }, e.amount);
}

const statusByDate = computed<Record<string, 'green' | 'red' | 'gray' | 'none'>>(() => {
  const out: Record<string, 'green' | 'red' | 'gray' | 'none'> = {};
  for (const log of logs.value) {
    const totals = sumTotals(log.entries.map(nutrientsFor));
    const kc = kcalOf(totals);
    const target = targetsFor(log.dayType).kcal;
    const ratio = kc / target;
    out[log.date] = ratio < 0.9 ? 'gray' : ratio > 1.1 ? 'red' : 'green';
  }
  return out;
});

function shiftMonth(delta: number) {
  const [y, m] = month.value.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  month.value = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  reload();
}
function go(date: string) { router.push(`/history/${date}`); }
</script>

<template>
  <div class="p-4 space-y-3">
    <div class="flex justify-between items-center">
      <button class="px-3 py-1 text-sm" @click="shiftMonth(-1)">‹</button>
      <div class="font-semibold">{{ month }}</div>
      <button class="px-3 py-1 text-sm" @click="shiftMonth(1)">›</button>
    </div>
    <div class="flex gap-2">
      <button @click="tab = 'calendar'" :class="['px-3 py-1 rounded-full text-sm', tab === 'calendar' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500']">日历</button>
      <button @click="tab = 'trend'" :class="['px-3 py-1 rounded-full text-sm', tab === 'trend' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500']">趋势</button>
    </div>
    <div v-if="tab === 'calendar'" class="rounded-2xl bg-white shadow-sm p-3">
      <CalendarHeatmap :year-month="month" :status-by-date="statusByDate" @select="go" />
      <div class="mt-3 text-xs text-slate-500 flex gap-4 justify-center">
        <span><span class="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1" />达标</span>
        <span><span class="inline-block w-2 h-2 rounded-full bg-slate-300 mr-1" />不足</span>
        <span><span class="inline-block w-2 h-2 rounded-full bg-red-400 mr-1" />超标</span>
      </div>
    </div>
    <div v-else>
      <TrendChart :logs="logs" :foods="foods.foods" />
    </div>
  </div>
</template>
```

- [ ] **Step 2: Implement `HistoryDayView.vue`**

```vue
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { getLog } from '@/db/logs';
import { useFoodStore } from '@/stores/foodStore';
import { entryTotals, kcalOf, multipliers, sumTotals } from '@/lib/calc';
import { WEIGHT_KG, targetsFor } from '@/constants/goals';
import type { DailyLogRow, Entry } from '@/db/db';
import MetabolicDial from '@/components/MetabolicDial.vue';
import EntryRow from '@/components/EntryRow.vue';

const route = useRoute();
const date = computed(() => String(route.params.date));
const log = ref<DailyLogRow | null>(null);
const foods = useFoodStore();

onMounted(async () => { await foods.load(); log.value = (await getLog(date.value)) ?? null; });

function nutrientsFor(e: Entry) {
  if (e.kind === 'adhoc') return entryTotals({ carb: e.carb, protein: e.protein, fat: e.fat }, e.amount);
  const f = foods.byId(e.foodId);
  if (!f || f.deleted) return { carb: 0, protein: 0, fat: 0 };
  return entryTotals({ carb: f.carb, protein: f.protein, fat: f.fat }, e.amount);
}
const totals = computed(() => log.value ? sumTotals(log.value.entries.map(nutrientsFor)) : { carb: 0, protein: 0, fat: 0 });
const kcal = computed(() => kcalOf(totals.value));
const muls = computed(() => multipliers(totals.value, WEIGHT_KG));
const targets = computed(() => targetsFor(log.value?.dayType ?? 'rest'));
</script>

<template>
  <div class="p-4 space-y-3">
    <div class="text-sm text-slate-500">{{ date }}（{{ log?.dayType === 'training' ? '力训日' : '休息日' }}）</div>
    <div v-if="!log" class="text-center text-slate-400 py-8">无记录</div>
    <template v-else>
      <MetabolicDial :totals="totals" :targets="targets" :kcal="kcal" :muls="muls" />
      <div class="rounded-2xl bg-white shadow-sm overflow-hidden">
        <div class="px-4 py-2 text-xs text-slate-500 border-b border-slate-100">明细</div>
        <EntryRow v-for="e in log.entries" :key="e.id"
          :entry="e" :food="e.kind === 'food' ? foods.byId(e.foodId) : undefined"
          @remove="() => {}" />
      </div>
    </template>
  </div>
</template>
```

- [ ] **Step 3: Commit**

```bash
git add src/views/HistoryView.vue src/views/HistoryDayView.vue
git commit -m "feat(history): calendar view + day detail"
```

### Task 28: TrendChart component

**Files:**
- Create: `src/components/TrendChart.vue`

- [ ] **Step 1: Implement**

```vue
<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import * as echarts from 'echarts/core';
import { LineChart, BarChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { DailyLogRow, Entry, FoodRow } from '@/db/db';
import { entryTotals, kcalOf, sumTotals } from '@/lib/calc';

echarts.use([LineChart, BarChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

const props = defineProps<{ logs: DailyLogRow[]; foods: FoodRow[] }>();
const el = ref<HTMLDivElement | null>(null);
let chart: echarts.ECharts | null = null;

const foodMap = computed(() => new Map(props.foods.map(f => [f.id, f])));

function nutrientsFor(e: Entry) {
  if (e.kind === 'adhoc') return entryTotals({ carb: e.carb, protein: e.protein, fat: e.fat }, e.amount);
  const f = foodMap.value.get(e.foodId);
  if (!f || f.deleted) return { carb: 0, protein: 0, fat: 0 };
  return entryTotals({ carb: f.carb, protein: f.protein, fat: f.fat }, e.amount);
}

const series = computed(() => {
  const sorted = [...props.logs].sort((a, b) => a.date.localeCompare(b.date));
  const dates = sorted.map(l => l.date);
  const carb: number[] = [], protein: number[] = [], fat: number[] = [], kcal: number[] = [];
  for (const log of sorted) {
    const t = sumTotals(log.entries.map(nutrientsFor));
    carb.push(+t.carb.toFixed(1)); protein.push(+t.protein.toFixed(1)); fat.push(+t.fat.toFixed(1));
    kcal.push(Math.round(kcalOf(t)));
  }
  return { dates, carb, protein, fat, kcal };
});

function render() {
  if (!chart) return;
  const s = series.value;
  chart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['碳水', '蛋白', '脂肪', '热量'], top: 0 },
    grid: { top: 30, left: 40, right: 50, bottom: 30 },
    xAxis: { type: 'category', data: s.dates },
    yAxis: [
      { type: 'value', name: 'g' },
      { type: 'value', name: 'kcal', position: 'right' }
    ],
    series: [
      { name: '碳水', type: 'line', data: s.carb,    color: '#3b82f6', smooth: true },
      { name: '蛋白', type: 'line', data: s.protein, color: '#10b981', smooth: true },
      { name: '脂肪', type: 'line', data: s.fat,     color: '#f59e0b', smooth: true },
      { name: '热量', type: 'bar',  data: s.kcal,    yAxisIndex: 1, color: '#cbd5e1', barWidth: 8 }
    ]
  });
}

onMounted(() => {
  if (el.value) { chart = echarts.init(el.value); render(); }
});
onBeforeUnmount(() => { chart?.dispose(); });
watch(() => props.logs, render, { deep: true });
</script>

<template>
  <div ref="el" class="w-full h-72 bg-white rounded-2xl shadow-sm p-2"></div>
</template>
```

- [ ] **Step 2: Manual verify**

Add a few entries on different dates → switch to 趋势 tab → see chart with 4 series.

- [ ] **Step 3: Commit**

```bash
git add src/components/TrendChart.vue
git commit -m "feat(history): trend chart"
```

---

## Milestone 4 — Settings, polish, PWA

### Task 29: Settings (export/import/restore deleted)

**Files:**
- Replace: `src/views/SettingsView.vue`

- [ ] **Step 1: Implement**

```vue
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
```

- [ ] **Step 2: Manual verify**

Export → file downloads. Import same file → no data loss. Reset → returns to 96 seed foods. Soft-delete a food then restore.

- [ ] **Step 3: Commit**

```bash
git add src/views/SettingsView.vue
git commit -m "feat(settings): export/import/restore"
```

### Task 30: PWA assets + final manual checklist

**Files:**
- Add: `public/pwa-192.png`, `public/pwa-512.png`, `public/pwa-512-maskable.png`, `public/favicon.svg`

- [ ] **Step 1: Generate placeholder PWA icons**

Create simple solid-color icons (emerald `#10b981`) at the three sizes. Acceptable placeholder via ImageMagick:

```bash
magick -size 512x512 xc:'#10b981' public/pwa-512.png
magick -size 192x192 xc:'#10b981' public/pwa-192.png
cp public/pwa-512.png public/pwa-512-maskable.png
cat > public/favicon.svg <<'SVG'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#10b981"/></svg>
SVG
```

If ImageMagick unavailable, use any 512×512 / 192×192 PNG of the user's choice.

- [ ] **Step 2: Build production bundle**

Run: `npm run build`
Expected: `dist/` directory built; `dist/manifest.webmanifest` and `dist/sw.js` present.

- [ ] **Step 3: Preview prod and test PWA install**

Run: `npm run preview -- --host`
On Android Chrome at the LAN URL, open menu → "Add to Home screen". Launch from home; should display standalone.

- [ ] **Step 4: Run full manual checklist (from spec §13)**

For each item, confirm pass or fix:
- 96 foods present in 10 categories on first launch
- Add 3 foods + 1 adhoc → totals match hand-calc
- Toggle 力训日 / 休息日 → targets switch
- Close, go offline, reopen → data persists
- "Add to Home screen" launches standalone
- Create recipe + one-tap add → all entries appear
- History calendar shows current day's color
- Export JSON → reset → import → fully restored

- [ ] **Step 5: Commit**

```bash
git add public/
git commit -m "chore: PWA icons + final pass"
```

---

## Notes for the implementer

- Run `npm test` after each TDD task; do not advance until green.
- After every commit, do `git status` to confirm a clean tree.
- If a Vue component imports a not-yet-implemented sibling, stub the sibling first (template returning a placeholder) and refine in the later task.
- The spec is authoritative — when in doubt about a requirement, re-read `docs/superpowers/specs/2026-05-22-daily-nutrition-tracker-design.md`.

