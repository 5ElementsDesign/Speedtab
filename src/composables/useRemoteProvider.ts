import { getLocalSettings } from '@/composables/useLocalSettings'
import { createWebDavProvider } from '@/composables/useWebDavProvider'
import type {
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
  uploadExport(exportBlob: Blob, options?: RemoteProviderRequestOptions): Promise<RemoteProviderResult<RemoteProviderUploadReceipt>>
  archiveExists(workspaceChecksum: string, options?: RemoteProviderRequestOptions): Promise<RemoteProviderResult<boolean>>
  uploadArchive(workspaceChecksum: string, exportBlob: Blob, options?: RemoteProviderRequestOptions): Promise<RemoteProviderResult<RemoteProviderUploadReceipt>>
  uploadMeta(meta: RemoteExportMetadata, options?: RemoteProviderRequestOptions): Promise<RemoteProviderResult<RemoteProviderUploadReceipt>>
  verify(options?: RemoteProviderRequestOptions): Promise<RemoteProviderResult<RemoteProviderVerifyResult>>
}

export type RemoteProviderFactory = (settings: RemoteLocalSettings) => RemoteExportProvider

const remoteProviderFactories = new Map<RemoteProviderType, RemoteProviderFactory>()
remoteProviderFactories.set('webdav', createWebDavProvider)

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
    uploadExport: () => fail<RemoteProviderUploadReceipt>(),
    archiveExists: () => fail<boolean>(),
    uploadArchive: () => fail<RemoteProviderUploadReceipt>(),
    uploadMeta: () => fail<RemoteProviderUploadReceipt>(),
    verify: () => fail<RemoteProviderVerifyResult>(),
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
  }
}

export function registerRemoteProviderFactory(type: RemoteProviderType, factory: RemoteProviderFactory): void {
  remoteProviderFactories.set(type, factory)
}

export function unregisterRemoteProviderFactory(type: RemoteProviderType): void {
  remoteProviderFactories.delete(type)
}

export function createRemoteExportProvider(settings: RemoteLocalSettings): RemoteExportProvider {
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

  const factory = remoteProviderFactories.get(settings.remote_provider_type!)
  if (factory) {
    return factory(settings)
  }

  return makeFailureProvider(
    settings.remote_provider_type!,
    settings,
    makeProviderError(
      'unsupported_provider',
      `No provider implementation is registered for ${settings.remote_provider_type}.`,
      false,
    ),
  )
}

export async function getRemoteExportProvider(): Promise<RemoteExportProvider> {
  const settings = await getLocalSettings()
  return createRemoteExportProvider(settings)
}
