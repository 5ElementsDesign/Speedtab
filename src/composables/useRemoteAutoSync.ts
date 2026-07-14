import { getExportState, type LocalExportState } from '@/composables/useExportState'
import { getLocalSettings, updateLocalSettings } from '@/composables/useLocalSettings'
import { inspectRemotePush, pushToRemote } from '@/composables/useRemoteExchange'
import { getRemoteExportProvider, isRemoteProviderConfigured } from '@/composables/useRemoteProvider'
import type { RemoteLocalSettings } from '@/types/remote'
import type { RemoteCompareState } from '@/composables/useRemoteExchange'

const DEFAULT_AUTO_SYNC_INTERVAL_MINUTES = 10
const MIN_INTERVAL_MINUTES = 1
const MAX_INTERVAL_MINUTES = 1_440
export const REMOTE_AUTO_SYNC_STALE_CHECK_MS = 10 * 60_000
export const REMOTE_AUTO_SYNC_PUSH_DEBOUNCE_MS = 15_000

export const REMOTE_AUTO_SYNC_REFRESH_MESSAGE = 'REMOTE_AUTO_SYNC_REFRESH'
export const REMOTE_AUTO_SYNC_MARK_DIRTY_MESSAGE = 'REMOTE_AUTO_SYNC_MARK_DIRTY'
export const REMOTE_AUTO_SYNC_CHECK_ALARM = 'speedtab-remote-auto-sync-check'
export const REMOTE_AUTO_SYNC_PUSH_ALARM = 'speedtab-remote-auto-sync-push'

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

export function resolveRemoteAutoSyncIntervalMs(settings: Pick<RemoteLocalSettings, 'remote_auto_sync_enabled' | 'remote_auto_sync_interval_minutes'>): number {
  if (!settings.remote_auto_sync_enabled) return 0
  const interval = settings.remote_auto_sync_interval_minutes ?? DEFAULT_AUTO_SYNC_INTERVAL_MINUTES
  if (interval < 1) return 0
  const minutes = Math.min(MAX_INTERVAL_MINUTES, Math.max(MIN_INTERVAL_MINUTES, Math.trunc(interval)))
  return minutes * 60_000
}

export type RemoteAutoSyncUiState =
  | 'disabled'
  | 'not_configured'
  | 'offline'
  | 'blocked'
  | 'pending'
  | 'idle'

export interface RemoteAutoSyncUiStatus {
  state: RemoteAutoSyncUiState
  interval_minutes: number | null
}

export function getRemoteAutoSyncUiStatus(
  settings: Pick<RemoteLocalSettings, 'remote_auto_sync_enabled' | 'remote_auto_sync_interval_minutes'>,
  exportState: Pick<LocalExportState, 'export_dirty' | 'remote_out_of_date'> | null | undefined,
  compareState: RemoteCompareState | null = null,
): RemoteAutoSyncUiStatus {
  if (!settings.remote_auto_sync_enabled) {
    return {state: 'disabled', interval_minutes: null}
  }

  const intervalMinutes = settings.remote_auto_sync_interval_minutes == null
    ? DEFAULT_AUTO_SYNC_INTERVAL_MINUTES
    : Math.max(MIN_INTERVAL_MINUTES, Math.trunc(settings.remote_auto_sync_interval_minutes))

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return {state: 'offline', interval_minutes: intervalMinutes}
  }

  if (compareState === 'divergent' || compareState === 'remote_newer' || compareState === 'version_mismatch' || compareState === 'unknown_endpoint_context') {
    return {state: 'blocked', interval_minutes: intervalMinutes}
  }

  if (exportState?.export_dirty === true && exportState?.remote_out_of_date === true) {
    return {state: 'pending', interval_minutes: intervalMinutes}
  }

  return {state: 'idle', interval_minutes: intervalMinutes}
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

export async function requestRemoteAutoSyncRefresh() {
  if (!chrome?.runtime?.sendMessage) return
  try {
    await chrome.runtime.sendMessage({type: REMOTE_AUTO_SYNC_REFRESH_MESSAGE})
  } catch {
    // Ignore if the background is not reachable yet.
  }
}

export async function requestRemoteAutoSyncDirty() {
  if (!chrome?.runtime?.sendMessage) return
  try {
    await chrome.runtime.sendMessage({type: REMOTE_AUTO_SYNC_MARK_DIRTY_MESSAGE})
  } catch {
    // Ignore if the background is not reachable yet.
  }
}

export function startRemoteAutoSync(): void {
  void requestRemoteAutoSyncRefresh()
}

export function stopRemoteAutoSync(): void {
  // Background alarms are the source of truth now.
}
