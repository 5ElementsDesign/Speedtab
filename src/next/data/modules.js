import {db, isActiveRecord, makeCreateMetadata} from '../../db/db.ts'
import {moduleCreatesDefaultCollection} from '../config/module-types.js'

export async function loadModulesByPageId(pageId) {
  if (!pageId) return []

  return db.modules
    .where('page_id')
    .equals(pageId)
    .filter(isActiveRecord)
    .sortBy('sort_order')
}

export async function loadModuleBySyncId(syncId) {
  if (!syncId) return null
  return db.modules.where('sync_id').equals(syncId).first()
}

export async function createModuleData(pageId, payload = {}) {
  if (!pageId) return null

  const now = Date.now()

  return db.transaction('rw', db.modules, db.collections, async () => {
    const activeModules = await db.modules
      .where('page_id')
      .equals(pageId)
      .filter(isActiveRecord)
      .sortBy('sort_order')
    const requestedIndex = Number(payload.insertAt)
    const sortOrder = Number.isInteger(requestedIndex)
      ? Math.max(0, Math.min(activeModules.length, requestedIndex))
      : activeModules.length

    if (sortOrder < activeModules.length) {
      await db.modules.bulkPut(activeModules.map((module) => (
        module.sort_order >= sortOrder
          ? {...module, sort_order: module.sort_order + 1, updated_at: now}
          : module
      )))
    }

    const moduleId = await db.modules.add({
      page_id: pageId,
      type: payload.type ?? 'tabs',
      title: payload.title ?? 'Module',
      sort_order: sortOrder,
      config_json: payload.config_json ?? null,
      ...makeCreateMetadata(now),
    })

    if (moduleCreatesDefaultCollection(payload.type ?? 'tabs') && payload.createDefaultTab !== false) {
      await db.collections.add({
        module_id: moduleId,
        title: payload.defaultTabTitle ?? 'Tab 1',
        sort_order: 0,
        config_json: null,
        ...makeCreateMetadata(now),
      })
    }

    return db.modules.get(moduleId)
  })
}

export async function saveModuleData(id, updates) {
  if (!id) return
  await db.modules.update(id, {
    ...updates,
    updated_at: Date.now(),
  })
}

export async function softDeleteModule(id) {
  if (!id) return
  await db.modules.update(id, {
    updated_at: Date.now(),
    deleted_at: Date.now(),
  })
}
