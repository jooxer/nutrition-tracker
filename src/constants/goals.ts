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
