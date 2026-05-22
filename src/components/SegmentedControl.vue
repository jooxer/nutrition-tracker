<script setup lang="ts" generic="T extends string">
defineProps<{
  modelValue: T;
  options: { value: T; label: string }[];
}>();
defineEmits<{ 'update:modelValue': [T] }>();
</script>

<template>
  <div class="inline-flex rounded-full bg-slate-100 p-1">
    <button v-for="o in options" :key="o.value"
      :class="['px-4 py-1.5 rounded-full text-sm transition',
               modelValue === o.value ? 'bg-white text-emerald-600 shadow-sm font-medium' : 'text-slate-500']"
      @click="$emit('update:modelValue', o.value)">
      {{ o.label }}
    </button>
  </div>
</template>
