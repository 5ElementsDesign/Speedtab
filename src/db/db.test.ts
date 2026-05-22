/**
 * Phase 1 – Dexie schema tests
 *
 * Each test uses a *fresh* SpeedtabDB instance backed by an isolated
 * fake-indexeddb IDBFactory, so tests are fully independent and can run in
 * any order without shared state.
 *
 * Pattern: pass { indexedDB, IDBKeyRange } from 'fake-indexeddb' to the
 * constructor instead of polluting the global scope with /auto.
 */
import { makeCreateMetadata } from '@/db/db'
import type { Asset, Collection, Module, Page, SavedFeedItem, Tab } from '@/types/db'
import Dexie from 'dexie'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ensureSyncMetadataMigration, SpeedtabDB } from './db'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function withMeta<T extends object>(data: T) {
  return { ...makeCreateMetadata(1_700_000_000_000), ...data }
}

const fakePage = (): Omit<Page, 'id'> => withMeta({
  slug:       'home',
  title:      'Home',
  nav_group:  'main' as const,
  icon:       '🏠',
  is_home:    1 as const,
  sort_order: 0,
})

// ─── Shared DB instance ───────────────────────────────────────────────────────

let db: SpeedtabDB

beforeEach(async () => {
  // Each test gets its own fake IDB factory for full isolation
  db = new SpeedtabDB({ indexedDB: new IDBFactory(), IDBKeyRange })
  await db.open()
})

afterEach(async () => {
  await db.delete()
})

// ─── Pages ────────────────────────────────────────────────────────────────────

describe('pages table', () => {
  it('inserts a page and returns an auto-incremented id', async () => {
    const id = await db.pages.add(fakePage())
    expect(typeof id).toBe('number')
    expect(id).toBeGreaterThan(0)
  })

  it('retrieves the page by id', async () => {
    const id   = await db.pages.add(fakePage())
    const page = await db.pages.get(id as number)
    expect(page?.slug).toBe('home')
    expect(page?.is_home).toBe(1)
    expect(page?.nav_group).toBe('main')
  })

  it('enforces unique slug constraint', async () => {
    await db.pages.add(fakePage())
    await expect(
      db.pages.add({ ...fakePage(), sort_order: 1 })
    ).rejects.toThrow()
  })

  it('returns pages in ascending sort_order', async () => {
    await db.pages.bulkAdd([
      withMeta({ slug: 'work',     title: 'Work',     nav_group: 'main' as const,     icon: null, is_home: 0 as const, sort_order: 2 }),
      withMeta({ slug: 'home',     title: 'Home',     nav_group: 'main' as const,     icon: null, is_home: 1 as const, sort_order: 0 }),
      withMeta({ slug: 'personal', title: 'Personal', nav_group: 'overflow' as const, icon: null, is_home: 0 as const, sort_order: 1 }),
    ])
    const pages = await db.pages.orderBy('sort_order').toArray()
    expect(pages.map(p => p.slug)).toEqual(['home', 'personal', 'work'])
  })

  it('can query the home page by is_home index', async () => {
    await db.pages.bulkAdd([
      withMeta({ slug: 'home', title: 'Home', nav_group: 'main' as const, icon: null, is_home: 1 as const, sort_order: 0 }),
      withMeta({ slug: 'work', title: 'Work', nav_group: 'main' as const, icon: null, is_home: 0 as const, sort_order: 1 }),
    ])
    const homes = await db.pages.where('is_home').equals(1).toArray()
    expect(homes).toHaveLength(1)
    expect(homes[0].slug).toBe('home')
  })
})

// ─── Modules ──────────────────────────────────────────────────────────────────

describe('modules table', () => {
  let pageId: number

  beforeEach(async () => {
    pageId = (await db.pages.add(fakePage())) as number
  })

  it('creates a module linked to a page', async () => {
    const mod: Omit<Module, 'id'> = withMeta({
      page_id:     pageId,
      type:        'tabs',
      title:       'My Bookmarks',
      sort_order:  0,
      config_json: JSON.stringify({ columns: 4, show_descriptions: true }),
    })
    const id = await db.modules.add(mod)
    const fetched = await db.modules.get(id as number)
    expect(fetched?.type).toBe('tabs')
    expect(fetched?.page_id).toBe(pageId)
  })

  it('queries all modules for a page via page_id index', async () => {
    await db.modules.bulkAdd([
      withMeta({ page_id: pageId, type: 'tabs' as const,  title: 'Tabs',  sort_order: 0, config_json: null }),
      withMeta({ page_id: pageId, type: 'notes' as const, title: 'Notes', sort_order: 1, config_json: null }),
      withMeta({ page_id: pageId, type: 'feeds' as const, title: 'Feeds', sort_order: 2, config_json: null }),
    ])
    const modules = await db.modules.where('page_id').equals(pageId).toArray()
    expect(modules).toHaveLength(3)
    expect(modules.map(m => m.type).sort()).toEqual(['feeds', 'notes', 'tabs'])
  })
})

// ─── Collections ──────────────────────────────────────────────────────────────

describe('collections table', () => {
  it('creates a collection inside a module', async () => {
    const pageId   = (await db.pages.add(fakePage())) as number
    const moduleId = (await db.modules.add(withMeta({
      page_id: pageId, type: 'notes', title: 'Notes', sort_order: 0, config_json: null,
    }))) as number

    const col: Omit<Collection, 'id'> = withMeta({
      module_id:   moduleId,
      title:       'Default',
      sort_order:  0,
      config_json: JSON.stringify({ collapsed: false }),
    })
    const colId = (await db.collections.add(col)) as number

    const cols = await db.collections.where('module_id').equals(moduleId).toArray()
    expect(cols).toHaveLength(1)
    expect(cols[0].id).toBe(colId)
    expect(cols[0].title).toBe('Default')
  })
})

// ─── Assets ───────────────────────────────────────────────────────────────────

describe('assets table', () => {
  it('stores a WebP Blob asset and retrieves scalar fields intact', async () => {
    const blob = new Blob(['fake-webp-bytes'], { type: 'image/webp' })
    const id   = (await db.assets.add({
      kind:      'preview',
      checksum:  'sha256-abc123',
      blob,
      width:     400,
      height:    300,
      meta_json: null,
    })) as number

    const asset = await db.assets.get(id)
    expect(asset?.checksum).toBe('sha256-abc123')
    expect(asset?.kind).toBe('preview')
    expect(asset?.width).toBe(400)
    expect(asset?.height).toBe(300)
    // Note: fake-indexeddb serialises Blob to a plain object internally.
    // In a real browser IndexedDB, Blob is stored and retrieved as a Blob.
    // We verify the field is present (not null/undefined) here.
    expect(asset?.blob).toBeDefined()
  })

  it('enforces unique checksum constraint', async () => {
    const blob = new Blob(['bytes'], { type: 'image/webp' })
    await db.assets.add({ kind: 'preview', checksum: 'unique-hash', blob, width: null, height: null, meta_json: null })
    await expect(
      db.assets.add({ kind: 'favicon', checksum: 'unique-hash', blob, width: null, height: null, meta_json: null })
    ).rejects.toThrow()
  })

  it('can query assets by kind', async () => {
    const blob = new Blob(['x'], { type: 'image/webp' })
    await db.assets.bulkAdd([
      { kind: 'preview', checksum: 'p1', blob, width: 400, height: 300, meta_json: null },
      { kind: 'favicon', checksum: 'f1', blob, width: 32,  height: 32,  meta_json: null },
      { kind: 'favicon', checksum: 'f2', blob, width: 64,  height: 64,  meta_json: null },
    ])
    const favicons = await db.assets.where('kind').equals('favicon').toArray()
    expect(favicons).toHaveLength(2)
  })
})

// ─── Feed sources & items ─────────────────────────────────────────────────────

describe('feed_sources and feed_items tables', () => {
  it('links feed items to a feed source and queries by source id', async () => {
    const pageId   = (await db.pages.add(fakePage())) as number
    const moduleId = (await db.modules.add(withMeta({ page_id: pageId, type: 'feeds' as const, title: 'Feeds', sort_order: 0, config_json: null }))) as number
    const colId    = (await db.collections.add(withMeta({ module_id: moduleId, title: 'Default', sort_order: 0, config_json: null }))) as number

    const sourceId = (await db.feed_sources.add(withMeta({
      collection_id:      colId,
      title:              'Hacker News',
      feed_url:           'https://news.ycombinator.com/rss',
      site_url:           'https://news.ycombinator.com',
      sort_order:         0,
      style_token:        null,
      last_hash:          null,
      last_fetched_at:    null,
      last_error_at:      null,
      last_error_message: null,
      fetch_options_json: null,
    }))) as number

    const now = Date.now()
    await db.feed_items.bulkAdd([
      { feed_source_id: sourceId, external_id: 'item-1', title: 'First',  url: 'https://a.com', author: null, published_at: now - 86400000, summary: null, content: null, payload_json: null, fetched_at: now },
      { feed_source_id: sourceId, external_id: 'item-2', title: 'Second', url: 'https://b.com', author: null, published_at: now - 43200000, summary: null, content: null, payload_json: null, fetched_at: now },
    ])

    const items = await db.feed_items.where('feed_source_id').equals(sourceId).toArray()
    expect(items).toHaveLength(2)
    expect(items.map(i => i.external_id).sort()).toEqual(['item-1', 'item-2'])
  })

  it('can query feed items older than 90 days for pruning', async () => {
    const pageId   = (await db.pages.add(fakePage())) as number
    const moduleId = (await db.modules.add(withMeta({ page_id: pageId, type: 'feeds' as const, title: 'Feeds', sort_order: 0, config_json: null }))) as number
    const colId    = (await db.collections.add(withMeta({ module_id: moduleId, title: 'Default', sort_order: 0, config_json: null }))) as number
    const sourceId = (await db.feed_sources.add(withMeta({
      collection_id: colId, title: 'Feed', feed_url: 'https://example.com/rss',
      site_url: null, sort_order: 0, style_token: null, last_hash: null,
      last_fetched_at: null, last_error_at: null, last_error_message: null, fetch_options_json: null,
    }))) as number

    const now    = Date.now()
    const old    = now - 91 * 24 * 60 * 60 * 1000 // 91 days ago
    const recent = now - 5  * 24 * 60 * 60 * 1000  // 5 days ago

    await db.feed_items.bulkAdd([
      { feed_source_id: sourceId, external_id: 'old',    title: 'Old',    url: null, author: null, published_at: old,    summary: null, content: null, payload_json: null, fetched_at: old    },
      { feed_source_id: sourceId, external_id: 'recent', title: 'Recent', url: null, author: null, published_at: recent, summary: null, content: null, payload_json: null, fetched_at: recent },
    ])

    const cutoff  = now - 90 * 24 * 60 * 60 * 1000
    const stale   = await db.feed_items.where('fetched_at').below(cutoff).toArray()
    expect(stale).toHaveLength(1)
    expect(stale[0].external_id).toBe('old')
  })

  it('can query feed items by compound source/id key', async () => {
    const pageId   = (await db.pages.add(fakePage())) as number
    const moduleId = (await db.modules.add(withMeta({ page_id: pageId, type: 'feeds' as const, title: 'Feeds', sort_order: 0, config_json: null }))) as number
    const colId    = (await db.collections.add(withMeta({ module_id: moduleId, title: 'Default', sort_order: 0, config_json: null }))) as number
    const sourceId = (await db.feed_sources.add(withMeta({
      collection_id: colId, title: 'Feed', feed_url: 'https://example.com/rss',
      site_url: null, sort_order: 0, style_token: null, last_hash: null,
      last_fetched_at: null, last_error_at: null, last_error_message: null, fetch_options_json: null,
    }))) as number

    await db.feed_items.add({
      feed_source_id: sourceId,
      external_id: 'guid-123',
      title: 'Example',
      url: 'https://example.com/post',
      author: null,
      published_at: Date.now(),
      summary: null,
      content: null,
      payload_json: null,
      fetched_at: Date.now(),
    })

    const hit = await db.feed_items
      .where('[feed_source_id+external_id]')
      .equals([sourceId, 'guid-123'])
      .first()

    expect(hit?.title).toBe('Example')
  })
})

describe('saved_feed_items table', () => {
  it('stores archived feed items by collection', async () => {
    const pageId   = (await db.pages.add(fakePage())) as number
    const moduleId = (await db.modules.add(withMeta({ page_id: pageId, type: 'feeds' as const, title: 'Feeds', sort_order: 0, config_json: null }))) as number
    const colId    = (await db.collections.add(withMeta({ module_id: moduleId, title: 'Default', sort_order: 0, config_json: null }))) as number

    const saved: Omit<SavedFeedItem, 'id'> = withMeta({
      collection_id: colId,
      title: 'Saved article',
      url: 'https://example.com/post',
      source_title: 'Example Feed',
      author: null,
      published_at: Date.now(),
      summary: 'Summary',
      content: null,
      comment: 'Interesting read',
      saved_at: Date.now(),
      sort_order: 0,
      meta_json: null,
    })
    await db.saved_feed_items.add(saved)

    const rows = await db.saved_feed_items.where('collection_id').equals(colId).toArray()
    expect(rows).toHaveLength(1)
    expect(rows[0].title).toBe('Saved article')
  })
})

// ─── Tabs + Asset relational links ────────────────────────────────────────────

describe('tabs table and asset linking', () => {
  let pageId:   number
  let moduleId: number
  let colId:    number

  beforeEach(async () => {
    pageId   = (await db.pages.add(fakePage())) as number
    moduleId = (await db.modules.add(withMeta({
      page_id: pageId, type: 'tabs', title: 'Bookmarks', sort_order: 0, config_json: JSON.stringify({ columns: 4 }),
    }))) as number
    colId    = (await db.collections.add(withMeta({
      module_id: moduleId, title: 'Daily', sort_order: 0, config_json: null,
    }))) as number
  })

  it('creates a tab inside a collection', async () => {
    const tabData: Omit<Tab, 'id'> = withMeta({
      collection_id:    colId,
      title:            'GitHub',
      url:              'https://github.com',
      description:      null,
      favicon_asset_id: null,
      preview_asset_id: null,
      sort_order:       0,
      meta_json:        null,
    })
    const tabId = (await db.tabs.add(tabData)) as number
    const tab   = await db.tabs.get(tabId)
    expect(tab?.title).toBe('GitHub')
    expect(tab?.url).toBe('https://github.com')
    expect(tab?.collection_id).toBe(colId)
  })

  it('queries all tabs for a collection', async () => {
    await db.tabs.bulkAdd([
      withMeta({ collection_id: colId, title: 'A', url: 'https://a.com', description: null, favicon_asset_id: null, preview_asset_id: null, sort_order: 0, meta_json: null }),
      withMeta({ collection_id: colId, title: 'B', url: 'https://b.com', description: null, favicon_asset_id: null, preview_asset_id: null, sort_order: 1, meta_json: null }),
      withMeta({ collection_id: colId, title: 'C', url: 'https://c.com', description: null, favicon_asset_id: null, preview_asset_id: null, sort_order: 2, meta_json: null }),
    ])
    const tabs = await db.tabs.where('collection_id').equals(colId).sortBy('sort_order')
    expect(tabs).toHaveLength(3)
    expect(tabs.map(t => t.title)).toEqual(['A', 'B', 'C'])
  })

  it('links a tab to a preview asset via preview_asset_id', async () => {
    // Store a fake WebP blob in the assets table
    const fakeWebp: Omit<Asset, 'id'> = {
      kind:      'preview',
      checksum:  'sha256-phase3-preview-test',
      blob:      new Blob(['fake-webp'], { type: 'image/webp' }),
      width:     98,
      height:    56,
      meta_json: null,
    }
    const assetId = (await db.assets.add(fakeWebp)) as number

    // Create a tab referencing that asset
    const tabId = (await db.tabs.add(withMeta({
      collection_id:    colId,
      title:            'Example',
      url:              'https://example.com',
      description:      null,
      favicon_asset_id: null,
      preview_asset_id: assetId,
      sort_order:       0,
      meta_json:        null,
    }))) as number

    // Verify the relational link
    const tab   = await db.tabs.get(tabId)
    expect(tab?.preview_asset_id).toBe(assetId)

    const asset = await db.assets.get(assetId)
    expect(asset?.width).toBe(98)
    expect(asset?.height).toBe(56)
    expect(asset?.checksum).toBe('sha256-phase3-preview-test')
  })

  it('rejects duplicate asset checksum (dedup enforcement)', async () => {
    const blob = new Blob(['webp-bytes'], { type: 'image/webp' })
    await db.assets.add({ kind: 'preview', checksum: 'dupe-checksum', blob, width: 98, height: 56, meta_json: null })
    await expect(
      db.assets.add({ kind: 'preview', checksum: 'dupe-checksum', blob, width: 98, height: 56, meta_json: null })
    ).rejects.toThrow()
  })

  it('tabs are returned in sort_order ascending', async () => {
    await db.tabs.bulkAdd([
      withMeta({ collection_id: colId, title: 'Z', url: 'https://z.com', description: null, favicon_asset_id: null, preview_asset_id: null, sort_order: 2, meta_json: null }),
      withMeta({ collection_id: colId, title: 'A', url: 'https://a.com', description: null, favicon_asset_id: null, preview_asset_id: null, sort_order: 0, meta_json: null }),
      withMeta({ collection_id: colId, title: 'M', url: 'https://m.com', description: null, favicon_asset_id: null, preview_asset_id: null, sort_order: 1, meta_json: null }),
    ])
    const sorted = await db.tabs.where('collection_id').equals(colId).sortBy('sort_order')
    expect(sorted.map(t => t.title)).toEqual(['A', 'M', 'Z'])
  })
})

// ─── Reordering Logic ─────────────────────────────────────────────────────────

describe('reordering logic', () => {
  it('swaps sort_order between two pages', async () => {
    const id1 = await db.pages.add(withMeta({ slug: 'p1', title: 'P1', sort_order: 10, nav_group: 'main' as const, icon: null, is_home: 0 as const })) as number
    const id2 = await db.pages.add(withMeta({ slug: 'p2', title: 'P2', sort_order: 20, nav_group: 'main' as const, icon: null, is_home: 0 as const })) as number

    // Simulate swap logic from useReorder
    await db.transaction('rw', db.pages, async () => {
      await db.pages.update(id1, { sort_order: 20 })
      await db.pages.update(id2, { sort_order: 10 })
    })

    const p1 = await db.pages.get(id1)
    const p2 = await db.pages.get(id2)

    expect(p1?.sort_order).toBe(20)
    expect(p2?.sort_order).toBe(10)

    const sorted = await db.pages.orderBy('sort_order').toArray()
    expect(sorted[0].slug).toBe('p2')
    expect(sorted[1].slug).toBe('p1')
  })
})

describe('sync metadata migration', () => {
  it('backfills authored rows from a legacy schema and clears the pending flag', async () => {
    await db.delete()

    const factory = new IDBFactory()
    const legacy = new Dexie('speedtab', { indexedDB: factory, IDBKeyRange })
    legacy.version(4).stores({
      pages:            '++id, &slug, sort_order, is_home',
      modules:          '++id, page_id, type, sort_order',
      collections:      '++id, module_id, sort_order',
      tabs:             '++id, collection_id, url, sort_order',
      notes:            '++id, collection_id, type, sort_order',
      feed_sources:     '++id, collection_id, sort_order, last_fetched_at',
      feed_items:       '++id, feed_source_id, fetched_at, published_at, [feed_source_id+external_id]',
      saved_feed_items: '++id, collection_id, saved_at, sort_order',
      assets:           '++id, &checksum, kind',
      app_settings:     '&key, updated_at',
    })
    await legacy.open()

    const pageId = await legacy.table('pages').add({
      slug: 'legacy-home',
      title: 'Legacy Home',
      nav_group: 'main',
      icon: null,
      is_home: 1,
      sort_order: 0,
      config_json: null,
    })
    const moduleId = await legacy.table('modules').add({
      page_id: pageId,
      type: 'tabs',
      title: 'Legacy Tabs',
      sort_order: 0,
      config_json: null,
    })
    await legacy.table('collections').add({
      module_id: moduleId,
      title: 'Legacy Collection',
      sort_order: 0,
      config_json: null,
    })

    await legacy.close()

    db = new SpeedtabDB({ indexedDB: factory, IDBKeyRange })
    await db.open()
    await ensureSyncMetadataMigration(db)

    const page = await db.pages.where('slug').equals('legacy-home').first()
    const module = await db.modules.where('page_id').equals(pageId as number).first()
    const pending = await db.app_settings.get('pending_sync_metadata_migration')

    expect(page?.sync_id).toBeTypeOf('string')
    expect(page?.created_at).toBeTypeOf('number')
    expect(page?.updated_at).toBeTypeOf('number')
    expect(page?.deleted_at).toBeNull()
    expect(module?.sync_id).toBeTypeOf('string')
    expect(module?.deleted_at).toBeNull()
    expect(pending?.value_json).toBe('false')
  })
})
