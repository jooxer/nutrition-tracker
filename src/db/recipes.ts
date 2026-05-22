import { getDB, type RecipeRow } from './db';
import { uuid } from '@/lib/uuid';

export type RecipeInput = Pick<RecipeRow, 'name' | 'items'>;

export async function addRecipe(input: RecipeInput): Promise<string> {
  const db = await getDB();
  const now = Date.now();
  const id = uuid();
  await db.put('recipes', { ...input, id, createdAt: now, updatedAt: now });
  return id;
}

export async function getRecipe(id: string): Promise<RecipeRow | undefined> {
  return (await getDB()).get('recipes', id);
}

export async function listRecipes(): Promise<RecipeRow[]> {
  return (await getDB()).getAll('recipes');
}

export async function updateRecipe(id: string, patch: Partial<RecipeInput>): Promise<void> {
  const db = await getDB();
  const cur = await db.get('recipes', id);
  if (!cur) throw new Error(`recipe ${id} not found`);
  await db.put('recipes', { ...cur, ...patch, updatedAt: Date.now() });
}

export async function deleteRecipe(id: string): Promise<void> {
  await (await getDB()).delete('recipes', id);
}
