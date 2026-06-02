<script setup lang="ts">
import { computed, ref, watch, nextTick, onBeforeUnmount } from 'vue'
import type { Asset, PortableInput, Tab } from '@/types/db'
import { TILE_W, TILE_H, storeOrGetAsset, canvasToWebpBlob, loadAssetObjectUrl } from '@/composables/useAsset'
import { ensureFaviconAssetIdForUrl } from '@/composables/useFavicon'
import { useLiveQuery } from '@/composables/useLiveQuery'
import { db } from '@/db/db'

type CropperInstance = import('cropperjs').default
type CropperConstructor = typeof import('cropperjs').default

let cropperLoaderPromise: Promise<CropperConstructor> | null = null

async function loadCropper() {
  if (!cropperLoaderPromise) {
    cropperLoaderPromise = Promise.all([
      import('cropperjs'),
      import('cropperjs/dist/cropper.css'),
    ]).then(([mod]) => mod.default)
  }
  return cropperLoaderPromise
}

const props = defineProps<{
  tab?:         Tab
  collectionId: number
}>()

const emit = defineEmits<{
  save:   [data: PortableInput<Tab>]
  delete: [id: number]
  cancel: []
}>()

// ─── Form state ───────────────────────────────────────────────────────────────

const form = ref({
  url:   props.tab?.url         ?? '',
  title: props.tab?.title       ?? '',
})
const isTesting = ref(false)
const testError = ref<string | null>(null)
const testSuccess = ref(false)
const lastTestedUrl = ref(props.tab?.url ?? '')
const urlStatusMessage = computed(() => {
  if (testError.value) return testError.value
  if (testSuccess.value) return 'URL is reachable.'
  return 'Click test to check connectivity'
})
const urlStatusClass = computed(() =>
  testError.value ? 'text-red-400' : testSuccess.value ? 'text-green-400' : 'text-white/40'
)

watch(() => form.value.url, () => {
  testError.value = null
  if (form.value.url !== lastTestedUrl.value) {
    testSuccess.value = false
  }
})

type UrlMetaResponse = {
  ok: boolean
  title?: string | null
  finalUrl?: string
  error?: string
}

async function fetchUrlMetaDirect(url: string): Promise<UrlMetaResponse> {
  const response = await fetch(url, { redirect: 'follow' })
  if (!response.ok) {
    return { ok: false, error: `HTTP ${response.status}: ${response.statusText}` }
  }

  const contentType = response.headers.get('content-type') ?? ''
  const finalUrl = response.url || url
  if (!contentType.includes('text/html')) {
    return { ok: true, title: null, finalUrl }
  }

  const html = await response.text()
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return {
    ok: true,
    finalUrl,
    title: titleMatch?.[1]?.replace(/\s+/g, ' ').trim() || null,
  }
}

async function testUrl() {
  if (!form.value.url) return

  testError.value = null
  testSuccess.value = false

  let normalizedUrl: string
  try {
    normalizedUrl = new URL(form.value.url).toString()
  } catch {
    testError.value = 'Please enter a valid URL.'
    return
  }

  isTesting.value = true
  try {
    const backgroundResponse = await chrome.runtime.sendMessage({
      type: 'FETCH_URL_META',
      url: normalizedUrl,
    }) as UrlMetaResponse | undefined

    const response = backgroundResponse && typeof backgroundResponse.ok === 'boolean'
      ? backgroundResponse
      : await fetchUrlMetaDirect(normalizedUrl)

    if (!response.ok) {
      throw new Error(response.error || 'Failed to reach URL')
    }

    form.value.url = response.finalUrl || normalizedUrl
    if ((!form.value.title || !form.value.title.trim()) && response.title) {
      form.value.title = response.title
    }
    testSuccess.value = true
    lastTestedUrl.value = form.value.url
  } catch (err: unknown) {
    testError.value = err instanceof Error ? err.message : 'Failed to test URL'
  } finally {
    isTesting.value = false
  }
}

// ─── Cropper pipeline ─────────────────────────────────────────────────────────

const fileInput      = ref<HTMLInputElement | null>(null)
const cropperImgEl   = ref<HTMLImageElement  | null>(null)
const imageDataUrl   = ref<string | null>(null)  // raw file data URL → shows cropper
const croppedBlobUrl = ref<string | null>(null)  // object URL of final crop preview
const selectedPreviewAssetId = ref<number | null>(props.tab?.preview_asset_id ?? null)
const selectedPreviewAssetUrl = ref<string | null>(null)
const isAssetPickerOpen = ref(false)
const pickerPreviewUrls = ref<Record<number, string>>({})
let   croppedBlob:      Blob | null = null
let   cropperInstance:  CropperInstance | null = null

const { data: reusableAssets } = useLiveQuery(
  () => db.assets
    .where('kind')
    .anyOf(['preview', 'background', 'note_image'])
    .toArray(),
  [] as Asset[]
)

const groupedReusableAssets = computed(() => ([
  { kind: 'preview', label: 'Bookmark Previews' },
  { kind: 'background', label: 'Backgrounds' },
  { kind: 'note_image', label: 'Note Images' },
]).map((group) => ({
  ...group,
  items: reusableAssets.value.filter((asset) => asset.kind === group.kind),
})))

async function loadSelectedPreviewAsset() {
  if (selectedPreviewAssetUrl.value) {
    URL.revokeObjectURL(selectedPreviewAssetUrl.value)
    selectedPreviewAssetUrl.value = null
  }
  if (!selectedPreviewAssetId.value || imageDataUrl.value || croppedBlobUrl.value) return
  selectedPreviewAssetUrl.value = await loadAssetObjectUrl(selectedPreviewAssetId.value)
}

function revokePickerPreviewUrls() {
  for (const url of Object.values(pickerPreviewUrls.value)) {
    URL.revokeObjectURL(url)
  }
  pickerPreviewUrls.value = {}
}

function destroyCropper() {
  if (cropperInstance) { cropperInstance.destroy(); cropperInstance = null }
}

// When imageDataUrl changes (file picked), wait for Vue to render the <img>
// then initialise Cropper on it.
watch(imageDataUrl, async (url) => {
  destroyCropper()
  if (!url) return
  await nextTick()
  if (!cropperImgEl.value) return
  const Cropper = await loadCropper()
  cropperInstance = new Cropper(cropperImgEl.value, {
    aspectRatio:  TILE_W / TILE_H,   // strict preview tile ratio
    viewMode:     1,
    autoCropArea: 1,
    movable:      true,
    zoomable:     true,
    rotatable:    false,
    scalable:     false,
  })
})

function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  void loadBlobIntoCropper(file)
}

async function loadBlobIntoCropper(blob: Blob) {
  const reader = new FileReader()
  await new Promise<void>((resolve, reject) => {
    reader.onload = (ev) => {
      imageDataUrl.value = ev.target?.result as string
      resolve()
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

async function applyCrop() {
  if (!cropperInstance) return
  // Export cropped region resampled to exact tile pixels
  const canvas   = cropperInstance.getCroppedCanvas({ width: TILE_W, height: TILE_H })
  const blob     = await canvasToWebpBlob(canvas)
  croppedBlob    = blob
  if (croppedBlobUrl.value) URL.revokeObjectURL(croppedBlobUrl.value)
  croppedBlobUrl.value = URL.createObjectURL(blob)
  destroyCropper()
  imageDataUrl.value = null
}

function clearImage() {
  destroyCropper()
  imageDataUrl.value = null
  if (croppedBlobUrl.value) { URL.revokeObjectURL(croppedBlobUrl.value); croppedBlobUrl.value = null }
  croppedBlob     = null
  if (selectedPreviewAssetUrl.value) {
    URL.revokeObjectURL(selectedPreviewAssetUrl.value)
    selectedPreviewAssetUrl.value = null
  }
  selectedPreviewAssetId.value = null
}

function resetPreviewSelectionState() {
  destroyCropper()
  imageDataUrl.value = null
  if (croppedBlobUrl.value) {
    URL.revokeObjectURL(croppedBlobUrl.value)
    croppedBlobUrl.value = null
  }
  croppedBlob = null
}

async function selectExistingAsset(asset: Asset) {
  resetPreviewSelectionState()
  if (asset.kind === 'background') {
    selectedPreviewAssetId.value = null
    if (selectedPreviewAssetUrl.value) {
      URL.revokeObjectURL(selectedPreviewAssetUrl.value)
      selectedPreviewAssetUrl.value = null
    }
    isAssetPickerOpen.value = false
    await loadBlobIntoCropper(asset.blob)
    return
  }

  if (selectedPreviewAssetUrl.value) {
    URL.revokeObjectURL(selectedPreviewAssetUrl.value)
    selectedPreviewAssetUrl.value = null
  }
  selectedPreviewAssetId.value = asset.id ?? null
  isAssetPickerOpen.value = false
  void loadSelectedPreviewAsset()
}

onBeforeUnmount(() => {
  destroyCropper()
  if (croppedBlobUrl.value) URL.revokeObjectURL(croppedBlobUrl.value)
  if (selectedPreviewAssetUrl.value) URL.revokeObjectURL(selectedPreviewAssetUrl.value)
  revokePickerPreviewUrls()
})

watch(selectedPreviewAssetId, () => {
  void loadSelectedPreviewAsset()
}, { immediate: true })

watch(
  () => reusableAssets.value.map((asset) => asset.id).join('|'),
  () => {
    revokePickerPreviewUrls()
    const nextUrls: Record<number, string> = {}
    for (const asset of reusableAssets.value) {
      if (!asset.id) continue
      nextUrls[asset.id] = URL.createObjectURL(asset.blob)
    }
    pickerPreviewUrls.value = nextUrls
  },
  { immediate: true },
)

// ─── Submit ───────────────────────────────────────────────────────────────────

async function handleSubmit() {
  if (!form.value.url) return

  let previewAssetId: number | null = selectedPreviewAssetId.value
  if (croppedBlob) {
    previewAssetId = await storeOrGetAsset(croppedBlob, 'preview', TILE_W, TILE_H)
  }
  const faviconAssetId = await ensureFaviconAssetIdForUrl(form.value.url) ?? props.tab?.favicon_asset_id ?? null

  let displayTitle = form.value.title.trim()
  if (!displayTitle) {
    try { displayTitle = new URL(form.value.url).hostname } catch { displayTitle = form.value.url }
  }

  emit('save', {
    collection_id:    props.collectionId,
    title:            displayTitle,
    url:              form.value.url,
    description:      null,
    favicon_asset_id: faviconAssetId,
    preview_asset_id: previewAssetId,
    sort_order:       props.tab?.sort_order ?? 0,
    meta_json:        null,
  })
}
</script>

<template>
  <form @submit.prevent="handleSubmit" class="space-y-4">

    <div>
      <label for="tab_url" class="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">URL</label>
      <div class="flex gap-2">
        <input id="tab_url" v-model="form.url" type="url" placeholder="https://example.com" required
          class="flex-1 bg-surface-950 border border-white/10 rounded px-3 py-2 text-sm text-gray-100
                 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
        <button
          type="button"
          @click="testUrl"
          :disabled="isTesting || !form.url"
          class="px-3 py-1.5 bg-black/85 hover:bg-black border border-white/10 rounded text-[10px] uppercase tracking-wider font-bold text-white/85 hover:text-white transition-colors disabled:opacity-50"
        >
          {{ isTesting ? '...' : 'Test' }}
        </button>
      </div>
      <p class="mt-1 text-[10px] min-h-[1rem]" :class="urlStatusClass">{{ urlStatusMessage }}</p>
    </div>

    <div>
      <label for="tab_title" class="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Title</label>
      <input id="tab_title" v-model="form.title" type="text" placeholder="Auto-detected from hostname"
        class="w-full bg-surface-950 border border-white/10 rounded px-3 py-2 text-sm text-gray-100
               focus:outline-none focus:ring-1 focus:ring-indigo-500" />
    </div>

    <!-- Preview image pipeline -->
    <div>
      <label for="tab_preview_file" class="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
        Preview Image <span class="normal-case font-normal text-gray-600">({{ TILE_W }}×{{ TILE_H }} WebP, high quality)</span>
      </label>

      <!-- Selected or cropped result preview -->
      <div v-if="croppedBlobUrl || selectedPreviewAssetUrl" class="flex items-center gap-3">
        <img :src="croppedBlobUrl || selectedPreviewAssetUrl || ''" :style="{ width: `${TILE_W}px`, height: `${TILE_H}px` }" class="rounded object-cover border border-white/10" alt="Preview" />
        <button type="button" @click="clearImage" class="text-xs text-red-400 hover:text-red-300 transition-colors">Remove</button>
      </div>

      <!-- Active cropper -->
      <div v-else-if="imageDataUrl" class="space-y-2">
        <div class="relative max-h-52 overflow-hidden rounded border border-white/10 bg-black">
          <img ref="cropperImgEl" :src="imageDataUrl" class="block max-w-full" alt="Crop source" />
        </div>
        <div class="flex gap-2">
          <button type="button" @click="applyCrop"
            class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-medium">
            Apply Crop ({{ TILE_W }} × {{ TILE_H }})
          </button>
          <button type="button" @click="clearImage"
            class="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors">
            Cancel
          </button>
        </div>
      </div>

      <!-- File picker trigger -->
      <div v-else class="space-y-2">
        <input id="tab_preview_file" ref="fileInput" type="file" accept="image/*" class="hidden" @change="onFileChange" />
        <div class="flex gap-2">
          <button type="button" @click="fileInput?.click()"
            class="flex-1 py-4 border border-dashed border-white/10 rounded text-xs text-gray-500
                   hover:text-gray-300 hover:border-white/20 transition-colors">
            ↑ Upload screenshot or thumbnail
          </button>
          <button
            type="button"
            @click="isAssetPickerOpen = !isAssetPickerOpen"
            class="px-3 py-2 bg-black/85 hover:bg-black border border-white/10 rounded text-[10px] uppercase tracking-wider font-bold text-white/85 hover:text-white transition-colors"
          >
            Pick Asset
          </button>
        </div>

        <div
          v-if="isAssetPickerOpen"
          class="max-h-64 overflow-y-auto border border-white/10 bg-black/40 p-2 space-y-3"
        >
          <section
            v-for="group in groupedReusableAssets"
            :key="group.kind"
            v-show="group.items.length"
            class="space-y-2"
          >
            <h4 class="text-[10px] uppercase tracking-wider text-white/60">{{ group.label }}</h4>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                v-for="asset in group.items"
                :key="asset.id"
                type="button"
                @click="selectExistingAsset(asset)"
                class="border border-white/10 hover:border-white/25 bg-black/25 overflow-hidden"
              >
                <img
                  :src="pickerPreviewUrls[asset.id!] || ''"
                  :alt="group.label"
                  class="w-full h-20 object-cover"
                />
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="pt-4 mt-4 border-t border-white/10 flex items-center justify-between">
      <button v-if="tab?.id" type="button" @click="emit('delete', tab.id!)"
        class="text-xs text-red-400 hover:text-red-300 transition-colors">
        Delete Bookmark
      </button>
      <div v-else></div>
      <div class="flex gap-3">
        <button type="button" @click="emit('cancel')"
          class="px-4 py-2 text-xs font-medium text-gray-400 hover:text-gray-200 transition-colors">
          Cancel
        </button>
        <button type="submit"
          class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-medium
                 shadow-lg shadow-indigo-900/20 transition-all">
          {{ tab?.id ? 'Save Changes' : 'Add Bookmark' }}
        </button>
      </div>
    </div>

  </form>
</template>
