import {
  DEFAULT_REMOTE_LOCAL_SETTINGS,
  REMOTE_LOCAL_SETTING_KEYS,
  REMOTE_PROVIDER_SETTING_KEYS,
  type RemoteLocalSettingKey,
  type RemoteLocalSettings,
  type RemoteProviderType,
} from '@/types/remote'

type StorageAreaLike = Pick<chrome.storage.StorageArea, 'get' | 'set' | 'remove'>

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

function storageSet(area: StorageAreaLike, values: Partial<Record<RemoteLocalSettingKey, string | null>>): Promise<void> {
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
  return value === 'webdav' ? value : null
}

function normalizeStoredValue(key: RemoteLocalSettingKey, value: unknown): string | null {
  if (key === 'remote_provider_type') {
    return normalizeProviderType(value)
  }
  return typeof value === 'string' ? value : null
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
    if (key === 'remote_provider_type') {
      settings.remote_provider_type = normalizeProviderType(stored[key])
      continue
    }
    settings[key] = normalizeStoredValue(key, stored[key])
  }

  return settings
}

export async function updateLocalSettings(
  patch: Partial<RemoteLocalSettings>,
  area: StorageAreaLike = getStorageArea(),
): Promise<RemoteLocalSettings> {
  const normalizedPatch: Partial<Record<RemoteLocalSettingKey, string | null>> = {}

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
