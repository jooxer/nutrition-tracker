<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router';
const route = useRoute();
const tabs = [
  { to: '/',         label: '今日',   icon: 'today' },
  { to: '/foods',    label: '食物',   icon: 'foods' },
  { to: '/recipes',  label: '菜谱',   icon: 'recipes' },
  { to: '/history',  label: '历史',   icon: 'history' },
  { to: '/settings', label: '设置',   icon: 'settings' }
];
function active(to: string) {
  if (to === '/') return route.path === '/';
  return route.path.startsWith(to);
}
</script>

<template>
  <nav class="fixed bottom-0 left-0 right-0 grid grid-cols-5 bg-white/95 backdrop-blur border-t border-slate-200 pb-[env(safe-area-inset-bottom)] z-30">
    <RouterLink v-for="t in tabs" :key="t.to" :to="t.to"
      :class="['py-1.5 flex flex-col items-center gap-0.5 text-[11px]',
        active(t.to) ? 'text-emerald-600' : 'text-slate-400']">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <template v-if="t.icon === 'today'">
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 9h18M8 3v4M16 3v4" />
        </template>
        <template v-else-if="t.icon === 'foods'">
          <path d="M4 11h16M4 11l1 9h14l1-9M4 11V8a4 4 0 014-4h8a4 4 0 014 4v3" />
        </template>
        <template v-else-if="t.icon === 'recipes'">
          <path d="M4 6h16M4 12h16M4 18h10" />
        </template>
        <template v-else-if="t.icon === 'history'">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </template>
        <template v-else>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3h0a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5h0a1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8v0a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />
        </template>
      </svg>
      <span :class="active(t.to) ? 'font-semibold' : ''">{{ t.label }}</span>
    </RouterLink>
  </nav>
</template>
