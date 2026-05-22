<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { Module, ModuleType, PortableInput } from '@/types/db'

const props = defineProps<{
  module?: Module
  pageId:  number
}>()

const emit = defineEmits<{
  save:   [data: PortableInput<Module>]
  delete: [id: number]
  cancel: []
}>()

const form = ref<PortableInput<Module>>({
  page_id:     props.pageId,
  type:        props.module?.type ?? 'tabs',
  title:       props.module?.title ?? '',
  sort_order:  props.module?.sort_order ?? 0,
  config_json: props.module?.config_json ?? JSON.stringify({ columns: 4 }),
})

function parseConfig(json: string | null | undefined): { columns: number; show_add_tile: boolean; full_width: boolean; refresh_interval_ms: number; feed_item_limit: number; open_in_new_tab: boolean | null } {
  try {
    const parsed = JSON.parse(json || '{}')
    return {
      columns:       typeof parsed.columns === 'number' ? parsed.columns : 4,
      show_add_tile: parsed.show_add_tile !== false,  // default true
      full_width:    parsed.full_width === true,
      refresh_interval_ms: typeof parsed.refresh_interval_ms === 'number' ? parsed.refresh_interval_ms : 0,
      feed_item_limit: typeof parsed.feed_item_limit === 'number' ? parsed.feed_item_limit : 0,
      open_in_new_tab: typeof parsed.open_in_new_tab === 'boolean' ? parsed.open_in_new_tab : null,
    }
  } catch {
    return { columns: 4, show_add_tile: true, full_width: false, refresh_interval_ms: 0, feed_item_limit: 0, open_in_new_tab: null }
  }
}
const config = ref(parseConfig(form.value.config_json))

const titleInput = ref<HTMLInputElement | null>(null)
onMounted(() => titleInput.value?.focus())

const moduleTypes: { value: ModuleType; label: string }[] = [
  { value: 'tabs',  label: 'Bookmarks (Tabs)' },
  { value: 'notes', label: 'Notes' },
  { value: 'feeds', label: 'RSS/Atom Feeds' },
]

const refreshIntervals = [
  { value: 0, label: 'Off' },
  { value: 60000, label: '1 minute' },
  { value: 300000, label: '5 minutes' },
  { value: 600000, label: '10 minutes' },
  { value: 900000, label: '15 minutes' },
  { value: 1800000, label: '30 minutes' },
  { value: 3600000, label: '60 minutes' },
]

const feedItemLimits = [
  { value: 10, label: '10 items' },
  { value: 15, label: '15 items' },
  { value: 20, label: '20 items' },
  { value: 25, label: '25 items' },
  { value: 50, label: '50 items' },
  { value: 0, label: 'All items' },
]

const bookmarkOpenModes = [
  { value: 'default', label: 'Use app default' },
  { value: 'same', label: 'Open in current tab' },
  { value: 'new', label: 'Open in new tab' },
]

const layoutOptions = [
  { value: 1, label: 'List' },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
  { value: 4, label: '4' },
  { value: 5, label: '5' },
  { value: 6, label: '6' },
  { value: 7, label: '7' },
  { value: 8, label: '8' },
]

function handleSubmit() {
  if (!form.value.title) return
  form.value.config_json = JSON.stringify(config.value)
  // Emit a plain shallow copy — IndexedDB's structured clone cannot serialize Vue's reactive Proxy.
  emit('save', { ...form.value })
}
</script>

<template>
  <form @submit.prevent="handleSubmit" class="space-y-4">
    <div>
      <label for="module_title" class="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Module Title</label>
      <input
        id="module_title"
        ref="titleInput"
        v-model="form.title"
        type="text"
        placeholder="e.g. Work Links, Quick Notes..."
        class="w-full bg-surface-950 border border-white/10 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        required
      />
    </div>

    <div v-if="form.type !== 'feeds'">
      <label for="module_layout_columns" class="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Layout Grid</label>
      <select
        id="module_layout_columns"
        v-model.number="config.columns"
        class="w-full bg-surface-950 border border-white/10 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      >
        <option
          v-for="option in layoutOptions"
          :key="option.value"
          :value="option.value"
        >
          {{ option.label }}
        </option>
      </select>
    </div>

    <div class="flex items-center gap-2">
      <input
        id="show_add_tile"
        type="checkbox"
        :checked="config.show_add_tile"
        @change="config.show_add_tile = ($event.target as HTMLInputElement).checked"
        class="rounded border-white/10 bg-surface-950 text-indigo-600 focus:ring-indigo-500"
      />
      <label for="show_add_tile" class="text-sm text-gray-300 select-none">
        Show inline "+" Add tile
      </label>
    </div>

    <div class="flex items-center gap-2">
      <input
        id="module_full_width"
        type="checkbox"
        :checked="config.full_width"
        @change="config.full_width = ($event.target as HTMLInputElement).checked"
        class="rounded border-white/10 bg-surface-950 text-indigo-600 focus:ring-indigo-500"
      />
      <label for="module_full_width" class="text-sm text-gray-300 select-none">
        Span full width
      </label>
    </div>

    <div v-if="form.type === 'tabs'">
      <label for="bookmark_open_mode" class="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Bookmark Open Behavior</label>
      <select
        id="bookmark_open_mode"
        :value="config.open_in_new_tab === null ? 'default' : (config.open_in_new_tab ? 'new' : 'same')"
        @change="config.open_in_new_tab = ($event.target as HTMLSelectElement).value === 'default'
          ? null
          : ($event.target as HTMLSelectElement).value === 'new'"
        class="w-full bg-surface-950 border border-white/10 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      >
        <option
          v-for="mode in bookmarkOpenModes"
          :key="mode.value"
          :value="mode.value"
        >
          {{ mode.label }}
        </option>
      </select>
    </div>

    <div v-if="form.type === 'feeds'">
      <label for="feed_refresh_interval" class="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Auto Refresh</label>
      <select
        id="feed_refresh_interval"
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
        Only runs while this feed module is open and the tab is visible.
      </p>
    </div>

    <div v-if="form.type === 'feeds'">
      <label for="feed_item_limit" class="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Visible Feed Items</label>
      <select
        id="feed_item_limit"
        v-model.number="config.feed_item_limit"
        class="w-full bg-surface-950 border border-white/10 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      >
        <option
          v-for="limit in feedItemLimits"
          :key="limit.value"
          :value="limit.value"
        >
          {{ limit.label }}
        </option>
      </select>
      <p class="mt-1 text-[11px] text-white/45">
        Controls how many fetched items are shown in this feed module.
      </p>
    </div>

    <div v-if="!module?.id">
      <span class="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Type</span>
      <div id="module_type_group" class="grid grid-cols-3 gap-2">
        <button
          v-for="t in moduleTypes"
          :key="t.value"
          type="button"
          @click="form.type = t.value"
          class="px-2 py-3 rounded border text-xs font-medium transition-all flex flex-col items-center gap-2"
          :class="form.type === t.value
            ? 'bg-indigo-600/20 border-indigo-500 text-indigo-400'
            : 'bg-surface-950 border-white/5 text-gray-500 hover:border-white/10'
          "
        >
          <span v-if="t.value === 'tabs'" class="text-lg">🔖</span>
          <span v-if="t.value === 'notes'" class="text-lg">📝</span>
          <span v-if="t.value === 'feeds'" class="text-lg">📡</span>
          {{ t.label }}
        </button>
      </div>
    </div>

    <div v-else>
      <span class="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Type</span>
      <div class="px-3 py-2 rounded border border-white/10 bg-surface-950 text-sm text-gray-200">
        {{ moduleTypes.find(t => t.value === form.type)?.label ?? form.type }}
      </div>
    </div>

    <div class="pt-4 mt-4 border-t border-white/10 flex items-center justify-between">
      <button
        v-if="module?.id"
        type="button"
        @click="emit('delete', module.id!)"
        class="text-xs text-red-400 hover:text-red-300 transition-colors"
      >
        Delete Module
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
          class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-medium shadow-lg shadow-indigo-900/20 transition-all"
        >
          {{ module?.id ? 'Save Changes' : 'Create Module' }}
        </button>
      </div>
    </div>
  </form>
</template>
