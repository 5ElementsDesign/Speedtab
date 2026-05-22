import { ref, provide, inject, onBeforeUnmount, type Ref, type InjectionKey } from 'vue'

export type FeedArchiveHandler = () => void

const KEY: InjectionKey<Ref<FeedArchiveHandler | null>> = Symbol('feedArchive')

export function provideFeedArchive() {
  const handler = ref<FeedArchiveHandler | null>(null)
  provide(KEY, handler)
  return {
    handler,
    trigger: () => handler.value?.(),
    hasHandler: () => handler.value !== null,
  }
}

export function registerFeedArchive(fn: FeedArchiveHandler) {
  const slot = inject(KEY, null)
  if (!slot) return
  slot.value = fn
  onBeforeUnmount(() => {
    if (slot.value === fn) slot.value = null
  })
}
