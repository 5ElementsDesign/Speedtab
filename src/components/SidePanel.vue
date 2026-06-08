<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue';

const props = defineProps<{
  show: boolean
  title: string
  widthClass?: string
  lockBackdropClose?: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

function onKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.show) {
    emit('close')
  }
}

const PANEL_WIDTH = 440

function syncBodyOffset(show: boolean) {
  if (typeof document === 'undefined') return
  document.body.style.transition = 'margin-right 0.16s ease-out'
  if (show && window.innerWidth >= 960) {
    document.body.style.marginRight = `${Math.min(PANEL_WIDTH, window.innerWidth)}px`
    return
  }
  document.body.style.marginRight = ''
}

onMounted(() => window.addEventListener('keydown', onKeyDown))
onUnmounted(() => window.removeEventListener('keydown', onKeyDown))
watch(() => props.show, syncBodyOffset, { immediate: true })
onUnmounted(() => {
  syncBodyOffset(false)
})
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
      <div v-if="show" class="fixed inset-0 z-[70]">
        <div class="absolute inset-0" @click="!props.lockBackdropClose && emit('close')"></div>

        <Transition
          enter-active-class="transition duration-200 ease-out"
          enter-from-class="translate-x-full"
          enter-to-class="translate-x-0"
          leave-active-class="transition duration-150 ease-in"
          leave-from-class="translate-x-0"
          leave-to-class="translate-x-full"
        >
          <aside
            v-if="show"
            class="absolute right-0 top-0 h-full w-full max-w-[440px] bg-[#000000ee] backdrop-blur-xs border-l border-white/10 shadow-2xl flex flex-col"
            :class="widthClass"
          >
            <header class="px-3 py-2 border-b border-white/10 flex items-center justify-between bg-black/30">
              <h2 class="text-[11px] font-semibold text-white">
                <slot name="title">{{ title }}</slot>
              </h2>
              <button
                type="button"
                @click="emit('close')"
                class="text-white/60 hover:text-white transition-colors"
              >
                <svg class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                </svg>
              </button>
            </header>

            <div class="flex-1 min-h-0 overflow-y-auto">
              <slot></slot>
            </div>
          </aside>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
