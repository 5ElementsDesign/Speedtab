import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { makeCreateMetadata, SpeedtabDB } from '@/db/db'
import { getExportState } from '@/composables/useExportState'
import { transferCollectionContent } from './useCollectionTransfer'

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

async function seedCollectionPair(moduleType: 'tabs' | 'notes' | 'feeds' = 'tabs') {
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
    type: moduleType,
    title: moduleType,
    sort_order: 0,
    config_json: null,
  })) as number

  const sourceCollectionId = await db.collections.add(withMeta({
    module_id: moduleId,
    title: 'Source',
    sort_order: 0,
    config_json: null,
  })) as number

  const destinationCollectionId = await db.collections.add(withMeta({
    module_id: moduleId,
    title: 'Destination',
    sort_order: 1,
    config_json: null,
  })) as number

  return { sourceCollectionId, destinationCollectionId }
}

describe('transferCollectionContent', () => {
  it('copies selected bookmarks into the destination and leaves the source unchanged', async () => {
    const { sourceCollectionId, destinationCollectionId } = await seedCollectionPair('tabs')

    const sourceA = await db.tabs.add(withMeta({
      collection_id: sourceCollectionId,
      title: 'A',
      url: 'https://a.example',
      description: null,
      favicon_asset_id: null,
      preview_asset_id: null,
      sort_order: 0,
      meta_json: null,
    })) as number
    const sourceB = await db.tabs.add(withMeta({
      collection_id: sourceCollectionId,
      title: 'B',
      url: 'https://b.example',
      description: null,
      favicon_asset_id: null,
      preview_asset_id: null,
      sort_order: 1,
      meta_json: null,
    })) as number

    await db.tabs.add(withMeta({
      collection_id: destinationCollectionId,
      title: 'Existing',
      url: 'https://existing.example',
      description: null,
      favicon_asset_id: null,
      preview_asset_id: null,
      sort_order: 0,
      meta_json: null,
    }))

    const result = await transferCollectionContent({
      sourceCollectionId,
      destinationCollectionId,
      moduleType: 'tabs',
      mode: 'copy',
      selectedKeys: [`tab:${sourceA}`, `tab:${sourceB}`],
    }, db)

    expect(result.counts.tabs).toBe(2)

    const sourceTabs = await db.tabs.where('collection_id').equals(sourceCollectionId).sortBy('sort_order')
    const destinationTabs = await db.tabs.where('collection_id').equals(destinationCollectionId).sortBy('sort_order')

    expect(sourceTabs.map((tab) => tab.title)).toEqual(['A', 'B'])
    expect(destinationTabs.map((tab) => tab.title)).toEqual(['Existing', 'A', 'B'])
    expect(destinationTabs[1].id).not.toBe(sourceA)
    expect(destinationTabs[2].id).not.toBe(sourceB)

    const exportState = await getExportState(db)
    expect(exportState.export_dirty).toBe(true)
    expect(exportState.export_dirty_reasons).toContain('tabs:transfer')
  })

  it('moves selected notes into the destination and normalizes source order', async () => {
    const { sourceCollectionId, destinationCollectionId } = await seedCollectionPair('notes')

    const noteA = await db.notes.add(withMeta({
      collection_id: sourceCollectionId,
      title: 'A',
      type: 'text',
      content: 'A',
      style_token: null,
      sort_order: 0,
      meta_json: null,
    })) as number
    await db.notes.add(withMeta({
      collection_id: sourceCollectionId,
      title: 'B',
      type: 'text',
      content: 'B',
      style_token: null,
      sort_order: 1,
      meta_json: null,
    }))
    const noteC = await db.notes.add(withMeta({
      collection_id: sourceCollectionId,
      title: 'C',
      type: 'text',
      content: 'C',
      style_token: null,
      sort_order: 2,
      meta_json: null,
    })) as number

    const result = await transferCollectionContent({
      sourceCollectionId,
      destinationCollectionId,
      moduleType: 'notes',
      mode: 'move',
      selectedKeys: [`note:${noteA}`, `note:${noteC}`],
    }, db)

    expect(result.counts.notes).toBe(2)

    const sourceNotes = await db.notes.where('collection_id').equals(sourceCollectionId).sortBy('sort_order')
    const destinationNotes = await db.notes.where('collection_id').equals(destinationCollectionId).sortBy('sort_order')

    expect(sourceNotes.map((note) => `${note.title}:${note.sort_order}`)).toEqual(['B:0'])
    expect(destinationNotes.map((note) => `${note.title}:${note.sort_order}`)).toEqual(['A:0', 'C:1'])
  })

  it('transfers only the checked feed items and feed sources', async () => {
    const { sourceCollectionId, destinationCollectionId } = await seedCollectionPair('feeds')

    const sourceId = await db.feed_sources.add(withMeta({
      collection_id: sourceCollectionId,
      title: 'Source Feed',
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
    await db.feed_sources.add(withMeta({
      collection_id: sourceCollectionId,
      title: 'Ignored Feed',
      feed_url: 'https://example.com/ignored.xml',
      site_url: null,
      sort_order: 1,
      style_token: null,
      last_hash: null,
      last_fetched_at: null,
      last_error_at: null,
      last_error_message: null,
      fetch_options_json: null,
    }))

    const savedId = await db.saved_feed_items.add(withMeta({
      collection_id: sourceCollectionId,
      title: 'Saved 1',
      url: 'https://example.com/1',
      source_title: 'Source Feed',
      author: null,
      published_at: null,
      summary: null,
      content: null,
      comment: null,
      saved_at: 1_700_000_000_100,
      sort_order: 0,
      meta_json: null,
    })) as number
    await db.saved_feed_items.add(withMeta({
      collection_id: sourceCollectionId,
      title: 'Saved 2',
      url: 'https://example.com/2',
      source_title: 'Source Feed',
      author: null,
      published_at: null,
      summary: null,
      content: null,
      comment: null,
      saved_at: 1_700_000_000_200,
      sort_order: 1,
      meta_json: null,
    }))

    const result = await transferCollectionContent({
      sourceCollectionId,
      destinationCollectionId,
      moduleType: 'feeds',
      mode: 'copy',
      selectedKeys: [`feed_source:${sourceId}`, `saved_feed_item:${savedId}`],
    }, db)

    expect(result.counts.feed_sources).toBe(1)
    expect(result.counts.saved_feed_items).toBe(1)

    const destinationSources = await db.feed_sources.where('collection_id').equals(destinationCollectionId).sortBy('sort_order')
    const destinationSaved = await db.saved_feed_items.where('collection_id').equals(destinationCollectionId).sortBy('sort_order')
    expect(destinationSources.map((row) => row.title)).toEqual(['Source Feed'])
    expect(destinationSaved.map((row) => row.title)).toEqual(['Saved 1'])
  })

  it('rejects same-source same-destination transfers', async () => {
    const { sourceCollectionId } = await seedCollectionPair('tabs')

    await expect(transferCollectionContent({
      sourceCollectionId,
      destinationCollectionId: sourceCollectionId,
      moduleType: 'tabs',
      mode: 'copy',
      selectedKeys: [],
    }, db)).rejects.toThrow('Source and destination tabs must be different')
  })
})
