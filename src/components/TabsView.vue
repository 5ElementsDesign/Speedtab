<script setup lang="ts">
import { registerAddContent } from '@/composables/useAddContent'
import { useDragSort } from '@/composables/useDragSort'
import { useLiveQuery } from '@/composables/useLiveQuery'
import { cleanupOrphans } from '@/composables/useMaintenance'
import { useReorder } from '@/composables/useReorder'
import { TILE_W } from '@/composables/useAsset'
import { db, isActiveRecord, makeCreateMetadata, makeUpdatedAtPatch } from '@/db/db'
import type { AppSetting, Collection, PortableInput, Tab } from '@/types/db'
import { computed, ref } from 'vue'
import Modal from './Modal.vue'
import TabForm from './TabForm.vue'
import TabTile from './TabTile.vue'

const props = defineProps<{
  collection: Collection
/** Maximum tile columns. `0` means uncapped/infinite. */
  columns:     number
  /** Whether to render the bookmark-sized "+" add tile inline in the grid. */
  showAddTile: boolean
  /** Optional module-level override for opening in a new tab. */
  openInNewTab?: boolean | null
  /** Compact bookmark rendering mode. */
  quicklinks?: boolean
  /** Whether bookmark hover action buttons should be shown. */
  showHoverActions?: boolean
  highlightTabId?: number | null
}>()

// ─── Live tab list ─────────────────────────────────────────────────────────────

const { data: tabs } = useLiveQuery(
  () => db.tabs.where('collection_id').equals(props.collection.id!).filter(isActiveRecord).sortBy('sort_order'),
  [] as Tab[],
  [() => props.collection.id],
)

const { data: appearanceSetting } = useLiveQuery(
  () => db.app_settings.get('appearance'),
  null as AppSetting | null,
)

const resolvedOpenInNewTab = computed<boolean>(() => {
  if (typeof props.openInNewTab === 'boolean') return props.openInNewTab
  if (!appearanceSetting.value?.value_json) return false
  try {
    const parsed = JSON.parse(appearanceSetting.value.value_json)
    return parsed.open_bookmarks_in_new_tab === true
  } catch {
    return false
  }
})

// ─── Drag-and-drop reordering ─────────────────────────────────────────────────

const { move: moveTab } = useReorder(db.tabs, tabs)
const tabDnd = useDragSort({ onReorder: (f, t) => moveTab(f, t) })

const QUICKLINK_W = 54

const gridStyle = computed<Record<string, string>>(() => {
  if (props.columns <= 0) return {} as Record<string, string>
  const tileWidth = props.quicklinks ? QUICKLINK_W : TILE_W
  return {
    '--st-module-content-max-width': `${props.columns * tileWidth + (props.columns - 1) * 4}px`,
  }
})

// ─── CRUD ──────────────────────────────────────────────────────────────────────

const isModalOpen = ref(false)
const editingTab  = ref<Tab | undefined>(undefined)

function openAdd() {
  editingTab.value  = undefined
  isModalOpen.value = true
}

registerAddContent(openAdd)

function openEdit(tab: Tab) {
  editingTab.value  = tab
  isModalOpen.value = true
}

async function saveTab(data: PortableInput<Tab>) {
  const now = Date.now()
  if (editingTab.value?.id) {
    await db.tabs.update(editingTab.value.id, {
      ...data,
      ...makeUpdatedAtPatch(now),
    })
  } else {
    const count      = await db.tabs.where('collection_id').equals(data.collection_id).filter(isActiveRecord).count()
    data.sort_order  = count
    await db.tabs.add({
      ...data,
      ...makeCreateMetadata(now),
    })
  }
  await cleanupOrphans()
  isModalOpen.value = false
}

async function deleteTabById(id: number) {
  await db.tabs.delete(id)
  await cleanupOrphans()
  isModalOpen.value = false
}

async function deleteTileTab(tab: Tab) {
  if (!tab.id || !confirm('Delete this bookmark?')) return
  await db.tabs.delete(tab.id)
  await cleanupOrphans()
}
</script>

<template>
  <div class="h-full">
    <!-- ─── Tab grid (drag-and-drop reorderable) ─────────────────────────── -->
    <div
      v-if="tabs.length"
      class="st-module-content-wrapper items-center h-full"
      :style="gridStyle"
      :class="props.quicklinks === true ? 'st-module-tabs-quicklinks' : 'st-module-tabs-bookmarks'"
    >
      <TabTile
        v-for="(tab, idx) in tabs"
        :key="tab.id"
        v-bind="tabDnd.bindFor(idx)"
        :tab="tab"
        :open-in-new-tab="resolvedOpenInNewTab"
        :quicklinks="props.quicklinks === true"
        :show-hover-actions="props.showHoverActions !== false"
        :is-search-highlighted="props.highlightTabId === tab.id"
        :is-dragging="tabDnd.draggingIndex.value === idx"
        :is-drag-over="tabDnd.dragOverIndex.value === idx"
        @edit="openEdit"
        @delete="deleteTileTab"
      />

      <!--
        Optional "Add" tile — same 98×56 footprint as a bookmark, controlled
        per-module via the `showAddTile` setting in the module config.
      -->
      <button
        v-if="showAddTile"
        @click="openAdd"
        class="st-content-trigger-button rounded-sm border border-dashed border-white/20
               flex items-center justify-center
               text-white/40 hover:text-white hover:border-white/50
               text-sm transition-colors shrink-0"
        title="Add bookmark"
      >+</button>
    </div>

    <!-- ─── Empty state ───────────────────────────────────────────────────── -->
    <div v-else class="st-module-empty text-center h-full">
      <p class="text-[11px] text-white/50 italic mb-2">No bookmarks in this module</p>
      <button
        @click="openAdd"
        class="text-[10px] uppercase tracking-wider font-normal text-white/80
               hover:text-white transition-colors"
      >
        + Add Bookmark
      </button>
    </div>

    <!-- ─── Add-more button (when tiles already exist) ────────────────────── -->
    <!-- Note: "+" tile handles this inline; this is intentionally absent -->

    <!-- ─── CRUD Modal ────────────────────────────────────────────────────── -->
    <Modal
      :show="isModalOpen"
      :title="editingTab ? 'Edit Bookmark' : 'New Bookmark'"
      @close="isModalOpen = false"
    >
      <TabForm
        :tab="editingTab"
        :collection-id="collection.id!"
        @save="saveTab"
        @delete="deleteTabById"
        @cancel="isModalOpen = false"
      />
    </Modal>
  </div>
</template>
