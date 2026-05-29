<script setup lang="ts">
import { remapNoteImageTokens } from '@/composables/useNoteImages'
import { refreshStaleFavicons } from '@/composables/useFavicon'
import { useLiveQuery } from '@/composables/useLiveQuery'
import { db, makeUpdatedAtPatch } from '@/db/db'
import type { AppSetting, Asset, Note, Page, Tab } from '@/types/db'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import Modal from './Modal.vue'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const { data: assets } = useLiveQuery(() => db.assets.toArray(), [] as Asset[])
const { data: tabs } = useLiveQuery(() => db.tabs.toArray(), [] as Tab[])
const { data: notes } = useLiveQuery(() => db.notes.toArray(), [] as Note[])
const { data: pages } = useLiveQuery(() => db.pages.toArray(), [] as Page[])
const { data: appSettings } = useLiveQuery(() => db.app_settings.toArray(), [] as AppSetting[])

const selectedAssetId = ref<number | null>(null)
const deleting = ref(false)
const refreshingFavicons = ref(false)

const orderedKinds: Array<Asset['kind']> = ['background', 'preview', 'note_image', 'favicon']

const groupedAssets = computed(() =>
  orderedKinds.map((kind) => ({
    kind,
    items: assets.value
      .filter((asset) => asset.kind === kind)
      .sort((a, b) => (b.id ?? 0) - (a.id ?? 0)),
  })),
)

const totalAssetSize = computed(() =>
  assets.value.reduce((sum, asset) => sum + asset.blob.size, 0),
)

const selectedAsset = computed(() =>
  assets.value.find((asset) => asset.id === selectedAssetId.value) ?? null,
)

const previewUrls = ref<Record<number, string>>({})

function revokePreviewUrls() {
  for (const url of Object.values(previewUrls.value)) {
    URL.revokeObjectURL(url)
  }
  previewUrls.value = {}
}

function kindLabel(kind: Asset['kind']) {
  switch (kind) {
    case 'background': return 'Backgrounds'
    case 'preview': return 'Bookmark Previews'
    case 'note_image': return 'Note Images'
    case 'favicon': return 'Favicons'
  }
}

function previewFrameClass(kind: Asset['kind']) {
  if (kind === 'favicon') return 'w-[44px] h-[44px]'
  if (kind === 'preview') return 'aspect-[98/56]'
  return 'aspect-[4/3]'
}

function previewImageClass(kind: Asset['kind']) {
  if (kind === 'favicon') return 'max-w-[32px] max-h-[32px] object-contain'
  if (kind === 'preview') return 'w-full h-full object-contain'
  return 'w-full h-full object-cover'
}

function previewSurfaceClass(kind: Asset['kind']) {
  if (kind === 'favicon') {
    return 'bg-[linear-gradient(45deg,rgba(255,255,255,0.08)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.08)_50%,rgba(255,255,255,0.08)_75%,transparent_75%,transparent)] bg-[length:12px_12px] bg-[#d7d7d7]'
  }
  return 'bg-black/30'
}

function formatBytes(blob: Blob) {
  const size = blob.size
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function formatByteCount(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function formatMeta(metaJson: string | null) {
  if (!metaJson) return null
  try {
    return JSON.stringify(JSON.parse(metaJson), null, 2)
  } catch {
    return metaJson
  }
}

function getReferenceSummary(assetId: number) {
  const counts = {
    backgrounds: 0,
    bookmarkFavicons: 0,
    bookmarkPreviews: 0,
    noteImages: 0,
  }

  for (const page of pages.value) {
    if (!page.config_json) continue
    try {
      const parsed = JSON.parse(page.config_json)
      if (parsed.background_asset_id === assetId) counts.backgrounds += 1
    } catch {
      // Ignore malformed page config.
    }
  }

  for (const setting of appSettings.value) {
    if (!setting.value_json) continue
    try {
      const parsed = JSON.parse(setting.value_json)
      if (parsed.background_asset_id === assetId) counts.backgrounds += 1
    } catch {
      // Ignore malformed settings payload.
    }
  }

  for (const tab of tabs.value) {
    if (tab.favicon_asset_id === assetId) counts.bookmarkFavicons += 1
    if (tab.preview_asset_id === assetId) counts.bookmarkPreviews += 1
  }

  for (const note of notes.value) {
    if (note.type !== 'html') continue
    if (note.content.includes(`{{asset:image:${assetId}}}`)) counts.noteImages += 1
  }

  return counts
}

async function deleteSelectedAsset() {
  const asset = selectedAsset.value
  if (!asset?.id || deleting.value) return
  if (!confirm('Delete this asset and clear any direct references to it?')) return

  deleting.value = true
  const assetId = asset.id
  const now = Date.now()

  try {
    await db.transaction('rw', [db.assets, db.tabs, db.notes, db.pages, db.app_settings], async () => {
      for (const tab of tabs.value) {
        const patch: Partial<Tab> = {}
        if (tab.favicon_asset_id === assetId) patch.favicon_asset_id = null
        if (tab.preview_asset_id === assetId) patch.preview_asset_id = null
        if (Object.keys(patch).length) {
          await db.tabs.update(tab.id!, { ...patch, ...makeUpdatedAtPatch(now) })
        }
      }

      for (const note of notes.value) {
        if (note.type !== 'html') continue
        const nextContent = remapNoteImageTokens(note.content, (id) => (id === assetId ? null : id))
        if (nextContent !== note.content) {
          await db.notes.update(note.id!, {
            content: nextContent,
            ...makeUpdatedAtPatch(now),
          })
        }
      }

      for (const page of pages.value) {
        if (!page.config_json) continue
        try {
          const parsed = JSON.parse(page.config_json)
          if (parsed.background_asset_id !== assetId) continue
          await db.pages.update(page.id!, {
            config_json: JSON.stringify({
              ...parsed,
              background_asset_id: null,
            }),
            ...makeUpdatedAtPatch(now),
          })
        } catch {
          // Ignore malformed page config.
        }
      }

      for (const setting of appSettings.value) {
        if (!setting.value_json) continue
        try {
          const parsed = JSON.parse(setting.value_json)
          if (parsed.background_asset_id !== assetId) continue
          await db.app_settings.update(setting.key, {
            value_json: JSON.stringify({
              ...parsed,
              background_asset_id: null,
            }),
            updated_at: now,
          })
        } catch {
          // Ignore malformed app setting payload.
        }
      }

      await db.assets.delete(assetId)
    })

    selectedAssetId.value = null
  } finally {
    deleting.value = false
  }
}

async function refreshFaviconAssets() {
  if (refreshingFavicons.value) return
  refreshingFavicons.value = true
  try {
    await refreshStaleFavicons()
  } finally {
    refreshingFavicons.value = false
  }
}

watch(
  () => assets.value.map((asset) => `${asset.id}:${asset.checksum}`).join('|'),
  async () => {
    revokePreviewUrls()
    const nextUrls: Record<number, string> = {}
    for (const asset of assets.value) {
      if (!asset.id) continue
      nextUrls[asset.id] = URL.createObjectURL(asset.blob)
    }
    previewUrls.value = nextUrls
  },
  { immediate: true },
)

watch(() => props.show, (show) => {
  if (show) return
  selectedAssetId.value = null
})

onBeforeUnmount(revokePreviewUrls)
</script>

<template>
  <Modal :show="show" title="Assets" @close="emit('close')">
    <template #title>
      Assets
      <span class="ml-1 text-[10px] font-normal text-white/55">
        (total: {{ assets.length }} assets, Size: {{ formatByteCount(totalAssetSize) }})
      </span>
    </template>

    <div class="space-y-4">
      <p class="text-[11px] text-white/60">
        Cached and uploaded images stored inside Speedtab. Click an item for details or delete it.
      </p>

      <div class="max-h-[70vh] overflow-y-auto space-y-5 pr-1">
        <section
          v-for="group in groupedAssets"
          :key="group.kind"
          class="space-y-2"
        >
          <div class="flex items-center justify-between">
            <h3 class="text-[11px] uppercase tracking-wider text-white/75">
              {{ kindLabel(group.kind) }}
            </h3>
            <div class="flex items-center gap-2">
              <button
                v-if="group.kind === 'favicon'"
                type="button"
                @click="refreshFaviconAssets"
                :disabled="refreshingFavicons"
                class="px-2 py-1 text-[10px] text-white/75 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors disabled:opacity-50"
              >
                {{ refreshingFavicons ? 'Refreshing…' : 'Refresh Assets' }}
              </button>
              <span class="text-[10px] text-white/45">{{ group.items.length }}</span>
            </div>
          </div>

          <div
            v-if="group.items.length"
            class="grid gap-2"
            :class="group.kind === 'favicon'
              ? 'grid-cols-[repeat(auto-fill,minmax(44px,44px))]'
              : 'grid-cols-[repeat(auto-fill,minmax(92px,1fr))]'"
          >
            <button
              v-for="asset in group.items"
              :key="asset.id"
              type="button"
              @click="selectedAssetId = asset.id ?? null"
              class="relative border border-white/10 bg-white/[0.04] hover:bg-white/[0.07] transition-colors text-left overflow-hidden"
            >
              <div
                class="flex items-center justify-center overflow-hidden"
                :class="[previewSurfaceClass(group.kind), previewFrameClass(group.kind)]"
              >
                <img
                  v-if="asset.id && previewUrls[asset.id]"
                  :src="previewUrls[asset.id]"
                  :alt="asset.kind"
                  :class="previewImageClass(group.kind)"
                />
              </div>
              <span
                v-if="group.kind !== 'favicon'"
                class="absolute right-1.5 bottom-1.5 px-1.5 py-0.5 text-[10px] leading-none text-white/90 bg-black/70 border border-white/10 rounded-sm"
                style="right: 0; bottom: 0; white-space: nowrap;"
              >
                {{ formatBytes(asset.blob) }}
              </span>
            </button>
          </div>

          <p v-else class="text-[11px] text-white/40 italic">No assets in this category.</p>
        </section>
      </div>
    </div>

    <Modal
      :show="selectedAsset !== null"
      title="Asset Details"
      @close="selectedAssetId = null"
    >
      <div v-if="selectedAsset" class="space-y-4">
        <div
          class="border border-white/10 overflow-hidden flex items-center justify-center"
          :class="[previewSurfaceClass(selectedAsset.kind), selectedAsset.kind === 'preview' ? 'aspect-[98/56]' : 'aspect-video']"
        >
          <img
            v-if="selectedAsset.id && previewUrls[selectedAsset.id]"
            :src="previewUrls[selectedAsset.id]"
            :alt="selectedAsset.kind"
            class="mx-auto my-auto"
            :class="selectedAsset.kind === 'favicon' ? 'max-w-[48px] max-h-[48px] object-contain' : 'w-full h-full object-contain'"
          />
        </div>

        <div class="grid grid-cols-2 gap-3 text-[11px]">
          <div>
            <div class="text-white/45 uppercase tracking-wider">Kind</div>
            <div class="text-white/90">{{ selectedAsset.kind }}</div>
          </div>
          <div>
            <div class="text-white/45 uppercase tracking-wider">ID</div>
            <div class="text-white/90">#{{ selectedAsset.id }}</div>
          </div>
          <div>
            <div class="text-white/45 uppercase tracking-wider">Size</div>
            <div class="text-white/90">{{ formatBytes(selectedAsset.blob) }}</div>
          </div>
          <div>
            <div class="text-white/45 uppercase tracking-wider">Dimensions</div>
            <div class="text-white/90">
              {{ selectedAsset.width && selectedAsset.height ? `${selectedAsset.width} × ${selectedAsset.height}` : 'Unknown' }}
            </div>
          </div>
        </div>

        <div class="space-y-1">
          <div class="text-[10px] text-white/45 uppercase tracking-wider">Checksum</div>
          <div class="text-[11px] font-mono text-white/85 break-all bg-black/25 border border-white/10 px-2 py-1.5">
            {{ selectedAsset.checksum }}
          </div>
        </div>

        <div class="space-y-1">
          <div class="text-[10px] text-white/45 uppercase tracking-wider">References</div>
          <div class="text-[11px] text-white/85 bg-black/25 border border-white/10 px-2 py-1.5 space-y-0.5">
            <div>Backgrounds: {{ getReferenceSummary(selectedAsset.id!).backgrounds }}</div>
            <div>Bookmark favicons: {{ getReferenceSummary(selectedAsset.id!).bookmarkFavicons }}</div>
            <div>Bookmark previews: {{ getReferenceSummary(selectedAsset.id!).bookmarkPreviews }}</div>
            <div>Note images: {{ getReferenceSummary(selectedAsset.id!).noteImages }}</div>
          </div>
        </div>

        <div v-if="formatMeta(selectedAsset.meta_json)" class="space-y-1">
          <div class="text-[10px] text-white/45 uppercase tracking-wider">Meta</div>
          <pre class="text-[11px] leading-snug text-white/80 bg-black/25 border border-white/10 px-2 py-1.5 overflow-x-auto whitespace-pre-wrap break-all">{{ formatMeta(selectedAsset.meta_json) }}</pre>
        </div>

        <div class="flex items-center justify-between pt-3 border-t border-white/10">
          <button
            type="button"
            @click="deleteSelectedAsset"
            :disabled="deleting"
            class="px-4 py-2 text-xs bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white transition-colors"
          >
            {{ deleting ? 'Deleting…' : 'Delete Asset' }}
          </button>

          <button
            type="button"
            @click="selectedAssetId = null"
            class="px-4 py-2 text-xs text-white/70 hover:text-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  </Modal>
</template>
