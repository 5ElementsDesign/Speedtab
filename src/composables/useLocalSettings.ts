import {
  DEFAULT_REMOTE_LOCAL_SETTINGS,
  REMOTE_LOCAL_SETTING_KEYS,
  REMOTE_PROVIDER_SETTING_KEYS,
  type RemoteLocalSettingKey,
  type RemoteLocalSettings,
  type RemoteProviderType,
} from '@/types/remote'

type StorageAreaLike = Pick<chrome.storage.StorageArea, 'get' | 'set' | 'remove'>
type StoredRemoteLocalValue = string | number | boolean | null

function getStorageArea(): StorageAreaLike {
  const storageArea = globalThis.chrome?.storage?.local
  if (!storageArea) {
    throw new Error('chrome.storage.local is unavailable')
  }
  return storageArea
}

function getChromeRuntimeError(): Error | null {
  const message = globalThis.chrome?.runtime?.lastError?.message
  return message ? new Error(message) : null
}

function storageGet(area: StorageAreaLike, keys: readonly string[]): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    area.get([...keys], (items) => {
      const error = getChromeRuntimeError()
      if (error) {
        reject(error)
        return
      }
      resolve(items as Record<string, unknown>)
    })
  })
}

function storageSet(area: StorageAreaLike, values: Partial<Record<RemoteLocalSettingKey, StoredRemoteLocalValue>>): Promise<void> {
  return new Promise((resolve, reject) => {
    area.set(values, () => {
      const error = getChromeRuntimeError()
      if (error) {
        reject(error)
        return
      }
      resolve()
    })
  })
}

function storageRemove(area: StorageAreaLike, keys: readonly string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    area.remove([...keys], () => {
      const error = getChromeRuntimeError()
      if (error) {
        reject(error)
        return
      }
      resolve()
    })
  })
}

function normalizeProviderType(value: unknown): RemoteProviderType | null {
  return value === 'webdav' || value === 'gdrive' ? value : null
}

function normalizeBoolean(value: unknown): boolean {
  return value === true
}

function normalizeIntervalMinutes(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  const normalized = Math.trunc(value)
  if (normalized < 1) return null
  return normalized
}

function normalizePositiveCount(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  const normalized = Math.trunc(value)
  if (normalized < 1) return null
  return normalized
}

function normalizeTimestamp(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  const normalized = Math.trunc(value)
  return normalized > 0 ? normalized : null
}

function normalizeOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function normalizeStoredValue(key: RemoteLocalSettingKey, value: unknown): StoredRemoteLocalValue {
  if (key === 'remote_provider_type') {
    return normalizeProviderType(value)
  }
  if (key === 'remote_auto_sync_enabled') {
    return normalizeBoolean(value)
  }
  if (key === 'remote_auto_sync_interval_minutes') {
    return normalizeIntervalMinutes(value)
  }
  if (key === 'remote_archive_keep_latest_count') {
    return normalizePositiveCount(value)
  }
  if (key === 'remote_auto_sync_last_check_at' || key === 'remote_auto_sync_last_push_at') {
    return normalizeTimestamp(value)
  }
  if (
    key === 'remote_auto_sync_last_check_checksum' ||
    key === 'remote_auto_sync_last_check_result' ||
    key === 'remote_auto_sync_last_push_result'
  ) {
    return normalizeOptionalString(value)
  }
  return typeof value === 'string' ? value : null
}

function applyNormalizedSetting(settings: RemoteLocalSettings, key: RemoteLocalSettingKey, value: unknown) {
  switch (key) {
    case 'remote_provider_type':
      settings.remote_provider_type = normalizeProviderType(value)
      return
    case 'remote_auto_sync_enabled':
      settings.remote_auto_sync_enabled = normalizeBoolean(value)
      return
    case 'remote_auto_sync_interval_minutes':
      settings.remote_auto_sync_interval_minutes = normalizeIntervalMinutes(value)
      return
    case 'remote_archive_keep_latest_count':
      settings.remote_archive_keep_latest_count = normalizePositiveCount(value)
      return
    case 'remote_auto_sync_last_check_at':
      settings.remote_auto_sync_last_check_at = normalizeTimestamp(value)
      return
    case 'remote_auto_sync_last_push_at':
      settings.remote_auto_sync_last_push_at = normalizeTimestamp(value)
      return
    case 'remote_auto_sync_last_check_checksum':
      settings.remote_auto_sync_last_check_checksum = normalizeOptionalString(value)
      return
    case 'remote_auto_sync_last_check_result':
      settings.remote_auto_sync_last_check_result = normalizeOptionalString(value)
      return
    case 'remote_auto_sync_last_push_result':
      settings.remote_auto_sync_last_push_result = normalizeOptionalString(value)
      return
    default:
      settings[key] = normalizeStoredValue(key, value) as never
  }
}

export function isLocalOnlyRemoteSettingKey(key: string): key is RemoteLocalSettingKey {
  return (REMOTE_LOCAL_SETTING_KEYS as readonly string[]).includes(key)
}

export function isExcludedFromPortableWorkspaceExport(key: string): boolean {
  return isLocalOnlyRemoteSettingKey(key)
}

export async function getLocalSettings(area: StorageAreaLike = getStorageArea()): Promise<RemoteLocalSettings> {
  const stored = await storageGet(area, REMOTE_LOCAL_SETTING_KEYS)
  const settings = { ...DEFAULT_REMOTE_LOCAL_SETTINGS }

  for (const key of REMOTE_LOCAL_SETTING_KEYS) {
    applyNormalizedSetting(settings, key, stored[key])
  }

  return settings
}

export async function updateLocalSettings(
  patch: Partial<RemoteLocalSettings>,
  area: StorageAreaLike = getStorageArea(),
): Promise<RemoteLocalSettings> {
  const normalizedPatch: Partial<Record<RemoteLocalSettingKey, StoredRemoteLocalValue>> = {}

  for (const [key, value] of Object.entries(patch)) {
    if (!isLocalOnlyRemoteSettingKey(key)) continue
    normalizedPatch[key] = normalizeStoredValue(key, value)
  }

  if (Object.keys(normalizedPatch).length > 0) {
    await storageSet(area, normalizedPatch)
  }

  return getLocalSettings(area)
}

export async function clearRemoteProviderSettings(area: StorageAreaLike = getStorageArea()): Promise<RemoteLocalSettings> {
  await storageRemove(area, REMOTE_PROVIDER_SETTING_KEYS)
  return getLocalSettings(area)
}
