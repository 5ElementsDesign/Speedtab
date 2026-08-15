import { createGoogleDriveProvider } from '@/composables/useGoogleDriveProvider'
import type { RemoteLocalSettings } from '@/types/remote'
import { DEFAULT_REMOTE_LOCAL_SETTINGS } from '@/types/remote'
import { afterEach, describe, expect, it, vi } from 'vitest'

function configuredSettings(overrides: Partial<RemoteLocalSettings> = {}): RemoteLocalSettings {
  return {
    ...DEFAULT_REMOTE_LOCAL_SETTINGS,
    remote_provider_type: 'gdrive',
    device_label: 'desktop',
    ...overrides,
  }
}

function installChromeIdentityMock() {
  vi.stubGlobal('chrome', {
    runtime: {},
    identity: {
      getAuthToken: vi.fn((_options, callback) => callback('token-123')),
      removeCachedAuthToken: vi.fn((_details, callback) => callback()),
    },
  })
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
}

describe('useGoogleDriveProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('requests newest-first ordering when looking up files by name', async () => {
    installChromeIdentityMock()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        files: [{ id: 'meta-newest', name: 'speedtab-meta.json', modifiedTime: '2026-07-10T10:00:00.000Z' }],
      }))
      .mockResolvedValueOnce(jsonResponse({
        manifest_version: 2,
        app_version: '1.4.2',
        exported_at: '2026-07-10T10:00:00.000Z',
        workspace_checksum: 'abc123',
        payload_mode: 'split',
        assets_count: 0,
        source_device_label: 'desktop',
        provider_endpoint_hash: 'gdrive:appDataFolder',
      }))

    vi.stubGlobal('fetch', fetchMock)

    const provider = createGoogleDriveProvider(configuredSettings())
    const result = await provider.downloadMeta()

    expect(result.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)

    const firstUrl = String(fetchMock.mock.calls[0][0])
    expect(firstUrl).toContain('orderBy=modifiedTime+desc')
    expect(firstUrl).toContain("name%3D%27speedtab-meta.json%27")
    expect(firstUrl).toContain('trashed%3Dfalse')
  })
})
