import { makeCreateMetadata, SpeedtabDB } from '@/db/db'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  cleanupOrphans,
  deleteCollectionTree,
  deleteModuleTree,
  deletePageTree,
} from './useMaintenance'

let db: SpeedtabDB

function withMeta<T extends object>(data: T) {
  return { ...makeCreateMetadata(1_700_000_000_000), ...data }
}

beforeEach(async () => {
  db = new SpeedtabDB({ indexedDB: new IDBFactory(), IDBKeyRange })
  await db.open()
})

afterEach(async () => {
  await db.delete()
})

async function seedPageTree() {
  const pageId = await db.pages.add(withMeta({
    slug: 'home',
    title: 'Home',
    nav_group: 'main',
    icon: '🏠',
    is_home: 1,
    sort_order: 0,
    config_json: null,
  })) as number
  const moduleId = await db.modules.add(withMeta({
    page_id: pageId,
    type: 'feeds',
    title: 'Feeds',
    sort_order: 0,
    config_json: null,
  })) as number
  const collectionId = await db.collections.add(withMeta({
    module_id: moduleId,
    title: 'Daily',
    sort_order: 0,
    config_json: null,
  })) as number
  const assetId = await db.assets.add({
    kind: 'preview',
    checksum: 'asset-a',
    blob: new Blob(['img'], { type: 'image/webp' }),
    width: 98,
    height: 56,
    meta_json: null,
  }) as number
  await db.tabs.add(withMeta({
    collection_id: collectionId,
    title: 'Example',
    url: 'https://example.com',
    description: null,
    favicon_asset_id: null,
    preview_asset_id: assetId,
    sort_order: 0,
    meta_json: null,
  }))
  const sourceId = await db.feed_sources.add(withMeta({
    collection_id: collectionId,
    title: 'Feed',
    feed_url: 'https://example.com/feed.xml',
    site_url: null,
    sort_order: 0,
    style_token: null,
    last_hash: null,
    last_fetched_at: null,
    last_error_at: null,
    last_error_message: null,
    fetch_options_json: null,
  })) as number
  await db.feed_items.add({
    feed_source_id: sourceId,
    external_id: 'item-1',
    title: 'Feed item',
    url: 'https://example.com/post',
    author: null,
    published_at: Date.now(),
    summary: null,
    content: null,
    payload_json: null,
    fetched_at: Date.now(),
  })
  await db.notes.add(withMeta({
    collection_id: collectionId,
    title: 'Note',
    type: 'text',
    content: 'hello',
    style_token: null,
    sort_order: 0,
    meta_json: null,
  }))

  return { pageId, moduleId, collectionId, assetId }
}

describe('delete tree helpers', () => {
  it('deleteCollectionTree removes collection descendants including feed items', async () => {
    const { collectionId } = await seedPageTree()

    await deleteCollectionTree(collectionId, db)

    expect(await db.collections.count()).toBe(0)
    expect(await db.tabs.count()).toBe(0)
    expect(await db.notes.count()).toBe(0)
    expect(await db.feed_sources.count()).toBe(0)
    expect(await db.feed_items.count()).toBe(0)
  })

  it('deleteModuleTree removes all nested descendants', async () => {
    const { moduleId } = await seedPageTree()

    await deleteModuleTree(moduleId, db)

    expect(await db.modules.count()).toBe(0)
    expect(await db.collections.count()).toBe(0)
    expect(await db.tabs.count()).toBe(0)
    expect(await db.notes.count()).toBe(0)
    expect(await db.feed_sources.count()).toBe(0)
    expect(await db.feed_items.count()).toBe(0)
  })

  it('deletePageTree removes the full hierarchy under a page', async () => {
    const { pageId } = await seedPageTree()

    await deletePageTree(pageId, db)

    expect(await db.pages.count()).toBe(0)
    expect(await db.modules.count()).toBe(0)
    expect(await db.collections.count()).toBe(0)
    expect(await db.tabs.count()).toBe(0)
    expect(await db.notes.count()).toBe(0)
    expect(await db.feed_sources.count()).toBe(0)
    expect(await db.feed_items.count()).toBe(0)
  })
})

describe('cleanupOrphans', () => {
  it('removes orphaned records and unused assets with a report', async () => {
    const { assetId } = await seedPageTree()
    await db.tabs.clear()

    await db.modules.add(withMeta({
      page_id: 999_001,
      type: 'tabs',
      title: 'Orphan module',
      sort_order: 5,
      config_json: null,
    }))
    await db.collections.add(withMeta({
      module_id: 999_002,
      title: 'Orphan collection',
      sort_order: 0,
      config_json: null,
    }))
    await db.notes.add(withMeta({
      collection_id: 999_003,
      title: 'Orphan note',
      type: 'text',
      content: 'x',
      style_token: null,
      sort_order: 0,
      meta_json: null,
    }))
    await db.feed_sources.add(withMeta({
      collection_id: 999_004,
      title: 'Orphan source',
      feed_url: 'https://example.com/orphan.xml',
      site_url: null,
      sort_order: 0,
      style_token: null,
      last_hash: null,
      last_fetched_at: null,
      last_error_at: null,
      last_error_message: null,
      fetch_options_json: null,
    }))
    await db.feed_items.add({
      feed_source_id: 999_005,
      external_id: 'orphan-feed-item',
      title: 'Orphan feed item',
      url: null,
      author: null,
      published_at: null,
      summary: null,
      content: null,
      payload_json: null,
      fetched_at: Date.now(),
    })
    await db.assets.add({
      kind: 'favicon',
      checksum: 'asset-b',
      blob: new Blob(['img'], { type: 'image/webp' }),
      width: 16,
      height: 16,
      meta_json: null,
    })

    const report = await cleanupOrphans(db)

    expect(report.removedModules).toBe(1)
    expect(report.removedCollections).toBe(1)
    expect(report.removedNotes).toBe(1)
    expect(report.removedFeedSources).toBe(1)
    expect(report.removedFeedItems).toBe(1)
    expect(report.removedAssets).toBe(2)
    expect(await db.assets.get(assetId)).toBeUndefined()
  })
})
