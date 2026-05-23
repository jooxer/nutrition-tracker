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
  carbMul: number;
  proteinMul: number;
  fatGram: number;
  totalKcal: number;
}

export const GOALS: Record<DayType, Goal> = {
  training: { carbMul: 2.2, proteinMul: 1.5, fatGram: 60, totalKcal: 2363 * 0.64 },
  rest:     { carbMul: 1.8, proteinMul: 1.5, fatGram: 60, totalKcal: 2163 * 0.64 }
};

// 各餐占比（百分比，加起来 = 100）
export const MEAL_RATIOS: Record<DayType, Record<'carb' | 'protein', Record<MealType, number>>> = {
  training: {
    carb:    { breakfast: 20, lunch: 40, dinner: 30, snack: 10 },
    protein: { breakfast: 20, lunch: 30, dinner: 30, snack: 20 }
  },
  rest: {
    carb:    { breakfast: 20, lunch: 35, dinner: 35, snack: 10 },
    protein: { breakfast: 20, lunch: 30, dinner: 30, snack: 20 }
  }
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

export function mealTargetsFor(dayType: DayType, meal: MealType) {
  const total = targetsFor(dayType);
  const ratios = MEAL_RATIOS[dayType];
  return {
    carb: total.carb * ratios.carb[meal] / 100,
    protein: total.protein * ratios.protein[meal] / 100,
    carbPct: ratios.carb[meal],
    proteinPct: ratios.protein[meal]
  };
}
