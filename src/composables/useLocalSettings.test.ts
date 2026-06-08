import { exportAll, manifestToJsonString } from '@/composables/useBackup'
import { makeCreateMetadata, SpeedtabDB } from '@/db/db'
import {
  clearRemoteProviderSettings,
  getLocalSettings,
  isExcludedFromPortableWorkspaceExport,
  updateLocalSettings,
} from '@/composables/useLocalSettings'
import type { RemoteLocalSettingKey } from '@/types/remote'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type StoredValue = string | null

function withMeta<T extends object>(data: T) {
  return { ...makeCreateMetadata(1_700_000_000_000), ...data }
}

function makeDb() {
  return new SpeedtabDB({ indexedDB: new IDBFactory(), IDBKeyRange })
}

function installChromeStorageMock(seed: Partial<Record<RemoteLocalSettingKey, StoredValue>> = {}) {
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
        if (store.has(key)) {
          result[key] = store.get(key) ?? null
        }
      }
      callback(result)
    }),
    set: vi.fn((items: Record<string, StoredValue>, callback?: () => void) => {
      for (const [key, value] of Object.entries(items)) {
        store.set(key, value)
      }
      callback?.()
    }),
    remove: vi.fn((keys: string | string[], callback?: () => void) => {
      for (const key of Array.isArray(keys) ? keys : [keys]) {
        store.delete(key)
      }
      callback?.()
    }),
  }

  vi.stubGlobal('chrome', {
    runtime: {},
    storage: { local },
  })

  return { local, store }
}

describe('useLocalSettings', () => {
  let db: SpeedtabDB

  beforeEach(async () => {
    installChromeStorageMock()
    db = makeDb()
    await db.open()
  })

  afterEach(async () => {
    await db.delete()
    vi.unstubAllGlobals()
  })

  it('persists remote settings in chrome.storage.local', async () => {
    const { store } = installChromeStorageMock()

    const settings = await updateLocalSettings({
      remote_provider_type: 'webdav',
      remote_endpoint_url: 'https://dav.example.com/speedtab',
      remote_username: 'alice',
      remote_secret: 'secret-token',
      remote_path: '/speedtab',
      device_label: 'work-laptop',
      last_known_local_checksum: 'abc123',
    })

    expect(settings.remote_provider_type).toBe('webdav')
    expect(settings.remote_endpoint_url).toBe('https://dav.example.com/speedtab')
    expect(settings.device_label).toBe('work-laptop')
    expect(settings.last_known_local_checksum).toBe('abc123')
    expect(store.get('remote_secret')).toBe('secret-token')
    expect(store.get('remote_provider_type')).toBe('webdav')
  })

  it('keeps remote settings out of the portable workspace export path', async () => {
    await updateLocalSettings({
      remote_provider_type: 'webdav',
      remote_endpoint_url: 'https://dav.example.com/speedtab',
      remote_secret: 'secret-token',
    })

    await db.pages.add(withMeta({
      slug: 'home',
      title: 'Home',
      nav_group: 'main' as const,
      icon: null,
      is_home: 1 as const,
      sort_order: 0,
    }))

    const manifest = await exportAll(db)
    const json = manifestToJsonString(manifest)
    const appSettings = await db.app_settings.toArray()

    expect(json).not.toContain('dav.example.com')
    expect(json).not.toContain('secret-token')
    expect(appSettings.some(setting => isExcludedFromPortableWorkspaceExport(setting.key))).toBe(false)
  })

  it('clears provider settings without affecting workspace data', async () => {
    await updateLocalSettings({
      remote_provider_type: 'webdav',
      remote_endpoint_url: 'https://dav.example.com/speedtab',
      remote_username: 'alice',
      remote_secret: 'secret-token',
      remote_path: '/speedtab',
      device_label: 'desktop',
      last_remote_push_checksum: 'push-123',
    })

    await db.pages.add(withMeta({
      slug: 'home',
      title: 'Home',
      nav_group: 'main' as const,
      icon: null,
      is_home: 1 as const,
      sort_order: 0,
    }))

    const cleared = await clearRemoteProviderSettings()
    const pages = await db.pages.toArray()
    const settings = await getLocalSettings()

    expect(cleared.remote_provider_type).toBeNull()
    expect(cleared.remote_endpoint_url).toBeNull()
    expect(cleared.remote_secret).toBeNull()
    expect(cleared.device_label).toBe('desktop')
    expect(cleared.last_remote_push_checksum).toBe('push-123')
    expect(settings.remote_username).toBeNull()
    expect(pages).toHaveLength(1)
    expect(pages[0].slug).toBe('home')
  })
})
