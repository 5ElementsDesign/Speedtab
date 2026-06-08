<script setup lang="ts">
import { useOpenNotes } from '@/composables/useOpenNotes'
import { markExportDirty } from '@/composables/useExportState'
import { useLiveQuery } from '@/composables/useLiveQuery'
import { db, isActiveRecord, makeUpdatedAtPatch } from '@/db/db'
import type { Note, NoteType, PortableInput } from '@/types/db'
import { computed, ref, watch } from 'vue'
import Modal from './Modal.vue'
import NoteForm from './NoteForm.vue'
import NoteViewerModal from './NoteViewerModal.vue'

const {
  openWindows,
  focusNote,
  closeNote,
  closeMissingNotes,
  updateWindow,
} = useOpenNotes()

const openNoteIds = computed(() => openWindows.value.map((windowState) => windowState.noteId))

const { data: openNotes } = useLiveQuery(
  () => openNoteIds.value.length
    ? db.notes.where('id').anyOf(openNoteIds.value).filter(isActiveRecord).toArray()
    : Promise.resolve([] as Note[]),
  [] as Note[],
  [openNoteIds],
)

const noteById = computed(() => new Map(openNotes.value.map((note) => [note.id!, note])))
const noteWindows = computed(() =>
  openWindows.value
    .map((windowState) => {
      const note = noteById.value.get(windowState.noteId)
      return note ? { windowState, note } : null
    })
    .filter((entry): entry is { windowState: typeof openWindows.value[number]; note: Note } => !!entry),
)

watch(openNotes, (notes) => {
  closeMissingNotes(notes.map((note) => note.id!).filter((id): id is number => typeof id === 'number'))
}, { immediate: true })

const editingNote = ref<Note | null>(null)
const isFormOpen = ref(false)
const isPreviewMode = ref(false)
const noteFormType = ref<NoteType>('text')
const noteTypeLabels: Record<NoteType, string> = {
  text: 'Text',
  code: 'Code',
  links: 'Links',
  html: 'HTML',
  crypt: 'Crypt',
}

function openEdit(note: Note) {
  editingNote.value = note
  noteFormType.value = note.type
  isFormOpen.value = true
}

async function handleDelete(note: Note) {
  if (!note.id) return
  if (!confirm(`Delete note "${note.title}"? This cannot be undone.`)) return
  closeNote(note.id)
  if (editingNote.value?.id === note.id) {
    editingNote.value = null
    isFormOpen.value = false
  }
  await db.notes.delete(note.id)
  await markExportDirty('notes:delete')
}

async function saveNote(data: PortableInput<Note>) {
  const note = editingNote.value
  if (!note?.id) return

  const now = Date.now()
  await db.notes.update(note.id, {
    ...data,
    ...makeUpdatedAtPatch(now),
  })
  await markExportDirty('notes:update')
  isFormOpen.value = false
  editingNote.value = null
  isPreviewMode.value = false
}

async function deleteNoteById(id: number) {
  closeNote(id)
  await db.notes.delete(id)
  await markExportDirty('notes:delete')
  isFormOpen.value = false
  editingNote.value = null
  isPreviewMode.value = false
}

function closeForm() {
  editingNote.value = null
  isFormOpen.value = false
  isPreviewMode.value = false
}
</script>

<template>
  <div class="pointer-events-none fixed inset-0 z-[70]">
    <NoteViewerModal
      v-for="{ windowState, note } in noteWindows"
      :key="note.id"
      :note="note"
      :window-state="windowState"
      @focus="focusNote(note.id!)"
      @close="closeNote(note.id!)"
      @move="updateWindow(note.id!, $event)"
      @resize="updateWindow(note.id!, $event)"
      @edit="openEdit"
      @delete="handleDelete"
    />

    <Modal :show="isFormOpen" :dock-right="isPreviewMode" :title="editingNote ? 'Edit Note' : 'Note'" @close="closeForm">
      <template #header-meta>
        <span class="uppercase tracking-wider mr-1">Type</span>
        <span class="st-text-bold">{{ noteTypeLabels[noteFormType] }}</span>
      </template>
      <NoteForm
        v-if="editingNote"
        :note="editingNote"
        :collection-id="editingNote.collection_id"
        @save="saveNote"
        @delete="deleteNoteById"
        @cancel="closeForm"
        @preview-mode-change="isPreviewMode = $event"
        @type-change="noteFormType = $event"
      />
    </Modal>
  </div>
</template>
