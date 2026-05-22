<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router';
const route = useRoute();
const tabs = [
  { to: '/',         label: '今日' },
  { to: '/foods',    label: '食物' },
  { to: '/recipes',  label: '菜谱' },
  { to: '/history',  label: '历史' },
  { to: '/settings', label: '设置' }
];
function active(to: string) {
  if (to === '/') return route.path === '/';
  return route.path.startsWith(to);
}
</script>

<template>
  <nav class="fixed bottom-0 left-0 right-0 grid grid-cols-5 bg-white border-t border-slate-200 pb-[env(safe-area-inset-bottom)]">
    <RouterLink v-for="t in tabs" :key="t.to" :to="t.to"
      :class="['py-2 text-center text-sm', active(t.to) ? 'text-emerald-600 font-semibold' : 'text-slate-500']">
      {{ t.label }}
    </RouterLink>
  </nav>
</template>
