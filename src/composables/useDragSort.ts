import { ref } from 'vue'

// ─── Drag-and-drop composable ─────────────────────────────────────────────────
// A lightweight wrapper around the native HTML5 drag-and-drop API. We avoid
// pulling in @sortablejs/vue3 because (a) it ships a non-trivial runtime, and
// (b) Dexie + useLiveQuery already drive a reactive re-render on every
// `move(...)` call so a fancy mirror/ghost layer would only fight the live
// data flow.

export interface DragSortOptions {
  /** Called with (fromIndex, toIndex) after a successful drop. */
  onReorder: (fromIndex: number, toIndex: number) => void | Promise<void>
  /** Optional dragstart side-effects (set custom dataTransfer payload, etc.). */
  onDragStart?: (index: number, event: DragEvent) => void
}

export interface DragSortBindings {
  /** Index of the row currently being dragged (or null when idle). */
  draggingIndex:  ReturnType<typeof ref<number | null>>
  /** Index of the row currently hovered as a drop target. */
  dragOverIndex:  ReturnType<typeof ref<number | null>>
  /** Spread on the draggable element: <div v-bind="bindFor(idx)">…</div> */
  bindFor:        (index: number) => Record<string, unknown>
}

/**
 * `useDragSort` returns a single `bindFor(index)` factory that wires the five
 * HTML5 events needed for in-place reordering:
 *   dragstart, dragenter, dragover, drop, dragend
 *
 * Usage:
 *   const dnd = useDragSort({ onReorder: (f, t) => move(f, t) })
 *   <div v-for="(row, idx) in rows" :key="row.id" v-bind="dnd.bindFor(idx)">
 *     …
 *   </div>
 */
export function useDragSort(options: DragSortOptions): DragSortBindings {
  const draggingIndex = ref<number | null>(null)
  const dragOverIndex = ref<number | null>(null)

  function bindFor(index: number): Record<string, unknown> {
    return {
      draggable:        true,
      'data-drag-index': index,
      'data-drag-over': dragOverIndex.value === index ? 'true' : undefined,
      'data-dragging':  draggingIndex.value === index ? 'true' : undefined,

      // Drag events bubble; when this composable is nested inside another
      // draggable element (e.g. a collection-nav button inside a draggable
      // module section), we stopPropagation while we are the active owner so
      // the outer composable doesn't react in parallel. When we are NOT the
      // active owner the event is allowed to bubble so the ancestor can use
      // this element as a drop target.

      onDragstart: (e: DragEvent) => {
        e.stopPropagation()
        draggingIndex.value = index
        // Required for Firefox to fire subsequent drag events
        e.dataTransfer?.setData('text/plain', String(index))
        if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
        options.onDragStart?.(index, e)
      },

      onDragenter: (e: DragEvent) => {
        if (draggingIndex.value === null) return
        e.preventDefault()
        e.stopPropagation()
        dragOverIndex.value = index
      },

      onDragover: (e: DragEvent) => {
        // Calling preventDefault on dragover is what permits the drop event
        if (draggingIndex.value === null) return
        e.preventDefault()
        e.stopPropagation()
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
      },

      onDrop: async (e: DragEvent) => {
        if (draggingIndex.value === null) return
        e.preventDefault()
        e.stopPropagation()
        const from = draggingIndex.value
        const to   = index
        draggingIndex.value = null
        dragOverIndex.value = null
        if (from === to) return
        await options.onReorder(from, to)
      },

      onDragend: () => {
        draggingIndex.value = null
        dragOverIndex.value = null
      },
    }
  }

  return { draggingIndex, dragOverIndex, bindFor }
}
