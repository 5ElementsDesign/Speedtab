<script setup lang="ts">
import AppSettingsForm from '@/components/AppSettingsForm.vue'
import AssetBrowserModal from '@/components/AssetBrowserModal.vue'
import CaptureInboxModal from '@/components/CaptureInboxModal.vue'
import CleanupModal from '@/components/CleanupModal.vue'
import EmptyState from '@/components/EmptyState.vue'
import Modal from '@/components/Modal.vue'
import ModuleCard from '@/components/ModuleCard.vue'
import ModuleForm from '@/components/ModuleForm.vue'
import NavBar from '@/components/NavBar.vue'
import OpenNotesHost from '@/components/OpenNotesHost.vue'
import PageForm from '@/components/PageForm.vue'
import SidePanel from '@/components/SidePanel.vue'
import { loadAssetObjectUrl } from '@/composables/useAsset'
import {
  BackupValidationError,
  downloadManifest,
  exportAll, importAll,
  LAST_IMPORT_EXPORTED_AT_KEY,
  readManifestFile,
} from '@/composables/useBackup'
import { useDragSort } from '@/composables/useDragSort'
import { useLiveQuery } from '@/composables/useLiveQuery'
import {
  cleanupOrphans,
  deleteModuleTree,
  deletePageTree,
} from '@/composables/useMaintenance'
import { useReorder } from '@/composables/useReorder'
import { db, isActiveRecord, makeCreateMetadata, makeUpdatedAtPatch } from '@/db/db'
import { DEFAULT_THEME_PRESET, normalizeThemePreset } from '@/themePresets'
import type {
  AppSetting,
  CaptureInboxItem,
  Collection,
  Module,
  Note,
  Page,
  PortableInput,
  Tab,
} from '@/types/db'
import { computed, onMounted, onUnmounted, ref, watch, watchEffect } from 'vue'

// ─── Hash navigation ──────────────────────────────────────────────────────────

/**
 * Hash state. Format:
 *   #/page/<slug>
 *   #/page/<slug>/tabs/<id>,<id>,<id>...
 *
 * Each id in the comma-separated list is a Collection id (globally unique).
 * Every module picks the first id in the list that belongs to one of its own
 * collections, so a single URL can deep-link multiple modules at once.
 *
 * Legacy format `#/page/<slug>/module/<id>/collection/<id>` is still parsed
 * (single id) for backward compatibility.
 */
interface HashState {
  pageSlug:      string | null
  collectionIds: number[]
}

function parseHash(): HashState {
  const hash = window.location.hash
  const pageMatch   = hash.match(/^#\/page\/([^/]+)/)
  const listMatch   = hash.match(/\/tabs\/([0-9,]+)/)
  const legacyMatch = hash.match(/\/collection\/(\d+)/)

  let collectionIds: number[] = []
  if (listMatch) {
    collectionIds = listMatch[1]
      .split(',')
      .map(s => parseInt(s, 10))
      .filter(n => Number.isFinite(n) && n > 0)
  } else if (legacyMatch) {
    const n = parseInt(legacyMatch[1], 10)
    if (Number.isFinite(n) && n > 0) collectionIds = [n]
  }

  return {
    pageSlug:      pageMatch ? decodeURIComponent(pageMatch[1]) : null,
    collectionIds,
  }
}

const hashState = ref<HashState>(parseHash())

function onHashChange() {
  hashState.value = parseHash()
}

onMounted(() => window.addEventListener('hashchange', onHashChange))
onUnmounted(() => window.removeEventListener('hashchange', onHashChange))

// ─── Reactive data from IndexedDB ─────────────────────────────────────────────

const { data: pages, loading: pagesLoading } = useLiveQuery(
  () => db.pages.orderBy('sort_order').filter(isActiveRecord).toArray(),
  [] as Page[],
)

const loading = computed(() => pagesLoading.value)

const { move: movePage } = useReorder(db.pages, pages)

// ─── Active page resolution ───────────────────────────────────────────────────

const activePage = computed<Page | null>(() => {
  if (!pages.value.length) return null

  // 1. Hash takes priority
  if (hashState.value.pageSlug) {
    const found = pages.value.find(p => p.slug === hashState.value.pageSlug)
    if (found) return found
  }

  // 2. Fall back to home or first page
  return pages.value.find(p => p.is_home === 1) ?? pages.value[0] ?? null
})

// ─── Modules for active page ──────────────────────────────────────────────────

const { data: modules, loading: modulesLoading } = useLiveQuery(
  () => activePage.value?.id
    ? db.modules.where('page_id').equals(activePage.value.id).filter(isActiveRecord).sortBy('sort_order')
    : Promise.resolve([] as Module[]),
  [] as Module[],
  [activePage]
)

const { move: moveModule } = useReorder(db.modules, modules)

const { data: allModules } = useLiveQuery(
  () => db.modules.orderBy('sort_order').filter(isActiveRecord).toArray(),
  [] as Module[],
)

const { data: allCollections } = useLiveQuery(
  () => db.collections.orderBy('sort_order').filter(isActiveRecord).toArray(),
  [] as Collection[],
)

const { data: allTabs } = useLiveQuery(
  () => db.tabs.orderBy('sort_order').filter(isActiveRecord).toArray(),
  [] as Tab[],
)

const { data: allNotes } = useLiveQuery(
  () => db.notes.orderBy('sort_order').filter(isActiveRecord).toArray(),
  [] as Note[],
)

const { data: allFeedSources } = useLiveQuery(
  () => db.feed_sources.orderBy('sort_order').filter(isActiveRecord).toArray(),
  [] as Array<import('@/types/db').FeedSource>,
)

const { data: allSavedFeedItems } = useLiveQuery(
  () => db.saved_feed_items.orderBy('saved_at').filter(isActiveRecord).toArray(),
  [] as Array<import('@/types/db').SavedFeedItem>,
)

const { data: captureInboxItems } = useLiveQuery(
  () => db.capture_inbox.orderBy('created_at').reverse().toArray(),
  [] as CaptureInboxItem[],
)

type SearchResult = {
  id: string
  kind: 'bookmark' | 'note' | 'feed_source' | 'archived_feed_item'
  title: string
  path: string
  pageSlug: string | null
  moduleId: number | null
  collectionId: number | null
  entityId: number | null
  externalUrl: string | null
  snippet: string | null
  fields: string[]
}

const searchOpen = ref(false)
const searchPanelVisible = ref(false)
const searchQuery = ref('')
const debouncedSearchQuery = ref('')
const expandedSearchResultIds = ref<string[]>([])
const searchHighlight = ref<{
  moduleId: number | null
  collectionId: number | null
  kind: SearchResult['kind']
  entityId: number | null
} | null>(null)
let searchDebounceHandle: number | null = null
let searchHighlightResetHandle: number | null = null

watch(searchQuery, (value) => {
  if (searchDebounceHandle !== null) window.clearTimeout(searchDebounceHandle)
  searchDebounceHandle = window.setTimeout(() => {
    debouncedSearchQuery.value = value.trim()
  }, 140)
})

onUnmounted(() => {
  if (searchDebounceHandle !== null) window.clearTimeout(searchDebounceHandle)
  if (searchHighlightResetHandle !== null) window.clearTimeout(searchHighlightResetHandle)
})

watch(searchOpen, (open) => {
  if (!open && !searchQuery.value.trim()) {
    expandedSearchResultIds.value = []
    debouncedSearchQuery.value = ''
    searchPanelVisible.value = false
  }
})

watch(debouncedSearchQuery, () => {
  expandedSearchResultIds.value = []
  if (searchOpen.value || debouncedSearchQuery.value) {
    searchPanelVisible.value = true
  }
})

const pageById = computed(() => new Map(pages.value.map((page) => [page.id!, page])))
const moduleById = computed(() => new Map(allModules.value.map((module) => [module.id!, module])))
const collectionById = computed(() => new Map(allCollections.value.map((collection) => [collection.id!, collection])))

function pathForCollection(collectionId: number | null | undefined): { pageSlug: string | null; path: string; moduleId: number | null } {
  const collection = collectionId != null ? collectionById.value.get(collectionId) : null
  const module = collection ? moduleById.value.get(collection.module_id) : null
  const page = module ? pageById.value.get(module.page_id) : null
  return {
    pageSlug: page?.slug ?? null,
    moduleId: module?.id ?? null,
    path: [page?.title, module?.title, collection?.title].filter(Boolean).join(' / '),
  }
}

function makeSnippet(value: string | null | undefined, max = 300): string | null {
  if (!value) return null
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (!normalized) return null
  return normalized.length > max ? `${normalized.slice(0, max)}…` : normalized
}

function includesQuery(value: string | null | undefined, query: string): boolean {
  return !!value && value.toLocaleLowerCase().includes(query)
}

const searchResults = computed<SearchResult[]>(() => {
  const query = debouncedSearchQuery.value.toLocaleLowerCase()
  if (!query) return []

  const results: SearchResult[] = []

  for (const tab of allTabs.value) {
    const matchedFields = [tab.title, tab.url].filter((value) => includesQuery(value, query))
    if (!matchedFields.length) continue
    const pathInfo = pathForCollection(tab.collection_id)
    results.push({
      id: `bookmark:${tab.id}`,
      kind: 'bookmark',
      title: tab.title,
      path: pathInfo.path,
      pageSlug: pathInfo.pageSlug,
      moduleId: pathInfo.moduleId,
      collectionId: tab.collection_id,
      entityId: tab.id ?? null,
      externalUrl: tab.url,
      snippet: makeSnippet(tab.description || tab.url),
      fields: matchedFields as string[],
    })
  }

  for (const note of allNotes.value) {
    const matchedFields = [note.title, note.content].filter((value) => includesQuery(value, query))
    if (!matchedFields.length) continue
    const pathInfo = pathForCollection(note.collection_id)
    results.push({
      id: `note:${note.id}`,
      kind: 'note',
      title: note.title,
      path: pathInfo.path,
      pageSlug: pathInfo.pageSlug,
      moduleId: pathInfo.moduleId,
      collectionId: note.collection_id,
      entityId: note.id ?? null,
      externalUrl: null,
      snippet: makeSnippet(note.content, 300),
      fields: matchedFields as string[],
    })
  }

  for (const source of allFeedSources.value) {
    const matchedFields = [source.title, source.feed_url, source.site_url].filter((value) => includesQuery(value, query))
    if (!matchedFields.length) continue
    const pathInfo = pathForCollection(source.collection_id)
    results.push({
      id: `feed_source:${source.id}`,
      kind: 'feed_source',
      title: source.title,
      path: pathInfo.path,
      pageSlug: pathInfo.pageSlug,
      moduleId: pathInfo.moduleId,
      collectionId: source.collection_id,
      entityId: source.id ?? null,
      externalUrl: source.site_url || source.feed_url,
      snippet: makeSnippet(source.feed_url),
      fields: matchedFields as string[],
    })
  }

  for (const item of allSavedFeedItems.value) {
    const matchedFields = [item.comment, item.summary].filter((value) => includesQuery(value, query))
    if (!matchedFields.length) continue
    const pathInfo = pathForCollection(item.collection_id)
    results.push({
      id: `archived_feed_item:${item.id}`,
      kind: 'archived_feed_item',
      title: item.title || item.source_title || 'Archived feed item',
      path: pathInfo.path,
      pageSlug: pathInfo.pageSlug,
      moduleId: pathInfo.moduleId,
      collectionId: item.collection_id,
      entityId: item.id ?? null,
      externalUrl: item.url,
      snippet: makeSnippet(item.comment || item.summary || item.url, 300),
      fields: matchedFields as string[],
    })
  }

  return results.slice(0, 80)
})

const showSearchPanel = computed(() => searchPanelVisible.value && (searchOpen.value || !!debouncedSearchQuery.value || !!searchQuery.value.trim()))
const searchPanelStyle = computed(() => ({
  top: backupStatus.value ? '72px' : '40px',
  height: '80%',
}))

const searchKindLabel: Record<SearchResult['kind'], string> = {
  bookmark: 'Bookmark',
  note: 'Note',
  feed_source: 'Feed Source',
  archived_feed_item: 'Archived Feed',
}

function toggleSearchResult(resultId: string) {
  if (expandedSearchResultIds.value.includes(resultId)) {
    expandedSearchResultIds.value = expandedSearchResultIds.value.filter((id) => id !== resultId)
    return
  }
  expandedSearchResultIds.value = [...expandedSearchResultIds.value, resultId]
}

function navigateToSearchResult(result: SearchResult) {
  if (!result.pageSlug) return
  updateHash(result.pageSlug, result.collectionId != null ? [result.collectionId] : [])
  focusedModuleId.value = result.moduleId
  searchPanelVisible.value = false
  searchHighlight.value = {
    moduleId: result.moduleId,
    collectionId: result.collectionId,
    kind: result.kind,
    entityId: result.entityId,
  }
  if (searchHighlightResetHandle !== null) window.clearTimeout(searchHighlightResetHandle)
  searchHighlightResetHandle = window.setTimeout(() => {
    searchHighlight.value = null
  }, 4200)
}

function handleSearchFocus() {
  searchPanelVisible.value = true
}

function handleDocumentPointerDown(event: MouseEvent) {
  const target = event.target as HTMLElement | null
  if (!target) return
  if (target.closest('.st-search-panel') || target.closest('[data-speedtab-search]')) return
  searchPanelVisible.value = false
}

watch(captureInboxItems, (items) => {
  document.title = items.length > 0 ? `INBOX [${items.length}] - Speedtab` : 'Speedtab'
}, { immediate: true })

onMounted(() => window.addEventListener('mousedown', handleDocumentPointerDown))
onUnmounted(() => window.removeEventListener('mousedown', handleDocumentPointerDown))

// Drag-and-drop bindings for the module grid (one row per module)
const moduleDnd = useDragSort({ onReorder: (f, t) => moveModule(f, t) })

// ─── Page layout config (modules-per-row + max-width) ─────────────────────────

interface PageConfig {
  modulesPerRow?: number      // 1..6, default 3
  maxWidth?:     number | null // px, null = full width
  backgroundAssetId?: number | null
}

type BackgroundTheme = 'charcoal' | 'ocean' | 'moss' | 'ember' | 'sunshine' | 'paper'
type ThemePreset = string
type AppearanceState = {
  backgroundAssetId: number | null
  backgroundTheme: BackgroundTheme | null
  backgroundPreset: ThemePreset
  openBookmarksInNewTab: boolean
  feedSearchUrlTemplate: string
  feedContentScale: number
  noteContentScale: number
}
type AppearanceDraft = AppearanceState & {
  backgroundPreviewUrl?: string | null
}
type AppearanceDraftInput = {
  backgroundAssetId: number | null
  backgroundTheme: string | null
  backgroundPreset: string
  openBookmarksInNewTab: boolean
  feedSearchUrlTemplate: string
  feedContentScale: number
  noteContentScale: number
  backgroundPreviewUrl?: string | null
}

interface ModuleLayoutConfig {
  full_width?: boolean
  expanded_width?: FeedExpandedWidth | null
}

type FeedExpandedWidth = 320 | 480 | 740 | 940 | 1240 | 1540 | 'max'

function parsePageConfig(p: Page | null): PageConfig {
  if (!p?.config_json) return {}
  try {
    const parsed = JSON.parse(p.config_json)
    return {
      modulesPerRow: typeof parsed.modulesPerRow === 'number' ? parsed.modulesPerRow : undefined,
      maxWidth: typeof parsed.maxWidth === 'number' ? parsed.maxWidth : null,
      backgroundAssetId: typeof parsed.background_asset_id === 'number' ? parsed.background_asset_id : null,
    } as PageConfig
  } catch { return {} }
}

const activePageConfig = computed<PageConfig>(() => parsePageConfig(activePage.value))

const pageContainerStyle = computed(() => {
  const mw = activePageConfig.value.maxWidth
  return mw && mw > 0 ? { maxWidth: `${mw}px` } : { maxWidth: '100%' }
})

const displayedModuleColumns = computed(() => {
  const configured = Math.max(1, Math.min(6, activePageConfig.value.modulesPerRow ?? 3))
  const count      = modules.value.length || 1
  return Math.max(1, Math.min(configured, count))
})

function parseModuleLayoutConfig(module: Module): ModuleLayoutConfig {
  try { return JSON.parse(module.config_json ?? '{}') as ModuleLayoutConfig }
  catch { return {} }
}

function normalizeFeedExpandedWidth(value: unknown): FeedExpandedWidth | null {
  return value === 'max' || value === 320 || value === 480 || value === 740 || value === 940 || value === 1240 || value === 1540
    ? value
    : null
}

const autoFullWidthModuleId = computed<number | null>(() => {
  if (displayedModuleColumns.value !== 2 || !modules.value.length) return null

  const rows: Array<Array<{ id: number; spansFull: boolean }>> = []
  let currentRow: Array<{ id: number; spansFull: boolean }> = []
  let usedSlots = 0

  for (const module of modules.value) {
    if (!module.id) continue
    const spansFull = expandedFeedState.value?.id === module.id || parseModuleLayoutConfig(module).full_width === true

    if (spansFull) {
      if (currentRow.length) {
        rows.push(currentRow)
        currentRow = []
        usedSlots = 0
      }
      rows.push([{ id: module.id, spansFull: true }])
      continue
    }

    currentRow.push({ id: module.id, spansFull: false })
    usedSlots += 1

    if (usedSlots === 2) {
      rows.push(currentRow)
      currentRow = []
      usedSlots = 0
    }
  }

  if (currentRow.length) rows.push(currentRow)

  const lastRow = rows.at(-1)
  if (!lastRow || lastRow.length !== 1 || lastRow[0].spansFull) return null
  return lastRow[0].id
})

const modulesGridStyle = computed(() => {
  const configured = Math.max(1, Math.min(6, activePageConfig.value.modulesPerRow ?? 3))
  const count      = modules.value.length || 1
  const cols       = displayedModuleColumns.value

  if (count === 1) {
    return {
      gridTemplateColumns: 'max(50%, 360px)',
      justifyContent: 'center',
    }
  }

  if (count === 2) {
    return {
      gridTemplateColumns: 'repeat(2, minmax(360px, 1fr))',
    }
  }

  // When the actual module count is below the configured columns, switch from
  // stretching 1fr cells to fixed-width cells centered on the row (otherwise
  // 2 of 3 modules would stretch to fill the whole row instead of centering).
  if (count < configured) {
    const mw        = activePageConfig.value.maxWidth
    const cellWidth = mw && mw > 0
      ? Math.floor((mw - (configured - 1) * 16) / configured)  // gap-4 = 16 px
      : 360
    return {
      gridTemplateColumns: `repeat(${cols}, ${cellWidth}px)`,
      justifyContent:      'center',
    }
  }
  return { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }
})

function moduleGridClass(module: Module): string {
  if (displayedModuleColumns.value <= 1) return ''
  if (expandedFeedState.value?.id === module.id) return 'col-span-full'
  if (parseModuleLayoutConfig(module).full_width) return 'col-span-full'
  return autoFullWidthModuleId.value === module.id ? 'col-span-full' : ''
}

function getModuleExpandedWidth(module: Module): FeedExpandedWidth | null {
  const expanded = expandedFeedState.value
  if (expanded && expanded.id === module.id) return expanded.width
  return normalizeFeedExpandedWidth(parseModuleLayoutConfig(module).expanded_width)
}

// Sync hash when active page changes
watch(activePage, (page) => {
  expandedFeedState.value = null
  if (!page) return
  const current = parseHash()
  if (current.pageSlug !== page.slug) {
    const newHash = `#/page/${encodeURIComponent(page.slug)}`
    history.replaceState(null, '', newHash)
    hashState.value = parseHash()
  }
})

// ─── Navigation actions ───────────────────────────────────────────────────────

/** Module that was most-recently clicked (drives the visual focus border). */
const focusedModuleId = ref<number | null>(null)
const expandedFeedState = ref<{ id: number; width: FeedExpandedWidth } | null>(null)

function updateHash(slug: string, ids: number[] = []) {
  let target = `#/page/${encodeURIComponent(slug)}`
  if (ids.length) target += `/tabs/${ids.join(',')}`

  if (window.location.hash !== target) {
    history.pushState(null, '', target)
    hashState.value = parseHash()
  }
}

function navigateTo(page: Page) {
  // Switching pages clears the per-page active-tab list (the ids belong to
  // collections on the previous page anyway).
  updateHash(page.slug)
}

/**
 * Called when a module is clicked (focus only) or when one of its tabs is
 * clicked. `newColId` + `siblingIds` swap any of the module's own ids out of
 * the current list and append the new selection.
 */
function focusModule(module: Module, newColId?: number, siblingIds: number[] = []) {
  focusedModuleId.value = module.id ?? null
  if (!activePage.value) return
  if (!newColId) return

  const filtered = hashState.value.collectionIds.filter(id => !siblingIds.includes(id))
  filtered.push(newColId)
  updateHash(activePage.value.slug, filtered)
}

function collapseExpandedFeed() {
  expandedFeedState.value = null
}

async function setFeedModuleExpandWidth(module: Module, width: FeedExpandedWidth) {
  const id = module.id ?? null
  if (id === null || module.type !== 'feeds') return

  let nextConfig: Record<string, unknown> = {}
  try {
    nextConfig = JSON.parse(module.config_json ?? '{}')
  } catch {
    nextConfig = {}
  }

  await db.modules.update(id, {
    config_json: JSON.stringify({
      ...nextConfig,
      expanded_width: width,
    }),
    ...makeUpdatedAtPatch(Date.now()),
  })

  expandedFeedState.value = { id, width }
  focusedModuleId.value = id
}

// ─── Page CRUD ────────────────────────────────────────────────────────────────

const isPageModalOpen = ref(false)
const editingPage = ref<Page | undefined>(undefined)

function openAddPage() {
  editingPage.value = undefined
  isPageModalOpen.value = true
}

function openEditPage(page: Page) {
  editingPage.value = page
  isPageModalOpen.value = true
}

async function savePage(data: PortableInput<Page>) {
  const now = Date.now()
  if (editingPage.value?.id) {
    // If setting as home, unset other home pages
    if (data.is_home === 1) {
      await db.pages.where('is_home').equals(1).modify({ is_home: 0, updated_at: now })
    }
    await db.pages.update(editingPage.value.id, {
      ...data,
      ...makeUpdatedAtPatch(now),
    })
  } else {
    // New page
    const count = await db.pages.filter(isActiveRecord).count()
    data.sort_order = count

    if (data.is_home === 1) {
      await db.pages.where('is_home').equals(1).modify({ is_home: 0, updated_at: now })
    }

    await db.pages.add({
      ...data,
      ...makeCreateMetadata(now),
    })
  }
  isPageModalOpen.value = false
}

async function deletePage(id: number) {
  if (!confirm('Are you sure you want to delete this page? All modules and tabs will be lost.')) return
  await deletePageTree(id)
  await cleanupOrphans()

  isPageModalOpen.value = false
  // Navigation will automatically fallback to home or first page via activePage computed
}

// ─── Module CRUD ──────────────────────────────────────────────────────────────

const isModuleModalOpen = ref(false)
const editingModule = ref<Module | undefined>(undefined)

function openAddModule() {
  editingModule.value = undefined
  isModuleModalOpen.value = true
}

async function saveModule(data: PortableInput<Module>) {
  const now = Date.now()
  if (editingModule.value?.id) {
    await db.modules.update(editingModule.value.id, {
      ...data,
      ...makeUpdatedAtPatch(now),
    })
  } else {
    // New module
    const count = await db.modules.where('page_id').equals(data.page_id).filter(isActiveRecord).count()
    data.sort_order = count
    await db.modules.add({
      ...data,
      ...makeCreateMetadata(now),
    })
  }
  isModuleModalOpen.value = false
}

async function deleteModule(id: number) {
  if (!confirm('Are you sure you want to delete this module? All tabs inside will be lost.')) return
  await deleteModuleTree(id)
  await cleanupOrphans()

  isModuleModalOpen.value = false
}

// ─── Copy URL modal ───────────────────────────────────────────────────────────

const isUrlModalOpen = ref(false)
const urlCopied = ref(false)

const currentUrl = computed(() => window.location.href)

function openUrlModal() {
  urlCopied.value = false
  isUrlModalOpen.value = true
}

async function copyCurrentUrl() {
  try {
    await navigator.clipboard.writeText(window.location.href)
    urlCopied.value = true
    setTimeout(() => { urlCopied.value = false }, 2000)
  } catch {
    // fallback: select the input so the user can copy manually
  }
}

// ─── Backup: export / import ──────────────────────────────────────────────────

const importInput = ref<HTMLInputElement | null>(null)
const backupStatus = ref<string | null>(null)
const isSettingsModalOpen = ref(false)
const isAssetBrowserOpen = ref(false)
const isCaptureInboxOpen = ref(false)
const isCleanupModalOpen = ref(false)
const settingsDraft = ref<AppearanceDraft | null>(null)

const { data: appearanceSetting, loading: appearanceLoading } = useLiveQuery(
  () => db.app_settings.get('appearance'),
  null as AppSetting | null,
)

function parseAppearanceSetting(setting: AppSetting | null | undefined): AppearanceState {
  if (!setting?.value_json) return { backgroundAssetId: null, backgroundTheme: null, backgroundPreset: DEFAULT_THEME_PRESET, openBookmarksInNewTab: false, feedSearchUrlTemplate: 'https://www.google.com/search?q=%s', feedContentScale: 1, noteContentScale: 1 }
  try {
    const parsed = JSON.parse(setting.value_json)
    return {
      backgroundAssetId: typeof parsed.background_asset_id === 'number' ? parsed.background_asset_id : null,
      backgroundTheme: ['charcoal', 'ocean', 'moss', 'ember', 'sunshine', 'paper'].includes(parsed.background_theme) ? parsed.background_theme as BackgroundTheme : null,
      backgroundPreset: normalizeThemePreset(parsed.background_preset),
      openBookmarksInNewTab: parsed.open_bookmarks_in_new_tab === true,
      feedSearchUrlTemplate: typeof parsed.feed_search_url_template === 'string' && parsed.feed_search_url_template.trim()
        ? parsed.feed_search_url_template.trim()
        : 'https://www.google.com/search?q=%s',
      feedContentScale: typeof parsed.feed_content_scale === 'number' && parsed.feed_content_scale > 0
        ? parsed.feed_content_scale
        : 1,
      noteContentScale: typeof parsed.note_content_scale === 'number' && parsed.note_content_scale > 0
        ? parsed.note_content_scale
        : 1,
    }
  } catch {
    return { backgroundAssetId: null, backgroundTheme: null, backgroundPreset: DEFAULT_THEME_PRESET, openBookmarksInNewTab: false, feedSearchUrlTemplate: 'https://www.google.com/search?q=%s', feedContentScale: 1, noteContentScale: 1 }
  }
}

const appAppearance = computed(() => parseAppearanceSetting(appearanceSetting.value))
const effectiveAppearance = computed<AppearanceDraft>(() => settingsDraft.value ?? appAppearance.value)
const effectiveBackgroundAssetId = computed<number | null>(() =>
  activePageConfig.value.backgroundAssetId ?? effectiveAppearance.value.backgroundAssetId ?? null
)
const appBackgroundThemeClass = computed(() =>
  effectiveAppearance.value.backgroundTheme ? `st-bg-theme-${effectiveAppearance.value.backgroundTheme}` : ''
)
const appThemePresetClass = computed(() =>
  `theme-${effectiveAppearance.value.backgroundPreset}`
)

const backgroundObjectUrl = ref<string | null>(null)
const defaultBackgroundUrl = ref<string | null>(null)
let backgroundUrlHandle: string | null = null

async function syncBackgroundPreview(assetId: number | null) {
  if (backgroundUrlHandle) {
    URL.revokeObjectURL(backgroundUrlHandle)
    backgroundUrlHandle = null
  }
  backgroundObjectUrl.value = null
  if (!assetId) return
  backgroundUrlHandle = await loadAssetObjectUrl(assetId)
  backgroundObjectUrl.value = backgroundUrlHandle
}

watch(effectiveBackgroundAssetId, syncBackgroundPreview, { immediate: true })

watch([effectiveBackgroundAssetId, () => effectiveAppearance.value.backgroundTheme, appearanceLoading, pagesLoading], async ([assetId, backgroundTheme, isAppearanceLoading, isPagesLoading]) => {
  if (isAppearanceLoading || isPagesLoading) return
  if (settingsDraft.value?.backgroundPreviewUrl) return
  if (assetId !== null) return
  if (backgroundTheme) return
  if (defaultBackgroundUrl.value) return
  const mod = await import('@/assets/wallpaper-y-tree.webp')
  defaultBackgroundUrl.value = mod.default
}, { immediate: true })

onUnmounted(() => {
  if (backgroundUrlHandle) URL.revokeObjectURL(backgroundUrlHandle)
})

watchEffect(() => {
  const rootStyle = document.documentElement.style
  rootStyle.setProperty('--st-feed-content-scale', String(effectiveAppearance.value.feedContentScale))
  rootStyle.setProperty('--st-note-content-scale', String(effectiveAppearance.value.noteContentScale))
})

const appShellStyle = computed(() => {
  const shouldUseDefaultBackground =
    !appearanceLoading.value &&
    !pagesLoading.value &&
    !settingsDraft.value?.backgroundPreviewUrl &&
    effectiveBackgroundAssetId.value === null &&
    !effectiveAppearance.value.backgroundTheme

  const resolvedBackgroundUrl = shouldUseDefaultBackground
    ? defaultBackgroundUrl.value
    : (settingsDraft.value?.backgroundPreviewUrl ?? backgroundObjectUrl.value)

  const style: Record<string, string> = {
    '--st-feed-content-scale': String(effectiveAppearance.value.feedContentScale),
    '--st-note-content-scale': String(effectiveAppearance.value.noteContentScale),
  }

  if (!resolvedBackgroundUrl) {
    return style
  }

  return {
    ...style,
    backgroundImage: `url("${resolvedBackgroundUrl}")`,
    backgroundPosition: 'center center',
    backgroundRepeat: 'no-repeat',
    backgroundSize: 'cover',
    backgroundAttachment: 'fixed',
  }
})

function readTimestampSetting(setting: AppSetting | undefined): number | null {
  if (!setting?.value_json) return null
  try {
    const parsed = JSON.parse(setting.value_json)
    if (typeof parsed === 'number' && Number.isFinite(parsed)) return parsed
    if (typeof parsed === 'string') {
      const millis = Date.parse(parsed)
      return Number.isNaN(millis) ? null : millis
    }
  } catch {
    return null
  }
  return null
}

function formatImportReport(report: Awaited<ReturnType<typeof importAll>>, cleanupCount: number) {
  const summary: string[] = []
  const details: string[] = []

  if (report.manifest_version === 1) {
    summary.push('Imported legacy backup')
  } else {
    summary.push('Imported backup')
  }

  const inserted =
    (report.pages_inserted ?? 0) +
    (report.modules_inserted ?? 0) +
    (report.collections_inserted ?? 0) +
    (report.tabs_inserted ?? 0) +
    (report.notes_inserted ?? 0) +
    (report.feed_sources_inserted ?? 0) +
    (report.saved_feed_items_inserted ?? 0)

  const updated =
    (report.pages_updated ?? 0) +
    (report.modules_updated ?? 0) +
    (report.collections_updated ?? 0) +
    (report.tabs_updated ?? 0) +
    (report.notes_updated ?? 0) +
    (report.feed_sources_updated ?? 0) +
    (report.saved_feed_items_updated ?? 0)

  if (report.manifest_version === 1) {
    details.push(
      `pages:${report.pages}`,
      `modules:${report.modules}`,
      `tabs:${report.tabs}`,
      `notes:${report.notes}`,
      `archived:${report.saved_feed_items}`,
      `assets:${report.assets}`,
    )
  } else {
    if (inserted) details.push(`inserted:${inserted}`)
    if (updated) details.push(`updated:${updated}`)
    if (report.newer_local_skipped) details.push(`kept-local:${report.newer_local_skipped}`)
    if (report.orphans_skipped) details.push(`orphans:${report.orphans_skipped}`)
    if (report.assets) details.push(`assets:${report.assets}`)
    if (report.assets_deduped) details.push(`assets-reused:${report.assets_deduped}`)
  }

  if (cleanupCount > 0) details.push(`cleanup:${cleanupCount}`)
  if (report.legacy_warning) details.push('legacy-format')

  return [summary.join(' · '), details.join(' · ')].filter(Boolean).join(' · ')
}

async function handleExport() {
  try {
    const manifest = await exportAll()
    await downloadManifest(manifest)
    backupStatus.value = `Exported ${manifest.pages.length} pages · ${manifest.saved_feed_items.length} archived items · ${manifest.assets.length} assets`
  } catch (err) {
    backupStatus.value = `Export failed: ${(err as Error).message}`
  }
}

function triggerImport() { importInput.value?.click() }

async function handleImportFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    const manifest = await readManifestFile(file)
    const warnings: string[] = []

    if (manifest.version === 1) {
      warnings.push('Legacy export detected. This format may duplicate content because it has no stable sync identities.')
    } else {
      const lastImportSetting = await db.app_settings.get(LAST_IMPORT_EXPORTED_AT_KEY)
      const lastImportedAt = readTimestampSetting(lastImportSetting)
      const incomingExportedAt = Date.parse(manifest.exported_at)
      if (lastImportedAt != null && Number.isFinite(incomingExportedAt) && incomingExportedAt < lastImportedAt) {
        warnings.push('This backup is older than the most recently imported v2 backup. Importing it may skip newer local changes and reintroduce stale content.')
      }
    }

    const confirmMessage = [
      `Import ${manifest.pages.length} pages, ${manifest.modules.length} modules, ${manifest.assets.length} assets into the local workspace?`,
      manifest.version === 1
        ? 'Existing data will be preserved, but legacy rows may duplicate.'
        : 'Existing data will be merged by stable identity.',
      ...warnings,
    ].join('\n\n')

    if (!confirm(confirmMessage)) {
      return
    }
    const report = await importAll(manifest)
    const cleanup = await cleanupOrphans()
    const cleaned = Object.values(cleanup).reduce((sum, value) => sum + value, 0)
    backupStatus.value = formatImportReport(report, cleaned)
  } catch (err) {
    backupStatus.value = err instanceof BackupValidationError
      ? `Invalid backup: ${err.message}`
      : `Import failed: ${(err as Error).message}`
  } finally {
    if (importInput.value) importInput.value.value = ''
  }
}

async function handleCleanup() {
  isCleanupModalOpen.value = true
}

function handleCleanupCompleted(report: Awaited<ReturnType<typeof cleanupOrphans>>, refreshedFavicons: number) {
  isCleanupModalOpen.value = false
  const total = Object.values(report).reduce((sum, value) => sum + value, 0)
  const parts: string[] = ['Cleanup complete']
  parts.push(total === 0 ? 'nothing removed' : `removed ${total} selected items`)
  if (refreshedFavicons > 0) {
    parts.push(`refreshed ${refreshedFavicons} stale favicons`)
  }
  backupStatus.value = parts.join(' · ')
}

async function saveCaptureInboxItem(item: CaptureInboxItem, collectionId: number) {
  const now = Date.now()
  const metaJson = JSON.stringify({
    capture_source_url: item.source_url,
    capture_source_title: item.source_title,
    capture_hash: item.external_hash,
  })

  if (item.kind === 'note') {
    const sortOrder = await db.notes.where('collection_id').equals(collectionId).filter(isActiveRecord).count()
    const note: Note = {
      collection_id: collectionId,
      title: item.title || 'Captured note',
      type: 'text',
      content: item.text || '',
      style_token: null,
      sort_order: sortOrder,
      meta_json: metaJson,
      ...makeCreateMetadata(now),
    }
    await db.notes.add(note)
  } else {
    const sortOrder = await db.tabs.where('collection_id').equals(collectionId).filter(isActiveRecord).count()
    const tab: Tab = {
      collection_id: collectionId,
      title: item.title || item.url || 'Captured bookmark',
      url: item.url || '',
      description: item.text || item.source_title || null,
      favicon_asset_id: null,
      preview_asset_id: null,
      sort_order: sortOrder,
      meta_json: metaJson,
      ...makeCreateMetadata(now),
    }
    await db.tabs.add(tab)
  }

  if (item.id != null) {
    await db.capture_inbox.delete(item.id)
  }

  backupStatus.value = item.kind === 'note'
    ? 'Captured note saved'
    : 'Captured bookmark saved'

  if (captureInboxItems.value.length <= 1) {
    isCaptureInboxOpen.value = false
  }
}

async function discardCaptureInboxItem(itemId: number) {
  await db.capture_inbox.delete(itemId)
  backupStatus.value = 'Captured item discarded'
  if (captureInboxItems.value.length <= 1) {
    isCaptureInboxOpen.value = false
  }
}

function openSettingsPanel() {
  settingsDraft.value = {
    ...appAppearance.value,
    backgroundPreviewUrl: null,
  }
  isSettingsModalOpen.value = true
}

function closeSettingsPanel() {
  settingsDraft.value = null
  isSettingsModalOpen.value = false
}

function handleSettingsPreview(draft: AppearanceDraftInput) {
  settingsDraft.value = {
    backgroundAssetId: draft.backgroundAssetId,
    backgroundTheme: draft.backgroundTheme && ['charcoal', 'ocean', 'moss', 'ember', 'sunshine', 'paper'].includes(draft.backgroundTheme)
      ? draft.backgroundTheme as BackgroundTheme
      : null,
    backgroundPreset: normalizeThemePreset(draft.backgroundPreset),
    openBookmarksInNewTab: draft.openBookmarksInNewTab,
    feedSearchUrlTemplate: draft.feedSearchUrlTemplate.trim() || 'https://www.google.com/search?q=%s',
    feedContentScale: [0.8, 1, 1.2, 1.4].includes(draft.feedContentScale) ? draft.feedContentScale : 1,
    noteContentScale: [0.8, 1, 1.2, 1.4].includes(draft.noteContentScale) ? draft.noteContentScale : 1,
    backgroundPreviewUrl: draft.backgroundPreviewUrl ?? null,
  }
}

async function handleSaveSettings(draft: AppearanceDraftInput) {
  const normalizedTheme = draft.backgroundTheme && ['charcoal', 'ocean', 'moss', 'ember', 'sunshine', 'paper'].includes(draft.backgroundTheme)
    ? draft.backgroundTheme
    : null
  const normalizedPreset = normalizeThemePreset(draft.backgroundPreset)
  const normalizedSearchTemplate = draft.feedSearchUrlTemplate.trim() || 'https://www.google.com/search?q=%s'
  await db.app_settings.put({
    key: 'appearance',
    value_json: JSON.stringify({
      background_asset_id: draft.backgroundAssetId,
      background_theme: normalizedTheme,
      background_preset: normalizedPreset,
      open_bookmarks_in_new_tab: draft.openBookmarksInNewTab,
      feed_search_url_template: normalizedSearchTemplate,
      feed_content_scale: [0.8, 1, 1.2, 1.4].includes(draft.feedContentScale) ? draft.feedContentScale : 1,
      note_content_scale: [0.8, 1, 1.2, 1.4].includes(draft.noteContentScale) ? draft.noteContentScale : 1,
    }),
    updated_at: Date.now(),
  })
  closeSettingsPanel()
}

</script>

<template>
  <div :class="['relative flex flex-col h-screen text-gray-100 overflow-hidden', appBackgroundThemeClass, appThemePresetClass]" :style="appShellStyle">

    <!-- Top navigation bar -->
    <NavBar
      :pages="pages"
      :active-page="activePage"
      :capture-count="captureInboxItems.length"
      :search-open="searchOpen"
      :search-query="searchQuery"
      @navigate="navigateTo"
      @add-page="openAddPage"
      @edit-page="openEditPage"
      @add-module="openAddModule"
      @move-page="movePage"
      @export-data="handleExport"
      @import-data="triggerImport"
      @cleanup-data="handleCleanup"
      @open-settings="openSettingsPanel"
      @open-assets="isAssetBrowserOpen = true"
      @copy-url="openUrlModal"
      @open-capture-inbox="isCaptureInboxOpen = true"
      @update-search-open="searchOpen = $event"
      @update-search-query="searchQuery = $event"
      @search-focus="handleSearchFocus"
    />

    <!-- Hidden import file picker -->
    <input
      ref="importInput"
      type="file"
      accept="application/json,.json"
      class="hidden"
      aria-hidden="true"
      @change="handleImportFile"
    />

    <OpenNotesHost />

    <!-- Toast-style status line for backup operations -->
    <div
      v-if="backupStatus"
      class="st-status-bar absolute left-0 right-0 top-10 z-40 px-2 py-2 text-[10px] uppercase tracking-wider bg-black/85 text-white/90 border-b border-white/10 flex items-center justify-between"
      role="status"
    >
      <span class="truncate">{{ backupStatus }}</span>
      <button
        @click="backupStatus = null"
        class="ml-2 text-white/70 hover:text-white"
        aria-label="Dismiss"
      >✕</button>
    </div>

    <section
      v-if="showSearchPanel"
      class="st-search-panel absolute left-1/2 z-50 flex w-[min(1000px,calc(100%-1rem))] -translate-x-1/2 flex-col overflow-hidden border shadow-2xl backdrop-blur-sm"
      :style="searchPanelStyle"
      aria-label="Search results"
    >
      <div class="st-search-panel-header border-b px-3 py-2 text-[10px] uppercase tracking-wider">
        <template v-if="debouncedSearchQuery">
          {{ searchResults.length }} result{{ searchResults.length === 1 ? '' : 's' }} for “{{ debouncedSearchQuery }}”
        </template>
        <template v-else>
          Search pages, modules, bookmarks, notes, feed sources, and archived feed items.
        </template>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto">
        <div
          v-if="!debouncedSearchQuery"
          class="st-search-panel-empty px-4 py-5 text-[11px]"
        >
          Type to search across text and URL fields.
        </div>

        <div
          v-else-if="!searchResults.length"
          class="st-search-panel-empty px-4 py-5 text-[11px]"
        >
          No matches found.
        </div>

        <div v-else class="st-search-panel-results divide-y">
          <article
            v-for="result in searchResults"
            :key="result.id"
            class="st-search-result"
          >
            <button
              type="button"
              class="w-full px-4 py-3 text-left transition-colors hover:bg-white/5 focus:outline-none focus-visible:bg-white/5"
              @click="toggleSearchResult(result.id)"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0 space-y-1">
                  <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span class="st-search-result-kind text-[10px] uppercase tracking-wider">{{ searchKindLabel[result.kind] }}</span>
                    <h3 class="st-search-result-title truncate text-[12px] font-medium">{{ result.title }}</h3>
                  </div>
                  <p class="st-search-result-path truncate text-[10px]">{{ result.path || 'Workspace' }}</p>
                </div>
                <span class="st-search-result-toggle shrink-0 text-[10px]">
                  {{ expandedSearchResultIds.includes(result.id) ? '−' : '+' }}
                </span>
              </div>
            </button>

            <div
              v-if="expandedSearchResultIds.includes(result.id)"
              class="st-search-result-details border-t px-4 py-3 text-[11px]"
            >
              <div class="space-y-3">
                <div class="st-search-result-matches flex flex-wrap items-center gap-2 text-[10px]">
                  <span>Matched:</span>
                  <span
                    v-for="field in result.fields"
                    :key="field"
                    class="st-search-result-chip rounded-sm px-1.5 py-0.5"
                  >
                    {{ field.length > 40 ? `${field.slice(0, 40)}…` : field }}
                  </span>
                </div>

                <p
                  v-if="result.snippet"
                  class="st-search-result-snippet whitespace-pre-wrap break-words [overflow-wrap:anywhere]"
                >
                  <a
                    v-if="result.kind === 'bookmark' && result.externalUrl"
                    :href="result.externalUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="st-search-result-link"
                    @click.stop
                  >
                    {{ result.snippet }}
                  </a>
                  <template v-else>{{ result.snippet }}</template>
                </p>

                <div class="flex flex-wrap items-center justify-between gap-2">
                  <p class="st-search-result-footer text-[10px] uppercase tracking-wider">
                    {{ result.path || 'Workspace root' }}
                  </p>
                  <button
                    v-if="result.pageSlug"
                    type="button"
                    class="st-search-result-locate px-2 py-1 text-[10px] uppercase tracking-wider transition-colors"
                    @click.stop="navigateToSearchResult(result)"
                  >
                    Locate
                  </button>
                </div>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>

    <div
      v-if="expandedFeedState !== null"
      class="fixed inset-0 z-50 bg-black/65 backdrop-blur-[2px]"
      @click="collapseExpandedFeed"
    ></div>

    <!-- Main content area -->
    <main class="flex-1 min-h-0 overflow-y-auto">

      <!-- ① Boot / loading skeleton -->
      <div
        v-if="loading"
        class="flex items-center justify-center h-full"
      >
        <span class="text-xs text-gray-600 animate-pulse tracking-widest uppercase">
          Loading…
        </span>
      </div>

      <!-- ② No pages at all -->
      <EmptyState
        v-else-if="!pages.length"
        title="No pages yet"
        description="Add your first page to get started. Pages, modules, and tabs will appear here."
      >
        <template #action>
          <button
            @click="openAddPage"
            class="
              px-2 py-1 text-[11px] font-normal
              bg-white/10 hover:bg-white/15 text-white border border-white/10
              transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40
            "
          >
            + New Page
          </button>
        </template>
      </EmptyState>

      <!-- ③ Active page – modules grid (centered, max-width applied from page config) -->
      <div v-else-if="activePage" class="st-page-stage">
      <Transition name="st-page-fade" mode="out-in" appear>
      <div
        :key="activePage.id"
        class="st-page-panel min-h-full w-full mx-auto flex flex-col justify-center overflow-hidden p-2"
        :style="pageContainerStyle"
      >
        <!-- Modules Grid -->
        <div v-if="modulesLoading" class="st-modules-grid grid justify-center gap-4" :style="modulesGridStyle">
          <div v-for="i in 3" :key="i" class="h-40 bg-black/40 border border-white/10 animate-pulse"></div>
        </div>

        <div v-else-if="modules.length" class="st-modules-grid grid justify-center gap-4" :style="modulesGridStyle">
          <ModuleCard
            v-for="(module, idx) in modules"
            :key="module.id"
            v-bind="moduleDnd.bindFor(idx)"
            :class="moduleGridClass(module)"
            :module="module"
            :active-collection-ids="hashState.collectionIds"
            :is-focused="focusedModuleId === module.id"
            :is-expanded="expandedFeedState?.id === module.id"
            :expanded-width="getModuleExpandedWidth(module)"
            :is-dragging="moduleDnd.draggingIndex.value === idx"
            :is-drag-over="moduleDnd.dragOverIndex.value === idx"
            :feed-search-url-template="effectiveAppearance.feedSearchUrlTemplate"
            :search-highlight="searchHighlight"
            @edit="editingModule = $event; isModuleModalOpen = true"
            @focus="focusModule"
            @set-expand-width="setFeedModuleExpandWidth"
          />
        </div>

        <EmptyState
          v-else
          title="No modules on this page"
          description="Tabs, Notes, and Feeds modules will appear here. Add your first module to get started."
          icon="🧩"
        >
          <template #action>
             <button
              @click="openAddModule"
              class="
                px-2 py-1 text-[11px] font-normal
                bg-white/10 hover:bg-white/15 text-white border border-white/10
                transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40
              "
            >
              + Add Module
            </button>
          </template>
        </EmptyState>
      </div>
      </Transition>
      </div>

    </main>

    <!-- Page CRUD Modal -->
    <Modal
      :show="isPageModalOpen"
      :title="editingPage ? 'Edit Page' : 'New Page'"
      @close="isPageModalOpen = false"
    >
      <PageForm
        :page="editingPage"
        :default-max-width="editingPage ? null : (activePageConfig.maxWidth ?? null)"
        @save="savePage"
        @delete="deletePage"
        @cancel="isPageModalOpen = false"
      />
    </Modal>

    <!-- Copy URL Modal -->
    <Modal
      :show="isUrlModalOpen"
      title="Copy URL"
      @close="isUrlModalOpen = false"
    >
      <div class="space-y-2 px-0.5">
        <p class="text-[11px] text-white/60">
          Paste this URL into a new tab to restore the current page and active tabs.
        </p>
        <input
          readonly
          class="
            w-full px-2 py-1.5 text-[11px] font-mono text-white/90
            bg-white/5 border border-white/15 focus:outline-none
          "
          :value="isUrlModalOpen ? currentUrl : ''"
          @focus="($event.target as HTMLInputElement).select()"
        />
        <div class="flex items-center justify-between gap-2 pt-1">
          <a
            :href="currentUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="text-[11px] text-white/70 hover:text-white underline underline-offset-2"
          >
            Open in a new tab
          </a>
          <div class="flex gap-2">
          <button
            type="button"
            @click="isUrlModalOpen = false"
            class="px-3 py-1 text-[11px] text-white/70 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
          >
            Close
          </button>
          <button
            type="button"
            @click="copyCurrentUrl"
            class="px-3 py-1 text-[11px] text-white bg-white/15 hover:bg-white/25 border border-white/20 transition-colors"
          >
            {{ urlCopied ? '✓ Copied!' : 'Copy' }}
          </button>
          </div>
        </div>
      </div>
    </Modal>

    <!-- Module CRUD Modal -->
    <Modal
      :show="isModuleModalOpen"
      :title="editingModule ? 'Edit Module' : 'New Module'"
      @close="isModuleModalOpen = false"
    >
      <ModuleForm
        v-if="activePage"
        :module="editingModule"
        :page-id="activePage.id!"
        @save="saveModule"
        @delete="deleteModule"
        @cancel="isModuleModalOpen = false"
      />
    </Modal>

    <SidePanel
      :show="isSettingsModalOpen"
      title="Settings"
      @close="closeSettingsPanel"
    >
      <AppSettingsForm
        :background-asset-id="effectiveAppearance.backgroundAssetId"
        :background-theme="effectiveAppearance.backgroundTheme"
        :background-preset="effectiveAppearance.backgroundPreset"
        :open-bookmarks-in-new-tab="effectiveAppearance.openBookmarksInNewTab"
        :feed-search-url-template="effectiveAppearance.feedSearchUrlTemplate"
        :feed-content-scale="effectiveAppearance.feedContentScale"
        :note-content-scale="effectiveAppearance.noteContentScale"
        @preview="handleSettingsPreview"
        @save="handleSaveSettings"
        @cancel="closeSettingsPanel"
      />
    </SidePanel>

    <AssetBrowserModal
      :show="isAssetBrowserOpen"
      @close="isAssetBrowserOpen = false"
    />

    <CleanupModal
      :show="isCleanupModalOpen"
      @close="isCleanupModalOpen = false"
      @completed="handleCleanupCompleted"
    />

    <CaptureInboxModal
      :show="isCaptureInboxOpen"
      :items="captureInboxItems"
      :pages="pages"
      :modules="allModules"
      :collections="allCollections"
      @close="isCaptureInboxOpen = false"
      @save="saveCaptureInboxItem"
      @discard="discardCaptureInboxItem"
    />
  </div>
</template>

<style scoped>
.st-page-stage {
  position: relative;
  min-height: 100%;
  height: 100%;
}

.st-page-panel {
  position: relative;
}

@media (max-width: 740px) {
  .st-modules-grid {
    grid-template-columns: minmax(0, 1fr) !important;
    justify-content: stretch !important;
  }
}

.st-page-fade-enter-active {
  transition: opacity var(--yai-timeout-1) ease;
  will-change: opacity;
}

.st-page-fade-leave-active {
  transition: opacity 0.08s ease;
  position: absolute;
  inset: 0;
  will-change: opacity;
}

.st-page-fade-enter-from,
.st-page-fade-leave-to {
  opacity: 0;
}

.st-page-fade-enter-to,
.st-page-fade-leave-from {
  opacity: 1;
}

.st-page-fade-leave-active {
  position: absolute;
  inset: 0;
}

.st-search-panel {
  background: color-mix(in srgb, var(--st-theme-dropdown-bg) 92%, black 8%);
  border-color: var(--st-theme-border);
  color: var(--st-theme-text);
}

.st-search-panel-header,
.st-search-panel-empty,
.st-search-result-kind,
.st-search-result-path,
.st-search-result-toggle,
.st-search-result-footer,
.st-search-result-matches {
  color: var(--st-theme-text-muted);
}

.st-search-panel-results {
  border-color: var(--st-theme-border);
}

.st-search-result button:hover,
.st-search-result button:focus-visible {
  background: color-mix(in srgb, var(--st-theme-text) 7%, transparent);
}

.st-search-result-title,
.st-search-result-snippet {
  color: var(--st-theme-text);
}

.st-search-result-link {
  color: inherit;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.st-search-result-link:hover {
  color: var(--st-theme-accent);
}

.st-search-result-details {
  border-color: var(--st-theme-border);
  background: color-mix(in srgb, var(--st-theme-module-bg) 88%, transparent);
}

.st-search-result-chip {
  background: color-mix(in srgb, var(--st-theme-text) 9%, transparent);
  color: var(--st-theme-text);
}

.st-search-result-locate {
  color: #fca5a5;
}

.st-search-result-locate:hover {
  background: color-mix(in srgb, #ef4444 18%, transparent);
  color: #fecaca;
}
</style>
