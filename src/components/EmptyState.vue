<script setup lang="ts">
defineProps<{
  title:        string
  description?: string
  icon?:        string
}>()
</script>

<template>
  <div
    class="flex flex-col items-center justify-center h-full select-none text-center px-6"
  >
    <div class="px-6 py-4 bg-black/85 backdrop-blur-xs border border-white/10 rounded-sm shadow-2xl flex flex-col items-center">
    <!-- Icon bubble -->
      <div
        class="
          w-10 h-10 mb-3 rounded-sm
          bg-white/5 border border-white/10
          flex items-center justify-center text-lg
        "
      >
        {{ icon ?? '⚡' }}
      </div>

      <h3 class="text-[11px] font-semibold text-white mb-1">
        {{ title }}
      </h3>

      <p v-if="description" class="text-[11px] text-white/60 max-w-xs leading-snug">
        {{ description }}
      </p>

      <!-- Slot: optional action button passed by parent -->
      <div v-if="$slots.action" class="mt-3">
        <slot name="action" />
      </div>
    </div>
  </div>
</template>
