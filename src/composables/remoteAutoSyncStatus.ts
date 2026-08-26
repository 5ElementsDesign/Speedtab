import type { RemoteCompareState } from '@/composables/useRemoteExchange'
import type { LocalExportState } from '@/composables/useExportState'
import type { RemoteLocalSettings } from '@/types/remote'

const DEFAULT_AUTO_SYNC_INTERVAL_MINUTES = 10
const MIN_INTERVAL_MINUTES = 1
const MAX_INTERVAL_MINUTES = 1_440

export const REMOTE_AUTO_SYNC_STALE_CHECK_MS = 10 * 60_000

export function resolveRemoteAutoSyncIntervalMs(settings: Pick<RemoteLocalSettings, 'remote_auto_sync_enabled' | 'remote_auto_sync_interval_minutes'>): number {
  if (!settings.remote_auto_sync_enabled) return 0
  const interval = settings.remote_auto_sync_interval_minutes ?? DEFAULT_AUTO_SYNC_INTERVAL_MINUTES
  if (interval < 1) return 0
  const minutes = Math.min(MAX_INTERVAL_MINUTES, Math.max(MIN_INTERVAL_MINUTES, Math.trunc(interval)))
  return minutes * 60_000
}

export type RemoteAutoSyncUiState = 'disabled' | 'not_configured' | 'offline' | 'blocked' | 'pending' | 'idle'

export interface RemoteAutoSyncUiStatus {
  state: RemoteAutoSyncUiState
  interval_minutes: number | null
}

export function getRemoteAutoSyncUiStatus(
  settings: Pick<RemoteLocalSettings, 'remote_auto_sync_enabled' | 'remote_auto_sync_interval_minutes'>,
  exportState: Pick<LocalExportState, 'export_dirty' | 'remote_out_of_date'> | null | undefined,
  compareState: RemoteCompareState | null = null,
): RemoteAutoSyncUiStatus {
  if (!settings.remote_auto_sync_enabled) return {state: 'disabled', interval_minutes: null}

  const intervalMinutes = settings.remote_auto_sync_interval_minutes == null
    ? DEFAULT_AUTO_SYNC_INTERVAL_MINUTES
    : Math.max(MIN_INTERVAL_MINUTES, Math.trunc(settings.remote_auto_sync_interval_minutes))

  if (typeof navigator !== 'undefined' && navigator.onLine === false) return {state: 'offline', interval_minutes: intervalMinutes}
  if (['divergent', 'remote_newer', 'version_mismatch', 'unknown_endpoint_context'].includes(compareState ?? '')) return {state: 'blocked', interval_minutes: intervalMinutes}
  if (exportState?.export_dirty === true && exportState.remote_out_of_date === true) return {state: 'pending', interval_minutes: intervalMinutes}
  return {state: 'idle', interval_minutes: intervalMinutes}
}
