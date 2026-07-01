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
    createPageData,
    getHashPageSlug,
    loadPages,
    resolveActivePage,
    savePageData,
    softDeletePage,
} from '../data/pages.js'

beforeEach(async () => { await testDb.open() })
afterEach(async () => {
  await testDb.pages.clear()
  await testDb.close()
})

describe('createPageData', () => {
  it('creates first page as home with auto slug', async () => {
    const page = await createPageData({ title: 'My Page' })
    expect(page!.title).toBe('My Page')
    expect(page!.slug).toBe('my-page')
    expect(page!.is_home).toBe(1)
    expect(page!.deleted_at).toBeNull()
    expect(typeof page!.sync_id).toBe('string')
  })

  it('second page is NOT home by default', async () => {
    await createPageData({ title: 'Home' })
    const second = await createPageData({ title: 'About' })
    expect(second!.is_home).toBe(0)
  })

  it('setting is_home clears previous home page', async () => {
    const first = await createPageData({ title: 'First' })
    await createPageData({ title: 'Second', is_home: 1 })
    const updatedFirst = await testDb.pages.get(first!.id)
    expect(updatedFirst!.is_home).toBe(0)
  })

  it('generates unique slugs for duplicate titles', async () => {
    const a = await createPageData({ title: 'Work' })
    const b = await createPageData({ title: 'Work' })
    expect(a!.slug).toBe('work')
    expect(b!.slug).toBe('work-2')
  })

  it('uses provided slug when specified', async () => {
    const page = await createPageData({ title: 'Ignored', slug: 'custom-slug' })
    expect(page!.slug).toBe('custom-slug')
  })

  it('falls back to "page" for blank title', async () => {
    const page = await createPageData({ title: '   ' })
    expect(page!.slug).toMatch(/^page/)
    expect(page!.title).toBe('Page')
  })
})

describe('loadPages', () => {
  it('returns only active pages ordered by sort_order', async () => {
    await createPageData({ title: 'Alpha' })
    const beta = await createPageData({ title: 'Beta' })
    await softDeletePage(beta!.id)

    const pages = await loadPages()
    expect(pages).toHaveLength(1)
    expect(pages[0].title).toBe('Alpha')
  })

  it('returns empty array when no active pages', async () => {
    expect(await loadPages()).toEqual([])
  })
})

describe('savePageData', () => {
  it('updates title and other fields', async () => {
    const page = await createPageData({ title: 'Old Title' })
    await savePageData(page!.id, { title: 'New Title', icon: 'star' })
    const updated = await testDb.pages.get(page!.id)
    expect(updated!.title).toBe('New Title')
    expect(updated!.icon).toBe('star')
  })

  it('clears previous home when setting is_home=1', async () => {
    const p1 = await createPageData({ title: 'P1' })
    const p2 = await createPageData({ title: 'P2' })
    await savePageData(p2!.id, { is_home: 1 })
    expect((await testDb.pages.get(p1!.id))!.is_home).toBe(0)
    expect((await testDb.pages.get(p2!.id))!.is_home).toBe(1)
  })
})

describe('softDeletePage', () => {
  it('sets deleted_at on the page', async () => {
    const page = await createPageData({ title: 'Gone' })
    await softDeletePage(page!.id)
    const deleted = await testDb.pages.get(page!.id)
    expect(typeof deleted!.deleted_at).toBe('number')
  })

  it('soft-deleted page is excluded from loadPages', async () => {
    const page = await createPageData({ title: 'ToRemove' })
    await softDeletePage(page!.id)
    expect(await loadPages()).toHaveLength(0)
  })
})

describe('resolveActivePage', () => {
  it('returns null for empty page list', () => {
    expect(resolveActivePage([], null)).toBeNull()
  })

  it('returns page matching the given slug', () => {
    const pages = [
      { slug: 'home', is_home: 1 },
      { slug: 'about', is_home: 0 },
    ] as any[]
    expect(resolveActivePage(pages, 'about').slug).toBe('about')
  })

  it('falls back to home page when slug not found', () => {
    const pages = [
      { slug: 'alpha', is_home: 0 },
      { slug: 'beta', is_home: 1 },
    ] as any[]
    expect(resolveActivePage(pages, 'missing').slug).toBe('beta')
  })

  it('falls back to first page when no home and slug not found', () => {
    const pages = [
      { slug: 'first', is_home: 0 },
      { slug: 'second', is_home: 0 },
    ] as any[]
    expect(resolveActivePage(pages, null).slug).toBe('first')
  })
})

describe('getHashPageSlug', () => {
  it('returns null when location has no hash', () => {
    Object.defineProperty(window, 'location', {
      value: { hash: '' },
      configurable: true,
    })
    expect(getHashPageSlug()).toBeNull()
  })

  it('returns the pages param from the hash', () => {
    Object.defineProperty(window, 'location', {
      value: { hash: '#pages=my-page&other=x' },
      configurable: true,
    })
    expect(getHashPageSlug()).toBe('my-page')
  })
})
