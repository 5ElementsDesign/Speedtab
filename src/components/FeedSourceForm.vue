<script setup lang="ts">
import { useFeed } from '@/composables/useFeed';
import type { FeedSource, PortableInput } from '@/types/db';
import { computed, ref, watch } from 'vue';

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
const discoveredFeeds = ref<Array<{ url: string; title: string }>>([])
const lookupStatus = ref<string | null>(null)

const isTesting = ref(false)
const isLookingUp = ref(false)
const testError = ref<string | null>(null)
const testSuccess = ref(false)
const lastTestedUrl = ref(props.source?.feed_url || '')

watch(feedUrl, () => {
  testError.value = null
  if (feedUrl.value !== lastTestedUrl.value) {
    testSuccess.value = false
  }
})

watch(siteUrl, () => {
  lookupStatus.value = null
  discoveredFeeds.value = []
})

function normalizeDiscoveredFeeds(urls: Array<{ url: string; title: string }>) {
  const seen = new Set<string>()
  return urls.filter((entry) => {
    if (seen.has(entry.url)) return false
    seen.add(entry.url)
    return true
  })
}

function deriveLookupBaseUrl(url: string) {
  try {
    const parsed = new URL(url.trim())
    return `${parsed.origin}/`
  } catch {
    return url.trim()
  }
}

function isLikelyFeedUrl(url: string) {
  return /(feedburner|rss|atom|feed|xml)/i.test(url)
}

function pushDiscoveredFeed(
  candidates: Array<{ url: string; title: string }>,
  href: string,
  baseUrl: string,
  title: string,
) {
  try {
    const absoluteUrl = new URL(href, baseUrl).toString()
    if (!isLikelyFeedUrl(absoluteUrl)) return
    candidates.push({
      url: absoluteUrl,
      title: title.trim() || absoluteUrl,
    })
  } catch {
    // Ignore malformed discovered URLs.
  }
}

function discoverFeedCandidates(html: string, baseUrl: string): Array<{ url: string; title: string }> {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const declaredCandidates: Array<{ url: string; title: string }> = []
  const linkedCandidates: Array<{ url: string; title: string }> = []
  const guessedCandidates: Array<{ url: string; title: string }> = []

  doc.querySelectorAll('link[rel~="alternate"]').forEach((node) => {
    const href = node.getAttribute('href')
    const type = (node.getAttribute('type') ?? '').toLowerCase()
    if (!href || !/(rss|atom|xml)/.test(type)) return
    pushDiscoveredFeed(
      declaredCandidates,
      href,
      baseUrl,
      node.getAttribute('title')?.trim() || href,
    )
  })

  doc.querySelectorAll('a[href]').forEach((node) => {
    const href = node.getAttribute('href')
    if (!href) return
    const label = node.textContent?.replace(/\s+/g, ' ').trim()
      || node.getAttribute('title')
      || href
    pushDiscoveredFeed(linkedCandidates, href, baseUrl, label)
  })

  try {
    const base = new URL(baseUrl)
    const commonPaths = ['/feed', '/feed.xml', '/rss', '/rss.xml', '/atom.xml']
    for (const path of commonPaths) {
      guessedCandidates.push({
        url: new URL(path, `${base.origin}/`).toString(),
        title: path.replace(/^\//, ''),
      })
    }
  } catch {
    // Ignore malformed input URL.
  }

  const realCandidates = normalizeDiscoveredFeeds([
    ...declaredCandidates,
    ...linkedCandidates,
  ])

  if (realCandidates.length > 0) {
    return realCandidates
  }

  return normalizeDiscoveredFeeds(guessedCandidates)
}

async function testConnection() {
  if (!feedUrl.value) return
  isTesting.value = true
  testError.value = null
  testSuccess.value = false

  try {
    const normalizedTestUrl = new URL(feedUrl.value.trim()).toString()
    lastTestedUrl.value = normalizedTestUrl
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
    if (!siteUrl.value.trim() && feedUrl.value.trim()) {
      siteUrl.value = deriveLookupBaseUrl(feedUrl.value)
    }
  } finally {
    isTesting.value = false
  }
}

async function lookupFeeds() {
  const lookupUrl = siteUrl.value.trim()
  if (!lookupUrl) return

  isLookingUp.value = true
  lookupStatus.value = null
  discoveredFeeds.value = []

  try {
    const response = await chrome.runtime.sendMessage({ type: 'FETCH_URL_CONTENT', url: lookupUrl })
    if (!response?.ok) {
      throw new Error(response?.error || 'Failed to inspect URL')
    }

    const finalUrl = response.finalUrl || lookupUrl
    const contentType = (response.contentType ?? '').toLowerCase()
    if (!contentType.includes('text/html')) {
      lookupStatus.value = 'Lookup expects a homepage or website URL that returns HTML.'
      return
    }
    const html = typeof response.html === 'string' ? response.html : ''
    const candidates = discoverFeedCandidates(html, finalUrl)

    if (!candidates.length) {
      lookupStatus.value = 'No feed links were discovered on this page.'
      return
    }

    lookupStatus.value = `Found ${candidates.length} possible feed${candidates.length === 1 ? '' : 's'}.`
    discoveredFeeds.value = candidates
  } catch (err: unknown) {
    lookupStatus.value = err instanceof Error ? err.message : 'Feed lookup failed'
  } finally {
    isLookingUp.value = false
  }
}

async function useDiscoveredFeed(url: string) {
  feedUrl.value = url
  testError.value = null
  testSuccess.value = false
  await testConnection()
}

function handleSave() {
  if (!title.value || !feedUrl.value || !canSave.value) return

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

const canSave = computed(() =>
  !!title.value &&
  !!feedUrl.value &&
  testSuccess.value &&
  feedUrl.value === lastTestedUrl.value
)
</script>

<template>
  <form @submit.prevent="handleSave" class="flex flex-col gap-4">
    <div>
      <div class="mb-1 flex items-center justify-between gap-3">
        <label for="feed_source_url" class="block text-[10px] uppercase tracking-wider font-bold text-gray-500">Feed URL</label>
        <a
          v-if="lastTestedUrl"
          :href="lastTestedUrl"
          :title="lastTestedUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="text-[9px] uppercase tracking-wider font-bold text-sky-300 hover:text-sky-200 transition-colors"
        >
          Open URL
        </a>
      </div>
      <div class="flex gap-2">
        <input
          id="feed_source_url"
          v-model="feedUrl"
          type="url"
          placeholder="https://example.com/feed.xml"
          required
          class="flex-1 bg-surface-950 text-white placeholder:text-white/35 border border-white/10 rounded px-2 py-1.5 text-xs focus:border-indigo-500 outline-none transition-colors"
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
      <p v-else-if="!testError" class="mt-1 text-[10px] text-white/45">Test this URL before saving to make sure it is reachable and subscribable.</p>
      <div v-if="discoveredFeeds.length" class="mt-2 border-t border-white/10 pt-2">
        <p v-if="lookupStatus" class="text-[10px] text-white/65">{{ lookupStatus }}</p>
        <div class="flex max-h-[300px] flex-col gap-1 overflow-auto">
          <button
            v-for="candidate in discoveredFeeds"
            :key="candidate.url"
            type="button"
            @click="useDiscoveredFeed(candidate.url)"
            class="text-left px-2 py-1 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 rounded transition-colors"
          >
            <span class="block text-[10px] text-white/85 truncate">{{ candidate.title }}</span>
            <span class="block text-[10px] text-sky-300 truncate">{{ candidate.url }}</span>
          </button>
        </div>
      </div>
    </div>

    <div>
      <label for="feed_source_title" class="block text-[10px] uppercase tracking-wider font-bold text-gray-500 mb-1">Display Title</label>
      <input
        id="feed_source_title"
        v-model="title"
        type="text"
        placeholder="Feed Title"
        required
        class="w-full bg-surface-950 text-white placeholder:text-white/35 border border-white/10 rounded px-2 py-1.5 text-xs focus:border-indigo-500 outline-none transition-colors"
      />
    </div>

    <div>
      <label for="feed_source_site_url" class="block text-[10px] uppercase tracking-wider font-bold text-gray-500 mb-1">Site URL (Optional)</label>
      <div class="flex gap-2">
        <input
          id="feed_source_site_url"
          v-model="siteUrl"
          type="url"
          placeholder="https://example.com"
          class="flex-1 bg-surface-950 text-white placeholder:text-white/35 border border-white/10 rounded px-2 py-1.5 text-xs focus:border-indigo-500 outline-none transition-colors"
        />
        <button
          type="button"
          @click="lookupFeeds"
          :disabled="isLookingUp || !siteUrl"
          class="px-3 py-1.5 bg-black/85 hover:bg-black border border-white/10 rounded text-[10px] uppercase tracking-wider font-bold text-white/85 hover:text-white transition-colors disabled:opacity-50"
        >
          {{ isLookingUp ? '...' : 'Lookup' }}
        </button>
      </div>
      <p class="mt-1 text-[10px] text-white/45">Use the homepage here to discover feed links without overwriting the feed URL field.</p>
      <p v-if="lookupStatus && !discoveredFeeds.length" class="mt-1 text-[10px] text-white/65">{{ lookupStatus }}</p>
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
          :disabled="!canSave"
          :class="canSave ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : 'bg-white/10 text-white/45 cursor-not-allowed'"
          class="px-4 py-1.5 rounded text-[10px] uppercase tracking-wider font-bold transition-colors"
        >
          Save Feed
        </button>
      </div>
    </div>
  </form>
</template>
