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
    createModuleData,
    loadModuleBySyncId,
    loadModulesByPageId,
    saveModuleData,
    softDeleteModule,
} from '../data/modules.js'

// Helper: seed a page directly in the DB
async function seedPage() {
  return testDb.pages.add({
    slug: `page-${crypto.randomUUID()}`,
    title: 'Test Page',
    nav_group: 'main',
    is_home: 1,
    sort_order: 0,
    config_json: null,
    icon: null,
    sync_id: crypto.randomUUID(),
    created_at: Date.now(),
    updated_at: Date.now(),
    deleted_at: null,
  })
}

beforeEach(async () => { await testDb.open() })
afterEach(async () => {
  await testDb.modules.clear()
  await testDb.collections.clear()
  await testDb.pages.clear()
  await testDb.close()
})

describe('createModuleData', () => {
  it('creates a module with required fields', async () => {
    const pageId = await seedPage()
    const mod = await createModuleData(pageId, { type: 'tabs', title: 'Bookmarks' })

    expect(mod!.title).toBe('Bookmarks')
    expect(mod!.type).toBe('tabs')
    expect(mod!.page_id).toBe(pageId)
    expect(mod!.sort_order).toBe(0)
    expect(typeof mod!.sync_id).toBe('string')
    expect(mod!.deleted_at).toBeNull()
  })

  it('creates a default collection for "tabs" type', async () => {
    const pageId = await seedPage()
    const mod = await createModuleData(pageId, { type: 'tabs', title: 'Links' })
    const collections = await testDb.collections.where('module_id').equals(mod!.id).toArray()
    expect(collections).toHaveLength(1)
    expect(collections[0].title).toBe('Tab 1')
  })

  it('creates a default collection for "notes" type', async () => {
    const pageId = await seedPage()
    const mod = await createModuleData(pageId, { type: 'notes', title: 'Notes' })
    const collections = await testDb.collections.where('module_id').equals(mod!.id).toArray()
    expect(collections).toHaveLength(1)
  })

  it('creates a default collection for "speed-dial" type', async () => {
    const pageId = await seedPage()
    const mod = await createModuleData(pageId, {type: 'speed-dial', title: 'Start'})
    const collections = await testDb.collections.where('module_id').equals(mod!.id).toArray()
    expect(collections).toHaveLength(1)
  })

  it('skips default collection when createDefaultTab is false', async () => {
    const pageId = await seedPage()
    const mod = await createModuleData(pageId, { type: 'tabs', createDefaultTab: false })
    const collections = await testDb.collections.where('module_id').equals(mod!.id).toArray()
    expect(collections).toHaveLength(0)
  })

  it('uses custom defaultTabTitle when provided', async () => {
    const pageId = await seedPage()
    const mod = await createModuleData(pageId, { type: 'tabs', defaultTabTitle: 'Start' })
    const collections = await testDb.collections.where('module_id').equals(mod!.id).toArray()
    expect(collections[0].title).toBe('Start')
  })

  it('returns null for missing pageId', async () => {
    expect(await createModuleData(0, { type: 'tabs' })).toBeNull()
  })

  it('assigns sequential sort_order for multiple modules on the same page', async () => {
    const pageId = await seedPage()
    const m1 = await createModuleData(pageId, { type: 'tabs', title: 'M1' })
    const m2 = await createModuleData(pageId, { type: 'tabs', title: 'M2' })
    expect(m1!.sort_order).toBe(0)
    expect(m2!.sort_order).toBe(1)
  })

  it('inserts a module at the requested position and shifts later modules', async () => {
    const pageId = await seedPage()
    await createModuleData(pageId, {type: 'tabs', title: 'M1'})
    await createModuleData(pageId, {type: 'tabs', title: 'M2'})
    const inserted = await createModuleData(pageId, {type: 'tabs', title: 'Inserted', insertAt: 1})

    const modules = await loadModulesByPageId(pageId)
    expect(inserted!.sort_order).toBe(1)
    expect(modules.map((module) => module.title)).toEqual(['M1', 'Inserted', 'M2'])
    expect(modules.map((module) => module.sort_order)).toEqual([0, 1, 2])
  })
})

describe('loadModulesByPageId', () => {
  it('returns only active modules for the given page in sort order', async () => {
    const pageId = await seedPage()
    const m1 = await createModuleData(pageId, { type: 'tabs', title: 'M1' })
    const m2 = await createModuleData(pageId, { type: 'tabs', title: 'M2' })
    await softDeleteModule(m2!.id)

    const modules = await loadModulesByPageId(pageId)
    expect(modules).toHaveLength(1)
    expect(modules[0].title).toBe('M1')
  })

  it('returns empty array for unknown pageId', async () => {
    expect(await loadModulesByPageId(99999)).toEqual([])
  })

  it('returns empty array for null pageId', async () => {
    expect(await loadModulesByPageId(null)).toEqual([])
  })
})

describe('loadModuleBySyncId', () => {
  it('loads a module by its sync_id', async () => {
    const pageId = await seedPage()
    const mod = await createModuleData(pageId, { type: 'tabs', title: 'Findable' })
    const found = await loadModuleBySyncId(mod!.sync_id)
    expect(found!.title).toBe('Findable')
  })

  it('returns null for missing sync_id', async () => {
    expect(await loadModuleBySyncId(null)).toBeNull()
  })
})

describe('saveModuleData', () => {
  it('updates module title', async () => {
    const pageId = await seedPage()
    const mod = await createModuleData(pageId, { type: 'tabs', title: 'Old' })
    await saveModuleData(mod!.id, { title: 'New' })
    const updated = await testDb.modules.get(mod!.id)
    expect(updated!.title).toBe('New')
  })
})

describe('softDeleteModule', () => {
  it('sets deleted_at', async () => {
    const pageId = await seedPage()
    const mod = await createModuleData(pageId, { type: 'tabs', title: 'Del' })
    await softDeleteModule(mod!.id)
    const deleted = await testDb.modules.get(mod!.id)
    expect(typeof deleted!.deleted_at).toBe('number')
  })

  it('excludes soft-deleted modules from loadModulesByPageId', async () => {
    const pageId = await seedPage()
    const mod = await createModuleData(pageId, { type: 'tabs', title: 'Del' })
    await softDeleteModule(mod!.id)
    expect(await loadModulesByPageId(pageId)).toHaveLength(0)
  })
})
