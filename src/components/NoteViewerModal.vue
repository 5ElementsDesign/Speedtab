<script setup lang="ts">
import type { OpenNoteWindow } from '@/composables/useOpenNotes'
import { decryptNote, parseCryptPayload } from '@/composables/useCrypt'
import { highlightCode } from '@/composables/useHighlight'
import { renderNoteHtmlWithAssets } from '@/composables/useNoteImages'
import type { Note } from '@/types/db'
import { computed, onBeforeUnmount, onMounted, onUnmounted, ref, watch } from 'vue'

const props = defineProps<{
  note: Note
  windowState: OpenNoteWindow
}>()

const emit = defineEmits<{
  close: []
  focus: []
  move: [patch: { x: number; y: number }]
  resize: [patch: { width: number; height: number }]
  edit: [note: Note]
  delete: [note: Note]
}>()

interface TokenStyle {
  header: string
  border: string
  headerText: string
}

const TOKEN_STYLE: Record<string, TokenStyle> = {
  info:    { header: 'bg-sky-700', border: 'border-sky-700', headerText: 'text-white' },
  success: { header: 'bg-emerald-700', border: 'border-emerald-700', headerText: 'text-white' },
  warning: { header: 'bg-amber-600', border: 'border-amber-600', headerText: 'text-white' },
  danger:  { header: 'bg-rose-700', border: 'border-rose-700', headerText: 'text-white' },
  dark:    { header: 'bg-gray-800', border: 'border-gray-800', headerText: 'text-white' },
  light:   { header: 'bg-gray-200', border: 'border-gray-200', headerText: 'text-gray-900' },
}

const DEFAULT_STYLE: TokenStyle = {
  header: 'bg-indigo-700',
  border: 'border-indigo-700',
  headerText: 'text-white',
}

const tokenStyle = computed<TokenStyle>(() =>
  props.note.style_token ? (TOKEN_STYLE[props.note.style_token] ?? DEFAULT_STYLE) : DEFAULT_STYLE,
)

const hasExplicitSize = computed(() => props.windowState.width !== null && props.windowState.height !== null)
const windowStyle = computed(() => ({
  left: `${props.windowState.x}px`,
  top: `${props.windowState.y}px`,
  width: props.windowState.width !== null ? `${props.windowState.width}px` : 'auto',
  height: props.windowState.height !== null ? `${props.windowState.height}px` : 'auto',
  zIndex: String(props.windowState.zIndex),
}))

const linkItems = computed(() => {
  if (props.note.type !== 'links') return []
  return props.note.content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        const url = new URL(line)
        if (url.protocol === 'http:' || url.protocol === 'https:') {
          return { text: line, url: url.toString() }
        }
      } catch {
        // Plain text headings are valid inside links notes.
      }
      return { text: line, url: null }
    })
})

function langOf(note: Note): string | null {
  if (note.type !== 'code' || !note.meta_json) return null
  try {
    return (JSON.parse(note.meta_json) as { language?: string }).language ?? null
  } catch {
    return null
  }
}

const codeHtml = ref('')
const htmlSafe = ref('')
let revokeHtmlAssets: (() => void) | null = null

watch(
  () => [props.note.type, props.note.content, langOf(props.note)] as const,
  async ([type, content, language]) => {
    revokeHtmlAssets?.()
    revokeHtmlAssets = null
    htmlSafe.value = ''

    if (type !== 'code' || !content) {
      codeHtml.value = ''
    } else {
      codeHtml.value = await highlightCode(content, language)
    }

    if (type === 'html' && content) {
      const rendered = await renderNoteHtmlWithAssets(content)
      htmlSafe.value = rendered.html
      revokeHtmlAssets = rendered.revoke
    }
  },
  { immediate: true },
)

const passphraseInput = ref('')
const unlockedText = ref<string | null>(null)
const unlockError = ref<string | null>(null)
const unlocking = ref(false)

const ciphertextPreview = computed(() => {
  if (props.note.type !== 'crypt') return null
  try {
    return parseCryptPayload(props.note.content).ciphertext
  } catch {
    return props.note.content
  }
})

watch(() => props.note.id, () => {
  passphraseInput.value = ''
  unlockedText.value = null
  unlockError.value = null
})

async function unlock() {
  if (props.note.type !== 'crypt') return
  unlocking.value = true
  unlockError.value = null
  try {
    const payload = parseCryptPayload(props.note.content)
    unlockedText.value = await decryptNote(payload, passphraseInput.value)
    passphraseInput.value = ''
  } catch {
    unlockError.value = 'Wrong passphrase or corrupted note.'
  } finally {
    unlocking.value = false
  }
}

function lock() {
  unlockedText.value = null
  unlockError.value = null
  passphraseInput.value = ''
}

let dragCleanup: (() => void) | null = null
let resizeCleanup: (() => void) | null = null

function attachPointerLifecycle(
  onMove: (event: PointerEvent) => void,
  onEnd?: () => void,
) {
  const handleMove = (event: PointerEvent) => onMove(event)
  const handleEnd = () => {
    window.removeEventListener('pointermove', handleMove)
    window.removeEventListener('pointerup', handleEnd)
    window.removeEventListener('pointercancel', handleEnd)
    onEnd?.()
  }

  window.addEventListener('pointermove', handleMove)
  window.addEventListener('pointerup', handleEnd)
  window.addEventListener('pointercancel', handleEnd)

  return handleEnd
}

function startDrag(event: PointerEvent) {
  if ((event.target as HTMLElement | null)?.closest('button, a, input, textarea')) return
  emit('focus')
  const startX = event.clientX
  const startY = event.clientY
  const { x, y } = props.windowState

  dragCleanup?.()
  dragCleanup = attachPointerLifecycle((moveEvent) => {
    emit('move', {
      x: x + (moveEvent.clientX - startX),
      y: y + (moveEvent.clientY - startY),
    })
  })
}

function startResize(event: PointerEvent) {
  event.preventDefault()
  event.stopPropagation()
  emit('focus')
  const startX = event.clientX
  const startY = event.clientY
  const host = (event.currentTarget as HTMLElement | null)?.closest('article') as HTMLElement | null
  const rect = host?.getBoundingClientRect()
  const width = props.windowState.width ?? rect?.width ?? 320
  const height = props.windowState.height ?? rect?.height ?? 220

  resizeCleanup?.()
  resizeCleanup = attachPointerLifecycle((moveEvent) => {
    emit('resize', {
      width: width + (moveEvent.clientX - startX),
      height: height + (moveEvent.clientY - startY),
    })
  })
}

function onKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close')
}

onMounted(() => window.addEventListener('keydown', onKeyDown))
onUnmounted(() => window.removeEventListener('keydown', onKeyDown))
onBeforeUnmount(() => {
  lock()
  revokeHtmlAssets?.()
  dragCleanup?.()
  resizeCleanup?.()
})
</script>

<template>
  <article
    class="pointer-events-auto fixed overflow-hidden border-2 bg-surface-900 shadow-2xl"
    :class="[
      tokenStyle.border,
      hasExplicitSize ? 'max-w-[calc(100vw-24px)] max-h-[calc(100vh-24px)]' : 'max-w-[min(1900px,calc(100vw-24px))] max-h-[65vh]',
    ]"
    :style="windowStyle"
    @mousedown="emit('focus')"
  >
    <header
      class="flex items-center justify-between gap-2 px-3 py-2 select-none cursor-move"
      :class="[tokenStyle.header, tokenStyle.headerText]"
      @pointerdown="startDrag"
    >
      <span class="min-w-0 truncate text-[13px] font-semibold leading-none">{{ note.title }}</span>
      <div class="flex items-center gap-2 text-[11px]">
        <button type="button" class="hover:opacity-100 opacity-80 transition-opacity" @click.stop="emit('edit', note)">Edit</button>
        <button type="button" class="hover:opacity-100 opacity-80 transition-opacity" @click.stop="emit('delete', note)">Delete</button>
        <button type="button" class="hover:opacity-100 opacity-80 transition-opacity" @click.stop="emit('close')" aria-label="Close note">Close</button>
      </div>
    </header>

    <div
      class="overflow-auto"
      :class="[
        note.type === 'code' ? 'p-0' : 'px-4 py-3',
        hasExplicitSize ? 'h-[calc(100%-40px)]' : 'max-h-[calc(65vh-40px)]',
      ]"
      @mousedown="emit('focus')"
    >
      <pre
        v-if="note.type === 'text'"
        class="st-note-content-scale m-0 whitespace-pre-wrap break-words font-sans leading-snug text-gray-200"
      >{{ note.content }}</pre>

      <pre
        v-else-if="note.type === 'code'"
        class="st-note-content-scale hljs m-0 h-full overflow-auto rounded p-3 leading-snug"
      ><code v-html="codeHtml"></code></pre>

      <ul v-else-if="note.type === 'links'" class="st-note-content-scale space-y-1">
        <li v-for="(entry, index) in linkItems" :key="index">
          <a
            v-if="entry.url"
            :href="entry.url"
            target="_blank"
            rel="noopener noreferrer"
            class="block truncate text-[13px] text-sky-400 hover:text-sky-300 hover:underline"
          >{{ entry.text }}</a>
          <span v-else class="block text-[12px] font-medium text-white/70">{{ entry.text }}</span>
        </li>
      </ul>

      <div
        v-else-if="note.type === 'html'"
        class="st-note-content-scale prose-tight leading-snug text-gray-200"
        v-html="htmlSafe"
      ></div>

      <div v-else-if="note.type === 'crypt'">
        <div v-if="!unlockedText" class="flex flex-col gap-3">
          <div class="flex items-center gap-2">
            <input
              :id="`note-viewer-passphrase-${note.id}`"
              :name="`note_viewer_passphrase_${note.id}`"
              v-model="passphraseInput"
              type="password"
              placeholder="Passphrase"
              @keydown.enter.prevent="unlock"
              class="flex-1 rounded border border-white/10 bg-surface-950 px-3 py-2 font-mono text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-rose-500"
            />
            <button
              type="button"
              :disabled="unlocking || !passphraseInput"
              class="rounded bg-rose-700 px-3 py-2 text-xs font-medium text-white hover:bg-rose-600 disabled:opacity-40"
              @click="unlock"
            >
              {{ unlocking ? '…' : 'Unlock' }}
            </button>
          </div>
          <p v-if="unlockError" class="m-0 text-[11px] text-rose-400">{{ unlockError }}</p>
          <div v-if="ciphertextPreview" class="st-note-state-encrypted max-w-[440px]">
            <p class="mb-1 text-[10px] uppercase tracking-wider text-white/40">Encrypted Payload</p>
            <div class="max-h-[40vh] overflow-y-auto border border-rose-900/30 bg-black/40 p-3 font-mono text-[11px] text-rose-300/50 break-words [word-wrap:break-word] [overflow-wrap:anywhere]">
              {{ ciphertextPreview }}
            </div>
          </div>
        </div>

        <div v-else class="space-y-2">
          <pre class="st-note-content-scale m-0 whitespace-pre-wrap break-words font-sans leading-snug text-gray-200">{{ unlockedText }}</pre>
          <button
            type="button"
            class="text-[11px] font-bold uppercase tracking-wider text-rose-400 hover:text-rose-300"
            @click="lock"
          >
            Lock
          </button>
        </div>
      </div>
    </div>

    <button
      type="button"
      class="absolute bottom-1 right-1 h-4 w-4 cursor-se-resize rounded-sm border border-white/10 bg-black/40 text-[0] opacity-70 hover:opacity-100"
      aria-label="Resize note"
      @pointerdown="startResize"
    >
      resize
    </button>
  </article>
</template>
