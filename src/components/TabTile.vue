<script setup lang="ts">
import { useFavicon } from '@/composables/useFavicon';
import { db } from '@/db/db';
import type { Tab } from '@/types/db';
import { computed, onUnmounted, ref, watch } from 'vue';

const props = defineProps<{
  tab:          Tab
  openInNewTab: boolean
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
let   objectUrl:  string | null = null

watch(
  () => props.tab.preview_asset_id,
  async (id) => {
    if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null }
    previewUrl.value = null
    if (!id) return
    const asset = await db.assets.get(id)
    if (!asset?.blob) return
    objectUrl        = URL.createObjectURL(asset.blob)
    previewUrl.value = objectUrl
  },
  { immediate: true },
)

onUnmounted(() => { if (objectUrl) URL.revokeObjectURL(objectUrl) })

// ─── Favicon fallback ─────────────────────────────────────────────────────────
// `chrome://favicon2/` is restricted to the browser's internal NTP and not
// loadable from an extension page. We use a public hostname-based favicon
// provider keyed by the URL's hostname instead.

const faviconUrl = computed(() => {
  return getFaviconUrl(props.tab.url)
})
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
    class="group relative block w-[98px] h-[56px] overflow-hidden
           bg-white border border-[#dbdbdb] hover:border-[#00d2ff]
           transition-colors shrink-0 focus:outline-none focus-visible:ring-1
           focus-visible:ring-[#00d2ff] cursor-grab active:cursor-grabbing"
    :class="[
      isDragging ? 'opacity-30' : '',
      isDragOver && !isDragging ? 'ring-1 ring-[#00d2ff] border-[#00d2ff]' : '',
    ]"
    :title="tab.title || tab.url"
  >
    <!-- ① Custom preview image (WebP blob stored in IndexedDB) -->
    <img
      v-if="previewUrl"
      :src="previewUrl"
      :alt="tab.title"
      class="absolute inset-0 w-full h-full object-cover"
      draggable="false"
    />

    <!-- ② Chrome favicon fallback — centered and scaled inside the tile -->
    <div v-else class="absolute inset-0 flex items-center justify-center">
      <img
        :src="faviconUrl"
        :alt="tab.title"
        class="w-8 h-8 object-contain"
        draggable="false"
        @error="($event.target as HTMLImageElement).style.display = 'none'"
      />
    </div>

    <!-- Hover overlay: dimmed scrim + title + action buttons -->
    <div
      class="absolute inset-0 flex flex-col justify-between p-[3px]
             bg-black/0 group-hover:bg-black/65 transition-colors"
    >
      <!-- Title (only readable after hover) -->
      <p class="text-[9px] leading-tight text-white/0 group-hover:text-white/90
                font-medium truncate transition-colors">
        {{ tab.title || tab.url }}
      </p>

      <!-- Action buttons — appear on hover only -->
      <div class="flex items-center justify-end gap-0.5
                  opacity-0 group-hover:opacity-100 transition-opacity">
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
