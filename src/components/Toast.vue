<script setup lang="ts">
import { useToast } from '@/stores/toastStore';
const toast = useToast();
</script>

<template>
  <div class="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 space-y-2 pointer-events-none">
    <div v-for="t in toast.items" :key="t.id"
         :class="['px-4 py-2 rounded-full text-sm shadow-lg',
                  t.kind === 'error' ? 'bg-red-600 text-white' : 'bg-slate-800 text-white']">
      {{ t.text }}
    </div>
  </div>
</template>
