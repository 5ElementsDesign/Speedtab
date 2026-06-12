<script setup lang="ts">
import { useFavicon } from '@/composables/useFavicon';
import { useLocaleFormatters } from '@/composables/useLocaleFormatters';
import { sanitizeHtml } from '@/composables/useSanitize';
import type { FeedItem } from '@/types/db';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{
  item: FeedItem
  sourceTitle: string
  searchUrlTemplate?: string
  isNewlyFetched?: boolean
  expanded?: boolean
  showYoutubeDescription?: boolean
}>()

const { getFaviconUrl } = useFavicon()
const { t } = useI18n()
const { formatDate, formatDateTime, formatNumber } = useLocaleFormatters()

const formattedDate = computed(() => {
  if (!props.item.published_at) return ''
  const date = new Date(props.item.published_at)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`

  return formatDate(date, { month: 'short', day: 'numeric' })
})

const longDate = computed(() => {
  if (!props.item.published_at) return ''
  return formatDateTime(props.item.published_at)
})

const domain = computed(() => {
  if (!props.item.url) return ''
  try {
    return new URL(props.item.url).hostname.replace('www.', '')
  } catch {
    return ''
  }
})

const displaySource = computed(() => props.sourceTitle || domain.value || t('feedItem.fallbackSource'))

const faviconUrl = computed(() => {
  return getFaviconUrl(props.item.url)
})

const contentHtml = computed(() => {
  const raw = props.item.content || props.item.summary || ''
  return raw ? sanitizeHtml(raw) : ''
})

function normalizeMediaUrl(value: string | null | undefined): string | null {
  const raw = value?.trim()
  if (!raw) return null
  try {
    const url = new URL(raw)
    if (url.protocol === 'http:' || url.protocol === 'https:') return url.toString()
  } catch {
    return null
  }
  return null
}

function extractFirstMediaUrl(rawHtml: string): string | null {
  if (!rawHtml) return null
  try {
    const doc = new DOMParser().parseFromString(rawHtml, 'text/html')
    const imageUrl = doc.querySelector('img[src]')?.getAttribute('src')
    return normalizeMediaUrl(imageUrl)
  } catch {
    return null
  }
}

const firstMediaUrl = computed(() => {
  return extractFirstMediaUrl(props.item.content || props.item.summary || '')
})

type YoutubePayload = {
  kind: 'youtube'
  video_id: string
  channel_id: string | null
  thumbnail_url: string | null
  description: string | null
  view_count: number | null
  star_count: number | null
}

const youtubePayload = computed<YoutubePayload | null>(() => {
  if (!props.item.payload_json) return null
  try {
    const parsed = JSON.parse(props.item.payload_json)
    return parsed?.kind === 'youtube' && typeof parsed?.video_id === 'string'
      ? parsed as YoutubePayload
      : null
  } catch {
    return null
  }
})

const youtubeWatchUrl = computed(() => {
  if (!youtubePayload.value) return props.item.url
  return `https://www.youtube.com/watch?v=${encodeURIComponent(youtubePayload.value.video_id)}`
})

const youtubeDescriptionHtml = computed(() => {
  const raw = youtubePayload.value?.description?.trim() || ''
  return raw ? sanitizeHtml(raw.replace(/\n/g, '<br>')) : ''
})

const youtubeViewCountLabel = computed(() => {
  const views = youtubePayload.value?.view_count
  return typeof views === 'number' && Number.isFinite(views)
    ? formatNumber(views)
    : null
})

const youtubeStarCountLabel = computed(() => {
  const stars = youtubePayload.value?.star_count
  return typeof stars === 'number' && Number.isFinite(stars)
    ? formatNumber(stars)
    : null
})

const googleHeadlineUrl = computed(() => {
  const query = encodeURIComponent(props.item.title)
  const template = props.searchUrlTemplate?.trim() || 'https://www.google.com/search?q=%s'
  return template.includes('%s')
    ? template.replace(/%s/g, query)
    : `${template}${template.includes('?') ? '&' : '?'}q=${query}`
})

</script>

<template>
  <article
    class="st-module-feed-item w-full min-w-0 border-b"
    :data-feed-item-id="item.id"
    :data-read="item.read_at != null ? 'true' : 'false'"
    :data-newly-fetched="props.isNewlyFetched ? 'true' : 'false'"
  >
    <div
      class="st-module-feed-item-header group w-full min-w-0 transition-colors pr-1"
      :data-expanded="props.expanded ? 'true' : 'false'"
    >
      <div
        class="st-module-feed-item-icon shrink-0 rounded-sm border flex items-center justify-center"
        :title="displaySource"
      >
        <img
          v-if="faviconUrl"
          :src="faviconUrl"
          alt=""
          class="w-full h-full bg-white object-contain"
          draggable="false"
        />
      </div>

      <button
        type="button"
        data-click="toggleFeedItem"
        class="st-module-feed-item-toggle min-w-0 w-full h-full text-left"
        :aria-expanded="props.expanded"
        :title="`${displaySource} · ${item.title}`"
      >
        <span
          class="st-module-feed-item-title block min-w-0 text-[11px] truncate leading-none transition-colors"
          :class="props.expanded ? 'opacity-0 select-none' : ''"
          :title="item.title"
          aria-hidden="true"
        >
          {{ item.title }}
        </span>
      </button>

      <span
        class="st-module-feed-item-read-indicator shrink-0 text-[12px] uppercase tracking-wider leading-none"
        :class="item.read_at != null ? 'opacity-70' : 'opacity-0'"
        aria-hidden="true"
      >
        {{ t('feedItem.read') }}
      </span>

      <span class="st-module-feed-item-date shrink-0 text-[9px] font-mono leading-none" :title="longDate">
        {{ formattedDate }}
      </span>

      <button
        type="button"
        data-click="archiveFeedItem"
        class="st-module-feed-item-save shrink-0 text-[9px] transition-colors px-1.5 py-0.5 rounded-sm border"
        :title="t('feedItem.archiveThisItem')"
        :aria-label="t('feedItem.archiveThisItem')"
      >
        {{ t('feedItem.save') }}
      </button>
    </div>

    <div
      v-if="props.expanded"
      class="st-module-feed-item-body border-t"
      :class="youtubePayload ? 'p-0 space-y-0' : 'px-4 py-4 space-y-3'"
    >
      <template v-if="youtubePayload">
        <a
          :href="youtubeWatchUrl || item.url || '#'"
          target="_blank"
          rel="noopener noreferrer"
          class="st-module-feed-item-youtube-video relative bg-[#222] block overflow-hidden flex items-center justify-center"
        >
          <img
            v-if="youtubePayload.thumbnail_url"
            :src="youtubePayload.thumbnail_url"
            :alt="item.title"
            class="max-w-full max-h-full object-contain mx-auto my-auto"
            loading="lazy"
            draggable="false"
          />
          <div class="absolute inset-0 bg-black/25 flex items-center justify-center">
            <div class="w-16 h-11 rounded-xl bg-red-600/90 flex items-center justify-center shadow-lg">
              <svg viewBox="0 0 24 24" class="w-7 h-7 text-white" fill="currentColor" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        </a>

        <div class="st-module-feed-item-youtube-bar p-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[10px]">
          <span class="st-module-feed-item-byline">{{ item.author || displaySource }}</span>
          <span v-if="longDate" class="st-module-feed-item-domain">{{ longDate }}</span>
          <span v-if="youtubeViewCountLabel" class="st-module-feed-item-domain">{{ t('feedItem.views', { count: youtubeViewCountLabel }) }}</span>
          <span v-if="youtubeStarCountLabel" class="st-module-feed-item-domain">{{ t('feedItem.likes', { count: youtubeStarCountLabel }) }}</span>
        </div>

        <div class="st-module-feed-item-actions flex flex-wrap items-center gap-2 px-3 pb-3">
          <a
            :href="youtubeWatchUrl || item.url || '#'"
            target="_blank"
            rel="noopener noreferrer"
            class="st-module-feed-item-open px-2 py-1 rounded-sm text-[10px] uppercase tracking-wider transition-colors"
          >
            {{ t('feeds.open') }}
          </a>
          <button
            v-if="youtubeDescriptionHtml"
            type="button"
            data-click="toggleFeedItemDescription"
            class="st-module-feed-item-action px-2 py-1 rounded-sm border text-[10px] uppercase tracking-wider transition-colors"
          >
            {{ props.showYoutubeDescription ? t('feedItem.hideDescription') : t('feedItem.description') }}
          </button>
          <button
            type="button"
            data-click="archiveFeedItem"
            class="st-module-feed-item-action px-2 py-1 rounded-sm border text-[10px] uppercase tracking-wider transition-colors"
          >
            {{ t('feedItem.archive') }}
          </button>
          <a
            :href="googleHeadlineUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="st-module-feed-item-action px-2 py-1 rounded-sm border text-[10px] uppercase tracking-wider transition-colors"
          >
            {{ t('feedItem.search') }}
          </a>
        </div>

        <div
          v-if="props.showYoutubeDescription && youtubeDescriptionHtml"
          class="st-module-feed-item-youtube-description p-3 border-t text-[12px] leading-snug"
          v-html="youtubeDescriptionHtml"
        />
      </template>

      <template v-else>
      <div class="st-module-feed-item-meta space-y-1">
        <h3 class="st-module-feed-item-heading text-[13px] font-semibold leading-snug">{{ item.title }}</h3>
        <p class="st-module-feed-item-byline text-[10px]">
          <span v-if="longDate">{{ longDate }}</span>
          <span v-if="item.author">
            <span v-if="longDate"> · </span>{{ item.author }}
          </span>
        </p>
      </div>

      <img
        v-if="firstMediaUrl"
        :src="firstMediaUrl"
        :alt="item.title"
        class="st-module-feed-item-media"
        loading="lazy"
        draggable="false"
      />

      <div
        v-if="contentHtml"
        class="st-module-feed-item-copy feed-copy text-[12px] leading-snug"
        v-html="contentHtml"
      />
      <p v-else class="st-module-feed-item-empty text-[12px] italic">
        {{ t('feedItem.noSummary') }}
      </p>

      <div class="st-module-feed-item-actions flex flex-wrap items-center gap-2 leading-none">
        <a
          :href="googleHeadlineUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="st-module-feed-item-action px-2 py-2 rounded-sm border text-[10px] uppercase tracking-wider transition-colors"
        >
          {{ t('feedItem.search') }}
        </a>
        <a
          v-if="item.url"
          :href="item.url"
          target="_blank"
          rel="noopener noreferrer"
          class="st-module-feed-item-open px-2 py-2 rounded-sm border text-[10px] uppercase tracking-wider transition-colors"
        >
          {{ t('feedItem.open') }}
        </a>
        <button
          type="button"
          data-click="archiveFeedItem"
          class="st-module-feed-item-action px-2 py-2 rounded-sm border text-[10px] uppercase tracking-wider transition-colors"
        >
          {{ t('feedItem.archive') }}
        </button>
        <span class="st-module-feed-item-domain text-[10px] truncate">
          {{ domain }}
        </span>
      </div>
      </template>
    </div>
  </article>
</template>

<style scoped>
.st-module-feed-item-header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto auto;
  align-items: center;
  column-gap: 0.5rem;
}

.st-module-feed-item-toggle {
  min-width: 0;
}

.st-module-feed-item-title {
  color: var(--st-feed-item-text);
}

.group:hover .st-module-feed-item-title,
.st-module-feed-item-header[data-expanded='true'] .st-module-feed-item-title {
  color: var(--st-feed-item-text);
}

.st-module-feed-item[data-read='true'] .st-module-feed-item-title {
  color: var(--st-feed-item-text-dim);
}

.st-module-feed-item[data-read='true'] .group:hover .st-module-feed-item-title {
  color: var(--st-feed-item-text-muted);
}

.st-module-feed-item[data-read='true'] .st-module-feed-item-date {
  color: rgba(255, 255, 255, 0.28);
}

.st-module-feed-item[data-read='true'] .st-module-feed-item-read-indicator {
  color: rgba(255, 255, 255, 0.48);
}

.st-module-feed-item-domain {
  color: var(--st-feed-item-text-muted);
}

.st-module-feed-item-media {
  display: block;
  width: 100%;
  max-width: 400px;
  height: auto;
  border-radius: 0.125rem;
  box-shadow: 0 0 4px var(--st-feed-item-text-muted);
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

.st-module-feed-item-youtube-video {
  width: 100%;
  aspect-ratio: 4 / 3;
  max-height: 360px;
}
</style>
