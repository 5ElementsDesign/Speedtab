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
    createOrderedEntity,
    getNextSortOrder,
    loadEntityById,
    loadEntityBySyncId,
    softDeleteEntity,
    updateEntity,
} from '../data/ordered-entities.js'

beforeEach(async () => { await testDb.open() })
afterEach(async () => {
  await testDb.notes.clear()
  await testDb.close()
})

describe('getNextSortOrder', () => {
  it('returns 0 when the table is empty', async () => {
    expect(await getNextSortOrder(testDb.notes, 'collection_id', 99)).toBe(0)
  })

  it('returns count of active siblings', async () => {
    await testDb.notes.add({
      collection_id: 1, title: 'A', type: 'text', content: '',
      sort_order: 0, sync_id: crypto.randomUUID(),
      created_at: Date.now(), updated_at: Date.now(), deleted_at: null,
    })
    expect(await getNextSortOrder(testDb.notes, 'collection_id', 1)).toBe(1)
  })

  it('ignores soft-deleted siblings', async () => {
    await testDb.notes.add({
      collection_id: 2, title: 'Deleted', type: 'text', content: '',
      sort_order: 0, sync_id: crypto.randomUUID(),
      created_at: Date.now(), updated_at: Date.now(), deleted_at: Date.now(),
    })
    expect(await getNextSortOrder(testDb.notes, 'collection_id', 2)).toBe(0)
  })
})

describe('createOrderedEntity', () => {
  it('creates entity with auto sort_order and metadata', async () => {
    const entity = await createOrderedEntity(testDb.notes, 'collection_id', 10, {
      title: 'First', type: 'text', content: '',
    })
    expect(entity).toBeTruthy()
    expect(entity!.title).toBe('First')
    expect(entity!.sort_order).toBe(0)
    expect(typeof entity!.sync_id).toBe('string')
    expect(entity!.deleted_at).toBeNull()
  })

  it('assigns sequential sort_order for multiple entities', async () => {
    const a = await createOrderedEntity(testDb.notes, 'collection_id', 20, { title: 'A', type: 'text', content: '' })
    const b = await createOrderedEntity(testDb.notes, 'collection_id', 20, { title: 'B', type: 'text', content: '' })
    expect(a!.sort_order).toBe(0)
    expect(b!.sort_order).toBe(1)
  })

  it('respects explicit sort_order in payload', async () => {
    const entity = await createOrderedEntity(testDb.notes, 'collection_id', 30, {
      title: 'Pinned', type: 'text', content: '', sort_order: 99,
    })
    expect(entity!.sort_order).toBe(99)
  })
})

describe('updateEntity', () => {
  it('updates specified fields and refreshes updated_at', async () => {
    const entity = await createOrderedEntity(testDb.notes, 'collection_id', 40, {
      title: 'Original', type: 'text', content: '',
    })
    const originalUpdatedAt = entity!.updated_at

    await new Promise(r => setTimeout(r, 5)) // ensure timestamp advances
    const updated = await updateEntity(testDb.notes, entity!.id, { title: 'Changed' })

    expect(updated!.title).toBe('Changed')
    expect(updated!.updated_at).toBeGreaterThan(originalUpdatedAt)
  })

  it('returns null for falsy id', async () => {
    expect(await updateEntity(testDb.notes, 0, { title: 'Noop' })).toBeNull()
  })
})

describe('softDeleteEntity', () => {
  it('sets deleted_at on the record', async () => {
    const entity = await createOrderedEntity(testDb.notes, 'collection_id', 50, {
      title: 'ToDelete', type: 'text', content: '',
    })
    await softDeleteEntity(testDb.notes, entity!.id)
    const afterDelete = await testDb.notes.get(entity!.id)
    expect(typeof afterDelete!.deleted_at).toBe('number')
  })
})

describe('loadEntityById / loadEntityBySyncId', () => {
  it('loads an entity by numeric id', async () => {
    const entity = await createOrderedEntity(testDb.notes, 'collection_id', 60, {
      title: 'ById', type: 'text', content: '',
    })
    const loaded = await loadEntityById(testDb.notes, entity!.id)
    expect(loaded!.title).toBe('ById')
  })

  it('returns undefined for unknown id', async () => {
    expect(await loadEntityById(testDb.notes, 99999)).toBeUndefined()
  })

  it('loads an entity by sync_id', async () => {
    const entity = await createOrderedEntity(testDb.notes, 'collection_id', 70, {
      title: 'BySyncId', type: 'text', content: '',
    })
    const loaded = await loadEntityBySyncId(testDb.notes, entity!.sync_id)
    expect(loaded!.title).toBe('BySyncId')
  })

  it('returns undefined for unknown sync_id', async () => {
    expect(await loadEntityBySyncId(testDb.notes, 'nonexistent-uuid')).toBeUndefined()
  })
})
