import {
  BackupValidationError,
  LAST_IMPORT_EXPORTED_AT_KEY,
  downloadManifest,
  exportAll,
  importAll,
  manifestChecksum,
  parseManifestText,
  readManifestFile,
} from '../composables/useBackup.ts'
import {cleanupOrphans, getCleanupCandidates} from '../composables/useMaintenance.ts'
import {clearExportDirty, getExportState, noteImportedWorkspace} from '../composables/useExportState.ts'
import {clearRemoteProviderSettings, getLocalSettings, updateLocalSettings} from '../composables/useLocalSettings.ts'
import {
  downloadRemoteExportArtifact,
  inspectRemotePush,
  previewRemotePull,
  pullFromRemote,
  pushToRemote,
  verifyRemoteHealth,
} from '../composables/useRemoteExchange.ts'
import {createRemoteExportProvider, isRemoteProviderConfigured} from '../composables/useRemoteProvider.ts'
import {db, isActiveRecord} from '../db/db.ts'
import {DEFAULT_REMOTE_LOCAL_SETTINGS} from '../types/remote.ts'
import YaiWorker from '../lib/yai/worker/yai-worker.js'
import {YEH} from '../lib/yai/yeh.js'
import {initI18n, t} from '../next/utils/i18n.js'
import '../next/styles/next.css'
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

function render() {
  const mount = getMount()
  if (!mount) return
  mount.innerHTML = renderImportExportApp(state)
}

function setStatus(text = '', tone = 'idle', details = '') {
  state.status = {text, tone, details}
}

function setTransfer(active = false, label = '') {
  state.transfer = {active, label}
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

async function readSummary() {
  const [
    pages,
    modules,
    collections,
    tabs,
    notes,
    feedSources,
    savedFeedItems,
    assets,
  ] = await Promise.all([
    db.pages.filter(isActiveRecord).count(),
    db.modules.filter(isActiveRecord).count(),
    db.collections.filter(isActiveRecord).count(),
    db.tabs.filter(isActiveRecord).count(),
    db.notes.filter(isActiveRecord).count(),
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
  state.exportState = await getExportState(db)
  state.localSummary = await readSummary()
  state.remoteSettings = await getLocalSettings()
  state.remoteDraft = {...state.remoteSettings}
  state.loading = false
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

async function refreshRemoteCompare() {
  state.busy.remoteCheck = true
  state.remoteWarnings = []
  setTransfer(true, t('dataExchange.status.verifyingRemoteCompare'))
  render()
  try {
    state.compareInspection = await inspectRemotePush()
    state.remoteHealth = await verifyRemoteHealth()
    state.remoteWarnings = [
      ...(state.compareInspection?.warnings ?? []),
      ...(state.remoteHealth?.warnings ?? []),
    ]
    state.remoteActivity = state.remoteHealth?.message || ''
    setStatus(state.remoteHealth?.message || t('dataExchange.status.remoteHealthy'), 'success', state.remoteHealth?.guidance || '')
  } catch (error) {
    setStatus(t('dataExchange.status.remoteCheckFailed', {message: error instanceof Error ? error.message : String(error)}), 'error')
  } finally {
    state.busy.remoteCheck = false
    setTransfer(false, '')
    render()
  }
}

async function previewRemoteContents() {
  if (!state.remoteSettings || !isRemoteProviderConfigured(state.remoteSettings)) {
    setStatus(t('dataExchange.status.configureToEnablePull'), 'error')
    render()
    return
  }

  state.busy.remotePreview = true
  state.remoteWarnings = []
  state.remotePreviewSummary = null
  setTransfer(true, t('dataExchange.status.checkingRemoteContents'))
  render()
  try {
    const provider = createRemoteExportProvider(state.remoteSettings)
    const preview = await previewRemotePull({provider})
    state.remotePullPreview = preview
    state.remoteWarnings = [...(preview?.warnings ?? [])]

    if (!['remote_missing', 'not_configured'].includes(preview.state)) {
      const exportResult = await provider.downloadExport()
      if (!exportResult.ok) throw new Error(exportResult.error.message)
      const manifest = parseManifestText(await exportResult.value.text())
      state.remotePreviewSummary = {
        pages: manifest.pages.length,
        modules: manifest.modules.length,
        collections: manifest.collections.length,
        tabs: manifest.tabs.length,
        notes: manifest.notes.length,
        feedSources: manifest.feed_sources.length,
        savedFeedItems: manifest.saved_feed_items.length,
        assets: manifest.assets.length,
        exportedAt: manifest.exported_at,
        checksum: preview.remoteMeta?.workspace_checksum ?? null,
      }
    }

    state.remoteActivity = t('dataExchange.checkRemoteContents')
    setStatus(t('dataExchange.status.remoteExportReady'), 'success')
  } catch (error) {
    setStatus(t('dataExchange.status.remoteCheckFailed', {message: error instanceof Error ? error.message : String(error)}), 'error')
  } finally {
    state.busy.remotePreview = false
    setTransfer(false, '')
    render()
  }
}

async function handleDownloadLocalExport() {
  state.busy.localExport = true
  setTransfer(true, t('dataExchange.downloading'))
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
    }), 'success')
  } catch (error) {
    setStatus(t('app.statuses.exportFailed', {message: error instanceof Error ? error.message : String(error)}), 'error')
  } finally {
    state.busy.localExport = false
    setTransfer(false, '')
    render()
  }
}

function triggerLocalImport() {
  document.getElementById('workspace_import_file')?.click()
}

async function handleImportFile(file) {
  if (!file) return
  state.busy.localImport = true
  setTransfer(true, t('dataExchange.working'))
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
      setStatus(t('common.cancel'), 'idle')
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
    setStatus(formatImportReport(report, cleaned), 'success')
  } catch (error) {
    const message = error instanceof BackupValidationError
      ? t('app.statuses.invalidBackup', {message: error.message})
      : t('app.statuses.importFailed', {message: error instanceof Error ? error.message : String(error)})
    setStatus(message, 'error')
  } finally {
    state.busy.localImport = false
    setTransfer(false, '')
    const fileInput = document.getElementById('workspace_import_file')
    if (fileInput) fileInput.value = ''
    render()
  }
}

async function runDeepOrphanCheck() {
  state.busy.deepCheck = true
  setTransfer(true, t('dataExchange.working'))
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
    setStatus(
      result.total > 0
        ? t('dataExchange.deepCheckFound', {count: result.total})
        : t('dataExchange.deepCheckClean'),
      result.total > 0 ? 'error' : 'success',
    )
  } catch (error) {
    setStatus(t('dataExchange.status.remoteCheckFailed', {message: error instanceof Error ? error.message : String(error)}), 'error')
  } finally {
    state.busy.deepCheck = false
    setTransfer(false, '')
    render()
  }
}

async function deleteUnusedAssetsFromDeepCheck() {
  const assetIds = state.deepCheckSelectedUnusedAssetIds ?? []
  if (!assetIds.length) return
  if (!window.confirm(t('dataExchange.confirmDeleteUnusedAssets', {count: assetIds.length}))) return

  state.busy.deepCheck = true
  setTransfer(true, t('dataExchange.working'))
  render()

  try {
    await db.assets.bulkDelete(assetIds)
    await runDeepOrphanCheck()
    setStatus(t('dataExchange.unusedAssetsDeleted', {count: assetIds.length}), 'success')
  } catch (error) {
    setStatus(t('dataExchange.status.remoteCheckFailed', {message: error instanceof Error ? error.message : String(error)}), 'error')
  } finally {
    state.busy.deepCheck = false
    setTransfer(false, '')
    render()
  }
}

async function resetImportExportDatabase() {
  if (state.busy.resetDatabase) return
  if (!window.confirm(t('cleanup.confirmReset'))) return

  state.busy.resetDatabase = true
  setTransfer(true, t('cleanup.resetting'))
  render()

  try {
    revokeDeepCheckAssetUrls()
    db.close()
    await db.delete()
    await clearChromeLocalStorage()
    window.location.reload()
  } finally {
    state.busy.resetDatabase = false
    setTransfer(false, '')
  }
}

async function saveRemoteConfig() {
  const validationMessage = getRemoteConfigValidationMessage()
  if (validationMessage) {
    setStatus(validationMessage, 'error')
    render()
    return
  }

  state.busy.remoteConfig = true
  setTransfer(true, t('dataExchange.working'))
  render()
  try {
    const patch = {
      remote_provider_type: state.remoteDraft.remote_provider_type,
      remote_endpoint_url: state.remoteDraft.remote_endpoint_url?.trim() || null,
      remote_username: state.remoteDraft.remote_username?.trim() || null,
      remote_secret: state.remoteDraft.remote_secret?.trim() || null,
      remote_path: state.remoteDraft.remote_path?.trim() || null,
      device_label: state.remoteDraft.device_label?.trim() || null,
      remote_dashboard_url: state.remoteDraft.remote_dashboard_url?.trim() || null,
      ...(remoteIdentityChanged(state.remoteDraft, state.remoteSettings) ? clearRemoteBookkeepingPatch() : {}),
    }

    state.remoteSettings = await updateLocalSettings(patch)
    state.remoteDraft = {...state.remoteSettings}
    setStatus(t('dataExchange.status.remoteConfigSaved'), 'success')
  } catch (error) {
    setStatus(t('dataExchange.status.saveFailed', {message: error instanceof Error ? error.message : String(error)}), 'error')
  } finally {
    state.busy.remoteConfig = false
    setTransfer(false, '')
    render()
  }
}

async function clearRemoteConfig() {
  state.busy.remoteConfig = true
  setTransfer(true, t('dataExchange.working'))
  render()
  try {
    await clearRemoteProviderSettings()
    state.remoteSettings = await updateLocalSettings({
      device_label: null,
      ...clearRemoteBookkeepingPatch(),
    })
    state.remoteDraft = {...state.remoteSettings}
    state.compareInspection = null
    state.remotePullPreview = null
    state.remotePreviewSummary = null
    state.remoteHealth = null
    state.remoteWarnings = []
    state.remoteActivity = ''
    setStatus(t('dataExchange.status.remoteConfigCleared'), 'success')
  } catch (error) {
    setStatus(t('dataExchange.status.clearFailed', {message: error instanceof Error ? error.message : String(error)}), 'error')
  } finally {
    state.busy.remoteConfig = false
    setTransfer(false, '')
    render()
  }
}

async function testRemoteConfig() {
  const validationMessage = getRemoteConfigValidationMessage()
  if (validationMessage) {
    setStatus(validationMessage, 'error')
    render()
    return
  }

  state.busy.remoteConfig = true
  setTransfer(true, t('dataExchange.testConnection'))
  render()
  try {
    const provider = createRemoteExportProvider({
      ...DEFAULT_REMOTE_LOCAL_SETTINGS,
      ...state.remoteSettings,
      ...state.remoteDraft,
    })
    const result = await provider.testConnection({timeoutMs: 10_000})
    if (result.ok) {
      setStatus(`${t('dataExchange.status.connectionOk')}${result.value.provider_id ? ` · ${result.value.provider_id}` : ''}`, 'success')
    } else {
      setStatus(t('dataExchange.status.connectionFailed', {message: result.error.message}), 'error')
    }
  } catch (error) {
    setStatus(t('dataExchange.status.connectionFailed', {message: error instanceof Error ? error.message : String(error)}), 'error')
  } finally {
    state.busy.remoteConfig = false
    setTransfer(false, '')
    render()
  }
}

async function pushRemoteWorkspace() {
  if (!state.remoteSettings || !isRemoteProviderConfigured(state.remoteSettings)) {
    setStatus(t('dataExchange.status.configureToEnablePush'), 'error')
    render()
    return
  }

  state.busy.remotePush = true
  setTransfer(true, t('dataExchange.status.pushingLocalState'))
  render()
  try {
    const result = await pushToRemote({
      confirmOverwrite: (inspection) => window.confirm([
        inspection.warnings.join('\n'),
        t('dataExchange.confirm.pushQuestion'),
      ].filter(Boolean).join('\n\n')),
    })
    state.compareInspection = result.inspection
    state.remoteWarnings = [...(result.warnings ?? [])]
    state.remoteActivity = result.outcome === 'up_to_date'
      ? t('dataExchange.status.remoteAlreadyMatches')
      : result.outcome === 'partial'
        ? t('dataExchange.status.exportUploadedRepairNeeded')
        : t('dataExchange.status.remotePushComplete')
    await hydrate()
    setStatus(state.remoteActivity, 'success')
  } catch (error) {
    setStatus(t('dataExchange.status.remotePushFailed', {message: error instanceof Error ? error.message : String(error)}), 'error')
  } finally {
    state.busy.remotePush = false
    setTransfer(false, '')
    render()
  }
}

async function pullRemoteWorkspace() {
  if (!state.remoteSettings || !isRemoteProviderConfigured(state.remoteSettings)) {
    setStatus(t('dataExchange.status.configureToEnablePull'), 'error')
    render()
    return
  }

  state.busy.remotePull = true
  setTransfer(true, t('dataExchange.status.pullingRemoteState'))
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
    setStatus(state.remoteActivity, 'success')
  } catch (error) {
    const message = error instanceof BackupValidationError
      ? t('dataExchange.status.invalidRemoteBackup', {message: error.message})
      : t('dataExchange.status.remotePullFailed', {message: error instanceof Error ? error.message : String(error)})
    setStatus(message, 'error')
  } finally {
    state.busy.remotePull = false
    setTransfer(false, '')
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

async function downloadRemoteExport() {
  state.busy.remoteDownload = true
  setTransfer(true, t('dataExchange.status.downloadingRemoteExport'))
  render()
  try {
    const artifact = await downloadRemoteExportArtifact()
    downloadBlob(artifact.blob, artifact.filename)
    state.remoteActivity = t('dataExchange.status.downloadedFile', {filename: artifact.filename})
    setStatus(state.remoteActivity, 'success')
  } catch (error) {
    setStatus(t('dataExchange.status.remoteDownloadFailed', {message: error instanceof Error ? error.message : String(error)}), 'error')
  } finally {
    state.busy.remoteDownload = false
    setTransfer(false, '')
    render()
  }
}

async function boot() {
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
        }
      },

      handleChange(_event, target) {
        if (target?.id === 'workspace_import_file') {
          void handleImportFile(target.files?.[0] ?? null)
          return
        }

        if (target?.dataset?.change === 'updateRemoteDraft') {
          state.remoteDraft = {
            ...(state.remoteDraft ?? {}),
            [target.name]: target.value || null,
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
