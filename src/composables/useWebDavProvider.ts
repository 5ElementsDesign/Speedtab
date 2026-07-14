import type {
  RemoteArchiveEntry,
  RemoteExportMetadata,
  RemoteLocalSettings,
  RemoteProviderConnectionStatus,
  RemoteProviderError,
  RemoteProviderResult,
  RemoteProviderUploadReceipt,
  RemoteProviderVerifyResult,
} from '@/types/remote'
import type { RemoteExportProvider, RemoteProviderRequestOptions } from '@/composables/useRemoteProvider'

const DATA_FILENAME = 'speedtab-data.json'
const ASSETS_FILENAME = 'speedtab-assets.json'
const LEGACY_EXPORT_FILENAME = 'speedtab-export.json'
const META_FILENAME = 'speedtab-meta.json'
const ARCHIVE_INDEX_FILENAME = 'speedtab-archive-index.json'
const ARCHIVE_DIRNAME = 'st-archive'
const DEFAULT_TIMEOUT_MS = 15_000
const MAX_RETRIES = 2
const RETRY_BASE_DELAY_MS = 50

interface WebDavResolvedUrls {
  providerRootUrl: string
  dataUrl: string
  assetsUrl: string
  legacyExportUrl: string
  metaUrl: string
  archiveRootUrl: string
  archiveIndexUrl: string
}

interface WebDavFetchOptions extends RemoteProviderRequestOptions {
  method: 'GET' | 'PUT' | 'HEAD' | 'MKCOL' | 'DELETE'
  url: string
  body?: BodyInit | null
  contentType?: string
}

function makeError(
  code: RemoteProviderError['code'],
  message: string,
  retryable: boolean,
  extra: Omit<RemoteProviderError, 'code' | 'message' | 'retryable'> = {},
): RemoteProviderError {
  return {
    code,
    message,
    retryable,
    ...extra,
  }
}

function toOk<T>(value: T): RemoteProviderResult<T> {
  return { ok: true, value }
}

function toErr<T>(error: RemoteProviderError): RemoteProviderResult<T> {
  return { ok: false, error }
}

function sanitizePathSegment(value: string): string {
  return value.replace(/^\/+|\/+$/g, '')
}

function normalizeRemotePath(remotePath: string): string {
  return remotePath
    .split('/')
    .map(sanitizePathSegment)
    .filter(Boolean)
    .join('/')
}

function normalizeEndpointUrl(endpointUrl: string): URL {
  const url = new URL(endpointUrl)
  url.username = ''
  url.password = ''
  url.protocol = url.protocol.toLowerCase()
  url.hostname = url.hostname.toLowerCase()

  if ((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')) {
    url.port = ''
  }

  const trimmedPath = url.pathname.replace(/\/+$/g, '')
  url.pathname = trimmedPath || '/'
  url.hash = ''
  url.search = ''
  return url
}

function resolveProviderUrls(settings: RemoteLocalSettings): WebDavResolvedUrls {
  const endpointUrl = normalizeEndpointUrl(settings.remote_endpoint_url!)
  const remotePath = normalizeRemotePath(settings.remote_path!)
  const providerRoot = remotePath
    ? new URL(`${remotePath}/`, endpointUrl.pathname.endsWith('/') ? endpointUrl.toString() : `${endpointUrl.toString()}/`)
    : endpointUrl

  return {
    providerRootUrl: providerRoot.toString(),
    dataUrl: new URL(DATA_FILENAME, providerRoot).toString(),
    assetsUrl: new URL(ASSETS_FILENAME, providerRoot).toString(),
    legacyExportUrl: new URL(LEGACY_EXPORT_FILENAME, providerRoot).toString(),
    metaUrl: new URL(META_FILENAME, providerRoot).toString(),
    archiveRootUrl: new URL(`../${ARCHIVE_DIRNAME}/`, providerRoot).toString(),
    archiveIndexUrl: new URL(ARCHIVE_INDEX_FILENAME, providerRoot).toString(),
  }
}

function makeArchiveDataFilename(workspaceChecksum: string): string {
  return `speedtab-export.${workspaceChecksum}.data.json`
}

function makeArchiveAssetsFilename(workspaceChecksum: string): string {
  return `speedtab-export.${workspaceChecksum}.assets.json`
}

function makeArchiveDataUrl(urls: WebDavResolvedUrls, workspaceChecksum: string): string {
  return new URL(makeArchiveDataFilename(workspaceChecksum), urls.archiveRootUrl).toString()
}

function makeArchiveAssetsUrl(urls: WebDavResolvedUrls, workspaceChecksum: string): string {
  return new URL(makeArchiveAssetsFilename(workspaceChecksum), urls.archiveRootUrl).toString()
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export async function getWebDavProviderEndpointHash(settings: RemoteLocalSettings): Promise<string> {
  const urls = resolveProviderUrls(settings)
  return sha256Hex(`webdav|${urls.providerRootUrl}`)
}

function makeBasicAuthHeader(settings: RemoteLocalSettings): string {
  return `Basic ${btoa(`${settings.remote_username}:${settings.remote_secret}`)}`
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchWithWebDavHandling(
  settings: RemoteLocalSettings,
  options: WebDavFetchOptions,
): Promise<Response> {
  let attempt = 0

  for (;;) {
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
    const timeoutController = new AbortController()
    let didTimeout = false
    const timeoutHandle = setTimeout(() => {
      didTimeout = true
      timeoutController.abort()
    }, timeoutMs)

    const abortController = new AbortController()
    const abortFromCaller = () => abortController.abort()
    options.signal?.addEventListener('abort', abortFromCaller, { once: true })
    timeoutController.signal.addEventListener('abort', () => abortController.abort(), { once: true })

    try {
      const response = await fetch(options.url, {
        method: options.method,
        body: options.body ?? undefined,
        signal: abortController.signal,
        headers: {
          Authorization: makeBasicAuthHeader(settings),
          ...(options.contentType ? { 'Content-Type': options.contentType } : {}),
        },
      })

      if (response.status >= 500 && response.status < 600 && attempt < MAX_RETRIES) {
        attempt += 1
        await delay(RETRY_BASE_DELAY_MS * (2 ** (attempt - 1)))
        continue
      }

      return response
    } catch (error) {
      if (isAbortError(error)) {
        if (options.signal?.aborted) {
          throw makeError('network_error', 'Remote request was aborted by the user.', false, { cause: error })
        }
        if (didTimeout) {
          throw makeError('timeout', 'Remote request timed out.', true, { cause: error })
        }
      }

      if (attempt < MAX_RETRIES) {
        attempt += 1
        await delay(RETRY_BASE_DELAY_MS * (2 ** (attempt - 1)))
        continue
      }

      throw makeError('network_error', 'Remote request failed.', true, { cause: error })
    } finally {
      clearTimeout(timeoutHandle)
      options.signal?.removeEventListener('abort', abortFromCaller)
    }
  }
}

function mapHttpError(response: Response, missingMessage: string): RemoteProviderError {
  if (response.status === 401 || response.status === 403) {
    return makeError('auth_failed', 'Remote authentication failed.', false, { status: response.status })
  }
  if (response.status === 404) {
    return makeError('file_missing', missingMessage, false, { status: response.status })
  }
  if (response.status >= 500) {
    return makeError('network_error', 'Remote server error.', true, { status: response.status })
  }
  return makeError('network_error', `Remote request failed with status ${response.status}.`, false, { status: response.status })
}

function mapUploadHttpError(response: Response, kind: 'export' | 'assets' | 'metadata'): RemoteProviderError {
  if (response.status === 401 || response.status === 403) {
    return makeError('auth_failed', 'Remote authentication failed.', false, { status: response.status })
  }
  if (response.status === 404) {
    return makeError(
      'file_missing',
      `Remote ${kind} upload failed because the configured WebDAV path does not exist. Create the remote folder first, then try again.`,
      false,
      { status: response.status },
    )
  }
  if (response.status >= 500) {
    return makeError('network_error', 'Remote server error.', true, { status: response.status })
  }
  return makeError('network_error', `Remote ${kind} upload failed with status ${response.status}.`, false, { status: response.status })
}

function mapArchiveCollectionError(response: Response): RemoteProviderError {
  if (response.status === 401 || response.status === 403) {
    return makeError('auth_failed', 'Remote authentication failed.', false, { status: response.status })
  }
  if (response.status === 404) {
    return makeError(
      'file_missing',
      'Remote archive folder could not be created because the configured WebDAV path does not exist. Create the remote folder first, then try again.',
      false,
      { status: response.status },
    )
  }
  if (response.status >= 500) {
    return makeError('network_error', 'Remote server error.', true, { status: response.status })
  }
  return makeError('network_error', `Remote archive folder request failed with status ${response.status}.`, false, { status: response.status })
}

function parseExportSize(response: Response): number | null {
  const value = response.headers.get('content-length')
  if (!value) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeArchiveEntry(raw: unknown): RemoteArchiveEntry | null {
  if (!isRecord(raw) || typeof raw.workspace_checksum !== 'string') return null
  return {
    workspace_checksum: raw.workspace_checksum,
    exported_at: typeof raw.exported_at === 'string' ? raw.exported_at : null,
    source_device_label: typeof raw.source_device_label === 'string' ? raw.source_device_label : null,
    payload_mode: raw.payload_mode === 'single' ? 'single' : 'split',
    assets_count: typeof raw.assets_count === 'number' ? raw.assets_count : null,
  }
}

function mergeArchiveEntries(entries: RemoteArchiveEntry[], nextEntry: RemoteArchiveEntry): RemoteArchiveEntry[] {
  const filtered = entries.filter((entry) => entry.workspace_checksum !== nextEntry.workspace_checksum)
  return [nextEntry, ...filtered].sort((a, b) => Date.parse(b.exported_at ?? '') - Date.parse(a.exported_at ?? ''))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object'
}

function isRemoteProviderError(value: unknown): value is RemoteProviderError {
  return isRecord(value)
    && typeof value.code === 'string'
    && typeof value.message === 'string'
    && typeof value.retryable === 'boolean'
}

function parseRemoteMetadata(raw: unknown): RemoteProviderResult<RemoteExportMetadata> {
  if (!isRecord(raw)) {
    return toErr(makeError('corrupt_remote_state', 'Remote metadata is not a JSON object.', false))
  }

  const {
    manifest_version,
    app_version,
    exported_at,
    workspace_checksum,
    payload_mode,
    assets_count,
    source_device_label,
    provider_endpoint_hash,
  } = raw

  if (
    typeof manifest_version !== 'number' ||
    typeof exported_at !== 'string' ||
    typeof workspace_checksum !== 'string'
  ) {
    return toErr(makeError('corrupt_remote_state', 'Remote metadata is missing required fields.', false))
  }

  return toOk({
    manifest_version,
    app_version: typeof app_version === 'string' ? app_version : null,
    exported_at,
    workspace_checksum,
    payload_mode: payload_mode === 'split' ? 'split' : 'single',
    assets_count: typeof assets_count === 'number' ? assets_count : 0,
    source_device_label: typeof source_device_label === 'string' ? source_device_label : null,
    provider_endpoint_hash: typeof provider_endpoint_hash === 'string' ? provider_endpoint_hash : null,
  })
}

async function readJsonResponse<T>(
  response: Response,
  parser: (raw: unknown) => RemoteProviderResult<T>,
): Promise<RemoteProviderResult<T>> {
  try {
    const raw = await response.json()
    return parser(raw)
  } catch (error) {
    return toErr(makeError('corrupt_remote_state', 'Remote JSON could not be parsed.', false, { cause: error }))
  }
}

export function createWebDavProvider(settings: RemoteLocalSettings): RemoteExportProvider {
  const urls = resolveProviderUrls(settings)

  const ensureArchiveRootExists = async (options?: RemoteProviderRequestOptions): Promise<RemoteProviderResult<true>> => {
    try {
      const headResponse = await fetchWithWebDavHandling(settings, {
        method: 'HEAD',
        url: urls.archiveRootUrl,
        signal: options?.signal,
        timeoutMs: options?.timeoutMs,
      })

      if ([200, 204, 405].includes(headResponse.status)) {
        return toOk(true)
      }

      if (headResponse.status !== 404) {
        return toErr(mapArchiveCollectionError(headResponse))
      }

      const mkcolResponse = await fetchWithWebDavHandling(settings, {
        method: 'MKCOL',
        url: urls.archiveRootUrl,
        signal: options?.signal,
        timeoutMs: options?.timeoutMs,
      })

      if ([200, 201, 204, 405].includes(mkcolResponse.status)) {
        return toOk(true)
      }

      return toErr(mapArchiveCollectionError(mkcolResponse))
    } catch (error) {
      return toErr(isRemoteProviderError(error)
        ? error
        : makeError('network_error', 'Remote archive folder check failed.', true, { cause: error }))
    }
  }

  const listArchives = async (options?: RemoteProviderRequestOptions): Promise<RemoteProviderResult<RemoteArchiveEntry[]>> => {
    try {
      const response = await fetchWithWebDavHandling(settings, {
        method: 'GET',
        url: urls.archiveIndexUrl,
        signal: options?.signal,
        timeoutMs: options?.timeoutMs,
      })
      if (response.status === 404) return toOk([])
      if (response.status < 200 || response.status >= 300) {
        return toErr(mapHttpError(response, 'Remote archive index is missing.'))
      }
      const payload = await response.json()
      const archives = Array.isArray(payload?.archives)
        ? payload.archives.map(normalizeArchiveEntry).filter(Boolean) as RemoteArchiveEntry[]
        : []
      return toOk(archives)
    } catch (error) {
      return toErr(isRemoteProviderError(error)
        ? error
        : makeError('network_error', 'Remote archive list failed.', true, { cause: error }))
    }
  }

  const testConnection = async (options?: RemoteProviderRequestOptions): Promise<RemoteProviderResult<RemoteProviderConnectionStatus>> => {
    try {
      const response = await fetchWithWebDavHandling(settings, {
        method: 'HEAD',
        url: urls.metaUrl,
        signal: options?.signal,
        timeoutMs: options?.timeoutMs,
      })

      if (![200, 404].includes(response.status)) {
        return toErr(mapHttpError(response, 'Remote metadata file is missing.'))
      }

      return toOk({
        provider_id: await getWebDavProviderEndpointHash(settings),
      })
    } catch (error) {
      return toErr(isRemoteProviderError(error)
        ? error
        : makeError('network_error', 'Remote connection check failed.', true, { cause: error }))
    }
  }

  const downloadMeta = async (options?: RemoteProviderRequestOptions): Promise<RemoteProviderResult<RemoteExportMetadata>> => {
    try {
      const response = await fetchWithWebDavHandling(settings, {
        method: 'GET',
        url: urls.metaUrl,
        signal: options?.signal,
        timeoutMs: options?.timeoutMs,
      })

      if (response.status !== 200) {
        return toErr(mapHttpError(response, 'Remote metadata file is missing.'))
      }

      return readJsonResponse(response, parseRemoteMetadata)
    } catch (error) {
      return toErr(isRemoteProviderError(error)
        ? error
        : makeError('network_error', 'Remote metadata download failed.', true, { cause: error }))
    }
  }

  const downloadExport = async (options?: RemoteProviderRequestOptions): Promise<RemoteProviderResult<Blob>> => {
    try {
      const response = await fetchWithWebDavHandling(settings, {
        method: 'GET',
        url: urls.dataUrl,
        signal: options?.signal,
        timeoutMs: options?.timeoutMs,
      })

      if (response.status === 200) {
        return toOk(await response.blob())
      }
      if (response.status !== 404) {
        return toErr(mapHttpError(response, 'Remote export file is missing.'))
      }

      const legacyResponse = await fetchWithWebDavHandling(settings, {
        method: 'GET',
        url: urls.legacyExportUrl,
        signal: options?.signal,
        timeoutMs: options?.timeoutMs,
      })

      if (legacyResponse.status !== 200) {
        return toErr(mapHttpError(legacyResponse, 'Remote export file is missing.'))
      }

      return toOk(await legacyResponse.blob())
    } catch (error) {
      return toErr(isRemoteProviderError(error)
        ? error
        : makeError('network_error', 'Remote export download failed.', true, { cause: error }))
    }
  }

  const downloadAssets = async (options?: RemoteProviderRequestOptions): Promise<RemoteProviderResult<Blob>> => {
    try {
      const response = await fetchWithWebDavHandling(settings, {
        method: 'GET',
        url: urls.assetsUrl,
        signal: options?.signal,
        timeoutMs: options?.timeoutMs,
      })

      if (response.status !== 200) {
        return toErr(mapHttpError(response, 'Remote assets file is missing.'))
      }

      return toOk(await response.blob())
    } catch (error) {
      return toErr(isRemoteProviderError(error)
        ? error
        : makeError('network_error', 'Remote assets download failed.', true, { cause: error }))
    }
  }

  const deleteRemoteUrls = async (
    targetUrls: string[],
    options?: RemoteProviderRequestOptions,
  ): Promise<RemoteProviderResult<true>> => {
    try {
      const responses = await Promise.all(
        targetUrls.map((url) => fetchWithWebDavHandling(settings, {
          method: 'DELETE',
          url,
          signal: options?.signal,
          timeoutMs: options?.timeoutMs,
        })),
      )

      const allowedDeleteStatuses = [200, 202, 204, 404]
      for (const response of responses) {
        if (!allowedDeleteStatuses.includes(response.status)) {
          return toErr(mapHttpError(response, 'Remote file could not be deleted.'))
        }
      }

      return toOk(true)
    } catch (error) {
      return toErr(isRemoteProviderError(error)
        ? error
        : makeError('network_error', 'Remote deletion failed.', true, { cause: error }))
    }
  }

  const downloadArchiveExport = async (workspaceChecksum: string, options?: RemoteProviderRequestOptions): Promise<RemoteProviderResult<Blob>> => {
    try {
      const [dataResponse, assetsResponse] = await Promise.all([
        fetchWithWebDavHandling(settings, {
          method: 'GET',
          url: makeArchiveDataUrl(urls, workspaceChecksum),
          signal: options?.signal,
          timeoutMs: options?.timeoutMs,
        }),
        fetchWithWebDavHandling(settings, {
          method: 'GET',
          url: makeArchiveAssetsUrl(urls, workspaceChecksum),
          signal: options?.signal,
          timeoutMs: options?.timeoutMs,
        }),
      ])

      if (dataResponse.status < 200 || dataResponse.status >= 300) {
        return toErr(mapHttpError(dataResponse, 'Remote archive export is missing.'))
      }
      if (assetsResponse.status < 200 || assetsResponse.status >= 300) {
        return toErr(mapHttpError(assetsResponse, 'Remote archive assets are missing.'))
      }

      const manifest = await dataResponse.json()
      const assetsPayload = await assetsResponse.json()
      const merged = {
        ...manifest,
        assets: Array.isArray(assetsPayload?.assets) ? assetsPayload.assets : [],
      }

      return toOk(new Blob([JSON.stringify(merged)], { type: 'application/json' }))
    } catch (error) {
      return toErr(isRemoteProviderError(error)
        ? error
        : makeError('network_error', 'Remote archive download failed.', true, { cause: error }))
    }
  }

  const deleteArchive = async (workspaceChecksum: string, options?: RemoteProviderRequestOptions): Promise<RemoteProviderResult<true>> => {
    try {
      const [dataResponse, assetsResponse] = await Promise.all([
        fetchWithWebDavHandling(settings, {
          method: 'DELETE',
          url: makeArchiveDataUrl(urls, workspaceChecksum),
          signal: options?.signal,
          timeoutMs: options?.timeoutMs,
        }),
        fetchWithWebDavHandling(settings, {
          method: 'DELETE',
          url: makeArchiveAssetsUrl(urls, workspaceChecksum),
          signal: options?.signal,
          timeoutMs: options?.timeoutMs,
        }),
      ])

      const allowedDeleteStatuses = [200, 202, 204, 404]
      if (!allowedDeleteStatuses.includes(dataResponse.status)) {
        return toErr(mapHttpError(dataResponse, 'Remote archive export could not be deleted.'))
      }
      if (!allowedDeleteStatuses.includes(assetsResponse.status)) {
        return toErr(mapHttpError(assetsResponse, 'Remote archive assets could not be deleted.'))
      }

      const existingIndex = await listArchives(options)
      if (!existingIndex.ok) return existingIndex as RemoteProviderResult<true>

      const indexPayload = new Blob([JSON.stringify({
        archives: existingIndex.value.filter((entry) => entry.workspace_checksum !== workspaceChecksum),
      }, null, 2)], { type: 'application/json' })

      const indexResponse = await fetchWithWebDavHandling(settings, {
        method: 'PUT',
        url: urls.archiveIndexUrl,
        body: indexPayload,
        contentType: 'application/json',
        signal: options?.signal,
        timeoutMs: options?.timeoutMs,
      })

      if (indexResponse.status < 200 || indexResponse.status >= 300) {
        return toErr(mapUploadHttpError(indexResponse, 'metadata'))
      }

      return toOk(true)
    } catch (error) {
      return toErr(isRemoteProviderError(error)
        ? error
        : makeError('network_error', 'Remote archive deletion failed.', true, { cause: error }))
    }
  }

  const deleteLiveExport = async (options?: RemoteProviderRequestOptions): Promise<RemoteProviderResult<true>> =>
    deleteRemoteUrls([
      urls.dataUrl,
      urls.assetsUrl,
      urls.metaUrl,
      urls.legacyExportUrl,
    ], options)

  const wipeRemoteData = async (options?: RemoteProviderRequestOptions): Promise<RemoteProviderResult<true>> => {
    const liveDelete = await deleteRemoteUrls([
      urls.dataUrl,
      urls.assetsUrl,
      urls.metaUrl,
      urls.legacyExportUrl,
      urls.archiveIndexUrl,
    ], options)
    if (!liveDelete.ok) return liveDelete

    const archives = await listArchives(options)
    if (!archives.ok) return archives as RemoteProviderResult<true>

    for (const archive of archives.value) {
      const deleted = await deleteRemoteUrls([
        makeArchiveDataUrl(urls, archive.workspace_checksum),
        makeArchiveAssetsUrl(urls, archive.workspace_checksum),
      ], options)
      if (!deleted.ok) return deleted
    }

    return toOk(true)
  }

  const uploadExport = async (exportBlob: Blob, options?: RemoteProviderRequestOptions): Promise<RemoteProviderResult<RemoteProviderUploadReceipt>> => {
    try {
      const response = await fetchWithWebDavHandling(settings, {
        method: 'PUT',
        url: urls.dataUrl,
        body: exportBlob,
        contentType: exportBlob.type || 'application/json',
        signal: options?.signal,
        timeoutMs: options?.timeoutMs,
      })

      if (response.status < 200 || response.status >= 300) {
        return toErr(mapUploadHttpError(response, 'export'))
      }

      return toOk({
        provider_id: await getWebDavProviderEndpointHash(settings),
        bytes_uploaded: exportBlob.size,
      })
    } catch (error) {
      return toErr(isRemoteProviderError(error)
        ? error
        : makeError('network_error', 'Remote export upload failed.', true, { cause: error }))
    }
  }

  const uploadAssets = async (assetsBlob: Blob, options?: RemoteProviderRequestOptions): Promise<RemoteProviderResult<RemoteProviderUploadReceipt>> => {
    try {
      const response = await fetchWithWebDavHandling(settings, {
        method: 'PUT',
        url: urls.assetsUrl,
        body: assetsBlob,
        contentType: assetsBlob.type || 'application/json',
        signal: options?.signal,
        timeoutMs: options?.timeoutMs,
      })

      if (response.status < 200 || response.status >= 300) {
        return toErr(mapUploadHttpError(response, 'assets'))
      }

      return toOk({
        provider_id: await getWebDavProviderEndpointHash(settings),
        bytes_uploaded: assetsBlob.size,
      })
    } catch (error) {
      return toErr(isRemoteProviderError(error)
        ? error
        : makeError('network_error', 'Remote assets upload failed.', true, { cause: error }))
    }
  }

  const archiveExists = async (workspaceChecksum: string, options?: RemoteProviderRequestOptions): Promise<RemoteProviderResult<boolean>> => {
    try {
      const [dataResponse, assetsResponse] = await Promise.all([
        fetchWithWebDavHandling(settings, {
          method: 'HEAD',
          url: makeArchiveDataUrl(urls, workspaceChecksum),
          signal: options?.signal,
          timeoutMs: options?.timeoutMs,
        }),
        fetchWithWebDavHandling(settings, {
          method: 'HEAD',
          url: makeArchiveAssetsUrl(urls, workspaceChecksum),
          signal: options?.signal,
          timeoutMs: options?.timeoutMs,
        }),
      ])

      if (dataResponse.status === 200 && assetsResponse.status === 200) return toOk(true)
      if ([200, 404].includes(dataResponse.status) && [200, 404].includes(assetsResponse.status)) return toOk(false)
      if (dataResponse.status !== 200 && dataResponse.status !== 404) {
        return toErr(mapHttpError(dataResponse, 'Remote archive export is missing.'))
      }
      return toErr(mapHttpError(assetsResponse, 'Remote archive assets are missing.'))
    } catch (error) {
      return toErr(isRemoteProviderError(error)
        ? error
        : makeError('network_error', 'Remote archive check failed.', true, { cause: error }))
    }
  }

  const uploadArchive = async (
    workspaceChecksum: string,
    exportBlob: Blob,
    assetsBlob: Blob,
    options?: RemoteProviderRequestOptions,
  ): Promise<RemoteProviderResult<RemoteProviderUploadReceipt>> => {
    try {
      const archiveRootResult = await ensureArchiveRootExists(options)
      if (!archiveRootResult.ok) return archiveRootResult

      const [dataResponse, assetsResponse] = await Promise.all([
        fetchWithWebDavHandling(settings, {
          method: 'PUT',
          url: makeArchiveDataUrl(urls, workspaceChecksum),
          body: exportBlob,
          contentType: exportBlob.type || 'application/json',
          signal: options?.signal,
          timeoutMs: options?.timeoutMs,
        }),
        fetchWithWebDavHandling(settings, {
          method: 'PUT',
          url: makeArchiveAssetsUrl(urls, workspaceChecksum),
          body: assetsBlob,
          contentType: assetsBlob.type || 'application/json',
          signal: options?.signal,
          timeoutMs: options?.timeoutMs,
        }),
      ])

      if (dataResponse.status < 200 || dataResponse.status >= 300) {
        return toErr(mapUploadHttpError(dataResponse, 'export'))
      }
      if (assetsResponse.status < 200 || assetsResponse.status >= 300) {
        return toErr(mapUploadHttpError(assetsResponse, 'assets'))
      }

      const existingIndex = await listArchives(options)
      if (!existingIndex.ok) return existingIndex as RemoteProviderResult<RemoteProviderUploadReceipt>
      const nextEntry: RemoteArchiveEntry = {
        workspace_checksum: workspaceChecksum,
        exported_at: new Date().toISOString(),
        source_device_label: settings.device_label,
        payload_mode: 'split',
        assets_count: null,
      }
      const indexPayload = new Blob([JSON.stringify({
        archives: mergeArchiveEntries(existingIndex.value, nextEntry),
      }, null, 2)], { type: 'application/json' })
      const indexResponse = await fetchWithWebDavHandling(settings, {
        method: 'PUT',
        url: urls.archiveIndexUrl,
        body: indexPayload,
        contentType: 'application/json',
        signal: options?.signal,
        timeoutMs: options?.timeoutMs,
      })
      if (indexResponse.status < 200 || indexResponse.status >= 300) {
        return toErr(mapUploadHttpError(indexResponse, 'metadata'))
      }

      return toOk({
        provider_id: await getWebDavProviderEndpointHash(settings),
        bytes_uploaded: exportBlob.size + assetsBlob.size + indexPayload.size,
      })
    } catch (error) {
      return toErr(isRemoteProviderError(error)
        ? error
        : makeError('network_error', 'Remote archive upload failed.', true, { cause: error }))
    }
  }

  const uploadMeta = async (meta: RemoteExportMetadata, options?: RemoteProviderRequestOptions): Promise<RemoteProviderResult<RemoteProviderUploadReceipt>> => {
    const payload = new Blob([JSON.stringify(meta)], { type: 'application/json' })

    try {
      const response = await fetchWithWebDavHandling(settings, {
        method: 'PUT',
        url: urls.metaUrl,
        body: payload,
        contentType: 'application/json',
        signal: options?.signal,
        timeoutMs: options?.timeoutMs,
      })

      if (response.status < 200 || response.status >= 300) {
        return toErr(mapUploadHttpError(response, 'metadata'))
      }

      return toOk({
        provider_id: await getWebDavProviderEndpointHash(settings),
        bytes_uploaded: payload.size,
      })
    } catch (error) {
      return toErr(isRemoteProviderError(error)
        ? error
        : makeError('network_error', 'Remote metadata upload failed.', true, { cause: error }))
    }
  }

  const verify = async (options?: RemoteProviderRequestOptions): Promise<RemoteProviderResult<RemoteProviderVerifyResult>> => {
    const providerId = await getWebDavProviderEndpointHash(settings)

    try {
      const [metaHead, exportHead, assetsHead, legacyHead] = await Promise.all([
        fetchWithWebDavHandling(settings, {
          method: 'HEAD',
          url: urls.metaUrl,
          signal: options?.signal,
          timeoutMs: options?.timeoutMs,
        }),
        fetchWithWebDavHandling(settings, {
          method: 'HEAD',
          url: urls.dataUrl,
          signal: options?.signal,
          timeoutMs: options?.timeoutMs,
        }),
        fetchWithWebDavHandling(settings, {
          method: 'HEAD',
          url: urls.assetsUrl,
          signal: options?.signal,
          timeoutMs: options?.timeoutMs,
        }),
        fetchWithWebDavHandling(settings, {
          method: 'HEAD',
          url: urls.legacyExportUrl,
          signal: options?.signal,
          timeoutMs: options?.timeoutMs,
        }),
      ])

      const allowedStatuses = [200, 404]
      if (!allowedStatuses.includes(metaHead.status)) {
        return toErr(mapHttpError(metaHead, 'Remote metadata file is missing.'))
      }
      if (!allowedStatuses.includes(exportHead.status)) {
        return toErr(mapHttpError(exportHead, 'Remote export file is missing.'))
      }
      if (!allowedStatuses.includes(assetsHead.status)) {
        return toErr(mapHttpError(assetsHead, 'Remote assets file is missing.'))
      }
      if (!allowedStatuses.includes(legacyHead.status)) {
        return toErr(mapHttpError(legacyHead, 'Remote export file is missing.'))
      }

      let meta: RemoteExportMetadata | null = null
      if (metaHead.status === 200) {
        const metaResult = await downloadMeta(options)
        if (!metaResult.ok) return metaResult as RemoteProviderResult<RemoteProviderVerifyResult>
        meta = metaResult.value
      }

      const hasSplitData = exportHead.status === 200
      const hasSplitAssets = assetsHead.status === 200
      const hasLegacyExport = legacyHead.status === 200
      const exportExists = hasSplitData || hasLegacyExport
      const assetsExists = hasSplitData ? hasSplitAssets : hasLegacyExport
      const payloadMode = hasSplitData ? 'split' : hasLegacyExport ? 'single' : 'missing'
      const warnings: string[] = []
      if (exportExists && metaHead.status === 404) {
        warnings.push('Export file exists without metadata sidecar.')
      }
      if (metaHead.status === 200 && !exportExists) {
        warnings.push('Metadata sidecar exists without export file.')
      }
      if (hasSplitData && !hasSplitAssets) {
        warnings.push('Split remote export is missing the assets payload.')
      }
      if (!hasSplitData && hasSplitAssets) {
        warnings.push('Remote assets payload exists without the data export.')
      }
      if (meta?.provider_endpoint_hash && meta.provider_endpoint_hash !== providerId) {
        warnings.push('Remote metadata was written for a different endpoint context.')
      }

      return toOk({
        provider_id: providerId,
        meta,
        export_exists: exportExists,
        assets_exists: assetsExists,
        meta_exists: metaHead.status === 200,
        payload_mode: payloadMode,
        export_size_bytes: hasSplitData ? parseExportSize(exportHead) : hasLegacyExport ? parseExportSize(legacyHead) : null,
        assets_size_bytes: hasSplitAssets ? parseExportSize(assetsHead) : null,
        warnings,
      })
    } catch (error) {
      return toErr(isRemoteProviderError(error)
        ? error
        : makeError('network_error', 'Remote verification failed.', true, { cause: error }))
    }
  }

  return {
    type: 'webdav',
    settings,
    supportsEncryption: false,
    capabilities: {
      provider_specific: [],
    },
    isConfigured: () => true,
    testConnection,
    downloadMeta,
    downloadExport,
    downloadAssets,
    downloadArchiveExport,
    deleteArchive,
    deleteLiveExport,
    wipeRemoteData,
    uploadExport,
    uploadAssets,
    listArchives,
    archiveExists,
    uploadArchive,
    uploadMeta,
    verify,
  }
}
