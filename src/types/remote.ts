export type RemoteProviderType = 'webdav'
export type RemoteProviderRuntimeType = RemoteProviderType | 'none'

export interface RemoteExportMetadata {
  manifest_version: number
  app_version: string | null
  exported_at: string
  workspace_checksum: string
  source_device_label: string | null
  provider_endpoint_hash: string | null
}

export type RemoteProviderErrorCode =
  | 'not_configured'
  | 'unsupported_provider'
  | 'auth_failed'
  | 'file_missing'
  | 'timeout'
  | 'corrupt_remote_state'
  | 'unknown_endpoint_context'
  | 'network_error'

export interface RemoteProviderError {
  code: RemoteProviderErrorCode
  message: string
  retryable: boolean
  status?: number | null
  cause?: unknown
}

export type RemoteProviderResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: RemoteProviderError }

export interface RemoteProviderConnectionStatus {
  provider_id: string | null
}

export interface RemoteProviderUploadReceipt {
  provider_id: string | null
  bytes_uploaded: number
}

export interface RemoteProviderVerifyResult {
  provider_id: string | null
  meta: RemoteExportMetadata | null
  export_exists: boolean
  meta_exists: boolean
  export_size_bytes: number | null
  warnings: string[]
}

export interface RemoteProviderConfig {
  remote_provider_type: RemoteProviderType | null
  remote_endpoint_url: string | null
  remote_username: string | null
  remote_secret: string | null
  remote_path: string | null
}

export interface RemotePullBookkeeping {
  last_remote_pull_checksum: string | null
  last_remote_pull_exported_at: string | null
}

export interface RemotePushBookkeeping {
  last_remote_push_checksum: string | null
  last_remote_push_exported_at: string | null
}

export interface RemoteSeenMetadata {
  last_remote_provider_id: string | null
  last_remote_source_device: string | null
  last_remote_seen_checksum: string | null
  last_remote_seen_exported_at: string | null
}

export interface RemoteLocalSettings
  extends RemoteProviderConfig,
    RemotePullBookkeeping,
    RemotePushBookkeeping,
    RemoteSeenMetadata {
  device_label: string | null
  remote_dashboard_url: string | null
  last_known_local_checksum: string | null
}

export type RemoteLocalSettingKey = keyof RemoteLocalSettings

export const REMOTE_PROVIDER_SETTING_KEYS = [
  'remote_provider_type',
  'remote_endpoint_url',
  'remote_username',
  'remote_secret',
  'remote_path',
  'remote_dashboard_url',
] as const satisfies readonly RemoteLocalSettingKey[]

export const REMOTE_PULL_BOOKKEEPING_KEYS = [
  'last_remote_pull_checksum',
  'last_remote_pull_exported_at',
] as const satisfies readonly RemoteLocalSettingKey[]

export const REMOTE_PUSH_BOOKKEEPING_KEYS = [
  'last_remote_push_checksum',
  'last_remote_push_exported_at',
] as const satisfies readonly RemoteLocalSettingKey[]

export const REMOTE_SEEN_METADATA_KEYS = [
  'last_remote_provider_id',
  'last_remote_source_device',
  'last_remote_seen_checksum',
  'last_remote_seen_exported_at',
] as const satisfies readonly RemoteLocalSettingKey[]

export const REMOTE_LOCAL_SETTING_KEYS = [
  ...REMOTE_PROVIDER_SETTING_KEYS,
  'device_label',
  'remote_dashboard_url',
  ...REMOTE_PULL_BOOKKEEPING_KEYS,
  ...REMOTE_PUSH_BOOKKEEPING_KEYS,
  ...REMOTE_SEEN_METADATA_KEYS,
  'last_known_local_checksum',
] as const satisfies readonly RemoteLocalSettingKey[]

export const DEFAULT_REMOTE_LOCAL_SETTINGS: RemoteLocalSettings = {
  remote_provider_type: null,
  remote_endpoint_url: null,
  remote_username: null,
  remote_secret: null,
  remote_path: null,
  device_label: null,
  remote_dashboard_url: null,
  last_remote_pull_checksum: null,
  last_remote_pull_exported_at: null,
  last_remote_push_checksum: null,
  last_remote_push_exported_at: null,
  last_remote_provider_id: null,
  last_remote_source_device: null,
  last_remote_seen_checksum: null,
  last_remote_seen_exported_at: null,
  last_known_local_checksum: null,
}
