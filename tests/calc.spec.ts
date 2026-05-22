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
