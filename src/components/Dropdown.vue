<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';

const props = withDefaults(defineProps<{
  /** Aria label for the trigger button. */
  label?: string
  /** Tooltip / title attribute for the trigger button. */
  title?: string
  /** Horizontal alignment of the menu against the trigger. */
  align?: 'left' | 'right'
  /** Extra utility classes applied to the trigger button. */
  triggerClass?: string
  /** Extra utility classes applied to the menu panel. */
  menuClass?: string
  /** Hide the built-in chevron icon (useful when caller provides custom trigger content). */
  hideChevron?: boolean
}>(), {
  label:        'Open menu',
  title:        undefined,
  align:        'right',
  triggerClass: '',
  menuClass:    '',
  hideChevron:  false,
})

const open    = ref(false)
const rootEl  = ref<HTMLElement | null>(null)
const menuEl  = ref<HTMLElement | null>(null)
const menuStyle = ref<Record<string, string>>({})

function toggle(e: Event) {
  e.stopPropagation()
  open.value = !open.value
}

function close() {
  open.value = false
}

function onDocPointer(e: PointerEvent) {
  if (!open.value) return
  const target = e.target as Node
  if (rootEl.value?.contains(target) || menuEl.value?.contains(target)) return
  close()
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && open.value) close()
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocPointer)
  document.addEventListener('keydown', onKey)
})

onUnmounted(() => {
  document.removeEventListener('pointerdown', onDocPointer)
  document.removeEventListener('keydown', onKey)
  window.removeEventListener('resize', updateMenuPosition)
  window.removeEventListener('scroll', updateMenuPosition, true)
})

const menuPositionClass = computed(() =>
  props.align === 'left' ? 'left-0' : 'right-0'
)

function updateMenuPosition() {
  if (!open.value || !rootEl.value) return
  const rect = rootEl.value.getBoundingClientRect()
  menuStyle.value = props.align === 'left'
    ? {
        position: 'fixed',
        top: `${rect.bottom + 1}px`,
        left: `${rect.left}px`,
      }
    : {
        position: 'fixed',
        top: `${rect.bottom + 1}px`,
        right: `${window.innerWidth - rect.right}px`,
      }
}

watch(open, async (isOpen) => {
  if (isOpen) {
    await nextTick()
    updateMenuPosition()
    window.addEventListener('resize', updateMenuPosition)
    window.addEventListener('scroll', updateMenuPosition, true)
    return
  }
  window.removeEventListener('resize', updateMenuPosition)
  window.removeEventListener('scroll', updateMenuPosition, true)
})

defineExpose({ close })
</script>

<template>
  <div ref="rootEl" class="relative inline-block" @click.stop>
    <button
      type="button"
      :aria-label="label"
      :aria-expanded="open"
      aria-haspopup="menu"
      :title="title"
      @click="toggle"
      :class="[
        'inline-flex items-center gap-1 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40',
        triggerClass,
      ]"
    >
      <slot name="trigger" :open="open" />
      <svg
        v-if="!hideChevron"
        class="w-2.5 h-2.5 transition-transform shrink-0"
        :class="open ? 'rotate-180' : ''"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path fill-rule="evenodd"
          d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"
          clip-rule="evenodd" />
      </svg>
    </button>

    <Teleport to="body">
      <div
        v-if="open"
        ref="menuEl"
        role="menu"
        :style="menuStyle"
        :class="[
          'st-dropdown-panel',
          'min-w-[10rem] z-[90]',
          'bg-black/85 backdrop-blur-xs border border-white/20 shadow-2xl py-2',
          menuPositionClass,
          menuClass,
        ]"
        @click="close"
      >
        <slot :close="close" />
      </div>
    </Teleport>
  </div>
</template>
