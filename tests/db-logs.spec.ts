import { beforeEach, describe, expect, it } from 'vitest';
import { resetDBForTests } from '@/db/db';
import { getOrCreateLog, addEntry, removeEntry, updateEntry, setDayType, listLogsBetween, getLog } from '@/db/logs';

beforeEach(async () => { await resetDBForTests(); });

describe('daily_logs', () => {
  it('getOrCreateLog creates with provided dayType', async () => {
    const log = await getOrCreateLog('2026-05-22', 'training');
    expect(log.date).toBe('2026-05-22');
    expect(log.dayType).toBe('training');
    expect(log.entries).toEqual([]);
  });

  it('getOrCreateLog returns existing log without overwriting dayType', async () => {
    await getOrCreateLog('2026-05-22', 'training');
    const log = await getOrCreateLog('2026-05-22', 'rest');
    expect(log.dayType).toBe('training');
  });

  it('addEntry appends to entries', async () => {
    await getOrCreateLog('2026-05-22', 'rest');
    await addEntry('2026-05-22', { kind: 'food', foodId: 'f1', amount: 1.5 });
    await addEntry('2026-05-22', { kind: 'adhoc', name: 'X', spec: '一份', carb: 1, protein: 1, fat: 1, amount: 1 });
    const log = await getLog('2026-05-22');
    expect(log!.entries.length).toBe(2);
    expect(log!.entries[0]).toMatchObject({ kind: 'food', foodId: 'f1', amount: 1.5 });
    expect(log!.entries[0].id).toBeDefined();
  });

  it('removeEntry by id', async () => {
    await getOrCreateLog('2026-05-22', 'rest');
    const eid = await addEntry('2026-05-22', { kind: 'food', foodId: 'f1', amount: 1 });
    await removeEntry('2026-05-22', eid);
    expect((await getLog('2026-05-22'))!.entries.length).toBe(0);
  });

  it('updateEntry patches amount and mealType', async () => {
    await getOrCreateLog('2026-05-22', 'rest');
    const eid = await addEntry('2026-05-22', { kind: 'food', foodId: 'f1', amount: 1, mealType: 'breakfast' });
    await updateEntry('2026-05-22', eid, { amount: 2.5, mealType: 'dinner' });
    const log = await getLog('2026-05-22');
    expect(log!.entries[0]).toMatchObject({ id: eid, amount: 2.5, mealType: 'dinner' });
  });

  it('updateEntry no-op for unknown id', async () => {
    await getOrCreateLog('2026-05-22', 'rest');
    await addEntry('2026-05-22', { kind: 'food', foodId: 'f1', amount: 1 });
    await updateEntry('2026-05-22', 'nonexistent', { amount: 99 });
    const log = await getLog('2026-05-22');
    expect(log!.entries[0].amount).toBe(1);
  });

  it('setDayType updates type', async () => {
    await getOrCreateLog('2026-05-22', 'rest');
    await setDayType('2026-05-22', 'training');
    expect((await getLog('2026-05-22'))!.dayType).toBe('training');
  });

  it('listLogsBetween filters inclusive', async () => {
    await getOrCreateLog('2026-05-20', 'rest');
    await getOrCreateLog('2026-05-21', 'rest');
    await getOrCreateLog('2026-05-22', 'rest');
    const out = await listLogsBetween('2026-05-21', '2026-05-22');
    expect(out.map(l => l.date)).toEqual(['2026-05-21', '2026-05-22']);
  });
});
