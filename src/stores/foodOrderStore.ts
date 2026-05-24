import { defineStore } from 'pinia';
import { ref } from 'vue';
import { getSetting, setSetting } from '@/db/settings';

const KEY = 'nutrition-tracker:foodOrder';
type OrderMap = Record<string, string[]>;

export const useFoodOrderStore = defineStore('foodOrder', () => {
  const orders = ref<OrderMap>(getSetting<OrderMap>(KEY) ?? {});

  function persist() { setSetting(KEY, orders.value); }

  function sort<T extends { id: string; name: string }>(category: string, list: T[]): T[] {
    const order = orders.value[category] ?? [];
    const idx = new Map(order.map((id, i) => [id, i] as const));
    return [...list].sort((a, b) => {
      const ai = idx.get(a.id) ?? Number.MAX_SAFE_INTEGER;
      const bi = idx.get(b.id) ?? Number.MAX_SAFE_INTEGER;
      if (ai !== bi) return ai - bi;
      return a.name.localeCompare(b.name, 'zh-Hans-CN');
    });
  }

  function move(category: string, sortedIds: string[], from: number, to: number) {
    if (from === to) return;
    if (from < 0 || from >= sortedIds.length) return;
    if (to < 0 || to >= sortedIds.length) return;
    const next = [...sortedIds];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    orders.value = { ...orders.value, [category]: next };
    persist();
  }

  function reset(category: string) {
    const next = { ...orders.value };
    delete next[category];
    orders.value = next;
    persist();
  }

  return { orders, sort, move, reset };
});
