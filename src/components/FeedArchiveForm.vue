<script setup lang="ts">
import type { FeedItem, PortableInput, SavedFeedItem } from '@/types/db'
import { computed, ref } from 'vue'

const props = defineProps<{
  item: FeedItem
  sourceTitle: string
  collectionId: number
}>()

const emit = defineEmits<{
  save: [data: PortableInput<SavedFeedItem>]
  cancel: []
}>()

const comment = ref('')

const previewSummary = computed(() => props.item.summary || props.item.content || '')

function handleSubmit() {
  emit('save', {
    collection_id: props.collectionId,
    title: props.item.title,
    url: props.item.url,
    source_title: props.sourceTitle || null,
    author: props.item.author,
    published_at: props.item.published_at,
    summary: props.item.summary,
    content: props.item.content,
    comment: comment.value.trim() || null,
    saved_at: Date.now(),
    sort_order: 0,
    meta_json: props.item.external_id ? JSON.stringify({ external_id: props.item.external_id }) : null,
  })
}
</script>

<template>
  <form @submit.prevent="handleSubmit" class="space-y-4">
    <div class="space-y-1">
      <p class="text-[11px] text-white font-semibold leading-snug">{{ item.title }}</p>
      <p class="text-[10px] text-white/55">{{ sourceTitle || 'Feed item' }}</p>
      <p v-if="previewSummary" class="text-[11px] text-white/65 leading-snug line-clamp-4">{{ previewSummary }}</p>
    </div>

    <div>
      <label for="saved_feed_comment" class="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Comment</label>
      <textarea
        id="saved_feed_comment"
        v-model="comment"
        rows="4"
        placeholder="Why do you want to keep this?"
        class="w-full bg-surface-950 border border-white/10 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />
    </div>

    <div class="flex items-center justify-end gap-3 pt-4 mt-4 border-t border-white/10">
      <button
        type="button"
        @click="emit('cancel')"
        class="px-4 py-2 text-xs font-medium text-gray-400 hover:text-gray-200 transition-colors"
      >
        Cancel
      </button>
      <button
        type="submit"
        class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-medium transition-colors"
      >
        Archive Item
      </button>
    </div>
  </form>
</template>
