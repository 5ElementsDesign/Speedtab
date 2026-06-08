<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';

const props = defineProps<{
  show:  boolean
  title: string
  dockRight?: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const isMaximized = ref(false)

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.show) {
    emit('close')
  }
}

watch(() => props.show, (show) => {
  if (!show) isMaximized.value = false
})

onMounted(() => window.addEventListener('keydown', onKeyDown))
onUnmounted(() => window.removeEventListener('keydown', onKeyDown))
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="show" class="fixed inset-0 z-[70] flex items-center p-4" :class="props.dockRight ? 'justify-end' : 'justify-center'">
        <!-- Backdrop -->
        <div class="absolute inset-0" :class="props.dockRight ? 'bg-black/95' : 'bg-[#000000e6]'" @click="emit('close')"></div>

        <!-- Modal Panel -->
        <div
          class="relative bg-black/80 border border-white/10 shadow-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
          :class="[
            isMaximized
              ? (props.dockRight ? 'max-w-[50vw] h-[90vh]' : 'max-w-[min(96vw,1500px)] h-[90vh]')
              : 'max-w-lg',
            props.dockRight ? 'lg:h-[calc(100vh-32px)] lg:max-h-none' : '',
          ]"
        >
          <header class="px-3 py-2 border-b border-white/10 flex items-center justify-between bg-black/30">
            <h2 class="text-[11px] font-semibold text-white">
              <slot name="title">{{ title }}</slot>
            </h2>
            <div class="flex items-center gap-2">
              <div v-if="$slots['header-meta']" class="text-[10px] text-gray-500 leading-none">
                <slot name="header-meta"></slot>
              </div>
              <slot name="header-actions"></slot>
              <button
                type="button"
                @click="isMaximized = !isMaximized"
                class="text-[11px] text-white/60 hover:text-white transition-colors"
              >
                {{ isMaximized ? 'Restore' : 'Maximize' }}
              </button>
              <button
                @click="emit('close')"
                class="text-white/60 hover:text-white transition-colors"
              >
                <svg class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                </svg>
              </button>
            </div>
          </header>

          <div class="px-3 py-3 flex-1 min-h-0 overflow-y-auto">
            <slot></slot>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
