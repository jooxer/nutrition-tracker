import type { Entry } from '@/db/db';
import type { MealType } from '@/constants/goals';
import { sumTotals, type Nutrients } from './calc';

export type MealKey = MealType | 'unset';

export function groupByMeal(
  entries: Entry[],
  nutrientsFor: (e: Entry) => Nutrients
): Record<MealKey, { entries: Entry[]; totals: Nutrients }> {
  const groups: Record<MealKey, { entries: Entry[]; totals: Nutrients }> = {
    breakfast: { entries: [], totals: { carb: 0, protein: 0, fat: 0 } },
    lunch:     { entries: [], totals: { carb: 0, protein: 0, fat: 0 } },
    dinner:    { entries: [], totals: { carb: 0, protein: 0, fat: 0 } },
    snack:     { entries: [], totals: { carb: 0, protein: 0, fat: 0 } },
    unset:     { entries: [], totals: { carb: 0, protein: 0, fat: 0 } }
  };
  for (const e of entries) {
    const k = (e.mealType ?? 'unset') as MealKey;
    groups[k].entries.push(e);
  }
  for (const k of Object.keys(groups) as MealKey[]) {
    groups[k].totals = sumTotals(groups[k].entries.map(nutrientsFor));
  }
  return groups;
}
