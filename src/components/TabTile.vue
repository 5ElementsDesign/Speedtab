<script setup lang="ts">
import { useFavicon } from '@/composables/useFavicon';
import { db } from '@/db/db';
import type { Tab } from '@/types/db';
import { computed, onUnmounted, ref, watch } from 'vue';

const props = defineProps<{
  tab:          Tab
  openInNewTab: boolean
  quicklinks?:  boolean
  forceFavicon?: boolean
  showHoverActions?: boolean
  isSearchHighlighted?: boolean
  isDragging?:  boolean
  isDragOver?:  boolean
}>()

const emit = defineEmits<{
  edit:   [tab: Tab]
  delete: [tab: Tab]
}>()

const { getFaviconUrl } = useFavicon()

// ─── Preview image (lazy-loaded blob → Object URL) ────────────────────────────

const previewUrl = ref<string | null>(null)
const faviconAssetUrl = ref<string | null>(null)
let   previewObjectUrl:  string | null = null
let   faviconObjectUrl: string | null = null

watch(
  () => props.tab.preview_asset_id,
  async (id) => {
    if (previewObjectUrl) { URL.revokeObjectURL(previewObjectUrl); previewObjectUrl = null }
    previewUrl.value = null
    if (!id) return
    const asset = await db.assets.get(id)
    if (!asset?.blob) return
    previewObjectUrl = URL.createObjectURL(asset.blob)
    previewUrl.value = previewObjectUrl
  },
  { immediate: true },
)

watch(
  () => props.tab.favicon_asset_id,
  async (id) => {
    if (faviconObjectUrl) { URL.revokeObjectURL(faviconObjectUrl); faviconObjectUrl = null }
    faviconAssetUrl.value = null
    if (!id) return
    const asset = await db.assets.get(id)
    if (!asset?.blob) return
    faviconObjectUrl = URL.createObjectURL(asset.blob)
    faviconAssetUrl.value = faviconObjectUrl
  },
  { immediate: true },
)

onUnmounted(() => {
  if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl)
  if (faviconObjectUrl) URL.revokeObjectURL(faviconObjectUrl)
})

// ─── Favicon fallback ─────────────────────────────────────────────────────────
// `chrome://favicon2/` is restricted to the browser's internal NTP and not
// loadable from an extension page. We use a public hostname-based favicon
// provider keyed by the URL's hostname instead.

const faviconUrl = computed(() => {
  return faviconAssetUrl.value || getFaviconUrl(props.tab.url)
})

const tileClass = computed(() =>
  props.quicklinks
    ? 'w-[54px] h-[54px]'
    : 'w-[106px] h-[60px]'
)

const faviconClass = computed(() =>
  props.quicklinks
    ? 'w-[var(--st-module-content-quicklink-icon-size)] h-[var(--st-module-content-quicklink-icon-size)] object-contain'
    : 'w-[var(--st-module-content-bookmark-favicon-size)] h-[var(--st-module-content-bookmark-favicon-size)] object-contain'
)

const actionRevealClass = computed(() =>
  props.quicklinks
    ? 'delay-150 group-hover:delay-150'
    : ''
)

const showPreviewImage = computed(() =>
  !!previewUrl.value && !(props.quicklinks && props.forceFavicon)
)
</script>

<template>
  <!--
    Outer anchor: clicking the tile opens the bookmark in a new tab.
    Dimensions are enforced with explicit Tailwind utilities (w-[98px] h-[56px]).
    The group class enables hover-based control visibility.
  -->
  <a
    :href="tab.url"
    :target="openInNewTab ? '_blank' : undefined"
    :rel="openInNewTab ? 'noopener noreferrer' : undefined"
    class="st-content-trigger-button st-trigger-tab group relative block overflow-hidden
           st-bookmark-trigger-surface border hover:border-[#00d2ff]
           transition-colors shrink-0 focus:outline-none focus-visible:ring-1
           focus-visible:ring-[#00d2ff] cursor-grab active:cursor-grabbing"
    :class="[
      tileClass,
      props.isSearchHighlighted ? 'ring-1 ring-red-500 shadow-[0_0_0_1px_rgba(239,68,68,0.95),0_0_16px_rgba(239,68,68,0.35)] border-red-400' : '',
      isDragging ? 'opacity-30' : '',
      isDragOver && !isDragging ? 'ring-1 ring-[#00d2ff] border-[#00d2ff]' : '',
    ]"
    :title="tab.title || tab.url"
  >
    <!-- ① Custom preview image (WebP blob stored in IndexedDB) -->
    <img
      v-if="showPreviewImage"
      :src="previewUrl || undefined"
      alt=""
      class="absolute inset-0 w-full h-full object-cover st-bookmark-image-surface"
      draggable="false"
    />

    <!-- ② Chrome favicon fallback — centered and scaled inside the tile -->
    <div v-else class="absolute inset-0 flex items-center justify-center st-bookmark-image-surface">
      <img
        :src="faviconUrl"
        alt=""
        :class="faviconClass"
        draggable="false"
        @error="($event.target as HTMLImageElement).style.display = 'none'"
      />
    </div>

    <!-- Hover overlay: dimmed scrim + title + action buttons -->
    <div
      class="absolute inset-0 flex flex-col justify-between p-[3px]
             bg-black/0 group-hover:bg-black/50 transition-colors"
    >
      <!-- Title (only readable after hover) -->
      <p class="text-[9px] leading-tight text-white/0 group-hover:text-white/90
                font-medium truncate transition-colors">
        {{ tab.title || tab.url }}
      </p>

      <!-- Action buttons — appear on hover only -->
      <div
        v-if="props.showHoverActions !== false"
        class="flex items-center justify-end gap-0.5
               opacity-0 group-hover:opacity-100 transition-opacity"
        :class="actionRevealClass"
      >
        <button
          @click.prevent.stop="emit('edit', tab)"
          class="p-[3px] rounded hover:bg-white/25 text-white/70 hover:text-white transition-colors"
          title="Edit bookmark"
        >
          <svg class="w-[10px] h-[10px]" viewBox="0 0 20 20" fill="currentColor">
            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
          </svg>
        </button>
        <button
          @click.prevent.stop="emit('delete', tab)"
          class="p-[3px] rounded hover:bg-red-500/40 text-white/70 hover:text-red-300 transition-colors"
          title="Delete bookmark"
        >
          <svg class="w-[10px] h-[10px]" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  </a>
</template>
