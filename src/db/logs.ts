import { getDB, type DailyLogRow, type Entry } from './db';
import type { DayType } from '@/constants/goals';
import { uuid } from '@/lib/uuid';

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

export async function addEntry(date: string, input: Omit<Entry, 'id'>): Promise<string> {
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
