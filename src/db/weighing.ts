import { getDB, type WeighingItemRow } from './db';
import type { MealType } from '@/constants/goals';
import { uuid } from '@/lib/uuid';

export interface WeighingItemInput {
  foodId: string;
  mealType: MealType;
  before: number;
  after?: number | null;
  note?: string | null;
}

export async function listWeighingItems(): Promise<WeighingItemRow[]> {
  const db = await getDB();
  const all = await db.getAll('weighing_items');
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function addWeighingItem(input: WeighingItemInput): Promise<WeighingItemRow> {
  const db = await getDB();
  const row: WeighingItemRow = {
    id: uuid(),
    foodId: input.foodId,
    mealType: input.mealType,
    before: input.before,
    after: input.after ?? null,
    note: input.note ?? null,
    createdAt: Date.now()
  };
  await db.put('weighing_items', row);
  return row;
}

export async function updateWeighingItem(id: string, patch: Partial<Omit<WeighingItemRow, 'id' | 'createdAt'>>): Promise<void> {
  const db = await getDB();
  const existing = await db.get('weighing_items', id);
  if (!existing) return;
  await db.put('weighing_items', { ...existing, ...patch });
}

export async function deleteWeighingItem(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('weighing_items', id);
}

export async function clearWeighingItems(): Promise<void> {
  const db = await getDB();
  await db.clear('weighing_items');
}
