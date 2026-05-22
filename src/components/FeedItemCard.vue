<script setup lang="ts">
import { useFavicon } from '@/composables/useFavicon';
import { sanitizeHtml } from '@/composables/useSanitize';
import type { FeedItem } from '@/types/db';
import { computed, ref } from 'vue';

const props = defineProps<{
  item: FeedItem
  sourceTitle: string
}>()

const emit = defineEmits<{
  archive:    [item: FeedItem]
  'mark-read': [item: FeedItem]
}>()

const { getFaviconUrl } = useFavicon()

const expanded = ref(false)

const formattedDate = computed(() => {
  if (!props.item.published_at) return ''
  const date = new Date(props.item.published_at)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
})

const longDate = computed(() => {
  if (!props.item.published_at) return ''
  return new Date(props.item.published_at).toLocaleString()
})

const domain = computed(() => {
  if (!props.item.url) return ''
  try {
    return new URL(props.item.url).hostname.replace('www.', '')
  } catch {
    return ''
  }
})

const displaySource = computed(() => props.sourceTitle || domain.value || 'feed')

const faviconUrl = computed(() => {
  return getFaviconUrl(props.item.url)
})

const contentHtml = computed(() => {
  const raw = props.item.content || props.item.summary || ''
  return raw ? sanitizeHtml(raw) : ''
})

const googleHeadlineUrl = computed(() => {
  const query = encodeURIComponent(props.item.title)
  return `https://www.google.com/search?q=${query}`
})

function toggleExpanded() {
  expanded.value = !expanded.value
  if (expanded.value && props.item.read_at == null) {
    emit('mark-read', props.item)
  }
}
</script>

<template>
  <article class="st-module-feed-item w-full min-w-0 border-b border-black/40 bg-[#333]">
    <div
      class="st-module-feed-item-header group w-full min-w-0 px-1 py-1 hover:bg-[#444] transition-colors"
      :data-expanded="expanded ? 'true' : 'false'"
      :class="expanded ? 'bg-[#222]' : ''"
    >
      <div
        class="st-module-feed-item-icon shrink-0 w-5 h-5 rounded-sm bg-black/85 border border-white/10 flex items-center justify-center"
        :title="displaySource"
      >
        <img
          v-if="faviconUrl"
          :src="faviconUrl"
          :alt="displaySource"
          class="w-3.5 h-3.5 bg-white object-contain"
          draggable="false"
        />
      </div>

      <button
        type="button"
        @click="toggleExpanded"
        class="st-module-feed-item-toggle min-w-0 w-full py-2 text-left"
        :aria-expanded="expanded"
        :title="`${displaySource} · ${item.title}`"
      >
        <span
          class="st-module-feed-item-title block min-w-0 text-[11px] truncate leading-none transition-colors"
            :class="expanded
              ? 'opacity-0 select-none'
              : item.read_at != null
                ? 'text-white/40 group-hover:text-white/70'
                : 'text-white/90 group-hover:text-white'"
          :title="item.title"
          aria-hidden="true"
        >
          {{ item.title }}
        </span>
      </button>

      <span class="st-module-feed-item-date shrink-0 text-[9px] text-white/40 font-mono leading-none" :title="longDate">
        {{ formattedDate }}
      </span>

      <button
        type="button"
        @click.stop="emit('archive', item)"
        class="st-module-feed-item-save shrink-0 text-[9px] text-white/75 hover:text-white transition-colors px-1.5 py-0.5 rounded-sm bg-black/85 hover:bg-black border border-white/10"
        title="Archive this item"
        aria-label="Archive this item"
      >
        Save
      </button>
    </div>

    <div v-if="expanded" class="st-module-feed-item-body px-4 py-4 bg-black/75 border-t border-white/10 space-y-3">
      <div class="st-module-feed-item-meta space-y-1">
        <h3 class="st-module-feed-item-heading text-[13px] font-semibold text-white leading-snug">{{ item.title }}</h3>
        <p class="st-module-feed-item-byline text-[10px] text-white/45">
          <span v-if="longDate">{{ longDate }}</span>
          <span v-if="item.author">
            <span v-if="longDate"> · </span>{{ item.author }}
          </span>
        </p>
      </div>

      <div
        v-if="contentHtml"
        class="st-module-feed-item-copy feed-copy text-[12px] leading-snug text-white/80"
        v-html="contentHtml"
      />
      <p v-else class="st-module-feed-item-empty text-[12px] text-white/55 italic">
        No summary available.
      </p>

      <div class="st-module-feed-item-actions flex flex-wrap items-center gap-2">
        <a
          :href="googleHeadlineUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="st-module-feed-item-action px-2 py-1 rounded-sm bg-black/85 hover:bg-black border border-white/10 text-[10px] uppercase tracking-wider text-white/80 hover:text-white transition-colors"
        >
          Search
        </a>
        <a
          v-if="item.url"
          :href="item.url"
          target="_blank"
          rel="noopener noreferrer"
          class="st-module-feed-item-open px-2 py-1 rounded-sm bg-[#0056b3] hover:bg-[#004494] text-[10px] uppercase tracking-wider text-white transition-colors"
        >
          Open
        </a>
        <button
          type="button"
          @click="emit('archive', item)"
          class="st-module-feed-item-action px-2 py-1 rounded-sm bg-black/85 hover:bg-black border border-white/10 text-[10px] uppercase tracking-wider text-white/80 hover:text-white transition-colors"
        >
          Archive
        </button>
        <span class="text-[10px] text-white/40 truncate">
          {{ domain }}
        </span>
      </div>
    </div>
  </article>
</template>

<style scoped>
.st-module-feed-item-header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  align-items: center;
  column-gap: 0.5rem;
}

.st-module-feed-item-toggle {
  min-width: 0;
}

.feed-copy :deep(p)  { margin: 0.25rem 0; }
.feed-copy :deep(hr) {
  margin: 0.75rem 0;
  border: 0;
  border-top: 1px solid rgba(255,255,255,0.12);
}
.feed-copy :deep(ul),
.feed-copy :deep(ol) { margin: 0.25rem 0; padding-left: 1.1rem; }
.feed-copy :deep(div) { min-width: 0; }
.feed-copy :deep(li) { line-height: 1.35; }
.feed-copy :deep(a)  { color: theme('colors.sky.400'); text-decoration: underline; }
.feed-copy :deep(code) {
  font-size: 11px;
  background: rgba(255,255,255,0.05);
  padding: 0 3px;
  border-radius: 2px;
}
</style>
