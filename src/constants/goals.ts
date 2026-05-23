export const WEIGHT_KG = 62;

export type DayType = 'training' | 'rest';
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export const MEALS: { value: MealType; label: string }[] = [
  { value: 'breakfast', label: '早餐' },
  { value: 'lunch',     label: '午餐' },
  { value: 'dinner',    label: '晚餐' },
  { value: 'snack',     label: '零食' }
];

export const MEAL_LABEL: Record<MealType, string> = {
  breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '零食'
};

export interface Goal {
  carbGram: number;
  proteinGram: number;
  fatGram: number;
  totalKcal: number;
}

export const GOALS: Record<DayType, Goal> = {
  training: { carbGram: 139, proteinGram: 98, fatGram: 60, totalKcal: 2363 * 0.64 },
  rest:     { carbGram: 109, proteinGram: 98, fatGram: 60, totalKcal: 2163 * 0.64 }
};

export type MealRatios = Record<DayType, Record<'carb' | 'protein', Record<MealType, number>>>;

// 各餐占比（百分比，加起来 = 100）
export const DEFAULT_MEAL_RATIOS: MealRatios = {
  training: {
    carb:    { breakfast: 20, lunch: 40, dinner: 30, snack: 10 },
    protein: { breakfast: 20, lunch: 30, dinner: 30, snack: 20 }
  },
  rest: {
    carb:    { breakfast: 20, lunch: 35, dinner: 35, snack: 10 },
    protein: { breakfast: 20, lunch: 30, dinner: 30, snack: 20 }
  }
};

// 兼容旧引用名
export const MEAL_RATIOS = DEFAULT_MEAL_RATIOS;

export function targetsFor(dayType: DayType) {
  const g = GOALS[dayType];
  return {
    carb: g.carbGram,
    protein: g.proteinGram,
    fat: g.fatGram,
    kcal: g.totalKcal
  };
}

export function mealTargetsFor(dayType: DayType, meal: MealType, ratios: MealRatios = DEFAULT_MEAL_RATIOS) {
  const total = targetsFor(dayType);
  const r = ratios[dayType];
  return {
    carb: total.carb * r.carb[meal] / 100,
    protein: total.protein * r.protein[meal] / 100,
    carbPct: r.carb[meal],
    proteinPct: r.protein[meal]
  };
}
