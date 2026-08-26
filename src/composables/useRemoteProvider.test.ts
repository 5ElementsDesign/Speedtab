import {
  createRemoteExportProvider,
  getRemoteExportProvider,
  isRemoteProviderConfigured,
  registerRemoteProviderFactory,
  unregisterRemoteProviderFactory,
  type RemoteExportProvider,
} from '@/composables/useRemoteProvider'
import { DEFAULT_REMOTE_LOCAL_SETTINGS, type RemoteExportMetadata, type RemoteLocalSettings } from '@/types/remote'
import { afterEach, describe, expect, it, vi } from 'vitest'

type StoredValue = string | null

function configuredSettings(overrides: Partial<RemoteLocalSettings> = {}): RemoteLocalSettings {
  return {
    ...DEFAULT_REMOTE_LOCAL_SETTINGS,
    remote_provider_type: 'webdav',
    remote_endpoint_url: 'https://dav.example.com/remote.php/webdav',
    remote_username: 'alice',
    remote_secret: 'secret-token',
    remote_path: '/speedtab',
    ...overrides,
  }
}

function installChromeStorageMock(seed: Partial<Record<keyof RemoteLocalSettings, StoredValue>> = {}) {
  const store = new Map<string, StoredValue>(Object.entries(seed))
  const local = {
    get: vi.fn((keys: string | string[] | Record<string, unknown> | null | undefined, callback: (items: Record<string, StoredValue>) => void) => {
      const requestedKeys = Array.isArray(keys)
        ? keys
        : typeof keys === 'string'
          ? [keys]
          : keys && typeof keys === 'object'
            ? Object.keys(keys)
            : []

      const result: Record<string, StoredValue> = {}
      for (const key of requestedKeys) {
        if (store.has(key)) result[key] = store.get(key) ?? null
      }
      callback(result)
    }),
    set: vi.fn(),
    remove: vi.fn(),
  }

  vi.stubGlobal('chrome', {
    runtime: {},
    storage: { local },
  })
}

describe('useRemoteProvider', () => {
  afterEach(() => {
    unregisterRemoteProviderFactory('webdav')
    vi.unstubAllGlobals()
  })

  it('detects when remote provider settings are incomplete', () => {
    expect(isRemoteProviderConfigured(DEFAULT_REMOTE_LOCAL_SETTINGS)).toBe(false)
    expect(isRemoteProviderConfigured(configuredSettings({ remote_secret: '   ' }))).toBe(false)
    expect(isRemoteProviderConfigured(configuredSettings())).toBe(true)
  })

  it('returns a not-configured stub provider when settings are incomplete', async () => {
    const provider = await createRemoteExportProvider(DEFAULT_REMOTE_LOCAL_SETTINGS)
    const result = await provider.verify()

    expect(provider.type).toBe('none')
    expect(provider.isConfigured()).toBe(false)
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('Expected failure result')
    expect(result.error.code).toBe('not_configured')
  })

  it('uses a registered provider factory when available', async () => {
    const meta: RemoteExportMetadata = {
      manifest_version: 2,
      app_version: '1.1.0',
      exported_at: '2026-05-30T00:00:00.000Z',
      workspace_checksum: 'abcdef123456',
      source_device_label: 'work-laptop',
      provider_endpoint_hash: 'provider-hash',
    }

    registerRemoteProviderFactory('webdav', (settings): RemoteExportProvider => ({
      type: 'webdav',
      settings,
      supportsEncryption: false,
      capabilities: { provider_specific: ['test-hook'] },
      isConfigured: () => true,
      testConnection: async () => ({ ok: true, value: { provider_id: 'provider-hash' } }),
      downloadMeta: async () => ({ ok: true, value: meta }),
      downloadExport: async () => ({ ok: true, value: new Blob(['export'], { type: 'application/json' }) }),
      downloadAssets: async () => ({ ok: true, value: new Blob(['assets'], { type: 'application/json' }) }),
      downloadArchiveExport: async () => ({ ok: true, value: new Blob(['archive'], { type: 'application/json' }) }),
      listArchives: async () => ({ ok: true, value: [] }),
      deleteArchive: async () => ({ ok: true, value: true }),
      uploadExport: async (exportBlob) => ({ ok: true, value: { provider_id: 'provider-hash', bytes_uploaded: exportBlob.size } }),
      uploadAssets: async (assetsBlob) => ({ ok: true, value: { provider_id: 'provider-hash', bytes_uploaded: assetsBlob.size } }),
      archiveExists: async () => ({ ok: true, value: false }),
      uploadArchive: async (_workspaceChecksum, exportBlob, assetsBlob) => ({ ok: true, value: { provider_id: 'provider-hash', bytes_uploaded: exportBlob.size + assetsBlob.size } }),
      uploadMeta: async () => ({ ok: true, value: { provider_id: 'provider-hash', bytes_uploaded: 128 } }),
      verify: async () => ({
        ok: true,
        value: {
          provider_id: 'provider-hash',
          meta,
          export_exists: true,
          assets_exists: true,
          meta_exists: true,
          payload_mode: 'split',
          export_size_bytes: 512,
          assets_size_bytes: 64,
          warnings: [],
        },
      }),
    }))

    const provider = await createRemoteExportProvider(configuredSettings())
    const result = await provider.downloadMeta()

    expect(provider.type).toBe('webdav')
    expect(provider.capabilities.provider_specific).toContain('test-hook')
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('Expected success result')
    expect(result.value.workspace_checksum).toBe('abcdef123456')
  })

  it('loads settings from chrome.storage.local when building the provider', async () => {
    registerRemoteProviderFactory('webdav', (settings): RemoteExportProvider => ({
      type: 'webdav',
      settings,
      supportsEncryption: false,
      capabilities: { provider_specific: [] },
      isConfigured: () => true,
      testConnection: async () => ({ ok: true, value: { provider_id: settings.remote_endpoint_url } }),
      downloadMeta: async () => ({ ok: false, error: { code: 'file_missing', message: 'missing', retryable: false } }),
      downloadExport: async () => ({ ok: false, error: { code: 'file_missing', message: 'missing', retryable: false } }),
      downloadAssets: async () => ({ ok: false, error: { code: 'file_missing', message: 'missing', retryable: false } }),
      downloadArchiveExport: async () => ({ ok: false, error: { code: 'file_missing', message: 'missing', retryable: false } }),
      listArchives: async () => ({ ok: true, value: [] }),
      deleteArchive: async () => ({ ok: false, error: { code: 'network_error', message: 'unused', retryable: true } }),
      uploadExport: async () => ({ ok: false, error: { code: 'network_error', message: 'unused', retryable: true } }),
      uploadAssets: async () => ({ ok: false, error: { code: 'network_error', message: 'unused', retryable: true } }),
      archiveExists: async () => ({ ok: true, value: false }),
      uploadArchive: async () => ({ ok: false, error: { code: 'network_error', message: 'unused', retryable: true } }),
      uploadMeta: async () => ({ ok: false, error: { code: 'network_error', message: 'unused', retryable: true } }),
      verify: async () => ({
        ok: true,
        value: {
          provider_id: settings.remote_endpoint_url,
          meta: null,
          export_exists: false,
          assets_exists: false,
          meta_exists: false,
          payload_mode: 'missing',
          export_size_bytes: null,
          assets_size_bytes: null,
          warnings: [],
        },
      }),
    }))

    installChromeStorageMock(configuredSettings())

    const provider = await getRemoteExportProvider()
    const result = await provider.testConnection()

    expect(provider.settings.remote_path).toBe('/speedtab')
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('Expected success result')
    expect(result.value.provider_id).toContain('dav.example.com')
  })
})
