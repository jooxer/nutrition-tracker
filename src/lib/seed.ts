import seedFoods from '@/assets/seed_foods.json';
import { getDB } from '@/db/db';
import { uuid } from './uuid';
import type { Category } from '@/constants/categories';

interface SeedFood {
  name: string;
  category: Category;
  spec: string;
  carb: number;
  protein: number;
  fat: number;
  note: string | null;
}

export async function runSeedIfEmpty(): Promise<void> {
  const db = await getDB();
  const count = await db.count('foods');
  if (count > 0) return;
  const tx = db.transaction('foods', 'readwrite');
  const now = Date.now();
  for (const f of seedFoods as SeedFood[]) {
    await tx.store.put({
      ...f, id: uuid(), builtin: true, deleted: false,
      createdAt: now, updatedAt: now
    });
  }
  await tx.done;
}
