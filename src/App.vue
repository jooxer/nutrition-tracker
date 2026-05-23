<script setup lang="ts">
import { onMounted } from 'vue';
import { runSeedIfEmpty } from '@/lib/seed';
import { useSettingsStore } from '@/stores/settingsStore';
import BottomTabBar from '@/components/BottomTabBar.vue';
import Toast from '@/components/Toast.vue';
const settings = useSettingsStore();
onMounted(async () => {
  await runSeedIfEmpty();
  await settings.load();
});
</script>

<template>
  <div class="min-h-screen pb-[68px] text-slate-900">
    <RouterView />
    <Toast />
    <BottomTabBar />
  </div>
</template>
