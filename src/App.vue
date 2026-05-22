<script setup lang="ts">
import { onMounted } from 'vue';
import { runSeedIfEmpty } from '@/lib/seed';
import BottomTabBar from '@/components/BottomTabBar.vue';
import Toast from '@/components/Toast.vue';
onMounted(async () => { await runSeedIfEmpty(); });
</script>

<template>
  <div class="min-h-screen pb-16 text-slate-900">
    <RouterView />
    <Toast />
    <BottomTabBar />
  </div>
</template>
