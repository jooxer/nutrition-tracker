# 每日营养热量追踪 PWA — 设计文档

日期：2026-05-22
作者：与用户共同设计
状态：草稿

## 1. 背景与目标

用户目前用 Excel 表 `食物营养热量计算.xlsx` 记录每日饮食。表里维护了约 96 项常用食物（含规格与单份的碳水/蛋白/脂肪克数），每天填入分量倍数后汇总当日总碳/总蛋/总脂、总热量与体重倍数；并保存"力训日 / 休息日"两组目标值用于对比。

需要把表格能力做成一个本地、轻量的 PWA 应用，安装到 Android 手机主屏幕上每日使用。功能定位类似薄荷健康，但仅个人使用、不联网、不需登录。

## 2. 范围与非目标

**做什么**

- 食物库：分类管理预置 + 自定义食物（增/删/改/恢复）
- 加餐：从食物库或菜谱选食物，输入分量倍数，加入当日
- 今日代谢盘：实时显示当日总碳/总蛋/总脂/总热量/体重倍数，并与"力训日 / 休息日"目标对比
- 菜谱：把若干食物 + 默认分量打包，一键整组加入今日
- 临时项：表里无收录的食物，手填三大营养后只加入今日、不入库
- 历史：日历视图 + 每日明细 + 趋势图（7 / 30 天）
- 数据备份：导出 / 导入 JSON

**不做**

- 多用户、登录注册、云同步
- 实时联网查询食物营养（薄荷 API 等）
- 体重 / 目标动态调整（写死在常量文件，重新部署即可改）
- 推送通知、健康打卡社交
- iOS App / 应用商店上架

## 3. 技术选型

- **框架**：Vue 3 (Composition API) + Vite
- **样式**：Tailwind CSS
- **路由**：vue-router
- **状态**：Pinia
- **本地存储**：IndexedDB（通过 `idb` 库封装）
- **PWA**：`vite-plugin-pwa`（manifest + service worker）
- **图表**：ECharts（趋势图）
- **测试**：Vitest + `fake-indexeddb`（计算与存储单测）；UI 手动验收

理由：用户为个人使用、希望"轻量易上手"；中文生态成熟、文档可查；PWA 装到主屏幕等同 App 体验，无需 Android 构建链。

## 4. 架构

```
┌─────────────────────────────────────┐
│  UI 层（Vue 3 SFC + Tailwind）       │
│  - 今日 / 食物库 / 菜谱 / 历史 / 设置 │
└─────────────────────────────────────┘
                  ↕
┌─────────────────────────────────────┐
│  Store（Pinia）                       │
│  - foodStore：食物 CRUD               │
│  - dailyStore：当日记录、汇总计算      │
│  - recipeStore：菜谱 CRUD             │
│  - settingsStore：dayType 等会话设置  │
└─────────────────────────────────────┘
                  ↕
┌─────────────────────────────────────┐
│  数据层（src/db/）                    │
│  - db.ts：IndexedDB schema & 升级    │
│  - foods.ts / recipes.ts / logs.ts  │
└─────────────────────────────────────┘
                  ↕
┌─────────────────────────────────────┐
│  常量（src/constants/goals.ts）       │
│  - weight = 62                       │
│  - training / rest 目标值（写死）     │
└─────────────────────────────────────┘
```

每层职责单一：UI 只渲染 + 转发动作；Store 持有内存状态、做计算、调用数据层；数据层只关心 IndexedDB；常量层是纯静态配置。计算逻辑放 `src/lib/calc.ts`（纯函数，无依赖），便于单测。

### 4.1 目录结构

```
src/
  main.ts
  App.vue
  router/index.ts
  views/
    TodayView.vue
    FoodsView.vue
    RecipesView.vue
    HistoryView.vue
    SettingsView.vue
  components/
    MetabolicDial.vue        # 今日代谢盘（三大营养环）
    EntryRow.vue             # 当日明细一行
    FoodPicker.vue           # 加餐弹层（搜索/选择/分量）
    FoodEditor.vue           # 新增/编辑食物
    RecipeEditor.vue
    CalendarHeatmap.vue      # 历史日历热力
    TrendChart.vue
  stores/
    foodStore.ts
    dailyStore.ts
    recipeStore.ts
    settingsStore.ts
  db/
    db.ts
    foods.ts
    recipes.ts
    logs.ts
  lib/
    calc.ts                  # 纯计算函数
    date.ts                  # 日期工具（取本地日 yyyy-mm-dd）
    seed.ts                  # 初始化预置食物
  constants/
    goals.ts
    categories.ts
  assets/
    seed_foods.json          # 96 项预置数据
tests/
  calc.spec.ts
  foods.spec.ts
  logs.spec.ts
```

## 5. 数据模型

### 5.1 IndexedDB Schema

数据库名 `nutrition-tracker`，版本 1。

**Object Store: `foods`**

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | string (主键) | UUID v4 |
| name | string | 食物名称 |
| category | string | 分类（见 4.2） |
| spec | string | 规格说明，如 `100g`、`一颗6g`、`单人份` |
| carb | number | 单份碳水克数 |
| protein | number | 单份蛋白克数 |
| fat | number | 单份脂肪克数 |
| note | string \| null | 备注 |
| builtin | boolean | true=预置项，false=自建 |
| deleted | boolean | 软删标记 |
| createdAt | number | 时间戳 |
| updatedAt | number | 时间戳 |

索引：`category`、`name`、`deleted`。

**Object Store: `recipes`**

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | string | UUID |
| name | string | 菜谱名 |
| items | `{ foodId: string, amount: number }[]` | 组成项 |
| createdAt / updatedAt | number | |

**Object Store: `daily_logs`**

主键 `date`（字符串 `YYYY-MM-DD`，使用设备本地时区）。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| date | string | 主键 |
| dayType | `'training' \| 'rest'` | 当日类型 |
| entries | `Entry[]` | 见下 |

`Entry`：

```ts
type Entry =
  | { id: string; kind: 'food'; foodId: string; amount: number }
  | {
      id: string;
      kind: 'adhoc';
      name: string;
      spec: string;
      carb: number;
      protein: number;
      fat: number;
      amount: number;
    };
```

### 5.2 静态常量

`src/constants/goals.ts`：

```ts
export const WEIGHT_KG = 62;

export const GOALS = {
  training: {
    carbMul: 2.2,             // g / kg
    proteinMul: 1.5,          // g / kg
    fatGram: 60,              // g (绝对值)
    totalKcal: 2363 * 0.64,   // = 1512.32
  },
  rest: {
    carbMul: 1.8,
    proteinMul: 1.5,
    fatGram: 60,
    totalKcal: 2163 * 0.64,   // = 1384.32
  },
} as const;
```

`src/constants/categories.ts`（用于食物库排序与下拉）：

```ts
export const CATEGORIES = [
  '主食', '水果', '碳水其他', '蛋白', '脂肪',
  '混合', 'KFC', '德克士', '喜茶', '茉莉奶白', '其他',
] as const;
```

### 5.3 预置食物数据

从源 Excel 提取 96 项 → `src/assets/seed_foods.json`。每项含 `name / category / spec / carb / protein / fat / note`。首次启动时由 `lib/seed.ts` 写入 `foods` 表，每条 `builtin = true`、`deleted = false`、随机 UUID。

种子文件已生成于 `docs/superpowers/specs/seed_foods.json`，实现时复制到 `src/assets/`。

分类分布：主食 24 / 喜茶 18 / 蛋白 13 / 脂肪 12 / 碳水其他 9 / 混合 7 / 德克士 6 / 水果 4 / KFC 2 / 茉莉奶白 1。

## 6. 计算公式（`src/lib/calc.ts`）

抄自原 Excel：

```
单项贡献：
  carb_total_i    = food.carb    × entry.amount
  protein_total_i = food.protein × entry.amount
  fat_total_i     = food.fat     × entry.amount

当日汇总：
  total.carb    = Σ carb_total_i
  total.protein = Σ protein_total_i
  total.fat     = Σ fat_total_i

热量（kcal）：
  total.kcal = total.carb × 4.1 + total.protein × 4.1 + total.fat × 9.3

体重倍数（g / kg）：
  mul.carb    = total.carb    / WEIGHT_KG
  mul.protein = total.protein / WEIGHT_KG
  mul.fat     = total.fat     / WEIGHT_KG
```

目标值（用于对比）：

```
target.carb    = goal.carbMul    × WEIGHT_KG
target.protein = goal.proteinMul × WEIGHT_KG
target.fat     = goal.fatGram
target.kcal    = goal.totalKcal
```

显示精度：克数保留 1 位小数，热量保留整数，倍数保留 2 位小数。

## 7. 页面与交互

### 7.1 路由

| 路径 | 视图 |
| --- | --- |
| `/` | TodayView |
| `/foods` | FoodsView |
| `/recipes` | RecipesView |
| `/history` | HistoryView |
| `/history/:date` | 日明细（HistoryView 内子视图或路由参数） |
| `/settings` | SettingsView |

底部 Tab Bar：今日 / 食物库 / 菜谱 / 历史 / 设置。

### 7.2 今日（首页）

- 顶部：日期、`力训日 / 休息日` 切换（Segmented Control，写入当日 log 的 `dayType`）
- 代谢盘（`MetabolicDial`）：三色圆环（碳/蛋/脂），每环显示 `当前 / 目标`；中央显示总热量进度，下方一行显示体重倍数
- 当日明细：餐项列表（按添加顺序），每行：食物名 · 规格 × 分量 · 三大营养。左滑或长按删除
- 右下浮动 `+` 按钮 → `FoodPicker` 弹层

### 7.3 加餐弹层（`FoodPicker`）

弹层顶部三个 tab：

1. **食物**：搜索框 + 分类分组列表（默认按上次使用频率或字母序）。点中条目 → 输入分量（默认 1，键盘数字 + 0.1/0.5 快捷加减按钮）→ 确认
2. **菜谱**：菜谱列表，点 → 整组按预设分量加入（一次性产生多条 entries）
3. **临时项**：表单（名称 / 规格（可选，默认"一份"）/ 单份碳 / 单份蛋 / 单份脂 / 分量），确认后只加入今日 entries（`kind: 'adhoc'`），不入库

### 7.4 食物库

- 顶部搜索框 + 分类筛选
- 按分类分组（折叠组），每条显示名称、规格、单份三大营养
- 右下 `+` 新增 → `FoodEditor`
- 每条食物末尾有 `⋯` 菜单按钮 → `编辑 / 删除`。`builtin=true` 也可编辑或删除（软删，可在设置中恢复）
- 列表查询自动过滤 `deleted=true`，仅"设置 → 已删除的食物"页面显示软删项

### 7.5 菜谱

- 列表显示菜谱名 + 组成项预览
- 新建/编辑：填名称，添加食物条目（每条选食物 + 默认 amount）
- 删除（硬删，菜谱无 builtin 概念）

### 7.6 历史

- 顶部 Tab：日历 / 趋势
- **日历**：月历视图，每天显示一个色点
  - 绿：总热量在目标 ±10% 内
  - 灰：低于目标 −10%
  - 红：高于目标 +10%
  - 无：未记录
  - 点某日 → 跳到 `/history/:date`，复用今日代谢盘 + 明细列表的只读形态
- **趋势**：折线图，可选 7 / 30 天，三条线（碳/蛋/脂克数）+ 一条热量柱状图叠加；横轴日期、可触摸查看具体值

### 7.7 设置

- 数据：导出 JSON / 导入 JSON（覆盖式，导入前确认）
- 已删除的食物：列表 + 恢复按钮（仅展示 `deleted=true` 的项）
- 关于：版本号、源表说明

## 8. 关键流程

### 8.1 首次启动

1. 打开 IndexedDB（若不存在则建表）
2. 检查 `foods` 表是否为空；为空 → 读取 `seed_foods.json`，逐条写入（`builtin=true`）
3. 初始化空 `daily_logs[today]`（懒：第一次加餐时再写）

### 8.2 加餐（食物）

1. 用户在 `FoodPicker` 选食物 + 分量
2. `dailyStore.addEntry({ kind:'food', foodId, amount })`
3. 若当天 log 不存在 → 创建（`dayType` 默认沿用前一天的 log；找不到则默认 `rest`）
4. 写 IndexedDB；UI 重算汇总并刷新代谢盘

### 8.3 切换日类型

1. 用户在今日页切 `力训日 / 休息日`
2. 当日 log 的 `dayType` 更新；目标值切换
3. 代谢盘按新目标重渲

### 8.4 跨日

- 首页打开时取设备本地 `YYYY-MM-DD` 作为当日 key
- 不做"凌晨切日提醒"，依赖系统时钟即可
- 历史页通过 `IDBKeyRange` 范围查询所有 logs

### 8.5 导出 / 导入

- 导出：dump `foods`、`recipes`、`daily_logs` 三表 + schema version → 文件 `nutrition-tracker-backup-YYYYMMDD.json`
- 导入：解析、二次确认（"将覆盖现有所有数据"）、清空三表、写入

## 9. 错误处理 / 边界

| 情况 | 处理 |
| --- | --- |
| IndexedDB 打开失败（隐私模式等） | 显示错误页 + 说明，不进入主流程 |
| 写入失败 | toast 提示，内存状态保留，下次操作重试 |
| 食物在某条 entry 引用后被软删 | 历史 entry 仍按当时的 foodId 查询；查询不到时显示"已删除食物"占位（保留克数） |
| 菜谱引用已删除食物 | 加入今日时跳过该条并 toast 提示，其余正常加入 |
| 导入 JSON 缺字段 / 版本不符 | 拒绝导入并显示原因 |
| 同名食物多次新增 | 允许（用户自行判断），按 ID 区分 |
| 临时项编辑 | 不支持，错了删除重加 |

## 10. PWA / 移动端

- `manifest.webmanifest`：name = "营养计算"，display = `standalone`，theme = 主色
- icons：512 / 192 / maskable
- service worker：缓存 app shell + seed_foods.json；策略 `NetworkFirst` for HTML，`CacheFirst` for assets
- 视口：`viewport-fit=cover`，安全区域 padding
- 最低支持：Android Chrome 100+、Safari iOS 15+（即便不上 iOS 也保持兼容）

## 11. 测试

| 范围 | 形式 |
| --- | --- |
| `calc.ts` 单项 / 汇总 / 热量 / 倍数 | Vitest 纯函数单测，至少 8 例（含边界：0、空数组、混合 food + adhoc） |
| `db/*.ts` 读写 | Vitest + fake-indexeddb，每个表的 CRUD |
| seed 初始化幂等性 | 单测：执行两次只写一次 |
| 关键 store actions | Vitest 集成测（addEntry / removeEntry / setDayType） |
| UI | 手动验收清单（见 §13） |

## 12. 里程碑（粗）

1. M1：脚手架 + PWA 配置 + IndexedDB 基础设施 + seed 导入 + 计算函数与测试
2. M2：食物库页面 CRUD + 今日页加餐与代谢盘
3. M3：菜谱 + 临时项
4. M4：历史日历 + 日明细
5. M5：趋势图 + 设置（导入导出 / 已删除恢复）

每个里程碑独立可用，可逐步上线。

## 13. 手动验收清单

- 首次打开 → 食物库显示 96 项 / 10 类，无报错
- 加 3 项不同食物 + 1 项临时项 → 代谢盘的总碳/总蛋/总脂/总热量与手算一致
- 切换力训日 / 休息日 → 目标数值切换
- 关闭浏览器、断网、重开 → 数据仍在
- 装到主屏幕（"添加到主屏幕"）→ 全屏打开
- 新建菜谱 + 一键加入 → entries 多条生成正确
- 历史日历显示当天色点正确
- 导出 JSON → 清空 IndexedDB → 导入 → 数据完全恢复
