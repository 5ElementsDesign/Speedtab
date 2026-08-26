import { getExportState, type LocalExportState } from '@/composables/useExportState'
import { getLocalSettings, updateLocalSettings } from '@/composables/useLocalSettings'
import { inspectRemotePush, pushToRemote } from '@/composables/useRemoteExchange'
import { getRemoteExportProvider, isRemoteProviderConfigured } from '@/composables/useRemoteProvider'
import type { RemoteLocalSettings } from '@/types/remote'
import type { RemoteCompareState } from '@/composables/useRemoteExchange'
export {
  REMOTE_AUTO_SYNC_CHECK_ALARM,
  REMOTE_AUTO_SYNC_MARK_DIRTY_MESSAGE,
  REMOTE_AUTO_SYNC_PUSH_ALARM,
  REMOTE_AUTO_SYNC_PUSH_DEBOUNCE_MS,
  REMOTE_AUTO_SYNC_REFRESH_MESSAGE,
  requestRemoteAutoSyncDirty,
  requestRemoteAutoSyncRefresh,
} from '@/composables/remoteAutoSyncProtocol'
export {
  getRemoteAutoSyncUiStatus,
  REMOTE_AUTO_SYNC_STALE_CHECK_MS,
  resolveRemoteAutoSyncIntervalMs,
  type RemoteAutoSyncUiState,
  type RemoteAutoSyncUiStatus,
} from '@/composables/remoteAutoSyncStatus'
type AutoSyncPassResult =
  | 'disabled'
  | 'not_configured'
  | 'offline'
  | 'clean'
  | 'blocked'
  | 'pushed'

export type RemoteAutoSyncCheckResult =
  | 'disabled'
  | 'not_configured'
  | 'offline'
  | 'missing'
  | 'ok'
  | 'error'

interface RemoteAutoSyncDeps {
  getLocalSettings: typeof getLocalSettings
  updateLocalSettings: typeof updateLocalSettings
  getExportState: typeof getExportState
  getRemoteExportProvider: typeof getRemoteExportProvider
  inspectRemotePush: typeof inspectRemotePush
  pushToRemote: typeof pushToRemote
  isRemoteProviderConfigured: typeof isRemoteProviderConfigured
}

const defaultDeps: RemoteAutoSyncDeps = {
  getLocalSettings,
  updateLocalSettings,
  getExportState,
  getRemoteExportProvider,
  inspectRemotePush,
  pushToRemote,
  isRemoteProviderConfigured,
}

function isAutoSyncEnabled(settings: RemoteLocalSettings): boolean {
  return settings.remote_auto_sync_enabled === true
}

function hasPendingRemoteSync(exportState: LocalExportState): boolean {
  return exportState.export_dirty === true && exportState.remote_out_of_date === true
}

function isBlockedCompareState(state: RemoteCompareState | 'not_configured'): boolean {
  return state === 'divergent'
    || state === 'remote_newer'
    || state === 'version_mismatch'
    || state === 'unknown_endpoint_context'
}

function isPushableCompareState(state: RemoteCompareState | 'not_configured'): boolean {
  return state === 'local_newer'
    || state === 'remote_missing'
}


export async function runRemoteAutoSyncCheckPass(deps: RemoteAutoSyncDeps = defaultDeps): Promise<RemoteAutoSyncCheckResult> {
  const settings = await deps.getLocalSettings()
  const now = Date.now()

  if (!isAutoSyncEnabled(settings)) {
    await deps.updateLocalSettings({
      remote_auto_sync_last_check_at: now,
      remote_auto_sync_last_check_result: 'disabled',
    })
    return 'disabled'
  }

  if (!deps.isRemoteProviderConfigured(settings)) {
    await deps.updateLocalSettings({
      remote_auto_sync_last_check_at: now,
      remote_auto_sync_last_check_result: 'not_configured',
    })
    return 'not_configured'
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    await deps.updateLocalSettings({
      remote_auto_sync_last_check_at: now,
      remote_auto_sync_last_check_result: 'offline',
    })
    return 'offline'
  }

  const provider = await deps.getRemoteExportProvider()
  const metaResult = await provider.downloadMeta()

  if (!metaResult.ok) {
    const result = metaResult.error.code === 'file_missing' ? 'missing' : 'error'
    await deps.updateLocalSettings({
      remote_auto_sync_last_check_at: now,
      remote_auto_sync_last_check_checksum: null,
      remote_auto_sync_last_check_result: result,
    })
    return result
  }

  await deps.updateLocalSettings({
    remote_auto_sync_last_check_at: now,
    remote_auto_sync_last_check_checksum: metaResult.value.workspace_checksum,
    remote_auto_sync_last_check_result: 'ok',
  })
  return 'ok'
}

export async function runRemoteAutoSyncPass(deps: RemoteAutoSyncDeps = defaultDeps): Promise<AutoSyncPassResult> {
  const settings = await deps.getLocalSettings()
  const now = Date.now()

  if (!isAutoSyncEnabled(settings)) {
    await deps.updateLocalSettings({
      remote_auto_sync_last_push_at: now,
      remote_auto_sync_last_push_result: 'disabled',
    })
    return 'disabled'
  }
  if (!deps.isRemoteProviderConfigured(settings)) {
    await deps.updateLocalSettings({
      remote_auto_sync_last_push_at: now,
      remote_auto_sync_last_push_result: 'not_configured',
    })
    return 'not_configured'
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    await deps.updateLocalSettings({
      remote_auto_sync_last_push_at: now,
      remote_auto_sync_last_push_result: 'offline',
    })
    return 'offline'
  }

  const exportState = await deps.getExportState()
  const provider = await deps.getRemoteExportProvider()
  const inspection = await deps.inspectRemotePush({ provider })

  if (isBlockedCompareState(inspection.state)) {
    await deps.updateLocalSettings({
      remote_auto_sync_last_push_at: now,
      remote_auto_sync_last_push_result: 'blocked',
    })
    return 'blocked'
  }

  const pendingByFlags = hasPendingRemoteSync(exportState)
  const pendingByComparison = isPushableCompareState(inspection.state)

  if (!pendingByFlags && !pendingByComparison) {
    await deps.updateLocalSettings({
      remote_auto_sync_last_push_at: now,
      remote_auto_sync_last_push_result: 'clean',
    })
    return 'clean'
  }

  await deps.pushToRemote({
    provider,
    confirmOverwrite: async () => true,
  })
  await deps.updateLocalSettings({
    remote_auto_sync_last_push_at: now,
    remote_auto_sync_last_push_result: 'pushed',
  })
  return 'pushed'
}
