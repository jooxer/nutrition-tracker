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
    const r = monthRange('2024-02');
    expect(r[0]).toBe('2024-02-01');
    expect(r[r.length - 1]).toBe('2024-02-29');
    expect(r.length).toBe(29);
  });

  it('addDays handles month rollover', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});
