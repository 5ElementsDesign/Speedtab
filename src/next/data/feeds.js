import {db, isActiveRecord} from '../../db/db.ts'
import {createOrderedEntity, loadEntityById, loadEntityBySyncId, softDeleteEntity, updateEntity} from './ordered-entities.js'

export async function loadFeedSourcesByCollectionId(collectionId) {
  if (!collectionId) return []
  return db.feed_sources
    .where('collection_id')
    .equals(collectionId)
    .filter(isActiveRecord)
    .sortBy('sort_order')
}

export async function loadFeedSourceById(id) {
  return loadEntityById(db.feed_sources, id)
}

export async function loadFeedSourceBySyncId(syncId) {
  return loadEntityBySyncId(db.feed_sources, syncId)
}

export async function loadFeedItemsBySourceIds(sourceIds = []) {
  const ids = sourceIds
    .map((id) => parseInt(String(id), 10))
    .filter((id) => Number.isInteger(id) && id > 0)

  if (!ids.length) return []

  const items = await db.feed_items
    .where('feed_source_id')
    .anyOf(ids)
    .toArray()

  return items.sort((left, right) => {
    const leftDate = left.published_at ?? left.fetched_at ?? 0
    const rightDate = right.published_at ?? right.fetched_at ?? 0
    return rightDate - leftDate
  })
}

export async function clearFeedItemsBySourceIds(sourceIds = []) {
  const ids = sourceIds
    .map((id) => parseInt(String(id), 10))
    .filter((id) => Number.isInteger(id) && id > 0)

  if (!ids.length) return 0

  return db.transaction('rw', db.feed_items, async () => {
    const items = await db.feed_items
      .where('feed_source_id')
      .anyOf(ids)
      .primaryKeys()

    if (!items.length) return 0
    await db.feed_items.bulkDelete(items)
    return items.length
  })
}

export async function loadFeedItemById(id) {
  if (!id) return null
  return db.feed_items.get(id)
}

export async function loadSavedFeedItemsByCollectionId(collectionId) {
  if (!collectionId) return []
  return db.saved_feed_items
    .where('collection_id')
    .equals(collectionId)
    .filter(isActiveRecord)
    .sortBy('saved_at')
}

export async function createFeedSourceData(collectionId, payload = {}) {
  if (!collectionId) return null
  return createOrderedEntity(db.feed_sources, 'collection_id', collectionId, {
    title: payload.title ?? '',
    feed_url: payload.feed_url ?? '',
    site_url: payload.site_url ?? null,
    style_token: payload.style_token ?? null,
    last_hash: payload.last_hash ?? null,
    last_fetched_at: payload.last_fetched_at ?? null,
    last_error_at: payload.last_error_at ?? null,
    last_error_message: payload.last_error_message ?? null,
    fetch_options_json: payload.fetch_options_json ?? null,
  })
}

export async function saveFeedSourceData(id, updates = {}) {
  return updateEntity(db.feed_sources, id, updates)
}

export async function softDeleteFeedSource(id) {
  if (!id) return
  await db.transaction('rw', db.feed_sources, db.feed_items, async () => {
    await db.feed_items.where('feed_source_id').equals(id).delete()
    await softDeleteEntity(db.feed_sources, id)
  })
}

export async function createSavedFeedItemData(collectionId, payload = {}) {
  if (!collectionId) return null
  return createOrderedEntity(db.saved_feed_items, 'collection_id', collectionId, {
    title: payload.title ?? '',
    url: payload.url ?? null,
    source_title: payload.source_title ?? null,
    author: payload.author ?? null,
    published_at: payload.published_at ?? null,
    summary: payload.summary ?? null,
    content: payload.content ?? null,
    comment: payload.comment ?? null,
    saved_at: payload.saved_at ?? Date.now(),
    meta_json: payload.meta_json ?? null,
  })
}

export async function softDeleteSavedFeedItem(id) {
  return softDeleteEntity(db.saved_feed_items, id)
}
