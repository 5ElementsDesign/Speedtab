<script setup lang="ts">
import type { CaptureInboxItem, Collection, Module, Note, Page } from '@/types/db'
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Modal from './Modal.vue'

const props = defineProps<{
  show: boolean
  items: CaptureInboxItem[]
  pages: Page[]
  modules: Module[]
  collections: Collection[]
  notes: Note[]
}>()

const emit = defineEmits<{
  close: []
  save: [item: CaptureInboxItem, collectionId: number, appendToNoteId?: number | null]
  discard: [itemId: number]
}>()
const { t } = useI18n()

const activeItemId = ref<number | null>(null)
const selectedModuleId = ref<number | null>(null)
const selectedCollectionId = ref<number | null>(null)
const selectedNoteId = ref<number | null>(null)
const draftNoteText = ref('')

const activeItem = computed(() =>
  props.items.find(item => item.id === activeItemId.value) ?? props.items[0] ?? null
)

const eligibleModules = computed(() => {
  if (!activeItem.value) return []
  const targetType = activeItem.value.kind === 'note' ? 'notes' : 'tabs'
  return props.modules.filter(module => module.type === targetType)
})

const eligibleCollections = computed(() => {
  if (!selectedModuleId.value) return []
  return props.collections.filter(collection => collection.module_id === selectedModuleId.value)
})

const eligibleNotes = computed(() => {
  if (activeItem.value?.kind !== 'note' || !selectedCollectionId.value) return []
  return props.notes
    .filter(note => note.collection_id === selectedCollectionId.value)
    .sort((a, b) => a.sort_order - b.sort_order)
})

function modulesForItem(item: CaptureInboxItem | null) {
  if (!item) return []
  const targetType = item.kind === 'note' ? 'notes' : 'tabs'
  return props.modules.filter(module => module.type === targetType)
}

function initializeSelectionForItem(item: CaptureInboxItem | null) {
  const firstModule = modulesForItem(item)[0] ?? null
  selectedModuleId.value = firstModule?.id ?? null
  const firstCollection = firstModule
    ? props.collections.find(collection => collection.module_id === firstModule.id) ?? null
    : null
  selectedCollectionId.value = firstCollection?.id ?? null
  selectedNoteId.value = null
}

function noteCanAppend(note: Note) {
  return note.type !== 'crypt'
}

function kindLabel(kind: CaptureInboxItem['kind']) {
  return kind === 'note' ? t('capture.note') : t('capture.bookmark')
}

function moduleLabel(module: Module) {
  const page = props.pages.find(candidate => candidate.id === module.page_id)
  return page ? `${page.title} › ${module.title}` : module.title
}

watch(() => props.show, (isOpen) => {
  if (!isOpen) return
  activeItemId.value = props.items[0]?.id ?? null
  nextTick(() => initializeSelectionForItem(activeItem.value))
}, { immediate: true })

watch(activeItem, (item) => {
  initializeSelectionForItem(item)
}, { immediate: true })

watch(() => props.items, (items) => {
  if (!items.length) {
    activeItemId.value = null
    return
  }
  if (!items.some(item => item.id === activeItemId.value)) {
    activeItemId.value = items[0]?.id ?? null
  }
}, { deep: true })

watch(activeItem, (item) => {
  draftNoteText.value = item?.kind === 'note' ? (item.text ?? '') : ''
}, { immediate: true })
</script>

<template>
  <Modal :show="show" :title="t('capture.inboxTitle')" @close="emit('close')">
    <div v-if="items.length" class="space-y-4">
      <div class="grid grid-cols-[12rem_minmax(0,1fr)] gap-4 max-h-[85vh] min-h-[24rem]">
        <div class="border border-white/10 bg-black/20 overflow-y-auto">
          <button
            v-for="item in items"
            :key="item.id"
            type="button"
            @click="activeItemId = item.id ?? null"
            class="w-full text-left px-3 py-2 border-b border-white/10 transition-colors"
            :class="activeItemId === item.id ? 'bg-white/10 text-white' : 'text-white/75 hover:bg-white/5 hover:text-white'"
          >
            <div class="text-[10px] uppercase tracking-wider text-white/45">{{ kindLabel(item.kind) }}</div>
            <div class="text-[11px] font-medium truncate">{{ item.title || item.url || t('capture.capturedItem') }}</div>
          </button>
        </div>

        <div v-if="activeItem" class="space-y-4 min-w-0">
          <div class="border border-white/10 bg-black/20 px-3 py-3 space-y-2">
            <div class="text-[10px] uppercase tracking-wider text-white/45">{{ t('capture.preview') }}</div>
            <div class="text-[11px] text-white/90 break-words">
              <template v-if="activeItem.kind === 'note'">
                <textarea
                  v-model="draftNoteText"
                  class="min-h-[160px] w-full resize-y bg-surface-950 border border-white/10 rounded px-3 py-2 text-[11px] text-white/90 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </template>
              <template v-else>
                <div class="font-medium">{{ activeItem.title || t('capture.capturedBookmark') }}</div>
                <div class="text-white/60 break-all">{{ activeItem.url }}</div>
              </template>
            </div>
          </div>

          <div class="space-y-3">
            <div>
              <label for="capture_module" class="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">{{ t('capture.module') }}</label>
              <select
                id="capture_module"
                v-model.number="selectedModuleId"
                class="w-full bg-surface-950 border border-white/10 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option
                  v-for="module in eligibleModules"
                  :key="module.id"
                  :value="module.id"
                >
                  {{ moduleLabel(module) }}
                </option>
              </select>
            </div>

            <div>
              <label for="capture_collection" class="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">{{ t('capture.tab') }}</label>
              <select
                id="capture_collection"
                v-model.number="selectedCollectionId"
                class="w-full bg-surface-950 border border-white/10 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option
                  v-for="collection in eligibleCollections"
                  :key="collection.id"
                  :value="collection.id"
                >
                  {{ collection.title }}
                </option>
              </select>
            </div>

            <div v-if="activeItem.kind === 'note' && eligibleNotes.length">
              <label for="capture_existing_note" class="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">{{ t('capture.existingNote') }}</label>
              <select
                id="capture_existing_note"
                v-model.number="selectedNoteId"
                class="w-full bg-surface-950 border border-white/10 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option :value="null">{{ t('capture.createNewNote') }}</option>
                <option
                  v-for="note in eligibleNotes"
                  :key="note.id"
                  :value="note.id"
                  :disabled="!noteCanAppend(note)"
                >
                  {{ note.title || t('capture.untitledNote') }}{{ noteCanAppend(note) ? '' : t('capture.encryptedSuffix') }}
                </option>
              </select>
            </div>
          </div>

          <div class="flex items-center justify-between pt-3 border-t border-white/10">
            <button
              type="button"
              @click="activeItem.id && emit('discard', activeItem.id)"
              class="text-xs text-red-400 hover:text-red-300 transition-colors"
            >
              {{ t('capture.discard') }}
            </button>

            <div class="flex gap-3">
              <button
                type="button"
                @click="emit('close')"
                class="px-4 py-2 text-xs font-medium text-gray-400 hover:text-gray-200 transition-colors"
              >
                {{ t('common.close') }}
              </button>
              <button
                v-if="activeItem.kind !== 'note' || !selectedNoteId"
                type="button"
                :disabled="!selectedCollectionId"
                @click="activeItem && selectedCollectionId && emit('save', {
                  ...activeItem,
                  text: activeItem.kind === 'note' ? draftNoteText : activeItem.text,
                }, selectedCollectionId, null)"
                class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded text-xs font-medium transition-all"
              >
                {{ activeItem.kind === 'note' ? t('capture.createNewNoteAction') : t('capture.saveToSpeedtab') }}
              </button>
              <button
                v-if="activeItem.kind === 'note' && selectedNoteId"
                type="button"
                @click="activeItem && selectedCollectionId && emit('save', {
                  ...activeItem,
                  text: draftNoteText,
                }, selectedCollectionId, selectedNoteId)"
                class="px-4 py-2 bg-white/10 hover:bg-white/15 text-white rounded text-xs font-medium transition-all"
              >
                {{ t('capture.append') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="text-center py-8">
      <p class="text-[11px] text-white/50 italic">{{ t('capture.noItemsWaiting') }}</p>
    </div>
  </Modal>
</template>
