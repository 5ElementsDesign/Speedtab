<script setup lang="ts">
import { registerAddContent } from '@/composables/useAddContent'
import { useDragSort } from '@/composables/useDragSort'
import { markExportDirty } from '@/composables/useExportState'
import { useFavicon } from '@/composables/useFavicon'
import { useFeed } from '@/composables/useFeed'
import { registerFeedArchive } from '@/composables/useFeedArchive'
import { registerFeedClear } from '@/composables/useFeedClear'
import { useLiveQuery } from '@/composables/useLiveQuery'
import { useReorder } from '@/composables/useReorder'
import { db, isActiveRecord, makeCreateMetadata, makeUpdatedAtPatch } from '@/db/db'
import type { Collection, FeedItem, FeedSource, PortableInput, SavedFeedItem } from '@/types/db'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import FeedArchiveForm from './FeedArchiveForm.vue'
import FeedItemCard from './FeedItemCard.vue'
import FeedSourceForm from './FeedSourceForm.vue'
import Modal from './Modal.vue'

const props = defineProps<{
  collection: Collection
  expanded?: boolean
  expandedWidth?: 320 | 480 | 740 | 940 | 1240 | 1540 | 'max' | null
  refreshIntervalMs?: number
  itemLimit?: number
  filterQuery?: string
  searchUrlTemplate?: string
  highlightSourceId?: number | null
  highlightArchivedItemId?: number | null
}>()
const { t } = useI18n()

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
const newlyFetchedItemIds = ref<number[]>([])
const stickyNewItemIds = ref<number[]>([])

type RefreshCandidate = Pick<FeedItem, 'id' | 'published_at' | 'fetched_at'>

function candidateIds(candidates: RefreshCandidate[]) {
  return candidates
    .map((candidate) => candidate.id)
    .filter((id): id is number => typeof id === 'number')
}

function mergeIds(current: number[], next: number[]) {
  if (!next.length) return current
  if (!current.length) return next
  return Array.from(new Set([...current, ...next]))
}

function setFetchedHighlights(candidates: RefreshCandidate[]) {
  const nextIds = candidateIds(candidates)
  newlyFetchedItemIds.value = nextIds
  if (activeFilter.value.type === 'new') {
    stickyNewItemIds.value = mergeIds(stickyNewItemIds.value, nextIds)
  }
}

function mergeRefreshCandidates(current: RefreshCandidate[], next: RefreshCandidate[]): RefreshCandidate[] {
  if (!next.length) return current
  if (!current.length) return next
  const byId = new Map<number, RefreshCandidate>()
  for (const candidate of current) {
    if (typeof candidate.id === 'number') byId.set(candidate.id, candidate)
  }
  for (const candidate of next) {
    if (typeof candidate.id === 'number') byId.set(candidate.id, candidate)
  }
  return Array.from(byId.values())
}

async function refreshAll() {
  if (isRefreshing.value) return
  isRefreshing.value = true
  let insertedItems: RefreshCandidate[] = []

  for (const source of sources.value) {
    const candidates = await refreshSource(source)
    insertedItems = mergeRefreshCandidates(insertedItems, candidates)
  }
  const cutoff = Date.now() - FEED_ITEM_RETENTION_MS
  await db.feed_items.where('fetched_at').below(cutoff).delete()

  isRefreshing.value = false
  setFetchedHighlights(insertedItems)
}

async function runAutoRefresh() {
  if (documentVisibility.value !== 'visible') return
  if (activeFilter.value.type === 'source') {
    const sourceId = activeFilter.value.sourceId
    const source = sources.value.find(item => item.id === sourceId)
    if (source) {
      const candidates = await refreshSource(source)
      setFetchedHighlights(candidates)
    }
    return
  }
  await refreshAll()
}

async function clearLoadedItems() {
  const targetSourceIds = activeFilter.value.type === 'source'
    ? [activeFilter.value.sourceId]
    : activeFilter.value.type === 'new'
      ? Array.from(new Set(
          items.value
            .filter(item => typeof item.id === 'number' && stickyNewItemIds.value.includes(item.id))
            .map(item => item.feed_source_id)
        ))
      : sources.value.map(source => source.id).filter((id): id is number => typeof id === 'number')

  if (!targetSourceIds.length) return

  const scopeLabel = activeFilter.value.type === 'source'
    ? t('feeds.clearLoadedForSource', { title: selectedSourceTitle.value })
    : activeFilter.value.type === 'new'
      ? t('feeds.clearLoadedNew')
      : t('feeds.clearLoadedAll')

  if (!confirm(t('feeds.clearLoadedConfirm', { scope: scopeLabel }))) return

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

async function refreshSource(source: FeedSource): Promise<RefreshCandidate[]> {
  if (!source.id) return []
  if (!refreshingSourceIds.value.includes(source.id)) {
    refreshingSourceIds.value = [...refreshingSourceIds.value, source.id]
  }
  const insertedItems: RefreshCandidate[] = []
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
          const insertedId = await db.feed_items.add(item)
          insertedItems.push({
            id: insertedId as number,
            published_at: item.published_at,
            fetched_at: item.fetched_at,
          })
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
      last_error_message: err instanceof Error ? err.message : t('feeds.refreshFailed')
    })
  } finally {
    refreshingSourceIds.value = refreshingSourceIds.value.filter(sourceId => sourceId !== source.id)
  }
  return insertedItems
}

// ─── CRUD Modal State ───────────────────────────────────────────────────────────

const isModalOpen = ref(false)
const editingSource = ref<FeedSource | undefined>(undefined)
const isArchiveModalOpen = ref(false)
const archivingItem = ref<FeedItem | null>(null)
const isArchiveListOpen = ref(false)
const activeFilter = ref<{ type: 'all' } | { type: 'source'; sourceId: number } | { type: 'new' } | { type: 'unread' }>({ type: 'all' })
const showLoadedItems = ref(true)
const FEED_ITEM_RETENTION_MS = 90 * 24 * 60 * 60 * 1000
const refreshingSourceIds = ref<number[]>([])
const expandedItemIds = ref<number[]>([])
const expandedYoutubeDescriptionItemIds = ref<number[]>([])
const feedRoot = ref<HTMLElement | null>(null)
let feedClickAbortController: AbortController | null = null

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

function isSourceRefreshing(sourceId: number | undefined): boolean {
  return typeof sourceId === 'number' && refreshingSourceIds.value.includes(sourceId)
}

async function toggleSource(source: FeedSource) {
  const id = source.id ?? null
  if (id === null) return
  if (activeFilter.value.type === 'source' && activeFilter.value.sourceId === id) {
    activeFilter.value = { type: 'all' }
    return
  }

  activeFilter.value = { type: 'source', sourceId: id }

  if (hasLoadedItemsForSource(id) || refreshingSourceIds.value.includes(id)) return
  const candidates = await refreshSource(source)
  setFetchedHighlights(candidates)
}

function toggleNewFilter() {
  if (activeFilter.value.type === 'new') {
    activeFilter.value = { type: 'all' }
    stickyNewItemIds.value = []
    return
  }
  stickyNewItemIds.value = mergeIds(stickyNewItemIds.value, newlyFetchedItemIds.value)
  activeFilter.value = { type: 'new' }
}

function toggleUnreadFilter() {
  activeFilter.value = activeFilter.value.type === 'unread'
    ? { type: 'all' }
    : { type: 'unread' }
}

function openArchive(item: FeedItem) {
  archivingItem.value = item
  isArchiveModalOpen.value = true
}

function isItemExpanded(itemId: number | undefined): boolean {
  return typeof itemId === 'number' && expandedItemIds.value.includes(itemId)
}

function isYoutubeDescriptionExpanded(itemId: number | undefined): boolean {
  return typeof itemId === 'number' && expandedYoutubeDescriptionItemIds.value.includes(itemId)
}

function toggleListMembership(target: number[], id: number): number[] {
  return target.includes(id)
    ? target.filter((entry) => entry !== id)
    : [...target, id]
}

function collapseFeedItem(itemId: number) {
  expandedItemIds.value = expandedItemIds.value.filter((entry) => entry !== itemId)
  expandedYoutubeDescriptionItemIds.value = expandedYoutubeDescriptionItemIds.value.filter((entry) => entry !== itemId)
}

async function toggleFeedItem(item: FeedItem) {
  if (typeof item.id !== 'number') return
  if (isItemExpanded(item.id)) {
    collapseFeedItem(item.id)
    return
  }

  expandedItemIds.value = [...expandedItemIds.value, item.id]
  if (item.read_at == null) {
    await markAsRead(item)
  }
}

function toggleFeedItemDescription(item: FeedItem) {
  if (typeof item.id !== 'number') return
  if (!isItemExpanded(item.id)) {
    expandedItemIds.value = [...expandedItemIds.value, item.id]
  }
  expandedYoutubeDescriptionItemIds.value = toggleListMembership(expandedYoutubeDescriptionItemIds.value, item.id)
}

async function saveArchivedItem(data: PortableInput<SavedFeedItem>) {
  const now = Date.now()
  const count = await db.saved_feed_items.where('collection_id').equals(data.collection_id).filter(isActiveRecord).count()
  data.sort_order = count
  await db.saved_feed_items.add({
    ...data,
    ...makeCreateMetadata(now),
  })
  await markExportDirty('saved_feed_items:create')
  isArchiveModalOpen.value = false
  archivingItem.value = null
}

async function deleteArchivedItem(id: number) {
  if (!confirm(t('feeds.deleteArchivedFeedItemConfirm'))) return
  await db.saved_feed_items.delete(id)
  await markExportDirty('saved_feed_items:delete')
}

async function saveSource(data: PortableInput<FeedSource>) {
  const now = Date.now()
  if (editingSource.value?.id) {
    await db.feed_sources.update(editingSource.value.id, {
      ...data,
      ...makeUpdatedAtPatch(now),
    })
    await markExportDirty('feed_sources:update')
  } else {
    const count = await db.feed_sources.where('collection_id').equals(data.collection_id).filter(isActiveRecord).count()
    data.sort_order = count
    await db.feed_sources.add({
      ...data,
      ...makeCreateMetadata(now),
    })
    await markExportDirty('feed_sources:create')
  }
  isModalOpen.value = false
}

async function deleteSource(id: number) {
  await db.transaction('rw', db.feed_sources, db.feed_items, async () => {
    await db.feed_sources.delete(id)
    await db.feed_items.where('feed_source_id').equals(id).delete()
  })
  await markExportDirty('feed_sources:delete')
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

function matchesFeedQuery(item: FeedItem, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  const sourceTitle = getSourceTitle(item.feed_source_id)
  const haystack = [
    item.title,
    item.url,
    item.author,
    sourceTitle,
    item.summary,
    item.content,
  ]
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .join('\n')
    .toLowerCase()
  return haystack.includes(needle)
}

const itemById = computed(() => new Map(
  items.value
    .filter((item): item is FeedItem & { id: number } => typeof item.id === 'number')
    .map((item) => [item.id, item]),
))

const sourceById = computed(() => new Map(
  sources.value
    .filter((source): source is FeedSource & { id: number } => typeof source.id === 'number')
    .map((source) => [source.id, source]),
))

const archivedItemById = computed(() => new Map(
  archivedItems.value
    .filter((item): item is SavedFeedItem & { id: number } => typeof item.id === 'number')
    .map((item) => [item.id, item]),
))

function routeModuleClick(event: MouseEvent) {
  const root = feedRoot.value
  if (!root) return

  const actionElement = (event.target as HTMLElement | null)?.closest('[data-click]') as HTMLElement | null
  if (!actionElement || !root.contains(actionElement)) return

  const action = actionElement.dataset.click
  if (!action) return

  event.stopPropagation()

  if (action === 'toggleLoadedItemsVisibility') {
    toggleLoadedItemsVisibility()
    return
  }

  if (action === 'toggleUnreadFilter') {
    toggleUnreadFilter()
    return
  }

  if (action === 'markAllAsRead') {
    void markAllAsRead()
    return
  }

  if (action === 'markAllAsUnread') {
    void markAllAsUnread()
    return
  }

  if (action === 'refreshAllFeeds') {
    void refreshAll()
    return
  }

  if (action === 'openAddFeedSource') {
    openAdd()
    return
  }

  if (action === 'resetFeedFilter') {
    activeFilter.value = { type: 'all' }
    return
  }

  if (action === 'showLoadedItems') {
    showLoadedItems.value = true
    return
  }

  if (action === 'toggleNewFilter') {
    toggleNewFilter()
    return
  }

  const sourceElement = actionElement.closest('[data-feed-source-id]') as HTMLElement | null
  if (sourceElement) {
    const sourceId = Number(sourceElement.dataset.feedSourceId)
    const source = sourceById.value.get(sourceId)
    if (!source) return

    if (action === 'toggleFeedSource') {
      void toggleSource(source)
      return
    }

    if (action === 'editFeedSource') {
      openEdit(source)
      return
    }
  }

  const rowElement = actionElement.closest('[data-feed-item-id]') as HTMLElement | null
  const rawItemId = rowElement?.dataset.feedItemId
  const itemId = rawItemId ? Number(rawItemId) : Number.NaN
  const item = Number.isFinite(itemId) ? itemById.value.get(itemId) : undefined

  const archivedElement = actionElement.closest('[data-archived-item-id]') as HTMLElement | null
  if (archivedElement) {
    const archivedItemId = Number(archivedElement.dataset.archivedItemId)
    const archivedItem = archivedItemById.value.get(archivedItemId)
    if (!archivedItem) return

    if (action === 'deleteArchivedFeedItem') {
      void deleteArchivedItem(archivedItem.id!)
      return
    }
  }

  if (action === 'toggleFeedItem') {
    if (!item) return
    void toggleFeedItem(item)
    return
  }

  if (action === 'archiveFeedItem') {
    if (!item) return
    openArchive(item)
    return
  }

  if (action === 'toggleFeedItemDescription') {
    if (!item) return
    toggleFeedItemDescription(item)
  }
}

const scopedItems = computed<FeedItem[]>(() => {
  const query = props.filterQuery?.trim() ?? ''
  if (query) {
    return items.value.filter(item => matchesFeedQuery(item, query))
  }
  if (activeFilter.value.type === 'source') {
    const sourceId = activeFilter.value.sourceId
    return items.value.filter(item => item.feed_source_id === sourceId)
  }
  if (activeFilter.value.type === 'new') {
    return items.value.filter(item => typeof item.id === 'number' && stickyNewItemIds.value.includes(item.id))
  }
  if (activeFilter.value.type === 'unread') {
    return items.value.filter(isUnread)
  }
  return items.value
})

const scopedUnreadCount = computed<number>(() =>
  scopedItems.value.filter(isUnread).length
)

const visibleItems = computed<FeedItem[]>(() => {
  if (!showLoadedItems.value) return []
  const limit = props.itemLimit ?? 0
  if (limit <= 0) return scopedItems.value

  if (activeFilter.value.type === 'source' || activeFilter.value.type === 'new' || activeFilter.value.type === 'unread') {
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
  props.filterQuery?.trim()
    ? t('feeds.searchTitle', { query: props.filterQuery.trim() })
    : activeFilter.value.type === 'source'
    ? getSourceTitle(activeFilter.value.sourceId)
    : activeFilter.value.type === 'new'
      ? t('feeds.filterNew')
      : activeFilter.value.type === 'unread'
        ? t('feeds.filterUnread')
      : t('feeds.filterAll')
)

const canToggleLoadedItems = computed<boolean>(() => scopedItems.value.length > 0)
const hasFeedSearch = computed<boolean>(() => Boolean(props.filterQuery?.trim()))
const hasNewItems = computed<boolean>(() => newlyFetchedItemIds.value.length > 0)
const hasStickyNewItems = computed<boolean>(() => stickyNewItemIds.value.length > 0)
const hasUnreadItems = computed<boolean>(() => items.value.some(isUnread))
const showNewFilterButton = computed<boolean>(() => showLoadedItems.value && visibleItems.value.length > 0)
const showNewCount = computed<number>(() => activeFilter.value.type === 'new' ? stickyNewItemIds.value.length : newlyFetchedItemIds.value.length)
const highlightedNewItemIds = computed<number[]>(() => activeFilter.value.type === 'new' ? stickyNewItemIds.value : newlyFetchedItemIds.value)

const lastSuccessfulFetchAt = computed<number | null>(() => {
  const timestamps = sources.value
    .map(source => source.last_fetched_at)
    .filter((value): value is number => typeof value === 'number' && value > 0)
  if (!timestamps.length) return null
  return Math.max(...timestamps)
})

const lastSuccessfulFetchTitle = computed<string>(() =>
  lastSuccessfulFetchAt.value
    ? t('feeds.lastFetch', { value: new Date(lastSuccessfulFetchAt.value).toLocaleString() })
    : t('feeds.noSuccessfulFetchYet')
)

const useCompactExpandedLayout = computed<boolean>(() =>
  props.expanded === true && (props.expandedWidth === 320 || props.expandedWidth === 480)
)

watch(sources, (nextSources) => {
  if (!nextSources.length) {
    activeFilter.value = { type: 'all' }
    return
  }
  if (activeFilter.value.type === 'source') {
    const sourceId = activeFilter.value.sourceId
    if (!nextSources.some(source => source.id === sourceId)) {
      activeFilter.value = { type: 'all' }
    }
  }
}, { immediate: true })

watch(hasNewItems, (nextHasNewItems) => {
  if (!nextHasNewItems && activeFilter.value.type !== 'new') {
    newlyFetchedItemIds.value = []
  }
})

watch(hasStickyNewItems, (nextHasStickyNewItems) => {
  if (!nextHasStickyNewItems && activeFilter.value.type === 'new') {
    activeFilter.value = { type: 'all' }
  }
})

watch(hasUnreadItems, (nextHasUnreadItems) => {
  if (!nextHasUnreadItems && activeFilter.value.type === 'unread') {
    activeFilter.value = { type: 'all' }
  }
})

watch(() => props.highlightSourceId, async (sourceId) => {
  if (typeof sourceId !== 'number') return
  const source = sources.value.find((item) => item.id === sourceId)
  if (!source) return
  activeFilter.value = { type: 'source', sourceId }
  if (!hasLoadedItemsForSource(sourceId) && !isSourceRefreshing(sourceId)) {
    await refreshSource(source)
  }
})

watch(() => props.highlightArchivedItemId, (itemId) => {
  if (typeof itemId !== 'number') return
  if (archivedItems.value.some((item) => item.id === itemId)) {
    isArchiveListOpen.value = true
  }
})

watch(() => props.collection.id, () => {
  activeFilter.value = { type: 'all' }
  newlyFetchedItemIds.value = []
  stickyNewItemIds.value = []
  expandedItemIds.value = []
  expandedYoutubeDescriptionItemIds.value = []
  showLoadedItems.value = true
})

watch(items, (nextItems) => {
  const validIds = new Set(nextItems.map((item) => item.id).filter((id): id is number => typeof id === 'number'))
  expandedItemIds.value = expandedItemIds.value.filter((id) => validIds.has(id))
  expandedYoutubeDescriptionItemIds.value = expandedYoutubeDescriptionItemIds.value.filter((id) => validIds.has(id))
})

watch(
  () => props.refreshIntervalMs ?? 0,
  () => syncRefreshTimer(),
  { immediate: true }
)

function onVisibilityChange() {
  documentVisibility.value = document.visibilityState
}

function toggleLoadedItemsVisibility() {
  if (!canToggleLoadedItems.value) return
  showLoadedItems.value = !showLoadedItems.value
}

document.addEventListener('visibilitychange', onVisibilityChange)

onMounted(() => {
  if (!feedRoot.value) return
  feedClickAbortController = new AbortController()
  feedRoot.value.addEventListener('click', routeModuleClick, { signal: feedClickAbortController.signal })
})

onBeforeUnmount(() => {
  if (refreshTimer !== null) {
    window.clearInterval(refreshTimer)
  }
  feedClickAbortController?.abort()
  feedClickAbortController = null
  document.removeEventListener('visibilitychange', onVisibilityChange)
})

</script>

<template>
  <div
    ref="feedRoot"
    class="st-module-feed st-feed-grid h-full min-h-0"
    :class="{
      'st-feed-grid--compact-expanded': useCompactExpandedLayout,
      'st-feed-grid--expanded': props.expanded === true,
      'is-fetching-source': refreshingSourceIds.length > 0,
    }"
  >
    <aside
      class="st-module-feed-sidebar st-feed-grid--sidebar border-r border-white/10 bg-black/25 flex flex-col min-h-0"
    >
      <div class="st-feed-grid--sidebar-content h-full flex flex-col">
      <nav class="st-module-feed-sources flex-1 min-h-0 overflow-y-auto px-2 py-2 space-y-1" :aria-label="t('feeds.feedSourcesAria')">
        <div
          v-for="(source, idx) in sources"
          :key="source.id"
          v-bind="sourceDnd.bindFor(idx)"
          class="st-module-feed-source-row flex items-stretch"
          :data-feed-source-id="source.id"
          :class="[
            isSourceRefreshing(source.id) ? 'is-fetching-source' : '',
            sourceDnd.draggingIndex.value === idx ? 'opacity-40' : '',
            sourceDnd.dragOverIndex.value === idx && sourceDnd.draggingIndex.value !== idx
              ? 'ring-1 ring-white/40 rounded-sm' : '',
          ]"
        >
          <button
            data-click="toggleFeedSource"
            class="st-module-feed-source-button flex-1 min-w-0 flex items-stretch text-left text-[10px] uppercase tracking-wider font-normal transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40 overflow-hidden"
            :class="[
              activeFilter.type === 'source' && activeFilter.sourceId === source.id
                ? 'bg-white text-black'
                : 'bg-transparent text-white/80 hover:bg-white/10 hover:text-white',
              props.highlightSourceId === source.id ? 'ring-1 ring-red-500 shadow-[0_0_0_1px_rgba(239,68,68,0.95),0_0_14px_rgba(239,68,68,0.3)]' : '',
              source.last_error_at ? 'text-red-400' : '',
            ]"
            :aria-pressed="activeFilter.type === 'source' && activeFilter.sourceId === source.id"
            :title="source.title"
          >
            <span class="st-module-feed-source-icon shrink-0 self-stretch w-7 flex items-center justify-center"
                  :class="activeFilter.type === 'source' && activeFilter.sourceId === source.id ? 'bg-white border-r border-black/10' : 'bg-black border-r border-white/10'">
              <img
                v-if="getSourceFaviconUrl(source)"
                :src="getSourceFaviconUrl(source)"
                alt=""
                class="w-full h-full object-contain bg-white p-0.5"
                draggable="false"
              />
            </span>
            <span class="st-module-feed-source-label inline-flex items-center min-w-0 truncate px-2 py-1">{{ source.title }}</span>
          </button>
          <button
            data-click="editFeedSource"
            class="st-module-feed-source-edit shrink-0 px-2 py-1 rounded-sm bg-black/85 hover:bg-black border border-white/10 text-[10px] text-white/60 hover:text-white transition-colors"
            :aria-label="t('feeds.editSourceAria', { title: source.title })"
            :title="t('feeds.editSource')"
          >
            ✎
          </button>
        </div>
        <button
          v-if="showNewFilterButton"
          type="button"
          data-click="toggleNewFilter"
          class="st-module-feed-source-button w-full min-w-0 flex items-stretch text-left text-[10px] uppercase tracking-wider font-normal transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40 overflow-hidden"
          :class="activeFilter.type === 'new' ? 'bg-white text-black' : 'bg-transparent text-white/80 hover:bg-white/10 hover:text-white'"
          :aria-pressed="activeFilter.type === 'new'"
          :title="t('feeds.showNewItems')"
        >
          <span
            class="st-module-feed-source-icon shrink-0 self-stretch w-7 flex items-center justify-center"
            :class="activeFilter.type === 'new' ? 'bg-white border-r border-black/10' : 'bg-black border-r border-white/10'"
          >
            <span class="w-2 h-2 rounded-full bg-red-500" aria-hidden="true"></span>
          </span>
          <span class="st-module-feed-source-label block min-w-0 truncate px-2 py-1">{{ t('feeds.filterNew') }}</span>
          <span class="shrink-0 px-2 py-1 text-[9px] opacity-75">{{ showNewCount }}</span>
        </button>
      </nav>
      <div class="st-module-feed-sidebar-footer px-2 py-2 border-t border-white/10">
        <button
          data-click="openAddFeedSource"
          class="st-module-feed-add-source w-full px-2 py-1 rounded-sm bg-[#0056b3] hover:bg-[#004494] text-[10px] uppercase tracking-wider font-normal text-white transition-colors"
        >
          {{ t('feeds.addSource') }}
        </button>
      </div>
      </div>
    </aside>

    <div class="st-module-feed-main st-feed-grid--content">
      <div class="st-module-feed-toolbar flex items-center justify-between gap-3 px-3 py-1 bg-white text-black border-b border-black/20">
        <div class="st-module-feed-meta min-w-0 flex items-center gap-2">
          <button
            type="button"
            data-click="toggleLoadedItemsVisibility"
            :disabled="!canToggleLoadedItems"
            class="st-module-feed-title text-[12px] font-bold truncate transition-colors"
            :class="canToggleLoadedItems ? 'hover:opacity-70' : 'cursor-default'"
            :title="canToggleLoadedItems ? (showLoadedItems ? t('feeds.hideLoadedItems') : t('feeds.showLoadedItems')) : selectedSourceTitle"
          >
            {{ selectedSourceTitle }}
          </button>
          <span
            v-if="(props.refreshIntervalMs ?? 0) > 0"
            class="st-module-feed-auto-indicator inline-flex items-center"
            :title="lastSuccessfulFetchTitle"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-red-500" aria-hidden="true"></span>
          </span>
          <button
            type="button"
            data-click="toggleUnreadFilter"
            :disabled="!hasUnreadItems"
            class="st-module-feed-toolbar-badge text-[9px] px-1 rounded-sm transition-colors"
            :class="activeFilter.type === 'unread' ? 'ring-1 ring-black/20' : ''"
            :title="hasUnreadItems ? (activeFilter.type === 'unread' ? t('feeds.showAllItems') : t('feeds.showUnreadItems')) : t('feeds.noUnreadItems')"
          >
            {{ t('feeds.unreadLabel', { count: scopedUnreadCount }) }}
          </button>
          <span
            v-if="isRefreshing"
            class="st-module-feed-toolbar-loading inline-flex items-center gap-1 text-[9px] uppercase tracking-wider"
            :title="t('feeds.refreshingFeedItems')"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-red-500" aria-hidden="true"></span>
            <span class="st-module-feed-toolbar-muted">{{ t('feeds.loading') }}</span>
          </span>
        </div>
        <div class="st-module-feed-actions flex items-center gap-2">
          <button
            type="button"
            data-click="markAllAsRead"
            :disabled="!visibleItems.some(isUnread)"
            class="st-module-feed-toolbar-button px-1 text-[10px] uppercase font-bold text-gray-500 hover:text-black disabled:opacity-30 transition-colors"
          >
            {{ t('feeds.markRead') }}
          </button>
          <button
            v-if="visibleItems.length > 0"
            type="button"
            data-click="markAllAsUnread"
            :disabled="!visibleItems.some(item => !isUnread(item))"
            class="st-module-feed-toolbar-button px-1 text-[10px] uppercase font-bold text-gray-500 hover:text-black disabled:opacity-30 transition-colors"
          >
            {{ t('feeds.markUnread') }}
          </button>
          <button
            type="button"
            data-click="refreshAllFeeds"
            :disabled="isRefreshing || sources.length === 0"
            class="st-module-feed-toolbar-button px-1 text-[10px] uppercase font-bold text-gray-500 hover:text-black disabled:opacity-30 transition-colors"
          >
            {{ props.expanded ? (isRefreshing ? t('feeds.refreshing') : t('feeds.refresh')) : (isRefreshing ? '...' : t('feeds.refresh')) }}
          </button>
        </div>
      </div>

      <!-- Items List -->
      <div
        v-if="visibleItems.length"
        class="st-module-feed-list st-feed-grid--content-fetched overflow-y-auto"
        :class="props.expanded ? 'flex-1 min-h-0' : 'max-h-[300px]'"
      >
        <div class="st-module-feed-list-inner st-feed-grid-ajax-response w-full min-w-0">
          <FeedItemCard
            v-for="item in visibleItems"
            :key="item.id"
            :item="item"
            :source-title="getSourceTitle(item.feed_source_id)"
            :search-url-template="props.searchUrlTemplate"
            :is-newly-fetched="typeof item.id === 'number' && highlightedNewItemIds.includes(item.id)"
            :expanded="isItemExpanded(item.id)"
            :show-youtube-description="isYoutubeDescriptionExpanded(item.id)"
          />
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="st-module-feed-empty text-center px-4 py-4">
        <div>
          <p class="st-module-feed-empty-text text-[11px] text-white/50 italic mb-2">
            {{
              !sources.length
                ? t('feeds.noFeedsInModule')
                : !showLoadedItems && scopedItems.length
                  ? t('feeds.loadedItemsHidden')
                : hasFeedSearch
                  ? t('feeds.noMatchingLoadedItems')
                : activeFilter.type === 'source'
                  ? t('feeds.noItemsForSource')
                : activeFilter.type === 'new'
                  ? t('feeds.noNewItemsMarked')
                : activeFilter.type === 'unread'
                  ? t('feeds.noUnreadItemsFound')
                  : t('feeds.noItemsFound')
            }}
          </p>
          <button
            v-if="!sources.length"
            data-click="openAddFeedSource"
            class="text-[10px] uppercase tracking-wider font-normal text-white/80 hover:text-white transition-colors"
          >
            {{ t('feeds.addSource') }}
          </button>
          <button
            v-else-if="!showLoadedItems && scopedItems.length"
            data-click="showLoadedItems"
            class="text-[10px] uppercase tracking-wider font-normal text-white/80 hover:text-white transition-colors"
          >
            {{ t('feeds.showLoadedItems') }}
          </button>
          <button
            v-else-if="activeFilter.type === 'source' || activeFilter.type === 'new' || activeFilter.type === 'unread'"
            data-click="resetFeedFilter"
            class="text-[10px] uppercase tracking-wider font-normal text-white/80 hover:text-white transition-colors"
          >
            {{ t('feeds.showAllSources') }}
          </button>
        </div>
      </div>
    </div>

    <!-- CRUD Modal -->
    <Modal :show="isModalOpen" :title="editingSource ? t('feeds.editFeedSourceTitle') : t('feeds.newFeedSourceTitle')" @close="isModalOpen = false">
      <FeedSourceForm
        :source="editingSource"
        :collection-id="collection.id!"
        @save="saveSource"
        @delete="deleteSource"
        @cancel="isModalOpen = false"
      />
    </Modal>

    <Modal :show="isArchiveModalOpen && archivingItem !== null" :title="t('feeds.archiveFeedItemTitle')" @close="isArchiveModalOpen = false; archivingItem = null">
      <FeedArchiveForm
        v-if="archivingItem"
        :item="archivingItem"
        :source-title="getSourceTitle(archivingItem.feed_source_id)"
        :collection-id="collection.id!"
        @save="saveArchivedItem"
        @cancel="isArchiveModalOpen = false; archivingItem = null"
      />
    </Modal>

    <Modal :show="isArchiveListOpen" :title="t('feeds.archivedFeedItemsTitle')" @close="isArchiveListOpen = false">
      <div v-if="archivedItems.length" class="space-y-3 max-h-[85vh] overflow-y-auto">
        <article
          v-for="item in archivedItems"
          :key="item.id"
          class="st-module-feed-archive-item border border-white/10 bg-black/30 px-3 py-2 space-y-1"
          :data-archived-item-id="item.id"
          :class="props.highlightArchivedItemId === item.id ? 'ring-1 ring-red-500 shadow-[0_0_0_1px_rgba(239,68,68,0.95),0_0_16px_rgba(239,68,68,0.35)] border-red-400' : ''"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <h3 class="st-module-feed-archive-title text-[12px] text-white font-semibold leading-snug">{{ item.title }}</h3>
              <p class="st-module-feed-archive-source text-[10px] text-white/50">{{ item.source_title || t('feeds.archivedItemFallback') }}</p>
            </div>
            <div class="shrink-0 flex items-center gap-2">
              <a
                v-if="item.url"
                :href="item.url"
                target="_blank"
                rel="noopener noreferrer"
                class="st-module-feed-archive-link text-[10px] uppercase tracking-wider text-sky-400 hover:text-sky-300"
              >
                {{ t('feeds.open') }}
              </a>
              <button
                type="button"
                data-click="deleteArchivedFeedItem"
                class="st-module-feed-archive-delete text-[10px] uppercase tracking-wider text-red-400 hover:text-red-300"
              >
                {{ t('common.delete') }}
              </button>
            </div>
          </div>
          <p v-if="item.comment" class="st-module-feed-archive-comment text-[11px] text-white/80 leading-snug">{{ item.comment }}</p>
          <p v-if="item.summary" class="st-module-feed-archive-summary text-[11px] text-white/60 leading-snug line-clamp-3">{{ item.summary }}</p>
        </article>
      </div>
      <div v-else class="text-center">
        <p class="st-module-feed-archive-empty text-[11px] text-white/50 italic">{{ t('feeds.noArchivedFeedItems') }}</p>
      </div>
    </Modal>
  </div>
</template>

<style scoped>
.st-feed-grid {
  display: grid;
  grid-template-columns: minmax(220px, 13.75rem) minmax(0, 1fr);
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
  min-height: 100%;
}

.st-feed-grid--compact-expanded {
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: auto minmax(0, 1fr);
}

.st-feed-grid--compact-expanded .st-feed-grid--sidebar {
  border-right: 0;
  border-bottom: 1px solid rgb(255 255 255 / 0.1);
}

.st-feed-grid--compact-expanded .st-feed-grid--sidebar-content {
  max-height: 12rem;
}

.st-module-feed-empty {
  display: flex;
  width: 100%;
  justify-content: center;
  align-items: center;
}

@media (max-width: 768px) {
  .st-module-feed-sidebar {
    max-height: 240px;
  }
  .st-feed-grid {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr);
  }
}
</style>
