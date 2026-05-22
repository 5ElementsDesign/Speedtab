import { ref, provide, inject, onBeforeUnmount, type Ref, type InjectionKey } from 'vue'

export type FeedClearHandler = () => void

const KEY: InjectionKey<Ref<FeedClearHandler | null>> = Symbol('feedClear')

export function provideFeedClear() {
  const handler = ref<FeedClearHandler | null>(null)
  provide(KEY, handler)
  return {
    handler,
    trigger: () => handler.value?.(),
    hasHandler: () => handler.value !== null,
  }
}

export function registerFeedClear(fn: FeedClearHandler) {
  const slot = inject(KEY, null)
  if (!slot) return
  slot.value = fn
  onBeforeUnmount(() => {
    if (slot.value === fn) slot.value = null
  })
}
