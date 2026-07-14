import { DEFAULT_LOCAL_EXPORT_STATE } from '@/composables/useExportState'
import {
  getRemoteAutoSyncUiStatus,
  runRemoteAutoSyncPass,
  resolveRemoteAutoSyncIntervalMs,
} from '@/composables/useRemoteAutoSync'
import { DEFAULT_REMOTE_LOCAL_SETTINGS } from '@/types/remote'
import { afterEach, describe, expect, it, vi } from 'vitest'

function createUpdateLocalSettingsStub() {
  return vi.fn(async () => ({ ...DEFAULT_REMOTE_LOCAL_SETTINGS }))
}

describe('useRemoteAutoSync', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('does not schedule a repeat interval when auto-sync is disabled', () => {
    expect(resolveRemoteAutoSyncIntervalMs({
      remote_auto_sync_enabled: false,
      remote_auto_sync_interval_minutes: null,
    })).toBe(0)
  })

  it('only schedules repeats when an interval is configured', () => {
    expect(resolveRemoteAutoSyncIntervalMs({
      remote_auto_sync_enabled: true,
      remote_auto_sync_interval_minutes: 0,
    })).toBe(0)
    expect(resolveRemoteAutoSyncIntervalMs({
      remote_auto_sync_enabled: true,
      remote_auto_sync_interval_minutes: null,
    })).toBe(600_000)
    expect(resolveRemoteAutoSyncIntervalMs({
      remote_auto_sync_enabled: true,
      remote_auto_sync_interval_minutes: 15,
    })).toBe(900_000)
  })

  it('derives a blocked UI state from compare results', () => {
    const result = getRemoteAutoSyncUiStatus(
      {
        remote_auto_sync_enabled: true,
        remote_auto_sync_interval_minutes: 10,
      },
      {
        ...DEFAULT_LOCAL_EXPORT_STATE,
        export_dirty: true,
        remote_out_of_date: true,
      },
      'remote_newer',
    )

    expect(result.state).toBe('blocked')
    expect(result.interval_minutes).toBe(10)
  })

  it('skips sync when auto-sync is disabled', async () => {
    const pushToRemote = vi.fn()

    const result = await runRemoteAutoSyncPass({
      getLocalSettings: vi.fn(async () => ({
        ...DEFAULT_REMOTE_LOCAL_SETTINGS,
        remote_auto_sync_enabled: false,
      })),
      updateLocalSettings: createUpdateLocalSettingsStub(),
      getExportState: vi.fn(async () => ({
        ...DEFAULT_LOCAL_EXPORT_STATE,
        export_dirty: true,
        remote_out_of_date: true,
      })),
      getRemoteExportProvider: vi.fn(),
      inspectRemotePush: vi.fn(),
      pushToRemote,
      isRemoteProviderConfigured: vi.fn(() => true),
    })

    expect(result).toBe('disabled')
    expect(pushToRemote).not.toHaveBeenCalled()
  })

  it('pushes when remote auto-sync is enabled and local state is dirty', async () => {
    const pushToRemote = vi.fn(async () => ({
      outcome: 'pushed',
      inspection: null,
      warnings: [],
    }))

    const result = await runRemoteAutoSyncPass({
      getLocalSettings: vi.fn(async () => ({
        ...DEFAULT_REMOTE_LOCAL_SETTINGS,
        remote_provider_type: 'gdrive',
        remote_auto_sync_enabled: true,
        remote_auto_sync_interval_minutes: 10,
      })),
      updateLocalSettings: createUpdateLocalSettingsStub(),
      getExportState: vi.fn(async () => ({
        ...DEFAULT_LOCAL_EXPORT_STATE,
        export_dirty: true,
        remote_out_of_date: true,
      })),
      getRemoteExportProvider: vi.fn(async () => ({ type: 'gdrive' })),
      inspectRemotePush: vi.fn(async () => ({ state: 'local_newer' })),
      pushToRemote,
      isRemoteProviderConfigured: vi.fn(() => true),
    })

    expect(result).toBe('pushed')
    expect(pushToRemote).toHaveBeenCalledTimes(1)
  })

  it('pushes when remote is older even if local dirty flags were missed', async () => {
    const pushToRemote = vi.fn(async () => ({
      outcome: 'pushed',
      inspection: null,
      warnings: [],
    }))

    const result = await runRemoteAutoSyncPass({
      getLocalSettings: vi.fn(async () => ({
        ...DEFAULT_REMOTE_LOCAL_SETTINGS,
        remote_provider_type: 'gdrive',
        remote_auto_sync_enabled: true,
        remote_auto_sync_interval_minutes: 10,
      })),
      updateLocalSettings: createUpdateLocalSettingsStub(),
      getExportState: vi.fn(async () => ({
        ...DEFAULT_LOCAL_EXPORT_STATE,
        export_dirty: false,
        remote_out_of_date: false,
      })),
      getRemoteExportProvider: vi.fn(async () => ({ type: 'gdrive' })),
      inspectRemotePush: vi.fn(async () => ({ state: 'local_newer' })),
      pushToRemote,
      isRemoteProviderConfigured: vi.fn(() => true),
    })

    expect(result).toBe('pushed')
    expect(pushToRemote).toHaveBeenCalledTimes(1)
  })

  it('blocks auto-push when remote needs manual review', async () => {
    const pushToRemote = vi.fn()

    const result = await runRemoteAutoSyncPass({
      getLocalSettings: vi.fn(async () => ({
        ...DEFAULT_REMOTE_LOCAL_SETTINGS,
        remote_provider_type: 'gdrive',
        remote_auto_sync_enabled: true,
      })),
      updateLocalSettings: createUpdateLocalSettingsStub(),
      getExportState: vi.fn(async () => ({
        ...DEFAULT_LOCAL_EXPORT_STATE,
        export_dirty: true,
        remote_out_of_date: true,
      })),
      getRemoteExportProvider: vi.fn(async () => ({ type: 'gdrive' })),
      inspectRemotePush: vi.fn(async () => ({ state: 'divergent' })),
      pushToRemote,
      isRemoteProviderConfigured: vi.fn(() => true),
    })

    expect(result).toBe('blocked')
    expect(pushToRemote).not.toHaveBeenCalled()
  })
})
