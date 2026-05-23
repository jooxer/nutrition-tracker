import { getDB } from './db';

export async function getSetting<T>(key: string): Promise<T | undefined> {
  const row = await (await getDB()).get('settings', key);
  if (!row) return undefined;
  return (typeof row.value === 'string' ? JSON.parse(row.value) : row.value) as T;
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  await (await getDB()).put('settings', { key, value: JSON.stringify(value) });
}

export async function deleteSetting(key: string): Promise<void> {
  await (await getDB()).delete('settings', key);
}
