/**
 * useDragSort – unit tests
 *
 * Tests cover:
 *  • Initial state (draggingIndex / dragOverIndex are null)
 *  • bindFor() attribute shape
 *  • dragstart – claims ownership, stops propagation, sets dataTransfer,
 *                calls optional onDragStart hook
 *  • dragenter  – ignored when no active drag; sets dragOverIndex + stops
 *                 propagation when active
 *  • dragover   – ignored when no active drag; prevents default + stops
 *                 propagation when active
 *  • drop       – ignored when no active drag; calls onReorder with correct
 *                 indices, then clears state; no-op when from === to
 *  • dragend    – clears both indices unconditionally
 *  • Nested propagation isolation – outer instance does NOT react to events
 *                 started by the inner instance
 */
import { describe, expect, it, vi } from 'vitest';
import { useDragSort } from './useDragSort';

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Minimal DragEvent stub with spy-able methods. */
function makeEvent(type = 'dragstart'): DragEvent & { stopPropagation: ReturnType<typeof vi.fn>; preventDefault: ReturnType<typeof vi.fn> } {
  const dt = {
    effectAllowed: '' as DataTransfer['effectAllowed'],
    dropEffect:    '' as DataTransfer['dropEffect'],
    setData:       vi.fn(),
  }
  return {
    type,
    dataTransfer:    dt as unknown as DataTransfer,
    stopPropagation: vi.fn(),
    preventDefault:  vi.fn(),
  } as unknown as DragEvent & { stopPropagation: ReturnType<typeof vi.fn>; preventDefault: ReturnType<typeof vi.fn> }
}

/** Pull a named handler from a bindFor() result. */
function handler<K extends string>(bindings: Record<string, unknown>, key: K) {
  return bindings[key] as (...args: unknown[]) => unknown
}

// ─── Initial state ────────────────────────────────────────────────────────────

describe('useDragSort – initial state', () => {
  it('starts with both indices null', () => {
    const dnd = useDragSort({ onReorder: vi.fn() })
    expect(dnd.draggingIndex.value).toBeNull()
    expect(dnd.dragOverIndex.value).toBeNull()
  })
})

// ─── bindFor() attributes ─────────────────────────────────────────────────────

describe('useDragSort – bindFor attributes', () => {
  it('sets draggable=true and data-drag-index', () => {
    const dnd = useDragSort({ onReorder: vi.fn() })
    const b   = dnd.bindFor(2)
    expect(b.draggable).toBe(true)
    expect(b['data-drag-index']).toBe(2)
  })

  it('marks data-dragging only for the active item', () => {
    const dnd = useDragSort({ onReorder: vi.fn() })
    dnd.draggingIndex.value = 1
    expect(dnd.bindFor(1)['data-dragging']).toBe('true')
    expect(dnd.bindFor(0)['data-dragging']).toBeUndefined()
  })

  it('marks data-drag-over only for the hovered item', () => {
    const dnd = useDragSort({ onReorder: vi.fn() })
    dnd.dragOverIndex.value = 3
    expect(dnd.bindFor(3)['data-drag-over']).toBe('true')
    expect(dnd.bindFor(0)['data-drag-over']).toBeUndefined()
  })
})

// ─── dragstart ────────────────────────────────────────────────────────────────

describe('useDragSort – dragstart', () => {
  it('stops propagation unconditionally', () => {
    const dnd = useDragSort({ onReorder: vi.fn() })
    const e   = makeEvent('dragstart')
    handler(dnd.bindFor(0), 'onDragstart')(e)
    expect(e.stopPropagation).toHaveBeenCalledOnce()
  })

  it('sets draggingIndex to the element index', () => {
    const dnd = useDragSort({ onReorder: vi.fn() })
    handler(dnd.bindFor(2), 'onDragstart')(makeEvent())
    expect(dnd.draggingIndex.value).toBe(2)
  })

  it('writes index into dataTransfer and sets effectAllowed', () => {
    const dnd = useDragSort({ onReorder: vi.fn() })
    const e   = makeEvent()
    handler(dnd.bindFor(1), 'onDragstart')(e)
    expect(e.dataTransfer!.setData).toHaveBeenCalledWith('text/plain', '1')
    expect(e.dataTransfer!.effectAllowed).toBe('move')
  })

  it('calls the optional onDragStart hook', () => {
    const hook = vi.fn()
    const dnd  = useDragSort({ onReorder: vi.fn(), onDragStart: hook })
    const e    = makeEvent()
    handler(dnd.bindFor(3), 'onDragstart')(e)
    expect(hook).toHaveBeenCalledWith(3, e)
  })
})

// ─── dragenter ────────────────────────────────────────────────────────────────

describe('useDragSort – dragenter', () => {
  it('is ignored (no side-effects) when no drag is active', () => {
    const dnd = useDragSort({ onReorder: vi.fn() })
    const e   = makeEvent('dragenter')
    handler(dnd.bindFor(1), 'onDragenter')(e)
    expect(e.preventDefault).not.toHaveBeenCalled()
    expect(e.stopPropagation).not.toHaveBeenCalled()
    expect(dnd.dragOverIndex.value).toBeNull()
  })

  it('sets dragOverIndex and stops propagation when active', () => {
    const dnd = useDragSort({ onReorder: vi.fn() })
    handler(dnd.bindFor(0), 'onDragstart')(makeEvent())   // start drag on 0
    const e = makeEvent('dragenter')
    handler(dnd.bindFor(2), 'onDragenter')(e)
    expect(dnd.dragOverIndex.value).toBe(2)
    expect(e.stopPropagation).toHaveBeenCalledOnce()
    expect(e.preventDefault).toHaveBeenCalledOnce()
  })
})

// ─── dragover ─────────────────────────────────────────────────────────────────

describe('useDragSort – dragover', () => {
  it('is ignored when no drag is active', () => {
    const dnd = useDragSort({ onReorder: vi.fn() })
    const e   = makeEvent('dragover')
    handler(dnd.bindFor(1), 'onDragover')(e)
    expect(e.preventDefault).not.toHaveBeenCalled()
  })

  it('prevents default and stops propagation when active', () => {
    const dnd = useDragSort({ onReorder: vi.fn() })
    handler(dnd.bindFor(0), 'onDragstart')(makeEvent())
    const e = makeEvent('dragover')
    handler(dnd.bindFor(1), 'onDragover')(e)
    expect(e.preventDefault).toHaveBeenCalledOnce()
    expect(e.stopPropagation).toHaveBeenCalledOnce()
    expect(e.dataTransfer!.dropEffect).toBe('move')
  })
})

// ─── drop ─────────────────────────────────────────────────────────────────────

describe('useDragSort – drop', () => {
  it('is ignored when no drag is active', async () => {
    const onReorder = vi.fn()
    const dnd = useDragSort({ onReorder })
    await (handler(dnd.bindFor(1), 'onDrop') as (e: DragEvent) => Promise<void>)(makeEvent('drop') as DragEvent)
    expect(onReorder).not.toHaveBeenCalled()
  })

  it('calls onReorder with (from, to) and clears state', async () => {
    const onReorder = vi.fn()
    const dnd = useDragSort({ onReorder })
    handler(dnd.bindFor(0), 'onDragstart')(makeEvent())   // drag from 0
    await (handler(dnd.bindFor(2), 'onDrop') as (e: DragEvent) => Promise<void>)(makeEvent('drop') as DragEvent)
    expect(onReorder).toHaveBeenCalledWith(0, 2)
    expect(dnd.draggingIndex.value).toBeNull()
    expect(dnd.dragOverIndex.value).toBeNull()
  })

  it('does NOT call onReorder when from === to', async () => {
    const onReorder = vi.fn()
    const dnd = useDragSort({ onReorder })
    handler(dnd.bindFor(1), 'onDragstart')(makeEvent())
    await (handler(dnd.bindFor(1), 'onDrop') as (e: DragEvent) => Promise<void>)(makeEvent('drop') as DragEvent)
    expect(onReorder).not.toHaveBeenCalled()
  })

  it('stops propagation and prevents default on a real drop', async () => {
    const dnd = useDragSort({ onReorder: vi.fn() })
    handler(dnd.bindFor(0), 'onDragstart')(makeEvent())
    const e = makeEvent('drop')
    await (handler(dnd.bindFor(2), 'onDrop') as (e: DragEvent) => Promise<void>)(e as DragEvent)
    expect(e.stopPropagation).toHaveBeenCalledOnce()
    expect(e.preventDefault).toHaveBeenCalledOnce()
  })
})

// ─── dragend ──────────────────────────────────────────────────────────────────

describe('useDragSort – dragend', () => {
  it('clears both indices', () => {
    const dnd = useDragSort({ onReorder: vi.fn() })
    handler(dnd.bindFor(0), 'onDragstart')(makeEvent())
    dnd.dragOverIndex.value = 2
    handler(dnd.bindFor(0), 'onDragend')()
    expect(dnd.draggingIndex.value).toBeNull()
    expect(dnd.dragOverIndex.value).toBeNull()
  })
})

// ─── Nested propagation isolation ────────────────────────────────────────────

describe('useDragSort – nested propagation isolation', () => {
  /**
   * Simulates the collection-button-inside-module-section scenario:
   *   inner = collectionDnd (button)
   *   outer = moduleDnd    (section)
   *
   * When the inner drag is active, the outer composable must NOT react to
   * the same events.  We model this by sharing a single stopPropagation spy:
   * if the inner handler calls it, the outer handler would never be invoked
   * in a real DOM — we verify the outer state stays pristine.
   */
  it('outer composable is unaffected by an inner dragstart', () => {
    const inner = useDragSort({ onReorder: vi.fn() })
    const outer = useDragSort({ onReorder: vi.fn() })

    // Fire dragstart on inner item 1
    const e = makeEvent('dragstart')
    handler(inner.bindFor(1), 'onDragstart')(e)

    // Inner claims ownership
    expect(inner.draggingIndex.value).toBe(1)
    // Outer was never called – its state is untouched
    expect(outer.draggingIndex.value).toBeNull()
    // The event's stopPropagation was called (so DOM propagation would stop)
    expect(e.stopPropagation).toHaveBeenCalledOnce()
  })

  it('outer dragenter is ignored if outer draggingIndex is null', () => {
    const outer = useDragSort({ onReorder: vi.fn() })

    // Pretend an inner drag is in progress; the event bubbles to outer
    const e = makeEvent('dragenter')
    handler(outer.bindFor(0), 'onDragenter')(e)

    // Outer must not set a drag-over state
    expect(outer.dragOverIndex.value).toBeNull()
    expect(e.stopPropagation).not.toHaveBeenCalled()
  })

  it('outer drop is ignored if outer draggingIndex is null', async () => {
    const outerReorder = vi.fn()
    const outer = useDragSort({ onReorder: outerReorder })

    // Simulate a bubbled drop from an inner drag
    const e = makeEvent('drop')
    await (handler(outer.bindFor(0), 'onDrop') as (e: DragEvent) => Promise<void>)(e as DragEvent)

    expect(outerReorder).not.toHaveBeenCalled()
  })
})
