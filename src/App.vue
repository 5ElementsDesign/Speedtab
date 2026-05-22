<script setup lang="ts">
import AppSettingsForm from '@/components/AppSettingsForm.vue'
import CaptureInboxModal from '@/components/CaptureInboxModal.vue'
import EmptyState from '@/components/EmptyState.vue'
import Modal from '@/components/Modal.vue'
import ModuleCard from '@/components/ModuleCard.vue'
import ModuleForm from '@/components/ModuleForm.vue'
import NavBar from '@/components/NavBar.vue'
import PageForm from '@/components/PageForm.vue'
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
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

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

const { data: captureInboxItems } = useLiveQuery(
  () => db.capture_inbox.orderBy('created_at').reverse().toArray(),
  [] as CaptureInboxItem[],
)

// Drag-and-drop bindings for the module grid (one row per module)
const moduleDnd = useDragSort({ onReorder: (f, t) => moveModule(f, t) })

// ─── Page layout config (modules-per-row + max-width) ─────────────────────────

interface PageConfig {
  modulesPerRow?: number      // 1..6, default 3
  maxWidth?:     number | null // px, null = full width
  backgroundAssetId?: number | null
}

type BackgroundTheme = 'charcoal' | 'ocean' | 'moss' | 'ember' | 'sunshine' | 'paper'
type ThemePreset = 'nordic' | 'matrix'

interface ModuleLayoutConfig {
  full_width?: boolean
}

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

const autoFullWidthModuleId = computed<number | null>(() => {
  if (displayedModuleColumns.value !== 2 || !modules.value.length) return null

  const rows: Array<Array<{ id: number; spansFull: boolean }>> = []
  let currentRow: Array<{ id: number; spansFull: boolean }> = []
  let usedSlots = 0

  for (const module of modules.value) {
    if (!module.id) continue
    const spansFull = expandedFeedModuleId.value === module.id || parseModuleLayoutConfig(module).full_width === true

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
  if (expandedFeedModuleId.value === module.id) return 'col-span-full'
  if (parseModuleLayoutConfig(module).full_width) return 'col-span-full'
  return autoFullWidthModuleId.value === module.id ? 'col-span-full' : ''
}

// Sync hash when active page changes
watch(activePage, (page) => {
  expandedFeedModuleId.value = null
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
const expandedFeedModuleId = ref<number | null>(null)

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

function toggleFeedModuleExpand(module: Module) {
  const id = module.id ?? null
  if (id === null || module.type !== 'feeds') return
  expandedFeedModuleId.value = expandedFeedModuleId.value === id ? null : id
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
const isCaptureInboxOpen = ref(false)

const { data: appearanceSetting, loading: appearanceLoading } = useLiveQuery(
  () => db.app_settings.get('appearance'),
  null as AppSetting | null,
)

function parseAppearanceSetting(setting: AppSetting | null | undefined): { backgroundAssetId: number | null; backgroundTheme: BackgroundTheme | null; backgroundPreset: ThemePreset | null; openBookmarksInNewTab: boolean } {
  if (!setting?.value_json) return { backgroundAssetId: null, backgroundTheme: null, backgroundPreset: null, openBookmarksInNewTab: false }
  try {
    const parsed = JSON.parse(setting.value_json)
    return {
      backgroundAssetId: typeof parsed.background_asset_id === 'number' ? parsed.background_asset_id : null,
      backgroundTheme: ['charcoal', 'ocean', 'moss', 'ember', 'sunshine', 'paper'].includes(parsed.background_theme) ? parsed.background_theme as BackgroundTheme : null,
      backgroundPreset: ['nordic', 'matrix'].includes(parsed.background_preset) ? parsed.background_preset as ThemePreset : null,
      openBookmarksInNewTab: parsed.open_bookmarks_in_new_tab === true,
    }
  } catch {
    return { backgroundAssetId: null, backgroundTheme: null, backgroundPreset: null, openBookmarksInNewTab: false }
  }
}

const appAppearance = computed(() => parseAppearanceSetting(appearanceSetting.value))
const effectiveBackgroundAssetId = computed<number | null>(() =>
  activePageConfig.value.backgroundAssetId ?? appAppearance.value.backgroundAssetId ?? null
)
const appBackgroundThemeClass = computed(() =>
  appAppearance.value.backgroundTheme ? `st-bg-theme-${appAppearance.value.backgroundTheme}` : ''
)
const appThemePresetClass = computed(() =>
  appAppearance.value.backgroundPreset ? `theme-${appAppearance.value.backgroundPreset}` : ''
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

watch([effectiveBackgroundAssetId, () => appAppearance.value.backgroundTheme, appearanceLoading, pagesLoading], async ([assetId, backgroundTheme, isAppearanceLoading, isPagesLoading]) => {
  if (isAppearanceLoading || isPagesLoading) return
  if (assetId !== null) return
  if (backgroundTheme) return
  if (defaultBackgroundUrl.value) return
  const mod = await import('@/assets/wallpaper-y-tree.webp')
  defaultBackgroundUrl.value = mod.default
}, { immediate: true })

onUnmounted(() => {
  if (backgroundUrlHandle) URL.revokeObjectURL(backgroundUrlHandle)
})

const appShellStyle = computed(() => {
  const shouldUseDefaultBackground =
    !appearanceLoading.value &&
    !pagesLoading.value &&
    effectiveBackgroundAssetId.value === null &&
    !appAppearance.value.backgroundTheme

  const resolvedBackgroundUrl = shouldUseDefaultBackground
    ? defaultBackgroundUrl.value
    : backgroundObjectUrl.value

  if (!resolvedBackgroundUrl) return {}

  return {
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
  try {
    const report = await cleanupOrphans()
    const total = Object.values(report).reduce((sum, value) => sum + value, 0)
    backupStatus.value = total === 0
      ? 'Cleanup complete · no orphaned records found'
      : `Cleanup complete · removed ${total} orphaned records`
  } catch (err) {
    backupStatus.value = `Cleanup failed: ${(err as Error).message}`
  }
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

async function handleSaveSettings(backgroundAssetId: number | null, backgroundTheme: string | null, backgroundPreset: string | null, openBookmarksInNewTab: boolean) {
  const normalizedTheme = backgroundTheme && ['charcoal', 'ocean', 'moss', 'ember', 'sunshine', 'paper'].includes(backgroundTheme)
    ? backgroundTheme
    : null
  const normalizedPreset = backgroundPreset && ['nordic', 'matrix'].includes(backgroundPreset)
    ? backgroundPreset
    : null
  await db.app_settings.put({
    key: 'appearance',
    value_json: JSON.stringify({
      background_asset_id: backgroundAssetId,
      background_theme: normalizedTheme,
      background_preset: normalizedPreset,
      open_bookmarks_in_new_tab: openBookmarksInNewTab,
    }),
    updated_at: Date.now(),
  })
  isSettingsModalOpen.value = false
}

</script>

<template>
  <div :class="['relative flex flex-col h-screen text-gray-100 overflow-hidden', appBackgroundThemeClass, appThemePresetClass]" :style="appShellStyle">

    <!-- Top navigation bar -->
    <NavBar
      :pages="pages"
      :active-page="activePage"
      :capture-count="captureInboxItems.length"
      @navigate="navigateTo"
      @add-page="openAddPage"
      @edit-page="openEditPage"
      @add-module="openAddModule"
      @move-page="movePage"
      @export-data="handleExport"
      @import-data="triggerImport"
      @cleanup-data="handleCleanup"
      @open-settings="isSettingsModalOpen = true"
      @copy-url="openUrlModal"
      @open-capture-inbox="isCaptureInboxOpen = true"
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
        <div v-if="modulesLoading" class="grid justify-center gap-4" :style="modulesGridStyle">
          <div v-for="i in 3" :key="i" class="h-40 bg-black/40 border border-white/10 animate-pulse"></div>
        </div>

        <div v-else-if="modules.length" class="grid justify-center gap-4" :style="modulesGridStyle">
          <ModuleCard
            v-for="(module, idx) in modules"
            :key="module.id"
            v-bind="moduleDnd.bindFor(idx)"
            :class="moduleGridClass(module)"
            :module="module"
            :active-collection-ids="hashState.collectionIds"
            :is-focused="focusedModuleId === module.id"
            :is-expanded="expandedFeedModuleId === module.id"
            :is-dragging="moduleDnd.draggingIndex.value === idx"
            :is-drag-over="moduleDnd.dragOverIndex.value === idx"
            @edit="editingModule = $event; isModuleModalOpen = true"
            @focus="focusModule"
            @toggle-expand="toggleFeedModuleExpand"
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
        <div class="flex justify-end gap-2 pt-1">
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

    <Modal
      :show="isSettingsModalOpen"
      title="Settings"
      @close="isSettingsModalOpen = false"
    >
      <AppSettingsForm
        :background-asset-id="appAppearance.backgroundAssetId"
        :background-theme="appAppearance.backgroundTheme"
        :background-preset="appAppearance.backgroundPreset"
        :open-bookmarks-in-new-tab="appAppearance.openBookmarksInNewTab"
        @save="handleSaveSettings"
        @cancel="isSettingsModalOpen = false"
      />
    </Modal>

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
</style>
