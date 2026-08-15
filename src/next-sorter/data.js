import {db, isActiveRecord, makeUpdatedAtPatch} from '../db/db.ts'
import {loadUiConfigsByEntitySyncIds, upsertUiConfig} from '../next/data/ui-config.js'
import {softDeleteBookmark} from '../next/data/bookmarks.js'
import {clearFeedItemsBySourceIds, softDeleteFeedSource} from '../next/data/feeds.js'
import {softDeleteNote} from '../next/data/notes.js'
import {softDeleteModuleTab} from '../next/data/tabs.js'

function clampColumnSpan(value) {
  const parsed = parseInt(value, 10)
  if (!Number.isInteger(parsed)) return 12
  return Math.max(1, Math.min(12, parsed))
}

function sortByOrder(left, right) {
  return (left?.sort_order ?? 0) - (right?.sort_order ?? 0)
}

function buildTabsByModule(modules, tabs) {
  const tabsByModuleId = new Map()

  modules.forEach((module) => {
    tabsByModuleId.set(module.id, [])
  })

  tabs
    .slice()
    .sort(sortByOrder)
    .forEach((tab) => {
      if (!tabsByModuleId.has(tab.module_id)) return
      tabsByModuleId.get(tab.module_id).push({
        id: tab.id,
        syncId: tab.sync_id,
        moduleId: tab.module_id,
        title: tab.title,
        sortOrder: tab.sort_order ?? 0,
      })
    })

  return tabsByModuleId
}

function buildModulesByPage(modules, uiConfigMap, tabsByModuleId) {
  const modulesByPageId = new Map()

  modules
    .slice()
    .sort(sortByOrder)
    .forEach((module) => {
      const effectiveConfig = uiConfigMap.get(module.sync_id)
      const columnSpan = clampColumnSpan(effectiveConfig?.layout?.['module-column-span'] ?? 12)
      const pageModules = modulesByPageId.get(module.page_id) ?? []

      pageModules.push({
        id: module.id,
        syncId: module.sync_id,
        type: module.type,
        title: module.title,
        sortOrder: module.sort_order ?? 0,
        pageId: module.page_id,
        columnSpan,
        tabs: tabsByModuleId.get(module.id) ?? [],
      })

      modulesByPageId.set(module.page_id, pageModules)
    })

  return modulesByPageId
}

function getCollectionContentTable(moduleType) {
  if (moduleType === 'tabs' || moduleType === 'speed-dial') return db.tabs
  if (moduleType === 'notes') return db.notes
  if (moduleType === 'feeds') return db.feed_sources
  return null
}

function mapCollectionContentRecord(moduleType, record) {
  if (!record) return null

  if (moduleType === 'tabs' || moduleType === 'speed-dial') {
    return {
      id: record.id,
      syncId: record.sync_id,
      collectionId: record.collection_id,
      title: record.title || record.url || 'Bookmark',
      subtitle: record.url || '',
      sortOrder: record.sort_order ?? 0,
    }
  }

  if (moduleType === 'notes') {
    return {
      id: record.id,
      syncId: record.sync_id,
      collectionId: record.collection_id,
      title: record.title || 'Note',
      subtitle: record.type || '',
      sortOrder: record.sort_order ?? 0,
    }
  }

  if (moduleType === 'feeds') {
    return {
      id: record.id,
      syncId: record.sync_id,
      collectionId: record.collection_id,
      title: record.title || record.feed_url || 'Feed',
      subtitle: record.feed_url || '',
      sortOrder: record.sort_order ?? 0,
    }
  }

  return null
}

export async function buildSorterState() {
  const [pages, modules, tabs] = await Promise.all([
    db.pages.orderBy('sort_order').filter(isActiveRecord).toArray(),
    db.modules.filter(isActiveRecord).toArray(),
    db.collections.filter(isActiveRecord).toArray(),
  ])

  const uiConfigMap = await loadUiConfigsByEntitySyncIds('module', modules)
  const tabsByModuleId = buildTabsByModule(modules, tabs)
  const modulesByPageId = buildModulesByPage(modules, uiConfigMap, tabsByModuleId)

  return pages
    .slice()
    .sort(sortByOrder)
    .map((page) => ({
      id: page.id,
      syncId: page.sync_id,
      title: page.title,
      slug: page.slug,
      navGroup: page.nav_group,
      sortOrder: page.sort_order ?? 0,
      modules: modulesByPageId.get(page.id) ?? [],
    }))
}

export async function updateModuleTitle(moduleId, title) {
  if (!moduleId) return null
  const nextTitle = String(title ?? '').trim() || 'Module'
  await db.modules.update(moduleId, {
    title: nextTitle,
    ...makeUpdatedAtPatch(),
  })
  return nextTitle
}

export async function updateModuleTabTitle(tabId, title) {
  if (!tabId) return null
  const nextTitle = String(title ?? '').trim() || 'New Tab'
  await db.collections.update(tabId, {
    title: nextTitle,
    ...makeUpdatedAtPatch(),
  })
  return nextTitle
}

export async function updateCollectionContentTitle(moduleType, contentId, title) {
  const table = getCollectionContentTable(moduleType)
  if (!table || !contentId) return null
  const nextTitle = String(title ?? '').trim() || 'Untitled'
  await table.update(contentId, {
    title: nextTitle,
    ...makeUpdatedAtPatch(),
  })
  return nextTitle
}

export async function softDeleteCollectionContent(moduleType, contentId) {
  if (!contentId) return
  if (moduleType === 'tabs') return softDeleteBookmark(contentId)
  if (moduleType === 'notes') return softDeleteNote(contentId)
  if (moduleType === 'feeds') return softDeleteFeedSource(contentId)
}

export async function softDeleteModuleTabCascade(tabId, moduleType) {
  if (!tabId) return

  await db.transaction('rw', db.collections, db.tabs, db.notes, db.feed_sources, db.feed_items, async () => {
    if (moduleType === 'tabs') {
      const rows = await loadActiveCollectionContents('tabs', tabId)
      await Promise.all(rows.map((row) => softDeleteBookmark(row.id)))
    } else if (moduleType === 'notes') {
      const rows = await loadActiveCollectionContents('notes', tabId)
      await Promise.all(rows.map((row) => softDeleteNote(row.id)))
    } else if (moduleType === 'feeds') {
      const rows = await loadActiveCollectionContents('feeds', tabId)
      const sourceIds = rows.map((row) => row.id).filter(Boolean)
      await clearFeedItemsBySourceIds(sourceIds)
      await Promise.all(rows.map((row) => softDeleteFeedSource(row.id)))
    }

    await softDeleteModuleTab(tabId)
  })
}

export async function updateModuleColumnSpan(module, columnSpan) {
  if (!module?.syncId || !module?.type) return clampColumnSpan(columnSpan)
  const nextSpan = clampColumnSpan(columnSpan)
  await upsertUiConfig({
    entityType: 'module',
    entitySubtype: module.type,
    entitySyncId: module.syncId,
    patch: {
      layout: {
        'module-column-span': nextSpan,
      },
    },
  })
  return nextSpan
}

async function loadActiveModulesForPage(pageId) {
  return db.modules
    .where('page_id')
    .equals(pageId)
    .filter(isActiveRecord)
    .sortBy('sort_order')
}

async function loadActiveModuleTabs(moduleId) {
  return db.collections
    .where('module_id')
    .equals(moduleId)
    .filter(isActiveRecord)
    .sortBy('sort_order')
}

async function loadActiveCollectionContents(moduleType, collectionId) {
  const table = getCollectionContentTable(moduleType)
  if (!table || !collectionId) return []

  return table
    .where('collection_id')
    .equals(collectionId)
    .filter(isActiveRecord)
    .sortBy('sort_order')
}

export async function moveModule(moduleId, targetPageId, targetIndex) {
  if (!moduleId || !targetPageId) return

  await db.transaction('rw', db.modules, async () => {
    const moving = await db.modules.get(moduleId)
    if (!isActiveRecord(moving)) return

    const sourcePageId = moving.page_id
    const now = Date.now()

    const sourceModules = await loadActiveModulesForPage(sourcePageId)
    const targetModules = sourcePageId === targetPageId
      ? sourceModules.slice()
      : await loadActiveModulesForPage(targetPageId)

    const sourceRemaining = sourceModules.filter((module) => module.id !== moduleId)
    const targetWithoutMoving = targetModules.filter((module) => module.id !== moduleId)
    const insertionIndex = Math.max(0, Math.min(targetIndex, targetWithoutMoving.length))

    if (sourcePageId === targetPageId) {
      targetWithoutMoving.splice(insertionIndex, 0, moving)
      await Promise.all(targetWithoutMoving.map((module, index) => db.modules.update(module.id, {
        page_id: targetPageId,
        sort_order: index,
        updated_at: now,
      })))
      return
    }

    targetWithoutMoving.splice(insertionIndex, 0, moving)

    await Promise.all(sourceRemaining.map((module, index) => db.modules.update(module.id, {
      sort_order: index,
      updated_at: now,
    })))

    await Promise.all(targetWithoutMoving.map((module, index) => db.modules.update(module.id, {
      page_id: targetPageId,
      sort_order: index,
      updated_at: now,
    })))
  })
}

export async function moveModuleTab(tabId, targetModuleId, targetIndex) {
  if (!tabId || !targetModuleId) return

  await db.transaction('rw', db.collections, async () => {
    const moving = await db.collections.get(tabId)
    if (!isActiveRecord(moving)) return

    const sourceModuleId = moving.module_id
    const now = Date.now()

    const sourceTabs = await loadActiveModuleTabs(sourceModuleId)
    const targetTabs = sourceModuleId === targetModuleId
      ? sourceTabs.slice()
      : await loadActiveModuleTabs(targetModuleId)

    const sourceRemaining = sourceTabs.filter((tab) => tab.id !== tabId)
    const targetWithoutMoving = targetTabs.filter((tab) => tab.id !== tabId)
    const insertionIndex = Math.max(0, Math.min(targetIndex, targetWithoutMoving.length))

    if (sourceModuleId === targetModuleId) {
      targetWithoutMoving.splice(insertionIndex, 0, moving)
      await Promise.all(targetWithoutMoving.map((tab, index) => db.collections.update(tab.id, {
        module_id: targetModuleId,
        sort_order: index,
        updated_at: now,
      })))
      return
    }

    targetWithoutMoving.splice(insertionIndex, 0, moving)

    await Promise.all(sourceRemaining.map((tab, index) => db.collections.update(tab.id, {
      sort_order: index,
      updated_at: now,
    })))

    await Promise.all(targetWithoutMoving.map((tab, index) => db.collections.update(tab.id, {
      module_id: targetModuleId,
      sort_order: index,
      updated_at: now,
    })))
  })
}

export async function loadModuleContentsForSorter(moduleType, collections = []) {
  if (!moduleType || !collections.length) return new Map()

  const entries = await Promise.all(collections.map(async (collection) => {
    const rows = await loadActiveCollectionContents(moduleType, collection.id)
    return [
      collection.syncId,
      rows.map((row) => mapCollectionContentRecord(moduleType, row)).filter(Boolean),
    ]
  }))

  return new Map(entries)
}

export async function moveCollectionContent(moduleType, contentId, targetCollectionId, targetIndex) {
  const table = getCollectionContentTable(moduleType)
  if (!table || !contentId || !targetCollectionId) return

  await db.transaction('rw', table, async () => {
    const moving = await table.get(contentId)
    if (!isActiveRecord(moving)) return

    const sourceCollectionId = moving.collection_id
    const now = Date.now()

    const sourceItems = await loadActiveCollectionContents(moduleType, sourceCollectionId)
    const targetItems = sourceCollectionId === targetCollectionId
      ? sourceItems.slice()
      : await loadActiveCollectionContents(moduleType, targetCollectionId)

    const sourceRemaining = sourceItems.filter((item) => item.id !== contentId)
    const targetWithoutMoving = targetItems.filter((item) => item.id !== contentId)
    const insertionIndex = Math.max(0, Math.min(targetIndex, targetWithoutMoving.length))

    if (sourceCollectionId === targetCollectionId) {
      targetWithoutMoving.splice(insertionIndex, 0, moving)
      await Promise.all(targetWithoutMoving.map((item, index) => table.update(item.id, {
        collection_id: targetCollectionId,
        sort_order: index,
        updated_at: now,
      })))
      return
    }

    targetWithoutMoving.splice(insertionIndex, 0, moving)

    await Promise.all(sourceRemaining.map((item, index) => table.update(item.id, {
      sort_order: index,
      updated_at: now,
    })))

    await Promise.all(targetWithoutMoving.map((item, index) => table.update(item.id, {
      collection_id: targetCollectionId,
      sort_order: index,
      updated_at: now,
    })))
  })
}

export async function movePage(pageId, targetIndex) {
  if (!pageId || targetIndex < 0) return

  await db.transaction('rw', db.pages, async () => {
    const moving = await db.pages.get(pageId)
    if (!isActiveRecord(moving)) return

    const pages = await db.pages.orderBy('sort_order').filter(isActiveRecord).toArray()
    const withoutMoving = pages.filter((page) => page.id !== pageId)
    const insertionIndex = Math.max(0, Math.min(targetIndex, withoutMoving.length))
    withoutMoving.splice(insertionIndex, 0, moving)

    const now = Date.now()
    await Promise.all(withoutMoving.map((page, index) => db.pages.update(page.id, {
      sort_order: index,
      updated_at: now,
    })))
  })
}
