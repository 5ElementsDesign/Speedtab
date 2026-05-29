<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { Collection, ModuleType, PortableInput } from '@/types/db'

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

const refreshIntervals = [
  { value: 0, label: 'Off' },
  { value: 60000, label: '1 minute' },
  { value: 300000, label: '5 minutes' },
  { value: 600000, label: '10 minutes' },
  { value: 900000, label: '15 minutes' },
  { value: 1800000, label: '30 minutes' },
  { value: 3600000, label: '60 minutes' },
]

function handleSubmit() {
  if (!form.value.title) return
  form.value.config_json = props.moduleType === 'feeds' ? JSON.stringify(config.value) : null
  // Emit a plain shallow copy — IndexedDB's structured clone cannot serialize Vue's reactive Proxy.
  emit('save', { ...form.value })
}
</script>

<template>
  <form @submit.prevent="handleSubmit" class="space-y-4">
    <div>
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
          class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-medium shadow-lg shadow-indigo-900/20 transition-all"
        >
          {{ collection?.id ? 'Save Changes' : 'Create Tab' }}
        </button>
      </div>
    </div>
  </form>
</template>
