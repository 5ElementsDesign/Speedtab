<script setup lang="ts">
import type { Note } from '@/types/db';
import { computed } from 'vue';

const props = defineProps<{
  note:         Note
  isSearchHighlighted?: boolean
  isDragging?:  boolean
  isDragOver?:  boolean
}>()

const emit = defineEmits<{
  view: [note: Note]
}>()

// ─── Style token → accent border color ────────────────────────────────────────

const TOKEN_BG: Record<string, string> = {
  info:    'bg-sky-700',
  success: 'bg-emerald-700',
  warning: 'bg-amber-600',
  danger:  'bg-rose-700',
  dark:    'bg-gray-800',
  light:   'bg-gray-500',
}

const accentBg = computed(() =>
  props.note.style_token ? (TOKEN_BG[props.note.style_token] ?? 'bg-[#1e88e5]') : 'bg-[#1e88e5]',
)

// ─── Preview: first non-empty line of content (or placeholder for crypt) ──────

const preview = computed(() => {
  if (props.note.type === 'crypt') return '🔒 Encrypted'
  const firstLine = props.note.content.split(/\r?\n/).find(l => l.trim())
  return firstLine?.trim() ?? ''
})
</script>

<template>
  <button
    type="button"
    @click="emit('view', note)"
    class="w-[115px] h-[56px] flex flex-col bg-white border border-[#dbdbdb] hover:border-[#00d2ff]
           text-left cursor-pointer overflow-hidden shrink-0 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#00d2ff]"
    :class="[
      props.isSearchHighlighted ? 'ring-1 ring-red-500 shadow-[0_0_0_1px_rgba(239,68,68,0.95),0_0_16px_rgba(239,68,68,0.35)] border-red-400' : '',
      isDragging  ? 'opacity-40' : '',
      isDragOver && !isDragging ? 'ring-1 ring-[#00d2ff] border-[#00d2ff]' : '',
    ]"
    :title="note.title"
  >
    <!-- Top half: colored header -->
    <div class="w-full flex items-center justify-between px-1.5 py-0.5" :class="accentBg">
      <span class="text-[10px] font-medium text-white leading-tight truncate">
        {{ note.title }}
      </span>
      <span class="text-[9px] text-white/70 hover:text-white">×</span>
    </div>

    <!-- Bottom half: content preview -->
    <div class="flex-1 w-full bg-white px-1.5 py-1 overflow-hidden">
      <div class="flex gap-1 h-full">
        <div v-if="note.type === 'code'" class="w-[12px] border-r border-gray-200 h-full flex flex-col items-end pr-[2px]">
          <span class="text-[9px] text-gray-400 font-mono leading-tight">1</span>
          <span class="text-[9px] text-gray-400 font-mono leading-tight">2</span>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-[10px] text-gray-700 font-mono leading-tight whitespace-pre-wrap truncate">
            {{ preview }}
          </p>
        </div>
      </div>
    </div>
  </button>
</template>
