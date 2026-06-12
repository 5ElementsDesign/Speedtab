import packageJson from '../../package.json'
import {
  clearRemoteOutOfDate as clearRemoteOutOfDateDefault,
  noteImportedWorkspace as noteImportedWorkspaceDefault,
} from '@/composables/useExportState'
import {
  exportAll,
  importAll,
  manifestChecksum,
  manifestToJsonString,
  parseManifestText,
  type BackupManifestV2,
  type ImportReport,
} from '@/composables/useBackup'
import {
  getRemoteExportProvider,
  type RemoteExportProvider,
  type RemoteProviderRequestOptions,
} from '@/composables/useRemoteProvider'
import { updateLocalSettings } from '@/composables/useLocalSettings'
import { db as defaultDb, type SpeedtabDB } from '@/db/db'
import { cleanupOrphans, type CleanupReport } from '@/composables/useMaintenance'
import en from '@/locales/en'
import type { RemoteExportMetadata, RemoteProviderVerifyResult } from '@/types/remote'

export type RemoteCompareState =
  | 'identical'
  | 'remote_missing'
  | 'up_to_date'
  | 'remote_newer'
  | 'local_newer'
  | 'divergent'
  | 'version_mismatch'
  | 'unknown_endpoint_context'

export interface RemoteExportArtifacts {
  manifest: BackupManifestV2
  checksum: string
  exportBlob: Blob
  metadata: RemoteExportMetadata
}

export interface RemotePushInspection {
  state: RemoteCompareState | 'not_configured'
  local: RemoteExportArtifacts
  remote: RemoteProviderVerifyResult | null
  archiveExists: boolean
  warnings: string[]
}

export interface RemotePushResult {
  outcome: 'pushed' | 'up_to_date' | 'partial'
  inspection: RemotePushInspection
  warnings: string[]
}

export type RemotePullState =
  | 'not_configured'
  | 'remote_missing'
  | 'ready'
  | 'legacy_manifest'
  | 'up_to_date'
  | 'unknown_endpoint_context'

export interface RemotePullPreview {
  state: RemotePullState
  remoteMeta: RemoteExportMetadata | null
  providerId: string | null
  warnings: string[]
}

export interface RemotePullResult {
  preview: RemotePullPreview
  report: ImportReport
  cleanup: CleanupReport
}

export type RemoteVerifyHealth =
  | 'healthy'
  | 'sidecar_missing'
  | 'export_missing'
  | 'metadata_mismatch'
  | 'corrupt_metadata'
  | 'auth_failure'
  | 'network_error'
  | 'not_configured'

export interface RemoteVerifyDiagnostics {
  health: RemoteVerifyHealth
  providerId: string | null
  remote: RemoteProviderVerifyResult | null
  message: string
  guidance: string
  repairActions: Array<'push' | 'verify' | 'pull' | 'download_remote'>
  warnings: string[]
}

export interface PushToRemoteOptions {
  provider?: RemoteExportProvider
  confirmOverwrite?: (inspection: RemotePushInspection) => boolean | Promise<boolean>
  database?: SpeedtabDB
  signal?: AbortSignal
  timeoutMs?: number
}

type UpdateLocalSettingsFn = typeof updateLocalSettings

interface RemoteExchangeDeps {
  exportAll: typeof exportAll
  importAll: typeof importAll
  manifestChecksum: typeof manifestChecksum
  manifestToJsonString: typeof manifestToJsonString
  parseManifestText: typeof parseManifestText
  getRemoteExportProvider: typeof getRemoteExportProvider
  updateLocalSettings: UpdateLocalSettingsFn
  cleanupOrphans: typeof cleanupOrphans
  clearRemoteOutOfDate: typeof clearRemoteOutOfDateDefault
  noteImportedWorkspace: typeof noteImportedWorkspaceDefault
}

const defaultDeps: RemoteExchangeDeps = {
  exportAll,
  importAll,
  manifestChecksum,
  manifestToJsonString,
  parseManifestText,
  getRemoteExportProvider,
  updateLocalSettings,
  cleanupOrphans,
  clearRemoteOutOfDate: clearRemoteOutOfDateDefault,
  noteImportedWorkspace: noteImportedWorkspaceDefault,
}

const remoteStatus = en.dataExchange.status
const remoteConfirm = en.dataExchange.confirm

export function getCompareActions(state: RemoteCompareState): Array<'push' | 'pull' | 'download_both' | 'download_remote'> {
  switch (state) {
    case 'identical':
    case 'up_to_date':
      return ['download_remote']
    case 'remote_missing':
    case 'local_newer':
      return ['push', 'download_remote']
    case 'remote_newer':
      return ['pull', 'download_both']
    case 'divergent':
    case 'version_mismatch':
    case 'unknown_endpoint_context':
      return ['push', 'pull', 'download_both']
  }
}

async function blobToText(blob: Blob): Promise<string> {
  if (typeof blob.text === 'function') {
    return blob.text()
  }
  if (typeof blob.arrayBuffer === 'function') {
    const bytes = new Uint8Array(await blob.arrayBuffer())
    return new TextDecoder().decode(bytes)
  }

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(
      reader.error ?? new Error(remoteStatus.remoteDownloadFailed.replace('{message}', 'Failed to read remote export blob'))
    )
    reader.readAsText(blob)
  })
}

function classifyRemoteState(
  settings: RemoteExportProvider['settings'],
  local: RemoteExportArtifacts,
  remote: RemoteProviderVerifyResult,
): RemoteCompareState {
  if (!remote.meta_exists && !remote.export_exists) {
    return 'remote_missing'
  }

  if (!remote.meta) {
    return remote.export_exists ? 'divergent' : 'remote_missing'
  }

  if (remote.meta.manifest_version !== local.metadata.manifest_version) {
    return 'version_mismatch'
  }

  if (
    remote.meta.provider_endpoint_hash &&
    remote.provider_id &&
    remote.meta.provider_endpoint_hash !== remote.provider_id
  ) {
    return 'unknown_endpoint_context'
  }

  if (remote.meta.workspace_checksum === local.checksum) {
    return 'identical'
  }

  if (
    settings.last_remote_pull_checksum &&
    remote.meta.workspace_checksum === settings.last_remote_pull_checksum &&
    local.checksum !== remote.meta.workspace_checksum
  ) {
    return 'local_newer'
  }

  if (
    settings.last_remote_push_checksum &&
    local.checksum === settings.last_remote_push_checksum &&
    remote.meta.workspace_checksum !== local.checksum
  ) {
    return 'remote_newer'
  }

  if (
    settings.last_remote_seen_checksum &&
    remote.meta.workspace_checksum === settings.last_remote_seen_checksum &&
    settings.last_known_local_checksum === local.checksum &&
    local.checksum !== remote.meta.workspace_checksum
  ) {
    return 'local_newer'
  }

  if (
    settings.last_known_local_checksum === local.checksum &&
    settings.last_remote_seen_checksum &&
    settings.last_remote_seen_checksum !== remote.meta.workspace_checksum
  ) {
    return 'remote_newer'
  }

  return 'divergent'
}

function shouldConfirmOverwrite(state: RemotePushInspection['state']): boolean {
  return !['remote_missing', 'identical', 'up_to_date'].includes(state)
}

function hasKnownRemoteBaseline(settings: RemoteExportProvider['settings']): boolean {
  return !!(
    settings.last_remote_pull_checksum ||
    settings.last_remote_push_checksum ||
    settings.last_remote_seen_checksum
  )
}

function getNoBaselineOverwriteWarning(
  settings: RemoteExportProvider['settings'],
  state: RemotePushInspection['state'],
): string | null {
  if (hasKnownRemoteBaseline(settings)) return null
  if (!shouldConfirmOverwrite(state)) return null

  return remoteConfirm.noRemoteBaseline
}

function makeInspectionMessage(inspection: RemotePushInspection): string {
  switch (inspection.state) {
    case 'remote_missing':
      return remoteConfirm.remoteMissingUpload
    case 'identical':
    case 'up_to_date':
      return remoteConfirm.remoteAlreadyMatchesWorkspace
    case 'remote_newer':
      return remoteConfirm.remoteNewerOverwrite
    case 'local_newer':
      return remoteConfirm.localNewerUpload
    case 'divergent':
      return remoteConfirm.remoteDiffersOverwrite
    case 'version_mismatch':
      return remoteConfirm.versionMismatchOverwrite
    case 'unknown_endpoint_context':
      return remoteConfirm.endpointContextOverwrite
    case 'not_configured':
      return remoteConfirm.providerNotConfigured
  }
}

async function buildRemoteExportArtifacts(
  deps: RemoteExchangeDeps,
  database: SpeedtabDB = defaultDb,
): Promise<RemoteExportArtifacts> {
  const manifest = await deps.exportAll(database)
  const checksum = await deps.manifestChecksum(manifest)
  const exportJson = deps.manifestToJsonString(manifest)
  const exportBlob = new Blob([exportJson], { type: 'application/json' })

  return {
    manifest,
    checksum,
    exportBlob,
    metadata: {
      manifest_version: manifest.version,
      app_version: packageJson.version,
      exported_at: manifest.exported_at,
      workspace_checksum: checksum,
      source_device_label: null,
      provider_endpoint_hash: null,
    },
  }
}

export async function inspectRemotePush(
  options: { provider?: RemoteExportProvider; database?: SpeedtabDB; signal?: AbortSignal; timeoutMs?: number } = {},
  deps: RemoteExchangeDeps = defaultDeps,
): Promise<RemotePushInspection> {
  const provider = options.provider ?? await deps.getRemoteExportProvider()
  const local = await buildRemoteExportArtifacts(deps, options.database)

  await deps.updateLocalSettings({
    last_known_local_checksum: local.checksum,
  })

  local.metadata.source_device_label = provider.settings.device_label

  if (!provider.isConfigured()) {
    return {
      state: 'not_configured',
      local,
      remote: null,
      archiveExists: false,
      warnings: [remoteStatus.providerNotConfigured],
    }
  }

  const verifyResult = await provider.verify({
    signal: options.signal,
    timeoutMs: options.timeoutMs,
  })
  const noBaselineWarning = getNoBaselineOverwriteWarning(provider.settings, 'remote_missing')
  if (!verifyResult.ok) {
    if (verifyResult.error.code === 'file_missing') {
      const archiveResult = await provider.archiveExists(local.checksum, {
        signal: options.signal,
        timeoutMs: options.timeoutMs,
      })
      return {
        state: 'remote_missing',
        local,
        remote: null,
        archiveExists: archiveResult.ok ? archiveResult.value : false,
        warnings: [
          ...(archiveResult.ok
          ? [remoteStatus.remoteMissing]
          : [remoteStatus.remoteMissing, archiveResult.error.message]),
          ...(noBaselineWarning ? [noBaselineWarning] : []),
        ],
      }
    }

    throw new Error(verifyResult.error.message)
  }

  local.metadata.provider_endpoint_hash = verifyResult.value.provider_id
  const archiveResult = await provider.archiveExists(local.checksum, {
    signal: options.signal,
    timeoutMs: options.timeoutMs,
  })
  const archiveWarnings = archiveResult.ok ? [] : [archiveResult.error.message]

  const state = classifyRemoteState(provider.settings, local, verifyResult.value)
  const baselineWarning = getNoBaselineOverwriteWarning(provider.settings, state)

  return {
    state,
    local,
    remote: verifyResult.value,
    archiveExists: archiveResult.ok ? archiveResult.value : false,
    warnings: [...verifyResult.value.warnings, ...archiveWarnings, ...(baselineWarning ? [baselineWarning] : [])],
  }
}

export async function pushToRemote(
  options: PushToRemoteOptions = {},
  deps: RemoteExchangeDeps = defaultDeps,
): Promise<RemotePushResult> {
  const provider = options.provider ?? await deps.getRemoteExportProvider()
  const requestOptions: RemoteProviderRequestOptions = {
    signal: options.signal,
    timeoutMs: options.timeoutMs,
  }
  const inspection = await inspectRemotePush({ provider, database: options.database, ...requestOptions }, deps)

  if (inspection.state === 'not_configured') {
    throw new Error(remoteStatus.providerNotConfigured)
  }

  const ensureArchive = async () => {
    if (inspection.archiveExists) {
      return {
        archiveExists: true,
        warnings: [] as string[],
      }
    }

    const archiveUpload = await provider.uploadArchive(inspection.local.checksum, inspection.local.exportBlob, requestOptions)
    if (archiveUpload.ok) {
      return {
        archiveExists: true,
        warnings: [] as string[],
      }
    }

    return {
      archiveExists: false,
      warnings: [remoteStatus.remoteArchiveUploadSkipped.replace('{message}', archiveUpload.error.message)],
    }
  }

  if (inspection.state === 'identical' || inspection.state === 'up_to_date') {
    const archive = await ensureArchive()
    return {
      outcome: archive.archiveExists ? 'pushed' : 'up_to_date',
      inspection: {
        ...inspection,
        archiveExists: archive.archiveExists,
      },
      warnings: [
        remoteStatus.remoteAlreadyMatchesLocal,
        ...archive.warnings,
      ],
    }
  }

  if (shouldConfirmOverwrite(inspection.state)) {
    const confirmed = await (options.confirmOverwrite?.(inspection) ?? globalThis.confirm?.(makeInspectionMessage(inspection)) ?? false)
    if (!confirmed) {
      throw new Error(remoteStatus.remotePushCancelled)
    }
  }

  const exportUpload = await provider.uploadExport(inspection.local.exportBlob, requestOptions)
  if (!exportUpload.ok) {
    throw new Error(exportUpload.error.message)
  }

  const archive = await ensureArchive()

  await deps.updateLocalSettings({
    last_remote_push_checksum: inspection.local.checksum,
    last_remote_push_exported_at: inspection.local.metadata.exported_at,
    last_remote_provider_id: exportUpload.value.provider_id,
    last_known_local_checksum: inspection.local.checksum,
  })

  const metadata = {
    ...inspection.local.metadata,
    source_device_label: provider.settings.device_label,
    provider_endpoint_hash: exportUpload.value.provider_id,
  }

  const metaUpload = await provider.uploadMeta(metadata, requestOptions)
  if (!metaUpload.ok) {
    return {
      outcome: 'partial',
      inspection: {
        ...inspection,
        local: {
          ...inspection.local,
          metadata,
        },
      },
      warnings: [
        remoteStatus.exportUploadedRepairNeeded,
        ...archive.warnings,
        metaUpload.error.message,
      ],
    }
  }

  await deps.updateLocalSettings({
    last_remote_provider_id: metaUpload.value.provider_id,
    last_remote_seen_checksum: inspection.local.checksum,
    last_remote_seen_exported_at: inspection.local.metadata.exported_at,
    last_remote_source_device: provider.settings.device_label,
  })
  await deps.clearRemoteOutOfDate({ pushChecksum: inspection.local.checksum }, options.database ?? defaultDb)

  return {
    outcome: 'pushed',
    inspection: {
      ...inspection,
      archiveExists: archive.archiveExists,
      local: {
        ...inspection.local,
        metadata,
      },
    },
    warnings: [...inspection.warnings, ...archive.warnings],
  }
}

export async function downloadRemoteExportArtifact(
  options: { provider?: RemoteExportProvider; signal?: AbortSignal; timeoutMs?: number } = {},
  deps: RemoteExchangeDeps = defaultDeps,
): Promise<{ blob: Blob; filename: string }> {
  const provider = options.provider ?? await deps.getRemoteExportProvider()
  const requestOptions: RemoteProviderRequestOptions = {
    signal: options.signal,
    timeoutMs: options.timeoutMs,
  }
  const preview = await previewRemotePull({ provider, ...requestOptions }, deps)
  if (preview.state === 'not_configured') {
    throw new Error(remoteStatus.providerNotConfigured)
  }

  const exportResult = await provider.downloadExport(requestOptions)
  if (!exportResult.ok) {
    throw new Error(exportResult.error.message)
  }

  const suffix = preview.remoteMeta?.workspace_checksum ?? 'remote'
  return {
    blob: exportResult.value,
    filename: `speedtab-remote-${suffix}.json`,
  }
}

export async function verifyRemoteHealth(
  options: { provider?: RemoteExportProvider; signal?: AbortSignal; timeoutMs?: number } = {},
  deps: RemoteExchangeDeps = defaultDeps,
): Promise<RemoteVerifyDiagnostics> {
  const provider = options.provider ?? await deps.getRemoteExportProvider()
  if (!provider.isConfigured()) {
    return {
      health: 'not_configured',
      providerId: null,
      remote: null,
      message: remoteStatus.providerNotConfigured,
      guidance: remoteStatus.remoteProviderNotConfiguredGuidance,
      repairActions: [],
      warnings: [remoteStatus.providerNotConfigured],
    }
  }

  const verifyResult = await provider.verify({
    signal: options.signal,
    timeoutMs: options.timeoutMs,
  })
  if (!verifyResult.ok) {
    switch (verifyResult.error.code) {
      case 'auth_failed':
        return {
          health: 'auth_failure',
          providerId: null,
          remote: null,
          message: remoteStatus.remoteAuthenticationFailed,
          guidance: remoteStatus.remoteAuthenticationGuidance,
          repairActions: ['verify'],
          warnings: [verifyResult.error.message],
        }
      case 'corrupt_remote_state':
        return {
          health: 'corrupt_metadata',
          providerId: null,
          remote: null,
          message: remoteStatus.remoteMetadataCorrupt,
          guidance: remoteStatus.remoteMetadataCorruptGuidance,
          repairActions: ['push', 'download_remote', 'verify'],
          warnings: [verifyResult.error.message],
        }
      default:
        return {
          health: 'network_error',
          providerId: null,
          remote: null,
          message: remoteStatus.remoteVerificationFailed,
          guidance: remoteStatus.remoteVerificationGuidance,
          repairActions: ['verify'],
          warnings: [verifyResult.error.message],
        }
    }
  }

  const remote = verifyResult.value
  if (remote.export_exists && !remote.meta_exists) {
    return {
      health: 'sidecar_missing',
      providerId: remote.provider_id,
      remote,
      message: remoteStatus.remoteSidecarMissing,
      guidance: remoteStatus.remoteSidecarMissingGuidance,
      repairActions: ['push', 'pull', 'download_remote', 'verify'],
      warnings: remote.warnings,
    }
  }

  if (!remote.export_exists && remote.meta_exists) {
    return {
      health: 'export_missing',
      providerId: remote.provider_id,
      remote,
      message: remoteStatus.remoteExportFileMissing,
      guidance: remoteStatus.remoteExportFileMissingGuidance,
      repairActions: ['push', 'verify'],
      warnings: remote.warnings,
    }
  }

  if (remote.warnings.some((warning) => warning.toLowerCase().includes('different endpoint context'))) {
    return {
      health: 'metadata_mismatch',
      providerId: remote.provider_id,
      remote,
      message: remoteStatus.remoteMetadataContextMismatch,
      guidance: remoteStatus.remoteMetadataContextMismatchGuidance,
      repairActions: ['push', 'download_remote', 'verify'],
      warnings: remote.warnings,
    }
  }

  return {
    health: 'healthy',
    providerId: remote.provider_id,
    remote,
    message: remoteStatus.remoteHealthy,
    guidance: remoteStatus.remoteHealthyGuidance,
    repairActions: ['verify', 'download_remote'],
    warnings: remote.warnings,
  }
}

function classifyRemotePullPreview(
  provider: RemoteExportProvider,
  remote: RemoteProviderVerifyResult,
): RemotePullPreview {
  if (!remote.export_exists && !remote.meta_exists) {
    return {
      state: 'remote_missing',
      remoteMeta: remote.meta,
      providerId: remote.provider_id,
      warnings: [remoteStatus.remoteMissing],
    }
  }

  if (
    remote.meta?.provider_endpoint_hash &&
    remote.provider_id &&
    remote.meta.provider_endpoint_hash !== remote.provider_id
  ) {
    return {
      state: 'unknown_endpoint_context',
      remoteMeta: remote.meta,
      providerId: remote.provider_id,
      warnings: [...remote.warnings],
    }
  }

  if (
    remote.meta?.workspace_checksum &&
    provider.settings.last_remote_pull_checksum &&
    remote.meta.workspace_checksum === provider.settings.last_remote_pull_checksum
  ) {
    return {
      state: 'up_to_date',
      remoteMeta: remote.meta,
      providerId: remote.provider_id,
      warnings: [...remote.warnings],
    }
  }

  return {
    state: 'ready',
    remoteMeta: remote.meta,
    providerId: remote.provider_id,
    warnings: [...remote.warnings],
  }
}

export async function previewRemotePull(
  options: { provider?: RemoteExportProvider; signal?: AbortSignal; timeoutMs?: number } = {},
  deps: RemoteExchangeDeps = defaultDeps,
): Promise<RemotePullPreview> {
  const provider = options.provider ?? await deps.getRemoteExportProvider()
  if (!provider.isConfigured()) {
    return {
      state: 'not_configured',
      remoteMeta: null,
      providerId: null,
      warnings: [remoteStatus.providerNotConfigured],
    }
  }

  const verifyResult = await provider.verify({
    signal: options.signal,
    timeoutMs: options.timeoutMs,
  })
  if (!verifyResult.ok) {
    if (verifyResult.error.code === 'file_missing') {
      return {
        state: 'remote_missing',
        remoteMeta: null,
        providerId: null,
        warnings: [remoteStatus.remoteMissing],
      }
    }
    throw new Error(verifyResult.error.message)
  }

  return classifyRemotePullPreview(provider, verifyResult.value)
}

export async function pullFromRemote(
  options: {
    provider?: RemoteExportProvider
    confirmImport?: (preview: RemotePullPreview) => boolean | Promise<boolean>
    database?: SpeedtabDB
    signal?: AbortSignal
    timeoutMs?: number
  } = {},
  deps: RemoteExchangeDeps = defaultDeps,
): Promise<RemotePullResult> {
  const provider = options.provider ?? await deps.getRemoteExportProvider()
  const requestOptions: RemoteProviderRequestOptions = {
    signal: options.signal,
    timeoutMs: options.timeoutMs,
  }
  const preview = await previewRemotePull({ provider, ...requestOptions }, deps)

  if (preview.state === 'not_configured') {
    throw new Error(remoteStatus.providerNotConfigured)
  }
  if (preview.state === 'remote_missing') {
    throw new Error(remoteStatus.remoteMissing)
  }

  const confirmed = await (options.confirmImport?.(preview) ?? globalThis.confirm?.([
    preview.state === 'up_to_date'
      ? remoteStatus.remoteMatchesLastPulled
      : remoteStatus.remotePullQuestion,
    preview.remoteMeta
      ? remoteStatus.remoteExportedAtOnly.replace('{value}', preview.remoteMeta.exported_at)
      : remoteStatus.remoteMetadataUnavailable,
  ].join('\n\n')) ?? false)

  if (!confirmed) {
    throw new Error(remoteStatus.remotePullCancelled)
  }

  const exportResult = await provider.downloadExport(requestOptions)
  if (!exportResult.ok) {
    throw new Error(exportResult.error.message)
  }

  const manifest = deps.parseManifestText(await blobToText(exportResult.value))
  const report = await deps.importAll(manifest, {}, options.database ?? defaultDb)
  const cleanup = await deps.cleanupOrphans(options.database ?? defaultDb)
  await deps.noteImportedWorkspace('import:remote', options.database ?? defaultDb)

  await deps.updateLocalSettings({
    last_remote_pull_checksum: preview.remoteMeta?.workspace_checksum ?? null,
    last_remote_pull_exported_at: preview.remoteMeta?.exported_at ?? manifest.exported_at,
    last_remote_provider_id: preview.providerId,
    last_remote_source_device: preview.remoteMeta?.source_device_label ?? null,
    last_remote_seen_checksum: preview.remoteMeta?.workspace_checksum ?? null,
    last_remote_seen_exported_at: preview.remoteMeta?.exported_at ?? manifest.exported_at,
    last_known_local_checksum: null,
  })

  return {
    preview: manifest.version === 1
      ? { ...preview, state: 'legacy_manifest', warnings: [...preview.warnings, remoteStatus.legacyRemoteManifestDetected] }
      : preview,
    report,
    cleanup,
  }
}
