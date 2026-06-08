<script setup lang="ts">
import type { Note } from '@/types/db';
import { computed } from 'vue';

const props = defineProps<{
  note:         Note
  isSearchHighlighted?: boolean
  isOpen?: boolean
  isDragging?:  boolean
  isDragOver?:  boolean
}>()

const emit = defineEmits<{
  view: [note: Note]
}>()

// ─── Style token → accent border color ────────────────────────────────────────

const TOKEN_CLASS: Record<string, string> = {
  info:    'st-color-info',
  success: 'st-color-success',
  warning: 'st-color-warning',
  danger:  'st-color-danger',
  dark:    'st-color-dark',
  light:   'st-color-light',
}

const accentClass = computed(() =>
  props.note.style_token ? (TOKEN_CLASS[props.note.style_token] ?? 'st-color-default') : 'st-color-default',
)

// ─── Preview: first non-empty line of content (or placeholder for crypt) ──────

const preview = computed(() => {
  if (props.note.type === 'crypt') return ''
  const firstLine = props.note.content.split(/\r?\n/).find(l => l.trim())
  return firstLine?.trim() ?? ''
})
</script>

<template>
  <button
    type="button"
    :disabled="props.isOpen"
    @click="emit('view', note)"
    class="st-content-trigger-button st-trigger-note st-note-preview-surface flex flex-col border
           text-left cursor-pointer overflow-hidden shrink-0 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#00d2ff]"
    :class="[
      props.isOpen ? 'opacity-55 cursor-default border-[#00d2ff]' : '',
      props.isSearchHighlighted ? 'ring-1 ring-red-500 shadow-[0_0_0_1px_rgba(239,68,68,0.95),0_0_16px_rgba(239,68,68,0.35)] border-red-400' : '',
      isDragging  ? 'opacity-40' : '',
      isDragOver && !isDragging ? 'ring-1 ring-[#00d2ff] border-[#00d2ff]' : '',
    ]"
    :title="note.title"
  >
    <!-- Top half: colored header -->
    <div class="w-full flex items-center justify-between px-1.5 py-1 font-semibold" :class="accentClass">
      <span class="text-[10px] leading-tight truncate">
        {{ note.title }}
      </span>
      <span class="text-[9px] opacity-70 hover:opacity-100">{{ props.isOpen ? 'OPEN' : '×' }}</span>
    </div>

    <!-- Bottom half: content preview -->
    <div class="st-note-preview-content flex-1 w-full px-1.5 py-1 overflow-hidden">
      <div class="flex gap-1 h-full">
        <div v-if="note.type === 'code'" class="w-[12px] border-r border-gray-200 h-full flex flex-col items-end pr-[2px]">
          <span class="text-[9px] text-gray-400 font-mono leading-tight">1</span>
          <span class="text-[9px] text-gray-400 font-mono leading-tight">2</span>
        </div>
        <div class="flex-1 min-w-0">
          <p
            v-if="note.type === 'crypt'"
            class="text-[9px] font-mono truncate leading-none h-full flex items-center"
          >
            🔒 Encrypted
          </p>
          <p
            v-else
            class="text-[10px] font-mono leading-tight whitespace-pre-wrap truncate"
          >
            {{ preview }}
          </p>
        </div>
      </div>
    </div>
  </button>
</template>
