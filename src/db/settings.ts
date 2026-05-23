import { DEFAULT_MEAL_RATIOS, type MealRatios } from '@/constants/goals';

const KEY_RATIOS = 'nutrition-tracker:mealRatios';

export function getSetting<T>(key: string): T | undefined {
  const raw = localStorage.getItem(key);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

export function setSetting<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function deleteSetting(key: string): void {
  localStorage.removeItem(key);
}

export function getMealRatios(): MealRatios {
  return getSetting<MealRatios>(KEY_RATIOS) ?? DEFAULT_MEAL_RATIOS;
}

export function setMealRatios(ratios: MealRatios): void {
  setSetting(KEY_RATIOS, ratios);
}
