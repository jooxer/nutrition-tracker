import { openDB, type IDBPDatabase, type DBSchema } from 'idb';
import type { Category } from '@/constants/categories';
import type { DayType, MealType } from '@/constants/goals';

export interface FoodRow {
  id: string;
  name: string;
  category: Category;
  spec: string;
  carb: number;
  protein: number;
  fat: number;
  note: string | null;
  builtin: boolean;
  deleted: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface RecipeRow {
  id: string;
  name: string;
  items: { foodId: string; amount: number }[];
  createdAt: number;
  updatedAt: number;
}

export type Entry =
  | { id: string; kind: 'food'; foodId: string; amount: number; mealType?: MealType }
  | {
      id: string; kind: 'adhoc';
      name: string; spec: string;
      carb: number; protein: number; fat: number;
      amount: number;
      mealType?: MealType;
    };

export interface DailyLogRow {
  date: string;
  dayType: DayType;
  entries: Entry[];
}

export interface Schema extends DBSchema {
  foods: { key: string; value: FoodRow; indexes: { byCategory: string; byName: string; byDeleted: string } };
  recipes: { key: string; value: RecipeRow };
  daily_logs: { key: string; value: DailyLogRow };
}

export const DB_NAME = 'nutrition-tracker';
export const DB_VERSION = 2;

let _db: IDBPDatabase<Schema> | null = null;

export async function getDB(): Promise<IDBPDatabase<Schema>> {
  if (_db) return _db;
  _db = await openDB<Schema>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const foods = db.createObjectStore('foods', { keyPath: 'id' });
        foods.createIndex('byCategory', 'category');
        foods.createIndex('byName', 'name');
        foods.createIndex('byDeleted', 'deleted');
        db.createObjectStore('recipes', { keyPath: 'id' });
        db.createObjectStore('daily_logs', { keyPath: 'date' });
      }
      // v2: no-op (settings moved to localStorage)
    }
  });
  return _db;
}

export async function resetDBForTests(): Promise<void> {
  if (_db) { _db.close(); _db = null; }
  await new Promise<void>((res, rej) => {
    const r = indexedDB.deleteDatabase(DB_NAME);
    r.onsuccess = () => res(); r.onerror = () => rej(r.error); r.onblocked = () => res();
  });
}
