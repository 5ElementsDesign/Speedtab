<script setup lang="ts">
defineOptions({ inheritAttrs: false })

import { provideAddContent } from '@/composables/useAddContent'
import { useDragSort } from '@/composables/useDragSort'
import { markExportDirty } from '@/composables/useExportState'
import { provideFeedArchive } from '@/composables/useFeedArchive'
import { provideFeedClear } from '@/composables/useFeedClear'
import { useLiveQuery } from '@/composables/useLiveQuery'
import { cleanupOrphans, deleteCollectionTree } from '@/composables/useMaintenance'
import { useReorder } from '@/composables/useReorder'
import { db, isActiveRecord, makeCreateMetadata, makeUpdatedAtPatch } from '@/db/db'
import type { Collection, Module, PortableInput } from '@/types/db'
import { computed, nextTick, ref, useAttrs, watch } from 'vue'
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
  /** Remembered/current expanded width for feed modules. */
  expandedWidth?:      320 | 480 | 740 | 940 | 1240 | 1540 | 'max' | null
  /** Global search URL template for feed item headline search. */
  feedSearchUrlTemplate?: string
  searchHighlight?: {
    moduleId: number | null
    collectionId: number | null
    kind: 'page' | 'module' | 'collection' | 'bookmark' | 'note' | 'feed_source' | 'archived_feed_item'
    entityId: number | null
  } | null
  /** Drag-and-drop feedback flags set by the parent grid (App.vue). */
  isDragging?:         boolean
  isDragOver?:         boolean
}>()

const emit = defineEmits<{
  edit:         [module: Module]
  /** Tab click: emits the module, the chosen Collection id, and all sibling ids
   *  in this module so the parent can swap them in the hash list. */
  focus:        [module: Module, colId?: number, siblingIds?: number[]]
  setExpandWidth: [module: Module, width: 320 | 480 | 740 | 940 | 1240 | 1540 | 'max' | null]
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
const moduleConfig = computed<{ columns?: number; show_add_tile?: boolean; refresh_interval_ms?: number; feed_item_limit?: number; open_in_new_tab?: boolean | null; quicklinks?: boolean; force_favicon?: boolean; show_hover_actions?: boolean }>(() => {
  try { return JSON.parse(props.module.config_json ?? '{}') }
  catch { return {} }
})
const activeCollectionConfig = computed<{ refresh_interval_ms?: number }>(() => {
  try { return JSON.parse(activeCollection.value?.config_json ?? '{}') }
  catch { return {} }
})
const moduleColumns = computed<number>(() => typeof moduleConfig.value.columns === 'number' ? moduleConfig.value.columns : 4)
/** Per-module toggle for the inline "+" Add tile. Defaults to true. */
const showAddTile = computed<boolean>(() => moduleConfig.value.show_add_tile !== false)
const refreshIntervalMs = computed<number>(() =>
  typeof activeCollectionConfig.value.refresh_interval_ms === 'number'
    ? activeCollectionConfig.value.refresh_interval_ms
    : (moduleConfig.value.refresh_interval_ms ?? 0)
)
const feedItemLimit = computed<number>(() => moduleConfig.value.feed_item_limit ?? 0)
const openInNewTab = computed<boolean | null>(() => typeof moduleConfig.value.open_in_new_tab === 'boolean' ? moduleConfig.value.open_in_new_tab : null)
const quicklinks = computed<boolean>(() => moduleConfig.value.quicklinks === true)
const forceFavicon = computed<boolean>(() => moduleConfig.value.force_favicon === true)
const showHoverActions = computed<boolean>(() => moduleConfig.value.show_hover_actions !== false)
const isExpandedFeedModule = computed<boolean>(() => props.module.type === 'feeds' && props.isExpanded === true)
const isSearchHighlighted = computed<boolean>(() => props.searchHighlight?.moduleId === props.module.id)
const activeCollectionSearchHighlight = computed(() =>
  props.searchHighlight?.collectionId === activeCollection.value?.id ? props.searchHighlight : null
)
const EXPAND_WIDTH_OPTIONS = [320, 480, 740, 940, 1240, 1540, 'max'] as const
const lastExpandedWidth = computed<typeof EXPAND_WIDTH_OPTIONS[number] | null>(() => props.expandedWidth ?? null)
const expandSelectValue = computed<string>(() =>
  isExpandedFeedModule.value && props.expandedWidth
    ? String(props.expandedWidth)
    : ''
)
const isFeedSearchOpen = ref(false)
const feedSearchQuery = ref('')
const feedSearchInput = ref<HTMLInputElement | null>(null)

const expandedModuleStyle = computed<Record<string, string> | undefined>(() => {
  if (!isExpandedFeedModule.value) return undefined
  if (props.expandedWidth === 'max' || !props.expandedWidth) {
    const baseStyle: Record<string, string> = {
      position: 'fixed',
      zIndex:   '51',
      background: '#111111f5',
    }
    return baseStyle
  }
  const widthStyle: Record<string, string> = {
    position: 'fixed',
    zIndex:   '51',
    background: '#111111f5',
    left: '50%',
    transform: 'translateX(-50%)',
    width: `min(calc(100vw - 20px), ${props.expandedWidth}px)`,
  }
  return widthStyle
})

function handleExpandWidthSelect(event: Event) {
  const select = event.target as HTMLSelectElement
  const value = select.value
  if (!value) {
    emit('setExpandWidth', props.module, null)
    return
  }
  if (value === 'max') {
    emit('setExpandWidth', props.module, 'max')
  } else {
    const parsed = Number(value)
    if ([320, 480, 740, 940, 1240, 1540].includes(parsed)) {
      emit('setExpandWidth', props.module, parsed as 320 | 480 | 740 | 940 | 1240 | 1540)
    }
  }
}

function toggleFeedSearch() {
  if (isFeedSearchOpen.value && !feedSearchQuery.value.trim()) {
    isFeedSearchOpen.value = false
    return
  }
  isFeedSearchOpen.value = true
}

function clearFeedSearch() {
  feedSearchQuery.value = ''
  isFeedSearchOpen.value = false
}

watch(isFeedSearchOpen, async (open) => {
  if (!open) return
  await nextTick()
  feedSearchInput.value?.focus()
  feedSearchInput.value?.select()
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
    await markExportDirty('collections:update')
  } else {
    const count = await db.collections.where('module_id').equals(data.module_id).filter(isActiveRecord).count()
    data.sort_order = count
    await db.collections.add({
      ...data,
      ...makeCreateMetadata(now),
    })
    await markExportDirty('collections:create')
  }
  isCollectionModalOpen.value = false
}

async function deleteCollection(id: number) {
  if (!confirm('Are you sure you want to delete this collection?')) return
  await deleteCollectionTree(id)
  await cleanupOrphans()
  await markExportDirty('collections:delete')

  isCollectionModalOpen.value = false
}
</script>

<template>
  <section
    class="st-module"
    v-bind="rootAttrs"
    :data-module-type="module.type ?? 'type_error'"
    :class="[
      'bg-black/75 border transition-colors flex flex-col relative',
      isFocused ? 'border-white/30' : 'border-white/10',
      isSearchHighlighted ? 'ring-1 ring-red-500 shadow-[0_0_0_1px_rgba(239,68,68,0.95),0_0_18px_rgba(239,68,68,0.4)]' : '',
      isExpandedFeedModule
        ? `st-module-expanded-feed shadow-2xl ${props.expandedWidth === 'max' || !props.expandedWidth ? 'st-module-expanded-feed--max' : 'st-module-expanded-feed--width'}`
        : '',
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
      :class="'border-b flex items-center justify-between cursor-grab active:cursor-grabbing'"
    >
      <div class="st-module-header-main flex items-center w-full min-w-0 overflow-x-auto overflow-y-hidden" style="scrollbar-width: none">
        <!-- Collection Switcher — flat rectangular tabs, drag to reorder, click to focus -->
        <nav
          v-if="collections.length > 0"
          class="st-module-tabs flex flex-nowrap items-center line-height-[1.5] whitespace-nowrap"
          role="tablist"
          aria-label="Tabs"
        >
          <button
            v-for="(col, idx) in collections"
            :key="col.id"
            v-bind="collectionDnd.bindFor(idx)"
            @click.stop="selectCollection(col)"
            class="px-3 py-1 text-[10px] min-h-[32px] transition-colors cursor-grab active:cursor-grabbing"
            :class="[
              activeCollection?.id === col.id
                ? 'st-text-bold'
                : 'st-text-normal',
              props.searchHighlight?.collectionId === col.id ? 'ring-1 ring-red-500 shadow-[0_0_0_1px_rgba(239,68,68,0.95),0_0_12px_rgba(239,68,68,0.25)]' : '',
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

      <div class="st-module-actions flex h-full items-center gap-1 shrink-0" @click.stop>
        <div
          v-if="module.type === 'feeds' && collections.length > 0"
          class="flex items-center gap-1 mr-[0.2rem]"
        >
          <button
            type="button"
            @click="toggleFeedSearch"
            class="h-full self-stretch px-2 py-1 text-white/70 hover:text-white flex items-center justify-center border-0 rounded-none"
            :title="feedSearchQuery.trim() ? 'Feed search active' : 'Search loaded feed items'"
            :aria-label="'Search loaded feed items'"
          >
            <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <circle cx="11" cy="11" r="7"></circle>
              <path d="m20 20-3.5-3.5"></path>
            </svg>
          </button>
          <div v-if="isFeedSearchOpen || feedSearchQuery.trim()" class="flex items-center gap-1">
            <input
              ref="feedSearchInput"
              v-model="feedSearchQuery"
              type="search"
              name="searchInStoredFeedItems"
              placeholder="Search"
              class="h-full max-w-[220px] w-[140px] px-2 py-0.5 bg-black/20 text-[11px] text-white/90 border border-white/10 outline-none focus:border-white/25"
            />
            <button
              v-if="feedSearchQuery.trim()"
              type="button"
              @click="clearFeedSearch"
              class="h-full self-stretch px-1.5 py-1 text-white/55 hover:text-white border-0"
              title="Clear feed search"
              aria-label="Clear feed search"
            >
              ×
            </button>
          </div>
        </div>
        <select
          v-if="module.type === 'feeds' && collections.length > 0"
          :id="`feed-expand-width-${module.id}`"
          :name="`feed-expand-width-${module.id}`"
          :title="'Expand feed module'"
          :aria-label="'Expand feed module'"
          :value="expandSelectValue"
          @change="handleExpandWidthSelect"
          class="mr-[0.2rem] h-full self-stretch max-w-[100px] px-2 py-1 pr-6 text-[10px] uppercase tracking-wider bg-black/0 text-[color:var(--st-theme-text)] border-0 outline-none"
        >
          <option value="" class="text-black bg-white">Expand</option>
          <option
            v-for="width in EXPAND_WIDTH_OPTIONS"
            :key="width"
            :value="width"
            class="text-black bg-white"
          >
            {{ width === 'max' ? 'max' : width }}{{ lastExpandedWidth === width ? ' · Last used' : '' }}
          </option>
        </select>
        <Dropdown
          label="Module actions"
          title="Module actions"
          align="right"
          :hide-chevron="true"
          root-class="h-full"
          trigger-class="st-module-action-trigger h-full self-stretch px-3 py-1 mr-0 text-white/80 hover:text-white flex items-center justify-center border-0 rounded-none"
        >
          <template #trigger>
            <span class="leading-none text-[16px]">+</span>
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
        module.type === 'feeds' && collections.length > 0
          ? ''
          : module.type === 'tabs' && quicklinks
            ? 'px-2 py-2'
            : 'px-4 py-4',
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
          :expanded-width="props.expandedWidth"
          :refresh-interval-ms="refreshIntervalMs"
          :feed-item-limit="feedItemLimit"
          :feed-filter-query="feedSearchQuery"
          :feed-search-url-template="props.feedSearchUrlTemplate"
          :open-in-new-tab="openInNewTab"
          :quicklinks="quicklinks"
          :force-favicon="forceFavicon"
          :show-hover-actions="showHoverActions"
          :highlight-kind="activeCollectionSearchHighlight?.kind ?? null"
          :highlight-entity-id="activeCollectionSearchHighlight?.entityId ?? null"
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
        :module-type="module.type"
        @save="saveCollection"
        @delete="deleteCollection"
        @cancel="isCollectionModalOpen = false"
      />
    </Modal>
  </section>
</template>

<style scoped>
.st-module-expanded-feed {
  top: 20px;
  bottom: 20px;
}

.st-module-expanded-feed--max {
  left: 10px;
  right: 10px;
}

.st-module-expanded-feed--width {
  right: auto;
}

@media (max-width: 744px) {
  .st-module-expanded-feed {
    top: 40px;
    bottom: 0;
    left: 0 !important;
    right: 0 !important;
    width: 100vw !important;
    transform: none !important;
  }
}
</style>
