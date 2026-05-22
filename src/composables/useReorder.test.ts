/**
 * useReorder – unit tests
 *
 * Tests cover:
 *  • computeReorder (pure helper) – boundary cases, minimal update set
 *  • useReorder.move()            – persists reorder via Dexie
 *  • useReorder.moveUp/moveDown   – legacy swap helpers
 *
 * Each test uses its own fake-indexeddb instance for full isolation.
 */
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { ref }                     from 'vue'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { makeCreateMetadata, SpeedtabDB }    from '@/db/db'
import { computeReorder, useReorder } from './useReorder'

// ─── computeReorder (pure) ────────────────────────────────────────────────────

describe('computeReorder', () => {
  const items = [
    { id: 1, sort_order: 0 },
    { id: 2, sort_order: 1 },
    { id: 3, sort_order: 2 },
    { id: 4, sort_order: 3 },
  ]

  it('returns empty array when fromIndex === toIndex', () => {
    expect(computeReorder(items, 2, 2)).toEqual([])
  })

  it('returns empty array for out-of-bounds indices', () => {
    expect(computeReorder(items, -1, 2)).toEqual([])
    expect(computeReorder(items, 0, 10)).toEqual([])
  })

  it('returns empty array for empty list', () => {
    expect(computeReorder([], 0, 1)).toEqual([])
  })

  it('moves first item to last (0 → 3)', () => {
    const updates = computeReorder(items, 0, 3)
    // Item 1 should go to position 3; others shift left
    const map = Object.fromEntries(updates.map(u => [u.id, u.sort_order]))
    expect(map[1]).toBe(3)
    expect(map[2]).toBe(0)
    expect(map[3]).toBe(1)
    expect(map[4]).toBe(2)
  })

  it('moves last item to first (3 → 0)', () => {
    const updates = computeReorder(items, 3, 0)
    const map = Object.fromEntries(updates.map(u => [u.id, u.sort_order]))
    expect(map[4]).toBe(0)
    expect(map[1]).toBe(1)
    expect(map[2]).toBe(2)
    expect(map[3]).toBe(3)
  })

  it('produces a minimal update set for an adjacent swap (0 → 1)', () => {
    const updates = computeReorder(items, 0, 1)
    // Only items 1 and 2 need updating – items 3 and 4 stay in place.
    expect(updates).toHaveLength(2)
    const ids = updates.map(u => u.id).sort()
    expect(ids).toEqual([1, 2])
  })

  it('skips items without an id', () => {
    const sparse = [
      { id: 1, sort_order: 0 },
      { sort_order: 1 },           // no id
      { id: 3, sort_order: 2 },
    ]
    // Should not throw and should not include the id-less item
    const updates = computeReorder(sparse, 0, 2)
    expect(updates.every(u => u.id !== undefined)).toBe(true)
  })
})

// ─── useReorder (composable) ──────────────────────────────────────────────────

let db: SpeedtabDB

function withMeta<T extends object>(data: T) {
  return { ...makeCreateMetadata(1_700_000_000_000), ...data }
}

beforeEach(async () => {
  db = new SpeedtabDB({ indexedDB: new IDBFactory(), IDBKeyRange })
  await db.open()
})

afterEach(async () => {
  await db.delete()
})

/** Seed three notes into the test DB and return them sorted by sort_order. */
async function seedNotes(collectionId: number) {
  await db.notes.bulkAdd([
    withMeta({ collection_id: collectionId, title: 'A', type: 'text' as const, content: '', style_token: null, sort_order: 0, meta_json: null }),
    withMeta({ collection_id: collectionId, title: 'B', type: 'text' as const, content: '', style_token: null, sort_order: 1, meta_json: null }),
    withMeta({ collection_id: collectionId, title: 'C', type: 'text' as const, content: '', style_token: null, sort_order: 2, meta_json: null }),
  ])
  return db.notes.where('collection_id').equals(collectionId).sortBy('sort_order')
}

describe('useReorder.move', () => {
  it('persists a drag-and-drop reorder to Dexie', async () => {
    const notes    = await seedNotes(1)
    const itemsRef = ref(notes)
    const { move } = useReorder(db.notes, itemsRef)

    // Move item 'A' (index 0) to the end (index 2)
    await move(0, 2)

    const updated = await db.notes.where('collection_id').equals(1).sortBy('sort_order')
    expect(updated.map(n => n.title)).toEqual(['B', 'C', 'A'])
  })

  it('is a no-op when fromIndex === toIndex', async () => {
    const notes    = await seedNotes(2)
    const itemsRef = ref(notes)
    const { move } = useReorder(db.notes, itemsRef)

    await move(1, 1)

    const updated = await db.notes.where('collection_id').equals(2).sortBy('sort_order')
    expect(updated.map(n => n.title)).toEqual(['A', 'B', 'C'])
  })
})

describe('useReorder.moveUp / moveDown', () => {
  it('swaps a note with its predecessor', async () => {
    const notes    = await seedNotes(3)
    const itemsRef = ref(notes)
    const { moveUp } = useReorder(db.notes, itemsRef)

    await moveUp(notes[1])  // 'B' moves before 'A'

    const updated = await db.notes.where('collection_id').equals(3).sortBy('sort_order')
    expect(updated.map(n => n.title)).toEqual(['B', 'A', 'C'])
  })

  it('swaps a note with its successor', async () => {
    const notes    = await seedNotes(4)
    const itemsRef = ref(notes)
    const { moveDown } = useReorder(db.notes, itemsRef)

    await moveDown(notes[1])  // 'B' moves after 'C'

    const updated = await db.notes.where('collection_id').equals(4).sortBy('sort_order')
    expect(updated.map(n => n.title)).toEqual(['A', 'C', 'B'])
  })

  it('is a no-op when moving the first item up', async () => {
    const notes    = await seedNotes(5)
    const itemsRef = ref(notes)
    const { moveUp } = useReorder(db.notes, itemsRef)

    await moveUp(notes[0])

    const updated = await db.notes.where('collection_id').equals(5).sortBy('sort_order')
    expect(updated.map(n => n.title)).toEqual(['A', 'B', 'C'])
  })

  it('is a no-op when moving the last item down', async () => {
    const notes    = await seedNotes(6)
    const itemsRef = ref(notes)
    const { moveDown } = useReorder(db.notes, itemsRef)

    await moveDown(notes[2])

    const updated = await db.notes.where('collection_id').equals(6).sortBy('sort_order')
    expect(updated.map(n => n.title)).toEqual(['A', 'B', 'C'])
  })
})
