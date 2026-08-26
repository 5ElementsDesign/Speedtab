import {
  BackupValidationError,
  LAST_IMPORT_EXPORTED_AT_KEY,
  buildExportFilename,
  downloadManifest,
  exportAll,
  importAll,
  manifestChecksum,
  parseManifestText,
  readManifestFile,
} from '../composables/useBackup.ts'
import {clearExportDirty, getExportState, noteImportedWorkspace} from '../composables/useExportState.ts'
import {clearRemoteProviderSettings, getLocalSettings, updateLocalSettings} from '../composables/useLocalSettings.ts'
import {cleanupOrphans, getCleanupCandidates} from '../composables/useMaintenance.ts'
import {
  getRemoteAutoSyncUiStatus,
} from '../composables/remoteAutoSyncStatus.ts'
import {requestRemoteAutoSyncRefresh} from '../composables/remoteAutoSyncProtocol.ts'
import {
  downloadRemoteExportArtifact,
  inspectRemotePush,
  previewRemotePull,
  pullFromRemote,
  pushToRemote,
  verifyRemoteHealth,
} from '../composables/useRemoteExchange.ts'
import {createRemoteExportProvider, isRemoteProviderConfigured} from '../composables/useRemoteProvider.ts'
import {getWidgetSettings, saveWidgetSettings} from '../composables/useWidgetSettings.ts'
import {db, isActiveRecord} from '../db/db.ts'
import YaiWorker from '../lib/yai/worker/yai-worker.js'
import {YEH} from '../lib/yai/yeh.js'
import '../next/styles/foundation.css'
import {loadAndApplyDocumentTheme} from '../next/utils/document-theme.js'
import {initI18n, t} from '../next/utils/i18n.js'
import {applyWorkspaceBackground} from '../next/utils/workspace-background.js'
import {DEFAULT_REMOTE_LOCAL_SETTINGS} from '../types/remote.ts'
import deepCleanupWorkerUrl from './deep-cleanup-worker.js?url'
import {renderImportExportApp} from './render.js'
import {createImportExportState} from './state.js'
import './styles.css'

const state = createImportExportState()

function revokeDeepCheckAssetUrls() {
  const groups = state.deepCheckReport?.groups ?? []
  for (const group of groups) {
    for (const row of group.rows ?? []) {
      if (row.previewUrl) {
        URL.revokeObjectURL(row.previewUrl)
      }
    }
  }
}

function getMount() {
  return document.querySelector('#app')
}

function setRootBooleanDataFlag(name, value) {
  const mount = getMount()
  if (!(mount instanceof HTMLElement)) return
  mount.dataset[name] = value ? 'true' : 'false'
}

function syncImportExportRootFlags() {
  const hasProviderSet = !!(state.remoteDraft?.remote_provider_type || state.remoteSettings?.remote_provider_type)
  setRootBooleanDataFlag('hasProviderSet', hasProviderSet)
}

function patchImportExportRegions(mount, html, regionNames = null) {
  const template = document.createElement('template')
  template.innerHTML = html.trim()

  const nextApp = template.content.querySelector('[data-ie-app]')
  const currentApp = mount.querySelector('[data-ie-app]')
  if (!(nextApp instanceof HTMLElement) || !(currentApp instanceof HTMLElement)) {
    mount.innerHTML = html
    return
  }

  const nextRegions = new Map(
    Array.from(nextApp.querySelectorAll('[data-ie-region]')).map((node) => [node.getAttribute('data-ie-region'), node]),
  )

  const allowedRegions = Array.isArray(regionNames) && regionNames.length
    ? new Set(regionNames)
    : null

  const nextOrder = Array.from(nextApp.querySelectorAll('[data-ie-region]'))
    .map((node) => node.getAttribute('data-ie-region'))
    .filter(Boolean)

  const targetRegionNames = allowedRegions
    ? nextOrder.filter((name) => allowedRegions.has(name))
    : nextOrder

  for (const regionName of targetRegionNames) {
    const nextRegion = nextRegions.get(regionName)
    if (!regionName || !(nextRegion instanceof HTMLElement)) continue

    const currentRegion = currentApp.querySelector(`[data-ie-region="${CSS.escape(regionName)}"]`)
    if (currentRegion instanceof HTMLElement) {
      currentRegion.replaceWith(nextRegion.cloneNode(true))
      continue
    }

    const nextIndex = nextOrder.indexOf(regionName)
    const followingRegionName = nextOrder
      .slice(nextIndex + 1)
      .find((name) => !allowedRegions || allowedRegions.has(name))

    if (followingRegionName) {
      const followingCurrentRegion = currentApp.querySelector(`[data-ie-region="${CSS.escape(followingRegionName)}"]`)
      if (followingCurrentRegion instanceof HTMLElement) {
        followingCurrentRegion.before(nextRegion.cloneNode(true))
        continue
      }
    }

    currentApp.append(nextRegion.cloneNode(true))
  }

  if (allowedRegions) {
    for (const currentRegion of Array.from(currentApp.querySelectorAll('[data-ie-region]'))) {
      const regionName = currentRegion.getAttribute('data-ie-region')
      if (!regionName || !allowedRegions.has(regionName)) continue
      if (nextRegions.has(regionName)) continue
      currentRegion.remove()
    }
  }
}

function render(regions = null) {
  const mount = getMount()
  if (!mount) return
  const scrollX = globalThis.scrollX || 0
  const scrollY = globalThis.scrollY || 0
  state.remoteConfigValidationMessage = getRemoteConfigValidationMessage()
  const html = renderImportExportApp(state)
  if (mount.querySelector('[data-ie-app]')) {
    patchImportExportRegions(mount, html, regions)
  } else {
    mount.innerHTML = html
  }
  syncImportExportRootFlags()
  globalThis.requestAnimationFrame?.(() => {
    globalThis.scrollTo(scrollX, scrollY)
  })
}

async function applyPageBackground() {
  const mount = getMount()
  if (!(mount instanceof HTMLElement)) return
  await applyWorkspaceBackground(mount)
}

function setStatus(text = '', tone = 'idle', details = '', area = '') {
  state.status = {text, tone, details, area}
}

function setTransfer(active = false, label = '', area = '') {
  state.transfer = {active, label, area}
}

function isImmediateRemotePreferenceField(name = '') {
  return name === 'remote_auto_sync_enabled' ||
    name === 'remote_auto_sync_interval_minutes' ||
    name === 'remote_archive_keep_latest_count'
}

async function persistImmediateRemotePreference(name, value) {
  if (!isImmediateRemotePreferenceField(name)) return
  try {
    state.remoteSettings = await updateLocalSettings({
      [name]: value,
    })
    await requestRemoteAutoSyncRefresh()
  } catch {
    // Ignore background persistence failures here; the explicit save path still validates and reports.
  }
}

function dismissUiNode(target) {
  const selector = target?.dataset?.dismissClosest?.trim?.() || ''
  const clearKey = target?.dataset?.dismissClear?.trim?.() || ''
  const node = selector
    ? target.closest?.(selector)
    : target.parentElement

  if (clearKey === 'status') {
    state.status = {text: '', tone: 'idle', details: '', area: ''}
    render(['global', 'local', 'remote-config', 'remote-sync', 'deep-check', 'reset'])
    return
  }

  if (clearKey === 'transfer') {
    state.transfer = {active: false, label: '', area: ''}
    render(['global', 'local', 'remote-config', 'remote-sync', 'deep-check', 'reset'])
    return
  }

  if (clearKey === 'deep-check-clean') {
    state.deepCheckCleanDismissed = true
    render(['deep-check'])
    return
  }

  if (node instanceof HTMLElement) {
    node.remove()
  }
}

function updateRemoteAutoSyncState(compareState = null) {
  state.remoteAutoSync = getRemoteAutoSyncUiStatus(
    state.remoteDraft ?? state.remoteSettings ?? DEFAULT_REMOTE_LOCAL_SETTINGS,
    state.exportState,
    compareState,
  )
}

function clearChromeLocalStorage() {
  return new Promise((resolve, reject) => {
    const area = globalThis.chrome?.storage?.local
    if (!area?.clear) {
      resolve()
      return
    }

    area.clear(() => {
      const error = globalThis.chrome?.runtime?.lastError
      if (error) {
        reject(new Error(error.message))
        return
      }
      resolve()
    })
  })
}

function remoteIdentityChanged(nextDraft, currentSettings) {
  if (!currentSettings) return true
  return nextDraft.remote_provider_type !== currentSettings.remote_provider_type ||
    nextDraft.remote_endpoint_url !== currentSettings.remote_endpoint_url ||
    nextDraft.remote_path !== currentSettings.remote_path
}

function clearRemoteBookkeepingPatch() {
  return {
    last_remote_pull_checksum: null,
    last_remote_pull_exported_at: null,
    last_remote_push_checksum: null,
    last_remote_push_exported_at: null,
    last_remote_provider_id: null,
    last_remote_source_device: null,
    last_remote_seen_checksum: null,
    last_remote_seen_exported_at: null,
    last_known_local_checksum: null,
  }
}

function clearRemoteBaselinePatch() {
  return {
    last_remote_pull_checksum: null,
    last_remote_pull_exported_at: null,
    last_remote_push_checksum: null,
    last_remote_push_exported_at: null,
    last_remote_provider_id: null,
    last_remote_source_device: null,
    last_remote_seen_checksum: null,
    last_remote_seen_exported_at: null,
    last_known_local_checksum: null,
  }
}

async function readSummary() {
  const [
    pages,
    modules,
    collections,
    tabs,
    notes,
    todos,
    feedSources,
    savedFeedItems,
    assets,
  ] = await Promise.all([
    db.pages.filter(isActiveRecord).count(),
    db.modules.filter(isActiveRecord).count(),
    db.collections.filter(isActiveRecord).count(),
    db.tabs.filter(isActiveRecord).count(),
    db.notes.filter(isActiveRecord).count(),
    db.todos.filter(isActiveRecord).count(),
    db.feed_sources.filter(isActiveRecord).count(),
    db.saved_feed_items.filter(isActiveRecord).count(),
    db.assets.count(),
  ])

  return {
    pages,
    modules,
    collections,
    tabs,
    notes,
    todos,
    feedSources,
    savedFeedItems,
    assets,
  }
}

async function hydrate() {
  state.loading = true
  state.error = ''
  revokeDeepCheckAssetUrls()
  state.deepCheckReport = null
  state.deepCheckSelectedUnusedAssetIds = []
  state.deepCheckCleanDismissed = false
  state.exportState = await getExportState(db)
  state.localSummary = await readSummary()
  state.widgetSettings = await getWidgetSettings(db)
  state.remoteSettings = await getLocalSettings()
  state.remoteDraft = {...state.remoteSettings}
  state.remoteArchiveKeepLatest = state.remoteSettings.remote_archive_keep_latest_count ?? 10
  state.remoteArchives = []
  updateRemoteAutoSyncState()
  state.loading = false
  await applyPageBackground()
}

function readTimestampSetting(setting) {
  if (!setting?.value_json) return null
  try {
    const parsed = JSON.parse(setting.value_json)
    const timestamp = Date.parse(parsed)
    return Number.isFinite(timestamp) ? timestamp : null
  } catch {
    return null
  }
}

function formatImportReport(report, cleanupCount) {
  const parts = []

  if (report.manifest_version === 1) {
    parts.push(t('dataExchange.status.importedLegacyBackup'))
    parts.push(t('dataExchange.report.pages', {count: report.pages}))
    parts.push(t('dataExchange.report.modules', {count: report.modules}))
    parts.push(t('dataExchange.report.tabs', {count: report.tabs}))
    parts.push(t('dataExchange.report.notes', {count: report.notes}))
    parts.push(t('dataExchange.report.archived', {count: report.saved_feed_items}))
    parts.push(t('dataExchange.report.assets', {count: report.assets}))
  } else {
    const inserted =
      (report.pages_inserted ?? 0) +
      (report.modules_inserted ?? 0) +
      (report.collections_inserted ?? 0) +
      (report.tabs_inserted ?? 0) +
      (report.notes_inserted ?? 0) +
      (report.todos_inserted ?? 0) +
      (report.feed_sources_inserted ?? 0) +
      (report.saved_feed_items_inserted ?? 0)
    const updated =
      (report.pages_updated ?? 0) +
      (report.modules_updated ?? 0) +
      (report.collections_updated ?? 0) +
      (report.tabs_updated ?? 0) +
      (report.notes_updated ?? 0) +
      (report.todos_updated ?? 0) +
      (report.feed_sources_updated ?? 0) +
      (report.saved_feed_items_updated ?? 0)

    parts.push(t('dataExchange.status.importedRemoteWorkspace'))
    if (inserted) parts.push(t('dataExchange.report.inserted', {count: inserted}))
    if (updated) parts.push(t('dataExchange.report.updated', {count: updated}))
    if (report.newer_local_skipped) parts.push(t('dataExchange.report.keptLocal', {count: report.newer_local_skipped}))
    if (report.orphans_skipped) parts.push(t('dataExchange.report.orphans', {count: report.orphans_skipped}))
    if (report.assets) parts.push(t('dataExchange.report.assets', {count: report.assets}))
    if (report.assets_deduped) parts.push(t('dataExchange.report.assetsReused', {count: report.assets_deduped}))
  }

  if (cleanupCount > 0) parts.push(t('dataExchange.report.cleanup', {count: cleanupCount}))
  if (report.legacy_warning) parts.push(t('dataExchange.report.legacyFormat'))
  return parts.join(' · ')
}

function validateRemoteEndpointUrl(value) {
  const trimmed = value?.trim()
  if (!trimmed) return t('dataExchange.status.endpointRequired')

  try {
    const url = new URL(trimmed)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return t('dataExchange.status.endpointMustStartHttp')
    }
    return null
  } catch {
    return t('dataExchange.status.endpointMustBeValid')
  }
}

function validateOptionalHttpUrl(value, label) {
  const trimmed = value?.trim()
  if (!trimmed) return null
  try {
    const url = new URL(trimmed)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return label === 'Dashboard URL'
        ? t('dataExchange.status.dashboardMustStartHttp')
        : `${label} must start with http:// or https://.`
    }
    return null
  } catch {
    return label === 'Dashboard URL'
      ? t('dataExchange.status.dashboardMustBeValid')
      : `${label} must be a valid http:// or https:// URL.`
  }
}

function normalizeDraftBoolean(target) {
  return target.checked === true
}

function normalizeDraftNumber(target) {
  const value = Number(target.value)
  if (!Number.isFinite(value) || value < 1) return null
  return Math.trunc(value)
}

function formatDateTime(timestamp) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(timestamp)
}

function assetKindLabel(kind) {
  const labels = {
    background: t('cleanup.assetKinds.background'),
    preview: t('cleanup.assetKinds.preview'),
    speed_dial: t('cleanup.assetKinds.speedDial'),
    note_image: t('cleanup.assetKinds.noteImage'),
    favicon: t('cleanup.assetKinds.favicon'),
  }
  return labels[kind] || kind || t('dataExchange.unknownValue')
}

function compactText(value, fallback = '—', maxLength = 96) {
  const text = String(value ?? '').trim()
  if (!text) return fallback
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text
}

function stripMarkup(value) {
  return String(value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/{{asset:image:\d+}}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildDeepCheckPreview(candidates) {
  const groups = [
    {
      key: 'modules',
      label: t('maintenance.orphanModules'),
      rows: candidates.modules.map((row) => ({
        id: row.id,
        title: compactText(row.title, t('cleanup.untitledModule')),
        meta: `page_id:${row.page_id} · id:${row.id}`,
      })),
    },
    {
      key: 'collections',
      label: t('maintenance.orphanCollections'),
      rows: candidates.collections.map((row) => ({
        id: row.id,
        title: compactText(row.title, t('cleanup.untitledCollection')),
        meta: `module_id:${row.module_id} · id:${row.id}`,
      })),
    },
    {
      key: 'tabs',
      label: t('maintenance.orphanTabs'),
      rows: candidates.tabs.map((row) => ({
        id: row.id,
        title: compactText(row.title || row.url, t('cleanup.bookmarks')),
        meta: `collection_id:${row.collection_id} · id:${row.id}`,
        preview: compactText(row.description || row.url, row.url || '—', 140),
      })),
    },
    {
      key: 'notes',
      label: t('maintenance.orphanNotes'),
      rows: candidates.notes.map((row) => ({
        id: row.id,
        title: compactText(row.title || row.content, t('cleanup.untitledNote')),
        meta: `collection_id:${row.collection_id} · ${row.type} · id:${row.id}`,
        preview: compactText(
          row.type === 'crypt'
            ? t('notes.encrypted')
            : stripMarkup(row.content),
          '—',
          180,
        ),
      })),
    },
    {
      key: 'todos',
      label: t('todo.moduleType'),
      rows: candidates.todos.map((row) => ({
        id: row.id,
        title: compactText(row.title, t('todo.untitled')),
        meta: `collection_id:${row.collection_id} · id:${row.id}`,
      })),
    },
    {
      key: 'feedSources',
      label: t('maintenance.orphanFeedSources'),
      rows: candidates.feedSources.map((row) => ({
        id: row.id,
        title: compactText(row.title || row.feed_url || row.site_url, t('feeds.feedSourcesAria')),
        meta: `collection_id:${row.collection_id} · id:${row.id}`,
      })),
    },
    {
      key: 'feedItems',
      label: t('maintenance.orphanFeedItems'),
      rows: candidates.feedItems.map((row) => ({
        id: row.id,
        title: compactText(row.title || row.url, t('cleanup.untitledFeedItem')),
        meta: `feed_source_id:${row.feed_source_id} · id:${row.id}`,
      })),
    },
    {
      key: 'savedFeedItems',
      label: t('maintenance.orphanSavedItems'),
      rows: candidates.savedFeedItems.map((row) => ({
        id: row.id,
        title: compactText(row.title || row.url, t('cleanup.untitledArchivedItem')),
        meta: `collection_id:${row.collection_id} · id:${row.id}`,
      })),
    },
    {
      key: 'unusedAssets',
      label: t('cleanup.unusedAssets'),
      rows: candidates.unusedAssets.map((row) => ({
        id: row.id,
        kind: row.kind,
        title: compactText(row.name || assetKindLabel(row.kind), assetKindLabel(row.kind)),
        meta: `${assetKindLabel(row.kind)} · id:${row.id}${row.checksum ? ` · ${row.checksum.slice(0, 12)}` : ''}`,
        previewUrl: row.blob ? URL.createObjectURL(row.blob) : '',
        checkbox: true,
      })),
    },
  ]

  return {
    groups: groups.filter((group) => group.rows.length > 0),
    unusedAssetIds: candidates.unusedAssets
      .filter((row) => row.kind !== 'background')
      .map((row) => row.id)
      .filter((id) => typeof id === 'number'),
  }
}

async function buildDeepCleanupSnapshot() {
  const [
    pages,
    modules,
    collections,
    tabs,
    notes,
    todos,
    feedSources,
    feedItems,
    savedFeedItems,
    assets,
    appSettings,
  ] = await Promise.all([
    db.pages.filter(isActiveRecord).toArray(),
    db.modules.filter(isActiveRecord).toArray(),
    db.collections.filter(isActiveRecord).toArray(),
    db.tabs.filter(isActiveRecord).toArray(),
    db.notes.filter(isActiveRecord).toArray(),
    db.todos.filter(isActiveRecord).toArray(),
    db.feed_sources.filter(isActiveRecord).toArray(),
    db.feed_items.toArray(),
    db.saved_feed_items.filter(isActiveRecord).toArray(),
    db.assets.toArray(),
    db.app_settings.toArray(),
  ])

  return {
    pages: pages.map((row) => ({id: row.id, config_json: row.config_json ?? null})),
    modules: modules.map((row) => ({id: row.id, page_id: row.page_id})),
    collections: collections.map((row) => ({id: row.id, module_id: row.module_id})),
    tabs: tabs.map((row) => ({
      id: row.id,
      collection_id: row.collection_id,
      url: row.url ?? '',
      favicon_asset_id: row.favicon_asset_id ?? null,
      preview_asset_id: row.preview_asset_id ?? null,
    })),
    notes: notes.map((row) => ({
      id: row.id,
      collection_id: row.collection_id,
      type: row.type ?? 'text',
      content: row.content ?? '',
    })),
    todos: todos.map((row) => ({id: row.id, collection_id: row.collection_id})),
    feedSources: feedSources.map((row) => ({
      id: row.id,
      collection_id: row.collection_id,
      feed_url: row.feed_url ?? '',
      site_url: row.site_url ?? '',
    })),
    feedItems: feedItems.map((row) => ({
      id: row.id,
      feed_source_id: row.feed_source_id,
      url: row.url ?? '',
    })),
    savedFeedItems: savedFeedItems.map((row) => ({
      id: row.id,
      collection_id: row.collection_id,
    })),
    assets: assets.map((row) => ({
      id: row.id,
      kind: row.kind ?? '',
      meta_json: row.meta_json ?? null,
    })),
    appSettings: appSettings.map((row) => ({
      key: row.key,
      value_json: row.value_json ?? null,
    })),
  }
}

function getRemoteConfigValidationMessage() {
  const draft = state.remoteDraft ?? {}
  if (!draft.remote_provider_type) return t('dataExchange.status.selectProvider')
  if (draft.remote_provider_type === 'gdrive') {
    if (!draft.device_label?.trim()) return t('dataExchange.status.deviceLabelRequired')
    return null
  }
  const endpointValidation = validateRemoteEndpointUrl(draft.remote_endpoint_url)
  if (endpointValidation) return endpointValidation
  const dashboardValidation = validateOptionalHttpUrl(draft.remote_dashboard_url, 'Dashboard URL')
  if (dashboardValidation) return dashboardValidation
  if (!draft.remote_username?.trim()) return t('dataExchange.status.usernameRequired')
  if (!draft.remote_secret?.trim()) return t('dataExchange.status.secretRequired')
  if (!draft.remote_path?.trim()) return t('dataExchange.status.remotePathRequired')
  if (!draft.device_label?.trim()) return t('dataExchange.status.deviceLabelRequired')
  return null
}

function getRemoteCompareStatusMessage(compareState, remoteHealth) {
  if (compareState === 'remote_missing') {
    return {
      message: t('dataExchange.status.remoteMissing'),
      guidance: t('dataExchange.status.remoteMissingGuidance'),
    }
  }

  if (compareState === 'identical' || compareState === 'up_to_date') {
    return {
      message: t('dataExchange.status.remoteAlreadyMatchesLocal'),
      guidance: '',
    }
  }

  return {
    message: remoteHealth?.message || t('dataExchange.status.remoteHealthy'),
    guidance: remoteHealth?.guidance || '',
  }
}

async function refreshRemoteCompare() {
  if (!state.remoteSettings || !isRemoteProviderConfigured(state.remoteSettings)) {
    setStatus(t('dataExchange.status.providerNotConfigured'), 'error', '', 'remote-sync')
    render()
    return
  }

  state.busy.remoteCheck = true
  state.remoteWarnings = []
  state.remotePullPreview = null
  state.remotePreviewSummary = null
  setTransfer(true, t('dataExchange.status.verifyingRemoteCompare'), 'remote-sync')
  render()
  try {
    const provider = await createRemoteExportProvider(state.remoteSettings)
    state.compareInspection = await inspectRemotePush({provider})
    state.remoteHealth = await verifyRemoteHealth({provider})
    const archives = await provider.listArchives()
    state.remoteArchives = archives.ok ? archives.value : []
    updateRemoteAutoSyncState(state.compareInspection?.state ?? null)
    state.remoteWarnings = [
      ...(state.compareInspection?.warnings ?? []),
      ...(state.remoteHealth?.warnings ?? []),
      ...(!archives.ok ? [archives.error.message] : []),
    ]
    const nextStatus = getRemoteCompareStatusMessage(state.compareInspection?.state ?? null, state.remoteHealth)
    state.remoteActivity = nextStatus.message
    setStatus(nextStatus.message, 'success', nextStatus.guidance, 'remote-sync')
  } catch (error) {
    setStatus(t('dataExchange.status.remoteCheckFailed', {message: error instanceof Error ? error.message : String(error)}), 'error', '', 'remote-sync')
  } finally {
    state.busy.remoteCheck = false
    setTransfer(false, '', 'remote-sync')
    render()
  }
}

async function previewRemoteContents() {
  if (!state.remoteSettings || !isRemoteProviderConfigured(state.remoteSettings)) {
    setStatus(t('dataExchange.status.configureToEnablePull'), 'error', '', 'remote-sync')
    render()
    return
  }

  state.busy.remotePreview = true
  state.remoteWarnings = []
  state.remotePreviewSummary = null
  setTransfer(true, t('dataExchange.status.checkingRemoteContents'), 'remote-sync')
  render()
  try {
    const provider = await createRemoteExportProvider(state.remoteSettings)
    const preview = await previewRemotePull({provider})
    state.remotePullPreview = preview
    state.remoteWarnings = [...(preview?.warnings ?? [])]

    if (!['remote_missing', 'not_configured'].includes(preview.state)) {
      const exportResult = await provider.downloadExport()
      if (!exportResult.ok) throw new Error(exportResult.error.message)
      const manifest = parseManifestText(await exportResult.value.text())
      let assetCount = manifest.assets.length

      if (preview.remoteMeta?.payload_mode === 'split' && assetCount === 0) {
        const assetsResult = await provider.downloadAssets()
        if (!assetsResult.ok && assetsResult.error.code !== 'file_missing') {
          throw new Error(assetsResult.error.message)
        }
        if (assetsResult.ok) {
          const assetsPayload = JSON.parse(await assetsResult.value.text())
          assetCount = Array.isArray(assetsPayload?.assets) ? assetsPayload.assets.length : 0
        }
      }

      state.remotePreviewSummary = {
        pages: manifest.pages.length,
        modules: manifest.modules.length,
        collections: manifest.collections.length,
        tabs: manifest.tabs.length,
        notes: manifest.notes.length,
        todos: manifest.todos?.length ?? 0,
        feedSources: manifest.feed_sources.length,
        savedFeedItems: manifest.saved_feed_items.length,
        assets: assetCount,
        exportedAt: manifest.exported_at,
        checksum: preview.remoteMeta?.workspace_checksum ?? null,
        packageLabel: preview.remoteMeta?.payload_mode === 'split'
          ? t('dataExchange.remotePackageSplit')
          : t('dataExchange.remotePackageSingle'),
      }
    }

    state.remoteActivity = t('dataExchange.checkRemoteContents')
    const previewState = preview?.state ?? null
    if (previewState === 'up_to_date') {
      setStatus(t('dataExchange.status.remoteAlreadyMatchesLocal'), 'success', '', 'remote-sync')
    } else if (previewState === 'remote_missing') {
      setStatus(t('dataExchange.status.remoteMissing'), 'error', '', 'remote-sync')
    } else if (previewState === 'not_configured') {
      setStatus(t('dataExchange.status.providerNotConfigured'), 'error', '', 'remote-sync')
    } else {
      setStatus(t('dataExchange.status.remoteExportReady'), 'success', '', 'remote-sync')
    }
  } catch (error) {
    setStatus(t('dataExchange.status.remoteCheckFailed', {message: error instanceof Error ? error.message : String(error)}), 'error', '', 'remote-sync')
  } finally {
    state.busy.remotePreview = false
    setTransfer(false, '', 'remote-sync')
    render()
  }
}

async function handleDownloadLocalExport() {
  state.busy.localExport = true
  setTransfer(true, t('dataExchange.downloading'), 'local')
  render()
  try {
    const manifest = await exportAll()
    const checksum = await manifestChecksum(manifest)
    await downloadManifest(manifest)
    await clearExportDirty({
      checksum,
      exportedAt: manifest.exported_at,
      manifestVersion: manifest.version,
    }, db)
    await hydrate()
    setStatus(t('app.statuses.exportSuccess', {
      pages: manifest.pages.length,
      archived: manifest.saved_feed_items.length,
      assets: manifest.assets.length,
    }), 'success', '', 'local')
  } catch (error) {
    setStatus(t('app.statuses.exportFailed', {message: error instanceof Error ? error.message : String(error)}), 'error', '', 'local')
  } finally {
    state.busy.localExport = false
    setTransfer(false, '', 'local')
    render()
  }
}

function triggerLocalImport() {
  document.getElementById('workspace_import_file')?.click()
}

async function handleImportFile(file) {
  if (!file) return
  state.busy.localImport = true
  setTransfer(true, t('dataExchange.working'), 'local')
  render()

  try {
    const manifest = await readManifestFile(file)
    const warnings = []

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

    if (!window.confirm(confirmMessage)) {
      setStatus(t('common.cancel'), 'idle', '', 'local')
      return
    }

    const report = await importAll(manifest, {}, db)
    const cleanup = await cleanupOrphans(db)
    const cleaned = Object.values(cleanup).reduce((sum, value) => sum + value, 0)
    await noteImportedWorkspace('import:local', db)
    await updateLocalSettings({
      last_known_local_checksum: null,
      last_remote_seen_checksum: null,
      last_remote_seen_exported_at: null,
      last_remote_source_device: null,
    })
    await hydrate()
    setStatus(formatImportReport(report, cleaned), 'success', '', 'local')
  } catch (error) {
    const message = error instanceof BackupValidationError
      ? t('app.statuses.invalidBackup', {message: error.message})
      : t('app.statuses.importFailed', {message: error instanceof Error ? error.message : String(error)})
    setStatus(message, 'error', '', 'local')
  } finally {
    state.busy.localImport = false
    setTransfer(false, '', 'local')
    const fileInput = document.getElementById('workspace_import_file')
    if (fileInput) fileInput.value = ''
    render()
  }
}

async function runDeepOrphanCheck() {
  state.busy.deepCheck = true
  state.deepCheckCleanDismissed = false
  setTransfer(true, t('dataExchange.working'), 'deep-check')
  render()

  try {
    revokeDeepCheckAssetUrls()
    const snapshot = await buildDeepCleanupSnapshot()
    const [result, candidates] = await Promise.all([
      YaiWorker.run(null, snapshot, {workerUrl: deepCleanupWorkerUrl}),
      getCleanupCandidates(db),
    ])
    const preview = buildDeepCheckPreview(candidates)
    state.deepCheckReport = {
      ...result,
      checkedAt: formatDateTime(Date.now()),
      groups: preview.groups,
      unusedAssetIds: preview.unusedAssetIds,
    }
    state.deepCheckSelectedUnusedAssetIds = [...preview.unusedAssetIds]
    if (result.total > 0) {
      setStatus(
        t('dataExchange.deepCheckFound', {count: result.total}),
        'error',
        '',
        'deep-check',
      )
    } else {
      state.status = {text: '', tone: 'idle', details: '', area: ''}
    }
  } catch (error) {
    setStatus(t('dataExchange.status.remoteCheckFailed', {message: error instanceof Error ? error.message : String(error)}), 'error', '', 'deep-check')
  } finally {
    state.busy.deepCheck = false
    setTransfer(false, '', 'deep-check')
    render()
  }
}

async function deleteUnusedAssetsFromDeepCheck() {
  const assetIds = state.deepCheckSelectedUnusedAssetIds ?? []
  if (!assetIds.length) return
  if (!window.confirm(t('dataExchange.confirmDeleteUnusedAssets', {count: assetIds.length}))) return

  state.busy.deepCheck = true
  setTransfer(true, t('dataExchange.working'), 'deep-check')
  render()

  try {
    await db.assets.bulkDelete(assetIds)
    await runDeepOrphanCheck()
    setStatus(t('dataExchange.unusedAssetsDeleted', {count: assetIds.length}), 'success', '', 'deep-check')
  } catch (error) {
    setStatus(t('dataExchange.status.remoteCheckFailed', {message: error instanceof Error ? error.message : String(error)}), 'error', '', 'deep-check')
  } finally {
    state.busy.deepCheck = false
    setTransfer(false, '', 'deep-check')
    render()
  }
}

async function resetImportExportDatabase() {
  if (state.busy.resetDatabase) return
  if (!window.confirm(t('cleanup.confirmReset'))) return

  state.busy.resetDatabase = true
  setTransfer(true, t('cleanup.resetting'), 'reset')
  render()

  try {
    revokeDeepCheckAssetUrls()
    db.close()
    await db.delete()
    await clearChromeLocalStorage()
    window.location.reload()
  } finally {
    state.busy.resetDatabase = false
    setTransfer(false, '', 'reset')
  }
}

async function saveRemoteConfig() {
  const validationMessage = getRemoteConfigValidationMessage()
  if (validationMessage) {
    setStatus(validationMessage, 'error', '', 'remote-config')
    render()
    return
  }

  state.busy.remoteConfig = true
  setTransfer(true, t('dataExchange.working'), 'remote-config')
  render()
  try {
    const patch = {
      remote_provider_type: state.remoteDraft.remote_provider_type,
      remote_endpoint_url: state.remoteDraft.remote_provider_type === 'webdav'
        ? state.remoteDraft.remote_endpoint_url?.trim() || null
        : null,
      remote_username: state.remoteDraft.remote_provider_type === 'webdav'
        ? state.remoteDraft.remote_username?.trim() || null
        : null,
      remote_secret: state.remoteDraft.remote_provider_type === 'webdav'
        ? state.remoteDraft.remote_secret?.trim() || null
        : null,
      remote_path: state.remoteDraft.remote_provider_type === 'webdav'
        ? state.remoteDraft.remote_path?.trim() || null
        : null,
      device_label: state.remoteDraft.device_label?.trim() || null,
      remote_dashboard_url: state.remoteDraft.remote_provider_type === 'webdav'
        ? state.remoteDraft.remote_dashboard_url?.trim() || null
        : null,
      remote_auto_sync_enabled: state.remoteDraft.remote_auto_sync_enabled === true,
      remote_auto_sync_interval_minutes: state.remoteDraft.remote_auto_sync_enabled === true
        ? (state.remoteDraft.remote_auto_sync_interval_minutes ?? 10)
        : null,
      remote_archive_keep_latest_count: state.remoteDraft.remote_archive_keep_latest_count ?? null,
      ...(remoteIdentityChanged(state.remoteDraft, state.remoteSettings) ? clearRemoteBookkeepingPatch() : {}),
    }

    state.remoteSettings = await updateLocalSettings(patch)
    state.remoteDraft = {...state.remoteSettings}
    state.remoteArchiveKeepLatest = state.remoteSettings.remote_archive_keep_latest_count ?? ''
    await requestRemoteAutoSyncRefresh()
    updateRemoteAutoSyncState(state.compareInspection?.state ?? null)
    setStatus(t('dataExchange.status.remoteConfigSaved'), 'success', '', 'remote-config')
  } catch (error) {
    setStatus(t('dataExchange.status.saveFailed', {message: error instanceof Error ? error.message : String(error)}), 'error', '', 'remote-config')
  } finally {
    state.busy.remoteConfig = false
    setTransfer(false, '', 'remote-config')
    render()
  }
}

async function clearRemoteConfig() {
  state.busy.remoteConfig = true
  setTransfer(true, t('dataExchange.working'), 'remote-config')
  render()
  try {
    const providerType = state.remoteSettings?.remote_provider_type || state.remoteDraft?.remote_provider_type
    if (providerType === 'gdrive') {
      const provider = await createRemoteExportProvider({
        ...DEFAULT_REMOTE_LOCAL_SETTINGS,
        ...state.remoteSettings,
        ...state.remoteDraft,
      })
      const disconnect = await provider.disconnect?.()
      if (disconnect && !disconnect.ok) throw new Error(disconnect.error.message)
    }
    await clearRemoteProviderSettings()
    state.remoteSettings = await updateLocalSettings({
      device_label: null,
      remote_auto_sync_enabled: false,
      remote_auto_sync_interval_minutes: null,
      remote_archive_keep_latest_count: null,
      ...clearRemoteBookkeepingPatch(),
    })
    state.remoteDraft = {...state.remoteSettings}
    state.remoteArchiveKeepLatest = ''
    state.compareInspection = null
    state.remotePullPreview = null
    state.remotePreviewSummary = null
    state.remoteHealth = null
    state.remoteArchives = []
    state.remoteWarnings = []
    state.remoteActivity = ''
    await requestRemoteAutoSyncRefresh()
    updateRemoteAutoSyncState()
    setStatus(t('dataExchange.status.remoteConfigCleared'), 'success', '', 'remote-config')
  } catch (error) {
    setStatus(t('dataExchange.status.clearFailed', {message: error instanceof Error ? error.message : String(error)}), 'error', '', 'remote-config')
  } finally {
    state.busy.remoteConfig = false
    setTransfer(false, '', 'remote-config')
    render()
  }
}

async function testRemoteConfig() {
  const validationMessage = getRemoteConfigValidationMessage()
  if (validationMessage) {
    setStatus(validationMessage, 'error', '', 'remote-config')
    render()
    return
  }

  state.busy.remoteConfig = true
  setTransfer(true, t('dataExchange.testConnection'), 'remote-config')
  render()
  try {
    const provider = await createRemoteExportProvider({
      ...DEFAULT_REMOTE_LOCAL_SETTINGS,
      ...state.remoteSettings,
      ...state.remoteDraft,
    })
    const result = await provider.testConnection({timeoutMs: 10_000})
    if (result.ok) {
      setStatus(`${t('dataExchange.status.connectionOk')}${result.value.provider_id ? ` · ${result.value.provider_id}` : ''}`, 'success', '', 'remote-config')
    } else {
      setStatus(t('dataExchange.status.connectionFailed', {message: result.error.message}), 'error', '', 'remote-config')
    }
  } catch (error) {
    setStatus(t('dataExchange.status.connectionFailed', {message: error instanceof Error ? error.message : String(error)}), 'error', '', 'remote-config')
  } finally {
    state.busy.remoteConfig = false
    setTransfer(false, '', 'remote-config')
    render()
  }
}

async function disconnectGoogleDrive() {
  if (!state.remoteSettings || state.remoteSettings.remote_provider_type !== 'gdrive') return
  if (!window.confirm(t('dataExchange.confirm.disconnectGoogleDrive'))) return

  state.busy.remoteDisconnect = true
  setTransfer(true, t('dataExchange.disconnectGoogleDrive'), 'remote-config')
  render()
  try {
    const provider = await createRemoteExportProvider({
      ...DEFAULT_REMOTE_LOCAL_SETTINGS,
      ...state.remoteSettings,
      ...state.remoteDraft,
    })
    const disconnect = await provider.disconnect?.()
    if (disconnect && !disconnect.ok) throw new Error(disconnect.error.message)
    state.remoteSettings = await updateLocalSettings({
      remote_provider_type: null,
      remote_auto_sync_enabled: false,
      remote_auto_sync_interval_minutes: null,
      remote_archive_keep_latest_count: null,
      ...clearRemoteBookkeepingPatch(),
    })
    state.remoteDraft = {...state.remoteSettings}
    state.compareInspection = null
    state.remotePullPreview = null
    state.remotePreviewSummary = null
    state.remoteHealth = null
    state.remoteArchives = []
    state.remoteWarnings = []
    state.remoteActivity = ''
    await requestRemoteAutoSyncRefresh()
    updateRemoteAutoSyncState()
    setStatus(t('dataExchange.status.googleDriveDisconnected'), 'success', '', 'remote-config')
  } catch (error) {
    setStatus(t('dataExchange.status.disconnectFailed', {message: error instanceof Error ? error.message : String(error)}), 'error', '', 'remote-config')
  } finally {
    state.busy.remoteDisconnect = false
    setTransfer(false, '', 'remote-config')
    render()
  }
}

async function deleteLiveRemoteExport() {
  if (!state.remoteSettings || !isRemoteProviderConfigured(state.remoteSettings)) {
    setStatus(t('dataExchange.status.providerNotConfigured'), 'error', '', 'remote-config')
    return
  }
  if (!window.confirm(t('dataExchange.confirm.deleteLiveRemote'))) return

  state.busy.remoteConfig = true
  setTransfer(true, t('dataExchange.deleteLiveRemote'), 'remote-config')
  render()
  try {
    const provider = await createRemoteExportProvider(state.remoteSettings)
    const result = await provider.deleteLiveExport?.()
    if (!result?.ok) throw new Error(result?.error?.message || 'Remote live export deletion is unavailable.')

    state.remoteSettings = await updateLocalSettings(clearRemoteBaselinePatch())
    state.remoteDraft = {
      ...state.remoteDraft,
      ...clearRemoteBaselinePatch(),
    }
    state.compareInspection = null
    state.remotePullPreview = null
    state.remotePreviewSummary = null
    state.remoteHealth = null
    state.remoteWarnings = []
    state.remoteActivity = t('dataExchange.status.liveRemoteDeleted')
    await requestRemoteAutoSyncRefresh()
    updateRemoteAutoSyncState()
    setStatus(t('dataExchange.status.liveRemoteDeleted'), 'success', '', 'remote-config')
  } catch (error) {
    setStatus(t('dataExchange.status.liveRemoteDeleteFailed', {message: error instanceof Error ? error.message : String(error)}), 'error', '', 'remote-config')
  } finally {
    state.busy.remoteConfig = false
    setTransfer(false, '', 'remote-config')
    render()
  }
}

async function wipeRemoteData() {
  if (!state.remoteSettings || !isRemoteProviderConfigured(state.remoteSettings)) {
    setStatus(t('dataExchange.status.providerNotConfigured'), 'error', '', 'remote-config')
    return
  }
  if (!window.confirm(t('dataExchange.confirm.wipeRemoteData'))) return

  state.busy.remoteConfig = true
  setTransfer(true, t('dataExchange.wipeRemoteData'), 'remote-config')
  render()
  try {
    const provider = await createRemoteExportProvider(state.remoteSettings)
    const result = await provider.wipeRemoteData?.()
    if (!result?.ok) throw new Error(result?.error?.message || 'Remote wipe is unavailable.')

    state.remoteSettings = await updateLocalSettings(clearRemoteBaselinePatch())
    state.remoteDraft = {
      ...state.remoteDraft,
      ...clearRemoteBaselinePatch(),
    }
    state.compareInspection = null
    state.remotePullPreview = null
    state.remotePreviewSummary = null
    state.remoteHealth = null
    state.remoteArchives = []
    state.remoteWarnings = []
    state.remoteActivity = t('dataExchange.status.remoteWiped')
    await requestRemoteAutoSyncRefresh()
    updateRemoteAutoSyncState()
    setStatus(t('dataExchange.status.remoteWiped'), 'success', '', 'remote-config')
  } catch (error) {
    setStatus(t('dataExchange.status.remoteWipeFailed', {message: error instanceof Error ? error.message : String(error)}), 'error', '', 'remote-config')
  } finally {
    state.busy.remoteConfig = false
    setTransfer(false, '', 'remote-config')
    render()
  }
}

async function pushRemoteWorkspace() {
  if (!state.remoteSettings || !isRemoteProviderConfigured(state.remoteSettings)) {
    setStatus(t('dataExchange.status.configureToEnablePush'), 'error', '', 'remote-sync')
    render()
    return
  }

  state.busy.remotePush = true
  setTransfer(true, t('dataExchange.status.pushingLocalState'), 'remote-sync')
  render()
  try {
    const result = await pushToRemote({
      confirmOverwrite: (inspection) => window.confirm([
        inspection.warnings.join('\n'),
        t('dataExchange.confirm.pushQuestion'),
      ].filter(Boolean).join('\n\n')),
    })
    state.compareInspection = result.inspection
    updateRemoteAutoSyncState(result.inspection?.state ?? null)
    state.remoteWarnings = [...(result.warnings ?? [])]
    state.remoteActivity = result.outcome === 'up_to_date'
      ? t('dataExchange.status.remoteAlreadyMatches')
      : result.outcome === 'partial'
        ? t('dataExchange.status.exportUploadedRepairNeeded')
        : t('dataExchange.status.remotePushComplete')
    await hydrate()
    setStatus(state.remoteActivity, 'success', '', 'remote-sync')
  } catch (error) {
    setStatus(t('dataExchange.status.remotePushFailed', {message: error instanceof Error ? error.message : String(error)}), 'error', '', 'remote-sync')
  } finally {
    state.busy.remotePush = false
    setTransfer(false, '', 'remote-sync')
    render()
  }
}

async function pullRemoteWorkspace() {
  if (!state.remoteSettings || !isRemoteProviderConfigured(state.remoteSettings)) {
    setStatus(t('dataExchange.status.configureToEnablePull'), 'error', '', 'remote-sync')
    render()
    return
  }

  state.busy.remotePull = true
  setTransfer(true, t('dataExchange.status.pullingRemoteState'), 'remote-sync')
  render()
  try {
    const result = await pullFromRemote({
      confirmImport: (preview) => window.confirm([
        preview.remoteMeta
          ? t('dataExchange.confirm.remoteExportedAt', {exportedAt: preview.remoteMeta.exported_at})
          : t('dataExchange.confirm.downloadAndMerge'),
      ].join('\n\n')),
    })
    const cleanupCount = Object.values(result.cleanup).reduce((sum, value) => sum + value, 0)
    state.remoteWarnings = [...(result.preview?.warnings ?? [])]
    state.remoteActivity = formatImportReport(result.report, cleanupCount)
    await hydrate()
    setStatus(state.remoteActivity, 'success', '', 'remote-sync')
  } catch (error) {
    const message = error instanceof BackupValidationError
      ? t('dataExchange.status.invalidRemoteBackup', {message: error.message})
      : t('dataExchange.status.remotePullFailed', {message: error instanceof Error ? error.message : String(error)})
    setStatus(message, 'error', '', 'remote-sync')
  } finally {
    state.busy.remotePull = false
    setTransfer(false, '', 'remote-sync')
    render()
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

function makeJsonDownloadBlob(value) {
  return new Blob([JSON.stringify(value, null, 2)], {type: 'application/json'})
}

function getKnownRemoteChecksum() {
  return state.compareInspection?.remote?.meta?.workspace_checksum ||
    state.remotePreviewSummary?.checksum ||
    state.remoteHealth?.remote?.workspace_checksum ||
    null
}

async function resolveRemoteChecksum(provider) {
  const knownChecksum = getKnownRemoteChecksum()
  if (knownChecksum) return knownChecksum

  const metaResult = await provider.downloadMeta()
  if (!metaResult.ok) return null
  return metaResult.value?.workspace_checksum || null
}

async function downloadRemoteExport() {
  state.busy.remoteDownload = true
  setTransfer(true, t('dataExchange.status.downloadingRemoteExport'), 'remote-sync')
  render()
  try {
    const artifact = await downloadRemoteExportArtifact()
    downloadBlob(artifact.blob, artifact.filename)
    state.remoteActivity = t('dataExchange.status.downloadedFile', {filename: artifact.filename})
    setStatus(state.remoteActivity, 'success', '', 'remote-sync')
  } catch (error) {
    setStatus(t('dataExchange.status.remoteDownloadFailed', {message: error instanceof Error ? error.message : String(error)}), 'error', '', 'remote-sync')
  } finally {
    state.busy.remoteDownload = false
    setTransfer(false, '', 'remote-sync')
    render()
  }
}

async function downloadRemotePackagePart(kind) {
  if (!state.remoteSettings || !isRemoteProviderConfigured(state.remoteSettings)) {
    setStatus(t('dataExchange.status.providerNotConfigured'), 'error', '', 'remote-sync')
    render()
    return
  }

  state.busy.remoteDownload = true
  setTransfer(true, t('dataExchange.status.downloadingRemoteExport'), 'remote-sync')
  render()

  try {
    const provider = await createRemoteExportProvider(state.remoteSettings)
    const checksum = await resolveRemoteChecksum(provider)
    if (kind === 'data') {
      const result = await provider.downloadExport()
      if (!result.ok) throw new Error(result.error.message)
      const filename = buildExportFilename('remote-data', checksum || 'remote')
      downloadBlob(result.value, filename)
      setStatus(t('dataExchange.status.downloadedFile', {filename}), 'success', '', 'remote-sync')
    } else if (kind === 'assets') {
      const result = await provider.downloadAssets()
      if (!result.ok) throw new Error(result.error.message)
      const filename = buildExportFilename('remote-assets', checksum || 'remote')
      downloadBlob(result.value, filename)
      setStatus(t('dataExchange.status.downloadedFile', {filename}), 'success', '', 'remote-sync')
    } else if (kind === 'meta') {
      const result = await provider.downloadMeta()
      if (!result.ok) throw new Error(result.error.message)
      const filename = buildExportFilename('remote-meta', result.value?.workspace_checksum || checksum || 'remote')
      downloadBlob(makeJsonDownloadBlob(result.value), filename)
      setStatus(t('dataExchange.status.downloadedFile', {filename}), 'success', '', 'remote-sync')
    }
  } catch (error) {
    setStatus(t('dataExchange.status.remoteDownloadFailed', {message: error instanceof Error ? error.message : String(error)}), 'error', '', 'remote-sync')
  } finally {
    state.busy.remoteDownload = false
    setTransfer(false, '', 'remote-sync')
    render()
  }
}

async function downloadRemoteArchive(checksum) {
  if (!checksum) return
  if (!state.remoteSettings || !isRemoteProviderConfigured(state.remoteSettings)) {
    setStatus(t('dataExchange.status.providerNotConfigured'), 'error', '', 'remote-sync')
    render()
    return
  }

  state.busy.remoteDownload = true
  setTransfer(true, t('dataExchange.status.downloadingRemoteExport'), 'remote-sync')
  render()

  try {
    const provider = await createRemoteExportProvider(state.remoteSettings)
    const result = await provider.downloadArchiveExport(checksum)
    if (!result.ok) throw new Error(result.error.message)
    const filename = buildExportFilename('archive', checksum)
    downloadBlob(result.value, filename)
    state.remoteActivity = t('dataExchange.status.downloadedFile', {filename})
    setStatus(state.remoteActivity, 'success', '', 'remote-sync')
  } catch (error) {
    setStatus(t('dataExchange.status.remoteDownloadFailed', {message: error instanceof Error ? error.message : String(error)}), 'error', '', 'remote-sync')
  } finally {
    state.busy.remoteDownload = false
    setTransfer(false, '', 'remote-sync')
    render()
  }
}

async function restoreRemoteArchive(checksum) {
  if (!checksum) return
  if (!state.remoteSettings || !isRemoteProviderConfigured(state.remoteSettings)) {
    setStatus(t('dataExchange.status.providerNotConfigured'), 'error', '', 'remote-sync')
    render()
    return
  }

  if (!window.confirm(t('dataExchange.confirm.restoreArchive', {checksum}))) {
    setStatus(t('common.cancel'), 'idle', '', 'remote-sync')
    render()
    return
  }

  state.busy.remoteRestore = true
  setTransfer(true, t('dataExchange.status.restoringArchive'), 'remote-sync')
  render()

  try {
    const provider = await createRemoteExportProvider(state.remoteSettings)
    const archiveResult = await provider.downloadArchiveExport(checksum)
    if (!archiveResult.ok) throw new Error(archiveResult.error.message)

    const manifest = parseManifestText(await archiveResult.value.text())
    const report = await importAll(manifest, {}, db)
    const cleanup = await cleanupOrphans(db)
    const cleaned = Object.values(cleanup).reduce((sum, value) => sum + value, 0)

    await noteImportedWorkspace('import:local', db)
    await updateLocalSettings({
      last_known_local_checksum: null,
      last_remote_seen_checksum: null,
      last_remote_seen_exported_at: null,
      last_remote_source_device: null,
    })

    state.remoteActivity = formatImportReport(report, cleaned)
    await hydrate()
    setStatus(t('dataExchange.status.archiveRestoreComplete', {checksum}), 'success', state.remoteActivity, 'remote-sync')
  } catch (error) {
    const message = error instanceof BackupValidationError
      ? t('dataExchange.status.invalidRemoteBackup', {message: error.message})
      : t('dataExchange.status.archiveRestoreFailed', {message: error instanceof Error ? error.message : String(error)})
    setStatus(message, 'error', '', 'remote-sync')
  } finally {
    state.busy.remoteRestore = false
    setTransfer(false, '', 'remote-sync')
    render()
  }
}

async function deleteRemoteArchive(checksum) {
  if (!checksum) return
  if (!state.remoteSettings || !isRemoteProviderConfigured(state.remoteSettings)) {
    setStatus(t('dataExchange.status.providerNotConfigured'), 'error', '', 'remote-sync')
    render()
    return
  }

  if (!window.confirm(t('dataExchange.confirm.deleteArchive', {checksum}))) {
    setStatus(t('common.cancel'), 'idle', '', 'remote-sync')
    render()
    return
  }

  state.busy.remoteArchiveDelete = true
  setTransfer(true, t('dataExchange.status.deletingArchive'), 'remote-sync')
  render()

  try {
    const provider = await createRemoteExportProvider(state.remoteSettings)
    const result = await provider.deleteArchive(checksum)
    if (!result.ok) throw new Error(result.error.message)
    state.remoteArchives = (state.remoteArchives ?? []).filter((archive) => archive.workspace_checksum !== checksum)
    state.remoteActivity = t('dataExchange.status.archiveDeleteComplete', {checksum})
    setStatus(state.remoteActivity, 'success', '', 'remote-sync')
  } catch (error) {
    setStatus(t('dataExchange.status.archiveDeleteFailed', {message: error instanceof Error ? error.message : String(error)}), 'error', '', 'remote-sync')
  } finally {
    state.busy.remoteArchiveDelete = false
    setTransfer(false, '', 'remote-sync')
    render()
  }
}

function normalizeArchiveKeepLatestValue(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(parsed) || parsed < 1) return null
  return parsed
}

function sortArchivesNewestFirst(archives = []) {
  return [...archives].sort((left, right) => {
    const leftTime = Date.parse(left?.exported_at ?? '')
    const rightTime = Date.parse(right?.exported_at ?? '')
    const safeLeft = Number.isFinite(leftTime) ? leftTime : 0
    const safeRight = Number.isFinite(rightTime) ? rightTime : 0
    return safeRight - safeLeft
  })
}

async function pruneRemoteArchives() {
  if (!state.remoteSettings || !isRemoteProviderConfigured(state.remoteSettings)) {
    setStatus(t('dataExchange.status.providerNotConfigured'), 'error', '', 'remote-sync')
    render()
    return
  }

  const keepLatest = normalizeArchiveKeepLatestValue(
    state.remoteDraft?.remote_archive_keep_latest_count
      ?? state.remoteSettings?.remote_archive_keep_latest_count
      ?? state.remoteArchiveKeepLatest,
  )
  if (keepLatest == null) {
    setStatus(t('dataExchange.status.archiveRetentionRequired'), 'error', '', 'remote-sync')
    render()
    return
  }
  const archives = sortArchivesNewestFirst(state.remoteArchives ?? [])
  const victims = archives.slice(keepLatest)

  if (!victims.length) {
    setStatus(t('dataExchange.status.noArchivesToPrune'), 'idle', '', 'remote-sync')
    render()
    return
  }

  if (!window.confirm(t('dataExchange.confirm.pruneArchives', {count: victims.length, keep: keepLatest}))) {
    setStatus(t('common.cancel'), 'idle', '', 'remote-sync')
    render()
    return
  }

  state.busy.remoteArchivePrune = true
  setTransfer(true, t('dataExchange.status.pruningArchives', {count: victims.length}), 'remote-sync')
  render()

  try {
    const provider = await createRemoteExportProvider(state.remoteSettings)
    let deleted = 0
    for (const archive of victims) {
      const result = await provider.deleteArchive(archive.workspace_checksum)
      if (!result.ok) throw new Error(result.error.message)
      deleted += 1
    }
    const victimChecksums = new Set(victims.map((archive) => archive.workspace_checksum))
    state.remoteArchives = (state.remoteArchives ?? []).filter((archive) => !victimChecksums.has(archive.workspace_checksum))
    state.remoteActivity = t('dataExchange.status.archivePruneComplete', {count: deleted, keep: keepLatest})
    setStatus(state.remoteActivity, 'success', '', 'remote-sync')
  } catch (error) {
    setStatus(t('dataExchange.status.archivePruneFailed', {message: error instanceof Error ? error.message : String(error)}), 'error', '', 'remote-sync')
  } finally {
    state.busy.remoteArchivePrune = false
    setTransfer(false, '', 'remote-sync')
    render()
  }
}

async function boot() {
  await loadAndApplyDocumentTheme()
  await initI18n()
  await hydrate()
  render()

  new YEH({
    body: [
      'click',
      'change',
    ],
  }, {}, {
    enableStats: false,
    enableConfigValidation: false,
    enableHandlerValidation: false,
    methods: {
      handleClick(event, target) {
        const clickable = target.closest?.('[data-click]')
        if (!clickable?.dataset?.click) return
        event.preventDefault()

        const action = clickable.dataset.click
        if (action === 'dismissUiNode') {
          dismissUiNode(clickable)
          return
        }
        if (action === 'reloadImportExport') {
          location.reload()
          return
        }
        if (action === 'downloadLocalExport') {
          void handleDownloadLocalExport()
          return
        }
        if (action === 'triggerLocalImport') {
          triggerLocalImport()
          return
        }
        if (action === 'runDeepOrphanCheck') {
          void runDeepOrphanCheck()
          return
        }
        if (action === 'toggleResetOptions') {
          state.resetOptionsOpen = !state.resetOptionsOpen
          render()
          return
        }
        if (action === 'resetImportExportDatabase') {
          void resetImportExportDatabase()
          return
        }
        if (action === 'deleteUnusedAssetsFromDeepCheck') {
          void deleteUnusedAssetsFromDeepCheck()
          return
        }
        if (action === 'saveRemoteConfig') {
          void saveRemoteConfig()
          return
        }
        if (action === 'clearRemoteConfig') {
          void clearRemoteConfig()
          return
        }
        if (action === 'testRemoteConfig') {
          void testRemoteConfig()
          return
        }
        if (action === 'deleteLiveRemoteExport') {
          void deleteLiveRemoteExport()
          return
        }
        if (action === 'wipeRemoteData') {
          void wipeRemoteData()
          return
        }
        if (action === 'disconnectGoogleDrive') {
          void disconnectGoogleDrive()
          return
        }
        if (action === 'refreshRemoteCompare') {
          void refreshRemoteCompare()
          return
        }
        if (action === 'previewRemotePull') {
          void previewRemoteContents()
          return
        }
        if (action === 'pushRemoteWorkspace') {
          void pushRemoteWorkspace()
          return
        }
        if (action === 'pullRemoteWorkspace') {
          void pullRemoteWorkspace()
          return
        }
        if (action === 'downloadRemoteExport') {
          void downloadRemoteExport()
          return
        }
        if (action === 'downloadRemoteData') {
          void downloadRemotePackagePart('data')
          return
        }
        if (action === 'downloadRemoteAssets') {
          void downloadRemotePackagePart('assets')
          return
        }
        if (action === 'downloadRemoteMeta') {
          void downloadRemotePackagePart('meta')
          return
        }
        if (action === 'downloadRemoteArchive') {
          void downloadRemoteArchive(clickable.dataset.archiveChecksum || '')
          return
        }
        if (action === 'restoreRemoteArchive') {
          void restoreRemoteArchive(clickable.dataset.archiveChecksum || '')
          return
        }
        if (action === 'deleteRemoteArchive') {
          void deleteRemoteArchive(clickable.dataset.archiveChecksum || '')
          return
        }
        if (action === 'pruneRemoteArchives') {
          void pruneRemoteArchives()
          return
        }
      },

      handleChange(_event, target) {
        if (target?.id === 'workspace_import_file') {
          void handleImportFile(target.files?.[0] ?? null)
          return
        }

        if (target?.dataset?.change === 'updateRemoteDraft') {
          if (target.name === 'remote_sync_indicator') {
            const nextIndicatorState = normalizeDraftBoolean(target)
            const currentSettings = state.widgetSettings
            if (currentSettings) {
              const nextSettings = {
                ...currentSettings,
                remote_sync_indicator: nextIndicatorState,
              }
              state.widgetSettings = nextSettings
              void saveWidgetSettings(nextSettings, db)
            } else {
              void getWidgetSettings(db).then((loadedSettings) => {
                const nextSettings = {
                  ...loadedSettings,
                  remote_sync_indicator: nextIndicatorState,
                }
                state.widgetSettings = nextSettings
                return saveWidgetSettings(nextSettings, db)
              })
            }
            return
          }

          const value = target.type === 'checkbox'
            ? normalizeDraftBoolean(target)
            : target.type === 'number'
              ? normalizeDraftNumber(target)
              : target.value || null

          const nextDraft = {
            ...(state.remoteDraft ?? {}),
            [target.name]: value,
          }

          if (target.name === 'remote_auto_sync_enabled' && value === true && nextDraft.remote_auto_sync_interval_minutes == null) {
            nextDraft.remote_auto_sync_interval_minutes = 10
          }

          state.remoteDraft = nextDraft
          if (isImmediateRemotePreferenceField(target.name)) {
            void persistImmediateRemotePreference(target.name, value)
          }
          if (target.name === 'remote_auto_sync_enabled' && value === true && nextDraft.remote_auto_sync_interval_minutes === 10) {
            void persistImmediateRemotePreference('remote_auto_sync_interval_minutes', 10)
          }
          updateRemoteAutoSyncState(state.compareInspection?.state ?? null)
          if (target.name === 'remote_provider_type' || target.type === 'checkbox') {
            render(['remote-config'])
          }
          return
        }

        if (target?.dataset?.change === 'updateRemoteArchiveKeepLatest') {
          const value = normalizeArchiveKeepLatestValue(target.value)
          state.remoteArchiveKeepLatest = value ?? ''
          state.remoteDraft = {
            ...(state.remoteDraft ?? {}),
            remote_archive_keep_latest_count: value,
          }
          return
        }

        if (target?.dataset?.change === 'toggleDeepCheckAsset') {
          const assetId = parseInt(target.value ?? '', 10)
          if (!assetId) return
          const selected = new Set(state.deepCheckSelectedUnusedAssetIds ?? [])
          if (target.checked) selected.add(assetId)
          else selected.delete(assetId)
          state.deepCheckSelectedUnusedAssetIds = [...selected]
          render()
        }
      },
    },
  })
}

boot().catch((error) => {
  state.error = error instanceof Error ? error.message : String(error)
  render()
})
