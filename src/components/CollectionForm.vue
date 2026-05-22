<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { Collection, PortableInput } from '@/types/db'

const props = defineProps<{
  collection?: Collection
  moduleId:    number
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

const titleInput = ref<HTMLInputElement | null>(null)
onMounted(() => titleInput.value?.focus())

function handleSubmit() {
  if (!form.value.title) return
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
