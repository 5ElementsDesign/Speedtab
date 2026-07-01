import {db, isActiveRecord} from '../../db/db.ts'
import {createOrderedEntity, loadEntityById, loadEntityBySyncId, softDeleteEntity, updateEntity} from './ordered-entities.js'

export async function loadNotesByCollectionId(collectionId) {
  if (!collectionId) return []
  return db.notes
    .where('collection_id')
    .equals(collectionId)
    .filter(isActiveRecord)
    .sortBy('sort_order')
}

export async function loadNoteBySyncId(syncId) {
  return loadEntityBySyncId(db.notes, syncId)
}

export async function loadNoteById(id) {
  return loadEntityById(db.notes, id)
}

export async function loadNotesByIds(ids = []) {
  const noteIds = ids
    .map((id) => parseInt(String(id), 10))
    .filter((id) => Number.isInteger(id) && id > 0)

  if (!noteIds.length) return []

  return db.notes
    .where('id')
    .anyOf(noteIds)
    .filter(isActiveRecord)
    .toArray()
}

export async function createNoteData(collectionId, payload = {}) {
  if (!collectionId) return null
  return createOrderedEntity(db.notes, 'collection_id', collectionId, {
    title: payload.title ?? '',
    type: payload.type ?? 'text',
    content: payload.content ?? '',
    style_token: payload.style_token ?? null,
    meta_json: payload.meta_json ?? null,
  })
}

export async function saveNoteData(id, updates = {}) {
  return updateEntity(db.notes, id, updates)
}

export async function softDeleteNote(id) {
  return softDeleteEntity(db.notes, id)
}
