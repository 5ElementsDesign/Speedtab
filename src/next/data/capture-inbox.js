import {db, isActiveRecord} from '../../db/db.ts'

export async function loadCaptureInboxItems() {
  return db.capture_inbox.orderBy('created_at').reverse().toArray()
}

export async function loadCaptureInboxCount() {
  return db.capture_inbox.count()
}

export async function deleteCaptureInboxItem(id) {
  if (!id) return
  await db.capture_inbox.delete(Number(id))
}

export async function loadCaptureInboxContext() {
  const [pages, modules, collections, notes] = await Promise.all([
    db.pages.filter(isActiveRecord).sortBy('sort_order'),
    db.modules.filter(isActiveRecord).sortBy('sort_order'),
    db.collections.filter(isActiveRecord).sortBy('sort_order'),
    db.notes.filter(isActiveRecord).sortBy('sort_order'),
  ])

  return {pages, modules, collections, notes}
}
