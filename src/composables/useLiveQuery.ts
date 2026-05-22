import { liveQuery } from 'dexie'
import { onUnmounted, ref, watch, type Ref, type WatchSource } from 'vue'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LiveQueryResult<T> {
  /** Reactive result of the Dexie query. Initialised to `initialValue`. */
  data:    Ref<T>
  /** True until the first result arrives from IndexedDB. */
  loading: Ref<boolean>
  /** Set when the query observable emits an error. */
  error:   Ref<Error | null>
}

// ─── Composable ───────────────────────────────────────────────────────────────

/**
 * `useLiveQuery` – thin Vue 3 wrapper around Dexie's `liveQuery` observable.
 *
 * Usage:
 *   const { data: pages, loading } = useLiveQuery(
 *     () => db.pages.orderBy('sort_order').toArray(),
 *     [],
 *   )
 *
 * Key properties:
 *  - The subscription is automatically torn down when the owning component
 *    is unmounted (no memory leaks).
 *  - `loading` flips to false after the first emission so the UI can show a
 *    skeleton state instead of a flash of empty content.
 *  - Unlike @vueuse/rxjs this has no extra runtime dependencies.
 *
 * @param querier      Function returning a Dexie Promise or plain value.
 *                     Dexie re-runs it whenever any touched table changes.
 * @param initialValue Starting value before IndexedDB responds.
 * @param watchSources Optional Vue watch sources. When any source changes the
 *                     Dexie subscription is torn down and re-created so the
 *                     querier can safely read reactive values (e.g. a prop id).
 */
export function useLiveQuery<T>(
  querier:      () => T | Promise<T>,
  initialValue: T,
  watchSources?: WatchSource[],
): LiveQueryResult<T> {
  const data    = ref<T>(initialValue) as Ref<T>
  const loading = ref<boolean>(true)
  const error   = ref<Error | null>(null)

  let subscription: { unsubscribe(): void } | null = null

  function resubscribe() {
    subscription?.unsubscribe()
    loading.value = true
    subscription  = liveQuery(querier).subscribe({
      next(value: T) {
        data.value    = value
        loading.value = false
        error.value   = null
      },
      error(err: unknown) {
        error.value   = err instanceof Error ? err : new Error(String(err))
        loading.value = false
      },
    })
  }

  resubscribe()

  // Re-subscribe whenever an external reactive dependency changes
  if (watchSources?.length) {
    watch(watchSources, resubscribe, { flush: 'sync' })
  }

  // Clean up the Dexie subscription when the component unmounts
  onUnmounted(() => subscription?.unsubscribe())

  return { data, loading, error }
}
