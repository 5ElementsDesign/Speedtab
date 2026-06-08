<script setup lang="ts">
defineProps<{
  title:        string
  description?: string
  icon?:        string
}>()
</script>

<template>
  <div
    class="st-empty-state flex w-full flex-col items-center justify-center h-full select-none text-center px-6"
  >
    <div class="st-empty-state-shell px-6 py-4 rounded-sm shadow-2xl flex flex-col items-center">
    <!-- Icon bubble -->
      <div
        class="st-empty-state-icon w-10 h-10 mb-3 rounded-sm flex items-center justify-center text-lg"
      >
        {{ icon ?? '⚡' }}
      </div>

      <h3 class="st-empty-state-title text-[11px] font-semibold mb-1">
        {{ title }}
      </h3>

      <p v-if="description" class="st-empty-state-description text-[11px] max-w-xs leading-snug">
        {{ description }}
      </p>

      <!-- Slot: optional action button passed by parent -->
      <div v-if="$slots.action" class="mt-3">
        <slot name="action" />
      </div>
    </div>
  </div>
</template>
