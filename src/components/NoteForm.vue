<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount, nextTick } from 'vue'
import type { Note, NoteType, PortableInput } from '@/types/db'
import { encryptNote, decryptNote, parseCryptPayload, serialiseCryptPayload } from '@/composables/useCrypt'
import { COMMON_LANGUAGES } from '@/composables/useHighlight'
import { storeOrGetAsset } from '@/composables/useAsset'
import { makeNoteImageToken } from '@/composables/useNoteImages'

const props = defineProps<{
  note?:        Note
  collectionId: number
}>()

const emit = defineEmits<{
  save:   [data: PortableInput<Note>]
  delete: [id: number]
  cancel: []
}>()

const NOTE_TYPES: { value: NoteType; label: string }[] = [
  { value: 'text',  label: 'Text'  },
  { value: 'code',  label: 'Code'  },
  { value: 'links', label: 'Links' },
  { value: 'html',  label: 'HTML'  },
  { value: 'crypt', label: 'Crypt' },
]

// ─── Initial meta extraction ──────────────────────────────────────────────────

function parseMeta(json: string | null): { language?: string } {
  if (!json) return {}
  try { return JSON.parse(json) } catch { return {} }
}

const initialMeta = parseMeta(props.note?.meta_json ?? null)

// ─── Form state ───────────────────────────────────────────────────────────────

const STYLE_TOKENS: { value: string | null; label: string; cls: string }[] = [
  { value: null,      label: 'Default', cls: 'bg-indigo-700 text-white'  },
  { value: 'info',    label: 'Info',    cls: 'bg-sky-700 text-white'     },
  { value: 'success', label: 'Success', cls: 'bg-emerald-700 text-white' },
  { value: 'warning', label: 'Warning', cls: 'bg-amber-600 text-white'   },
  { value: 'danger',  label: 'Danger',  cls: 'bg-rose-700 text-white'    },
  { value: 'dark',    label: 'Dark',    cls: 'bg-gray-800 text-white'    },
  { value: 'light',   label: 'Light',   cls: 'bg-gray-200 text-gray-900' },
]

const form = ref({
  title:       props.note?.title       ?? '',
  type:        props.note?.type        ?? ('text' as NoteType),
  style_token: props.note?.style_token ?? (null as string | null),
  // For non-crypt notes `content` is the live editor value.
  // For crypt notes it starts empty and is populated by Decrypt-to-edit.
  content:  props.note?.type === 'crypt' ? '' : (props.note?.content ?? ''),
  language: initialMeta.language ?? 'plaintext',
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

const isCryptNew  = computed(() => form.value.type === 'crypt' && !props.note?.id)
const isCryptEdit = computed(() => form.value.type === 'crypt' &&  props.note?.id != null)

/** Reset transient secrets whenever the type toggles away from crypt. */
watch(() => form.value.type, (t) => {
  if (t !== 'crypt') {
    passphrase.value = passConfirm.value = decryptInput.value = ''
    decrypted.value  = false
    cryptError.value = null
  }
})

async function decryptForEdit() {
  cryptError.value = null
  working.value = true
  try {
    if (!props.note?.content) throw new Error('Empty crypt payload')
    const payload   = parseCryptPayload(props.note.content)
    form.value.content = await decryptNote(payload, decryptInput.value)
    passphrase.value   = decryptInput.value  // reuse for re-encrypt on save
    decryptInput.value = ''
    decrypted.value    = true
  } catch {
    cryptError.value = 'Wrong passphrase or corrupted note.'
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
        cryptError.value = 'Passphrases must match and not be empty.'
        return
      }
    } else if (!decrypted.value) {
      cryptError.value = 'Unlock the note before saving.'
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
  wipeSecrets()
}

function onCancel() {
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
  const token = `<p>${makeNoteImageToken(assetId)}</p>`
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
  <form @submit.prevent="handleSubmit" class="space-y-4">

    <div>
      <label for="note_title" class="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Title</label>
      <input id="note_title" v-model="form.title" type="text" required placeholder="Note title"
        class="w-full bg-surface-950 border border-white/10 rounded px-3 py-2 text-sm text-gray-100
               focus:outline-none focus:ring-1 focus:ring-indigo-500" />
    </div>

    <div>
      <span class="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Type</span>
      <div class="flex flex-wrap gap-1">
        <button v-for="t in NOTE_TYPES" :key="t.value" type="button"
          :disabled="!!note?.id"
          @click="form.type = t.value"
          :class="[
            'px-2 py-1 rounded text-[11px] font-medium uppercase tracking-wider transition-colors',
            form.type === t.value
              ? 'bg-indigo-600 text-white'
              : 'bg-white/[0.04] text-gray-400 hover:text-gray-200 hover:bg-white/[0.08]',
            note?.id ? 'opacity-60 cursor-not-allowed' : '',
          ]"
        >{{ t.label }}</button>
      </div>
      <p v-if="note?.id" class="mt-1 text-[10px] text-gray-600 italic">Type cannot be changed after creation.</p>
    </div>

    <!-- ─── Color scheme picker (style_token) ─────────────────────────── -->
    <div>
      <span class="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Color Scheme</span>
      <div class="flex flex-wrap gap-1">
        <button
          v-for="tok in STYLE_TOKENS"
          :key="tok.value ?? 'default'"
          type="button"
          @click="form.style_token = tok.value"
          :class="[
            'px-2 py-1 rounded text-[11px] font-medium transition-all',
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
      <label for="note_language" class="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Language</label>
      <select id="note_language" v-model="form.language"
        class="w-full bg-surface-950 border border-white/10 rounded px-3 py-2 text-sm text-gray-100
               focus:outline-none focus:ring-1 focus:ring-indigo-500">
        <option v-for="l in COMMON_LANGUAGES" :key="l" :value="l">{{ l }}</option>
      </select>
    </div>

    <!-- ─── Crypt: decrypt-to-edit prompt ───────────────────────────────── -->
    <div v-if="isCryptEdit && !decrypted">
      <label for="note_unlock_passphrase" class="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Unlock to edit</label>
      <div class="flex gap-2">
        <input id="note_unlock_passphrase" v-model="decryptInput" type="password" placeholder="Passphrase"
          @keydown.enter.prevent="decryptForEdit"
          class="flex-1 bg-surface-950 border border-white/10 rounded px-3 py-2 text-sm text-gray-100 font-mono
                 focus:outline-none focus:ring-1 focus:ring-rose-500" />
        <button type="button" @click="decryptForEdit" :disabled="working || !decryptInput"
          class="px-3 py-2 bg-rose-700 hover:bg-rose-600 disabled:opacity-40 text-white rounded text-xs font-medium">
          Unlock
        </button>
      </div>
      <p v-if="cryptError" class="mt-1 text-[10px] text-rose-400">{{ cryptError }}</p>
    </div>

    <!-- ─── Content editor (shared for text/code/links/html and unlocked crypt) ─── -->
    <div v-if="form.type !== 'crypt' || decrypted || isCryptNew">
      <div class="flex items-center justify-between gap-3 mb-1">
        <label for="note_content" class="block text-xs font-medium text-gray-500 uppercase tracking-wider">
        <span v-if="form.type === 'links'">URLs <span class="normal-case font-normal text-gray-600">(one per line)</span></span>
        <span v-else-if="form.type === 'html'">HTML <span class="normal-case font-normal text-gray-600">(sanitised on save)</span></span>
        <span v-else-if="form.type === 'code'">Code</span>
        <span v-else-if="form.type === 'crypt'">Plaintext <span class="normal-case font-normal text-gray-600">(encrypted before storage)</span></span>
        <span v-else>Content</span>
        </label>
        <button
          v-if="form.type === 'html'"
          type="button"
          @click="openImagePicker"
          class="px-2 py-1 text-[10px] uppercase tracking-wider font-medium text-sky-300 hover:text-sky-200 bg-white/[0.06] hover:bg-white/[0.1] rounded transition-colors"
        >
          Add Image
        </button>
      </div>
      <input
        v-if="form.type === 'html'"
        ref="imageInput"
        type="file"
        accept="image/*"
        capture="environment"
        class="hidden"
        @change="onImageSelected"
      />
      <textarea id="note_content" v-model="form.content"
        ref="contentTextarea"
        :placeholder="form.type === 'links' ? 'https://...' : ''"
        :class="[
          'w-full bg-surface-950 border border-white/10 rounded px-3 py-2 text-sm text-gray-100',
          'focus:outline-none focus:ring-1 focus:ring-indigo-500',
          form.type === 'code' || form.type === 'links' || form.type === 'html' ? 'font-mono text-[12px]' : '',
        ]"
        rows="8"></textarea>
    </div>

    <!-- ─── Crypt: passphrase + confirm for new notes ───────────────────── -->
    <div v-if="isCryptNew" class="space-y-2">
      <div class="bg-rose-950/30 border border-rose-900/40 rounded px-2 py-1.5">
        <p class="text-[11px] text-rose-300 leading-snug">
          ⚠ The passphrase is <strong>not stored</strong>. If you forget it the note is permanently unrecoverable.
        </p>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <input v-model="passphrase" type="password" placeholder="Passphrase" required
          class="bg-surface-950 border border-white/10 rounded px-3 py-2 text-sm text-gray-100 font-mono
                 focus:outline-none focus:ring-1 focus:ring-rose-500" />
        <input v-model="passConfirm" type="password" placeholder="Confirm passphrase" required
          class="bg-surface-950 border border-white/10 rounded px-3 py-2 text-sm text-gray-100 font-mono
                 focus:outline-none focus:ring-1 focus:ring-rose-500" />
      </div>
      <p v-if="cryptError" class="text-[10px] text-rose-400">{{ cryptError }}</p>
    </div>

    <!-- ─── Actions ─────────────────────────────────────────────────────── -->
    <div class="pt-3 mt-3 border-t border-white/10 flex items-center justify-between">
      <button v-if="note?.id" type="button" @click="emit('delete', note.id!)"
        class="text-xs text-red-400 hover:text-red-300 transition-colors">
        Delete Note
      </button>
      <div v-else></div>
      <div class="flex gap-3">
        <button type="button" @click="onCancel"
          class="px-4 py-2 text-xs font-medium text-gray-400 hover:text-gray-200 transition-colors">
          Cancel
        </button>
        <button type="submit" :disabled="working"
          class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded text-xs font-medium
                 shadow-lg shadow-indigo-900/20 transition-all">
          {{ working ? 'Encrypting…' : (note?.id ? 'Save Changes' : 'Create Note') }}
        </button>
      </div>
    </div>
  </form>
</template>
