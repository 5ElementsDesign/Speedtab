import {db, isActiveRecord} from '../../db/db.ts'
import {createOrderedEntity, loadEntityById, loadEntityBySyncId, softDeleteEntity, updateEntity} from './ordered-entities.js'

export async function loadTabsByModuleId(moduleId) {
  if (!moduleId) return []
  return db.collections
    .where('module_id')
    .equals(moduleId)
    .filter(isActiveRecord)
    .sortBy('sort_order')
}

export async function loadModuleTabBySyncId(syncId) {
  return loadEntityBySyncId(db.collections, syncId)
}

export async function loadModuleTabById(id) {
  return loadEntityById(db.collections, id)
}

export async function createModuleTab(moduleId, payload) {
  if (!moduleId) return null
  return createOrderedEntity(db.collections, 'module_id', moduleId, {
    title: payload.title,
    config_json: payload.config_json ?? null,
  })
}

export async function saveModuleTabData(id, updates) {
  return updateEntity(db.collections, id, updates)
}

export async function softDeleteModuleTab(id) {
  return softDeleteEntity(db.collections, id)
}
