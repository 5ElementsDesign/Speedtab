import {db, isActiveRecord} from '../../db/db.ts'
import {createOrderedEntity, loadEntityById, loadEntityBySyncId, softDeleteEntity, updateEntity} from './ordered-entities.js'

export async function loadBookmarksByTabId(tabId) {
  if (!tabId) return []
  return db.tabs
    .where('collection_id')
    .equals(tabId)
    .filter(isActiveRecord)
    .sortBy('sort_order')
}

export async function loadBookmarkBySyncId(syncId) {
  return loadEntityBySyncId(db.tabs, syncId)
}

export async function loadBookmarkById(id) {
  return loadEntityById(db.tabs, id)
}

export async function createBookmark(tabId, payload) {
  if (!tabId) return null
  return createOrderedEntity(db.tabs, 'collection_id', tabId, {
    title: payload.title,
    url: payload.url,
    description: payload.description ?? null,
    favicon_asset_id: payload.favicon_asset_id ?? null,
    preview_asset_id: payload.preview_asset_id ?? null,
    meta_json: payload.meta_json ?? null,
  })
}

export async function saveBookmarkData(id, updates) {
  return updateEntity(db.tabs, id, updates)
}

export async function softDeleteBookmark(id) {
  return softDeleteEntity(db.tabs, id)
}
