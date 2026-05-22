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
