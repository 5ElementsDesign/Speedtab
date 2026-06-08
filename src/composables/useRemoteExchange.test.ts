import {
  getCompareActions,
  inspectRemotePush,
  previewRemotePull,
  pullFromRemote,
  pushToRemote,
  verifyRemoteHealth,
  type RemotePushInspection,
} from '@/composables/useRemoteExchange'
import { DEFAULT_LOCAL_EXPORT_STATE } from '@/composables/useExportState'
import type { RemoteExportProvider } from '@/composables/useRemoteProvider'
import type { BackupManifestV2 } from '@/composables/useBackup'
import { BACKUP_VERSION } from '@/composables/useBackup'
import type { CleanupReport } from '@/composables/useMaintenance'
import type { ImportReport } from '@/composables/useBackup'
import type { RemoteLocalSettings, RemoteProviderResult, RemoteProviderUploadReceipt } from '@/types/remote'
import { DEFAULT_REMOTE_LOCAL_SETTINGS } from '@/types/remote'
import { describe, expect, it, vi } from 'vitest'

function manifest(exportedAt = '2026-05-30T00:00:00.000Z'): BackupManifestV2 {
  return {
    version: BACKUP_VERSION,
    exported_at: exportedAt,
    pages: [],
    modules: [],
    collections: [],
    tabs: [],
    notes: [],
    feed_sources: [],
    saved_feed_items: [],
    assets: [],
  }
}

function configuredSettings(overrides: Partial<RemoteLocalSettings> = {}): RemoteLocalSettings {
  return {
    ...DEFAULT_REMOTE_LOCAL_SETTINGS,
    remote_provider_type: 'webdav',
    remote_endpoint_url: 'https://dav.example.com/root',
    remote_username: 'alice',
    remote_secret: 'secret-token',
    remote_path: '/speedtab',
    device_label: 'desktop',
    ...overrides,
  }
}

function ok<T>(value: T): RemoteProviderResult<T> {
  return { ok: true, value }
}

function err<T>(message: string): RemoteProviderResult<T> {
  return {
    ok: false,
    error: {
      code: 'network_error',
      message,
      retryable: true,
    },
  }
}

function makeProvider(overrides: Partial<RemoteExportProvider> = {}): RemoteExportProvider {
  const settings = configuredSettings()
  return {
    type: 'webdav',
    settings,
    supportsEncryption: false,
    capabilities: { provider_specific: [] },
    isConfigured: () => true,
    testConnection: async () => ok({ provider_id: 'provider-hash' }),
    downloadMeta: async () => ok({
      manifest_version: 2,
      app_version: '1.1.0',
      exported_at: '2026-05-30T00:00:00.000Z',
      workspace_checksum: 'remote-checksum',
      source_device_label: 'desktop',
      provider_endpoint_hash: 'provider-hash',
    }),
    downloadExport: async () => ok(new Blob(['{}'], { type: 'application/json' })),
    uploadExport: async (exportBlob) => ok({ provider_id: 'provider-hash', bytes_uploaded: exportBlob.size }),
    archiveExists: async () => ok(false),
    uploadArchive: async (workspaceChecksum, exportBlob) => ok({
      provider_id: 'provider-hash',
      bytes_uploaded: exportBlob.size + workspaceChecksum.length,
    }),
    uploadMeta: async () => ok({ provider_id: 'provider-hash', bytes_uploaded: 128 }),
    verify: async () => ok({
      provider_id: 'provider-hash',
      meta: null,
      export_exists: false,
      meta_exists: false,
      export_size_bytes: null,
      warnings: [],
    }),
    ...overrides,
  }
}

function makeDeps(provider: RemoteExportProvider, exportedAt = '2026-05-30T00:00:00.000Z', checksum = 'local-checksum') {
  const updateLocalSettings = vi.fn(async (patch: Partial<RemoteLocalSettings>) => ({
    ...configuredSettings(),
    ...patch,
  }))

  return {
    deps: {
      exportAll: vi.fn(async () => manifest(exportedAt)),
      importAll: vi.fn(async () => ({
        pages: 0,
        modules: 0,
        collections: 0,
        tabs: 0,
        notes: 0,
        feed_sources: 0,
        feed_items: 0,
        saved_feed_items: 0,
        assets: 0,
        assets_deduped: 0,
        dry_run: false,
        manifest_version: 2,
      } satisfies ImportReport)),
      manifestChecksum: vi.fn(async () => checksum),
      manifestToJsonString: vi.fn(() => JSON.stringify(manifest(exportedAt))),
      parseManifestText: vi.fn((text: string) => JSON.parse(text)),
      getRemoteExportProvider: vi.fn(async () => provider),
      updateLocalSettings,
      cleanupOrphans: vi.fn(async () => ({
        removedModules: 0,
        removedCollections: 0,
        removedTabs: 0,
        removedNotes: 0,
        removedFeedSources: 0,
        removedFeedItems: 0,
        removedSavedFeedItems: 0,
        removedAssets: 0,
      } satisfies CleanupReport)),
      clearRemoteOutOfDate: vi.fn(async () => ({ ...DEFAULT_LOCAL_EXPORT_STATE })),
      noteImportedWorkspace: vi.fn(async () => ({ ...DEFAULT_LOCAL_EXPORT_STATE, export_dirty: true, remote_out_of_date: true })),
    },
    updateLocalSettings,
  }
}

describe('useRemoteExchange', () => {
  it('classifies missing remote state and pushes successfully', async () => {
    const provider = makeProvider()
    const { deps, updateLocalSettings } = makeDeps(provider)

    const inspection = await inspectRemotePush({ provider }, deps)
    const result = await pushToRemote({ provider }, deps)

    expect(inspection.state).toBe('remote_missing')
    expect(result.outcome).toBe('pushed')
    expect(provider.uploadExport).toBeDefined()
    expect(result.inspection.archiveExists).toBe(true)
    expect(updateLocalSettings).toHaveBeenCalledWith({ last_known_local_checksum: 'local-checksum' })
    expect(updateLocalSettings).toHaveBeenCalledWith({
      last_remote_push_checksum: 'local-checksum',
      last_remote_push_exported_at: '2026-05-30T00:00:00.000Z',
      last_remote_provider_id: 'provider-hash',
      last_known_local_checksum: 'local-checksum',
    })
  })

  it('classifies identical remote state when checksums match', async () => {
    const provider = makeProvider({
      verify: async () => ok({
        provider_id: 'provider-hash',
        meta: {
          manifest_version: 2,
          app_version: '1.1.0',
          exported_at: '2026-05-30T00:00:00.000Z',
          workspace_checksum: 'local-checksum',
          source_device_label: 'desktop',
          provider_endpoint_hash: 'provider-hash',
        },
        export_exists: true,
        meta_exists: true,
        export_size_bytes: 512,
        warnings: [],
      }),
    })
    const { deps } = makeDeps(provider)

    const inspection = await inspectRemotePush({ provider }, deps)
    expect(inspection.state).toBe('identical')
  })

  it('classifies local newer when remote matches last pulled checksum', async () => {
    const provider = makeProvider({
      settings: configuredSettings({
        last_remote_pull_checksum: 'remote-checksum',
      }),
      verify: async () => ok({
        provider_id: 'provider-hash',
        meta: {
          manifest_version: 2,
          app_version: '1.1.0',
          exported_at: '2026-05-30T00:00:00.000Z',
          workspace_checksum: 'remote-checksum',
          source_device_label: 'desktop',
          provider_endpoint_hash: 'provider-hash',
        },
        export_exists: true,
        meta_exists: true,
        export_size_bytes: 512,
        warnings: [],
      }),
    })
    const { deps } = makeDeps(provider)

    const inspection = await inspectRemotePush({ provider }, deps)
    expect(inspection.state).toBe('local_newer')
  })

  it('classifies remote newer when local matches last pushed checksum', async () => {
    const provider = makeProvider({
      settings: configuredSettings({
        last_remote_push_checksum: 'local-checksum',
      }),
      verify: async () => ok({
        provider_id: 'provider-hash',
        meta: {
          manifest_version: 2,
          app_version: '1.1.0',
          exported_at: '2026-05-30T00:00:00.000Z',
          workspace_checksum: 'remote-checksum',
          source_device_label: 'desktop',
          provider_endpoint_hash: 'provider-hash',
        },
        export_exists: true,
        meta_exists: true,
        export_size_bytes: 512,
        warnings: [],
      }),
    })
    const { deps } = makeDeps(provider)

    const inspection = await inspectRemotePush({ provider }, deps)
    expect(inspection.state).toBe('remote_newer')
  })

  it('classifies unknown endpoint context when the provider hash changed', async () => {
    const provider = makeProvider({
      verify: async () => ok({
        provider_id: 'provider-hash',
        meta: {
          manifest_version: 2,
          app_version: '1.1.0',
          exported_at: '2026-05-30T00:00:00.000Z',
          workspace_checksum: 'remote-checksum',
          source_device_label: 'desktop',
          provider_endpoint_hash: 'other-provider-hash',
        },
        export_exists: true,
        meta_exists: true,
        export_size_bytes: 512,
        warnings: [],
      }),
    })
    const { deps } = makeDeps(provider)

    const inspection = await inspectRemotePush({ provider }, deps)
    expect(inspection.state).toBe('unknown_endpoint_context')
  })

  it('classifies version mismatch when remote metadata uses another manifest version', async () => {
    const provider = makeProvider({
      verify: async () => ok({
        provider_id: 'provider-hash',
        meta: {
          manifest_version: 1,
          app_version: '1.1.0',
          exported_at: '2026-05-30T00:00:00.000Z',
          workspace_checksum: 'remote-checksum',
          source_device_label: 'desktop',
          provider_endpoint_hash: 'provider-hash',
        },
        export_exists: true,
        meta_exists: true,
        export_size_bytes: 512,
        warnings: [],
      }),
    })
    const { deps } = makeDeps(provider)

    const inspection = await inspectRemotePush({ provider }, deps)
    expect(inspection.state).toBe('version_mismatch')
  })

  it('falls back to divergent when neither side can be safely classified as newer', async () => {
    const provider = makeProvider({
      verify: async () => ok({
        provider_id: 'provider-hash',
        meta: {
          manifest_version: 2,
          app_version: '1.1.0',
          exported_at: '2026-05-30T00:00:00.000Z',
          workspace_checksum: 'remote-checksum',
          source_device_label: 'desktop',
          provider_endpoint_hash: 'provider-hash',
        },
        export_exists: true,
        meta_exists: true,
        export_size_bytes: 512,
        warnings: [],
      }),
    })
    const { deps } = makeDeps(provider)

    const inspection = await inspectRemotePush({ provider }, deps)
    expect(inspection.state).toBe('divergent')
  })

  it('returns up-to-date without uploading when checksums already match', async () => {
    const provider = makeProvider({
      verify: async () => ok({
        provider_id: 'provider-hash',
        meta: {
          manifest_version: 2,
          app_version: '1.1.0',
          exported_at: '2026-05-30T00:00:00.000Z',
          workspace_checksum: 'local-checksum',
          source_device_label: 'desktop',
          provider_endpoint_hash: 'provider-hash',
        },
        export_exists: true,
        meta_exists: true,
        export_size_bytes: 512,
        warnings: [],
      }),
      uploadExport: vi.fn(async () => ok({ provider_id: 'provider-hash', bytes_uploaded: 12 })),
      uploadArchive: vi.fn(async (_workspaceChecksum, exportBlob) => ok({ provider_id: 'provider-hash', bytes_uploaded: exportBlob.size })),
    })
    const { deps } = makeDeps(provider)

    const result = await pushToRemote({ provider }, deps)

    expect(result.outcome).toBe('pushed')
    expect(provider.uploadExport).not.toHaveBeenCalled()
    expect(provider.uploadArchive).toHaveBeenCalledTimes(1)
    expect(result.inspection.archiveExists).toBe(true)
  })

  it('skips archive upload when the checksum is already archived remotely', async () => {
    const provider = makeProvider({
      verify: async () => ok({
        provider_id: 'provider-hash',
        meta: {
          manifest_version: 2,
          app_version: '1.1.0',
          exported_at: '2026-05-30T00:00:00.000Z',
          workspace_checksum: 'local-checksum',
          source_device_label: 'desktop',
          provider_endpoint_hash: 'provider-hash',
        },
        export_exists: true,
        meta_exists: true,
        export_size_bytes: 512,
        warnings: [],
      }),
      archiveExists: vi.fn(async () => ok(true)),
      uploadExport: vi.fn(async () => ok({ provider_id: 'provider-hash', bytes_uploaded: 12 })),
      uploadArchive: vi.fn(async (_workspaceChecksum, exportBlob) => ok({ provider_id: 'provider-hash', bytes_uploaded: exportBlob.size })),
    })
    const { deps } = makeDeps(provider)

    const result = await pushToRemote({ provider }, deps)

    expect(result.outcome).toBe('pushed')
    expect(provider.uploadExport).not.toHaveBeenCalled()
    expect(provider.uploadArchive).not.toHaveBeenCalled()
    expect(result.inspection.archiveExists).toBe(true)
  })

  it('requires confirmation before overwriting differing remote state', async () => {
    const provider = makeProvider({
      verify: async () => ok({
        provider_id: 'provider-hash',
        meta: {
          manifest_version: 2,
          app_version: '1.1.0',
          exported_at: '2026-05-29T00:00:00.000Z',
          workspace_checksum: 'remote-checksum',
          source_device_label: 'laptop',
          provider_endpoint_hash: 'provider-hash',
        },
        export_exists: true,
        meta_exists: true,
        export_size_bytes: 512,
        warnings: [],
      }),
      uploadExport: vi.fn(async () => ok({ provider_id: 'provider-hash', bytes_uploaded: 12 })),
    })
    const confirmOverwrite = vi.fn(async (_inspection: RemotePushInspection) => true)
    const { deps } = makeDeps(provider)

    const result = await pushToRemote({ provider, confirmOverwrite }, deps)

    expect(confirmOverwrite).toHaveBeenCalledTimes(1)
    expect(result.outcome).toBe('pushed')
    expect(provider.uploadExport).toHaveBeenCalledTimes(1)
  })

  it('adds an explicit overwrite warning when no remote baseline is known', async () => {
    const provider = makeProvider({
      settings: configuredSettings({
        last_remote_pull_checksum: null,
        last_remote_push_checksum: null,
        last_remote_seen_checksum: null,
      }),
      verify: async () => ok({
        provider_id: 'provider-hash',
        meta: {
          manifest_version: 2,
          app_version: '1.1.0',
          exported_at: '2026-05-29T00:00:00.000Z',
          workspace_checksum: 'remote-checksum',
          source_device_label: 'laptop',
          provider_endpoint_hash: 'provider-hash',
        },
        export_exists: true,
        meta_exists: true,
        export_size_bytes: 512,
        warnings: [],
      }),
    })
    const { deps } = makeDeps(provider)

    const inspection = await inspectRemotePush({ provider }, deps)

    expect(inspection.warnings).toContain(
      'This browser profile has no known remote baseline yet. Pushing now will replace the live remote workspace with the current local state.',
    )
  })

  it('exposes explicit divergent action availability', () => {
    expect(getCompareActions('remote_missing')).toEqual(['push', 'download_remote'])
    expect(getCompareActions('local_newer')).toEqual(['push', 'download_remote'])
    expect(getCompareActions('remote_newer')).toEqual(['pull', 'download_both'])
    expect(getCompareActions('divergent')).toEqual(['push', 'pull', 'download_both'])
    expect(getCompareActions('version_mismatch')).toEqual(['push', 'pull', 'download_both'])
    expect(getCompareActions('unknown_endpoint_context')).toEqual(['push', 'pull', 'download_both'])
  })

  it('returns partial success when sidecar upload fails after export upload', async () => {
    const provider = makeProvider({
      uploadMeta: vi.fn(async (): Promise<RemoteProviderResult<RemoteProviderUploadReceipt>> => err('Meta upload failed')),
    })
    const { deps, updateLocalSettings } = makeDeps(provider)

    const result = await pushToRemote({ provider }, deps)

    expect(result.outcome).toBe('partial')
    expect(result.warnings[0]).toContain('Export uploaded')
    expect(updateLocalSettings).toHaveBeenCalledWith({
      last_remote_push_checksum: 'local-checksum',
      last_remote_push_exported_at: '2026-05-30T00:00:00.000Z',
      last_remote_provider_id: 'provider-hash',
      last_known_local_checksum: 'local-checksum',
    })
    expect(updateLocalSettings).not.toHaveBeenCalledWith(expect.objectContaining({
      last_remote_seen_checksum: 'local-checksum',
    }))
  })

  it('does not update push bookkeeping when export upload fails', async () => {
    const provider = makeProvider({
      uploadExport: vi.fn(async (): Promise<RemoteProviderResult<RemoteProviderUploadReceipt>> => err('Export upload failed')),
    })
    const { deps, updateLocalSettings } = makeDeps(provider)

    await expect(pushToRemote({ provider }, deps)).rejects.toThrow('Export upload failed')
    expect(updateLocalSettings).not.toHaveBeenCalledWith(expect.objectContaining({
      last_remote_push_checksum: 'local-checksum',
    }))
  })

  it('previews remote pull as up to date when remote matches the last pulled checksum', async () => {
    const provider = makeProvider({
      settings: configuredSettings({ last_remote_pull_checksum: 'remote-checksum' }),
      verify: async () => ok({
        provider_id: 'provider-hash',
        meta: {
          manifest_version: 2,
          app_version: '1.1.0',
          exported_at: '2026-05-30T00:00:00.000Z',
          workspace_checksum: 'remote-checksum',
          source_device_label: 'desktop',
          provider_endpoint_hash: 'provider-hash',
        },
        export_exists: true,
        meta_exists: true,
        export_size_bytes: 512,
        warnings: [],
      }),
    })
    const { deps } = makeDeps(provider)

    const preview = await previewRemotePull({ provider }, deps)
    expect(preview.state).toBe('up_to_date')
  })

  it('pulls a valid remote v2 workspace through the existing importer', async () => {
    const provider = makeProvider({
      verify: async () => ok({
        provider_id: 'provider-hash',
        meta: {
          manifest_version: 2,
          app_version: '1.1.0',
          exported_at: '2026-05-31T00:00:00.000Z',
          workspace_checksum: 'remote-checksum',
          source_device_label: 'laptop',
          provider_endpoint_hash: 'provider-hash',
        },
        export_exists: true,
        meta_exists: true,
        export_size_bytes: 512,
        warnings: [],
      }),
      downloadExport: vi.fn(async () => ok(new Blob([JSON.stringify(manifest('2026-05-31T00:00:00.000Z'))], { type: 'application/json' }))),
    })
    const { deps, updateLocalSettings } = makeDeps(provider)

    const result = await pullFromRemote({ provider, confirmImport: async () => true }, deps)

    expect(result.preview.state).toBe('ready')
    expect(deps.importAll).toHaveBeenCalledTimes(1)
    expect(updateLocalSettings).toHaveBeenCalledWith({
      last_remote_pull_checksum: 'remote-checksum',
      last_remote_pull_exported_at: '2026-05-31T00:00:00.000Z',
      last_remote_provider_id: 'provider-hash',
      last_remote_source_device: 'laptop',
      last_remote_seen_checksum: 'remote-checksum',
      last_remote_seen_exported_at: '2026-05-31T00:00:00.000Z',
      last_known_local_checksum: null,
    })
  })

  it('marks legacy remote manifests with a warning after import', async () => {
    const legacyManifest = {
      version: 1 as const,
      exported_at: '2026-05-31T00:00:00.000Z',
      pages: [],
      modules: [],
      collections: [],
      tabs: [],
      notes: [],
      feed_sources: [],
      feed_items: [],
      saved_feed_items: [],
      assets: [],
    }
    const provider = makeProvider({
      verify: async () => ok({
        provider_id: 'provider-hash',
        meta: null,
        export_exists: true,
        meta_exists: false,
        export_size_bytes: 512,
        warnings: [],
      }),
      downloadExport: vi.fn(async () => ok(new Blob([JSON.stringify(legacyManifest)], { type: 'application/json' }))),
    })
    const { deps } = makeDeps(provider)
    deps.parseManifestText = vi.fn(() => legacyManifest as any)

    const result = await pullFromRemote({ provider, confirmImport: async () => true }, deps)

    expect(result.preview.state).toBe('legacy_manifest')
    expect(result.preview.warnings).toContain('Legacy remote manifest detected.')
  })

  it('rejects corrupt remote manifests before import', async () => {
    const provider = makeProvider({
      verify: async () => ok({
        provider_id: 'provider-hash',
        meta: null,
        export_exists: true,
        meta_exists: false,
        export_size_bytes: 512,
        warnings: [],
      }),
      downloadExport: vi.fn(async () => ok(new Blob(['not-json'], { type: 'application/json' }))),
    })
    const { deps } = makeDeps(provider)
    deps.parseManifestText = vi.fn(() => { throw new Error('File is not valid JSON') })

    await expect(pullFromRemote({ provider, confirmImport: async () => true }, deps)).rejects.toThrow('File is not valid JSON')
    expect(deps.importAll).not.toHaveBeenCalled()
  })

  it('does not mutate the local db before pull confirmation', async () => {
    const provider = makeProvider({
      verify: async () => ok({
        provider_id: 'provider-hash',
        meta: null,
        export_exists: true,
        meta_exists: false,
        export_size_bytes: 512,
        warnings: [],
      }),
      downloadExport: vi.fn(async () => ok(new Blob([JSON.stringify(manifest())], { type: 'application/json' }))),
    })
    const { deps, updateLocalSettings } = makeDeps(provider)

    await expect(pullFromRemote({ provider, confirmImport: async () => false }, deps)).rejects.toThrow('Remote pull cancelled.')
    expect(deps.importAll).not.toHaveBeenCalled()
    expect(updateLocalSettings).not.toHaveBeenCalledWith(expect.objectContaining({
      last_remote_pull_checksum: expect.anything(),
    }))
  })

  it('reports sidecar exists while export is missing during verify', async () => {
    const provider = makeProvider({
      verify: async () => ok({
        provider_id: 'provider-hash',
        meta: {
          manifest_version: 2,
          app_version: '1.1.0',
          exported_at: '2026-05-31T00:00:00.000Z',
          workspace_checksum: 'remote-checksum',
          source_device_label: 'desktop',
          provider_endpoint_hash: 'provider-hash',
        },
        export_exists: false,
        meta_exists: true,
        export_size_bytes: null,
        warnings: ['Metadata sidecar exists without export file.'],
      }),
    })
    const { deps } = makeDeps(provider)

    const diagnostics = await verifyRemoteHealth({ provider }, deps)
    expect(diagnostics.health).toBe('export_missing')
    expect(diagnostics.repairActions).toContain('push')
  })

  it('reports export exists while sidecar is missing during verify', async () => {
    const provider = makeProvider({
      verify: async () => ok({
        provider_id: 'provider-hash',
        meta: null,
        export_exists: true,
        meta_exists: false,
        export_size_bytes: 512,
        warnings: ['Export file exists without metadata sidecar.'],
      }),
    })
    const { deps } = makeDeps(provider)

    const diagnostics = await verifyRemoteHealth({ provider }, deps)
    expect(diagnostics.health).toBe('sidecar_missing')
    expect(diagnostics.repairActions).toContain('push')
  })

  it('reports corrupt sidecar metadata during verify', async () => {
    const provider = makeProvider({
      verify: async () => ({
        ok: false,
        error: {
          code: 'corrupt_remote_state',
          message: 'Remote JSON could not be parsed.',
          retryable: false,
        },
      }),
    })
    const { deps } = makeDeps(provider)

    const diagnostics = await verifyRemoteHealth({ provider }, deps)
    expect(diagnostics.health).toBe('corrupt_metadata')
    expect(diagnostics.repairActions).toContain('push')
  })

  it('verify succeeds after a repair push', async () => {
    let verified = false
    const provider = makeProvider({
      verify: async () => verified
        ? ok({
            provider_id: 'provider-hash',
            meta: {
              manifest_version: 2,
              app_version: '1.1.0',
              exported_at: '2026-05-31T00:00:00.000Z',
              workspace_checksum: 'local-checksum',
              source_device_label: 'desktop',
              provider_endpoint_hash: 'provider-hash',
            },
            export_exists: true,
            meta_exists: true,
            export_size_bytes: 512,
            warnings: [],
          })
        : ok({
            provider_id: 'provider-hash',
            meta: null,
            export_exists: true,
            meta_exists: false,
            export_size_bytes: 512,
            warnings: ['Export file exists without metadata sidecar.'],
          }),
      uploadMeta: vi.fn(async () => {
        verified = true
        return ok({ provider_id: 'provider-hash', bytes_uploaded: 128 })
      }),
    })
    const { deps } = makeDeps(provider)

    const before = await verifyRemoteHealth({ provider }, deps)
    await pushToRemote({ provider, confirmOverwrite: async () => true }, deps)
    const after = await verifyRemoteHealth({ provider }, deps)

    expect(before.health).toBe('sidecar_missing')
    expect(after.health).toBe('healthy')
  })

  it('forwards abort signals through push and pull operations', async () => {
    const seenSignals: AbortSignal[] = []
    const provider = makeProvider({
      verify: vi.fn(async (_options) => {
        if (_options?.signal) seenSignals.push(_options.signal)
        return ok({
          provider_id: 'provider-hash',
          meta: {
            manifest_version: 2,
            app_version: '1.1.0',
            exported_at: '2026-05-31T00:00:00.000Z',
            workspace_checksum: 'remote-checksum',
            source_device_label: 'desktop',
            provider_endpoint_hash: 'provider-hash',
          },
          export_exists: true,
          meta_exists: true,
          export_size_bytes: 512,
          warnings: [],
        })
      }),
      uploadExport: vi.fn(async (_blob, options) => {
        if (options?.signal) seenSignals.push(options.signal)
        return ok({ provider_id: 'provider-hash', bytes_uploaded: 12 })
      }),
      uploadMeta: vi.fn(async (_meta, options) => {
        if (options?.signal) seenSignals.push(options.signal)
        return ok({ provider_id: 'provider-hash', bytes_uploaded: 12 })
      }),
      downloadExport: vi.fn(async (options) => {
        if (options?.signal) seenSignals.push(options.signal)
        return ok(new Blob([JSON.stringify(manifest())], { type: 'application/json' }))
      }),
    })
    const { deps } = makeDeps(provider)
    const controller = new AbortController()

    await pushToRemote({ provider, signal: controller.signal, confirmOverwrite: async () => true }, deps)
    await pullFromRemote({ provider, signal: controller.signal, confirmImport: async () => true }, deps)

    expect(seenSignals.length).toBeGreaterThan(0)
    expect(seenSignals.every((signal) => signal === controller.signal)).toBe(true)
  })
})
