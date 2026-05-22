import { defineStore } from 'pinia';
import { ref } from 'vue';

interface ToastMsg { id: number; text: string; kind: 'info' | 'error' }

export const useToast = defineStore('toast', () => {
  const items = ref<ToastMsg[]>([]);
  let nextId = 1;
  function show(text: string, kind: 'info' | 'error' = 'info', ms = 2200) {
    const id = nextId++;
    items.value.push({ id, text, kind });
    setTimeout(() => { items.value = items.value.filter(t => t.id !== id); }, ms);
  }
  return { items, show };
});
