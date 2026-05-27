import { getDB } from '@/db/db';
import type { DailyLogRow } from '@/db/db';

export interface RecentFood {
  foodId: string;
  count: number;
  lastUsed: string; // date string
}

export async function getRecentFoods(): Promise<RecentFood[]> {
  const db = await getDB();
  const logs: DailyLogRow[] = await db.getAll('daily_logs');
  const map = new Map<string, { count: number; lastUsed: string }>();
  for (const log of logs) {
    for (const e of log.entries) {
      if (e.kind !== 'food') continue;
      const cur = map.get(e.foodId);
      if (!cur) {
        map.set(e.foodId, { count: 1, lastUsed: log.date });
      } else {
        cur.count++;
        if (log.date > cur.lastUsed) cur.lastUsed = log.date;
      }
    }
  }
  return [...map.entries()].map(([foodId, v]) => ({ foodId, ...v }));
}
