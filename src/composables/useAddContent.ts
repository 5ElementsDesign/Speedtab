import { ref, provide, inject, onBeforeUnmount, type Ref, type InjectionKey } from 'vue'

/**
 * Shared bridge for "Add Content" actions triggered from a parent (e.g. the
 * module header dropdown) into the currently visible content view
 * (TabsView / NotesView / FeedsView).
 *
 * The parent calls `provideAddContent()` once and uses the returned `trigger`
 * to invoke whichever handler the active child has registered. Each child
 * view calls `registerAddContent(handler)` in `setup()` so it gets unregistered
 * automatically when unmounted.
 */
export type AddContentHandler = () => void

const KEY: InjectionKey<Ref<AddContentHandler | null>> = Symbol('addContent')

export function provideAddContent() {
  const handler = ref<AddContentHandler | null>(null)
  provide(KEY, handler)
  return {
    handler,
    trigger: () => handler.value?.(),
    hasHandler: () => handler.value !== null,
  }
}

export function registerAddContent(fn: AddContentHandler) {
  const slot = inject(KEY, null)
  if (!slot) return
  slot.value = fn
  onBeforeUnmount(() => {
    if (slot.value === fn) slot.value = null
  })
}
