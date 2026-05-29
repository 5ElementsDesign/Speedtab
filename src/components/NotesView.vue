<script setup lang="ts">
import { registerAddContent } from '@/composables/useAddContent'
import { useDragSort } from '@/composables/useDragSort'
import { useLiveQuery } from '@/composables/useLiveQuery'
import { useReorder } from '@/composables/useReorder'
import { db, isActiveRecord, makeCreateMetadata, makeUpdatedAtPatch } from '@/db/db'
import type { Collection, Note, PortableInput } from '@/types/db'
import { computed, ref } from 'vue'
import Modal from './Modal.vue'
import NoteForm from './NoteForm.vue'
import NoteTile from './NoteTile.vue'
import NoteViewerModal from './NoteViewerModal.vue'

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

const gridStyle = computed(() => ({
  display:             'grid',
  gridTemplateColumns: 'repeat(auto-fit, 115px)',
  gap:                 '4px',
  justifyContent:      'center',
  maxWidth:            props.columns > 0 ? `${props.columns * 115 + (props.columns - 1) * 4}px` : 'none',
  marginLeft:          'auto',
  marginRight:         'auto',
}))

// ─── Viewer modal state ───────────────────────────────────────────────────────

const viewingNote = ref<Note | null>(null)
function openViewer(note: Note) { viewingNote.value = note }
function closeViewer()          { viewingNote.value = null }

// ─── CRUD modal state ─────────────────────────────────────────────────────────

const isFormOpen  = ref(false)
const editingNote = ref<Note | undefined>(undefined)

function openAdd() {
  editingNote.value = undefined
  isFormOpen.value  = true
}

registerAddContent(openAdd)

function openEdit(note: Note) {
  closeViewer()
  editingNote.value = note
  isFormOpen.value  = true
}

async function handleDelete(note: Note) {
  if (!note.id) return
  if (!confirm(`Delete note "${note.title}"? This cannot be undone.`)) return
  closeViewer()
  await db.notes.delete(note.id)
}

async function saveNote(data: PortableInput<Note>) {
  const now = Date.now()
  if (editingNote.value?.id) {
    await db.notes.update(editingNote.value.id, {
      ...data,
      ...makeUpdatedAtPatch(now),
    })
  } else {
    const count     = await db.notes.where('collection_id').equals(data.collection_id).filter(isActiveRecord).count()
    data.sort_order = count
    await db.notes.add({
      ...data,
      ...makeCreateMetadata(now),
    })
  }
  isFormOpen.value = false
}

async function deleteNoteById(id: number) {
  await db.notes.delete(id)
  isFormOpen.value = false
}
</script>

<template>
  <div class="flex flex-wrap justify-center items-center w-full h-full">
    <!-- ─── Tile grid (same layout as TabsView bookmarks) ────────────────── -->
    <div v-if="notes.length" class="items-center" :style="gridStyle">
      <NoteTile
        v-for="(note, idx) in notes"
        :key="note.id"
        v-bind="noteDnd.bindFor(idx)"
        :note="note"
        :is-search-highlighted="props.highlightNoteId === note.id"
        :is-dragging="noteDnd.draggingIndex.value === idx"
        :is-drag-over="noteDnd.dragOverIndex.value === idx"
        @view="openViewer"
      />

      <!-- Optional "+ Add Note" tile -->
      <button
        v-if="showAddTile !== false"
        @click="openAdd"
        class="w-[98px] h-[56px] border border-dashed border-white/20
               flex items-center justify-center
               text-white/40 hover:text-white hover:border-white/50
               text-sm transition-colors shrink-0"
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

    <!-- ─── Note viewer (Bulma-style message modal) ───────────────────────── -->
    <NoteViewerModal
      :show="viewingNote !== null"
      :note="viewingNote"
      @close="closeViewer"
      @edit="openEdit"
      @delete="handleDelete"
    />

    <!-- ─── CRUD form modal ───────────────────────────────────────────────── -->
    <Modal :show="isFormOpen" :title="editingNote ? 'Edit Note' : 'New Note'" @close="isFormOpen = false">
      <NoteForm
        :note="editingNote"
        :collection-id="collection.id!"
        @save="saveNote"
        @delete="deleteNoteById"
        @cancel="isFormOpen = false"
      />
    </Modal>
  </div>
</template>
