<script setup lang="ts">
import { ref } from 'vue'
import type { FeedSource, PortableInput } from '@/types/db'
import { useFeed } from '@/composables/useFeed'

const props = defineProps<{
  source?: FeedSource
  collectionId: number
}>()

const emit = defineEmits<{
  (e: 'save', data: PortableInput<FeedSource>): void
  (e: 'delete', id: number): void
  (e: 'cancel'): void
}>()

const { fetchFeed, parseFeed } = useFeed()

const title = ref(props.source?.title || '')
const feedUrl = ref(props.source?.feed_url || '')
const siteUrl = ref(props.source?.site_url || '')

const isTesting = ref(false)
const testError = ref<string | null>(null)
const testSuccess = ref(false)

async function testConnection() {
  if (!feedUrl.value) return
  isTesting.value = true
  testError.value = null
  testSuccess.value = false

  try {
    const xml = await fetchFeed(feedUrl.value)
    const items = parseFeed(xml, 0)
    if (items.length === 0) {
      throw new Error('Feed parsed but contains no items.')
    }
    testSuccess.value = true
    // Try to auto-fill title if empty
    if (!title.value) {
      const parser = new DOMParser()
      const doc = parser.parseFromString(xml, 'text/xml')
      title.value = doc.querySelector('channel > title, feed > title')?.textContent || ''
    }
  } catch (err: unknown) {
    testError.value = err instanceof Error ? err.message : 'Failed to connect'
  } finally {
    isTesting.value = false
  }
}

function handleSave() {
  if (!title.value || !feedUrl.value) return

  emit('save', {
    collection_id: props.collectionId,
    title: title.value,
    feed_url: feedUrl.value,
    site_url: siteUrl.value || null,
    sort_order: props.source?.sort_order || 0,
    style_token: props.source?.style_token || null,
    last_hash: props.source?.last_hash || null,
    last_fetched_at: props.source?.last_fetched_at || null,
    last_error_at: props.source?.last_error_at || null,
    last_error_message: props.source?.last_error_message || null,
    fetch_options_json: props.source?.fetch_options_json || null,
  })
}

function handleDelete() {
  if (props.source?.id && confirm('Delete this feed source and all its cached items?')) {
    emit('delete', props.source.id)
  }
}
</script>

<template>
  <form @submit.prevent="handleSave" class="flex flex-col gap-4">
    <div>
      <label for="feed_source_url" class="block text-[10px] uppercase tracking-wider font-bold text-gray-500 mb-1">Feed URL</label>
      <div class="flex gap-2">
        <input
          id="feed_source_url"
          v-model="feedUrl"
          type="url"
          placeholder="https://example.com/feed.xml"
          required
          class="flex-1 bg-black/80 text-white placeholder:text-white/35 border border-white/10 rounded px-2 py-1.5 text-xs focus:border-indigo-500 outline-none transition-colors"
        />
        <button
          type="button"
          @click="testConnection"
          :disabled="isTesting || !feedUrl"
          class="px-3 py-1.5 bg-black/85 hover:bg-black border border-white/10 rounded text-[10px] uppercase tracking-wider font-bold text-white/85 hover:text-white transition-colors disabled:opacity-50"
        >
          {{ isTesting ? '...' : 'Test' }}
        </button>
      </div>
      <p v-if="testError" class="mt-1 text-[10px] text-red-400">{{ testError }}</p>
      <p v-if="testSuccess" class="mt-1 text-[10px] text-green-400">Connection successful!</p>
    </div>

    <div>
      <label for="feed_source_title" class="block text-[10px] uppercase tracking-wider font-bold text-gray-500 mb-1">Display Title</label>
      <input
        id="feed_source_title"
        v-model="title"
        type="text"
        placeholder="Feed Title"
        required
        class="w-full bg-black/80 text-white placeholder:text-white/35 border border-white/10 rounded px-2 py-1.5 text-xs focus:border-indigo-500 outline-none transition-colors"
      />
    </div>

    <div>
      <label for="feed_source_site_url" class="block text-[10px] uppercase tracking-wider font-bold text-gray-500 mb-1">Site URL (Optional)</label>
      <input
        id="feed_source_site_url"
        v-model="siteUrl"
        type="url"
        placeholder="https://example.com"
        class="w-full bg-black/80 text-white placeholder:text-white/35 border border-white/10 rounded px-2 py-1.5 text-xs focus:border-indigo-500 outline-none transition-colors"
      />
    </div>

    <div class="flex justify-between items-center mt-4 pt-4 border-t border-white/10">
      <button
        v-if="source?.id"
        type="button"
        @click="handleDelete"
        class="text-[10px] uppercase tracking-wider font-bold text-red-500 hover:text-red-400 transition-colors"
      >
        Delete
      </button>
      <div v-else></div>

      <div class="flex gap-3">
        <button
          type="button"
          @click="emit('cancel')"
          class="text-[10px] uppercase tracking-wider font-bold text-gray-400 hover:text-white transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          class="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded text-[10px] uppercase tracking-wider font-bold transition-colors"
        >
          Save Feed
        </button>
      </div>
    </div>
  </form>
</template>
