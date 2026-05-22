import type { Table, UpdateSpec } from 'dexie';
import type { Ref } from 'vue';

// ─── Pure helpers ─────────────────────────────────────────────────────────────

export interface SortUpdate { id: number; sort_order: number }

/**
 * Given a list ordered by current `sort_order` and a drag (fromIndex → toIndex),
 * return the minimal set of {id, sort_order} updates needed to persist the
 * new order. Only rows whose sort_order actually changed are included so we
 * stay cheap on small reorders.
 *
 *   computeReorder([{id:1,so:0},{id:2,so:1},{id:3,so:2}], 0, 2)
 *   → [{id:1,sort_order:2},{id:2,sort_order:0},{id:3,sort_order:1}]
 */
export function computeReorder<T extends { id?: number; sort_order: number }>(
  items:     T[],
  fromIndex: number,
  toIndex:   number,
): SortUpdate[] {
  if (
    fromIndex === toIndex                     ||
    fromIndex < 0 || fromIndex >= items.length ||
    toIndex   < 0 || toIndex   >= items.length
  ) return []

  const reordered = items.slice()
  const [moved]   = reordered.splice(fromIndex, 1)
  reordered.splice(toIndex, 0, moved)

  const updates: SortUpdate[] = []
  reordered.forEach((row, idx) => {
    if (row.id == null) return
    if (row.sort_order !== idx) updates.push({ id: row.id, sort_order: idx })
  })
  return updates
}

// ─── Composable ───────────────────────────────────────────────────────────────

/**
 * Reordering helpers bound to a single Dexie table.
 *  - `moveUp` / `moveDown` swap neighbours (Phase 2 fallback, still used by tests)
 *  - `move(from, to)`     reassigns sequential sort_orders for HTML5 drag-and-drop
 */
export function useReorder<T extends { id?: number; sort_order: number }>(
  table:    Table<T, number>,
  itemsRef: Ref<T[]>,
) {
  async function moveUp(item: T) {
    const items = itemsRef.value
    const index = items.findIndex(i => i.id === item.id)
    if (index <= 0) return
    await swap(item, items[index - 1])
  }

  async function moveDown(item: T) {
    const items = itemsRef.value
    const index = items.findIndex(i => i.id === item.id)
    if (index < 0 || index >= items.length - 1) return
    await swap(item, items[index + 1])
  }

  async function swap(a: T, b: T) {
    if (!a.id || !b.id) return
    const orderA = a.sort_order
    const orderB = b.sort_order
    // Use the table's own Dexie instance so tests can inject fake-indexeddb
    // without hitting the global app singleton.
    await table.db.transaction('rw', table, async () => {
      await table.update(a.id!, { sort_order: orderB } as unknown as UpdateSpec<T>)
      await table.update(b.id!, { sort_order: orderA } as unknown as UpdateSpec<T>)
    })
  }

  /** Drag-and-drop: persist a fromIndex→toIndex reorder in one transaction. */
  async function move(fromIndex: number, toIndex: number) {
    const updates = computeReorder(itemsRef.value, fromIndex, toIndex)
    if (!updates.length) return
    await table.db.transaction('rw', table, async () => {
      for (const u of updates) {
        await table.update(u.id, { sort_order: u.sort_order } as unknown as UpdateSpec<T>)
      }
    })
  }

  return { moveUp, moveDown, move }
}
