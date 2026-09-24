import {db, isActiveRecord} from '../../db/db.ts'

async function hashCaptureItem(input) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(input)))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function createCaptureInboxItem(input) {
  const external_hash = await hashCaptureItem(input)
  const existing = await db.capture_inbox.where('external_hash').equals(external_hash).first()
  if (existing) return {created: false, count: await db.capture_inbox.count()}

  await db.capture_inbox.add({
    ...input,
    external_hash,
    created_at: Date.now(),
    meta_json: input.meta_json ?? null,
  })
  return {created: true, count: await db.capture_inbox.count()}
}

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
