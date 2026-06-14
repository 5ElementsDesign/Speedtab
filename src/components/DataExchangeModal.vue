<script setup lang="ts">
import { BackupValidationError, parseManifestText, type ImportReport } from '@/composables/useBackup'
import { EXPORT_STATE_KEY, parseStoredExportState, summarizeExportDirtyReasons } from '@/composables/useExportState'
import { useLiveQuery } from '@/composables/useLiveQuery'
import {
  clearRemoteProviderSettings,
  getLocalSettings,
  updateLocalSettings,
} from '@/composables/useLocalSettings'
import {
  downloadRemoteExportArtifact,
  inspectRemotePush,
  previewRemotePull,
  pullFromRemote,
  pushToRemote,
  verifyRemoteHealth,
  type RemotePullPreview,
  type RemotePushInspection,
  type RemoteVerifyDiagnostics,
} from '@/composables/useRemoteExchange'
import { createRemoteExportProvider, isRemoteProviderConfigured } from '@/composables/useRemoteProvider'
import { db } from '@/db/db'
import {
  DEFAULT_REMOTE_LOCAL_SETTINGS,
  type RemoteLocalSettings,
} from '@/types/remote'
import { computed, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Modal from './Modal.vue'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  close: []
  downloadExport: []
  importLocalFile: []
}>()
const { t } = useI18n()

const remoteSettings = ref<RemoteLocalSettings | null>(null)
const remoteSettingsLoading = ref(false)
const remotePushStatus = ref<string | null>(null)
const remotePushWarnings = ref<string[]>([])
const remotePushBusy = ref(false)
const remotePullStatus = ref<string | null>(null)
const remotePullWarnings = ref<string[]>([])
const remotePullBusy = ref(false)
const compareInspection = ref<RemotePushInspection | null>(null)
const remoteDownloadBusy = ref(false)
const remoteHealth = ref<RemoteVerifyDiagnostics | null>(null)
const activeTransferLabel = ref<string | null>(null)
const activeTransferController = ref<AbortController | null>(null)
const activeTransferVisible = ref(false)
let activeTransferVisibilityTimeout: ReturnType<typeof setTimeout> | null = null
const remoteDraft = ref<RemoteLocalSettings>({ ...DEFAULT_REMOTE_LOCAL_SETTINGS })
const remoteConfigStatus = ref<string | null>(null)
const remoteConfigBusy = ref(false)
const remoteConfigExpanded = ref(true)
const remoteActivityStatus = ref<string | null>(null)
const remoteActivityWarnings = ref<string[]>([])
const showDebug = ref(false)
const remotePreviewSummary = ref<{
  pages: number
  modules: number
  collections: number
  tabs: number
  notes: number
  feedSources: number
  savedFeedItems: number
  assets: number
  exportedAt: string | null
  checksum: string | null
} | null>(null)

const { data: exportStateSetting } = useLiveQuery(
  () => db.app_settings.get(EXPORT_STATE_KEY),
  null,
)

const { data: localSummary } = useLiveQuery(
  async () => {
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
      db.pages.count(),
      db.modules.count(),
      db.collections.count(),
      db.tabs.count(),
      db.notes.count(),
      db.feed_sources.count(),
      db.saved_feed_items.count(),
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
  },
  {
    pages: 0,
    modules: 0,
    collections: 0,
    tabs: 0,
    notes: 0,
    feedSources: 0,
    savedFeedItems: 0,
    assets: 0,
  },
)

const exportState = computed(() => parseStoredExportState(exportStateSetting.value?.value_json))
const exportReminderLabel = computed(() =>
  exportState.value.export_dirty_reasons.length
    ? summarizeExportDirtyReasons(exportState.value.export_dirty_reasons)
    : null,
)
const draftProviderStatus = computed(() => isRemoteProviderConfigured(remoteDraft.value))
const remoteConfigured = computed(() =>
  !!remoteSettings.value && isRemoteProviderConfigured(remoteSettings.value),
)
const savedRemoteSummary = computed(() => {
  if (!remoteSettings.value || !isRemoteProviderConfigured(remoteSettings.value)) return null
  return {
    provider: remoteSettings.value.remote_provider_type?.toUpperCase() ?? 'Remote',
    endpoint: remoteSettings.value.remote_endpoint_url ?? null,
    path: remoteSettings.value.remote_path ?? null,
    dashboardUrl: remoteSettings.value.remote_dashboard_url ?? null,
  }
})
const showRemoteUi = computed(() =>
  !!savedRemoteSummary.value || draftProviderStatus.value,
)
const localExportHeadline = computed(() => {
  if (exportState.value.export_dirty) {
    return t('dataExchange.status.localBackupNotCurrent')
  }
  if (exportState.value.last_exported_at) {
    return t('dataExchange.status.localBackupCurrent')
  }
  return t('dataExchange.status.noLocalExportYet')
})
const localExportDetail = computed(() => {
  if (exportState.value.export_dirty) {
    return t('dataExchange.status.downloadPortableBackup')
  }
  if (exportState.value.last_exported_at) {
    return t('dataExchange.status.workspaceAlreadyExported')
  }
  return t('dataExchange.status.createFirstSnapshot')
})
const remoteFreshnessHeadline = computed(() => {
  if (!remoteConfigured.value) return t('dataExchange.status.remoteNotConfigured')
  if (
    compareInspection.value?.archiveExists &&
    ['remote_missing', 'local_newer', 'divergent', 'version_mismatch', 'unknown_endpoint_context'].includes(compareInspection.value.state)
  ) {
    return t('dataExchange.status.currentStateArchivedRemotely')
  }
  if (exportState.value.remote_out_of_date) return t('dataExchange.status.remoteOutOfDate')
  if (exportState.value.last_remote_push_checksum) return t('dataExchange.status.remoteCurrent')
  return t('dataExchange.status.remoteNotPushedYet')
})
const remoteFreshnessDetail = computed(() => {
  if (!remoteConfigured.value) {
    return t('dataExchange.status.configureRemoteForCopy')
  }
  if (
    compareInspection.value?.archiveExists &&
    ['remote_missing', 'local_newer', 'divergent', 'version_mismatch', 'unknown_endpoint_context'].includes(compareInspection.value.state)
  ) {
    return t('dataExchange.status.checksumPreservedPushOptional')
  }
  if (exportState.value.remote_out_of_date) {
    return t('dataExchange.status.workspaceChangedSincePush')
  }
  if (exportState.value.last_remote_push_checksum) {
    return t('dataExchange.status.lastPushMatches')
  }
  return t('dataExchange.status.remoteSettingsSavedNoPush')
})
const recommendedAction = computed(() => {
  if (!remoteConfigured.value) {
    return t('dataExchange.status.configureOrDownloadFirst')
  }
  switch (compareInspection.value?.state) {
    case 'remote_missing':
    case 'local_newer':
      if (compareInspection.value.archiveExists) {
        return t('dataExchange.status.checksumPreservedPushLive')
      }
      return t('dataExchange.status.pushLocalToInitialize')
    case 'remote_newer':
      return t('dataExchange.status.checkRemoteThenPull')
    case 'divergent':
    case 'version_mismatch':
    case 'unknown_endpoint_context':
      if (compareInspection.value.archiveExists) {
        return t('dataExchange.status.checksumPreservedDecideOverwrite')
      }
      return t('dataExchange.status.decidePushOrPull')
    case 'identical':
    case 'up_to_date':
      if (exportState.value.export_dirty) {
        return t('dataExchange.status.downloadLocalBackupOptional')
      }
      return t('dataExchange.status.noExchangeNeeded')
  }
  if (exportState.value.export_dirty && exportState.value.remote_out_of_date) {
    return t('dataExchange.status.pushLatestChanges')
  }
  if (exportState.value.export_dirty) {
    return t('dataExchange.status.captureCurrentWorkspace')
  }
  return t('dataExchange.status.noExchangeNeeded')
})
const showRecommendedAction = computed(() =>
  recommendedAction.value !== t('dataExchange.status.noExchangeNeeded'),
)

function formatProviderIdLabel(value: string | null | undefined): string | null {
  if (!value) return null
  if (value.length <= 28) return value
  return `${value.slice(0, 12)}…${value.slice(-8)}`
}

function validateRemoteEndpointUrl(value: string | null | undefined): string | null {
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

function validateOptionalHttpUrl(value: string | null | undefined, label: string): string | null {
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

const remoteConfigValidationMessage = computed(() => {
  if (!remoteDraft.value.remote_provider_type) return t('dataExchange.status.selectProvider')
  const endpointValidation = validateRemoteEndpointUrl(remoteDraft.value.remote_endpoint_url)
  if (endpointValidation) return endpointValidation
  const dashboardValidation = validateOptionalHttpUrl(remoteDraft.value.remote_dashboard_url, 'Dashboard URL')
  if (dashboardValidation) return dashboardValidation
  if (!remoteDraft.value.remote_username?.trim()) return t('dataExchange.status.usernameRequired')
  if (!remoteDraft.value.remote_secret?.trim()) return t('dataExchange.status.secretRequired')
  if (!remoteDraft.value.remote_path?.trim()) return t('dataExchange.status.remotePathRequired')
  if (!remoteDraft.value.device_label?.trim()) return t('dataExchange.status.deviceLabelRequired')
  return null
})

const canPushRemote = computed(() =>
  !!remoteSettings.value && isRemoteProviderConfigured(remoteSettings.value) && !remotePushBusy.value,
)
const canPullRemote = computed(() =>
  !!remoteSettings.value && isRemoteProviderConfigured(remoteSettings.value) && !remotePullBusy.value,
)
const hasActiveTransfer = computed(() => activeTransferVisible.value)
const remoteStatusHeadline = computed(() => {
  if (!remoteConfigured.value) return t('dataExchange.status.remoteNotConfigured')
  if (
    remotePushStatus.value?.startsWith('Remote check failed:') ||
    remotePushStatus.value?.startsWith('Remote push failed:') ||
    remotePushStatus.value?.startsWith('Remote download failed:') ||
    remotePullStatus.value?.startsWith('Remote check failed:') ||
    remotePullStatus.value?.startsWith('Remote pull failed:')
  ) {
    return remotePushStatus.value ?? remotePullStatus.value ?? t('dataExchange.status.remoteSyncFailed')
  }
  if (compareInspection.value && compareInspection.value.state !== 'not_configured') {
    return summarizeInspection(compareInspection.value)
  }
  if (remoteHealth.value) {
    return remoteHealth.value.message
  }
  return remoteFreshnessHeadline.value
})

const remoteStatusBadge = computed(() => {
  if (remoteHealth.value) return remoteHealth.value.health
  if (compareInspection.value && compareInspection.value.state !== 'not_configured') {
    return compareInspection.value.state
  }
  return null
})

const remoteSyncWarnings = computed(() => {
  const warnings = [
    ...(compareInspection.value?.warnings ?? []),
    ...(remoteHealth.value?.warnings ?? []),
    ...remoteActivityWarnings.value,
  ]
  return Array.from(new Set(warnings))
})

function setRemoteActivity(status: string | null, warnings: string[] = []) {
  remoteActivityStatus.value = status
  remoteActivityWarnings.value = warnings
}

function summarizeInspection(inspection: RemotePushInspection): string {
  switch (inspection.state) {
    case 'not_configured': return t('dataExchange.status.providerNotConfigured')
    case 'remote_missing': return t('dataExchange.status.remoteMissing')
    case 'identical': return t('dataExchange.status.remoteAndLocalIdentical')
    case 'up_to_date': return t('dataExchange.status.remoteUpToDate')
    case 'remote_newer': return t('dataExchange.status.remoteNewer')
    case 'local_newer': return t('dataExchange.status.localNewer')
    case 'divergent': return t('dataExchange.status.remoteDiffers')
    case 'version_mismatch': return t('dataExchange.status.manifestVersionDiffers')
    case 'unknown_endpoint_context': return t('dataExchange.status.endpointContextDiffers')
  }
}

function summarizePullPreview(preview: RemotePullPreview): string {
  switch (preview.state) {
    case 'not_configured': return t('dataExchange.status.providerNotConfigured')
    case 'remote_missing': return t('dataExchange.status.remoteExportMissing')
    case 'ready': return t('dataExchange.status.remoteExportReady')
    case 'legacy_manifest': return t('dataExchange.status.remoteLegacyManifest')
    case 'up_to_date': return t('dataExchange.status.remoteMatchesLastPull')
    case 'unknown_endpoint_context': return t('dataExchange.status.endpointContextDiffers')
  }
}

function healthBadgeClass(health: RemoteVerifyDiagnostics['health']): string {
  switch (health) {
    case 'healthy':
      return 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100'
    case 'sidecar_missing':
    case 'export_missing':
    case 'metadata_mismatch':
    case 'corrupt_metadata':
      return 'border-amber-400/20 bg-amber-500/10 text-amber-100'
    case 'auth_failure':
    case 'network_error':
    case 'not_configured':
      return 'border-rose-400/20 bg-rose-500/10 text-rose-100'
  }
}

function formatImportReport(report: ImportReport, cleanupCount: number): string {
  const parts: string[] = []

  if (report.manifest_version === 1) {
    parts.push(t('dataExchange.status.importedLegacyBackup'))
    parts.push(t('dataExchange.report.pages', { count: report.pages }))
    parts.push(t('dataExchange.report.modules', { count: report.modules }))
    parts.push(t('dataExchange.report.tabs', { count: report.tabs }))
    parts.push(t('dataExchange.report.notes', { count: report.notes }))
    parts.push(t('dataExchange.report.archived', { count: report.saved_feed_items }))
    parts.push(t('dataExchange.report.assets', { count: report.assets }))
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
    if (inserted) parts.push(t('dataExchange.report.inserted', { count: inserted }))
    if (updated) parts.push(t('dataExchange.report.updated', { count: updated }))
    if (report.newer_local_skipped) parts.push(t('dataExchange.report.keptLocal', { count: report.newer_local_skipped }))
    if (report.orphans_skipped) parts.push(t('dataExchange.report.orphans', { count: report.orphans_skipped }))
    if (report.assets) parts.push(t('dataExchange.report.assets', { count: report.assets }))
    if (report.assets_deduped) parts.push(t('dataExchange.report.assetsReused', { count: report.assets_deduped }))
  }

  if (cleanupCount > 0) parts.push(t('dataExchange.report.cleanup', { count: cleanupCount }))
  if (report.legacy_warning) parts.push(t('dataExchange.report.legacyFormat'))
  return parts.join(' · ')
}

async function loadRemoteSettings() {
  remoteSettingsLoading.value = true
  try {
    remoteSettings.value = await getLocalSettings()
    remoteDraft.value = { ...remoteSettings.value }
    remoteConfigExpanded.value = !isRemoteProviderConfigured(remoteSettings.value)
  } catch {
    remoteSettings.value = null
    remoteDraft.value = { ...DEFAULT_REMOTE_LOCAL_SETTINGS }
    remoteConfigExpanded.value = true
  } finally {
    remoteSettingsLoading.value = false
  }
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
  } satisfies Partial<RemoteLocalSettings>
}

function remoteIdentityChanged(nextDraft: RemoteLocalSettings, currentSettings: RemoteLocalSettings | null): boolean {
  if (!currentSettings) return true
  return nextDraft.remote_provider_type !== currentSettings.remote_provider_type ||
    nextDraft.remote_endpoint_url !== currentSettings.remote_endpoint_url ||
    nextDraft.remote_path !== currentSettings.remote_path
}

async function saveRemoteConfig() {
  if (remoteConfigValidationMessage.value) {
    remoteConfigStatus.value = remoteConfigValidationMessage.value
    return
  }

  remoteConfigBusy.value = true
  remoteConfigStatus.value = null
  try {
    const patch: Partial<RemoteLocalSettings> = {
      remote_provider_type: remoteDraft.value.remote_provider_type,
      remote_endpoint_url: remoteDraft.value.remote_endpoint_url?.trim() ?? null,
      remote_username: remoteDraft.value.remote_username?.trim() ?? null,
      remote_secret: remoteDraft.value.remote_secret?.trim() ?? null,
      remote_path: remoteDraft.value.remote_path?.trim() ?? null,
      device_label: remoteDraft.value.device_label?.trim() ?? null,
      remote_dashboard_url: remoteDraft.value.remote_dashboard_url?.trim() ?? null,
      ...(remoteIdentityChanged(remoteDraft.value, remoteSettings.value) ? clearRemoteBookkeepingPatch() : {}),
    }

    remoteSettings.value = await updateLocalSettings(patch)
    remoteDraft.value = { ...remoteSettings.value }
    remoteConfigExpanded.value = false
    remoteConfigStatus.value = t('dataExchange.status.remoteConfigSaved')
    await refreshRemotePushStatus()
    await refreshRemotePullStatus()
  } catch (error) {
    remoteConfigStatus.value = t('dataExchange.status.saveFailed', { message: (error as Error).message })
  } finally {
    remoteConfigBusy.value = false
  }
}

async function clearRemoteConfig() {
  remoteConfigBusy.value = true
  remoteConfigStatus.value = null
  try {
    await clearRemoteProviderSettings()
    remoteSettings.value = await updateLocalSettings({
      device_label: null,
      ...clearRemoteBookkeepingPatch(),
    })
    remoteDraft.value = { ...remoteSettings.value }
    remoteConfigExpanded.value = true
    remoteConfigStatus.value = t('dataExchange.status.remoteConfigCleared')
    compareInspection.value = null
    remoteHealth.value = null
    remotePushStatus.value = null
    remotePullStatus.value = null
    remotePreviewSummary.value = null
    remoteActivityStatus.value = null
    remoteActivityWarnings.value = []
  } catch (error) {
    remoteConfigStatus.value = t('dataExchange.status.clearFailed', { message: (error as Error).message })
  } finally {
    remoteConfigBusy.value = false
  }
}

async function testRemoteConfig() {
  if (remoteConfigValidationMessage.value) {
    remoteConfigStatus.value = null
    return
  }

  remoteConfigBusy.value = true
  remoteConfigStatus.value = null
  try {
    const provider = createRemoteExportProvider({
      ...DEFAULT_REMOTE_LOCAL_SETTINGS,
      ...remoteSettings.value,
      ...remoteDraft.value,
    })
    const result = await provider.testConnection({ timeoutMs: 10_000 })
    remoteConfigStatus.value = result.ok
      ? `${t('dataExchange.status.connectionOk')}${result.value.provider_id ? ` · ${formatProviderIdLabel(result.value.provider_id)}` : ''}`
      : t('dataExchange.status.connectionFailed', { message: result.error.message })
  } catch (error) {
    remoteConfigStatus.value = t('dataExchange.status.connectionFailed', { message: (error as Error).message })
  } finally {
    remoteConfigBusy.value = false
  }
}

function beginTransfer(label: string): AbortSignal {
  activeTransferController.value?.abort()
  activeTransferController.value = new AbortController()
  activeTransferLabel.value = label
  activeTransferVisible.value = false
  if (activeTransferVisibilityTimeout) {
    clearTimeout(activeTransferVisibilityTimeout)
  }
  activeTransferVisibilityTimeout = setTimeout(() => {
    if (activeTransferController.value?.signal.aborted) return
    activeTransferVisible.value = true
  }, 160)
  return activeTransferController.value.signal
}

function endTransfer(signal?: AbortSignal) {
  if (!activeTransferController.value) return
  if (signal && activeTransferController.value.signal !== signal) return
  if (activeTransferVisibilityTimeout) {
    clearTimeout(activeTransferVisibilityTimeout)
    activeTransferVisibilityTimeout = null
  }
  activeTransferVisible.value = false
  activeTransferController.value = null
  activeTransferLabel.value = null
}

function cancelActiveTransfer() {
  activeTransferController.value?.abort()
}

async function refreshRemotePushStatus() {
  remotePushWarnings.value = []
  compareInspection.value = null
  remoteHealth.value = null
  if (!remoteSettings.value || !isRemoteProviderConfigured(remoteSettings.value)) {
    remotePushStatus.value = t('dataExchange.status.configureToEnablePush')
    return
  }

  remotePushBusy.value = true
  const signal = beginTransfer(t('dataExchange.status.verifyingRemoteCompare'))
  try {
    const inspection = await inspectRemotePush({ signal })
    compareInspection.value = inspection
    remotePushStatus.value = summarizeInspection(inspection)
    remotePushWarnings.value = inspection.warnings
    remoteHealth.value = await verifyRemoteHealth({ signal })
    setRemoteActivity(remotePushStatus.value, inspection.warnings)
  } catch (error) {
    remotePushStatus.value = t('dataExchange.status.remoteCheckFailed', { message: (error as Error).message })
    setRemoteActivity(remotePushStatus.value)
  } finally {
    remotePushBusy.value = false
    endTransfer(signal)
  }
}

async function refreshRemotePullStatus() {
  remotePullWarnings.value = []
  remotePreviewSummary.value = null
  if (!remoteSettings.value || !isRemoteProviderConfigured(remoteSettings.value)) {
    remotePullStatus.value = t('dataExchange.status.configureToEnablePull')
    return
  }

  remotePullBusy.value = true
  const signal = beginTransfer(t('dataExchange.status.checkingRemoteContents'))
  try {
    const provider = createRemoteExportProvider(remoteSettings.value)
    const preview = await previewRemotePull({ provider, signal })
    remotePullStatus.value = summarizePullPreview(preview)
    remotePullWarnings.value = preview.warnings

    if (!['remote_missing', 'not_configured'].includes(preview.state)) {
      const exportResult = await provider.downloadExport({ signal })
      if (!exportResult.ok) {
        throw new Error(exportResult.error.message)
      }
      const manifest = parseManifestText(await exportResult.value.text())
      remotePreviewSummary.value = {
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
    setRemoteActivity(remotePullStatus.value, preview.warnings)
  } catch (error) {
    remotePullStatus.value = t('dataExchange.status.remoteCheckFailed', { message: (error as Error).message })
    setRemoteActivity(remotePullStatus.value)
  } finally {
    remotePullBusy.value = false
    endTransfer(signal)
  }
}

async function handlePushToRemote() {
  if (!canPushRemote.value) return

  remotePushBusy.value = true
  remotePushWarnings.value = []
  const signal = beginTransfer(t('dataExchange.status.pushingLocalState'))
  try {
    const result = await pushToRemote({
      signal,
      confirmOverwrite: (inspection) => confirm([
        summarizeInspection(inspection),
        ...inspection.warnings.filter((warning) =>
          warning.includes('no known remote baseline yet') ||
          warning.includes('replace the live remote workspace'),
        ),
        t('dataExchange.confirm.pushQuestion'),
      ].join('\n\n')),
    })

    remotePushStatus.value = result.outcome === 'up_to_date'
      ? t('dataExchange.status.remoteAlreadyMatches')
      : result.outcome === 'partial'
        ? t('dataExchange.status.exportUploadedRepairNeeded')
        : t('dataExchange.status.remotePushComplete')
    compareInspection.value = result.inspection
    remotePushWarnings.value = result.warnings
    setRemoteActivity(remotePushStatus.value, result.warnings)
    await loadRemoteSettings()
    remoteHealth.value = await verifyRemoteHealth({ signal })
  } catch (error) {
    remotePushStatus.value = t('dataExchange.status.remotePushFailed', { message: (error as Error).message })
    setRemoteActivity(remotePushStatus.value)
  } finally {
    remotePushBusy.value = false
    endTransfer(signal)
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

async function handleDownloadRemoteExport() {
  if (remoteDownloadBusy.value) return
  remoteDownloadBusy.value = true
  const signal = beginTransfer(t('dataExchange.status.downloadingRemoteExport'))
  try {
    const artifact = await downloadRemoteExportArtifact({ signal })
    downloadBlob(artifact.blob, artifact.filename)
    setRemoteActivity(t('dataExchange.status.downloadedFile', { filename: artifact.filename }))
  } catch (error) {
    remotePushStatus.value = t('dataExchange.status.remoteDownloadFailed', { message: (error as Error).message })
    setRemoteActivity(remotePushStatus.value)
  } finally {
    remoteDownloadBusy.value = false
    endTransfer(signal)
  }
}

async function handlePullFromRemote() {
  if (!canPullRemote.value) return

  remotePullBusy.value = true
  remotePullWarnings.value = []
  const signal = beginTransfer(t('dataExchange.status.pullingRemoteState'))
  try {
    const result = await pullFromRemote({
      signal,
      confirmImport: (preview) => confirm([
        summarizePullPreview(preview),
        preview.remoteMeta
          ? t('dataExchange.confirm.remoteExportedAt', { exportedAt: preview.remoteMeta.exported_at })
          : t('dataExchange.confirm.downloadAndMerge'),
      ].join('\n\n')),
    })
    const cleanupCount = Object.values(result.cleanup).reduce((sum, value) => sum + value, 0)
    remotePullStatus.value = formatImportReport(result.report, cleanupCount)
    remotePullWarnings.value = result.preview.warnings
    setRemoteActivity(remotePullStatus.value, result.preview.warnings)
    await loadRemoteSettings()
    await refreshRemotePushStatus()
    remoteHealth.value = await verifyRemoteHealth({ signal })
  } catch (error) {
    remotePullStatus.value = error instanceof BackupValidationError
      ? t('dataExchange.status.invalidRemoteBackup', { message: error.message })
      : t('dataExchange.status.remotePullFailed', { message: (error as Error).message })
    setRemoteActivity(remotePullStatus.value)
  } finally {
    remotePullBusy.value = false
    endTransfer(signal)
  }
}

watch(
  () => props.show,
  (show) => {
    if (!show) {
      cancelActiveTransfer()
      return
    }
    remotePushStatus.value = null
    remotePushWarnings.value = []
    remotePullStatus.value = null
    remotePullWarnings.value = []
    remoteHealth.value = null
    remoteActivityStatus.value = null
    remoteActivityWarnings.value = []
    remotePreviewSummary.value = null
    void loadRemoteSettings().then(async () => {
      await refreshRemotePushStatus()
      await refreshRemotePullStatus()
    })
  },
  { immediate: true },
)

onUnmounted(() => {
  if (activeTransferVisibilityTimeout) {
    clearTimeout(activeTransferVisibilityTimeout)
    activeTransferVisibilityTimeout = null
  }
  cancelActiveTransfer()
})

</script>

<template>
  <Modal :show="show" :title="t('dataExchange.title')" @close="emit('close')">
    <template #header-actions>
      <button
        type="button"
        class="text-[11px] text-white/45 hover:text-white transition-colors"
        @click="showDebug = !showDebug"
      >
        {{ showDebug ? t('dataExchange.hide') : t('dataExchange.show') }}
      </button>
    </template>

    <div
      v-if="hasActiveTransfer"
      class="cancel-transfer-banner absolute left-0 right-0 bottom-0 z-10 flex items-center justify-between gap-3 border border-sky-400/30 bg-black/85 backdrop-blur-md px-3 py-2">
        <div>
          <div class="text-[10px] uppercase tracking-[0.18em] text-sky-100/70">{{ t('dataExchange.transferActive') }}</div>
          <p class="mt-1 text-[11px] text-sky-50">{{ activeTransferLabel }}</p>
        </div>
        <button
          type="button"
          class="st-ui-btn st-ui-btn-info"
          @click="cancelActiveTransfer"
        >
        {{ t('dataExchange.cancelTransfer') }}
      </button>
    </div>

    <div class="data-exchange-wrapper relative space-y-4">
      <div class="st-ui-card px-3 py-3 space-y-3">
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="text-[10px] uppercase tracking-[0.18em] text-white/45">{{ t('dataExchange.remoteConfiguration') }}</div>
            <p class="mt-2 text-[11px] text-white/65">
              {{ t('dataExchange.remoteConfigurationHelp') }}
            </p>
          </div>
        </div>
        <div v-if="savedRemoteSummary && !remoteConfigExpanded" class="border border-white/10 bg-white/[0.03] px-3 py-3 space-y-3">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <div class="text-[10px] uppercase tracking-[0.18em] text-white/45">{{ t('dataExchange.savedProvider') }}</div>
                <span class="st-ui-chip st-ui-chip-success">{{ t('dataExchange.configured') }}</span>
              </div>
              <component
                :is="savedRemoteSummary.dashboardUrl ? 'a' : 'p'"
                class="mt-2 inline-flex text-[12px]"
                :class="savedRemoteSummary.dashboardUrl ? 'text-sky-300 hover:text-sky-200' : 'text-white'"
                :href="savedRemoteSummary.dashboardUrl || undefined"
                :target="savedRemoteSummary.dashboardUrl ? '_blank' : undefined"
                :rel="savedRemoteSummary.dashboardUrl ? 'noopener noreferrer' : undefined"
              >
                {{ savedRemoteSummary.provider }} · {{ savedRemoteSummary.path || '/' }}
              </component>
            </div>
            <button
              type="button"
              :disabled="remoteConfigBusy"
              class="st-ui-btn st-ui-btn-secondary"
              @click="remoteConfigExpanded = true"
            >
              {{ t('dataExchange.editRemote') }}
            </button>
          </div>
        </div>

        <div v-else class="grid gap-3 sm:grid-cols-2">
          <label class="space-y-1 text-[11px] text-white/70">
            <span class="block uppercase tracking-[0.18em] text-white/45">{{ t('dataExchange.provider') }}</span>
            <select
              v-model="remoteDraft.remote_provider_type"
              id="remote-provider-type"
              name="remote_provider_type"
              class="w-full border border-white/10 bg-surface-950 px-2 py-2 text-[12px] text-white focus:outline-none"
            >
              <option :value="null">{{ t('dataExchange.selectProvider') }}</option>
              <option value="webdav">WebDAV</option>
            </select>
          </label>
          <label class="space-y-1 text-[11px] text-white/70">
            <span class="block uppercase tracking-[0.18em] text-white/45">{{ t('dataExchange.deviceLabel') }}</span>
            <input
              v-model="remoteDraft.device_label"
              id="remote-device-label"
              name="device_label"
              type="text"
              class="w-full border border-white/10 bg-surface-950 px-2 py-2 text-[12px] text-white focus:outline-none"
              :placeholder="t('dataExchange.deviceLabel') === 'Device Label' ? 'Desktop' : 'Desktop'"
            />
          </label>
          <label class="space-y-1 text-[11px] text-white/70 sm:col-span-2">
            <span class="block uppercase tracking-[0.18em] text-white/45">{{ t('dataExchange.endpointUrl') }}</span>
            <input
              v-model="remoteDraft.remote_endpoint_url"
              id="remote-endpoint-url"
              name="remote_endpoint_url"
              type="url"
              class="w-full border border-white/10 bg-surface-950 px-2 py-2 text-[12px] text-white focus:outline-none"
              placeholder="https://dav.example.com/root"
            />
          </label>
          <label class="space-y-1 text-[11px] text-white/70">
            <span class="block uppercase tracking-[0.18em] text-white/45">{{ t('dataExchange.username') }}</span>
            <input
              v-model="remoteDraft.remote_username"
              id="remote-username"
              name="remote_username"
              type="text"
              class="w-full border border-white/10 bg-surface-950 px-2 py-2 text-[12px] text-white focus:outline-none"
            />
          </label>
          <label class="space-y-1 text-[11px] text-white/70">
            <span class="block uppercase tracking-[0.18em] text-white/45">{{ t('dataExchange.secret') }}</span>
            <input
              v-model="remoteDraft.remote_secret"
              id="remote-secret"
              name="remote_secret"
              type="password"
              class="w-full border border-white/10 bg-surface-950 px-2 py-2 text-[12px] text-white focus:outline-none"
              :placeholder="t('dataExchange.storedLocallyOnly')"
            />
          </label>
          <label class="space-y-1 text-[11px] text-white/70 sm:col-span-2">
            <span class="block uppercase tracking-[0.18em] text-white/45">{{ t('dataExchange.remotePath') }}</span>
            <input
              v-model="remoteDraft.remote_path"
              id="remote-path"
              name="remote_path"
              type="text"
              class="w-full border border-white/10 bg-surface-950 px-2 py-2 text-[12px] text-white focus:outline-none"
              placeholder="/speedtab"
            />
          </label>
          <label class="space-y-1 text-[11px] text-white/70 sm:col-span-2">
            <span class="block uppercase tracking-[0.18em] text-white/45">{{ t('dataExchange.dashboardUrl') }}</span>
            <input
              v-model="remoteDraft.remote_dashboard_url"
              id="remote-dashboard-url"
              name="remote_dashboard_url"
              type="url"
              class="w-full border border-white/10 bg-surface-950 px-2 py-2 text-[12px] text-white focus:outline-none"
              placeholder="https://app.koofr.net/app/"
            />
          </label>
        </div>

        <div v-if="remoteConfigExpanded || !savedRemoteSummary" class="flex flex-wrap items-center gap-2">
          <button
            type="button"
            :disabled="remoteConfigBusy"
            class="st-ui-btn st-ui-btn-primary"
            @click="saveRemoteConfig"
          >
            {{ t('dataExchange.saveRemote') }}
          </button>
          <button
            type="button"
            :disabled="remoteConfigBusy"
            class="st-ui-btn st-ui-btn-danger"
            @click="clearRemoteConfig"
          >
            {{ t('dataExchange.clearRemote') }}
          </button>
          <button
            type="button"
            :disabled="remoteConfigBusy"
            class="st-ui-btn st-ui-btn-info"
            @click="testRemoteConfig"
          >
            {{ t('dataExchange.testConnection') }}
          </button>
          <button
            v-if="savedRemoteSummary && remoteConfigExpanded"
            type="button"
            :disabled="remoteConfigBusy"
            class="st-ui-btn st-ui-btn-secondary"
            @click="remoteConfigExpanded = false"
          >
            {{ t('dataExchange.hideDetails') }}
          </button>
          <span class="text-[10px] uppercase tracking-[0.18em]" :class="draftProviderStatus ? 'text-emerald-200/85' : 'text-white/45'">
            {{ draftProviderStatus ? t('dataExchange.readyToTest') : t('dataExchange.incomplete') }}
          </span>
        </div>

        <p v-if="(remoteConfigExpanded || !savedRemoteSummary) && remoteConfigValidationMessage" class="text-[11px] text-amber-200/90">
          {{ remoteConfigValidationMessage }}
        </p>
        <p v-if="(remoteConfigExpanded || !savedRemoteSummary) && remoteConfigStatus" class="text-[11px] break-all [overflow-wrap:anywhere]" :class="remoteConfigStatus.startsWith(t('dataExchange.status.connectionOk')) || remoteConfigStatus === t('dataExchange.status.remoteConfigSaved') || remoteConfigStatus === t('dataExchange.status.remoteConfigCleared') ? 'text-emerald-200/90' : 'text-amber-200/90'">
          {{ remoteConfigStatus }}
        </p>
      </div>

      <div class="st-ui-card px-3 py-3">
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="text-[10px] uppercase tracking-[0.18em] text-white/45">{{ t('dataExchange.localFileBackup') }}</div>
            <p class="mt-2 text-[12px] text-white">{{ localExportHeadline }}</p>
            <p class="mt-1 text-[11px] leading-5 text-white/65">{{ localExportDetail }}</p>
          </div>
        </div>
        <div
          v-if="showDebug && (exportState.last_exported_at || exportReminderLabel)"
          class="st-data-exchange-debug mt-3 space-y-1 text-[11px] break-all [overflow-wrap:anywhere] text-white/65"
        >
          <p v-if="exportReminderLabel">{{ t('dataExchange.localExportReasons', { reasons: exportReminderLabel }) }}</p>
          <p v-if="exportState.last_exported_at">{{ t('dataExchange.lastLocalExport', { value: exportState.last_exported_at }) }}</p>
        </div>
        <div class="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            class="st-ui-btn st-ui-btn-warning"
            @click="emit('downloadExport')"
          >
            {{ t('dataExchange.downloadExportFile') }}
          </button>
          <button
            type="button"
            class="st-ui-btn st-ui-btn-secondary"
            @click="emit('importLocalFile')"
          >
            {{ t('dataExchange.importLocalFile') }}
          </button>
        </div>
      </div>

      <template v-if="showRemoteUi">
      <div class="st-ui-card px-3 py-3">
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="text-[10px] uppercase tracking-[0.18em] text-white/45">{{ t('dataExchange.remoteSync') }}</div>
            <p class="mt-2 text-[12px] text-white">{{ remoteStatusHeadline }}</p>
            <p v-if="showRecommendedAction" class="mt-1 text-[11px] leading-5 text-white/65">
              {{ recommendedAction }}
            </p>
            <p v-else class="mt-1 text-[11px] leading-5 text-white/65">
              {{ remoteFreshnessDetail }}
            </p>
            <div
              v-if="showDebug && compareInspection"
              class="st-data-exchange-debug mt-2 space-y-1 text-[11px] text-white/60"
            >
              <p v-if="compareInspection.remote?.meta">
                {{ t('dataExchange.remoteChecksum', { checksum: compareInspection.remote.meta.workspace_checksum, exportedAt: compareInspection.remote.meta.exported_at }) }}
              </p>
              <p>{{ t('dataExchange.localChecksum', { checksum: compareInspection.local.checksum }) }}</p>
              <p>{{ compareInspection.archiveExists ? t('dataExchange.remoteArchiveContains') : t('dataExchange.remoteArchiveMissing') }}</p>
            </div>
          </div>
          <div v-if="remoteStatusBadge" class="st-ui-chip shrink-0 text-white/70" :class="remoteHealth ? healthBadgeClass(remoteHealth.health) : ''">
            {{ remoteStatusBadge }}
          </div>
        </div>
        <div class="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            class="st-ui-btn st-ui-btn-info"
            :disabled="remotePushBusy || remotePullBusy"
            @click="refreshRemotePushStatus"
          >
            {{ t('dataExchange.checkStatus') }}
          </button>
          <button
            type="button"
            :disabled="!canPullRemote"
            class="st-ui-btn st-ui-btn-warning"
            @click="handlePullFromRemote"
          >
            {{ remotePullBusy ? t('dataExchange.working') : t('dataExchange.pullFromRemote') }}
          </button>
          <button
            type="button"
            class="st-ui-btn st-ui-btn-info"
            :disabled="remotePullBusy || remotePushBusy"
            @click="refreshRemotePullStatus"
          >
            {{ t('dataExchange.checkRemoteContents') }}
          </button>
          <button
            type="button"
            :disabled="!canPushRemote"
            class="st-ui-btn st-ui-btn-danger"
            :title="t('dataExchange.pushOverwriteTitle')"
            @click="handlePushToRemote"
          >
            {{ remotePushBusy ? t('dataExchange.working') : t('dataExchange.pushToRemote') }}
          </button>
          <button
            type="button"
            :disabled="remoteDownloadBusy"
            class="st-ui-btn st-ui-btn-secondary col-span-2"
            @click="handleDownloadRemoteExport"
          >
            {{ remoteDownloadBusy ? t('dataExchange.downloading') : t('dataExchange.downloadRemoteExport') }}
          </button>
        </div>

        <div
          v-if="showDebug && (remoteActivityStatus || remoteSyncWarnings.length)"
          class="st-data-exchange-debug mt-3 border-t border-white/10 pt-3"
        >
          <div class="text-[10px] uppercase tracking-[0.18em] text-white/45">{{ t('dataExchange.latestActivity') }}</div>
          <p class="mt-2 text-[11px] leading-5 text-white/80">
            {{ remoteActivityStatus ?? t('dataExchange.noRemoteActivity') }}
          </p>
          <ul v-if="remoteSyncWarnings.length" class="mt-2 space-y-1 text-[11px] text-amber-200/90">
            <li v-for="warning in remoteSyncWarnings" :key="warning">{{ warning }}</li>
          </ul>
        </div>
      </div>

      <div class="st-ui-card">
        <div class="border-b border-white/10 px-3 py-2">
          <h3 class="text-[10px] uppercase tracking-[0.22em] text-white/50">
            {{ t('dataExchange.workspaceContent') }}<span v-if="remotePreviewSummary"> | {{ t('dataExchange.localToWebdav') }}</span>
          </h3>
        </div>
        <div class="grid grid-cols-2 gap-px bg-white/10 sm:grid-cols-4">
          <div class="bg-black/30 px-3 py-3">
            <div class="text-[10px] uppercase tracking-[0.18em] text-white/40">{{ t('dataExchange.pages') }}</div>
            <div class="mt-1 text-sm text-white">{{ remotePreviewSummary ? `${localSummary.pages} → ${remotePreviewSummary.pages}` : localSummary.pages }}</div>
          </div>
          <div class="bg-black/30 px-3 py-3">
            <div class="text-[10px] uppercase tracking-[0.18em] text-white/40">{{ t('dataExchange.modules') }}</div>
            <div class="mt-1 text-sm text-white">{{ remotePreviewSummary ? `${localSummary.modules} → ${remotePreviewSummary.modules}` : localSummary.modules }}</div>
          </div>
          <div class="bg-black/30 px-3 py-3">
            <div class="text-[10px] uppercase tracking-[0.18em] text-white/40">{{ t('dataExchange.collections') }}</div>
            <div class="mt-1 text-sm text-white">{{ remotePreviewSummary ? `${localSummary.collections} → ${remotePreviewSummary.collections}` : localSummary.collections }}</div>
          </div>
          <div class="bg-black/30 px-3 py-3">
            <div class="text-[10px] uppercase tracking-[0.18em] text-white/40">{{ t('dataExchange.bookmarks') }}</div>
            <div class="mt-1 text-sm text-white">{{ remotePreviewSummary ? `${localSummary.tabs} → ${remotePreviewSummary.tabs}` : localSummary.tabs }}</div>
          </div>
          <div class="bg-black/30 px-3 py-3">
            <div class="text-[10px] uppercase tracking-[0.18em] text-white/40">{{ t('dataExchange.notes') }}</div>
            <div class="mt-1 text-sm text-white">{{ remotePreviewSummary ? `${localSummary.notes} → ${remotePreviewSummary.notes}` : localSummary.notes }}</div>
          </div>
          <div class="bg-black/30 px-3 py-3">
            <div class="text-[10px] uppercase tracking-[0.18em] text-white/40">{{ t('dataExchange.feeds') }}</div>
            <div class="mt-1 text-sm text-white">{{ remotePreviewSummary ? `${localSummary.feedSources} → ${remotePreviewSummary.feedSources}` : localSummary.feedSources }}</div>
          </div>
          <div class="bg-black/30 px-3 py-3">
            <div class="text-[10px] uppercase tracking-[0.18em] text-white/40">{{ t('dataExchange.archived') }}</div>
            <div class="mt-1 text-sm text-white">{{ remotePreviewSummary ? `${localSummary.savedFeedItems} → ${remotePreviewSummary.savedFeedItems}` : localSummary.savedFeedItems }}</div>
          </div>
          <div class="bg-black/30 px-3 py-3">
            <div class="text-[10px] uppercase tracking-[0.18em] text-white/40">{{ t('dataExchange.assets') }}</div>
            <div class="mt-1 text-sm text-white">{{ remotePreviewSummary ? `${localSummary.assets} → ${remotePreviewSummary.assets}` : localSummary.assets }}</div>
          </div>
        </div>
        <div
          v-if="showDebug && remotePreviewSummary"
          class="st-data-exchange-debug border-t border-white/10 px-3 py-2 space-y-1"
        >
          <p v-if="remotePreviewSummary.exportedAt" class="text-[11px] text-white/65">
            {{ t('dataExchange.remoteExportedAt', { value: remotePreviewSummary.exportedAt }) }}
          </p>
          <p v-if="remotePreviewSummary.checksum" class="text-[11px] text-white/65 break-all [overflow-wrap:anywhere]">
            {{ t('dataExchange.remoteChecksumOnly', { checksum: remotePreviewSummary.checksum }) }}
          </p>
        </div>
      </div>
      </template>
    </div>
  </Modal>
</template>
