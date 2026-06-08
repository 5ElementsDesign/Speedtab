import { createWebDavProvider, getWebDavProviderEndpointHash } from '@/composables/useWebDavProvider'
import type { RemoteLocalSettings } from '@/types/remote'
import { DEFAULT_REMOTE_LOCAL_SETTINGS } from '@/types/remote'
import { afterEach, describe, expect, it, vi } from 'vitest'

function configuredSettings(overrides: Partial<RemoteLocalSettings> = {}): RemoteLocalSettings {
  return {
    ...DEFAULT_REMOTE_LOCAL_SETTINGS,
    remote_provider_type: 'webdav',
    remote_endpoint_url: 'https://User:Pass@DAV.Example.com:443/root/',
    remote_username: 'alice',
    remote_secret: 'secret-token',
    remote_path: '/speedtab/workspace/',
    ...overrides,
  }
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
}

describe('useWebDavProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('normalizes endpoint hashing consistently', async () => {
    const hashA = await getWebDavProviderEndpointHash(configuredSettings())
    const hashB = await getWebDavProviderEndpointHash(configuredSettings({
      remote_endpoint_url: 'https://dav.example.com/root',
      remote_path: 'speedtab/workspace',
    }))

    expect(hashA).toBe(hashB)
  })

  it('supports successful HEAD, GET, and PUT flows', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(jsonResponse({
        manifest_version: 2,
        app_version: '1.1.0',
        exported_at: '2026-05-30T00:00:00.000Z',
        workspace_checksum: 'abc123',
        source_device_label: 'desktop',
        provider_endpoint_hash: 'provider-hash',
      }))
      .mockResolvedValueOnce(new Response(new Blob(['payload'], { type: 'application/json' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 201 }))
      .mockResolvedValueOnce(new Response(null, { status: 201 }))

    vi.stubGlobal('fetch', fetchMock)

    const provider = createWebDavProvider(configuredSettings())
    const connection = await provider.testConnection()
    const meta = await provider.downloadMeta()
    const exported = await provider.downloadExport()
    const uploadExport = await provider.uploadExport(new Blob(['payload'], { type: 'application/json' }))
    const uploadMeta = await provider.uploadMeta({
      manifest_version: 2,
      app_version: '1.1.0',
      exported_at: '2026-05-30T00:00:00.000Z',
      workspace_checksum: 'abc123',
      source_device_label: 'desktop',
      provider_endpoint_hash: 'provider-hash',
    })

    expect(connection.ok).toBe(true)
    expect(meta.ok).toBe(true)
    expect(exported.ok).toBe(true)
    expect(uploadExport.ok).toBe(true)
    expect(uploadMeta.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(5)
    expect(fetchMock.mock.calls[0][1]?.method).toBe('HEAD')
    expect(fetchMock.mock.calls[1][1]?.method).toBe('GET')
    expect(fetchMock.mock.calls[3][1]?.method).toBe('PUT')
  })

  it('maps auth failures distinctly', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 401 })))

    const result = await createWebDavProvider(configuredSettings()).testConnection()

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('Expected auth failure')
    expect(result.error.code).toBe('auth_failed')
  })

  it('reports missing sidecar and missing export separately during verify', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { status: 200, headers: { 'content-length': '512' } }))

    vi.stubGlobal('fetch', fetchMock)

    const result = await createWebDavProvider(configuredSettings()).verify()

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('Expected verify success')
    expect(result.value.meta_exists).toBe(false)
    expect(result.value.export_exists).toBe(true)
    expect(result.value.export_size_bytes).toBe(512)
    expect(result.value.warnings).toContain('Export file exists without metadata sidecar.')
  })

  it('returns timeout failures', async () => {
    vi.stubGlobal('fetch', vi.fn((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Timed out', 'AbortError')), { once: true })
    })))

    const result = await createWebDavProvider(configuredSettings()).downloadExport({ timeoutMs: 5 })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('Expected timeout failure')
    expect(result.error.code).toBe('timeout')
  })

  it('retries transient 5xx failures', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))

    vi.stubGlobal('fetch', fetchMock)

    const result = await createWebDavProvider(configuredSettings()).testConnection()

    expect(result.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('returns a non-timeout failure when aborted by the user', async () => {
    vi.stubGlobal('fetch', vi.fn((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
    })))

    const controller = new AbortController()
    const pending = createWebDavProvider(configuredSettings()).downloadMeta({ signal: controller.signal, timeoutMs: 500 })
    controller.abort()
    const result = await pending

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('Expected aborted failure')
    expect(result.error.code).toBe('network_error')
    expect(result.error.retryable).toBe(false)
  })

  it('explains when the configured WebDAV folder does not exist during upload', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404 })))

    const result = await createWebDavProvider(configuredSettings()).uploadExport(
      new Blob(['payload'], { type: 'application/json' }),
    )

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('Expected upload failure')
    expect(result.error.code).toBe('file_missing')
    expect(result.error.message).toContain('configured WebDAV path does not exist')
  })

  it('creates the archive folder on demand before uploading an archived export', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { status: 201 }))
      .mockResolvedValueOnce(new Response(null, { status: 201 }))

    vi.stubGlobal('fetch', fetchMock)

    const result = await createWebDavProvider(configuredSettings()).uploadArchive(
      'abc123',
      new Blob(['payload'], { type: 'application/json' }),
    )

    expect(result.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls[0][1]?.method).toBe('HEAD')
    expect(fetchMock.mock.calls[1][1]?.method).toBe('MKCOL')
    expect(fetchMock.mock.calls[2][1]?.method).toBe('PUT')
    expect(fetchMock.mock.calls[1][0]).toContain('/st-archive/')
    expect(fetchMock.mock.calls[2][0]).toContain('/st-archive/speedtab-export.abc123.json')
  })

  it('treats a 405 archive collection probe as an existing folder', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 405 }))
      .mockResolvedValueOnce(new Response(null, { status: 201 }))

    vi.stubGlobal('fetch', fetchMock)

    const result = await createWebDavProvider(configuredSettings()).uploadArchive(
      'abc123',
      new Blob(['payload'], { type: 'application/json' }),
    )

    expect(result.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0][1]?.method).toBe('HEAD')
    expect(fetchMock.mock.calls[1][1]?.method).toBe('PUT')
  })
})
