<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import type { Module, ModuleType, PortableInput } from '@/types/db'

type ModuleColumnSpan = number | 'full' | null

interface ModuleFormConfig {
  columns: number
  show_add_tile: boolean
  column_span: ModuleColumnSpan
  min_height_px: number | null
  refresh_interval_ms: number
  feed_item_limit: number
  open_in_new_tab: boolean | null
  quicklinks: boolean
  force_favicon: boolean
  show_hover_actions: boolean
}

const props = defineProps<{
  module?: Module
  pageId:  number
  defaultColumnSpan?: ModuleColumnSpan
}>()

const emit = defineEmits<{
  save:   [data: PortableInput<Module>]
  delete: [id: number]
  cancel: []
  typeChange: [type: ModuleType]
}>()

const form = ref<PortableInput<Module>>({
  page_id:     props.pageId,
  type:        props.module?.type ?? 'tabs',
  title:       props.module?.title ?? '',
  sort_order:  props.module?.sort_order ?? 0,
  config_json: props.module?.config_json ?? JSON.stringify({ columns: 0, column_span: props.defaultColumnSpan ?? null }),
})

function parseConfig(
  json: string | null | undefined
): ModuleFormConfig {
  const defaultColumns = 0
  try {
    const parsed = JSON.parse(json || '{}')
    const parsedColumnSpan = parsed.column_span
    const columnSpan: ModuleColumnSpan = parsedColumnSpan === 'full'
      ? 'full'
      : typeof parsedColumnSpan === 'number' && Number.isFinite(parsedColumnSpan) && parsedColumnSpan >= 2
        ? Math.floor(parsedColumnSpan)
        : parsed.full_width === true
          ? 'full'
          : null
    return {
      columns:       typeof parsed.columns === 'number' ? parsed.columns : defaultColumns,
      show_add_tile: parsed.show_add_tile !== false,  // default true
      column_span: columnSpan,
      min_height_px: typeof parsed.min_height_px === 'number' && Number.isFinite(parsed.min_height_px)
        ? Math.max(130, Math.min(1000, Math.floor(parsed.min_height_px)))
        : null,
      refresh_interval_ms: typeof parsed.refresh_interval_ms === 'number' ? parsed.refresh_interval_ms : 0,
      feed_item_limit: typeof parsed.feed_item_limit === 'number' ? parsed.feed_item_limit : 0,
      open_in_new_tab: typeof parsed.open_in_new_tab === 'boolean' ? parsed.open_in_new_tab : null,
      quicklinks: parsed.quicklinks === true,
      force_favicon: parsed.force_favicon === true,
      show_hover_actions: parsed.show_hover_actions !== false,
    }
  } catch {
    return { columns: defaultColumns, show_add_tile: true, column_span: props.defaultColumnSpan ?? null, min_height_px: null, refresh_interval_ms: 0, feed_item_limit: 0, open_in_new_tab: null, quicklinks: false, force_favicon: false, show_hover_actions: true }
  }
}
const config = ref(parseConfig(form.value.config_json))

watch(() => form.value.type, (type) => {
  emit('typeChange', type)
}, { immediate: true })

const titleInput = ref<HTMLInputElement | null>(null)
onMounted(() => titleInput.value?.focus())

const moduleTypes: { value: ModuleType; label: string }[] = [
  { value: 'tabs',  label: 'Bookmarks' },
  { value: 'notes', label: 'Notes' },
  { value: 'feeds', label: 'Feeds' },
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
  { value: 9, label: '9' },
  { value: 10, label: '10' },
  { value: 0, label: 'Infinite' },
]

const moduleWidthOptions: Array<{ value: 'auto' | 'full' | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12; label: string }> = [
  { value: 'auto', label: 'Auto' },
  { value: 2, label: '2 columns' },
  { value: 3, label: '3 columns' },
  { value: 4, label: '4 columns' },
  { value: 5, label: '5 columns' },
  { value: 6, label: '6 columns' },
  { value: 7, label: '7 columns' },
  { value: 8, label: '8 columns' },
  { value: 9, label: '9 columns' },
  { value: 10, label: '10 columns' },
  { value: 11, label: '11 columns' },
  { value: 12, label: '12 columns' },
  { value: 'full', label: 'Full width' },
]

function handleSubmit() {
  if (!form.value.title) return
  form.value.config_json = JSON.stringify({
    ...config.value,
    full_width: undefined,
  })
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
        class="w-full min-h-[40px] bg-surface-950 border border-white/10 rounded px-3 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        required
      />
    </div>

    <div
      class="grid gap-3 sm:grid-cols-2"
      title="Module min height is clamped between 130px and 1000px. Other modules in the same row will grow with it."
    >
      <div>
        <label for="module_column_span" class="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Module Width</label>
        <select
          id="module_column_span"
          :value="config.column_span === null ? 'auto' : config.column_span"
          class="w-full min-h-[40px] bg-surface-950 border border-white/10 rounded px-3 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          @change="config.column_span = ($event.target as HTMLSelectElement).value === 'auto'
            ? null
            : (($event.target as HTMLSelectElement).value === 'full'
              ? 'full'
              : Number(($event.target as HTMLSelectElement).value))"
        >
          <option
            v-for="option in moduleWidthOptions"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </select>
      </div>

      <div>
        <label for="module_min_height_px" class="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Module Min Height</label>
        <input
          id="module_min_height_px"
          :value="config.min_height_px ?? ''"
          type="number"
          min="130"
          max="1000"
          step="10"
          placeholder="Auto"
          class="w-full min-h-[40px] bg-surface-950 border border-white/10 rounded px-3 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          @input="config.min_height_px = ($event.target as HTMLInputElement).value === ''
            ? null
            : Math.max(130, Math.min(1000, Math.floor(Number(($event.target as HTMLInputElement).value))))"
        />
      </div>
    </div>

    <div class="border-t border-white/10 pt-4 space-y-4">
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

      <div v-if="form.type === 'tabs'" class="flex items-center gap-2">
        <input
          id="module_show_hover_actions"
          type="checkbox"
          :checked="config.show_hover_actions"
          @change="config.show_hover_actions = ($event.target as HTMLInputElement).checked"
          class="rounded border-white/10 bg-surface-950 text-indigo-600 focus:ring-indigo-500"
        />
        <label for="module_show_hover_actions" class="text-sm text-gray-300 select-none">
          Show bookmark hover action buttons
        </label>
      </div>

      <div v-if="form.type === 'tabs'" class="flex items-center justify-between gap-4">
        <label class="flex items-center gap-2">
          <input
            id="module_quicklinks"
            type="checkbox"
            :checked="config.quicklinks"
            @change="config.quicklinks = ($event.target as HTMLInputElement).checked"
            class="rounded border-white/10 bg-surface-950 text-indigo-600 focus:ring-indigo-500"
          />
          <span for="module_quicklinks" class="text-sm text-gray-300 select-none">
            Quicklinks mode
          </span>
        </label>

        <label class="flex items-center gap-2 whitespace-nowrap" :class="config.quicklinks ? '' : 'opacity-45'">
          <input
            id="module_force_favicon"
            type="checkbox"
            :checked="config.force_favicon"
            :disabled="!config.quicklinks"
            @change="config.force_favicon = ($event.target as HTMLInputElement).checked"
            class="rounded border-white/10 bg-surface-950 text-indigo-600 focus:ring-indigo-500 disabled:cursor-not-allowed"
          />
          <span class="text-sm text-gray-300 select-none">
            Force Favicon
          </span>
        </label>
      </div>

      <div v-if="form.type === 'tabs'" class="border-t border-white/10"></div>

      <div v-if="form.type !== 'feeds'">
        <label for="module_layout_columns" class="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Layout Grid</label>
        <select
          id="module_layout_columns"
          v-model.number="config.columns"
          class="w-full min-h-[40px] bg-surface-950 border border-white/10 rounded px-3 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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

      <div v-if="form.type === 'tabs'">
        <label for="bookmark_open_mode" class="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Bookmark Open Behavior</label>
        <select
          id="bookmark_open_mode"
          :value="config.open_in_new_tab === null ? 'default' : (config.open_in_new_tab ? 'new' : 'same')"
          @change="config.open_in_new_tab = ($event.target as HTMLSelectElement).value === 'default'
            ? null
            : ($event.target as HTMLSelectElement).value === 'new'"
          class="w-full min-h-[40px] bg-surface-950 border border-white/10 rounded px-3 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
    </div>

    <div v-if="form.type === 'feeds'">
      <label for="feed_item_limit" class="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Visible Feed Items</label>
      <select
        id="feed_item_limit"
        v-model.number="config.feed_item_limit"
        class="w-full min-h-[40px] bg-surface-950 border border-white/10 rounded px-3 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
          class="px-2 py-3 rounded border text-xs font-medium transition-all flex flex-col items-center gap-2 text-center"
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
