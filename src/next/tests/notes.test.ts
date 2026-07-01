import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db as testDb } from '../../db/db'

vi.mock('../../db/db', async (importOriginal) => {
  const actual = (await importOriginal()) as any
  const { IDBFactory, IDBKeyRange } = await import('fake-indexeddb')
  const testDb = new actual.SpeedtabDB({ indexedDB: new IDBFactory(), IDBKeyRange })
  return {
    ...actual,
    db: testDb,
    isActiveRecord: (record: { deleted_at?: number | null } | null | undefined) =>
      record?.deleted_at == null,
    makeCreateMetadata: (now = Date.now()) => ({
      sync_id: crypto.randomUUID(),
      created_at: now,
      updated_at: now,
      deleted_at: null,
    }),
    makeUpdatedAtPatch: (now = Date.now()) => ({ updated_at: now }),
  }
})

import {
    createNoteData,
    loadNoteById,
    loadNoteBySyncId,
    loadNotesByCollectionId,
    loadNotesByIds,
    saveNoteData,
    softDeleteNote,
} from '../data/notes.js'

async function seedCollection() {
  return testDb.collections.add({
    module_id: 1,
    title: 'Test Collection',
    sort_order: 0,
    config_json: null,
    sync_id: crypto.randomUUID(),
    created_at: Date.now(),
    updated_at: Date.now(),
    deleted_at: null,
  })
}

beforeEach(async () => { await testDb.open() })
afterEach(async () => {
  await testDb.notes.clear()
  await testDb.collections.clear()
  await testDb.close()
})

describe('createNoteData', () => {
  it('creates a note with defaults', async () => {
    const collId = await seedCollection()
    const note = await createNoteData(collId, { title: 'My Note' })
    expect(note!.title).toBe('My Note')
    expect(note!.type).toBe('text')
    expect(note!.content).toBe('')
    expect(note!.collection_id).toBe(collId)
    expect(note!.sort_order).toBe(0)
    expect(typeof note!.sync_id).toBe('string')
    expect(note!.deleted_at).toBeNull()
  })

  it('stores explicit type, content and style_token', async () => {
    const collId = await seedCollection()
    const note = await createNoteData(collId, { title: 'N', type: 'checklist', content: '- [x] Done', style_token: 'bold' })
    expect(note!.type).toBe('checklist')
    expect(note!.content).toBe('- [x] Done')
    expect(note!.style_token).toBe('bold')
  })

  it('assigns sequential sort_order', async () => {
    const collId = await seedCollection()
    const n1 = await createNoteData(collId, { title: 'A' })
    const n2 = await createNoteData(collId, { title: 'B' })
    expect(n1!.sort_order).toBe(0)
    expect(n2!.sort_order).toBe(1)
  })

  it('returns null when collectionId is falsy', async () => {
    expect(await createNoteData(0)).toBeNull()
  })
})

describe('loadNotesByCollectionId', () => {
  it('returns only active notes ordered by sort_order', async () => {
    const collId = await seedCollection()
    const n1 = await createNoteData(collId, { title: 'Keep' })
    const n2 = await createNoteData(collId, { title: 'Del' })
    await softDeleteNote(n2!.id)

    const notes = await loadNotesByCollectionId(collId)
    expect(notes).toHaveLength(1)
    expect(notes[0].title).toBe('Keep')
  })

  it('returns empty array for falsy collectionId', async () => {
    expect(await loadNotesByCollectionId(null)).toEqual([])
  })
})

describe('loadNoteById / loadNoteBySyncId', () => {
  it('loads note by id', async () => {
    const collId = await seedCollection()
    const note = await createNoteData(collId, { title: 'ById' })
    expect((await loadNoteById(note!.id))!.title).toBe('ById')
  })

  it('returns undefined for unknown id', async () => {
    expect(await loadNoteById(99999)).toBeUndefined()
  })

  it('loads note by sync_id', async () => {
    const collId = await seedCollection()
    const note = await createNoteData(collId, { title: 'BySyncId' })
    expect((await loadNoteBySyncId(note!.sync_id))!.title).toBe('BySyncId')
  })
})

describe('loadNotesByIds', () => {
  it('loads multiple notes by their ids', async () => {
    const collId = await seedCollection()
    const n1 = await createNoteData(collId, { title: 'A' })
    const n2 = await createNoteData(collId, { title: 'B' })
    const results = await loadNotesByIds([n1!.id, n2!.id])
    expect(results).toHaveLength(2)
  })

  it('returns empty array for empty id list', async () => {
    expect(await loadNotesByIds([])).toEqual([])
  })

  it('filters out invalid ids (zero, negative, non-integer)', async () => {
    const collId = await seedCollection()
    const note = await createNoteData(collId, { title: 'Real' })
    const results = await loadNotesByIds([note!.id, 0, -5, 3.14 as any, 'abc' as any])
    expect(results.every((n) => n.id === note!.id)).toBe(true)
  })

  it('excludes soft-deleted notes', async () => {
    const collId = await seedCollection()
    const note = await createNoteData(collId, { title: 'Deleted' })
    await softDeleteNote(note!.id)
    const results = await loadNotesByIds([note!.id])
    expect(results).toHaveLength(0)
  })
})

describe('saveNoteData', () => {
  it('updates note fields and refreshes updated_at', async () => {
    const collId = await seedCollection()
    const note = await createNoteData(collId, { title: 'Old', content: 'x' })
    const oldTs = note!.updated_at
    await new Promise(r => setTimeout(r, 5))
    const updated = await saveNoteData(note!.id, { title: 'New', content: 'y' })
    expect(updated!.title).toBe('New')
    expect(updated!.content).toBe('y')
    expect(updated!.updated_at).toBeGreaterThan(oldTs)
  })
})

describe('softDeleteNote', () => {
  it('sets deleted_at on the note', async () => {
    const collId = await seedCollection()
    const note = await createNoteData(collId, { title: 'ToDelete' })
    await softDeleteNote(note!.id)
    const row = await testDb.notes.get(note!.id)
    expect(typeof row!.deleted_at).toBe('number')
  })

  it('excludes soft-deleted notes from loadNotesByCollectionId', async () => {
    const collId = await seedCollection()
    const note = await createNoteData(collId, { title: 'Removed' })
    await softDeleteNote(note!.id)
    expect(await loadNotesByCollectionId(collId)).toHaveLength(0)
  })
})
