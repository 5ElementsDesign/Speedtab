import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db as testDb } from '../../db/db'

vi.mock('../../db/db', async (importOriginal) => {
  const actual = (await importOriginal()) as any
  const { IDBFactory, IDBKeyRange } = await import('fake-indexeddb')
  const testDb = new actual.SpeedtabDB({ indexedDB: new IDBFactory(), IDBKeyRange })
  return {
    ...actual,
    db: testDb,
    isActiveRecord: (r: any) => r?.deleted_at == null,
    makeCreateMetadata: (now = Date.now()) => ({ sync_id: crypto.randomUUID(), created_at: now, updated_at: now, deleted_at: null }),
    makeUpdatedAtPatch: (now = Date.now()) => ({ updated_at: now }),
  }
})

import {
    APP_SETTING_DEFAULTS,
    archiveBgItem,
    deleteBgArchiveItem,
    getCachedAppSettings,
    loadAppSettings,
    loadBgArchive,
    loadPageBackgroundOverride,
    saveAppSetting,
    savePageBackgroundOverride,
} from '../data/app-settings.js'
import {getPageBackgroundSet} from '../utils/workspace-background.js'

beforeEach(async () => { await testDb.open() })
afterEach(async () => {
  await testDb.app_settings.clear()
  await testDb.bg_archive.clear()
  await testDb.close()
})

describe('loadAppSettings', () => {
  it('returns all defaults when no rows exist in the DB', async () => {
    const settings = await loadAppSettings()
    expect(settings.bookmarks_open_in_new_tab).toBe(true)
    expect(settings.feed_search_url_template).toBe('https://www.google.com/search?q=%s')
    expect(settings.html_cache).toBe(true)
    expect(settings.background_properties).toBeNull()
  })

  it('merges stored value with defaults', async () => {
    await testDb.app_settings.put({
      key: 'bookmarks_open_in_new_tab',
      value_json: 'false',
      updated_at: Date.now(),
    })
    const settings = await loadAppSettings()
    expect(settings.bookmarks_open_in_new_tab).toBe(false)
    // Other defaults remain
    expect(settings.html_cache).toBe(true)
  })

  it('uses default for rows with malformed JSON', async () => {
    await testDb.app_settings.put({
      key: 'feed_content_scale',
      value_json: '{bad json',
      updated_at: Date.now(),
    })
    const settings = await loadAppSettings()
    expect(settings.feed_content_scale).toBe(APP_SETTING_DEFAULTS.feed_content_scale)
  })
})

describe('saveAppSetting', () => {
  it('stores a new setting', async () => {
    await saveAppSetting('ui_language', 'de')
    const row = await testDb.app_settings.get('ui_language')
    expect(JSON.parse(row!.value_json!)).toBe('de')
  })

  it('overwrites an existing setting', async () => {
    await saveAppSetting('ui_language', 'en')
    await saveAppSetting('ui_language', 'de')
    const row = await testDb.app_settings.get('ui_language')
    expect(JSON.parse(row!.value_json!)).toBe('de')
  })

  it('can store null', async () => {
    await saveAppSetting('background_properties', null)
    const row = await testDb.app_settings.get('background_properties')
    expect(JSON.parse(row!.value_json!)).toBeNull()
  })

  it('can store booleans', async () => {
    await saveAppSetting('bookmarks_open_in_new_tab', false)
    const row = await testDb.app_settings.get('bookmarks_open_in_new_tab')
    expect(JSON.parse(row!.value_json!)).toBe(false)
  })
})

describe('page background overrides', () => {
  it('stores CSS and asset overrides under the stable page sync id', async () => {
    await savePageBackgroundOverride('page-sync-1', {
      background_properties: 'linear-gradient(red, blue)',
      background_asset_id: null,
    })
    expect(await loadPageBackgroundOverride('page-sync-1')).toEqual({
      background_properties: 'linear-gradient(red, blue)',
      background_asset_id: null,
    })

    await savePageBackgroundOverride('page-sync-1', {
      background_properties: null,
      background_asset_id: 42,
    })
    expect(await loadPageBackgroundOverride('page-sync-1')).toEqual({
      background_properties: null,
      background_asset_id: 42,
    })
  })

  it('deletes an empty override so the page inherits App Shell', async () => {
    await savePageBackgroundOverride('page-sync-2', {background_properties: '#123456'})
    await savePageBackgroundOverride('page-sync-2', null)

    expect(await loadPageBackgroundOverride('page-sync-2')).toBeNull()
    expect(await testDb.app_settings.get('page_background:page-sync-2')).toBeUndefined()
  })

  it('falls back to the App Shell background when no page override exists', async () => {
    expect(await getPageBackgroundSet('page-without-override', {
      background_properties: '#112233',
      background_asset_id: null,
    })).toBe('#112233')

    await savePageBackgroundOverride('page-with-override', {
      background_properties: '#abcdef',
      background_asset_id: null,
    })
    expect(await getPageBackgroundSet('page-with-override', {
      background_properties: '#112233',
      background_asset_id: null,
    })).toBe('#abcdef')
  })
})

describe('getCachedAppSettings', () => {
  it('returns the result of the last loadAppSettings call', async () => {
    await testDb.app_settings.put({
      key: 'note_content_scale',
      value_json: '2',
      updated_at: Date.now(),
    })
    await loadAppSettings() // populates cache
    const cached = getCachedAppSettings()
    expect(cached.note_content_scale).toBe(2)
  })
})

describe('archiveBgItem', () => {
  it('creates a new bg archive item', async () => {
    const result = await archiveBgItem('linear-gradient(red, blue)')
    expect(result!.created).toBe(true)
    expect(result!.item.value).toBe('linear-gradient(red, blue)')
    expect(typeof result!.item.name).toBe('string')
  })

  it('deduplicates: returns existing item without creating a new one', async () => {
    await archiveBgItem('linear-gradient(red, blue)')
    const result = await archiveBgItem('linear-gradient(red, blue)')
    expect(result!.created).toBe(false)

    const items = await testDb.bg_archive.toArray()
    expect(items).toHaveLength(1)
  })

  it('returns undefined for empty value', async () => {
    expect(await archiveBgItem('')).toBeUndefined()
    expect(await archiveBgItem(null)).toBeUndefined()
  })
})

describe('loadBgArchive', () => {
  it('returns items ordered newest-first', async () => {
    await archiveBgItem('red')
    await archiveBgItem('blue')
    const items = await loadBgArchive()
    expect(items.length).toBe(2)
    // newest-first: "blue" was archived last
    expect(items[0].value).toBe('blue')
  })
})

describe('deleteBgArchiveItem', () => {
  it('removes the item by id', async () => {
    await archiveBgItem('green')
    const items = await testDb.bg_archive.toArray()
    const id = items[0].id
    await deleteBgArchiveItem(id)
    expect(await testDb.bg_archive.toArray()).toHaveLength(0)
  })
})
