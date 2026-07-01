import {isActiveRecord, makeCreateMetadata, makeUpdatedAtPatch} from '../../db/db.ts'

async function loadActiveSiblings(table, parentKey, parentId) {
  return table
    .where(parentKey)
    .equals(parentId)
    .filter(isActiveRecord)
    .sortBy('sort_order')
}

export async function getNextSortOrder(table, parentKey, parentId) {
  const siblings = await loadActiveSiblings(table, parentKey, parentId)
  return siblings.length ? (siblings.at(-1)?.sort_order ?? 0) + 1 : 0
}

export async function createOrderedEntity(table, parentKey, parentId, payload = {}) {
  const now = Date.now()
  const sortOrder = Number.isInteger(payload.sort_order)
    ? payload.sort_order
    : await getNextSortOrder(table, parentKey, parentId)

  const id = await table.add({
    ...payload,
    [parentKey]: parentId,
    sort_order: sortOrder,
    ...makeCreateMetadata(now),
  })

  return table.get(id)
}

export async function updateEntity(table, id, updates = {}) {
  if (!id) return null
  await table.update(id, {
    ...updates,
    ...makeUpdatedAtPatch(),
  })
  return table.get(id)
}

export async function softDeleteEntity(table, id) {
  if (!id) return
  await table.update(id, {
    deleted_at: Date.now(),
    ...makeUpdatedAtPatch(),
  })
}

export async function loadEntityBySyncId(table, syncId) {
  if (!syncId) return null
  return table.where('sync_id').equals(syncId).first()
}

export async function loadEntityById(table, id) {
  if (!id) return null
  return table.get(id)
}
