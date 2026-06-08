import { db as defaultDb, type SpeedtabDB } from '@/db/db'
import { getFaviconHostnameCandidatesForUrl, parseFaviconMeta } from '@/composables/useFavicon'
import { extractLinkNoteUrls } from '@/composables/useNoteLinks'
import { extractNoteImageAssetIds } from '@/composables/useNoteImages'
import type { Asset, Collection, FeedItem, FeedSource, Module, Note, SavedFeedItem, Tab } from '@/types/db'

export interface CleanupReport {
  removedModules: number
  removedCollections: number
  removedTabs: number
  removedNotes: number
  removedFeedSources: number
  removedFeedItems: number
  removedSavedFeedItems: number
  removedAssets: number
}

export interface CleanupCandidates {
  modules: Module[]
  collections: Collection[]
  tabs: Tab[]
  notes: Note[]
  feedSources: FeedSource[]
  feedItems: FeedItem[]
  savedFeedItems: SavedFeedItem[]
  unusedAssets: Asset[]
}

export interface CleanupOptions {
  removeUnusedAssets?: boolean
}

function emptyReport(): CleanupReport {
  return {
    removedModules: 0,
    removedCollections: 0,
    removedTabs: 0,
    removedNotes: 0,
    removedFeedSources: 0,
    removedFeedItems: 0,
    removedSavedFeedItems: 0,
    removedAssets: 0,
  }
}

function emptyCandidates(): CleanupCandidates {
  return {
    modules: [],
    collections: [],
    tabs: [],
    notes: [],
    feedSources: [],
    feedItems: [],
    savedFeedItems: [],
    unusedAssets: [],
  }
}

function getPageBackgroundAssetId(configJson: string | null | undefined): number | null {
  if (!configJson) return null
  try {
    const parsed = JSON.parse(configJson)
    return typeof parsed.background_asset_id === 'number' ? parsed.background_asset_id : null
  } catch {
    return null
  }
}

function getAppBackgroundAssetId(valueJson: string | null | undefined): number | null {
  if (!valueJson) return null
  try {
    const parsed = JSON.parse(valueJson)
    return typeof parsed.background_asset_id === 'number' ? parsed.background_asset_id : null
  } catch {
    return null
  }
}

function collectReferencedFaviconAssetIds(
  assets: Asset[],
  tabs: Tab[],
  notes: Note[],
  feedSources: FeedSource[],
  feedItems: FeedItem[],
): Set<number> {
  const referencedAssetIds = new Set<number>()

  for (const tab of tabs) {
    if (tab.favicon_asset_id != null) referencedAssetIds.add(tab.favicon_asset_id)
    if (tab.preview_asset_id != null) referencedAssetIds.add(tab.preview_asset_id)
  }

  const referencedHosts = new Set<string>()
  for (const tab of tabs) {
    for (const host of getFaviconHostnameCandidatesForUrl(tab.url)) referencedHosts.add(host)
  }
  for (const note of notes) {
    if (note.type !== 'links') continue
    for (const url of extractLinkNoteUrls(note.content)) {
      for (const host of getFaviconHostnameCandidatesForUrl(url)) referencedHosts.add(host)
    }
  }
  for (const source of feedSources) {
    for (const host of getFaviconHostnameCandidatesForUrl(source.site_url || source.feed_url)) referencedHosts.add(host)
  }
  for (const item of feedItems) {
    for (const host of getFaviconHostnameCandidatesForUrl(item.url)) referencedHosts.add(host)
  }

  for (const asset of assets) {
    if (asset.kind !== 'favicon' || asset.id == null) continue
    const meta = parseFaviconMeta(asset.meta_json)
    if (!meta) continue
    if (meta.hostnames.some((hostname) => referencedHosts.has(hostname))) {
      referencedAssetIds.add(asset.id)
    }
  }

  return referencedAssetIds
}

export async function deleteCollectionTree(
  collectionId: number,
  database: SpeedtabDB = defaultDb,
): Promise<void> {
  await database.transaction(
    'rw',
    [database.collections, database.tabs, database.notes, database.feed_sources, database.feed_items, database.saved_feed_items],
    async () => {
      const sourceIds = (await database.feed_sources.where('collection_id').equals(collectionId).primaryKeys()) as number[]
      if (sourceIds.length) {
        await database.feed_items.where('feed_source_id').anyOf(sourceIds).delete()
      }
      await database.saved_feed_items.where('collection_id').equals(collectionId).delete()
      await database.feed_sources.where('collection_id').equals(collectionId).delete()
      await database.tabs.where('collection_id').equals(collectionId).delete()
      await database.notes.where('collection_id').equals(collectionId).delete()
      await database.collections.delete(collectionId)
    },
  )
}

export async function deleteModuleTree(
  moduleId: number,
  database: SpeedtabDB = defaultDb,
): Promise<void> {
  await database.transaction(
    'rw',
    [
      database.modules, database.collections, database.tabs,
      database.notes, database.feed_sources, database.feed_items, database.saved_feed_items,
    ],
    async () => {
      const collectionIds = (await database.collections.where('module_id').equals(moduleId).primaryKeys()) as number[]
      if (collectionIds.length) {
        const sourceIds = (await database.feed_sources.where('collection_id').anyOf(collectionIds).primaryKeys()) as number[]
        if (sourceIds.length) {
          await database.feed_items.where('feed_source_id').anyOf(sourceIds).delete()
        }
        await database.saved_feed_items.where('collection_id').anyOf(collectionIds).delete()
        await database.feed_sources.where('collection_id').anyOf(collectionIds).delete()
        await database.tabs.where('collection_id').anyOf(collectionIds).delete()
        await database.notes.where('collection_id').anyOf(collectionIds).delete()
        await database.collections.where('module_id').equals(moduleId).delete()
      }
      await database.modules.delete(moduleId)
    },
  )
}

export async function deletePageTree(
  pageId: number,
  database: SpeedtabDB = defaultDb,
): Promise<void> {
  await database.transaction(
    'rw',
    [
      database.pages, database.modules, database.collections, database.tabs,
      database.notes, database.feed_sources, database.feed_items, database.saved_feed_items,
    ],
    async () => {
      const moduleIds = (await database.modules.where('page_id').equals(pageId).primaryKeys()) as number[]
      if (moduleIds.length) {
        const collectionIds = (await database.collections.where('module_id').anyOf(moduleIds).primaryKeys()) as number[]
        if (collectionIds.length) {
          const sourceIds = (await database.feed_sources.where('collection_id').anyOf(collectionIds).primaryKeys()) as number[]
          if (sourceIds.length) {
            await database.feed_items.where('feed_source_id').anyOf(sourceIds).delete()
          }
          await database.saved_feed_items.where('collection_id').anyOf(collectionIds).delete()
          await database.feed_sources.where('collection_id').anyOf(collectionIds).delete()
          await database.tabs.where('collection_id').anyOf(collectionIds).delete()
          await database.notes.where('collection_id').anyOf(collectionIds).delete()
          await database.collections.where('module_id').anyOf(moduleIds).delete()
        }
        await database.modules.where('page_id').equals(pageId).delete()
      }
      await database.pages.delete(pageId)
    },
  )
}

export async function cleanupOrphans(
  database: SpeedtabDB = defaultDb,
  options: CleanupOptions = {},
): Promise<CleanupReport> {
  const report = emptyReport()
  const removeUnusedAssets = options.removeUnusedAssets === true

  await database.transaction(
    'rw',
    [
      database.pages, database.modules, database.collections, database.tabs,
      database.notes, database.feed_sources, database.feed_items, database.saved_feed_items, database.assets, database.app_settings,
    ],
    async () => {
      const pageIds = new Set((await database.pages.toCollection().primaryKeys()) as number[])

      const orphanModuleIds = (await database.modules.toArray())
        .filter(module => !pageIds.has(module.page_id))
        .map(module => module.id!)
      if (orphanModuleIds.length) {
        await database.modules.bulkDelete(orphanModuleIds)
        report.removedModules = orphanModuleIds.length
      }

      const moduleIds = new Set((await database.modules.toCollection().primaryKeys()) as number[])

      const orphanCollectionIds = (await database.collections.toArray())
        .filter(collection => !moduleIds.has(collection.module_id))
        .map(collection => collection.id!)
      if (orphanCollectionIds.length) {
        await database.collections.bulkDelete(orphanCollectionIds)
        report.removedCollections = orphanCollectionIds.length
      }

      const collectionIds = new Set((await database.collections.toCollection().primaryKeys()) as number[])

      const orphanTabIds = (await database.tabs.toArray())
        .filter(tab => !collectionIds.has(tab.collection_id))
        .map(tab => tab.id!)
      if (orphanTabIds.length) {
        await database.tabs.bulkDelete(orphanTabIds)
        report.removedTabs = orphanTabIds.length
      }

      const orphanNoteIds = (await database.notes.toArray())
        .filter(note => !collectionIds.has(note.collection_id))
        .map(note => note.id!)
      if (orphanNoteIds.length) {
        await database.notes.bulkDelete(orphanNoteIds)
        report.removedNotes = orphanNoteIds.length
      }

      const orphanSourceIds = (await database.feed_sources.toArray())
        .filter(source => !collectionIds.has(source.collection_id))
        .map(source => source.id!)
      if (orphanSourceIds.length) {
        await database.feed_sources.bulkDelete(orphanSourceIds)
        report.removedFeedSources = orphanSourceIds.length
      }

      const sourceIds = new Set((await database.feed_sources.toCollection().primaryKeys()) as number[])

      const orphanFeedItemIds = (await database.feed_items.toArray())
        .filter(item => !sourceIds.has(item.feed_source_id))
        .map(item => item.id!)
      if (orphanFeedItemIds.length) {
        await database.feed_items.bulkDelete(orphanFeedItemIds)
        report.removedFeedItems = orphanFeedItemIds.length
      }

      const orphanSavedFeedItemIds = (await database.saved_feed_items.toArray())
        .filter(item => !collectionIds.has(item.collection_id))
        .map(item => item.id!)
      if (orphanSavedFeedItemIds.length) {
        await database.saved_feed_items.bulkDelete(orphanSavedFeedItemIds)
        report.removedSavedFeedItems = orphanSavedFeedItemIds.length
      }

      const currentTabs = await database.tabs.toArray()
      const currentNotes = await database.notes.toArray()
      const currentFeedSources = await database.feed_sources.toArray()
      const currentFeedItems = await database.feed_items.toArray()
      const currentAssets = await database.assets.toArray()
      const referencedAssetIds = collectReferencedFaviconAssetIds(currentAssets, currentTabs, currentNotes, currentFeedSources, currentFeedItems)
      for (const note of await database.notes.toArray()) {
        if (note.type !== 'html') continue
        for (const assetId of extractNoteImageAssetIds(note.content)) {
          referencedAssetIds.add(assetId)
        }
      }
      for (const page of await database.pages.toArray()) {
        const pageBackgroundAssetId = getPageBackgroundAssetId(page.config_json)
        if (pageBackgroundAssetId != null) referencedAssetIds.add(pageBackgroundAssetId)
      }
      for (const setting of await database.app_settings.toArray()) {
        const appBackgroundAssetId = getAppBackgroundAssetId(setting.value_json)
        if (appBackgroundAssetId != null) referencedAssetIds.add(appBackgroundAssetId)
      }

      if (removeUnusedAssets) {
        const orphanAssetIds = currentAssets
          .filter(asset => asset.id != null && !referencedAssetIds.has(asset.id))
          .map(asset => asset.id!)
        if (orphanAssetIds.length) {
          await database.assets.bulkDelete(orphanAssetIds)
          report.removedAssets = orphanAssetIds.length
        }
      }
    },
  )

  return report
}

export async function getCleanupCandidates(
  database: SpeedtabDB = defaultDb,
): Promise<CleanupCandidates> {
  const candidates = emptyCandidates()

  const [
    pages,
    modules,
    collections,
    tabs,
    notes,
    feedSources,
    feedItems,
    savedFeedItems,
    assets,
    appSettings,
  ] = await Promise.all([
    database.pages.toArray(),
    database.modules.toArray(),
    database.collections.toArray(),
    database.tabs.toArray(),
    database.notes.toArray(),
    database.feed_sources.toArray(),
    database.feed_items.toArray(),
    database.saved_feed_items.toArray(),
    database.assets.toArray(),
    database.app_settings.toArray(),
  ])

  const pageIds = new Set(pages.map((page) => page.id!).filter((id): id is number => typeof id === 'number'))
  candidates.modules = modules.filter((module) => !pageIds.has(module.page_id))

  const moduleIds = new Set(modules.map((module) => module.id!).filter((id): id is number => typeof id === 'number'))
  candidates.collections = collections.filter((collection) => !moduleIds.has(collection.module_id))

  const collectionIds = new Set(collections.map((collection) => collection.id!).filter((id): id is number => typeof id === 'number'))
  candidates.tabs = tabs.filter((tab) => !collectionIds.has(tab.collection_id))
  candidates.notes = notes.filter((note) => !collectionIds.has(note.collection_id))
  candidates.feedSources = feedSources.filter((source) => !collectionIds.has(source.collection_id))
  candidates.savedFeedItems = savedFeedItems.filter((item) => !collectionIds.has(item.collection_id))

  const sourceIds = new Set(feedSources.map((source) => source.id!).filter((id): id is number => typeof id === 'number'))
  candidates.feedItems = feedItems.filter((item) => !sourceIds.has(item.feed_source_id))

  const referencedAssetIds = collectReferencedFaviconAssetIds(assets, tabs, notes, feedSources, feedItems)
  for (const note of notes) {
    if (note.type !== 'html') continue
    for (const assetId of extractNoteImageAssetIds(note.content)) {
      referencedAssetIds.add(assetId)
    }
  }
  for (const page of pages) {
    const pageBackgroundAssetId = getPageBackgroundAssetId(page.config_json)
    if (pageBackgroundAssetId != null) referencedAssetIds.add(pageBackgroundAssetId)
  }
  for (const setting of appSettings) {
    const appBackgroundAssetId = getAppBackgroundAssetId(setting.value_json)
    if (appBackgroundAssetId != null) referencedAssetIds.add(appBackgroundAssetId)
  }
  candidates.unusedAssets = assets.filter((asset) => asset.id != null && !referencedAssetIds.has(asset.id))

  return candidates
}
