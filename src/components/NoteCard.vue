<script setup lang="ts">
import { ref, computed, onBeforeUnmount, watch } from 'vue'
import type { Note } from '@/types/db'
import { decryptNote, parseCryptPayload } from '@/composables/useCrypt'
import { highlightCode } from '@/composables/useHighlight'
import { renderNoteHtmlWithAssets } from '@/composables/useNoteImages'
import { useFavicon } from '@/composables/useFavicon'
import { useLiveQuery } from '@/composables/useLiveQuery'
import { db } from '@/db/db'
import type { AppSetting } from '@/types/db'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  note: Note
  /** Style hint from meta_json (e.g. code language) */
  language?:    string | null
  /** Drag-and-drop feedback flags set by the parent list. */
  isDragging?:  boolean
  isDragOver?:  boolean
}>()

const emit = defineEmits<{
  edit:   [note: Note]
  delete: [note: Note]
}>()
const { t } = useI18n()
const { getFaviconUrl } = useFavicon()
type LinkNoteEntry =
  | { kind: 'divider'; key: string }
  | { kind: 'text'; key: string; text: string }
  | { kind: 'link'; key: string; text: string; url: string; faviconUrl: string | null }

// ─── Accordion state ──────────────────────────────────────────────────────────

const expanded = ref(false)
function toggle() { expanded.value = !expanded.value }

// ─── Type metadata for the header pill ────────────────────────────────────────

const TYPE_META: Record<Note['type'], { label: string; cls: string }> = {
  text:  { label: t('noteCard.typeLabels.text'),  cls: 'bg-white/10 text-white/80'      },
  code:  { label: t('noteCard.typeLabels.code'),  cls: 'bg-[#2e7d32] text-white'        },
  links: { label: t('noteCard.typeLabels.links'), cls: 'bg-[#0056b3] text-white'        },
  html:  { label: t('noteCard.typeLabels.html'),  cls: 'bg-amber-700/60 text-amber-100' },
  crypt: { label: t('noteCard.typeLabels.crypt'), cls: 'bg-rose-700/60 text-rose-100'   },
}
const typeMeta = computed(() => TYPE_META[props.note.type])
const noteTypeClass = computed(() => `st-module-notes-type-${props.note.type}`)

// ─── Per-type rendering ───────────────────────────────────────────────────────

// links: split on newlines and produce a clean list of URLs
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
    .map(l => l.trim())
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
        // Plain text lines are allowed between links.
      }
      return { kind: 'text', key: `text:${index}`, text: line } satisfies LinkNoteEntry
    })
})

// code: highlight once, cache by content/language
const codeHtml = ref('')

watch(
  [() => props.note.type, () => props.note.content, () => props.language, expanded],
  async ([type, content, language, isExpanded]) => {
    if (type !== 'code' || !isExpanded) {
      codeHtml.value = ''
      return
    }
    codeHtml.value = await highlightCode(content, language ?? null)
  },
  { immediate: true }
)

// html: sanitise once, only when expanded
const htmlSafe = ref('')
let revokeHtmlAssets: (() => void) | null = null

watch(
  [() => props.note.type, () => props.note.content, expanded],
  async ([type, content, isExpanded]) => {
    revokeHtmlAssets?.()
    revokeHtmlAssets = null
    htmlSafe.value = ''

    if (type !== 'html' || !isExpanded || !content) return

    const rendered = await renderNoteHtmlWithAssets(content)
    htmlSafe.value = rendered.html
    revokeHtmlAssets = rendered.revoke
  },
  { immediate: true },
)

// ─── Crypt unlock state ───────────────────────────────────────────────────────
// Plaintext is held only while the note is "unlocked"; locking wipes the
// reference so it becomes eligible for GC and is never persisted.

const passphraseInput = ref('')
const unlockedText    = ref<string | null>(null)
const unlockError     = ref<string | null>(null)
const unlocking       = ref(false)

async function unlock() {
  if (props.note.type !== 'crypt') return
  unlocking.value  = true
  unlockError.value = null
  try {
    const payload = parseCryptPayload(props.note.content)
    const plain   = await decryptNote(payload, passphraseInput.value)
    unlockedText.value = plain
    passphraseInput.value = ''  // never keep the passphrase in state
  } catch {
    unlockError.value = t('noteCard.wrongPassphrase')
  } finally {
    unlocking.value = false
  }
}

function lock() {
  unlockedText.value    = null
  unlockError.value     = null
  passphraseInput.value = ''
}

// Auto-lock when the component is destroyed (page navigation, etc.)
onBeforeUnmount(lock)
onBeforeUnmount(() => revokeHtmlAssets?.())
</script>

<template>
  <div
    class="st-note-card border-b border-white/[0.05] group transition-colors cursor-grab active:cursor-grabbing"
    :class="[
      noteTypeClass,
      isDragging ? 'opacity-40' : '',
      isDragOver && !isDragging ? 'bg-white/10' : '',
    ]"
  >
    <!-- ─── Header (always visible, single dense ~20 px line) ────────────────── -->
    <button
      type="button"
      @click="toggle"
      class="w-full h-5 flex items-center gap-1.5 px-1 text-left
             hover:bg-white/[0.04] transition-colors"
    >
      <span
        class="font-mono text-[9px] leading-none px-1 py-0.5 rounded-sm shrink-0 tracking-wide"
        :class="typeMeta.cls"
      >{{ typeMeta.label }}</span>

      <span class="text-[11px] text-white/90 flex-1 truncate leading-none">{{ note.title }}</span>

      <span v-if="note.type === 'links'" class="text-[9px] text-white/40 tabular-nums shrink-0 leading-none">
        {{ linkItems.length }}
      </span>
      <span v-else-if="note.type === 'crypt' && unlockedText" class="text-[9px] text-[#2e7d32] shrink-0 leading-none">
        {{ t('noteCard.unlocked') }}
      </span>

      <!-- Hover-only controls (drag the row to reorder) -->
      <div class="flex items-center opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <span @click.stop="emit('edit', note)"   class="p-0.5 hover:text-white text-white/50" :title="t('noteCard.edit')" role="button" :aria-label="t('noteCard.editAria')">
          <svg class="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
        </span>
        <span @click.stop="emit('delete', note)" class="p-0.5 hover:text-red-300 text-white/50" :title="t('noteCard.delete')" role="button" :aria-label="t('noteCard.deleteAria')">
          <svg class="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>
        </span>
      </div>

      <svg class="w-2.5 h-2.5 text-white/40 shrink-0 transition-transform" :class="{ 'rotate-90': expanded }"
           viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
      </svg>
    </button>

    <!-- ─── Expanded body ─────────────────────────────────────────────── -->
    <div v-if="expanded" :class="note.type === 'html' ? 'p-0' : 'px-2 pb-2 pt-0.5'">
      <!-- text -->
      <pre v-if="note.type === 'text'"
           class="st-note-content-scale leading-snug text-gray-300 whitespace-pre-wrap break-words font-sans m-0">{{ note.content }}</pre>

      <!-- code -->
      <pre v-else-if="note.type === 'code'"
           class="st-note-content-scale hljs leading-snug rounded overflow-x-auto p-2 m-0"><code v-html="codeHtml"></code></pre>

      <!-- links -->
      <ul v-else-if="note.type === 'links'" class="st-note-content-scale st-note-link-list">
        <li v-for="entry in linkItems" :key="entry.key" class="leading-tight">
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

      <!-- html (sanitised) -->
      <div v-else-if="note.type === 'html'"
           class="st-note-content-scale st-note-html-content st-module-notes-type-html" v-html="htmlSafe"></div>

      <!-- crypt: locked → passphrase prompt; unlocked → plaintext + lock button -->
      <div v-else-if="note.type === 'crypt'">
        <div v-if="!unlockedText" class="flex items-center gap-1.5">
          <input
            v-model="passphraseInput"
            :id="`note-card-passphrase-${note.id}`"
            :name="`note_card_passphrase_${note.id}`"
            type="password"
            :placeholder="t('noteCard.passphrase')"
            @keydown.enter.prevent="unlock"
            class="flex-1 bg-surface-950 border border-white/10 rounded px-2 py-1
                   text-[12px] text-gray-100 font-mono
                   focus:outline-none focus:ring-1 focus:ring-rose-500"
          />
          <button type="button" @click="unlock" :disabled="unlocking || !passphraseInput"
            class="px-2 py-1 bg-rose-700 hover:bg-rose-600 disabled:opacity-40
                   text-white rounded text-[11px] font-medium">
            {{ unlocking ? t('noteCard.unlocking') : t('noteCard.unlock') }}
          </button>
        </div>
        <p v-if="unlockError" class="mt-1 text-[10px] text-rose-400">{{ unlockError }}</p>

        <div v-if="unlockedText" class="space-y-1">
          <pre class="st-note-content-scale leading-snug text-gray-200 whitespace-pre-wrap break-words font-sans m-0">{{ unlockedText }}</pre>
          <button type="button" @click="lock"
            class="text-[10px] uppercase tracking-wider font-bold text-rose-400 hover:text-rose-300">
            {{ t('noteCard.lock') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
