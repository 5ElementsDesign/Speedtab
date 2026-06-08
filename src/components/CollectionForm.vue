<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { transferCollectionContent, type CollectionTransferKey, type CollectionTransferMode } from '@/composables/useCollectionTransfer'
import { useLiveQuery } from '@/composables/useLiveQuery'
import { db, isActiveRecord } from '@/db/db'
import type { Collection, Module, ModuleType, Page, PortableInput } from '@/types/db'

const props = defineProps<{
  collection?: Collection
  moduleId:    number
  moduleType:  ModuleType
}>()

const emit = defineEmits<{
  save:   [data: PortableInput<Collection>]
  delete: [id: number]
  cancel: []
}>()

const form = ref<PortableInput<Collection>>({
  module_id:   props.moduleId,
  title:       props.collection?.title ?? '',
  sort_order:  props.collection?.sort_order ?? 0,
  config_json: props.collection?.config_json ?? null,
})

function parseConfig(json: string | null | undefined): { refresh_interval_ms: number } {
  try {
    const parsed = JSON.parse(json || '{}')
    return {
      refresh_interval_ms: typeof parsed.refresh_interval_ms === 'number' ? parsed.refresh_interval_ms : 0,
    }
  } catch {
    return { refresh_interval_ms: 0 }
  }
}

const config = ref(parseConfig(form.value.config_json))

const titleInput = ref<HTMLInputElement | null>(null)
onMounted(() => titleInput.value?.focus())

const isTransferOpen = ref(false)
const transferMode = ref<CollectionTransferMode>('move')
const selectedPageId = ref<number | null>(null)
const selectedModuleId = ref<number | null>(null)
const selectedCollectionId = ref<number | null>(null)
const transferStatus = ref<string | null>(null)
const isTransferring = ref(false)
const selectedTransferKeys = ref<CollectionTransferKey[]>([])

const refreshIntervals = [
  { value: 0, label: 'Off' },
  { value: 60000, label: '1 minute' },
  { value: 300000, label: '5 minutes' },
  { value: 600000, label: '10 minutes' },
  { value: 900000, label: '15 minutes' },
  { value: 1800000, label: '30 minutes' },
  { value: 3600000, label: '60 minutes' },
]

const { data: pages } = useLiveQuery(
  () => db.pages.orderBy('sort_order').filter(isActiveRecord).toArray(),
  [] as Page[],
)
const { data: modules } = useLiveQuery(
  () => db.modules.orderBy('sort_order').filter(isActiveRecord).toArray(),
  [] as Module[],
)
const { data: collections } = useLiveQuery(
  () => db.collections.orderBy('sort_order').filter(isActiveRecord).toArray(),
  [] as Collection[],
)

const { data: sourceTabs } = useLiveQuery(
  () => props.collection?.id != null && props.moduleType === 'tabs'
    ? db.tabs.where('collection_id').equals(props.collection.id).filter(isActiveRecord).sortBy('sort_order')
    : Promise.resolve([]),
  [] as Array<import('@/types/db').Tab>,
  [() => props.collection?.id, () => props.moduleType],
)
const { data: sourceNotes } = useLiveQuery(
  () => props.collection?.id != null && props.moduleType === 'notes'
    ? db.notes.where('collection_id').equals(props.collection.id).filter(isActiveRecord).sortBy('sort_order')
    : Promise.resolve([]),
  [] as Array<import('@/types/db').Note>,
  [() => props.collection?.id, () => props.moduleType],
)
const { data: sourceFeedSources } = useLiveQuery(
  () => props.collection?.id != null && props.moduleType === 'feeds'
    ? db.feed_sources.where('collection_id').equals(props.collection.id).filter(isActiveRecord).sortBy('sort_order')
    : Promise.resolve([]),
  [] as Array<import('@/types/db').FeedSource>,
  [() => props.collection?.id, () => props.moduleType],
)
const { data: sourceSavedFeedItems } = useLiveQuery(
  () => props.collection?.id != null && props.moduleType === 'feeds'
    ? db.saved_feed_items.where('collection_id').equals(props.collection.id).filter(isActiveRecord).sortBy('sort_order')
    : Promise.resolve([]),
  [] as Array<import('@/types/db').SavedFeedItem>,
  [() => props.collection?.id, () => props.moduleType],
)

const currentModule = computed(() => modules.value.find((module) => module.id === props.moduleId) ?? null)
const destinationPages = computed(() => pages.value)
const destinationModules = computed(() =>
  modules.value.filter((module) =>
    module.page_id === selectedPageId.value &&
    module.type === props.moduleType,
  ),
)
const destinationCollections = computed(() =>
  collections.value.filter((collection) => collection.module_id === selectedModuleId.value),
)

type TransferListItem = {
  key: CollectionTransferKey
  label: string
  sublabel: string | null
}

const transferItems = computed<TransferListItem[]>(() => {
  if (props.moduleType === 'tabs') {
    return sourceTabs.value.map((tab) => ({
      key: `tab:${tab.id!}`,
      label: tab.title,
      sublabel: tab.url,
    }))
  }
  if (props.moduleType === 'notes') {
    return sourceNotes.value.map((note) => ({
      key: `note:${note.id!}`,
      label: note.title,
      sublabel: note.type,
    }))
  }
  return [
    ...sourceFeedSources.value.map((source) => ({
      key: `feed_source:${source.id!}` as CollectionTransferKey,
      label: source.title,
      sublabel: source.feed_url,
    })),
    ...sourceSavedFeedItems.value.map((item) => ({
      key: `saved_feed_item:${item.id!}` as CollectionTransferKey,
      label: item.title,
      sublabel: item.source_title ?? 'Archived feed item',
    })),
  ]
})

const allTransferKeys = computed<CollectionTransferKey[]>(() => transferItems.value.map((item) => item.key))
const selectedTransferCount = computed(() => selectedTransferKeys.value.length)
const canExecuteTransfer = computed(() =>
  !!props.collection?.id &&
  !!selectedCollectionId.value &&
  selectedCollectionId.value !== props.collection.id &&
  selectedTransferKeys.value.length > 0 &&
  !isTransferring.value,
)

function toggleTransferPanel() {
  isTransferOpen.value = !isTransferOpen.value
  transferStatus.value = null
  if (isTransferOpen.value) {
    selectedPageId.value = currentModule.value?.page_id ?? null
    selectedModuleId.value = props.moduleId
    selectedCollectionId.value = null
    selectedTransferKeys.value = [...allTransferKeys.value]
  }
}

function selectAllTransferItems() {
  selectedTransferKeys.value = [...allTransferKeys.value]
}

function clearAllTransferItems() {
  selectedTransferKeys.value = []
}

watch(allTransferKeys, (keys) => {
  if (!isTransferOpen.value) return
  if (!selectedTransferKeys.value.length || selectedTransferKeys.value.length === allTransferKeys.value.length) {
    selectedTransferKeys.value = [...keys]
    return
  }
  selectedTransferKeys.value = selectedTransferKeys.value.filter((key) => keys.includes(key))
}, { deep: true })

watch(selectedPageId, () => {
  selectedModuleId.value = null
  selectedCollectionId.value = null
})

watch(selectedModuleId, () => {
  selectedCollectionId.value = null
})

function handleSubmit() {
  if (!form.value.title) return
  form.value.config_json = props.moduleType === 'feeds' ? JSON.stringify(config.value) : null
  // Emit a plain shallow copy — IndexedDB's structured clone cannot serialize Vue's reactive Proxy.
  emit('save', { ...form.value })
}

async function executeTransfer() {
  if (!props.collection?.id || !selectedCollectionId.value || !canExecuteTransfer.value) return
  if (transferMode.value === 'move' && !confirm(`Move ${selectedTransferCount.value} selected item(s) to the destination tab?`)) {
    return
  }

  isTransferring.value = true
  transferStatus.value = null
  try {
    const result = await transferCollectionContent({
      sourceCollectionId: props.collection.id,
      destinationCollectionId: selectedCollectionId.value,
      moduleType: props.moduleType,
      mode: transferMode.value,
      selectedKeys: selectedTransferKeys.value,
    })
    transferStatus.value = `${result.mode === 'move' ? 'Moved' : 'Copied'} ${result.moved_items} item${result.moved_items === 1 ? '' : 's'}`
    isTransferOpen.value = false
  } catch (error) {
    transferStatus.value = (error as Error).message
  } finally {
    isTransferring.value = false
  }
}
</script>

<template>
  <form @submit.prevent="handleSubmit" class="space-y-4">
    <div v-if="!isTransferOpen">
      <label for="collection_title" class="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Tab Title</label>
      <input
        id="collection_title"
        ref="titleInput"
        v-model="form.title"
        type="text"
        placeholder="e.g. Daily, Favorites, Archived..."
        class="w-full bg-surface-950 border border-white/10 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        required
      />
    </div>

    <div v-if="props.moduleType === 'feeds'">
      <label for="collection_refresh_interval" class="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Auto Refresh</label>
      <select
        id="collection_refresh_interval"
        v-model.number="config.refresh_interval_ms"
        class="w-full bg-surface-950 border border-white/10 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      >
        <option
          v-for="interval in refreshIntervals"
          :key="interval.value"
          :value="interval.value"
        >
          {{ interval.label }}
        </option>
      </select>
      <p class="mt-1 text-[11px] text-white/45">
        Only runs while this feed tab is open and the browser tab is visible.
      </p>
    </div>

    <template v-if="collection?.id">
      <div class="space-y-3">
        <button
          type="button"
          @click="toggleTransferPanel"
          class="px-3 py-2 bg-black/85 hover:bg-black border border-white/10 rounded text-[10px] uppercase tracking-wider font-bold text-white/85 hover:text-white transition-colors"
        >
          Move Content
        </button>

        <div v-if="isTransferOpen" class="space-y-4 border border-white/10 bg-black/20 p-3">
          <div class="space-y-2">
            <label for="collection_transfer_mode" class="block text-xs font-medium text-gray-500 uppercase tracking-wider">Transfer Mode</label>
            <select
              id="collection_transfer_mode"
              v-model="transferMode"
              name="collection_transfer_mode"
              class="w-full bg-surface-950 border border-white/10 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="copy">Copy content</option>
              <option value="move">Move content</option>
            </select>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="space-y-2">
              <label for="transfer_page_id" class="block text-xs font-medium text-gray-500 uppercase tracking-wider">Page</label>
              <select
                id="transfer_page_id"
                v-model.number="selectedPageId"
                name="transfer_page_id"
                class="w-full bg-surface-950 border border-white/10 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option :value="null">Select page</option>
                <option v-for="page in destinationPages" :key="page.id" :value="page.id">
                  {{ page.title }}
                </option>
              </select>
            </div>

            <div class="space-y-2">
              <label for="transfer_module_id" class="block text-xs font-medium text-gray-500 uppercase tracking-wider">Module</label>
              <select
                id="transfer_module_id"
                v-model.number="selectedModuleId"
                name="transfer_module_id"
                class="w-full bg-surface-950 border border-white/10 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option :value="null">Select module</option>
                <option v-for="module in destinationModules" :key="module.id" :value="module.id">
                  {{ module.title }}
                </option>
              </select>
            </div>

            <div class="space-y-2">
              <label for="transfer_collection_id" class="block text-xs font-medium text-gray-500 uppercase tracking-wider">Tab</label>
              <select
                id="transfer_collection_id"
                v-model.number="selectedCollectionId"
                name="transfer_collection_id"
                class="w-full bg-surface-950 border border-white/10 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option :value="null">Select tab</option>
                <option
                  v-for="targetCollection in destinationCollections"
                  :key="targetCollection.id"
                  :value="targetCollection.id"
                  :disabled="targetCollection.id === collection.id"
                >
                  {{ targetCollection.title }}{{ targetCollection.id === collection.id ? ' · current' : '' }}
                </option>
              </select>
            </div>
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between gap-3">
              <p class="text-xs font-medium text-gray-500 uppercase tracking-wider">Select Items</p>
              <div class="flex gap-2">
                <button
                  type="button"
                  @click="selectAllTransferItems"
                  class="text-[10px] uppercase tracking-wider text-white/70 hover:text-white transition-colors"
                >
                  Select All
                </button>
                <button
                  type="button"
                  @click="clearAllTransferItems"
                  class="text-[10px] uppercase tracking-wider text-white/70 hover:text-white transition-colors"
                >
                  Clear All
                </button>
              </div>
            </div>

            <div class="max-h-56 overflow-y-auto space-y-2">
              <label
                v-for="item in transferItems"
                :key="item.key"
                :class="[
                  'flex items-center gap-2 border px-2 py-2 transition-colors',
                  selectedTransferKeys.includes(item.key)
                    ? 'border-white/20 bg-[#151515]'
                    : 'border-white/10 bg-[#151515] hover:border-white/15',
                ]"
              >
                <input
                  v-model="selectedTransferKeys"
                  :value="item.key"
                  type="checkbox"
                  class="mr-1 rounded border-white/10 bg-surface-950 text-indigo-600 focus:ring-indigo-500"
                />
                <span class="min-w-0">
                  <span class="block text-[11px] text-white/90 truncate">{{ item.label }}</span>
                  <span v-if="item.sublabel" class="block text-[10px] text-white/55 truncate">{{ item.sublabel }}</span>
                </span>
              </label>
              <p v-if="!transferItems.length" class="text-[11px] text-white/50 italic">No content in this tab.</p>
            </div>
          </div>

          <div class="flex items-center justify-between gap-3 border-t border-white/10 pt-3">
            <p class="text-[11px] text-white/60">
              {{ transferMode === 'move' ? 'Move' : 'Copy' }} {{ selectedTransferCount }} selected item{{ selectedTransferCount === 1 ? '' : 's' }} to the destination tab.
            </p>
            <button
              type="button"
              :disabled="!canExecuteTransfer"
              @click="executeTransfer"
              class="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[10px] uppercase tracking-wider font-bold transition-colors disabled:opacity-40 disabled:hover:bg-indigo-600"
            >
              {{ isTransferring ? 'Working…' : 'Execute' }}
            </button>
          </div>
        </div>

        <p v-if="transferStatus" class="text-[11px]" :class="transferStatus.startsWith('Moved') || transferStatus.startsWith('Copied') ? 'text-green-400' : 'text-red-300'">
          {{ transferStatus }}
        </p>
      </div>
    </template>

    <div class="pt-4 mt-4 border-t border-white/10 flex items-center justify-between">
      <button
        v-if="collection?.id"
        type="button"
        @click="emit('delete', collection.id!)"
        class="text-xs text-red-400 hover:text-red-300 transition-colors"
      >
        Delete Tab
      </button>
      <div v-else></div>

      <div class="flex gap-3">
        <button
          type="button"
          @click="emit('cancel')"
          class="px-4 py-2 text-xs font-medium text-gray-400 hover:text-gray-200 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          :disabled="isTransferOpen"
          class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-medium shadow-lg shadow-indigo-900/20 transition-all"
          :class="isTransferOpen ? 'cursor-not-allowed opacity-45 hover:bg-indigo-600' : ''"
        >
          {{ collection?.id ? 'Save Changes' : 'Create Tab' }}
        </button>
      </div>
    </div>
  </form>
</template>
