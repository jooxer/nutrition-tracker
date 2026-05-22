import { getDB, type FoodRow } from './db';
import { uuid } from '@/lib/uuid';

export type FoodInput = Omit<FoodRow, 'id' | 'deleted' | 'createdAt' | 'updatedAt'>;

export async function addFood(input: FoodInput): Promise<string> {
  const db = await getDB();
  const now = Date.now();
  const id = uuid();
  await db.put('foods', { ...input, id, deleted: false, createdAt: now, updatedAt: now });
  return id;
}

export async function getFood(id: string): Promise<FoodRow | undefined> {
  return (await getDB()).get('foods', id);
}

export async function listFoods(opts: { includeDeleted?: boolean } = {}): Promise<FoodRow[]> {
  const all = await (await getDB()).getAll('foods');
  return opts.includeDeleted ? all : all.filter(f => !f.deleted);
}

export async function updateFood(id: string, patch: Partial<FoodInput>): Promise<void> {
  const db = await getDB();
  const cur = await db.get('foods', id);
  if (!cur) throw new Error(`food ${id} not found`);
  await db.put('foods', { ...cur, ...patch, updatedAt: Date.now() });
}

export async function softDeleteFood(id: string): Promise<void> {
  const db = await getDB();
  const cur = await db.get('foods', id);
  if (!cur) throw new Error(`food ${id} not found`);
  await db.put('foods', { ...cur, deleted: true, updatedAt: Date.now() });
}

export async function restoreFood(id: string): Promise<void> {
  const db = await getDB();
  const cur = await db.get('foods', id);
  if (!cur) throw new Error(`food ${id} not found`);
  await db.put('foods', { ...cur, deleted: false, updatedAt: Date.now() });
}
