<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, onBeforeUnmount } from 'vue'
import type { Note } from '@/types/db'
import { decryptNote, parseCryptPayload } from '@/composables/useCrypt'
import { sanitizeHtml } from '@/composables/useSanitize'
import { highlightCode } from '@/composables/useHighlight'

const props = defineProps<{
  show: boolean
  note: Note | null
}>()

const emit = defineEmits<{
  close:  []
  edit:   [note: Note]
  delete: [note: Note]
}>()

// ─── Keyboard close ────────────────────────────────────────────────────────────

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.show) emit('close')
}
onMounted(()  => window.addEventListener('keydown', onKeyDown))
onUnmounted(() => window.removeEventListener('keydown', onKeyDown))

// ─── Style token → solid color scheme (header bg + matching border) ──────────
//
// All classes are static strings so Tailwind picks them up during JIT scanning.

interface TokenStyle { header: string; border: string; headerText: string }

const TOKEN_STYLE: Record<string, TokenStyle> = {
  info:    { header: 'bg-sky-700',     border: 'border-sky-700',     headerText: 'text-white' },
  success: { header: 'bg-emerald-700', border: 'border-emerald-700', headerText: 'text-white' },
  warning: { header: 'bg-amber-600',   border: 'border-amber-600',   headerText: 'text-white' },
  danger:  { header: 'bg-rose-700',    border: 'border-rose-700',    headerText: 'text-white' },
  dark:    { header: 'bg-gray-800',    border: 'border-gray-800',    headerText: 'text-white' },
  light:   { header: 'bg-gray-200',    border: 'border-gray-200',    headerText: 'text-gray-900' },
}

const DEFAULT_STYLE: TokenStyle = {
  header: 'bg-indigo-700', border: 'border-indigo-700', headerText: 'text-white',
}

const tokenStyle = computed<TokenStyle>(() =>
  props.note?.style_token ? (TOKEN_STYLE[props.note.style_token] ?? DEFAULT_STYLE) : DEFAULT_STYLE,
)

// ─── Per-type rendering helpers ───────────────────────────────────────────────

const linkItems = computed(() => {
  if (props.note?.type !== 'links') return []
  return props.note.content
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      try {
        const url = new URL(line)
        if (url.protocol === 'http:' || url.protocol === 'https:') {
          return { text: line, url: url.toString() }
        }
      } catch {
        // Plain text headings / separators are allowed in links notes.
      }
      return { text: line, url: null }
    })
})

function langOf(note: Note): string | null {
  if (note.type !== 'code' || !note.meta_json) return null
  try { return (JSON.parse(note.meta_json) as { language?: string }).language ?? null } catch { return null }
}

const codeHtml = ref('')
const htmlSafe  = computed(() =>
  props.note?.type === 'html' ? sanitizeHtml(props.note.content) : '',
)

watch(
  () => [props.show, props.note?.type, props.note?.content, props.note ? langOf(props.note) : null] as const,
  async ([show, type, content, language]) => {
    if (!show || type !== 'code' || !content) {
      codeHtml.value = ''
      return
    }
    codeHtml.value = await highlightCode(content, language)
  },
  { immediate: true }
)

// ─── Crypt unlock ──────────────────────────────────────────────────────────────

const passphraseInput = ref('')
const unlockedText    = ref<string | null>(null)
const unlockError     = ref<string | null>(null)
const unlocking       = ref(false)
const isMaximized     = ref(false)

const ciphertextPreview = computed(() => {
  if (props.note?.type !== 'crypt') return null
  try {
    const payload = parseCryptPayload(props.note.content)
    return payload.ciphertext
  } catch {
    return props.note.content
  }
})

watch(() => props.note, () => {
  passphraseInput.value = ''
  unlockedText.value    = null
  unlockError.value     = null
  isMaximized.value     = false
})

watch(() => props.show, (show) => {
  if (!show) {
    passphraseInput.value = ''
    unlockedText.value    = null
    unlockError.value     = null
    isMaximized.value     = false
  }
})

async function unlock() {
  if (props.note?.type !== 'crypt') return
  unlocking.value   = true
  unlockError.value = null
  try {
    const payload      = parseCryptPayload(props.note.content)
    unlockedText.value = await decryptNote(payload, passphraseInput.value)
    passphraseInput.value = ''
  } catch {
    unlockError.value = 'Wrong passphrase or corrupted note.'
  } finally {
    unlocking.value = false
  }
}

function lock() {
  unlockedText.value    = null
  unlockError.value     = null
  passphraseInput.value = ''
}

function toggleMaximized() {
  isMaximized.value = !isMaximized.value
}

onBeforeUnmount(lock)
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
      <div v-if="show && note" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/70 backdrop-blur-xs" @click="emit('close')"></div>

        <!-- Message panel — solid block, colored border matches header -->
        <div
          class="relative w-full overflow-hidden shadow-2xl border-2 transition-all"
          :class="[tokenStyle.border, isMaximized ? 'max-w-[min(96vw,1400px)] h-[90vh]' : 'max-w-lg']"
        >

          <!-- Bulma-style colored header -->
          <header
            class="px-3 py-2 flex items-center justify-between"
            :class="[tokenStyle.header, tokenStyle.headerText]"
          >
            <span class="text-[13px] font-semibold leading-none">{{ note.title }}</span>
            <div class="flex items-center gap-2 opacity-80">
              <button @click="toggleMaximized" class="hover:opacity-100 transition-opacity text-[11px]" :title="isMaximized ? 'Restore size' : 'Maximize'">
                {{ isMaximized ? 'Restore' : 'Maximize' }}
              </button>
              <button @click="emit('edit', note)"   class="hover:opacity-100 transition-opacity text-[11px]" title="Edit">Edit</button>
              <button @click="emit('delete', note)" class="hover:opacity-100 transition-opacity text-[11px]" title="Delete">Delete</button>
              <button @click="emit('close')"        class="hover:opacity-100 transition-opacity ml-1" title="Close">
                <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                </svg>
              </button>
            </div>
          </header>

          <!-- Message body — neutral, fully opaque -->
          <div class="bg-surface-900 px-4 py-3 overflow-y-auto" :class="isMaximized ? 'h-[calc(90vh-40px)]' : 'max-h-[70vh]'">

            <!-- text -->
            <pre v-if="note.type === 'text'"
                 class="text-[13px] leading-snug text-gray-200 whitespace-pre-wrap break-words font-sans m-0">{{ note.content }}</pre>

            <!-- code -->
            <pre v-else-if="note.type === 'code'"
                 class="hljs text-[12px] leading-snug overflow-x-auto p-3 m-0"><code v-html="codeHtml"></code></pre>

            <!-- links -->
            <ul v-else-if="note.type === 'links'" class="space-y-1">
              <li v-for="(entry, i) in linkItems" :key="i">
                <a v-if="entry.url" :href="entry.url" target="_blank" rel="noopener noreferrer"
                   class="text-[13px] text-sky-400 hover:text-sky-300 hover:underline truncate block">{{ entry.text }}</a>
                <span v-else class="text-[12px] text-white/70 font-medium block">{{ entry.text }}</span>
              </li>
            </ul>

            <!-- html -->
            <div v-else-if="note.type === 'html'"
                 class="text-[13px] leading-snug text-gray-200 prose-tight" v-html="htmlSafe"></div>

            <!-- crypt: locked -->
            <div v-else-if="note.type === 'crypt'">
              <div v-if="!unlockedText" class="flex flex-col gap-3">
                <div class="flex items-center gap-2">
                  <input
                    id="note_viewer_passphrase"
                    name="note_viewer_passphrase"
                    v-model="passphraseInput"
                    type="password"
                    placeholder="Passphrase"
                    @keydown.enter.prevent="unlock"
                    class="flex-1 bg-surface-950 border border-white/10 rounded px-3 py-2 text-sm text-gray-100 font-mono
                           focus:outline-none focus:ring-1 focus:ring-rose-500"
                  />
                  <button type="button" @click="unlock" :disabled="unlocking || !passphraseInput"
                    class="px-3 py-2 bg-rose-700 hover:bg-rose-600 disabled:opacity-40 text-white rounded text-xs font-medium">
                    {{ unlocking ? '…' : 'Unlock' }}
                  </button>
                </div>
                <p v-if="unlockError" class="text-[11px] text-rose-400 m-0">{{ unlockError }}</p>
                
                <div v-if="ciphertextPreview" class="mt-2">
                  <p class="text-[10px] text-white/40 uppercase tracking-wider mb-1">Encrypted Payload</p>
                  <div class="text-[11px] text-rose-300/50 font-mono whitespace-pre-wrap break-all bg-black/40 p-3 border border-rose-900/30 max-h-[40vh] overflow-y-auto select-none">{{ ciphertextPreview }}</div>
                </div>
              </div>

              <div v-if="unlockedText" class="space-y-2">
                <pre class="text-[13px] leading-snug text-gray-200 whitespace-pre-wrap break-words font-sans m-0">{{ unlockedText }}</pre>
                <button type="button" @click="lock"
                  class="text-[11px] uppercase tracking-wider font-bold text-rose-400 hover:text-rose-300">
                  🔒 Lock
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.prose-tight :deep(p)  { margin: 0.25rem 0; }
.prose-tight :deep(ul),
.prose-tight :deep(ol) { margin: 0.25rem 0; padding-left: 1.25rem; }
.prose-tight :deep(li) { line-height: 1.4; }
.prose-tight :deep(a)  { color: theme('colors.sky.400'); text-decoration: underline; }
.prose-tight :deep(code) {
  font-size: 12px;
  background: rgba(255,255,255,0.05);
  padding: 0 3px;
  border-radius: 2px;
}
</style>
