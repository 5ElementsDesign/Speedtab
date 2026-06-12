<script setup lang="ts">
import { decryptNote, parseCryptPayload } from '@/composables/useCrypt'
import { useFavicon } from '@/composables/useFavicon'
import { highlightCode } from '@/composables/useHighlight'
import { useLiveQuery } from '@/composables/useLiveQuery'
import { renderNoteHtmlWithAssets } from '@/composables/useNoteImages'
import type { OpenNoteWindow } from '@/composables/useOpenNotes'
import { db } from '@/db/db'
import type { AppSetting, Note } from '@/types/db'
import { computed, onBeforeUnmount, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  note: Note
  windowState: OpenNoteWindow
  previewMode?: boolean
}>()

const emit = defineEmits<{
  close: []
  focus: []
  move: [patch: { x: number; y: number }]
  resize: [patch: { width: number; height: number }]
  edit: [note: Note]
  delete: [note: Note]
}>()
const { t } = useI18n()

interface TokenStyle {
  tokenClass: string
  borderClass: string
}

const TOKEN_STYLE: Record<string, TokenStyle> = {
  info:    { tokenClass: 'st-color-info', borderClass: 'st-color-info-border' },
  success: { tokenClass: 'st-color-success', borderClass: 'st-color-success-border' },
  warning: { tokenClass: 'st-color-warning', borderClass: 'st-color-warning-border' },
  danger:  { tokenClass: 'st-color-danger', borderClass: 'st-color-danger-border' },
  dark:    { tokenClass: 'st-color-dark', borderClass: 'st-color-dark-border' },
  light:   { tokenClass: 'st-color-light', borderClass: 'st-color-light-border' },
}

const DEFAULT_STYLE: TokenStyle = {
  tokenClass: 'st-color-default',
  borderClass: 'st-color-default-border',
}
const { getFaviconUrl } = useFavicon()

type LinkNoteEntry =
  | { kind: 'divider'; key: string }
  | { kind: 'text'; key: string; text: string }
  | { kind: 'link'; key: string; text: string; url: string; faviconUrl: string | null }

const tokenStyle = computed<TokenStyle>(() =>
  props.note.style_token ? (TOKEN_STYLE[props.note.style_token] ?? DEFAULT_STYLE) : DEFAULT_STYLE,
)
const noteTypeClass = computed(() => `st-module-notes-type-${props.note.type}`)

const hasExplicitSize = computed(() => props.windowState.width !== null && props.windowState.height !== null)
const windowStyle = computed(() => ({
  left: `${props.windowState.x}px`,
  top: `${props.windowState.y}px`,
  width: props.windowState.width !== null ? `${props.windowState.width}px` : 'auto',
  height: props.windowState.height !== null ? `${props.windowState.height}px` : 'auto',
  zIndex: String(props.windowState.zIndex),
}))

const { data: appearanceSetting } = useLiveQuery(
  () => db.app_settings.get('appearance'),
  null as AppSetting | null,
)

const resolvedOpenInNewTab = computed<boolean>(() => {
  if (!appearanceSetting.value?.value_json) return false
  try {
    const parsed = JSON.parse(appearanceSetting.value.value_json)
    return parsed.open_bookmarks_in_new_tab === true
  } catch {
    return false
  }
})

const linkItems = computed<LinkNoteEntry[]>(() => {
  if (props.note.type !== 'links') return []
  return props.note.content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      if (line === '[hr]' || line.toLowerCase() === '<hr>') {
        return { kind: 'divider', key: `divider:${index}` } satisfies LinkNoteEntry
      }
      try {
        const url = new URL(line)
        if (url.protocol === 'http:' || url.protocol === 'https:') {
          return {
            kind: 'link',
            key: `link:${index}`,
            text: line,
            url: url.toString(),
            faviconUrl: getFaviconUrl(url.toString()),
          } satisfies LinkNoteEntry
        }
      } catch {
        // Plain text headings are valid inside links notes.
      }
      return { kind: 'text', key: `text:${index}`, text: line } satisfies LinkNoteEntry
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
  [() => props.note.type, () => props.note.content, () => langOf(props.note)],
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
    unlockError.value = t('noteViewer.wrongPassphrase')
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

function isSmallDeviceViewport() {
  if (typeof window === 'undefined') return false
  return window.innerWidth < 740 || (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches
  )
}

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
  if (isSmallDeviceViewport()) return
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
  if (isSmallDeviceViewport()) return
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
    class="st-note-window pointer-events-auto fixed flex flex-col overflow-hidden border-2 bg-surface-900 shadow-2xl"
    :class="[
      noteTypeClass,
      tokenStyle.tokenClass,
      tokenStyle.borderClass,
      hasExplicitSize ? 'max-w-[calc(100vw-24px)] max-h-[calc(100vh-24px)]' : 'max-w-[min(800px,calc(100vw-24px))] max-h-[var(--st-note-window-max-height)]',
    ]"
    :style="windowStyle"
    @mousedown="emit('focus')"
  >
    <header
      class="flex items-center justify-between gap-2 px-3 py-2 select-none cursor-move"
      @pointerdown="startDrag"
    >
      <span class="min-w-0 truncate text-[13px] font-semibold leading-none">{{ note.title }}</span>
      <div class="flex items-center gap-2 text-[11px]">
        <button
          v-if="!previewMode"
          type="button"
          class="hover:opacity-100 opacity-80 transition-opacity"
          @click.stop="emit('edit', note)"
        >{{ t('noteViewer.edit') }}</button>
        <button
          v-if="!previewMode"
          type="button"
          class="hover:opacity-100 opacity-80 transition-opacity"
          @click.stop="emit('delete', note)"
        >{{ t('noteViewer.delete') }}</button>
        <button
          type="button"
          class="border border-current px-2 py-1 leading-none hover:opacity-100 opacity-70 transition-opacity"
          @click.stop="emit('close')"
          :aria-label="t('noteViewer.closeAria')"
        >
          {{ previewMode ? t('noteViewer.preview') : t('noteViewer.close') }}
        </button>
      </div>
    </header>

    <div
      class="st-note-window-content-wrap min-h-0 flex-1"
      :class="[
        note.type === 'code' ? '' : 'overflow-auto',
        note.type === 'code' || note.type === 'html' ? 'p-0' : 'px-4 py-3',
        note.type === 'code' ? '' : hasExplicitSize ? '' : 'max-h-[calc(var(--st-note-window-max-height)-40px)]',
      ]"
      @mousedown="emit('focus')"
    >
      <pre
        v-if="note.type === 'text'"
        class="st-note-content-scale m-0 whitespace-pre-wrap break-words font-sans leading-snug text-gray-200"
      >{{ note.content }}</pre>

      <pre
        v-else-if="note.type === 'code'"
        class="st-note-content-scale hljs m-0 overflow-auto rounded p-3 leading-snug"
        :class="hasExplicitSize ? 'h-full' : 'max-h-[calc(var(--st-note-window-max-height)-40px)]'"
      ><code v-html="codeHtml"></code></pre>

      <ul v-else-if="note.type === 'links'" class="st-note-content-scale st-note-link-list">
        <li v-for="entry in linkItems" :key="entry.key">
          <hr v-if="entry.kind === 'divider'" class="st-note-link-divider" />
          <a
            v-else-if="entry.kind === 'link'"
            :href="entry.url"
            :target="resolvedOpenInNewTab ? '_blank' : undefined"
            :rel="resolvedOpenInNewTab ? 'noopener noreferrer' : undefined"
            class="st-note-link-row"
          >
            <span class="st-note-link-icon">
              <img
                v-if="entry.faviconUrl"
                :src="entry.faviconUrl"
                alt=""
                class="st-note-link-icon-image"
                draggable="false"
              />
              <span v-else class="st-note-link-icon-fallback">↗</span>
            </span>
            <span class="st-note-link-label">{{ entry.text }}</span>
          </a>
          <span v-else class="st-note-link-heading">{{ entry.text }}</span>
        </li>
      </ul>

      <div
        v-else-if="note.type === 'html'"
        class="st-note-content-scale st-note-html-content st-module-notes-type-html"
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
              :placeholder="t('noteViewer.passphrase')"
              @keydown.enter.prevent="unlock"
              class="flex-1 rounded border border-white/10 bg-surface-950 px-3 py-2 font-mono text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-rose-500"
            />
            <button
              type="button"
              :disabled="unlocking || !passphraseInput"
              class="rounded bg-rose-700 px-3 py-2 text-xs font-medium text-white hover:bg-rose-600 disabled:opacity-40"
              @click="unlock"
            >
              {{ unlocking ? t('noteViewer.unlocking') : t('noteViewer.unlock') }}
            </button>
          </div>
          <p v-if="unlockError" class="m-0 text-[11px] text-rose-400">{{ unlockError }}</p>
          <div v-if="ciphertextPreview" class="st-note-state-encrypted max-w-[440px]">
            <p class="mb-1 text-[10px] uppercase tracking-wider text-white/40">{{ t('noteViewer.encryptedPayload') }}</p>
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
            {{ t('noteViewer.lock') }}
          </button>
        </div>
      </div>
    </div>

    <button
      type="button"
      class="absolute bottom-0 right-0 h-5 w-5 cursor-se-resize bg-transparent text-white/40 hover:text-white"
      :aria-label="t('noteViewer.resizeAria')"
      @pointerdown="startResize"
    >
      <svg viewBox="0 0 20 20" class="h-5 w-5 fill-current">
        <path d="M13 20H20V13L13 20ZM8 20H10L20 10V8L8 20ZM3 20H5L20 5V3L3 20Z" />
      </svg>
    </button>
  </article>
</template>
