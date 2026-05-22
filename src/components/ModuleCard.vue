<script setup lang="ts">
defineOptions({ inheritAttrs: false })

import { provideAddContent } from '@/composables/useAddContent'
import { useDragSort } from '@/composables/useDragSort'
import { provideFeedArchive } from '@/composables/useFeedArchive'
import { provideFeedClear } from '@/composables/useFeedClear'
import { useLiveQuery } from '@/composables/useLiveQuery'
import { cleanupOrphans, deleteCollectionTree } from '@/composables/useMaintenance'
import { useReorder } from '@/composables/useReorder'
import { db, isActiveRecord, makeCreateMetadata, makeUpdatedAtPatch } from '@/db/db'
import type { Collection, Module, PortableInput } from '@/types/db'
import { computed, ref, useAttrs } from 'vue'
import CollectionCard from './CollectionCard.vue'
import CollectionForm from './CollectionForm.vue'
import Dropdown from './Dropdown.vue'
import Modal from './Modal.vue'

const attrs = useAttrs()
const dragAttrKeys = new Set([
  'draggable',
  'data-drag-index',
  'data-drag-over',
  'data-dragging',
  'ondragstart',
  'ondragenter',
  'ondragover',
  'ondrop',
  'ondragend',
])

const rootAttrs = computed<Record<string, unknown>>(() =>
  Object.fromEntries(
    Object.entries(attrs).filter(([key]) => !dragAttrKeys.has(key.toLowerCase()))
  )
)

const dragAttrs = computed<Record<string, unknown>>(() =>
  Object.fromEntries(
    Object.entries(attrs).filter(([key]) => dragAttrKeys.has(key.toLowerCase()))
  )
)

const props = defineProps<{
  module:              Module
  /** Global hash-driven list of active Collection ids across all modules. */
  activeCollectionIds: number[]
  /** Last-clicked module flag (drives the focus border). */
  isFocused:           boolean
  /** Feed modules can be expanded into a larger reader mode. */
  isExpanded?:         boolean
  /** Drag-and-drop feedback flags set by the parent grid (App.vue). */
  isDragging?:         boolean
  isDragOver?:         boolean
}>()

const emit = defineEmits<{
  edit:         [module: Module]
  /** Tab click: emits the module, the chosen Collection id, and all sibling ids
   *  in this module so the parent can swap them in the hash list. */
  focus:        [module: Module, colId?: number, siblingIds?: number[]]
  toggleExpand: [module: Module]
}>()

// ─── Collections for this module ──────────────────────────────────────────────

const { data: collections, loading } = useLiveQuery(
  () => db.collections.where('module_id').equals(props.module.id!).filter(isActiveRecord).sortBy('sort_order'),
  [] as Collection[],
  [() => props.module.id]
)

const siblingIds = computed<number[]>(() =>
  collections.value.map(c => c.id).filter((id): id is number => typeof id === 'number')
)

// Resolve this module's active collection from the hash-driven list: the first
// id in that list that matches one of this module's own collections wins.
// Falls back to the first collection when no id matches.
const activeCollection = computed(() => {
  if (!collections.value.length) return null
  for (const id of props.activeCollectionIds) {
    const found = collections.value.find(c => c.id === id)
    if (found) return found
  }
  return collections.value[0]
})

function selectCollection(col: Collection) {
  emit('focus', props.module, col.id, siblingIds.value)
}

// Bridge for the "Add Content" dropdown entry. The currently mounted
// TabsView/NotesView/FeedsView registers its `openAdd` here via `registerAddContent`.
const addContent = provideAddContent()
const feedArchive = provideFeedArchive()
const feedClear = provideFeedClear()

/** Parse the module's config_json once and expose typed accessors. */
const moduleConfig = computed<{ columns?: number; show_add_tile?: boolean; refresh_interval_ms?: number; feed_item_limit?: number; open_in_new_tab?: boolean | null }>(() => {
  try { return JSON.parse(props.module.config_json ?? '{}') }
  catch { return {} }
})
const moduleColumns = computed<number>(() => moduleConfig.value.columns ?? 4)
/** Per-module toggle for the inline "+" Add tile. Defaults to true. */
const showAddTile = computed<boolean>(() => moduleConfig.value.show_add_tile !== false)
const refreshIntervalMs = computed<number>(() => moduleConfig.value.refresh_interval_ms ?? 0)
const feedItemLimit = computed<number>(() => moduleConfig.value.feed_item_limit ?? 0)
const openInNewTab = computed<boolean | null>(() => typeof moduleConfig.value.open_in_new_tab === 'boolean' ? moduleConfig.value.open_in_new_tab : null)
const isExpandedFeedModule = computed<boolean>(() => props.module.type === 'feeds' && props.isExpanded === true)

const expandedModuleStyle = computed<Record<string, string> | undefined>(() => {
  if (!isExpandedFeedModule.value) return undefined
  return {
    position: 'fixed',
    top:      '40px',
    left:     '20px',
    right:    '20px',
    bottom:   '20px',
    zIndex:   '51',
    background: '#111111f5',
  }
})

const { move: moveCollection } = useReorder(db.collections, collections)
const collectionDnd = useDragSort({ onReorder: (f, t) => moveCollection(f, t) })

// ─── Collection CRUD ──────────────────────────────────────────────────────────

const isCollectionModalOpen = ref(false)
const editingCollection = ref<Collection | undefined>(undefined)

function openAddCollection() {
  editingCollection.value = undefined
  isCollectionModalOpen.value = true
}

function openEditCollection(col: Collection) {
  editingCollection.value = col
  isCollectionModalOpen.value = true
}

async function saveCollection(data: PortableInput<Collection>) {
  const now = Date.now()
  if (editingCollection.value?.id) {
    await db.collections.update(editingCollection.value.id, {
      ...data,
      ...makeUpdatedAtPatch(now),
    })
  } else {
    const count = await db.collections.where('module_id').equals(data.module_id).filter(isActiveRecord).count()
    data.sort_order = count
    await db.collections.add({
      ...data,
      ...makeCreateMetadata(now),
    })
  }
  isCollectionModalOpen.value = false
}

async function deleteCollection(id: number) {
  if (!confirm('Are you sure you want to delete this collection?')) return
  await deleteCollectionTree(id)
  await cleanupOrphans()

  isCollectionModalOpen.value = false
}
</script>

<template>
  <section
    class="st-module"
    v-bind="rootAttrs"
    :class="[
      'bg-black/75 border transition-colors flex flex-col min-h-[110px] relative',
      isFocused ? 'border-white/30' : 'border-white/10',
      isExpandedFeedModule ? 'shadow-2xl' : '',
      isDragging ? 'opacity-40' : '',
      isDragOver && !isDragging ? 'ring-1 ring-[#00d2ff]' : '',
    ]"
    :style="expandedModuleStyle"
    @click="emit('focus', module)"
  >
    <!-- Module Header (drag handle = whole header, ~36 px) -->
    <header
      class="st-module-header"
      v-bind="dragAttrs"
      :title="module.title + ' (drag header to reorder)'"
      :class="'border-b border-black/50 flex items-center justify-between bg-black/40 cursor-grab active:cursor-grabbing'"
    >
      <div class="st-module-header-main flex items-center overflow-hidden w-full">
        <!-- Collection Switcher — flat rectangular tabs, drag to reorder, click to focus -->
        <nav
          v-if="collections.length > 0"
          class="st-module-tabs flex items-center leading-none"
          role="tablist"
          aria-label="Tabs"
        >
          <button
            v-for="(col, idx) in collections"
            :key="col.id"
            v-bind="collectionDnd.bindFor(idx)"
            @click.stop="selectCollection(col)"
            class="px-3 py-2 text-[11px] font-medium transition-colors cursor-grab active:cursor-grabbing"
            :class="[
              activeCollection?.id === col.id
                ? 'text-[#00d2ff] bg-white/10'
                : 'text-[#888888] hover:text-white',
              collectionDnd.draggingIndex.value === idx ? 'opacity-40' : '',
              collectionDnd.dragOverIndex.value === idx && collectionDnd.draggingIndex.value !== idx
                ? 'ring-1 ring-[#00d2ff]' : '',
            ]"
            role="tab"
            :aria-selected="activeCollection?.id === col.id"
          >
            {{ col.title }}
          </button>
        </nav>
      </div>

      <div class="st-module-actions flex items-center gap-1 shrink-0" @click.stop>
        <button
          v-if="module.type === 'feeds' && collections.length > 0"
          type="button"
          :title="props.isExpanded ? 'Restore feed module size' : 'Expand feed module'"
          :aria-label="props.isExpanded ? 'Restore feed module size' : 'Expand feed module'"
          @click="emit('toggleExpand', module)"
          class="px-1 py-0.5 text-[10px] uppercase tracking-wider text-white/70 hover:text-white"
        >
          {{ props.isExpanded ? '▣' : '▢' }}
        </button>
        <Dropdown
          label="Module actions"
          title="Module actions"
          align="right"
          trigger-class="px-1 py-0.5 text-[10px] uppercase tracking-wider text-white/70 hover:text-white"
        >
          <template #trigger>
            <span class="leading-none">⋯</span>
          </template>
          <div class="px-[0.1rem]">
            <button
              type="button"
              role="menuitem"
              @click="emit('edit', module)"
              class="w-full text-left px-2 py-1 text-[11px] text-white/90 hover:bg-white/10"
            >
              Edit Module
            </button>
            <button
              type="button"
              role="menuitem"
              :disabled="!activeCollection"
              @click="activeCollection && openEditCollection(activeCollection)"
              class="w-full text-left px-2 py-1 text-[11px] text-white/90 hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-transparent"
            >
              Edit active Tab
            </button>
            <button
              type="button"
              role="menuitem"
              @click="openAddCollection"
              class="w-full text-left px-2 py-1 text-[11px] text-white/90 hover:bg-white/10"
            >
              Add Tab
            </button>
            <hr class="my-1 border-0 border-t border-white/10" />
            <button
              type="button"
              role="menuitem"
              :disabled="!activeCollection || !addContent.hasHandler()"
              @click="addContent.trigger()"
              class="w-full text-left px-2 py-1 text-[11px] text-white/90 hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-transparent"
            >
              Add Content
            </button>
            <button
              v-if="module.type === 'feeds'"
              type="button"
              role="menuitem"
              @click="feedArchive.trigger()"
              class="w-full text-left px-2 py-1 text-[11px] text-white/90 hover:bg-white/10"
            >
              Archived Items
            </button>
            <hr
              v-if="module.type === 'feeds'"
              class="my-1 border-0 border-t border-white/10"
            />
            <button
              v-if="module.type === 'feeds'"
              type="button"
              role="menuitem"
              @click="feedClear.trigger()"
              class="w-full text-left px-2 py-1 text-[11px] text-white/90 hover:bg-white/10"
            >
              Clear Loaded Items
            </button>
          </div>
        </Dropdown>
      </div>
    </header>

    <!-- Module Content (Collections) -->
    <div
      class="st-module-body min-h-0 h-full"
      :class="[
        isExpandedFeedModule ? 'flex-1 overflow-hidden' : '',
        module.type === 'feeds' && collections.length > 0 ? '' : 'px-4 py-4',
      ]"
    >
      <div v-if="loading" class="st-module-loading animate-pulse space-y-2">
        <div class="h-3 bg-white/5 w-1/4"></div>
        <div class="h-16 bg-white/5"></div>
      </div>

      <div v-else-if="!collections.length" class="st-module-empty text-center">
        <p class="text-[11px] text-white/50 italic mb-2">No tabs in this module</p>
        <button
          @click="openAddCollection"
          class="text-[10px] uppercase tracking-wider font-normal text-white/80 hover:text-white transition-colors"
        >
          + Add Tab
        </button>
      </div>

      <div v-else class="st-module-content h-full" :class="isExpandedFeedModule ? 'min-h-0' : ''">
        <CollectionCard
          v-if="activeCollection"
          :collection="activeCollection"
          :module-type="module.type"
          :columns="moduleColumns"
          :show-add-tile="showAddTile"
          :is-expanded="props.isExpanded"
          :refresh-interval-ms="refreshIntervalMs"
          :feed-item-limit="feedItemLimit"
          :open-in-new-tab="openInNewTab"
        />
      </div>
    </div>

    <!-- Module Title (Watermark at bottom right) -->
    <div class="absolute bottom-0 right-0 px-1 py-0.5 pointer-events-none">
      <span class="text-[10px] text-white/30 lowercase tracking-wider">{{ module.title }}</span>
    </div>

    <!-- Collection Modal -->
    <Modal
      :show="isCollectionModalOpen"
      :title="editingCollection ? 'Edit Tab' : 'New Tab'"
      @close="isCollectionModalOpen = false"
    >
      <CollectionForm
        :collection="editingCollection"
        :module-id="module.id!"
        @save="saveCollection"
        @delete="deleteCollection"
        @cancel="isCollectionModalOpen = false"
      />
    </Modal>
  </section>
</template>
