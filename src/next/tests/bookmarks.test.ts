import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db as testDb } from '../../db/db'

vi.mock('../../db/db', async (importOriginal) => {
  const actual = (await importOriginal()) as any
  const { IDBFactory, IDBKeyRange } = await import('fake-indexeddb')
  const testDb = new actual.SpeedtabDB({ indexedDB: new IDBFactory(), IDBKeyRange })
  return {
    ...actual,
    db: testDb,
    isActiveRecord: (record: { deleted_at?: number | null } | null | undefined) =>
      record?.deleted_at == null,
    makeCreateMetadata: (now = Date.now()) => ({
      sync_id: crypto.randomUUID(),
      created_at: now,
      updated_at: now,
      deleted_at: null,
    }),
    makeUpdatedAtPatch: (now = Date.now()) => ({ updated_at: now }),
  }
})

import {
    createBookmark,
    loadBookmarkById,
    loadBookmarkBySyncId,
    loadBookmarksByTabId,
    saveBookmarkData,
    softDeleteBookmark,
} from '../data/bookmarks.js'

// Seed a collection (tab) to serve as parent for bookmarks
async function seedTab() {
  return testDb.collections.add({
    module_id: 1,
    title: 'Test Tab',
    sort_order: 0,
    config_json: null,
    sync_id: crypto.randomUUID(),
    created_at: Date.now(),
    updated_at: Date.now(),
    deleted_at: null,
  })
}

beforeEach(async () => { await testDb.open() })
afterEach(async () => {
  await testDb.tabs.clear()
  await testDb.collections.clear()
  await testDb.close()
})

describe('createBookmark', () => {
  it('creates a bookmark with title, url, and parent tab id', async () => {
    const tabId = await seedTab()
    const bm = await createBookmark(tabId, { title: 'GitHub', url: 'https://github.com' })
    expect(bm!.title).toBe('GitHub')
    expect(bm!.url).toBe('https://github.com')
    expect(bm!.collection_id).toBe(tabId)
    expect(bm!.sort_order).toBe(0)
    expect(typeof bm!.sync_id).toBe('string')
    expect(bm!.deleted_at).toBeNull()
  })

  it('stores optional description and null favicon/preview by default', async () => {
    const tabId = await seedTab()
    const bm = await createBookmark(tabId, { title: 'Site', url: 'https://example.com', description: 'A site' })
    expect(bm!.description).toBe('A site')
    expect(bm!.favicon_asset_id).toBeNull()
    expect(bm!.preview_asset_id).toBeNull()
  })

  it('assigns sequential sort_order for multiple bookmarks', async () => {
    const tabId = await seedTab()
    const b1 = await createBookmark(tabId, { title: 'B1', url: 'https://a.com' })
    const b2 = await createBookmark(tabId, { title: 'B2', url: 'https://b.com' })
    expect(b1!.sort_order).toBe(0)
    expect(b2!.sort_order).toBe(1)
  })

  it('returns null when tabId is falsy', async () => {
    expect(await createBookmark(0, { title: 'X', url: 'https://x.com' })).toBeNull()
  })
})

describe('loadBookmarksByTabId', () => {
  it('returns only active bookmarks ordered by sort_order', async () => {
    const tabId = await seedTab()
    const b1 = await createBookmark(tabId, { title: 'Keep', url: 'https://keep.com' })
    const b2 = await createBookmark(tabId, { title: 'Del', url: 'https://del.com' })
    await softDeleteBookmark(b2!.id)

    const bms = await loadBookmarksByTabId(tabId)
    expect(bms).toHaveLength(1)
    expect(bms[0].title).toBe('Keep')
  })

  it('returns empty array for falsy tabId', async () => {
    expect(await loadBookmarksByTabId(null)).toEqual([])
  })
})

describe('loadBookmarkById / loadBookmarkBySyncId', () => {
  it('loads bookmark by numeric id', async () => {
    const tabId = await seedTab()
    const bm = await createBookmark(tabId, { title: 'ById', url: 'https://byid.com' })
    expect((await loadBookmarkById(bm!.id))!.title).toBe('ById')
  })

  it('returns undefined for unknown id', async () => {
    expect(await loadBookmarkById(99999)).toBeUndefined()
  })

  it('loads bookmark by sync_id', async () => {
    const tabId = await seedTab()
    const bm = await createBookmark(tabId, { title: 'BySyncId', url: 'https://syncid.com' })
    expect((await loadBookmarkBySyncId(bm!.sync_id))!.title).toBe('BySyncId')
  })

  it('returns undefined for unknown sync_id', async () => {
    expect(await loadBookmarkBySyncId('no-such-id')).toBeUndefined()
  })
})

describe('saveBookmarkData', () => {
  it('updates bookmark fields and refreshes updated_at', async () => {
    const tabId = await seedTab()
    const bm = await createBookmark(tabId, { title: 'Old', url: 'https://old.com' })
    const oldTs = bm!.updated_at
    await new Promise(r => setTimeout(r, 5))
    const updated = await saveBookmarkData(bm!.id, { title: 'New', url: 'https://new.com' })
    expect(updated!.title).toBe('New')
    expect(updated!.url).toBe('https://new.com')
    expect(updated!.updated_at).toBeGreaterThan(oldTs)
  })
})

describe('softDeleteBookmark', () => {
  it('sets deleted_at on the bookmark', async () => {
    const tabId = await seedTab()
    const bm = await createBookmark(tabId, { title: 'ToDelete', url: 'https://del.com' })
    await softDeleteBookmark(bm!.id)
    const row = await testDb.tabs.get(bm!.id)
    expect(typeof row!.deleted_at).toBe('number')
  })

  it('excludes soft-deleted bookmarks from loadBookmarksByTabId', async () => {
    const tabId = await seedTab()
    const bm = await createBookmark(tabId, { title: 'Removed', url: 'https://rm.com' })
    await softDeleteBookmark(bm!.id)
    expect(await loadBookmarksByTabId(tabId)).toHaveLength(0)
  })
})
