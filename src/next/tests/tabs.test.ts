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
    createModuleTab,
    loadModuleTabById,
    loadModuleTabBySyncId,
    loadTabsByModuleId,
    saveModuleTabData,
    softDeleteModuleTab,
} from '../data/tabs.js'

// Helper: seed a module id directly in the DB
async function seedModule() {
  return testDb.modules.add({
    page_id: 1,
    title: 'Test Module',
    type: 'tabs',
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
  await testDb.collections.clear()
  await testDb.modules.clear()
  await testDb.close()
})

describe('createModuleTab', () => {
  it('creates a tab with the given title and module id', async () => {
    const moduleId = await seedModule()
    const tab = await createModuleTab(moduleId, { title: 'Favourites' })
    expect(tab!.title).toBe('Favourites')
    expect(tab!.module_id).toBe(moduleId)
    expect(tab!.sort_order).toBe(0)
    expect(typeof tab!.sync_id).toBe('string')
    expect(tab!.deleted_at).toBeNull()
  })

  it('assigns sequential sort_order for multiple tabs in a module', async () => {
    const moduleId = await seedModule()
    const t1 = await createModuleTab(moduleId, { title: 'T1' })
    const t2 = await createModuleTab(moduleId, { title: 'T2' })
    expect(t1!.sort_order).toBe(0)
    expect(t2!.sort_order).toBe(1)
  })

  it('returns null when moduleId is falsy', async () => {
    expect(await createModuleTab(0, { title: 'X' })).toBeNull()
  })
})

describe('loadTabsByModuleId', () => {
  it('returns only active tabs for the module, ordered by sort_order', async () => {
    const moduleId = await seedModule()
    const t1 = await createModuleTab(moduleId, { title: 'Keep' })
    const t2 = await createModuleTab(moduleId, { title: 'Delete' })
    await softDeleteModuleTab(t2!.id)

    const tabs = await loadTabsByModuleId(moduleId)
    expect(tabs).toHaveLength(1)
    expect(tabs[0].title).toBe('Keep')
  })

  it('returns empty array for falsy moduleId', async () => {
    expect(await loadTabsByModuleId(null)).toEqual([])
  })
})

describe('loadModuleTabById / loadModuleTabBySyncId', () => {
  it('loads a tab by id', async () => {
    const moduleId = await seedModule()
    const tab = await createModuleTab(moduleId, { title: 'ById' })
    const found = await loadModuleTabById(tab!.id)
    expect(found!.title).toBe('ById')
  })

  it('returns undefined for missing id', async () => {
    expect(await loadModuleTabById(99999)).toBeUndefined()
  })

  it('loads a tab by sync_id', async () => {
    const moduleId = await seedModule()
    const tab = await createModuleTab(moduleId, { title: 'BySyncId' })
    const found = await loadModuleTabBySyncId(tab!.sync_id)
    expect(found!.title).toBe('BySyncId')
  })

  it('returns undefined for unknown sync_id', async () => {
    expect(await loadModuleTabBySyncId('no-such-sync-id')).toBeUndefined()
  })
})

describe('saveModuleTabData', () => {
  it('updates the tab title and refreshes updated_at', async () => {
    const moduleId = await seedModule()
    const tab = await createModuleTab(moduleId, { title: 'Old' })
    const oldUpdatedAt = tab!.updated_at
    await new Promise(r => setTimeout(r, 5))
    const updated = await saveModuleTabData(tab!.id, { title: 'New' })
    expect(updated!.title).toBe('New')
    expect(updated!.updated_at).toBeGreaterThan(oldUpdatedAt)
  })
})

describe('softDeleteModuleTab', () => {
  it('sets deleted_at on the tab', async () => {
    const moduleId = await seedModule()
    const tab = await createModuleTab(moduleId, { title: 'ToDelete' })
    await softDeleteModuleTab(tab!.id)
    const deleted = await testDb.collections.get(tab!.id)
    expect(typeof deleted!.deleted_at).toBe('number')
  })

  it('soft-deleted tab no longer appears in loadTabsByModuleId', async () => {
    const moduleId = await seedModule()
    const tab = await createModuleTab(moduleId, { title: 'Removed' })
    await softDeleteModuleTab(tab!.id)
    expect(await loadTabsByModuleId(moduleId)).toHaveLength(0)
  })
})
