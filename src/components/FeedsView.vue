<script setup lang="ts">
import { registerAddContent } from '@/composables/useAddContent'
import { useDragSort } from '@/composables/useDragSort'
import { useFavicon } from '@/composables/useFavicon'
import { useFeed } from '@/composables/useFeed'
import { registerFeedArchive } from '@/composables/useFeedArchive'
import { registerFeedClear } from '@/composables/useFeedClear'
import { useLiveQuery } from '@/composables/useLiveQuery'
import { useReorder } from '@/composables/useReorder'
import { db, isActiveRecord, makeCreateMetadata, makeUpdatedAtPatch } from '@/db/db'
import type { Collection, FeedItem, FeedSource, PortableInput, SavedFeedItem } from '@/types/db'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import FeedArchiveForm from './FeedArchiveForm.vue'
import FeedItemCard from './FeedItemCard.vue'
import FeedSourceForm from './FeedSourceForm.vue'
import Modal from './Modal.vue'

const props = defineProps<{
  collection: Collection
  expanded?: boolean
  refreshIntervalMs?: number
  itemLimit?: number
}>()

const { getFaviconUrl } = useFavicon()
const { fetchFeed, parseFeed } = useFeed()

// ─── Live Data ──────────────────────────────────────────────────────────────────

const { data: sources } = useLiveQuery(
  () => db.feed_sources.where('collection_id').equals(props.collection.id!).filter(isActiveRecord).sortBy('sort_order'),
  [] as FeedSource[],
  [() => props.collection.id]
)

const { move: moveSource } = useReorder(db.feed_sources, sources)
const sourceDnd = useDragSort({ onReorder: (f, t) => moveSource(f, t) })

const { data: items } = useLiveQuery(
  () => {
    const sourceIds = sources.value.map(s => s.id!)
    if (!sourceIds.length) return Promise.resolve([] as FeedItem[])
    return db.feed_items
      .where('feed_source_id')
      .anyOf(sourceIds)
      .toArray()
      .then(res => res.sort((a, b) => (b.published_at ?? 0) - (a.published_at ?? 0)))
  },
  [] as FeedItem[],
  [sources]
)

const { data: archivedItems } = useLiveQuery(
  () => db.saved_feed_items.where('collection_id').equals(props.collection.id!).filter(isActiveRecord).reverse().sortBy('saved_at'),
  [] as SavedFeedItem[],
  [() => props.collection.id],
)

// ─── Refresh Logic ──────────────────────────────────────────────────────────────

const isRefreshing = ref(false)
const documentVisibility = ref<DocumentVisibilityState>(document.visibilityState)
let refreshTimer: number | null = null

async function refreshAll() {
  if (isRefreshing.value) return
  isRefreshing.value = true

  for (const source of sources.value) {
    await refreshSource(source)
  }
  const cutoff = Date.now() - FEED_ITEM_RETENTION_MS
  await db.feed_items.where('fetched_at').below(cutoff).delete()

  isRefreshing.value = false
}

async function runAutoRefresh() {
  if (documentVisibility.value !== 'visible') return
  if (selectedSourceId.value !== null) {
    const source = sources.value.find(item => item.id === selectedSourceId.value)
    if (source) await refreshSource(source)
    return
  }
  await refreshAll()
}

async function clearLoadedItems() {
  const targetSourceIds = selectedSourceId.value === null
    ? sources.value.map(source => source.id).filter((id): id is number => typeof id === 'number')
    : [selectedSourceId.value]

  if (!targetSourceIds.length) return

  const scopeLabel = selectedSourceId.value === null
    ? 'all loaded feed items in this tab'
    : `the loaded feed items for "${selectedSourceTitle.value}"`

  if (!confirm(`Clear ${scopeLabel}?`)) return

  await db.feed_items.where('feed_source_id').anyOf(targetSourceIds).delete()
}

async function markAsRead(item: FeedItem) {
  if (!item.id || item.read_at != null) return
  await db.feed_items.update(item.id, { read_at: Date.now() })
}

async function markAllAsRead() {
  const unread = visibleItems.value.filter(item => item.id && isUnread(item))
  if (!unread.length) return
  const now = Date.now()
  await db.transaction('rw', db.feed_items, async () => {
    for (const item of unread) {
      await db.feed_items.update(item.id!, { read_at: now })
    }
  })
}

async function markAllAsUnread() {
  const readItems = visibleItems.value.filter(item => item.id && !isUnread(item))
  if (!readItems.length) return
  await db.transaction('rw', db.feed_items, async () => {
    for (const item of readItems) {
      await db.feed_items.update(item.id!, { read_at: null })
    }
  })
}

async function refreshSource(source: FeedSource) {
  if (!source.id) return
  try {
    const xml = await fetchFeed(source.feed_url)
    const parsedItems = parseFeed(xml, source.id)

    await db.transaction('rw', db.feed_items, db.feed_sources, async () => {
      for (const item of parsedItems) {
        const existing = item.external_id
          ? await db.feed_items
            .where('[feed_source_id+external_id]')
            .equals([source.id!, item.external_id])
            .first()
          : await db.feed_items
            .where('feed_source_id')
            .equals(source.id!)
            .filter(i => i.title === item.title && i.url === item.url)
            .first()

        if (!existing) {
          await db.feed_items.add(item)
        }
      }

      await db.feed_sources.update(source.id!, {
        last_fetched_at: Date.now(),
        last_error_at: null,
        last_error_message: null
      })
    })
  } catch (err: unknown) {
    await db.feed_sources.update(source.id!, {
      last_error_at: Date.now(),
      last_error_message: err instanceof Error ? err.message : 'Refresh failed'
    })
  }
}

// ─── CRUD Modal State ───────────────────────────────────────────────────────────

const isModalOpen = ref(false)
const editingSource = ref<FeedSource | undefined>(undefined)
const isArchiveModalOpen = ref(false)
const archivingItem = ref<FeedItem | null>(null)
const isArchiveListOpen = ref(false)
const selectedSourceId = ref<number | null>(null)
const FEED_ITEM_RETENTION_MS = 90 * 24 * 60 * 60 * 1000
const refreshingSourceIds = ref<number[]>([])

function syncRefreshTimer() {
  if (refreshTimer !== null) {
    window.clearInterval(refreshTimer)
    refreshTimer = null
  }

  const intervalMs = props.refreshIntervalMs ?? 0
  if (intervalMs <= 0) return

  refreshTimer = window.setInterval(() => {
    void runAutoRefresh()
  }, intervalMs)
}

function openAdd() {
  editingSource.value = undefined
  isModalOpen.value = true
}

registerAddContent(openAdd)
registerFeedArchive(() => {
  isArchiveListOpen.value = true
})
registerFeedClear(() => {
  void clearLoadedItems()
})

function openEdit(source: FeedSource) {
  editingSource.value = source
  isModalOpen.value = true
}

function hasLoadedItemsForSource(sourceId: number): boolean {
  return items.value.some(item => item.feed_source_id === sourceId)
}

async function toggleSource(source: FeedSource) {
  const id = source.id ?? null
  if (id === null) return
  if (selectedSourceId.value === id) {
    selectedSourceId.value = null
    return
  }

  selectedSourceId.value = id

  if (hasLoadedItemsForSource(id) || refreshingSourceIds.value.includes(id)) return

  refreshingSourceIds.value = [...refreshingSourceIds.value, id]
  try {
    await refreshSource(source)
  } finally {
    refreshingSourceIds.value = refreshingSourceIds.value.filter(sourceId => sourceId !== id)
  }
}

function openArchive(item: FeedItem) {
  archivingItem.value = item
  isArchiveModalOpen.value = true
}

async function saveArchivedItem(data: PortableInput<SavedFeedItem>) {
  const now = Date.now()
  const count = await db.saved_feed_items.where('collection_id').equals(data.collection_id).filter(isActiveRecord).count()
  data.sort_order = count
  await db.saved_feed_items.add({
    ...data,
    ...makeCreateMetadata(now),
  })
  isArchiveModalOpen.value = false
  archivingItem.value = null
}

async function deleteArchivedItem(id: number) {
  if (!confirm('Delete this archived feed item?')) return
  await db.saved_feed_items.delete(id)
}

async function saveSource(data: PortableInput<FeedSource>) {
  const now = Date.now()
  if (editingSource.value?.id) {
    await db.feed_sources.update(editingSource.value.id, {
      ...data,
      ...makeUpdatedAtPatch(now),
    })
  } else {
    const count = await db.feed_sources.where('collection_id').equals(data.collection_id).filter(isActiveRecord).count()
    data.sort_order = count
    await db.feed_sources.add({
      ...data,
      ...makeCreateMetadata(now),
    })
  }
  isModalOpen.value = false
}

async function deleteSource(id: number) {
  await db.transaction('rw', db.feed_sources, db.feed_items, async () => {
    await db.feed_sources.delete(id)
    await db.feed_items.where('feed_source_id').equals(id).delete()
  })
  isModalOpen.value = false
}

function getSourceTitle(id: number) {
  return sources.value.find(s => s.id === id)?.title || ''
}

function getSourceFaviconUrl(source: FeedSource): string {
  return getFaviconUrl(source.site_url || source.feed_url)
}

function isUnread(item: FeedItem): boolean {
  return item.read_at == null
}

const scopedItems = computed<FeedItem[]>(() => {
  if (selectedSourceId.value === null) return items.value
  return items.value.filter(item => item.feed_source_id === selectedSourceId.value)
})

const scopedUnreadCount = computed<number>(() =>
  scopedItems.value.filter(isUnread).length
)

const visibleItems = computed<FeedItem[]>(() => {
  const limit = props.itemLimit ?? 0
  if (limit <= 0) return scopedItems.value

  if (selectedSourceId.value !== null) {
    return scopedItems.value.slice(0, limit)
  }

  const counts = new Map<number, number>()
  return scopedItems.value.filter(item => {
    const current = counts.get(item.feed_source_id) ?? 0
    if (current >= limit) return false
    counts.set(item.feed_source_id, current + 1)
    return true
  })
})

const selectedSourceTitle = computed<string>(() =>
  selectedSourceId.value === null ? 'All sources' : getSourceTitle(selectedSourceId.value)
)

watch(sources, (nextSources) => {
  if (!nextSources.length) {
    selectedSourceId.value = null
    return
  }
  if (!nextSources.some(source => source.id === selectedSourceId.value)) {
    selectedSourceId.value = null
  }
}, { immediate: true })

watch(
  () => props.refreshIntervalMs ?? 0,
  () => syncRefreshTimer(),
  { immediate: true }
)

function onVisibilityChange() {
  documentVisibility.value = document.visibilityState
}

document.addEventListener('visibilitychange', onVisibilityChange)

onBeforeUnmount(() => {
  if (refreshTimer !== null) {
    window.clearInterval(refreshTimer)
  }
  document.removeEventListener('visibilitychange', onVisibilityChange)
})

</script>

<template>
  <div class="st-module-feed st-feed-grid h-full min-h-0">
    <aside
      class="st-module-feed-sidebar st-feed-grid--sidebar border-r border-white/10 bg-black/25 flex flex-col min-h-0"
    >
      <div class="st-feed-grid--sidebar-content h-full flex flex-col">
      <nav class="st-module-feed-sources flex-1 min-h-0 overflow-y-auto scrollbar-hide px-2 py-2 space-y-1" aria-label="Feed sources">
        <div
          v-for="(source, idx) in sources"
          :key="source.id"
          v-bind="sourceDnd.bindFor(idx)"
          class="st-module-feed-source-row flex items-stretch"
          :class="[
            sourceDnd.draggingIndex.value === idx ? 'opacity-40' : '',
            sourceDnd.dragOverIndex.value === idx && sourceDnd.draggingIndex.value !== idx
              ? 'ring-1 ring-white/40 rounded-sm' : '',
          ]"
        >
          <button
            @click="toggleSource(source)"
            class="st-module-feed-source-button flex-1 min-w-0 flex items-stretch text-left text-[10px] uppercase tracking-wider font-normal transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40 overflow-hidden"
            :class="[
              selectedSourceId === source.id
                ? 'bg-white text-black'
                : 'bg-transparent text-white/80 hover:bg-white/10 hover:text-white',
              source.last_error_at ? 'text-red-400' : '',
            ]"
            :aria-pressed="selectedSourceId === source.id"
            :title="source.title"
          >
            <span class="st-module-feed-source-icon shrink-0 self-stretch w-7 flex items-center justify-center"
                  :class="selectedSourceId === source.id ? 'bg-white border-r border-black/10' : 'bg-black border-r border-white/10'">
              <img
                v-if="getSourceFaviconUrl(source)"
                :src="getSourceFaviconUrl(source)"
                :alt="source.title"
                class="w-full h-full object-contain bg-white p-1"
                draggable="false"
              />
            </span>
            <span class="st-module-feed-source-label block min-w-0 truncate px-2 py-1">{{ source.title }}</span>
          </button>
          <button
            @click="openEdit(source)"
            class="st-module-feed-source-edit shrink-0 px-2 py-1 rounded-sm bg-black/85 hover:bg-black border border-white/10 text-[10px] text-white/60 hover:text-white transition-colors"
            :aria-label="`Edit feed source ${source.title}`"
            title="Edit source"
          >
            ✎
          </button>
        </div>
      </nav>
      <div class="st-module-feed-sidebar-footer px-2 py-2 border-t border-white/10">
        <button
          @click="openAdd"
          class="st-module-feed-add-source w-full px-2 py-1 rounded-sm bg-[#0056b3] hover:bg-[#004494] text-[10px] uppercase tracking-wider font-normal text-white transition-colors"
        >
          + Source
        </button>
      </div>
      </div>
    </aside>

    <div class="st-module-feed-main st-feed-grid--content">
      <div class="st-module-feed-toolbar flex items-center justify-between gap-3 px-3 py-1 bg-white text-black border-b border-black/20">
        <div class="st-module-feed-meta min-w-0 flex items-center gap-2">
          <p class="st-module-feed-title text-[12px] font-bold truncate">
            {{ selectedSourceTitle }}
          </p>
          <span class="st-module-feed-toolbar-badge text-[9px] px-1 rounded-sm">{{ scopedUnreadCount }} unread</span>
        </div>
        <div class="st-module-feed-actions flex items-center gap-2">
          <button
            type="button"
            @click="markAllAsRead"
            :disabled="!visibleItems.some(isUnread)"
            class="st-module-feed-toolbar-button px-1 text-[10px] uppercase font-bold text-gray-500 hover:text-black disabled:opacity-30 transition-colors"
          >
            Read
          </button>
          <button
            v-if="visibleItems.length > 0"
            type="button"
            @click="markAllAsUnread"
            :disabled="!visibleItems.some(item => !isUnread(item))"
            class="st-module-feed-toolbar-button px-1 text-[10px] uppercase font-bold text-gray-500 hover:text-black disabled:opacity-30 transition-colors"
          >
            Unread
          </button>
          <button
            type="button"
            @click="refreshAll"
            :disabled="isRefreshing || sources.length === 0"
            class="st-module-feed-toolbar-button px-1 text-[10px] uppercase font-bold text-gray-500 hover:text-black disabled:opacity-30 transition-colors"
          >
            {{ props.expanded ? (isRefreshing ? 'Refreshing' : 'Refresh') : (isRefreshing ? '...' : 'Refresh') }}
          </button>
        </div>
      </div>

      <!-- Items List -->
      <div
        v-if="visibleItems.length"
        class="st-module-feed-list st-feed-grid--content-fetched overflow-y-auto scrollbar-hide"
        :class="props.expanded ? 'flex-1 min-h-0' : 'max-h-[300px]'"
      >
        <div class="st-module-feed-list-inner st-feed-grid-ajax-response w-full min-w-0">
          <FeedItemCard
            v-for="item in visibleItems"
            :key="item.id"
            :item="item"
            :source-title="getSourceTitle(item.feed_source_id)"
            @archive="openArchive"
            @mark-read="markAsRead"
          />
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="st-module-feed-empty text-center px-4 py-4">
        <div>
          <p class="st-module-feed-empty-text text-[11px] text-white/50 italic mb-2">
            {{
              !sources.length
                ? 'No feeds in this module'
                : selectedSourceId !== null
                  ? 'No items for this source yet. Try refreshing or show all sources.'
                  : 'No items found. Try refreshing.'
            }}
          </p>
          <button
            v-if="!sources.length"
            @click="openAdd"
            class="text-[10px] uppercase tracking-wider font-normal text-white/80 hover:text-white transition-colors"
          >
            + Add Source
          </button>
          <button
            v-else-if="selectedSourceId !== null"
            @click="selectedSourceId = null"
            class="text-[10px] uppercase tracking-wider font-normal text-white/80 hover:text-white transition-colors"
          >
            Show All Sources
          </button>
        </div>
      </div>
    </div>

    <!-- CRUD Modal -->
    <Modal :show="isModalOpen" :title="editingSource ? 'Edit Feed Source' : 'New Feed Source'" @close="isModalOpen = false">
      <FeedSourceForm
        :source="editingSource"
        :collection-id="collection.id!"
        @save="saveSource"
        @delete="deleteSource"
        @cancel="isModalOpen = false"
      />
    </Modal>

    <Modal :show="isArchiveModalOpen && archivingItem !== null" title="Archive Feed Item" @close="isArchiveModalOpen = false; archivingItem = null">
      <FeedArchiveForm
        v-if="archivingItem"
        :item="archivingItem"
        :source-title="getSourceTitle(archivingItem.feed_source_id)"
        :collection-id="collection.id!"
        @save="saveArchivedItem"
        @cancel="isArchiveModalOpen = false; archivingItem = null"
      />
    </Modal>

    <Modal :show="isArchiveListOpen" title="Archived Feed Items" @close="isArchiveListOpen = false">
      <div v-if="archivedItems.length" class="space-y-3 max-h-[70vh] overflow-y-auto">
        <article
          v-for="item in archivedItems"
          :key="item.id"
          class="st-module-feed-archive-item border border-white/10 bg-black/30 px-3 py-2 space-y-1"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <h3 class="st-module-feed-archive-title text-[12px] text-white font-semibold leading-snug">{{ item.title }}</h3>
              <p class="st-module-feed-archive-source text-[10px] text-white/50">{{ item.source_title || 'Archived item' }}</p>
            </div>
            <div class="shrink-0 flex items-center gap-2">
              <a
                v-if="item.url"
                :href="item.url"
                target="_blank"
                rel="noopener noreferrer"
                class="st-module-feed-archive-link text-[10px] uppercase tracking-wider text-sky-400 hover:text-sky-300"
              >
                Open
              </a>
              <button
                type="button"
                @click="deleteArchivedItem(item.id!)"
                class="st-module-feed-archive-delete text-[10px] uppercase tracking-wider text-red-400 hover:text-red-300"
              >
                Delete
              </button>
            </div>
          </div>
          <p v-if="item.comment" class="st-module-feed-archive-comment text-[11px] text-white/80 leading-snug">{{ item.comment }}</p>
          <p v-if="item.summary" class="st-module-feed-archive-summary text-[11px] text-white/60 leading-snug line-clamp-3">{{ item.summary }}</p>
        </article>
      </div>
      <div v-else class="text-center">
        <p class="st-module-feed-archive-empty text-[11px] text-white/50 italic">No archived feed items yet</p>
      </div>
    </Modal>
  </div>
</template>

<style scoped>
.st-feed-grid {
  display: grid;
  grid-template-columns: 12.5rem minmax(0, 1fr);
  min-width: 0;
}

.st-feed-grid--sidebar,
.st-feed-grid--sidebar-content,
.st-feed-grid--content,
.st-feed-grid--content-fetched,
.st-feed-grid-ajax-response {
  min-width: 0;
}

.st-feed-grid--content {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  min-height: 0;
  overflow: auto;
}

.st-feed-grid--content-fetched {
  min-height: 0;
}

.st-module-feed-empty {
  display: flex;
  width: 100%;
  justify-content: center;
  align-items: center;
}

@media (max-width: 768px) {
  .st-feed-grid {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr);
  }
}
</style>
