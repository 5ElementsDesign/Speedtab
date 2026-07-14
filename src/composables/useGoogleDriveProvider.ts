import type {
  RemoteArchiveEntry,
  RemoteExportMetadata,
  RemoteLocalSettings,
  RemoteProviderConnectionStatus,
  RemoteProviderError,
  RemoteProviderResult,
  RemoteProviderUploadReceipt,
} from '@/types/remote'
import type { RemoteExportProvider, RemoteProviderRequestOptions } from '@/composables/useRemoteProvider'

const DRIVE_API_ROOT = 'https://www.googleapis.com/drive/v3'
const DRIVE_UPLOAD_ROOT = 'https://www.googleapis.com/upload/drive/v3'
const DATA_FILENAME = 'speedtab-data.json'
const ASSETS_FILENAME = 'speedtab-assets.json'
const LEGACY_EXPORT_FILENAME = 'speedtab-export.json'
const META_FILENAME = 'speedtab-meta.json'
const ARCHIVE_INDEX_FILENAME = 'speedtab-archive-index.json'
const ARCHIVE_DATA_PREFIX = 'speedtab-export.'
const ARCHIVE_DATA_SUFFIX = '.data.json'
const ARCHIVE_ASSETS_PREFIX = 'speedtab-export.'
const ARCHIVE_ASSETS_SUFFIX = '.assets.json'
const APPDATA_SPACE = 'appDataFolder'
const PROVIDER_ID = 'gdrive:appDataFolder'
const DEFAULT_TIMEOUT_MS = 15_000

interface DriveFileRef {
  id: string
  name: string
  size?: string
  modifiedTime?: string
}

interface ArchiveIndexPayload {
  archives: RemoteArchiveEntry[]
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
  return {ok: true, value}
}

function toErr<T>(error: RemoteProviderError): RemoteProviderResult<T> {
  return {ok: false, error}
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

function getChromeRuntimeErrorMessage() {
  return globalThis.chrome?.runtime?.lastError?.message || ''
}

function getAuthToken(interactive = false): Promise<string> {
  return new Promise((resolve, reject) => {
    const identity = globalThis.chrome?.identity
    if (!identity?.getAuthToken) {
      reject(makeError('unsupported_provider', 'Chrome Identity API is unavailable.', false))
      return
    }

    identity.getAuthToken({interactive}, (token) => {
      const runtimeMessage = getChromeRuntimeErrorMessage()
      if (runtimeMessage) {
        reject(makeError('auth_failed', runtimeMessage, interactive))
        return
      }
      if (!token) {
        reject(makeError('auth_failed', 'Google Drive authorization was not granted.', interactive))
        return
      }
      resolve(token)
    })
  })
}

function removeCachedToken(token: string): Promise<void> {
  return new Promise((resolve) => {
    const identity = globalThis.chrome?.identity
    if (!identity?.removeCachedAuthToken) {
      resolve()
      return
    }
    identity.removeCachedAuthToken({token}, () => resolve())
  })
}

async function revokeGoogleToken(token: string): Promise<void> {
  try {
    await fetch('https://oauth2.googleapis.com/revoke', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `token=${encodeURIComponent(token)}`,
    })
  } catch (error) {
    console.warn('[Speedtab] Google token revocation failed', error)
  }
}

function getProfileUserInfo(): Promise<{email?: string; id?: string}> {
  return new Promise((resolve) => {
    const identity = globalThis.chrome?.identity as (typeof globalThis.chrome.identity & {
      getProfileUserInfo?: (callback: (info: {email?: string; id?: string}) => void) => void
    }) | undefined
    if (!identity?.getProfileUserInfo) {
      resolve({})
      return
    }
    identity.getProfileUserInfo((info) => {
      resolve(info || {})
    })
  })
}

async function fetchWithDriveAuth(
  input: string,
  init: RequestInit = {},
  options: RemoteProviderRequestOptions & {interactive?: boolean; retryOnAuth?: boolean} = {},
): Promise<Response> {
  const {signal, timeoutMs = DEFAULT_TIMEOUT_MS, interactive = false, retryOnAuth = true} = options
  const token = await getAuthToken(interactive)
  const controller = new AbortController()
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs)
  const abortFromCaller = () => controller.abort()
  signal?.addEventListener('abort', abortFromCaller, {once: true})

  try {
    const headers = new Headers(init.headers || {})
    headers.set('Authorization', `Bearer ${token}`)
    const response = await fetch(input, {
      ...init,
      headers,
      signal: controller.signal,
    })

    if ((response.status === 401 || response.status === 403) && retryOnAuth) {
      await removeCachedToken(token)
      return fetchWithDriveAuth(input, init, {
        ...options,
        retryOnAuth: false,
        interactive,
      })
    }

    return response
  } catch (error) {
    if (isAbortError(error)) {
      if (signal?.aborted) {
        throw makeError('network_error', 'Remote request was aborted by the user.', false, {cause: error})
      }
      throw makeError('timeout', 'Remote request timed out.', true, {cause: error})
    }
    throw makeError('network_error', 'Google Drive request failed.', true, {cause: error})
  } finally {
    clearTimeout(timeoutHandle)
    signal?.removeEventListener('abort', abortFromCaller)
  }
}

function mapHttpError(response: Response, fallbackMessage: string): RemoteProviderError {
  if (response.status === 401 || response.status === 403) {
    return makeError('auth_failed', 'Google Drive authorization failed.', false, {status: response.status})
  }
  if (response.status === 404) {
    return makeError('file_missing', fallbackMessage, false, {status: response.status})
  }
  if (response.status >= 500) {
    return makeError('network_error', 'Google Drive server error.', true, {status: response.status})
  }
  return makeError('network_error', `Google Drive request failed with status ${response.status}.`, false, {status: response.status})
}

function escapeDriveQueryValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

async function listFilesByName(
  name: string,
  options: RemoteProviderRequestOptions & {interactive?: boolean} = {},
): Promise<RemoteProviderResult<DriveFileRef[]>> {
  return listFilesByQuery(`name='${escapeDriveQueryValue(name)}' and trashed=false`, options)
}

async function listFilesByQuery(
  queryValue: string,
  options: RemoteProviderRequestOptions & {interactive?: boolean} = {},
): Promise<RemoteProviderResult<DriveFileRef[]>> {
  const query = new URLSearchParams({
    spaces: APPDATA_SPACE,
    q: queryValue,
    fields: 'files(id,name,size,modifiedTime)',
    orderBy: 'modifiedTime desc',
    pageSize: '25',
  })

  try {
    const response = await fetchWithDriveAuth(`${DRIVE_API_ROOT}/files?${query.toString()}`, {method: 'GET'}, options)
    if (!response.ok) return toErr(mapHttpError(response, `Google Drive file "${name}" was not found.`))
    const payload = await response.json()
    return toOk(Array.isArray(payload?.files) ? payload.files : [])
  } catch (error) {
    return toErr(error as RemoteProviderError)
  }
}

async function findFirstFileByName(
  name: string,
  options: RemoteProviderRequestOptions & {interactive?: boolean} = {},
): Promise<RemoteProviderResult<DriveFileRef | null>> {
  const listed = await listFilesByName(name, options)
  if (!listed.ok) return listed
  return toOk(listed.value[0] ?? null)
}

async function downloadFileBlob(
  fileId: string,
  options: RemoteProviderRequestOptions & {interactive?: boolean} = {},
): Promise<RemoteProviderResult<Blob>> {
  try {
    const response = await fetchWithDriveAuth(`${DRIVE_API_ROOT}/files/${encodeURIComponent(fileId)}?alt=media`, {method: 'GET'}, options)
    if (!response.ok) return toErr(mapHttpError(response, 'Google Drive file content could not be downloaded.'))
    return toOk(await response.blob())
  } catch (error) {
    return toErr(error as RemoteProviderError)
  }
}

async function downloadNamedBlob(
  name: string,
  options: RemoteProviderRequestOptions & {interactive?: boolean} = {},
): Promise<RemoteProviderResult<Blob>> {
  const file = await findFirstFileByName(name, options)
  if (!file.ok) return file as RemoteProviderResult<Blob>
  if (!file.value) {
    return toErr(makeError('file_missing', `Google Drive file "${name}" was not found.`, false))
  }
  return downloadFileBlob(file.value.id, options)
}

async function deleteFileById(
  fileId: string,
  options: RemoteProviderRequestOptions & {interactive?: boolean} = {},
): Promise<RemoteProviderResult<true>> {
  try {
    const response = await fetchWithDriveAuth(
      `${DRIVE_API_ROOT}/files/${encodeURIComponent(fileId)}`,
      {method: 'DELETE'},
      options,
    )
    if (!response.ok) return toErr(mapHttpError(response, 'Google Drive file could not be deleted.'))
    return toOk(true)
  } catch (error) {
    return toErr(error as RemoteProviderError)
  }
}

async function deleteNamedFiles(
  names: string[],
  options: RemoteProviderRequestOptions & {interactive?: boolean} = {},
): Promise<RemoteProviderResult<true>> {
  for (const name of names) {
    const files = await listFilesByName(name, options)
    if (!files.ok) return files as RemoteProviderResult<true>
    for (const file of files.value) {
      const deleted = await deleteFileById(file.id, options)
      if (!deleted.ok) return deleted
    }
  }
  return toOk(true)
}

async function deleteFilesMatchingQuery(
  queryValue: string,
  options: RemoteProviderRequestOptions & {interactive?: boolean} = {},
): Promise<RemoteProviderResult<true>> {
  const files = await listFilesByQuery(queryValue, options)
  if (!files.ok) return files as RemoteProviderResult<true>
  for (const file of files.value) {
    const deleted = await deleteFileById(file.id, options)
    if (!deleted.ok) return deleted
  }
  return toOk(true)
}

async function createMultipartFile(
  name: string,
  blob: Blob,
  options: RemoteProviderRequestOptions & {interactive?: boolean} = {},
): Promise<RemoteProviderResult<RemoteProviderUploadReceipt>> {
  const boundary = `speedtab-${crypto.randomUUID()}`
  const metadata = JSON.stringify({
    name,
    parents: [APPDATA_SPACE],
  })
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`,
    `--${boundary}\r\nContent-Type: ${blob.type || 'application/octet-stream'}\r\n\r\n`,
    blob,
    `\r\n--${boundary}--`,
  ], {type: `multipart/related; boundary=${boundary}`})

  try {
    const response = await fetchWithDriveAuth(
      `${DRIVE_UPLOAD_ROOT}/files?uploadType=multipart&fields=id,size`,
      {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body,
      },
      options,
    )
    if (!response.ok) return toErr(mapHttpError(response, `Google Drive file "${name}" could not be created.`))
    const payload = await response.json()
    return toOk({
      provider_id: PROVIDER_ID,
      bytes_uploaded: Number(payload?.size) || blob.size,
    })
  } catch (error) {
    return toErr(error as RemoteProviderError)
  }
}

async function updateExistingFile(
  fileId: string,
  blob: Blob,
  options: RemoteProviderRequestOptions & {interactive?: boolean} = {},
): Promise<RemoteProviderResult<RemoteProviderUploadReceipt>> {
  try {
    const response = await fetchWithDriveAuth(
      `${DRIVE_UPLOAD_ROOT}/files/${encodeURIComponent(fileId)}?uploadType=media&fields=id,size`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': blob.type || 'application/octet-stream',
        },
        body: blob,
      },
      options,
    )
    if (!response.ok) return toErr(mapHttpError(response, 'Google Drive file could not be updated.'))
    const payload = await response.json()
    return toOk({
      provider_id: PROVIDER_ID,
      bytes_uploaded: Number(payload?.size) || blob.size,
    })
  } catch (error) {
    return toErr(error as RemoteProviderError)
  }
}

async function uploadNamedBlob(
  name: string,
  blob: Blob,
  options: RemoteProviderRequestOptions & {interactive?: boolean} = {},
): Promise<RemoteProviderResult<RemoteProviderUploadReceipt>> {
  const existing = await findFirstFileByName(name, options)
  if (!existing.ok) return existing
  if (!existing.value) return createMultipartFile(name, blob, options)
  return updateExistingFile(existing.value.id, blob, options)
}

function parseMetadata(raw: unknown): RemoteExportMetadata | null {
  if (!raw || typeof raw !== 'object') return null
  const meta = raw as Record<string, unknown>
  if (typeof meta.exported_at !== 'string' || typeof meta.workspace_checksum !== 'string') return null
  return {
    manifest_version: Number(meta.manifest_version) || 2,
    app_version: typeof meta.app_version === 'string' ? meta.app_version : null,
    exported_at: meta.exported_at,
    workspace_checksum: meta.workspace_checksum,
    payload_mode: meta.payload_mode === 'split' ? 'split' : 'single',
    assets_count: typeof meta.assets_count === 'number' ? meta.assets_count : 0,
    source_device_label: typeof meta.source_device_label === 'string' ? meta.source_device_label : null,
    provider_endpoint_hash: typeof meta.provider_endpoint_hash === 'string' ? meta.provider_endpoint_hash : null,
  }
}

function makeArchiveDataFilename(workspaceChecksum: string): string {
  return `${ARCHIVE_DATA_PREFIX}${workspaceChecksum}${ARCHIVE_DATA_SUFFIX}`
}

function makeArchiveAssetsFilename(workspaceChecksum: string): string {
  return `${ARCHIVE_ASSETS_PREFIX}${workspaceChecksum}${ARCHIVE_ASSETS_SUFFIX}`
}

function normalizeArchiveEntry(raw: unknown): RemoteArchiveEntry | null {
  if (!raw || typeof raw !== 'object') return null
  const entry = raw as Record<string, unknown>
  if (typeof entry.workspace_checksum !== 'string') return null
  return {
    workspace_checksum: entry.workspace_checksum,
    exported_at: typeof entry.exported_at === 'string' ? entry.exported_at : null,
    source_device_label: typeof entry.source_device_label === 'string' ? entry.source_device_label : null,
    payload_mode: entry.payload_mode === 'single' ? 'single' : 'split',
    assets_count: typeof entry.assets_count === 'number' ? entry.assets_count : null,
  }
}

async function readArchiveIndex(options: RemoteProviderRequestOptions & {interactive?: boolean} = {}): Promise<RemoteProviderResult<RemoteArchiveEntry[]>> {
  const file = await findFirstFileByName(ARCHIVE_INDEX_FILENAME, options)
  if (!file.ok) return file as RemoteProviderResult<RemoteArchiveEntry[]>
  if (!file.value) return toOk([])
  const blob = await downloadFileBlob(file.value.id, options)
  if (!blob.ok) return blob as RemoteProviderResult<RemoteArchiveEntry[]>
  try {
    const payload = JSON.parse(await blob.value.text()) as ArchiveIndexPayload
    const archives = Array.isArray(payload?.archives) ? payload.archives.map(normalizeArchiveEntry).filter(Boolean) as RemoteArchiveEntry[] : []
    return toOk(archives)
  } catch (error) {
    return toErr(makeError('corrupt_remote_state', 'Remote archive index is corrupt or unreadable.', false, {cause: error}))
  }
}

async function writeArchiveIndex(entries: RemoteArchiveEntry[], options: RemoteProviderRequestOptions & {interactive?: boolean} = {}): Promise<RemoteProviderResult<RemoteProviderUploadReceipt>> {
  const payload = new Blob([JSON.stringify({archives: entries}, null, 2)], {type: 'application/json'})
  return uploadNamedBlob(ARCHIVE_INDEX_FILENAME, payload, options)
}

function mergeArchiveEntries(entries: RemoteArchiveEntry[], nextEntry: RemoteArchiveEntry): RemoteArchiveEntry[] {
  const filtered = entries.filter((entry) => entry.workspace_checksum !== nextEntry.workspace_checksum)
  return [nextEntry, ...filtered].sort((a, b) => Date.parse(b.exported_at ?? '') - Date.parse(a.exported_at ?? ''))
}

export function createGoogleDriveProvider(settings: RemoteLocalSettings): RemoteExportProvider {
  return {
    type: 'gdrive',
    settings,
    supportsEncryption: false,
    capabilities: {
      provider_specific: ['oauth', 'appdata'],
    },
    isConfigured: () => settings.remote_provider_type === 'gdrive',
    async testConnection(options = {}) {
      try {
        await getAuthToken(true)
        const profile = await getProfileUserInfo()
        const files = await listFilesByName(META_FILENAME, {...options, interactive: false})
        if (!files.ok && files.error.code !== 'file_missing') return files as RemoteProviderResult<RemoteProviderConnectionStatus>
        return toOk({
          provider_id: PROVIDER_ID,
          account_email: profile.email || null,
        })
      } catch (error) {
        return toErr(error as RemoteProviderError)
      }
    },
    async disconnect() {
      try {
        const token = await getAuthToken(false).catch(() => null)
        if (token) {
          await revokeGoogleToken(token)
          await removeCachedToken(token)
        }
        return toOk(true)
      } catch (error) {
        return toErr(makeError('network_error', 'Google Drive disconnect failed.', false, {cause: error}))
      }
    },
    async downloadMeta(options = {}) {
      const file = await findFirstFileByName(META_FILENAME, options)
      if (!file.ok) return toErr(file.error)
      if (!file.value) {
        return toErr(makeError('file_missing', 'Remote metadata file is missing.', false))
      }
      const blob = await downloadFileBlob(file.value.id, options)
      if (!blob.ok) return blob as RemoteProviderResult<RemoteExportMetadata>
      try {
        const parsed = parseMetadata(JSON.parse(await blob.value.text()))
        if (!parsed) {
          return toErr(makeError('corrupt_remote_state', 'Remote metadata sidecar is corrupt or unreadable.', false))
        }
        return toOk(parsed)
      } catch (error) {
        return toErr(makeError('corrupt_remote_state', 'Remote metadata sidecar is corrupt or unreadable.', false, {cause: error}))
      }
    },
    async downloadExport(options = {}) {
      const dataFile = await findFirstFileByName(DATA_FILENAME, options)
      if (!dataFile.ok) return dataFile as RemoteProviderResult<Blob>
      if (dataFile.value) {
        return downloadFileBlob(dataFile.value.id, options)
      }

      const legacyFile = await findFirstFileByName(LEGACY_EXPORT_FILENAME, options)
      if (!legacyFile.ok) return legacyFile as RemoteProviderResult<Blob>
      if (!legacyFile.value) {
        return toErr(makeError('file_missing', 'Remote export file is missing.', false))
      }
      return downloadFileBlob(legacyFile.value.id, options)
    },
    async downloadAssets(options = {}) {
      const file = await findFirstFileByName(ASSETS_FILENAME, options)
      if (!file.ok) return file as RemoteProviderResult<Blob>
      if (!file.value) {
        return toErr(makeError('file_missing', 'Remote assets file is missing.', false))
      }
      return downloadFileBlob(file.value.id, options)
    },
    async downloadArchiveExport(workspaceChecksum, options = {}) {
      const [dataResult, assetsResult] = await Promise.all([
        downloadNamedBlob(makeArchiveDataFilename(workspaceChecksum), options),
        downloadNamedBlob(makeArchiveAssetsFilename(workspaceChecksum), options),
      ])
      if (!dataResult.ok) return dataResult
      if (!assetsResult.ok) return assetsResult
      try {
        const manifest = JSON.parse(await dataResult.value.text())
        const assetsPayload = JSON.parse(await assetsResult.value.text())
        const merged = {
          ...manifest,
          assets: Array.isArray(assetsPayload?.assets) ? assetsPayload.assets : [],
        }
        return toOk(new Blob([JSON.stringify(merged)], {type: 'application/json'}))
      } catch (error) {
        return toErr(makeError('corrupt_remote_state', 'Remote archive export is corrupt or unreadable.', false, {cause: error}))
      }
    },
    async listArchives(options = {}) {
      const index = await readArchiveIndex(options)
      if (!index.ok) return index
      return toOk(index.value)
    },
    async deleteArchive(workspaceChecksum, options = {}) {
      const [dataFile, assetsFile, existingIndex] = await Promise.all([
        findFirstFileByName(makeArchiveDataFilename(workspaceChecksum), options),
        findFirstFileByName(makeArchiveAssetsFilename(workspaceChecksum), options),
        readArchiveIndex(options),
      ])
      if (!dataFile.ok) return dataFile as RemoteProviderResult<true>
      if (!assetsFile.ok) return assetsFile as RemoteProviderResult<true>
      if (!existingIndex.ok && existingIndex.error.code !== 'file_missing') return existingIndex as RemoteProviderResult<true>

      if (dataFile.value) {
        const deleted = await deleteFileById(dataFile.value.id, options)
        if (!deleted.ok) return deleted
      }
      if (assetsFile.value) {
        const deleted = await deleteFileById(assetsFile.value.id, options)
        if (!deleted.ok) return deleted
      }

      const nextIndex = (existingIndex.ok ? existingIndex.value : []).filter((entry) => entry.workspace_checksum !== workspaceChecksum)
      const indexWrite = await writeArchiveIndex(nextIndex, options)
      if (!indexWrite.ok) return indexWrite as RemoteProviderResult<true>
      return toOk(true)
    },
    async deleteLiveExport(options = {}) {
      return deleteNamedFiles([
        DATA_FILENAME,
        ASSETS_FILENAME,
        META_FILENAME,
        LEGACY_EXPORT_FILENAME,
      ], options)
    },
    async wipeRemoteData(options = {}) {
      const liveDelete = await deleteNamedFiles([
        DATA_FILENAME,
        ASSETS_FILENAME,
        META_FILENAME,
        LEGACY_EXPORT_FILENAME,
        ARCHIVE_INDEX_FILENAME,
      ], options)
      if (!liveDelete.ok) return liveDelete

      return deleteFilesMatchingQuery(
        `name contains '${escapeDriveQueryValue(ARCHIVE_DATA_PREFIX)}' and trashed=false`,
        options,
      )
    },
    async uploadExport(exportBlob, options = {}) {
      return uploadNamedBlob(DATA_FILENAME, exportBlob, options)
    },
    async uploadAssets(assetsBlob, options = {}) {
      return uploadNamedBlob(ASSETS_FILENAME, assetsBlob, options)
    },
    async archiveExists(workspaceChecksum, options = {}) {
      const [dataFile, assetsFile] = await Promise.all([
        findFirstFileByName(makeArchiveDataFilename(workspaceChecksum), options),
        findFirstFileByName(makeArchiveAssetsFilename(workspaceChecksum), options),
      ])
      if (!dataFile.ok) return dataFile as RemoteProviderResult<boolean>
      if (!assetsFile.ok) return assetsFile as RemoteProviderResult<boolean>
      return toOk(!!dataFile.value && !!assetsFile.value)
    },
    async uploadArchive(workspaceChecksum, exportBlob, assetsBlob, options = {}) {
      const [dataResult, assetsResult] = await Promise.all([
        uploadNamedBlob(makeArchiveDataFilename(workspaceChecksum), exportBlob, options),
        uploadNamedBlob(makeArchiveAssetsFilename(workspaceChecksum), assetsBlob, options),
      ])
      if (!dataResult.ok) return dataResult
      if (!assetsResult.ok) return assetsResult
      const existingIndex = await readArchiveIndex(options)
      if (!existingIndex.ok && existingIndex.error.code !== 'file_missing') return existingIndex as RemoteProviderResult<RemoteProviderUploadReceipt>
      const nextEntry: RemoteArchiveEntry = {
        workspace_checksum: workspaceChecksum,
        exported_at: new Date().toISOString(),
        source_device_label: settings.device_label,
        payload_mode: 'split',
        assets_count: null,
      }
      const indexWrite = await writeArchiveIndex(
        mergeArchiveEntries(existingIndex.ok ? existingIndex.value : [], nextEntry),
        options,
      )
      if (!indexWrite.ok) return indexWrite
      return toOk({
        provider_id: dataResult.value.provider_id,
        bytes_uploaded: dataResult.value.bytes_uploaded + assetsResult.value.bytes_uploaded + indexWrite.value.bytes_uploaded,
      })
    },
    async uploadMeta(meta, options = {}) {
      const blob = new Blob([JSON.stringify(meta, null, 2)], {type: 'application/json'})
      return uploadNamedBlob(META_FILENAME, blob, options)
    },
    async verify(options = {}) {
      try {
        const [dataFile, assetsFile, legacyFile, metaFile] = await Promise.all([
          findFirstFileByName(DATA_FILENAME, options),
          findFirstFileByName(ASSETS_FILENAME, options),
          findFirstFileByName(LEGACY_EXPORT_FILENAME, options),
          findFirstFileByName(META_FILENAME, options),
        ])
        if (!dataFile.ok && dataFile.error.code !== 'file_missing') {
          return toErr(dataFile.error)
        }
        if (!assetsFile.ok && assetsFile.error.code !== 'file_missing') {
          return toErr(assetsFile.error)
        }
        if (!metaFile.ok && metaFile.error.code !== 'file_missing') {
          return toErr(metaFile.error)
        }
        if (!legacyFile.ok && legacyFile.error.code !== 'file_missing') {
          return toErr(legacyFile.error)
        }

        let meta: RemoteExportMetadata | null = null
        if (metaFile.ok && metaFile.value) {
          const downloaded = await downloadFileBlob(metaFile.value.id, options)
          if (!downloaded.ok) return toErr(downloaded.error)
          try {
            meta = parseMetadata(JSON.parse(await downloaded.value.text()))
            if (!meta) {
              return toErr(makeError('corrupt_remote_state', 'Remote metadata sidecar is corrupt or unreadable.', false))
            }
          } catch (error) {
            return toErr(makeError('corrupt_remote_state', 'Remote metadata sidecar is corrupt or unreadable.', false, {cause: error}))
          }
        }

        const hasSplitData = !!(dataFile.ok && dataFile.value)
        const hasSplitAssets = !!(assetsFile.ok && assetsFile.value)
        const hasLegacyExport = !!(legacyFile.ok && legacyFile.value)
        const payloadMode = hasSplitData ? 'split' : hasLegacyExport ? 'single' : 'missing'
        const exportExists = hasSplitData || hasLegacyExport
        const assetsExists = hasSplitData ? hasSplitAssets : hasLegacyExport
        const warnings: string[] = []

        if (hasSplitData && !hasSplitAssets) {
          warnings.push('Split remote export is missing the assets payload.')
        }
        if (!hasSplitData && hasSplitAssets) {
          warnings.push('Remote assets payload exists without the data export.')
        }
        if (exportExists && (!metaFile.ok || !metaFile.value)) {
          warnings.push('Export file exists without metadata sidecar.')
        }
        if (metaFile.ok && metaFile.value && !exportExists) {
          warnings.push('Metadata sidecar exists without export file.')
        }
        if (meta?.provider_endpoint_hash && meta.provider_endpoint_hash !== PROVIDER_ID) {
          warnings.push('Remote metadata was written for a different endpoint context.')
        }

        return toOk({
          provider_id: PROVIDER_ID,
          meta,
          export_exists: exportExists,
          assets_exists: assetsExists,
          meta_exists: !!(metaFile.ok && metaFile.value),
          payload_mode: payloadMode,
          export_size_bytes: hasSplitData
            ? Number(dataFile.value?.size) || null
            : hasLegacyExport
              ? Number(legacyFile.value?.size) || null
              : null,
          assets_size_bytes: hasSplitAssets ? Number(assetsFile.value?.size) || null : null,
          warnings,
        })
      } catch (error) {
        return toErr(error as RemoteProviderError)
      }
    },
  }
}
