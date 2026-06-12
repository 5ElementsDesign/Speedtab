<script setup lang="ts">
import AppSettingsForm from '@/components/AppSettingsForm.vue'
import AssetBrowserModal from '@/components/AssetBrowserModal.vue'
import CaptureInboxModal from '@/components/CaptureInboxModal.vue'
import CleanupModal from '@/components/CleanupModal.vue'
import DataExchangeModal from '@/components/DataExchangeModal.vue'
import EmptyState from '@/components/EmptyState.vue'
import Modal from '@/components/Modal.vue'
import ModuleCard from '@/components/ModuleCard.vue'
import ModuleForm from '@/components/ModuleForm.vue'
import NavBar from '@/components/NavBar.vue'
import OpenNotesHost from '@/components/OpenNotesHost.vue'
import PageForm from '@/components/PageForm.vue'
import SidePanel from '@/components/SidePanel.vue'
import ScratchpadPanel from '@/components/ScratchpadPanel.vue'
import WidgetRail from '@/components/WidgetRail.vue'
import { loadAssetObjectUrl } from '@/composables/useAsset'
import {
  BackupValidationError,
  downloadManifest,
  exportAll, importAll,
  LAST_IMPORT_EXPORTED_AT_KEY,
  manifestChecksum,
  readManifestFile,
} from '@/composables/useBackup'
import { useDragSort } from '@/composables/useDragSort'
import {
  clearExportDirty,
  EXPORT_STATE_KEY,
  markExportDirty,
  noteImportedWorkspace,
  parseStoredExportState,
  summarizeExportDirtyReasons,
} from '@/composables/useExportState'
import { useLiveQuery } from '@/composables/useLiveQuery'
import { updateLocalSettings } from '@/composables/useLocalSettings'
import {
  cleanupOrphans,
  deleteModuleTree,
  deletePageTree,
} from '@/composables/useMaintenance'
import {
  computeModuleGridColumn,
  normalizeModuleColumnSpanFromConfig,
  normalizeModuleMinHeightFromConfig,
  type ModuleColumnSpan,
} from '@/composables/useModuleLayout'
import { useReorder } from '@/composables/useReorder'
import {
  DEFAULT_SCRATCHPAD_STATE,
  getScratchpadState,
  SCRATCHPAD_STORAGE_KEY,
  updateScratchpadState,
  type ScratchpadState,
} from '@/composables/useScratchpadLocal'
import { getWeatherWidgetApiKey, setWeatherWidgetApiKey } from '@/composables/useWeatherWidgetLocal'
import { parseWidgetSettings, saveWidgetSettings, WIDGET_SETTINGS_KEY } from '@/composables/useWidgetSettings'
import { db, isActiveRecord, makeCreateMetadata, makeUpdatedAtPatch } from '@/db/db'
import { loadLocaleMessages, resolveSupportedLocale, UI_LANGUAGE_SETTING_KEY, type SupportedLocale } from '@/i18n'
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
import type { WeatherWidgetLocation, WeatherWidgetUnits, WidgetRailAlign, WidgetRailPosition } from '@/types/widgets'
import { computed, onMounted, onUnmounted, ref, watch, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'

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
const showHelpersMenu = ref(false)
const scratchpadState = ref<ScratchpadState>({ ...DEFAULT_SCRATCHPAD_STATE })
const searchHighlight = ref<{
  moduleId: number | null
  collectionId: number | null
  kind: SearchResult['kind']
  entityId: number | null
} | null>(null)
let searchDebounceHandle: number | null = null
let searchHighlightResetHandle: number | null = null
let scratchpadSaveHandle: number | null = null

watch(searchQuery, (value) => {
  if (searchDebounceHandle !== null) window.clearTimeout(searchDebounceHandle)
  searchDebounceHandle = window.setTimeout(() => {
    debouncedSearchQuery.value = value.trim()
  }, 140)
})

onUnmounted(() => {
  if (searchDebounceHandle !== null) window.clearTimeout(searchDebounceHandle)
  if (searchHighlightResetHandle !== null) window.clearTimeout(searchHighlightResetHandle)
  if (scratchpadSaveHandle !== null) window.clearTimeout(scratchpadSaveHandle)
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
      title: item.title || item.source_title || t('app.statuses.archivedFeedItemFallback'),
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
  top: '40px',
  height: '80%',
}))
const { t, locale, availableLocales, setLocaleMessage } = useI18n()

const searchKindLabel = computed<Record<SearchResult['kind'], string>>(() => ({
  bookmark: t('app.searchKinds.bookmark'),
  note: t('app.searchKinds.note'),
  feed_source: t('app.searchKinds.feedSource'),
  archived_feed_item: t('app.searchKinds.archivedFeedItem'),
}))

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

function persistScratchpadPatch(patch: Partial<ScratchpadState>) {
  scratchpadState.value = {
    ...scratchpadState.value,
    ...patch,
  }
  if (scratchpadSaveHandle !== null) window.clearTimeout(scratchpadSaveHandle)
  scratchpadSaveHandle = window.setTimeout(() => {
    scratchpadSaveHandle = null
    void updateScratchpadState(scratchpadState.value).catch(() => {})
  }, 100)
}

async function refreshScratchpadState() {
  try {
    scratchpadState.value = await getScratchpadState()
  } catch {
    scratchpadState.value = { ...DEFAULT_SCRATCHPAD_STATE }
  }
}

async function toggleHelpersMenu() {
  if (!showHelpersMenu.value) {
    await refreshScratchpadState()
  }
  showHelpersMenu.value = !showHelpersMenu.value
}

async function openScratchpad() {
  await refreshScratchpadState()
  showHelpersMenu.value = false
  persistScratchpadPatch({ open: true })
}

function closeScratchpad() {
  persistScratchpadPatch({ open: false })
}

function handleScratchpadStorageChange(
  changes: Record<string, chrome.storage.StorageChange>,
  areaName: string,
) {
  if (areaName !== 'local' || !changes[SCRATCHPAD_STORAGE_KEY]) return
  void refreshScratchpadState()
}

function handleDocumentPointerDown(event: MouseEvent) {
  const target = event.target as HTMLElement | null
  if (!target) return
  if (
    target.closest('.st-search-panel')
    || target.closest('[data-speedtab-search]')
    || target.closest('[data-speedtab-helpers]')
  ) return
  searchPanelVisible.value = false
  showHelpersMenu.value = false
}

watch(captureInboxItems, (items) => {
  document.title = items.length > 0 ? `INBOX [${items.length}] - ${t('app.title')}` : t('app.title')
}, { immediate: true })

onMounted(() => window.addEventListener('mousedown', handleDocumentPointerDown))
onUnmounted(() => window.removeEventListener('mousedown', handleDocumentPointerDown))
onMounted(() => {
  syncViewportLayoutMode()
  window.addEventListener('resize', syncViewportLayoutMode)
})
onUnmounted(() => window.removeEventListener('resize', syncViewportLayoutMode))
onMounted(async () => {
  try {
    localWeatherApiKey.value = (await getWeatherWidgetApiKey()) ?? ''
  } catch {
    localWeatherApiKey.value = ''
  }
})

onMounted(async () => {
  await refreshScratchpadState()
  chrome.storage.onChanged.addListener(handleScratchpadStorageChange)
})
onUnmounted(() => chrome.storage.onChanged.removeListener(handleScratchpadStorageChange))

// Drag-and-drop bindings for the module grid (one row per module)
const moduleDnd = useDragSort({ onReorder: (f, t) => moveModule(f, t) })

// ─── Page layout config (modules-per-row + max-width) ─────────────────────────

interface PageConfig {
  modulesPerRow?: number      // 1..12, default 2
  maxWidth?:     number | null // px, null = full width
  backgroundAssetId?: number | null
}

const PAGE_MAX_WIDTH_MIN = 300
const PAGE_MAX_WIDTH_MAX = 2000

type BackgroundTheme = 'charcoal' | 'ocean' | 'moss' | 'ember' | 'sunshine' | 'light' | 'nordic'
type ThemePreset = string
type AppearanceState = {
  backgroundAssetId: number | null
  backgroundTheme: BackgroundTheme | null
  backgroundPreset: ThemePreset
  backgroundProperties: string | null
  openBookmarksInNewTab: boolean
  feedSearchUrlTemplate: string
  feedContentScale: number
  noteContentScale: number
}
type SettingsState = AppearanceState & {
  uiLanguage: string
  widgetRailEnabled: boolean
  widgetRailPosition: WidgetRailPosition
  widgetRailAlign: WidgetRailAlign
  weatherEnabled: boolean
  weatherUnits: WeatherWidgetUnits
  weatherRefreshIntervalMinutes: number
  weatherDisplayLabel: string
  weatherLocation: WeatherWidgetLocation | null
  weatherApiKey: string
}
type SettingsDraft = SettingsState & {
  backgroundPreviewUrl?: string | null
}
type SettingsDraftInput = {
  backgroundAssetId: number | null
  backgroundTheme: string | null
  backgroundPreset: string
  backgroundProperties: string | null
  uiLanguage: string
  openBookmarksInNewTab: boolean
  feedSearchUrlTemplate: string
  feedContentScale: number
  noteContentScale: number
  widgetRailEnabled: boolean
  widgetRailPosition: WidgetRailPosition
  widgetRailAlign: WidgetRailAlign
  weatherEnabled: boolean
  weatherUnits: WeatherWidgetUnits
  weatherRefreshIntervalMinutes: number
  weatherDisplayLabel: string
  weatherLocation: WeatherWidgetLocation | null
  weatherApiKey: string
  backgroundPreviewUrl?: string | null
}

const CONTENT_SCALE_VALUES = [0.9, 1, 1.2, 1.4, 1.6] as const
const DEFAULT_CONTENT_SCALE = 1.2

function normalizeContentScale(value: unknown): number {
  return typeof value === 'number' && CONTENT_SCALE_VALUES.includes(value as (typeof CONTENT_SCALE_VALUES)[number])
    ? value
    : DEFAULT_CONTENT_SCALE
}

interface ModuleLayoutConfig {
  full_width?: boolean
  column_span?: number | 'full' | null
  min_height_px?: number | null
  expanded_width?: FeedExpandedWidth | null
}

const MODULE_SINGLE_COLUMN_BREAKPOINT = 740

type FeedExpandedWidth = 320 | 480 | 740 | 940 | 1240 | 1540 | 'max'

function parsePageConfig(p: Page | null): PageConfig {
  if (!p?.config_json) return {}
  try {
    const parsed = JSON.parse(p.config_json)
    return {
      modulesPerRow: typeof parsed.modulesPerRow === 'number' ? parsed.modulesPerRow : undefined,
      maxWidth: typeof parsed.maxWidth === 'number'
        ? Math.max(PAGE_MAX_WIDTH_MIN, Math.min(PAGE_MAX_WIDTH_MAX, parsed.maxWidth))
        : null,
      backgroundAssetId: typeof parsed.background_asset_id === 'number' ? parsed.background_asset_id : null,
    } as PageConfig
  } catch { return {} }
}

const activePageConfig = computed<PageConfig>(() => parsePageConfig(activePage.value))
const isNarrowViewport = ref(false)

function syncViewportLayoutMode() {
  isNarrowViewport.value = window.innerWidth <= MODULE_SINGLE_COLUMN_BREAKPOINT
}

const pageContainerStyle = computed(() => {
  if (!activePage.value) {
    return { maxWidth: '1500px' }
  }
  const mw = activePageConfig.value.maxWidth
  return mw && mw > 0 ? { maxWidth: `${mw}px` } : { maxWidth: '100%' }
})

const widgetRailMaxWidth = computed<number | null>(() => {
  if (!activePage.value) return 1500
  return activePageConfig.value.maxWidth ?? null
})

const WIDGET_RAIL_SPACER_HEIGHT = 40
const WIDGET_RAIL_STAGE_OFFSET = 115

const showWidgetRailTop = computed(() =>
  !!activePage.value &&
  effectiveWidgetSettings.value.rail_enabled &&
  effectiveWidgetSettings.value.rail_position === 'top',
)

const showWidgetRailBottom = computed(() =>
  !!activePage.value &&
  effectiveWidgetSettings.value.rail_enabled &&
  effectiveWidgetSettings.value.rail_position === 'bottom',
)

const widgetRailSpacerTop = computed(() => showWidgetRailBottom.value ? WIDGET_RAIL_SPACER_HEIGHT : 0)
const widgetRailSpacerBottom = computed(() => showWidgetRailTop.value ? WIDGET_RAIL_SPACER_HEIGHT : 0)

const pagePanelStyle = computed(() => ({
  ...pageContainerStyle.value,
  '--st-widget-stage-offset': showWidgetRailTop.value || showWidgetRailBottom.value
    ? `${WIDGET_RAIL_STAGE_OFFSET}px`
    : '0px',
}))

const showMobilePageSpacing = computed(() =>
  effectiveWidgetSettings.value.rail_enabled !== true,
)

const displayedModuleColumns = computed(() => {
  return Math.max(1, Math.min(12, activePageConfig.value.modulesPerRow ?? 2))
})

const defaultNewModuleColumnSpan = computed<ModuleColumnSpan>(() => {
  const columns = Math.max(1, Math.min(12, activePageConfig.value.modulesPerRow ?? 2))
  if (columns < 3) return null
  return Math.ceil(columns / 2)
})

const effectiveDisplayedModuleColumns = computed(() =>
  isNarrowViewport.value ? 1 : displayedModuleColumns.value,
)

function parseModuleLayoutConfig(module: Module): ModuleLayoutConfig {
  try { return JSON.parse(module.config_json ?? '{}') as ModuleLayoutConfig }
  catch { return {} }
}

function normalizeModuleColumnSpan(module: Module): ModuleColumnSpan {
  return normalizeModuleColumnSpanFromConfig(module.config_json)
}

function normalizeFeedExpandedWidth(value: unknown): FeedExpandedWidth | null {
  return value === 'max' || value === 320 || value === 480 || value === 740 || value === 940 || value === 1240 || value === 1540
    ? value
    : null
}

const autoFullWidthModuleId = computed<number | null>(() => {
  if (effectiveDisplayedModuleColumns.value !== 2 || !modules.value.length) return null

  const rows: Array<Array<{ id: number; spansFull: boolean }>> = []
  let currentRow: Array<{ id: number; spansFull: boolean }> = []
  let usedSlots = 0

  for (const module of modules.value) {
    if (!module.id) continue
    const spansFull = expandedFeedState.value?.id === module.id || normalizeModuleColumnSpan(module) === 'full'

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
  const cols       = effectiveDisplayedModuleColumns.value

  return { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }
})

function getModuleGridStyle(module: Module): Record<string, string> {
  const minHeight = normalizeModuleMinHeightFromConfig(module.config_json)
  const baseStyle: Record<string, string> = {}
  if (minHeight) {
    baseStyle.minHeight = `${minHeight}px`
  }
  if (effectiveDisplayedModuleColumns.value <= 1) return baseStyle
  if (expandedFeedState.value?.id === module.id) {
    return { ...baseStyle, gridColumn: '1 / -1' }
  }

  const requestedSpan = normalizeModuleColumnSpan(module)
  const gridColumn = computeModuleGridColumn(requestedSpan, effectiveDisplayedModuleColumns.value)
  if (gridColumn) return { ...baseStyle, gridColumn }

  if (autoFullWidthModuleId.value === module.id) return { ...baseStyle, gridColumn: '1 / -1' }
  return baseStyle
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

async function setFeedModuleExpandWidth(module: Module, width: FeedExpandedWidth | null) {
  const id = module.id ?? null
  if (id === null || module.type !== 'feeds') return

  if (width === null) {
    collapseExpandedFeed()
    focusedModuleId.value = id
    return
  }

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
  await markExportDirty('modules:update')

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
    await markExportDirty('pages:update')
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
    await markExportDirty('pages:create')
  }
  isPageModalOpen.value = false
}

async function deletePage(id: number) {
  if (!confirm(t('app.confirms.deletePage'))) return
  await deletePageTree(id)
  await cleanupOrphans()
  await markExportDirty('pages:delete')

  isPageModalOpen.value = false
  // Navigation will automatically fallback to home or first page via activePage computed
}

// ─── Module CRUD ──────────────────────────────────────────────────────────────

const isModuleModalOpen = ref(false)
const editingModule = ref<Module | undefined>(undefined)
const moduleFormType = ref<'tabs' | 'notes' | 'feeds'>('tabs')
const moduleTypeLabels = computed<Record<'tabs' | 'notes' | 'feeds', string>>(() => ({
  tabs: t('app.moduleTypes.tabs'),
  notes: t('app.moduleTypes.notes'),
  feeds: t('app.moduleTypes.feeds'),
}))

watch(editingModule, (module) => {
  if (!module) return
  moduleFormType.value = module.type
})

function openAddModule() {
  editingModule.value = undefined
  moduleFormType.value = 'tabs'
  isModuleModalOpen.value = true
}

async function saveModule(data: PortableInput<Module>) {
  const now = Date.now()
  if (editingModule.value?.id) {
    await db.modules.update(editingModule.value.id, {
      ...data,
      ...makeUpdatedAtPatch(now),
    })
    await markExportDirty('modules:update')
  } else {
    // New module
    const count = await db.modules.where('page_id').equals(data.page_id).filter(isActiveRecord).count()
    data.sort_order = count
    await db.modules.add({
      ...data,
      ...makeCreateMetadata(now),
    })
    await markExportDirty('modules:create')
  }
  isModuleModalOpen.value = false
}

async function deleteModule(id: number) {
  if (!confirm(t('app.confirms.deleteModule'))) return
  await deleteModuleTree(id)
  await cleanupOrphans()
  await markExportDirty('modules:delete')

  isModuleModalOpen.value = false
}

// ─── Copy URL modal ───────────────────────────────────────────────────────────

const isUrlModalOpen = ref(false)
const urlCopied = ref(false)

const currentUrl = computed(() => {
  const hash = window.location.hash || ''
  if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
    return `${chrome.runtime.getURL('src/newtab.html')}${hash}`
  }
  return `${window.location.origin}${window.location.pathname}${hash}`
})

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
let backupStatusResetHandle: number | null = null
const isDataExchangeOpen = ref(false)
const isSettingsModalOpen = ref(false)
const isAssetBrowserOpen = ref(false)
const isCaptureInboxOpen = ref(false)
const isCleanupModalOpen = ref(false)
const isLoadingExampleWorkspace = ref(false)
const hasUnsavedSettingsChanges = ref(false)
const settingsDraft = ref<SettingsDraft | null>(null)
const settingsPanelSessionKey = ref(0)
const localWeatherApiKey = ref('')
const openWidgetConfiguratorInSettings = ref(false)

const { data: appearanceSetting, loading: appearanceLoading } = useLiveQuery(
  () => db.app_settings.get('appearance'),
  null as AppSetting | null,
)
const { data: uiLanguageSetting } = useLiveQuery(
  () => db.app_settings.get(UI_LANGUAGE_SETTING_KEY),
  null as AppSetting | null,
)

const { data: widgetSetting } = useLiveQuery(
  () => db.app_settings.get(WIDGET_SETTINGS_KEY),
  null as AppSetting | null,
)

const { data: exportStateSetting } = useLiveQuery(
  () => db.app_settings.get(EXPORT_STATE_KEY),
  null as AppSetting | null,
)
const exportState = computed(() => parseStoredExportState(exportStateSetting.value?.value_json))
const exportPending = computed<boolean>(() =>
  exportState.value.export_dirty && exportState.value.remote_out_of_date,
)
const exportReasonsSummary = computed<string | null>(() => {
  if (!exportState.value.export_dirty_reasons.length) return null
  return summarizeExportDirtyReasons(exportState.value.export_dirty_reasons)
})

function clearBackupStatus() {
  backupStatus.value = null
  if (backupStatusResetHandle != null) {
    window.clearTimeout(backupStatusResetHandle)
    backupStatusResetHandle = null
  }
}

function setBackupStatus(message: string | null, timeoutMs = 3000) {
  clearBackupStatus()
  if (!message) return
  backupStatus.value = message
  if (timeoutMs <= 0) return
  backupStatusResetHandle = window.setTimeout(() => {
    backupStatus.value = null
    backupStatusResetHandle = null
  }, timeoutMs)
}

function parseAppearanceSetting(setting: AppSetting | null | undefined): AppearanceState {
  if (!setting?.value_json) return { backgroundAssetId: null, backgroundTheme: null, backgroundPreset: DEFAULT_THEME_PRESET, backgroundProperties: null, openBookmarksInNewTab: false, feedSearchUrlTemplate: 'https://www.google.com/search?q=%s', feedContentScale: DEFAULT_CONTENT_SCALE, noteContentScale: DEFAULT_CONTENT_SCALE }
  try {
    const parsed = JSON.parse(setting.value_json)
    return {
      backgroundAssetId: typeof parsed.background_asset_id === 'number' ? parsed.background_asset_id : null,
      backgroundTheme: ['charcoal', 'ocean', 'moss', 'ember', 'sunshine', 'light', 'nordic'].includes(parsed.background_theme) ? parsed.background_theme as BackgroundTheme : null,
      backgroundPreset: normalizeThemePreset(parsed.background_preset),
      backgroundProperties: typeof parsed.background_properties === 'string' && parsed.background_properties.trim() ? parsed.background_properties.trim() : null,
      openBookmarksInNewTab: parsed.open_bookmarks_in_new_tab === true,
      feedSearchUrlTemplate: typeof parsed.feed_search_url_template === 'string' && parsed.feed_search_url_template.trim()
        ? parsed.feed_search_url_template.trim()
        : 'https://www.google.com/search?q=%s',
      feedContentScale: normalizeContentScale(parsed.feed_content_scale),
      noteContentScale: normalizeContentScale(parsed.note_content_scale),
    }
  } catch {
    return { backgroundAssetId: null, backgroundTheme: null, backgroundPreset: DEFAULT_THEME_PRESET, backgroundProperties: null, openBookmarksInNewTab: false, feedSearchUrlTemplate: 'https://www.google.com/search?q=%s', feedContentScale: DEFAULT_CONTENT_SCALE, noteContentScale: DEFAULT_CONTENT_SCALE }
  }
}

const appAppearance = computed(() => parseAppearanceSetting(appearanceSetting.value))
const appWidgetSettings = computed(() => parseWidgetSettings(widgetSetting.value?.value_json))
const savedUiLanguage = computed(() => {
  try {
    return uiLanguageSetting.value?.value_json
      ? resolveSupportedLocale(JSON.parse(uiLanguageSetting.value.value_json))
      : resolveSupportedLocale(locale.value)
  } catch {
    return resolveSupportedLocale(locale.value)
  }
})
const appSettingsState = computed<SettingsState>(() => ({
  ...appAppearance.value,
  uiLanguage: savedUiLanguage.value,
  widgetRailEnabled: appWidgetSettings.value.rail_enabled,
  widgetRailPosition: appWidgetSettings.value.rail_position,
  widgetRailAlign: appWidgetSettings.value.rail_align,
  weatherEnabled: appWidgetSettings.value.weather.enabled,
  weatherUnits: appWidgetSettings.value.weather.units,
  weatherRefreshIntervalMinutes: appWidgetSettings.value.weather.refresh_interval_minutes,
  weatherDisplayLabel: appWidgetSettings.value.weather.display_label ?? '',
  weatherLocation: appWidgetSettings.value.weather.location,
  weatherApiKey: localWeatherApiKey.value,
}))
const effectiveSettings = computed<SettingsDraft>(() => settingsDraft.value ?? {
  ...appSettingsState.value,
  backgroundPreviewUrl: null,
})
const effectiveAppearance = computed<AppearanceState>(() => ({
  backgroundAssetId: effectiveSettings.value.backgroundAssetId,
  backgroundTheme: effectiveSettings.value.backgroundTheme,
  backgroundPreset: effectiveSettings.value.backgroundPreset,
  backgroundProperties: effectiveSettings.value.backgroundProperties,
  openBookmarksInNewTab: effectiveSettings.value.openBookmarksInNewTab,
  feedSearchUrlTemplate: effectiveSettings.value.feedSearchUrlTemplate,
  feedContentScale: effectiveSettings.value.feedContentScale,
  noteContentScale: effectiveSettings.value.noteContentScale,
}))
const effectiveBackgroundAssetId = computed<number | null>(() =>
  activePageConfig.value.backgroundAssetId ?? effectiveAppearance.value.backgroundAssetId ?? null
)
const effectiveWidgetSettings = computed(() => ({
  rail_enabled: effectiveSettings.value.widgetRailEnabled,
  rail_position: effectiveSettings.value.widgetRailPosition,
  rail_align: effectiveSettings.value.widgetRailAlign,
  weather: {
    enabled: effectiveSettings.value.weatherEnabled,
    provider: 'open_meteo' as const,
    units: effectiveSettings.value.weatherUnits,
    refresh_interval_minutes: effectiveSettings.value.weatherRefreshIntervalMinutes,
    display_label: effectiveSettings.value.weatherDisplayLabel.trim() || null,
    location: effectiveSettings.value.weatherLocation,
  },
}))

let localeSwitchVersion = 0
watch(() => effectiveSettings.value.uiLanguage, async (value) => {
  const targetLocale = resolveSupportedLocale(value)
  const currentVersion = ++localeSwitchVersion

  if (!availableLocales.includes(targetLocale)) {
    setLocaleMessage(targetLocale, await loadLocaleMessages(targetLocale))
  }
  if (currentVersion !== localeSwitchVersion) return

  locale.value = targetLocale
}, { immediate: true })
const appBackgroundThemeClass = computed(() => {
  if (effectiveAppearance.value.backgroundProperties) return ''
  return effectiveAppearance.value.backgroundTheme ? `st-bg-theme-${effectiveAppearance.value.backgroundTheme}` : ''
})
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
  if (backupStatusResetHandle != null) {
    window.clearTimeout(backupStatusResetHandle)
    backupStatusResetHandle = null
  }
})

watchEffect(() => {
  const rootStyle = document.documentElement.style
  rootStyle.setProperty('--st-feed-content-scale', String(effectiveAppearance.value.feedContentScale))
  rootStyle.setProperty('--st-note-content-scale', String(effectiveAppearance.value.noteContentScale))
  rootStyle.setProperty('--st-active-page-max-width', String(activePageConfig.value.maxWidth ?? 1500))
})

const appShellStyle = computed(() => {
  const hasCustomProperties = !!effectiveAppearance.value.backgroundProperties

  const shouldUseDefaultBackground =
    !appearanceLoading.value &&
    !pagesLoading.value &&
    !settingsDraft.value?.backgroundPreviewUrl &&
    effectiveBackgroundAssetId.value === null &&
    !effectiveAppearance.value.backgroundTheme &&
    !hasCustomProperties

  const resolvedBackgroundUrl = shouldUseDefaultBackground
    ? defaultBackgroundUrl.value
    : (settingsDraft.value?.backgroundPreviewUrl ?? backgroundObjectUrl.value)

  const style: Record<string, string> = {
    '--st-feed-content-scale': String(effectiveAppearance.value.feedContentScale),
    '--st-note-content-scale': String(effectiveAppearance.value.noteContentScale),
  }

  if (resolvedBackgroundUrl) {
    return {
      ...style,
      backgroundImage: `url("${resolvedBackgroundUrl}")`,
      backgroundPosition: 'center center',
      backgroundRepeat: 'no-repeat',
      backgroundSize: 'cover',
      backgroundAttachment: 'fixed',
    }
  }

  if (hasCustomProperties) {
    return {
      ...style,
      background: effectiveAppearance.value.backgroundProperties!,
    }
  }

  return style
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
    summary.push(t('app.statuses.importLegacyBackup'))
  } else {
    summary.push(t('app.statuses.importBackup'))
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
    const checksum = await manifestChecksum(manifest)
    await downloadManifest(manifest)
    await clearExportDirty({
      checksum,
      exportedAt: manifest.exported_at,
      manifestVersion: manifest.version,
    })
    setBackupStatus(t('app.statuses.exportSuccess', {
      pages: manifest.pages.length,
      archived: manifest.saved_feed_items.length,
      assets: manifest.assets.length,
    }))
  } catch (err) {
    setBackupStatus(t('app.statuses.exportFailed', { message: (err as Error).message }), 5000)
  }
}

async function loadExampleWorkspace() {
  if (isLoadingExampleWorkspace.value || pages.value.length) return
  isLoadingExampleWorkspace.value = true
  clearBackupStatus()
  try {
    const { seedExampleWorkspace } = await import('@/composables/useExampleWorkspace')
    await seedExampleWorkspace(db, { locale: locale.value })
    for (const reason of ['pages:create', 'modules:create', 'collections:create', 'tabs:create', 'notes:create', 'feed_sources:create']) {
      await markExportDirty(reason)
    }
    await new Promise((resolve) => window.setTimeout(resolve, 180))
    setBackupStatus(t('app.statuses.exampleWorkspaceLoaded'))
  } catch (err) {
    setBackupStatus(t('app.statuses.exampleWorkspaceFailed', { message: (err as Error).message }), 5000)
  } finally {
    isLoadingExampleWorkspace.value = false
  }
}

function triggerImport() { importInput.value?.click() }

function openDataExchange() {
  isDataExchangeOpen.value = true
}

async function handleImportFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    const manifest = await readManifestFile(file)
    const warnings: string[] = []

    if (manifest.version === 1) {
      warnings.push(t('app.confirms.legacyBackupWarning'))
    } else {
      const lastImportSetting = await db.app_settings.get(LAST_IMPORT_EXPORTED_AT_KEY)
      const lastImportedAt = readTimestampSetting(lastImportSetting)
      const incomingExportedAt = Date.parse(manifest.exported_at)
      if (lastImportedAt != null && Number.isFinite(incomingExportedAt) && incomingExportedAt < lastImportedAt) {
        warnings.push(t('app.confirms.olderBackupWarning'))
      }
    }

    const confirmMessage = [
      t('app.confirms.importWorkspace', {
        pages: manifest.pages.length,
        modules: manifest.modules.length,
        assets: manifest.assets.length,
      }),
      manifest.version === 1
        ? t('app.confirms.importLegacyMode')
        : t('app.confirms.importIdentityMode'),
      ...warnings,
    ].join('\n\n')

    if (!confirm(confirmMessage)) {
      return
    }
    const report = await importAll(manifest)
    const cleanup = await cleanupOrphans()
    const cleaned = Object.values(cleanup).reduce((sum, value) => sum + value, 0)
    await noteImportedWorkspace('import:local')
    await updateLocalSettings({
      last_known_local_checksum: null,
      last_remote_seen_checksum: null,
      last_remote_seen_exported_at: null,
      last_remote_source_device: null,
    })
    setBackupStatus(formatImportReport(report, cleaned), 5000)
  } catch (err) {
    setBackupStatus(err instanceof BackupValidationError
      ? t('app.statuses.invalidBackup', { message: err.message })
      : t('app.statuses.importFailed', { message: (err as Error).message }), 5000)
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
  const parts: string[] = [t('app.statuses.cleanupComplete')]
  parts.push(total === 0
    ? t('app.statuses.cleanupNothingRemoved')
    : t('app.statuses.cleanupRemoved', { count: total }))
  if (refreshedFavicons > 0) {
    parts.push(t('app.statuses.cleanupRefreshedFavicons', { count: refreshedFavicons }))
  }
  if (total > 0) {
    void markExportDirty('cleanup:workspace')
  }
  setBackupStatus(parts.join(' · '))
}

async function saveCaptureInboxItem(item: CaptureInboxItem, collectionId: number, appendToNoteId: number | null = null) {
  const now = Date.now()
  const metaJson = JSON.stringify({
    capture_source_url: item.source_url,
    capture_source_title: item.source_title,
    capture_hash: item.external_hash,
  })

  if (item.kind === 'note') {
    if (appendToNoteId) {
      const existing = await db.notes.get(appendToNoteId)
      if (existing) {
        if (existing.type === 'crypt') {
          throw new Error(t('app.statuses.encryptedAppendTargetError'))
        }
        const sourceLine = item.source_title || item.source_url
        const appendedParts = [existing.content]
        if (sourceLine) {
          appendedParts.push(`\n\n---\n\n${t('app.statuses.capturedFrom', { source: sourceLine })}`)
        } else {
          appendedParts.push('\n\n---')
        }
        if (item.source_url) {
          appendedParts.push(`\n${item.source_url}`)
        }
        if (item.text) {
          appendedParts.push(`\n\n${item.text}`)
        }

        await db.notes.update(appendToNoteId, {
          content: appendedParts.join(''),
          meta_json: metaJson,
          ...makeUpdatedAtPatch(now),
        })
        await markExportDirty('notes:update')
      }
    } else {
      const sortOrder = await db.notes.where('collection_id').equals(collectionId).filter(isActiveRecord).count()
      const note: Note = {
        collection_id: collectionId,
        title: item.title || t('app.statuses.capturedNoteTitle'),
        type: 'text',
        content: item.text || '',
        style_token: null,
        sort_order: sortOrder,
        meta_json: metaJson,
        ...makeCreateMetadata(now),
      }
      await db.notes.add(note)
      await markExportDirty('notes:create')
    }
  } else {
    const sortOrder = await db.tabs.where('collection_id').equals(collectionId).filter(isActiveRecord).count()
    const tab: Tab = {
      collection_id: collectionId,
      title: item.title || item.url || t('app.statuses.capturedBookmarkTitle'),
      url: item.url || '',
      description: item.text || item.source_title || null,
      favicon_asset_id: null,
      preview_asset_id: null,
      sort_order: sortOrder,
      meta_json: metaJson,
      ...makeCreateMetadata(now),
    }
    await db.tabs.add(tab)
    await markExportDirty('tabs:create')
  }

  if (item.id != null) {
    await db.capture_inbox.delete(item.id)
  }

  setBackupStatus(item.kind === 'note'
    ? (appendToNoteId ? t('app.statuses.capturedNoteAppended') : t('app.statuses.capturedNoteSaved'))
    : t('app.statuses.capturedBookmarkSaved'))

  if (captureInboxItems.value.length <= 1) {
    isCaptureInboxOpen.value = false
  }
}

async function discardCaptureInboxItem(itemId: number) {
  await db.capture_inbox.delete(itemId)
  setBackupStatus(t('app.statuses.capturedItemDiscarded'))
  if (captureInboxItems.value.length <= 1) {
    isCaptureInboxOpen.value = false
  }
}

function openSettingsPanel(section: 'general' | 'widgets' = 'general') {
  settingsPanelSessionKey.value += 1
  settingsDraft.value = {
    ...appSettingsState.value,
    backgroundPreviewUrl: null,
  }
  hasUnsavedSettingsChanges.value = false
  openWidgetConfiguratorInSettings.value = section === 'widgets'
  isSettingsModalOpen.value = true
}

function closeSettingsPanel() {
  settingsDraft.value = null
  hasUnsavedSettingsChanges.value = false
  isSettingsModalOpen.value = false
  openWidgetConfiguratorInSettings.value = false
}

function handleSettingsPreview(draft: SettingsDraftInput) {
  settingsDraft.value = {
    backgroundAssetId: draft.backgroundAssetId,
    backgroundTheme: draft.backgroundTheme && ['charcoal', 'ocean', 'moss', 'ember', 'sunshine', 'light', 'nordic'].includes(draft.backgroundTheme)
      ? draft.backgroundTheme as BackgroundTheme
      : null,
    backgroundPreset: normalizeThemePreset(draft.backgroundPreset),
    backgroundProperties: typeof draft.backgroundProperties === 'string' && draft.backgroundProperties.trim() ? draft.backgroundProperties.trim() : null,
    uiLanguage: resolveSupportedLocale(draft.uiLanguage),
    openBookmarksInNewTab: draft.openBookmarksInNewTab,
    feedSearchUrlTemplate: draft.feedSearchUrlTemplate.trim() || 'https://www.google.com/search?q=%s',
    feedContentScale: normalizeContentScale(draft.feedContentScale),
    noteContentScale: normalizeContentScale(draft.noteContentScale),
    widgetRailEnabled: draft.widgetRailEnabled === true,
    widgetRailPosition: draft.widgetRailPosition === 'bottom' ? 'bottom' : 'top',
    widgetRailAlign: draft.widgetRailAlign === 'center' || draft.widgetRailAlign === 'right' ? draft.widgetRailAlign : 'left',
    weatherEnabled: draft.weatherEnabled === true,
    weatherUnits: draft.weatherUnits === 'imperial' ? 'imperial' : 'metric',
    weatherRefreshIntervalMinutes: [10, 15, 30, 60, 120, 360].includes(draft.weatherRefreshIntervalMinutes)
      ? draft.weatherRefreshIntervalMinutes
      : 30,
    weatherDisplayLabel: draft.weatherDisplayLabel.trim(),
    weatherLocation: draft.weatherLocation,
    weatherApiKey: draft.weatherApiKey.trim(),
    backgroundPreviewUrl: draft.backgroundPreviewUrl ?? null,
  }
}

function handleSettingsDirtyChange(dirty: boolean) {
  hasUnsavedSettingsChanges.value = dirty
}

async function handleSaveSettings(draft: SettingsDraftInput) {
  const normalizedTheme = draft.backgroundTheme && ['charcoal', 'ocean', 'moss', 'ember', 'sunshine', 'light', 'nordic'].includes(draft.backgroundTheme)
    ? draft.backgroundTheme
    : null
  const normalizedPreset = normalizeThemePreset(draft.backgroundPreset)
  const normalizedSearchTemplate = draft.feedSearchUrlTemplate.trim() || 'https://www.google.com/search?q=%s'
  const normalizedLanguage = resolveSupportedLocale(draft.uiLanguage)
  const updatedAt = Date.now()
  await Promise.all([
    db.app_settings.put({
      key: 'appearance',
      value_json: JSON.stringify({
        background_asset_id: draft.backgroundAssetId,
        background_theme: normalizedTheme,
        background_preset: normalizedPreset,
        background_properties: typeof draft.backgroundProperties === 'string' && draft.backgroundProperties.trim() ? draft.backgroundProperties.trim() : null,
        open_bookmarks_in_new_tab: draft.openBookmarksInNewTab,
        feed_search_url_template: normalizedSearchTemplate,
        feed_content_scale: normalizeContentScale(draft.feedContentScale),
        note_content_scale: normalizeContentScale(draft.noteContentScale),
      }),
      updated_at: updatedAt,
    }),
    db.app_settings.put({
      key: UI_LANGUAGE_SETTING_KEY,
      value_json: JSON.stringify(normalizedLanguage),
      updated_at: updatedAt,
    }),
    saveWidgetSettings({
      rail_enabled: draft.widgetRailEnabled === true,
      rail_position: draft.widgetRailPosition === 'bottom' ? 'bottom' : 'top',
      rail_align: draft.widgetRailAlign === 'center' || draft.widgetRailAlign === 'right' ? draft.widgetRailAlign : 'left',
      weather: {
        enabled: draft.weatherEnabled === true,
        provider: 'open_meteo',
        units: draft.weatherUnits === 'imperial' ? 'imperial' : 'metric',
        refresh_interval_minutes: [10, 15, 30, 60, 120, 360].includes(draft.weatherRefreshIntervalMinutes)
          ? draft.weatherRefreshIntervalMinutes
          : 30,
        display_label: draft.weatherDisplayLabel.trim() || null,
        location: draft.weatherLocation,
      },
    }),
    setWeatherWidgetApiKey(draft.weatherApiKey.trim() || null),
  ])
  locale.value = normalizedLanguage
  localWeatherApiKey.value = draft.weatherApiKey.trim()
  hasUnsavedSettingsChanges.value = false
  closeSettingsPanel()
}

async function saveOnboardingLanguage(language: SupportedLocale) {
  const normalizedLanguage = resolveSupportedLocale(language)
  await db.app_settings.put({
    key: UI_LANGUAGE_SETTING_KEY,
    value_json: JSON.stringify(normalizedLanguage),
    updated_at: Date.now(),
  })
  locale.value = normalizedLanguage
}

</script>

<template>
  <div :class="['relative flex flex-col h-screen text-gray-100 overflow-hidden', appBackgroundThemeClass, appThemePresetClass]" :style="appShellStyle">

    <!-- Top navigation bar -->
    <NavBar
      :pages="pages"
      :active-page="activePage"
      :capture-count="captureInboxItems.length"
      :export-pending="exportPending"
      :export-reminder-label="exportReasonsSummary"
      :search-open="searchOpen"
      :search-query="searchQuery"
      @navigate="navigateTo"
      @add-page="openAddPage"
      @edit-page="openEditPage"
      @add-module="openAddModule"
      @move-page="movePage"
      @open-data-exchange="openDataExchange"
      @cleanup-data="handleCleanup"
      @open-settings="openSettingsPanel"
      @open-assets="isAssetBrowserOpen = true"
      @copy-url="openUrlModal"
      @open-capture-inbox="isCaptureInboxOpen = true"
      @update-search-open="searchOpen = $event"
      @update-search-query="searchQuery = $event"
      @search-focus="handleSearchFocus"
      @toggle-helpers="toggleHelpersMenu"
    />

    <div
      v-if="showHelpersMenu"
      data-speedtab-helpers
      class="st-helpers-menu absolute left-2 top-11 z-[65] w-[220px] border px-3 py-3 shadow-2xl backdrop-blur-sm"
    >
      <p class="text-[10px] uppercase tracking-[0.18em] text-white/55">{{ t('scratchpad.helpersTitle') }}</p>
      <p class="mt-2 text-[11px] leading-5 text-white/70">{{ t('scratchpad.helpersDescription') }}</p>
      <button
        type="button"
        class="mt-3 w-full border px-3 py-2 text-left text-[11px] text-white/85 transition-colors hover:bg-white/5 hover:text-white"
        @click="openScratchpad"
      >
        {{ scratchpadState.open ? t('scratchpad.openAction') : t('scratchpad.startAction') }}
      </button>
    </div>

    <DataExchangeModal
      :show="isDataExchangeOpen"
      @close="isDataExchangeOpen = false"
      @download-export="handleExport"
      @import-local-file="triggerImport"
    />

    <!-- Hidden import file picker -->
    <input
      ref="importInput"
      id="workspace-import-file"
      name="workspace_import_file"
      type="file"
      accept="application/json,.json"
      class="hidden"
      aria-hidden="true"
      @change="handleImportFile"
    />

    <!-- Toast-style status notification for backup operations -->
    <div
      v-if="backupStatus"
      class="st-status-bar absolute left-1/2 top-[55px] z-40 w-[300px] max-w-[calc(100%-1rem)] -translate-x-1/2 overflow-auto"
      role="status"
    >
      <span class="st-status-bar-message">{{ backupStatus }}</span>
      <button
        @click="clearBackupStatus"
        class="st-status-bar-dismiss"
        :aria-label="t('app.dismiss')"
      >✕</button>
    </div>

    <section
      v-if="showSearchPanel"
      class="st-search-panel absolute left-1/2 z-50 flex w-[min(1000px,calc(100%-1rem))] -translate-x-1/2 flex-col overflow-hidden border shadow-2xl backdrop-blur-sm"
      :style="searchPanelStyle"
      :aria-label="t('app.searchAria')"
    >
      <div class="st-search-panel-header border-b px-3 py-2 text-[10px] uppercase tracking-wider">
        <template v-if="debouncedSearchQuery">
          {{ t('app.searchResults', { count: searchResults.length, query: debouncedSearchQuery }) }}
        </template>
        <template v-else>
          {{ t('app.searchPrompt') }}
        </template>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto">
        <div
          v-if="!debouncedSearchQuery"
          class="st-search-panel-empty px-4 py-5 text-[11px]"
        >
          {{ t('app.searchHint') }}
        </div>

        <div
          v-else-if="!searchResults.length"
          class="st-search-panel-empty px-4 py-5 text-[11px]"
        >
          {{ t('app.noMatches') }}
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
                  <p class="st-search-result-path truncate text-[10px]">{{ result.path || t('app.workspace') }}</p>
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
                  <span>{{ t('app.matched') }}</span>
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
                    {{ result.path || t('app.workspaceRoot') }}
                  </p>
                  <button
                    v-if="result.pageSlug"
                    type="button"
                    class="st-search-result-locate px-2 py-1 text-[10px] uppercase tracking-wider transition-colors"
                    @click.stop="navigateToSearchResult(result)"
                  >
                    {{ t('app.locate') }}
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
      class="fixed inset-0 z-50 bg-black/85 backdrop-blur-[2px]"
      @click="collapseExpandedFeed"
    ></div>

    <!-- Main content area -->
    <main class="st-main-content flex flex-1 min-h-0 flex-col overflow-y-auto">
      <!-- ① Boot / loading skeleton -->
      <div
        v-if="loading"
        class="flex items-center justify-center h-full"
      >
        <span class="text-xs text-gray-600 animate-pulse tracking-widest uppercase">
          {{ t('common.loading') }}
        </span>
      </div>

      <!-- ② No pages at all -->
      <EmptyState
        v-else-if="!pages.length"
        :title="t('app.noPagesTitle')"
        :description="t('app.noPagesDescription')"
      >
        <template #action>
          <div class="flex flex-wrap items-center justify-center gap-2">
            <button
              @click="openAddPage"
              class="
                px-2 py-1 text-[11px] font-normal
                bg-white/10 hover:bg-white/15 text-white border border-white/10
                transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40
              "
            >
              {{ t('app.newPage') }}
            </button>
            <button
              @click="loadExampleWorkspace"
              :disabled="isLoadingExampleWorkspace"
              class="
                px-2 py-1 text-[11px] font-normal
                bg-white/10 hover:bg-white/15 text-white border border-white/10
                transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40
                disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-white/10
              "
            >
              {{ isLoadingExampleWorkspace ? t('app.quickStartLoading') : t('app.quickStart') }}
            </button>
          </div>
        </template>
        <template #after>
          <div class="text-left">
            <p class="text-[11px] text-white/65">
              {{ t('app.onboardingLanguageDescription') }}
            </p>
            <div class="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                @click="saveOnboardingLanguage('en')"
                class="px-2 py-1 text-[11px] font-normal border transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
                :class="locale === 'en'
                  ? 'bg-white/15 text-white border-white/20'
                  : 'bg-white/5 hover:bg-white/10 text-white/85 border-white/10'"
              >
                {{ t('settings.language.english') }}
              </button>
              <button
                type="button"
                @click="saveOnboardingLanguage('de')"
                class="px-2 py-1 text-[11px] font-normal border transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
                :class="locale === 'de'
                  ? 'bg-white/15 text-white border-white/20'
                  : 'bg-white/5 hover:bg-white/10 text-white/85 border-white/10'"
              >
                {{ t('settings.language.german') }}
              </button>
            </div>
          </div>
        </template>
      </EmptyState>

      <!-- ③ Active page – modules grid (centered, max-width applied from page config) -->
      <div v-else-if="activePage" class="st-page-stage">
      <Transition name="st-page-fade" mode="out-in" appear>
      <div
        :key="activePage.id"
        class="st-page-panel w-full mx-auto flex flex-col justify-[safe_center]"
        :class="{ 'st-page-panel-mobile-spaced': showMobilePageSpacing }"
        :style="pagePanelStyle"
      >
        <div
          v-if="widgetRailSpacerTop > 0"
          class="st-widget-rail-spacer st-widget-rail-spacer-top"
          :style="{ height: `${widgetRailSpacerTop}px` }"
          aria-hidden="true"
        ></div>

        <div
          v-if="showWidgetRailTop"
          class="st-widget-rail-flow st-widget-rail-flow-top"
        >
          <WidgetRail
            :settings="effectiveWidgetSettings"
            :max-width="widgetRailMaxWidth"
            @configure="openSettingsPanel('widgets')"
          />
        </div>

        <div class="st-modules-stage" :class="{ 'st-modules-stage-mobile-spaced': showMobilePageSpacing }">
          <!-- Modules Grid -->
          <div v-if="modulesLoading" class="st-modules-grid grid w-full justify-center gap-4" :style="modulesGridStyle">
            <div v-for="i in 3" :key="i" class="h-40 bg-black/40 border border-white/10 animate-pulse"></div>
          </div>

          <div v-else-if="modules.length" class="st-modules-grid grid w-full justify-center gap-4" :style="modulesGridStyle">
            <ModuleCard
              v-for="(module, idx) in modules"
              :key="module.id"
              v-bind="moduleDnd.bindFor(idx)"
              :style="getModuleGridStyle(module)"
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
            :title="t('app.noModulesTitle')"
            :description="t('app.noModulesDescription')"
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
                {{ t('app.addModule') }}
              </button>
            </template>
          </EmptyState>
        </div>

        <div
          v-if="widgetRailSpacerBottom > 0"
          class="st-widget-rail-spacer st-widget-rail-spacer-bottom"
          :style="{ height: `${widgetRailSpacerBottom}px` }"
          aria-hidden="true"
        ></div>

        <div
          v-if="showWidgetRailBottom"
          class="st-widget-rail-flow st-widget-rail-flow-bottom flex justify-between items-center"
        >
          <WidgetRail
            :settings="effectiveWidgetSettings"
            :max-width="widgetRailMaxWidth"
            @configure="openSettingsPanel('widgets')"
          />

        </div>
      </div>
      </Transition>
      </div>

    </main>

    <!-- Page CRUD Modal -->
    <Modal
      :show="isPageModalOpen"
      :title="editingPage ? t('app.editPage') : t('app.newPageTitle')"
      @close="isPageModalOpen = false"
    >
      <PageForm
        :page="editingPage"
        :default-max-width="editingPage ? null : (activePage?.id ? (activePageConfig.maxWidth ?? null) : 1500)"
        @save="savePage"
        @delete="deletePage"
        @cancel="isPageModalOpen = false"
      />
    </Modal>

    <!-- Copy URL Modal -->
    <Modal
      :show="isUrlModalOpen"
      :title="t('app.copyUrlTitle')"
      @close="isUrlModalOpen = false"
    >
      <div class="space-y-2 px-0.5">
        <p class="text-[11px] text-white/60">
          {{ t('app.copyUrlDescription') }}
        </p>
        <input
          id="copy-url-input"
          name="copy_url"
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
            {{ t('app.openInNewTab') }}
          </a>
          <div class="flex gap-2">
          <button
            type="button"
            @click="isUrlModalOpen = false"
            class="px-3 py-1 text-[11px] text-white/70 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
          >
            {{ t('common.close') }}
          </button>
          <button
            type="button"
            @click="copyCurrentUrl"
            class="px-3 py-1 text-[11px] text-white bg-white/15 hover:bg-white/25 border border-white/20 transition-colors"
          >
            {{ urlCopied ? t('app.copied') : t('common.copy') }}
          </button>
          </div>
        </div>
      </div>
    </Modal>

    <!-- Module CRUD Modal -->
    <Modal
      :show="isModuleModalOpen"
      :title="editingModule ? t('app.editModule') : t('app.newModule')"
      @close="isModuleModalOpen = false"
    >
      <template #header-meta>
        <span class="uppercase tracking-wider mr-1">{{ t('moduleForm.type') }}</span>
        <span class="st-text-bold">{{ moduleTypeLabels[moduleFormType] }}</span>
      </template>
      <ModuleForm
        v-if="activePage"
        :module="editingModule"
        :page-id="activePage.id!"
        :default-column-span="editingModule ? undefined : defaultNewModuleColumnSpan"
        @save="saveModule"
        @delete="deleteModule"
        @cancel="isModuleModalOpen = false"
        @type-change="moduleFormType = $event"
      />
    </Modal>

    <SidePanel
      :show="isSettingsModalOpen"
      :title="t('app.settingsTitle')"
      :lock-backdrop-close="hasUnsavedSettingsChanges"
      @close="closeSettingsPanel"
    >
      <AppSettingsForm
        :key="settingsPanelSessionKey"
        :background-asset-id="appSettingsState.backgroundAssetId"
        :background-theme="appSettingsState.backgroundTheme"
        :background-preset="appSettingsState.backgroundPreset"
        :background-properties="appSettingsState.backgroundProperties"
        :ui-language="appSettingsState.uiLanguage"
        :open-bookmarks-in-new-tab="appSettingsState.openBookmarksInNewTab"
        :feed-search-url-template="appSettingsState.feedSearchUrlTemplate"
        :feed-content-scale="appSettingsState.feedContentScale"
        :note-content-scale="appSettingsState.noteContentScale"
        :widget-rail-enabled="appSettingsState.widgetRailEnabled"
        :widget-rail-position="appSettingsState.widgetRailPosition"
        :widget-rail-align="appSettingsState.widgetRailAlign"
        :weather-enabled="appSettingsState.weatherEnabled"
        :weather-units="appSettingsState.weatherUnits"
        :weather-refresh-interval-minutes="appSettingsState.weatherRefreshIntervalMinutes"
        :weather-display-label="appSettingsState.weatherDisplayLabel"
        :weather-location="appSettingsState.weatherLocation"
        :weather-api-key="appSettingsState.weatherApiKey"
        :open-widget-configurator="openWidgetConfiguratorInSettings"
        @dirty-change="handleSettingsDirtyChange"
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
      :notes="allNotes"
      @close="isCaptureInboxOpen = false"
      @save="saveCaptureInboxItem"
      @discard="discardCaptureInboxItem"
    />

    <ScratchpadPanel
      v-if="scratchpadState.open"
      :state="scratchpadState"
      @close="closeScratchpad"
      @refresh="refreshScratchpadState"
      @update="persistScratchpadPatch"
    />

    <OpenNotesHost />
  </div>
</template>

<style scoped>
.st-helpers-menu {
  background: color-mix(in srgb, var(--st-theme-dropdown-bg) 94%, black 6%);
  border-color: var(--st-theme-border);
  color: var(--st-theme-text);
}

.st-helpers-menu button {
  border-color: var(--st-theme-border);
  background: color-mix(in srgb, var(--st-theme-module-bg) 84%, transparent);
}

.st-main-content {
  position: relative;
}

.st-widget-rail-flow {
  position: relative;
  z-index: 1;
}

.st-widget-rail-spacer {
  flex: 0 0 auto;
}

.st-widget-rail-spacer-top {
  width: 100%;
}

.st-widget-rail-spacer-bottom {
  width: 100%;
}

.st-page-stage {
  position: relative;
  display: flex;
  flex: 1 1 auto;
  min-height: auto;
  max-width: 96%;
  width: 100%;
  margin: 0 auto;
}

.st-page-panel {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
}

.st-page-panel-mobile-spaced {
  padding-top: 2rem;
}

.st-modules-stage {
  height: calc(100% + var(--st-widget-stage-offset, 0px));
  display: flex;
  align-items: safe center;
  width: 100%;
}

.st-modules-stage-mobile-spaced {
  padding-bottom: 2rem;
}

@media (max-width: 740px) {
  .st-modules-stage {
    height: unset;
  }
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
