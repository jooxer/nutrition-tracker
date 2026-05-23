import { getDB, type DailyLogRow, type Entry } from './db';
import type { DayType } from '@/constants/goals';
import { uuid } from '@/lib/uuid';

type DistributiveOmit<T, K extends keyof any> = T extends any ? Omit<T, K> : never;
export type EntryInput = DistributiveOmit<Entry, 'id'>;

export async function getLog(date: string): Promise<DailyLogRow | undefined> {
  return (await getDB()).get('daily_logs', date);
}

export async function getOrCreateLog(date: string, dayType: DayType): Promise<DailyLogRow> {
  const db = await getDB();
  const existing = await db.get('daily_logs', date);
  if (existing) return existing;
  const fresh: DailyLogRow = { date, dayType, entries: [] };
  await db.put('daily_logs', fresh);
  return fresh;
}

export async function addEntry(date: string, input: EntryInput): Promise<string> {
  const db = await getDB();
  const log = await db.get('daily_logs', date);
  if (!log) throw new Error(`log ${date} not found`);
  const id = uuid();
  const entry = { id, ...input } as Entry;
  log.entries.push(entry);
  await db.put('daily_logs', log);
  return id;
}

export async function removeEntry(date: string, entryId: string): Promise<void> {
  const db = await getDB();
  const log = await db.get('daily_logs', date);
  if (!log) return;
  log.entries = log.entries.filter(e => e.id !== entryId);
  await db.put('daily_logs', log);
}

export async function updateEntry(
  date: string,
  entryId: string,
  patch: { amount?: number; mealType?: import('@/constants/goals').MealType }
): Promise<void> {
  const db = await getDB();
  const log = await db.get('daily_logs', date);
  if (!log) return;
  const idx = log.entries.findIndex(e => e.id === entryId);
  if (idx === -1) return;
  log.entries[idx] = { ...log.entries[idx], ...patch };
  await db.put('daily_logs', log);
}

export async function setDayType(date: string, dayType: DayType): Promise<void> {
  const db = await getDB();
  const log = await db.get('daily_logs', date);
  if (!log) throw new Error(`log ${date} not found`);
  log.dayType = dayType;
  await db.put('daily_logs', log);
}

export async function listLogsBetween(fromDate: string, toDate: string): Promise<DailyLogRow[]> {
  const db = await getDB();
  const all = await db.getAll('daily_logs');
  return all
    .filter(l => l.date >= fromDate && l.date <= toDate)
    .sort((a, b) => a.date.localeCompare(b.date));
}
