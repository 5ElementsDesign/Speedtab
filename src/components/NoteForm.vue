<script setup lang="ts">
import { storeOrGetAsset } from '@/composables/useAsset'
import { decryptNote, encryptNote, parseCryptPayload, serialiseCryptPayload } from '@/composables/useCrypt'
import { COMMON_LANGUAGES, detectCodeLanguage } from '@/composables/useHighlight'
import { makeNoteImageToken } from '@/composables/useNoteImages'
import type { OpenNoteWindow } from '@/composables/useOpenNotes'
import type { Note, NoteType, PortableInput } from '@/types/db'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import NoteViewerModal from './NoteViewerModal.vue'

const props = defineProps<{
  note?:        Note
  collectionId: number
}>()

const emit = defineEmits<{
  save:   [data: PortableInput<Note>]
  delete: [id: number]
  cancel: []
  previewModeChange: [active: boolean]
  typeChange: [type: NoteType]
}>()
const { t } = useI18n()

const NOTE_TYPES = computed(() => [
  { value: 'text',  label: t('noteForm.types.text')  },
  { value: 'code',  label: t('noteForm.types.code')  },
  { value: 'links', label: t('noteForm.types.links') },
  { value: 'html',  label: t('noteForm.types.html')  },
  { value: 'crypt', label: t('noteForm.types.crypt') },
] satisfies Array<{ value: NoteType; label: string }>)

// ─── Initial meta extraction ──────────────────────────────────────────────────

function parseMeta(json: string | null): { language?: string } {
  if (!json) return {}
  try { return JSON.parse(json) } catch { return {} }
}

const initialMeta = parseMeta(props.note?.meta_json ?? null)

// ─── Form state ───────────────────────────────────────────────────────────────

const STYLE_TOKENS = computed(() => [
  { value: null,      label: t('noteForm.styleTokens.default'), cls: 'st-color-default'  },
  { value: 'info',    label: t('noteForm.styleTokens.info'), cls: 'st-color-info'     },
  { value: 'success', label: t('noteForm.styleTokens.success'), cls: 'st-color-success' },
  { value: 'warning', label: t('noteForm.styleTokens.warning'), cls: 'st-color-warning'   },
  { value: 'danger',  label: t('noteForm.styleTokens.danger'), cls: 'st-color-danger'    },
  { value: 'dark',    label: t('noteForm.styleTokens.dark'), cls: 'st-color-dark'    },
  { value: 'light',   label: t('noteForm.styleTokens.light'), cls: 'st-color-light' },
])

const form = ref({
  title:       props.note?.title       ?? '',
  type:        props.note?.type        ?? ('text' as NoteType),
  style_token: props.note?.style_token ?? (null as string | null),
  // For non-crypt notes `content` is the live editor value.
  // For crypt notes it starts empty and is populated by Decrypt-to-edit.
  content:  props.note?.type === 'crypt' ? '' : (props.note?.content ?? ''),
  language: initialMeta.language ?? 'auto',
})

// ─── Crypt-specific transient state (never persisted anywhere) ────────────────

const passphrase   = ref('')
const passConfirm  = ref('')
const decryptInput = ref('')
const decrypted    = ref(false)
const cryptError   = ref<string | null>(null)
const working      = ref(false)
const contentTextarea = ref<HTMLTextAreaElement | null>(null)
const imageInput = ref<HTMLInputElement | null>(null)
const isPreviewOpen = ref(false)
const detectedLanguage = ref<string | null>(null)
const previewWindowState = ref<OpenNoteWindow>({
  noteId: -1,
  zIndex: 95,
  x: 40,
  y: 80,
  width: 300,
  height: 300,
})

const isCryptNew  = computed(() => form.value.type === 'crypt' && !props.note?.id)
const isCryptEdit = computed(() => form.value.type === 'crypt' &&  props.note?.id != null)
const codeLanguageOptions = computed(() => [
  {
    value: 'auto',
    label: detectedLanguage.value
      ? t('noteForm.code.autoDetectWithValue', { language: detectedLanguage.value })
      : t('noteForm.code.autoDetect'),
  },
  { value: 'plaintext', label: t('noteForm.code.plaintext') },
  ...COMMON_LANGUAGES.map((language) => ({
    value: language,
    label: language,
  })),
])

/** Reset transient secrets whenever the type toggles away from crypt. */
watch(() => form.value.type, (t) => {
  emit('typeChange', t)
  if (t !== 'crypt') {
    passphrase.value = passConfirm.value = decryptInput.value = ''
    decrypted.value  = false
    cryptError.value = null
  }
}, { immediate: true })

let detectLanguageRun = 0
watch(
  () => [form.value.type, form.value.language, form.value.content] as const,
  async ([type, language, content]) => {
    const runId = ++detectLanguageRun
    if (type !== 'code' || language !== 'auto') {
      detectedLanguage.value = null
      return
    }
    const detected = await detectCodeLanguage(content)
    if (runId !== detectLanguageRun) return
    detectedLanguage.value = detected
  },
  { immediate: true },
)

async function decryptForEdit() {
  cryptError.value = null
  working.value = true
  try {
    if (!props.note?.content) throw new Error(t('noteForm.errors.emptyCryptPayload'))
    const payload   = parseCryptPayload(props.note.content)
    form.value.content = await decryptNote(payload, decryptInput.value)
    passphrase.value   = decryptInput.value  // reuse for re-encrypt on save
    decryptInput.value = ''
    decrypted.value    = true
  } catch {
    cryptError.value = t('noteForm.errors.wrongPassphrase')
  } finally {
    working.value = false
  }
}

function wipeSecrets() {
  passphrase.value   = ''
  passConfirm.value  = ''
  decryptInput.value = ''
  form.value.content = ''
  decrypted.value    = false
}

onBeforeUnmount(wipeSecrets)

const previewNote = computed<Note>(() => ({
  id: -1,
  collection_id: props.collectionId,
  title: form.value.title.trim() || t('noteForm.previewTitle'),
  type: form.value.type === 'crypt' ? 'text' : form.value.type,
  content: form.value.content,
  style_token: form.value.style_token,
  sort_order: props.note?.sort_order ?? 0,
  meta_json: form.value.type === 'code' ? JSON.stringify({ language: form.value.language }) : null,
  sync_id: 'preview',
  created_at: 0,
  updated_at: 0,
  deleted_at: null,
}))

function openPreview() {
  const viewportWidth = typeof window === 'undefined' ? 1280 : window.innerWidth
  const viewportHeight = typeof window === 'undefined' ? 800 : window.innerHeight
  const isLargeViewport = viewportWidth >= 1024
  previewWindowState.value = {
    noteId: -1,
    zIndex: 95,
    x: isLargeViewport ? 24 : 40,
    y: isLargeViewport ? 24 : 80,
    width: isLargeViewport ? Math.max(300, Math.round(viewportWidth * 0.5) - 40) : 300,
    height: isLargeViewport ? Math.max(300, viewportHeight - 48) : 300,
  }
  isPreviewOpen.value = true
  emit('previewModeChange', true)
}

function closePreview() {
  isPreviewOpen.value = false
  emit('previewModeChange', false)
}

function updatePreviewWindow(patch: Partial<Pick<OpenNoteWindow, 'x' | 'y' | 'width' | 'height'>>) {
  previewWindowState.value = {
    ...previewWindowState.value,
    ...patch,
  }
}

function focusPreview() {
  previewWindowState.value = {
    ...previewWindowState.value,
    zIndex: 95,
  }
}

// ─── Submit ───────────────────────────────────────────────────────────────────

async function handleSubmit() {
  if (!form.value.title.trim()) return
  cryptError.value = null

  let storedContent: string
  let metaJson: string | null = null

  if (form.value.type === 'crypt') {
    // New crypt note → require matching passphrases.
    // Editing crypt note → reuse the passphrase from decryptForEdit.
    if (isCryptNew.value) {
      if (!passphrase.value || passphrase.value !== passConfirm.value) {
        cryptError.value = t('noteForm.errors.passphrasesMismatch')
        return
      }
    } else if (!decrypted.value) {
      cryptError.value = t('noteForm.errors.unlockBeforeSaving')
      return
    }
    working.value = true
    const payload = await encryptNote(form.value.content, passphrase.value)
    storedContent = serialiseCryptPayload(payload)
    working.value = false
  } else {
    storedContent = form.value.content
    if (form.value.type === 'code') metaJson = JSON.stringify({ language: form.value.language })
  }

  emit('save', {
    collection_id: props.collectionId,
    title:         form.value.title.trim(),
    type:          form.value.type,
    content:       storedContent,
    style_token:   form.value.style_token,
    sort_order:    props.note?.sort_order  ?? 0,
    meta_json:     metaJson,
  })
  closePreview()
  wipeSecrets()
}

function onCancel() {
  closePreview()
  wipeSecrets()
  emit('cancel')
}

function openImagePicker() {
  imageInput.value?.click()
}

async function onImageSelected(event: Event) {
  const input = event.target as HTMLInputElement | null
  const file = input?.files?.[0]
  if (!file) return

  const assetId = await storeOrGetAsset(file, 'note_image', null, null, null)
  const token = makeNoteImageToken(assetId)
  const current = form.value.content ?? ''
  const textarea = contentTextarea.value

  if (!textarea) {
    form.value.content = current ? `${current}\n${token}` : token
    if (input) input.value = ''
    return
  }

  const start = textarea.selectionStart ?? current.length
  const end = textarea.selectionEnd ?? start
  const prefix = current.slice(0, start)
  const suffix = current.slice(end)
  const needsLeadingBreak = prefix.length > 0 && !prefix.endsWith('\n')
  const needsTrailingBreak = suffix.length > 0 && !suffix.startsWith('\n')
  const insertion = `${needsLeadingBreak ? '\n' : ''}${token}${needsTrailingBreak ? '\n' : ''}`

  form.value.content = `${prefix}${insertion}${suffix}`
  if (input) input.value = ''

  await nextTick()
  const nextPos = prefix.length + insertion.length
  textarea.focus()
  textarea.setSelectionRange(nextPos, nextPos)
}
</script>

<template>
  <form @submit.prevent="handleSubmit" class="flex h-full min-h-0 flex-col gap-4">

    <div>
      <label for="note_title" class="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">{{ t('noteForm.title') }}</label>
      <input id="note_title" v-model="form.title" type="text" required :placeholder="t('noteForm.titlePlaceholder')"
        class="w-full bg-surface-950 border border-white/10 rounded px-3 py-2 text-sm text-gray-100
               focus:outline-none focus:ring-1 focus:ring-indigo-500" />
    </div>

    <div v-if="!note?.id">
      <span class="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">{{ t('noteForm.type') }}</span>
      <div class="flex flex-wrap gap-1 leading-none">
        <button v-for="noteType in NOTE_TYPES" :key="noteType.value" type="button"
          @click="form.type = noteType.value"
          :class="[
            'px-2 py-2 rounded text-[11px] font-medium uppercase tracking-wider transition-colors',
            form.type === noteType.value
              ? 'bg-indigo-600 text-white'
              : 'bg-white/[0.04] text-gray-400 hover:text-gray-200 hover:bg-white/[0.08]',
          ]"
        >{{ noteType.label }}</button>
      </div>
    </div>

    <p v-if="note?.id" class="text-[10px] text-gray-600 italic">{{ t('noteForm.typeLocked') }}</p>

    <!-- ─── Color scheme picker (style_token) ─────────────────────────── -->
    <div>
      <span class="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">{{ t('noteForm.colorScheme') }}</span>
      <div class="flex flex-wrap gap-1 leading-none">
        <button
          v-for="tok in STYLE_TOKENS"
          :key="tok.value ?? 'default'"
          type="button"
          @click="form.style_token = tok.value"
          :class="[
            'px-2 py-2 rounded text-[11px] font-medium transition-all',
            tok.cls,
            form.style_token === tok.value
              ? 'ring-2 ring-white/60'
              : 'opacity-60 hover:opacity-90',
          ]"
        >{{ tok.label }}</button>
      </div>
    </div>

    <!-- ─── Code language picker ────────────────────────────────────────── -->
    <div v-if="form.type === 'code'">
      <label for="note_language" class="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">{{ t('noteForm.language') }}</label>
      <select id="note_language" v-model="form.language"
        class="w-full bg-surface-950 border border-white/10 rounded px-3 py-2 text-sm text-gray-100
               focus:outline-none focus:ring-1 focus:ring-indigo-500">
        <option v-for="option in codeLanguageOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
      </select>
    </div>

    <!-- ─── Crypt: decrypt-to-edit prompt ───────────────────────────────── -->
    <div v-if="isCryptEdit && !decrypted">
      <label for="note_unlock_passphrase" class="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">{{ t('noteForm.unlockToEdit') }}</label>
      <div class="flex gap-2">
        <input id="note_unlock_passphrase" v-model="decryptInput" type="password" :placeholder="t('noteForm.passphrase')"
          @keydown.enter.prevent="decryptForEdit"
          class="flex-1 bg-surface-950 border border-white/10 rounded px-3 py-2 text-sm text-gray-100 font-mono
                 focus:outline-none focus:ring-1 focus:ring-rose-500" />
        <button type="button" @click="decryptForEdit" :disabled="working || !decryptInput"
          class="px-3 py-2 bg-rose-700 hover:bg-rose-600 disabled:opacity-40 text-white rounded text-xs font-medium">
          {{ t('noteForm.unlock') }}
        </button>
      </div>
      <p v-if="cryptError" class="mt-1 text-[10px] text-rose-400">{{ cryptError }}</p>
    </div>

    <!-- ─── Content editor (shared for text/code/links/html and unlocked crypt) ─── -->
    <div v-if="form.type !== 'crypt' || decrypted || isCryptNew" class="flex min-h-0 flex-1 flex-col">
      <div class="flex items-center justify-between gap-3 mb-1">
        <label for="note_content" class="block text-xs font-medium text-gray-500 uppercase tracking-wider">
        <span v-if="form.type === 'links'">{{ t('noteForm.contentLabels.urls') }} <span class="normal-case font-normal text-gray-600">{{ t('noteForm.contentLabels.onePerLine') }}</span></span>
        <span v-else-if="form.type === 'html'">{{ t('noteForm.contentLabels.html') }} <span class="normal-case font-normal text-gray-600">{{ t('noteForm.contentLabels.sanitisedOnSave') }}</span></span>
        <span v-else-if="form.type === 'code'">{{ t('noteForm.contentLabels.code') }}</span>
        <span v-else-if="form.type === 'crypt'">{{ t('noteForm.contentLabels.plaintext') }} <span class="normal-case font-normal text-gray-600">{{ t('noteForm.contentLabels.encryptedBeforeStorage') }}</span></span>
        <span v-else>{{ t('noteForm.contentLabels.content') }}</span>
        </label>
        <button
          v-if="form.type === 'html'"
          type="button"
          @click="openImagePicker"
          class="px-2 py-1 text-[10px] uppercase tracking-wider font-medium text-sky-300 hover:text-sky-200 bg-white/[0.06] hover:bg-white/[0.1] rounded transition-colors"
        >
          {{ t('noteForm.addImage') }}
        </button>
      </div>
      <input
        v-if="form.type === 'html'"
        id="note_html_image_file"
        name="note_html_image_file"
        ref="imageInput"
        type="file"
        accept="image/*"
        capture="environment"
        class="hidden"
        @change="onImageSelected"
      />
      <textarea id="note_content" v-model="form.content"
        ref="contentTextarea"
        :placeholder="form.type === 'links' ? t('noteForm.linksPlaceholder') : ''"
        :class="[
          'w-full flex-1 min-h-[180px] bg-surface-950 border border-white/10 rounded px-3 py-2 text-sm text-gray-100',
          'focus:outline-none focus:ring-1 focus:ring-indigo-500',
          form.type === 'code' || form.type === 'links' || form.type === 'html' ? 'font-mono text-[12px]' : '',
        ]"
        rows="8"></textarea>
    </div>

    <!-- ─── Crypt: passphrase + confirm for new notes ───────────────────── -->
    <div v-if="isCryptNew" class="space-y-2">
      <div class="bg-rose-950/30 border border-rose-900/40 rounded px-2 py-1.5">
        <p class="text-[11px] text-rose-300 leading-snug">
          {{ t('noteForm.cryptWarning') }}
        </p>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <input id="note_new_passphrase" v-model="passphrase" name="note_new_passphrase" type="password" :placeholder="t('noteForm.passphrase')" required
          class="bg-surface-950 border border-white/10 rounded px-3 py-2 text-sm text-gray-100 font-mono
                 focus:outline-none focus:ring-1 focus:ring-rose-500" />
        <input id="note_new_passphrase_confirm" v-model="passConfirm" name="note_new_passphrase_confirm" type="password" :placeholder="t('noteForm.confirmPassphrase')" required
          class="bg-surface-950 border border-white/10 rounded px-3 py-2 text-sm text-gray-100 font-mono
                 focus:outline-none focus:ring-1 focus:ring-rose-500" />
      </div>
      <p v-if="cryptError" class="text-[10px] text-rose-400">{{ cryptError }}</p>
    </div>

    <!-- ─── Actions ─────────────────────────────────────────────────────── -->
    <div class="pt-3 mt-3 border-t border-white/10 flex items-center justify-between">
      <button v-if="note?.id" type="button" @click="emit('delete', note.id!)"
        class="text-xs text-red-400 hover:text-red-300 transition-colors">
        {{ t('noteForm.deleteNote') }}
      </button>
      <div v-else></div>
      <div class="flex gap-3">
        <button type="button" @click="onCancel"
          class="px-4 py-2 text-xs font-medium text-gray-400 hover:text-gray-200 transition-colors">
          {{ t('common.cancel') }}
        </button>
        <button v-if="form.type !== 'crypt'" type="button" @click="openPreview"
          class="px-4 py-2 bg-white/10 hover:bg-white/15 text-xs font-medium text-gray-100 rounded transition-colors">
          {{ t('noteForm.preview') }}
        </button>
        <button type="submit" :disabled="working"
          class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded text-xs font-medium
                 shadow-lg shadow-indigo-900/20 transition-all">
          {{ working ? t('noteForm.encrypting') : (note?.id ? t('noteForm.saveChanges') : t('noteForm.createNote')) }}
        </button>
      </div>
    </div>
  </form>

  <NoteViewerModal
    v-if="isPreviewOpen"
    :note="previewNote"
    :window-state="previewWindowState"
    preview-mode
    @focus="focusPreview"
    @close="closePreview"
    @move="updatePreviewWindow"
    @resize="updatePreviewWindow"
  />
</template>
