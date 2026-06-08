<script setup lang="ts">
import { registerAddContent } from '@/composables/useAddContent'
import { TILE_W } from '@/composables/useAsset'
import { useDragSort } from '@/composables/useDragSort'
import { markExportDirty } from '@/composables/useExportState'
import { useLiveQuery } from '@/composables/useLiveQuery'
import { useOpenNotes } from '@/composables/useOpenNotes'
import { useReorder } from '@/composables/useReorder'
import { db, isActiveRecord, makeCreateMetadata, makeUpdatedAtPatch } from '@/db/db'
import type { Collection, Note, NoteType, PortableInput } from '@/types/db'
import { computed, ref } from 'vue'
import Modal from './Modal.vue'
import NoteForm from './NoteForm.vue'
import NoteTile from './NoteTile.vue'

const props = defineProps<{
  collection: Collection
  columns: number
  showAddTile?: boolean
  highlightNoteId?: number | null
}>()

// ─── Live notes list ──────────────────────────────────────────────────────────

const { data: notes } = useLiveQuery(
  () => db.notes.where('collection_id').equals(props.collection.id!).filter(isActiveRecord).sortBy('sort_order'),
  [] as Note[],
  [() => props.collection.id],
)

const { move: moveNote } = useReorder(db.notes, notes)
const noteDnd = useDragSort({ onReorder: (f, t) => moveNote(f, t) })

const NOTE_TILE_W = TILE_W

const gridStyle = computed<Record<string, string>>(() => {
  if (props.columns <= 0) return {} as Record<string, string>
  return {
    '--st-module-content-max-width': `${props.columns * NOTE_TILE_W + (props.columns - 1) * 4}px`,
  }
})

// ─── Viewer modal state ───────────────────────────────────────────────────────
const { openNote, isNoteOpen } = useOpenNotes()

// ─── CRUD modal state ─────────────────────────────────────────────────────────

const isFormOpen  = ref(false)
const editingNote = ref<Note | undefined>(undefined)
const isPreviewMode = ref(false)
const noteFormType = ref<NoteType>('text')
const noteTypeLabels: Record<NoteType, string> = {
  text: 'Text',
  code: 'Code',
  links: 'Links',
  html: 'HTML',
  crypt: 'Crypt',
}

function openAdd() {
  editingNote.value = undefined
  noteFormType.value = 'text'
  isFormOpen.value  = true
}

registerAddContent(openAdd)

async function saveNote(data: PortableInput<Note>) {
  const now = Date.now()
  if (editingNote.value?.id) {
    await db.notes.update(editingNote.value.id, {
      ...data,
      ...makeUpdatedAtPatch(now),
    })
    await markExportDirty('notes:update')
  } else {
    const count     = await db.notes.where('collection_id').equals(data.collection_id).filter(isActiveRecord).count()
    data.sort_order = count
    await db.notes.add({
      ...data,
      ...makeCreateMetadata(now),
    })
    await markExportDirty('notes:create')
  }
  isFormOpen.value = false
  isPreviewMode.value = false
}

async function deleteNoteById(id: number) {
  await db.notes.delete(id)
  await markExportDirty('notes:delete')
  isFormOpen.value = false
  isPreviewMode.value = false
}
</script>

<template>
  <div class="flex flex-wrap justify-center items-center w-full h-full">
    <!-- ─── Tile grid (same layout as TabsView bookmarks) ────────────────── -->
    <div
      v-if="notes.length"
      class="st-module-content-wrapper st-module-notes-trigger items-center"
      :style="gridStyle"
    >
      <NoteTile
        v-for="(note, idx) in notes"
        :key="note.id"
        v-bind="noteDnd.bindFor(idx)"
        :note="note"
        :is-open="isNoteOpen(note.id)"
        :is-search-highlighted="props.highlightNoteId === note.id"
        :is-dragging="noteDnd.draggingIndex.value === idx"
        :is-drag-over="noteDnd.dragOverIndex.value === idx"
        @view="openNote"
      />

      <!-- Optional "+ Add Note" tile -->
      <button
        v-if="showAddTile !== false"
        @click="openAdd"
        class="st-content-trigger-button st-inline-add-content-trigger border
               flex items-center justify-center
               transition-colors shrink-0"
        title="Add note"
      >+</button>
    </div>

    <!-- ─── Empty state ──────────────────────────────────────────────────── -->
    <div v-else class="st-module-empty text-center">
      <p class="text-[11px] text-white/50 italic mb-2">No notes in this module</p>
      <button @click="openAdd"
        class="text-[10px] uppercase tracking-wider font-normal text-white/80 hover:text-white transition-colors">
        + Add Note
      </button>
    </div>

    <!-- ─── CRUD form modal ───────────────────────────────────────────────── -->
    <Modal :show="isFormOpen" :dock-right="isPreviewMode" :title="editingNote ? 'Edit Note' : 'New Note'" @close="isFormOpen = false; isPreviewMode = false">
      <template #header-meta>
        <span class="uppercase tracking-wider mr-1">Type</span>
        <span class="st-text-bold">{{ noteTypeLabels[noteFormType] }}</span>
      </template>
      <NoteForm
        :note="editingNote"
        :collection-id="collection.id!"
        @save="saveNote"
        @delete="deleteNoteById"
        @cancel="isFormOpen = false; isPreviewMode = false"
        @preview-mode-change="isPreviewMode = $event"
        @type-change="noteFormType = $event"
      />
    </Modal>
  </div>
</template>
