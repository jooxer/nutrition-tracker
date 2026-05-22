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
