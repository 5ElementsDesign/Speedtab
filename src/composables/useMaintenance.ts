import { db as defaultDb, isActiveRecord, type SpeedtabDB } from '@/db/db'
import { getFaviconHostnameCandidatesForUrl, parseFaviconMeta } from '@/next/utils/favicon.js'
import { extractLinkNoteUrls } from '@/composables/useNoteLinks'
import { extractNoteImageAssetIds } from '@/composables/useNoteImages'
import type { Asset, Collection, FeedItem, FeedSource, Module, Note, SavedFeedItem, Tab, Todo } from '@/types/db'

export interface CleanupReport {
  removedModules: number
  removedCollections: number
  removedTabs: number
  removedNotes: number
  removedTodos: number
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
  todos: Todo[]
  feedSources: FeedSource[]
  feedItems: FeedItem[]
  savedFeedItems: SavedFeedItem[]
  unusedAssets: Asset[]
}

export interface CleanupOptions {
  removeUnusedAssets?: boolean
}

const LOCAL_TOOLS_STATE_KEY = 'local_tools_state'

function emptyReport(): CleanupReport {
  return {
    removedModules: 0,
    removedCollections: 0,
    removedTabs: 0,
    removedNotes: 0,
    removedTodos: 0,
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
    todos: [],
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

function getAppBackgroundAssetId(key: string | null | undefined, valueJson: string | null | undefined): number | null {
  if (!valueJson) return null
  try {
    const parsed = JSON.parse(valueJson)
    if (key === 'background_asset_id' && typeof parsed === 'number') return parsed
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
    if (meta.hostnames.some((hostname: string) => referencedHosts.has(hostname))) {
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
    [database.collections, database.tabs, database.notes, database.todos, database.feed_sources, database.feed_items, database.saved_feed_items],
    async () => {
      const sourceIds = (await database.feed_sources.where('collection_id').equals(collectionId).primaryKeys()) as number[]
      if (sourceIds.length) {
        await database.feed_items.where('feed_source_id').anyOf(sourceIds).delete()
      }
      await database.saved_feed_items.where('collection_id').equals(collectionId).delete()
      await database.feed_sources.where('collection_id').equals(collectionId).delete()
      await database.tabs.where('collection_id').equals(collectionId).delete()
      await database.notes.where('collection_id').equals(collectionId).delete()
      await database.todos.where('collection_id').equals(collectionId).delete()
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
      database.notes, database.todos, database.feed_sources, database.feed_items, database.saved_feed_items,
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
        await database.todos.where('collection_id').anyOf(collectionIds).delete()
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
      database.notes, database.todos, database.feed_sources, database.feed_items, database.saved_feed_items,
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
          await database.todos.where('collection_id').anyOf(collectionIds).delete()
          await database.collections.where('module_id').anyOf(moduleIds).delete()
        }
        await database.modules.where('page_id').equals(pageId).delete()
      }
      await database.pages.delete(pageId)
    },
  )
}

export async function clearAuthoredWorkspace(
  database: SpeedtabDB = defaultDb,
): Promise<void> {
  await database.transaction(
    'rw',
    [
      database.pages,
      database.modules,
      database.collections,
      database.tabs,
      database.notes,
      database.todos,
      database.feed_sources,
      database.feed_items,
      database.saved_feed_items,
      database.next_ui_config,
      database.app_settings,
    ],
    async () => {
      await database.feed_items.clear()
      await database.saved_feed_items.clear()
      await database.feed_sources.clear()
      await database.tabs.clear()
      await database.notes.clear()
      await database.todos.clear()
      await database.collections.clear()
      await database.modules.clear()
      await database.pages.clear()
      await database.next_ui_config.clear()
      await database.app_settings.delete(LOCAL_TOOLS_STATE_KEY)
    },
  )
}

export async function cleanupOrphans(
  database: SpeedtabDB = defaultDb,
  options: CleanupOptions = {},
): Promise<CleanupReport> {
  const report = emptyReport()
  const removeUnusedAssets = options.removeUnusedAssets === true
  const candidates = await getCleanupCandidates(database)

  for (const module of candidates.modules) {
    if (module.id == null) continue
    await deleteModuleTree(module.id, database)
  }
  report.removedModules = candidates.modules.length

  for (const collection of candidates.collections) {
    if (collection.id == null) continue
    await deleteCollectionTree(collection.id, database)
  }
  report.removedCollections = candidates.collections.length

  const freshCandidates = await getCleanupCandidates(database)

  if (freshCandidates.tabs.length) {
    await database.tabs.bulkDelete(freshCandidates.tabs.map((row) => row.id!).filter(Boolean))
    report.removedTabs = freshCandidates.tabs.length
  }

  if (freshCandidates.notes.length) {
    await database.notes.bulkDelete(freshCandidates.notes.map((row) => row.id!).filter(Boolean))
    report.removedNotes = freshCandidates.notes.length
  }

  if (freshCandidates.todos.length) {
    await database.todos.bulkDelete(freshCandidates.todos.map((row) => row.id!).filter(Boolean))
    report.removedTodos = freshCandidates.todos.length
  }

  if (freshCandidates.feedSources.length) {
    for (const source of freshCandidates.feedSources) {
      if (source.id == null) continue
      await database.feed_items.where('feed_source_id').equals(source.id).delete()
      await database.feed_sources.delete(source.id)
    }
    report.removedFeedSources = freshCandidates.feedSources.length
  }

  const finalCandidates = await getCleanupCandidates(database)

  if (finalCandidates.feedItems.length) {
    await database.feed_items.bulkDelete(finalCandidates.feedItems.map((row) => row.id!).filter(Boolean))
    report.removedFeedItems = finalCandidates.feedItems.length
  }

  if (finalCandidates.savedFeedItems.length) {
    await database.saved_feed_items.bulkDelete(finalCandidates.savedFeedItems.map((row) => row.id!).filter(Boolean))
    report.removedSavedFeedItems = finalCandidates.savedFeedItems.length
  }

  if (removeUnusedAssets && finalCandidates.unusedAssets.length) {
    await database.assets.bulkDelete(finalCandidates.unusedAssets.map((asset) => asset.id!).filter(Boolean))
    report.removedAssets = finalCandidates.unusedAssets.length
  }

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
    todos,
    feedSources,
    feedItems,
    savedFeedItems,
    assets,
    appSettings,
  ] = await Promise.all([
    database.pages.filter(isActiveRecord).toArray(),
    database.modules.filter(isActiveRecord).toArray(),
    database.collections.filter(isActiveRecord).toArray(),
    database.tabs.filter(isActiveRecord).toArray(),
    database.notes.filter(isActiveRecord).toArray(),
    database.todos.filter(isActiveRecord).toArray(),
    database.feed_sources.filter(isActiveRecord).toArray(),
    database.feed_items.toArray(),
    database.saved_feed_items.filter(isActiveRecord).toArray(),
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
  candidates.todos = todos.filter((todo) => !collectionIds.has(todo.collection_id))
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
    const appBackgroundAssetId = getAppBackgroundAssetId(setting.key, setting.value_json)
    if (appBackgroundAssetId != null) referencedAssetIds.add(appBackgroundAssetId)
  }
  candidates.unusedAssets = assets.filter((asset) => asset.id != null && !referencedAssetIds.has(asset.id))

  return candidates
}
