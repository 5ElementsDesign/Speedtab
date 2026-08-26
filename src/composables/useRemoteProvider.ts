import { getLocalSettings } from '@/composables/useLocalSettings'
import type {
  RemoteArchiveEntry,
  RemoteExportMetadata,
  RemoteLocalSettings,
  RemoteProviderConnectionStatus,
  RemoteProviderError,
  RemoteProviderResult,
  RemoteProviderRuntimeType,
  RemoteProviderType,
  RemoteProviderUploadReceipt,
  RemoteProviderVerifyResult,
} from '@/types/remote'

export interface RemoteProviderRequestOptions {
  signal?: AbortSignal
  timeoutMs?: number
}

export interface RemoteExportProvider {
  readonly type: RemoteProviderRuntimeType
  readonly settings: RemoteLocalSettings
  readonly supportsEncryption: boolean
  readonly capabilities: {
    provider_specific: string[]
  }
  isConfigured(): boolean
  testConnection(options?: RemoteProviderRequestOptions): Promise<RemoteProviderResult<RemoteProviderConnectionStatus>>
  downloadMeta(options?: RemoteProviderRequestOptions): Promise<RemoteProviderResult<RemoteExportMetadata>>
  downloadExport(options?: RemoteProviderRequestOptions): Promise<RemoteProviderResult<Blob>>
  downloadAssets(options?: RemoteProviderRequestOptions): Promise<RemoteProviderResult<Blob>>
  downloadArchiveExport(workspaceChecksum: string, options?: RemoteProviderRequestOptions): Promise<RemoteProviderResult<Blob>>
  listArchives(options?: RemoteProviderRequestOptions): Promise<RemoteProviderResult<RemoteArchiveEntry[]>>
  deleteArchive(workspaceChecksum: string, options?: RemoteProviderRequestOptions): Promise<RemoteProviderResult<true>>
  deleteLiveExport?(options?: RemoteProviderRequestOptions): Promise<RemoteProviderResult<true>>
  wipeRemoteData?(options?: RemoteProviderRequestOptions): Promise<RemoteProviderResult<true>>
  uploadExport(exportBlob: Blob, options?: RemoteProviderRequestOptions): Promise<RemoteProviderResult<RemoteProviderUploadReceipt>>
  uploadAssets(assetsBlob: Blob, options?: RemoteProviderRequestOptions): Promise<RemoteProviderResult<RemoteProviderUploadReceipt>>
  archiveExists(workspaceChecksum: string, options?: RemoteProviderRequestOptions): Promise<RemoteProviderResult<boolean>>
  uploadArchive(workspaceChecksum: string, exportBlob: Blob, assetsBlob: Blob, options?: RemoteProviderRequestOptions): Promise<RemoteProviderResult<RemoteProviderUploadReceipt>>
  uploadMeta(meta: RemoteExportMetadata, options?: RemoteProviderRequestOptions): Promise<RemoteProviderResult<RemoteProviderUploadReceipt>>
  verify(options?: RemoteProviderRequestOptions): Promise<RemoteProviderResult<RemoteProviderVerifyResult>>
  disconnect?(options?: RemoteProviderRequestOptions): Promise<RemoteProviderResult<true>>
}

export type RemoteProviderFactory = (settings: RemoteLocalSettings) => RemoteExportProvider | Promise<RemoteExportProvider>

const remoteProviderFactories = new Map<RemoteProviderType, RemoteProviderFactory>()

function makeProviderError(
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

function makeFailureProvider(
  type: RemoteProviderRuntimeType,
  settings: RemoteLocalSettings,
  error: RemoteProviderError,
): RemoteExportProvider {
  const fail = async <T>(): Promise<RemoteProviderResult<T>> => ({ ok: false, error })

  return {
    type,
    settings,
    supportsEncryption: false,
    capabilities: {
      provider_specific: [],
    },
    isConfigured: () => type !== 'none',
    testConnection: () => fail<RemoteProviderConnectionStatus>(),
    downloadMeta: () => fail<RemoteExportMetadata>(),
    downloadExport: () => fail<Blob>(),
    downloadAssets: () => fail<Blob>(),
    downloadArchiveExport: () => fail<Blob>(),
    listArchives: () => fail<RemoteArchiveEntry[]>(),
    deleteArchive: () => fail<true>(),
    deleteLiveExport: () => fail<true>(),
    wipeRemoteData: () => fail<true>(),
    uploadExport: () => fail<RemoteProviderUploadReceipt>(),
    uploadAssets: () => fail<RemoteProviderUploadReceipt>(),
    archiveExists: () => fail<boolean>(),
    uploadArchive: () => fail<RemoteProviderUploadReceipt>(),
    uploadMeta: () => fail<RemoteProviderUploadReceipt>(),
    verify: () => fail<RemoteProviderVerifyResult>(),
    disconnect: () => fail<true>(),
  }
}

function hasValue(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

export function isRemoteProviderConfigured(settings: RemoteLocalSettings): boolean {
  if (settings.remote_provider_type == null) return false

  switch (settings.remote_provider_type) {
    case 'webdav':
      return [
        settings.remote_endpoint_url,
        settings.remote_username,
        settings.remote_secret,
        settings.remote_path,
      ].every(hasValue)
    case 'gdrive':
      return true
  }
}

export function registerRemoteProviderFactory(type: RemoteProviderType, factory: RemoteProviderFactory): void {
  remoteProviderFactories.set(type, factory)
}

export function unregisterRemoteProviderFactory(type: RemoteProviderType): void {
  remoteProviderFactories.delete(type)
}

async function loadBuiltInRemoteProviderFactory(type: RemoteProviderType): Promise<RemoteProviderFactory | null> {
  if (type === 'gdrive') {
    const {createGoogleDriveProvider} = await import('@/composables/useGoogleDriveProvider')
    return createGoogleDriveProvider
  }
  if (type === 'webdav') {
    const {createWebDavProvider} = await import('@/composables/useWebDavProvider')
    return createWebDavProvider
  }
  return null
}

export async function createRemoteExportProvider(settings: RemoteLocalSettings): Promise<RemoteExportProvider> {
  if (!isRemoteProviderConfigured(settings)) {
    return makeFailureProvider(
      'none',
      settings,
      makeProviderError(
        'not_configured',
        'Remote provider settings are incomplete.',
        false,
      ),
    )
  }

  const type = settings.remote_provider_type!
  const factory = remoteProviderFactories.get(type) ?? await loadBuiltInRemoteProviderFactory(type)
  if (factory) {
    return await factory(settings)
  }

  return makeFailureProvider(
    type,
    settings,
    makeProviderError(
      'unsupported_provider',
      `No provider implementation is registered for ${type}.`,
      false,
    ),
  )
}

export async function getRemoteExportProvider(): Promise<RemoteExportProvider> {
  const settings = await getLocalSettings()
  return await createRemoteExportProvider(settings)
}
