<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ScratchpadState } from '@/composables/useScratchpadLocal'

const props = defineProps<{
  state: ScratchpadState
}>()

const emit = defineEmits<{
  close: []
  refresh: []
  update: [patch: Partial<ScratchpadState>]
}>()

const { t } = useI18n()

const panelEl = ref<HTMLElement | null>(null)
const isDragging = ref(false)

let dragPointerId: number | null = null
let dragOffsetX = 0
let dragOffsetY = 0
let resizeObserver: ResizeObserver | null = null
let contentSaveHandle: number | null = null

const content = ref(props.state.content)
const panelStyle = computed(() => ({
  top: `${props.state.top}px`,
  left: `${props.state.left}px`,
  width: `${props.state.width}px`,
  height: `${props.state.height}px`,
}))

function clampToViewport(left: number, top: number, width: number, height: number) {
  const maxLeft = Math.max(8, window.innerWidth - width - 8)
  const maxTop = Math.max(48, window.innerHeight - height - 8)
  return {
    left: Math.max(8, Math.min(left, maxLeft)),
    top: Math.max(48, Math.min(top, maxTop)),
  }
}

function commitContentSoon() {
  if (contentSaveHandle !== null) window.clearTimeout(contentSaveHandle)
  contentSaveHandle = window.setTimeout(() => {
    emit('update', { content: content.value })
    contentSaveHandle = null
  }, 140)
}

function handleDragMove(event: PointerEvent) {
  if (!isDragging.value || dragPointerId !== event.pointerId) return
  const width = panelEl.value?.offsetWidth ?? props.state.width
  const height = panelEl.value?.offsetHeight ?? props.state.height
  const nextPosition = clampToViewport(event.clientX - dragOffsetX, event.clientY - dragOffsetY, width, height)
  emit('update', nextPosition)
}

function stopDragging(event?: PointerEvent) {
  if (event && dragPointerId !== event.pointerId) return
  isDragging.value = false
  dragPointerId = null
}

function startDragging(event: PointerEvent) {
  if (!panelEl.value) return
  const rect = panelEl.value.getBoundingClientRect()
  dragPointerId = event.pointerId
  dragOffsetX = event.clientX - rect.left
  dragOffsetY = event.clientY - rect.top
  isDragging.value = true
}

watch(() => props.state.content, (value) => {
  if (value !== content.value) {
    content.value = value
  }
})

watch(content, () => {
  commitContentSoon()
})

onMounted(() => {
  resizeObserver = new ResizeObserver((entries) => {
    const entry = entries[0]
    const panel = panelEl.value
    if (!entry || !panel) return
    const width = Math.round(panel.offsetWidth)
    const height = Math.round(panel.offsetHeight)
    if (width === props.state.width && height === props.state.height) return
    emit('update', { width, height })
  })
  if (panelEl.value) {
    resizeObserver.observe(panelEl.value)
  }
  window.addEventListener('pointermove', handleDragMove)
  window.addEventListener('pointerup', stopDragging)
  window.addEventListener('pointercancel', stopDragging)
})

onBeforeUnmount(() => {
  if (contentSaveHandle !== null) window.clearTimeout(contentSaveHandle)
  resizeObserver?.disconnect()
  window.removeEventListener('pointermove', handleDragMove)
  window.removeEventListener('pointerup', stopDragging)
  window.removeEventListener('pointercancel', stopDragging)
})
</script>

<template>
  <section
    ref="panelEl"
    class="st-scratchpad-panel fixed z-[70] min-w-[240px] min-h-[140px] overflow-hidden border shadow-2xl resize bg-black/80 backdrop-blur-sm"
    :style="panelStyle"
  >
    <header
      class="flex cursor-move items-center justify-between gap-3 border-b border-white/10 px-3 py-2 select-none"
      @pointerdown.prevent="startDragging"
    >
      <div class="min-w-0">
        <h2 class="text-[10px] uppercase tracking-[0.18em] text-white/70">{{ t('scratchpad.title') }}</h2>
        <p class="mt-1 text-[11px] text-white/45">{{ t('scratchpad.helperLabel') }}</p>
      </div>
      <div class="flex items-center gap-1">
        <button
          type="button"
          class="px-2 py-1 text-[10px] uppercase tracking-wider text-white/70 hover:text-white hover:bg-white/5 transition-colors"
          :title="t('scratchpad.refreshAction')"
          :aria-label="t('scratchpad.refreshAction')"
          @click="emit('refresh')"
        >
          🗘
        </button>
        <button
          type="button"
          class="px-2 py-1 text-[10px] uppercase tracking-wider text-white/70 hover:text-white hover:bg-white/5 transition-colors"
          @click="emit('close')"
        >
          {{ t('common.close') }}
        </button>
      </div>
    </header>

    <textarea
      v-model="content"
      id="scratchpad_content"
      name="scratchpad_content"
      :placeholder="t('scratchpad.placeholder')"
      class="h-[calc(100%-48px)] w-full resize-none border-0 bg-transparent px-3 py-2 text-[12px] leading-5 text-white/90 outline-none placeholder:text-white/30"
      spellcheck="false"
    />
  </section>
</template>
