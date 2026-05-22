import { createRouter, createWebHashHistory } from 'vue-router';

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/',         component: () => import('@/views/TodayView.vue') },
    { path: '/foods',    component: () => import('@/views/FoodsView.vue') },
    { path: '/recipes',  component: () => import('@/views/RecipesView.vue') },
    { path: '/history',  component: () => import('@/views/HistoryView.vue') },
    { path: '/history/:date', component: () => import('@/views/HistoryDayView.vue') },
    { path: '/settings', component: () => import('@/views/SettingsView.vue') }
  ]
});
