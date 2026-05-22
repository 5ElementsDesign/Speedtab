import { db as defaultDb, type SpeedtabDB } from '@/db/db'

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
): Promise<CleanupReport> {
  const report = emptyReport()

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

      const referencedAssetIds = new Set<number>()
      for (const tab of await database.tabs.toArray()) {
        if (tab.favicon_asset_id != null) referencedAssetIds.add(tab.favicon_asset_id)
        if (tab.preview_asset_id != null) referencedAssetIds.add(tab.preview_asset_id)
      }
      for (const page of await database.pages.toArray()) {
        const pageBackgroundAssetId = getPageBackgroundAssetId(page.config_json)
        if (pageBackgroundAssetId != null) referencedAssetIds.add(pageBackgroundAssetId)
      }
      for (const setting of await database.app_settings.toArray()) {
        const appBackgroundAssetId = getAppBackgroundAssetId(setting.value_json)
        if (appBackgroundAssetId != null) referencedAssetIds.add(appBackgroundAssetId)
      }

      const orphanAssetIds = (await database.assets.toArray())
        .filter(asset => asset.id != null && !referencedAssetIds.has(asset.id))
        .map(asset => asset.id!)
      if (orphanAssetIds.length) {
        await database.assets.bulkDelete(orphanAssetIds)
        report.removedAssets = orphanAssetIds.length
      }
    },
  )

  return report
}
