<script setup lang="ts">
import { computed, ref, watch, nextTick, onBeforeUnmount } from 'vue'
import type { Asset, PortableInput, Tab } from '@/types/db'
import { TILE_W, TILE_H, storeOrGetAsset, canvasToWebpBlob, loadAssetObjectUrl } from '@/composables/useAsset'
import { ensureFaviconAssetIdForUrl, getFaviconUrl } from '@/composables/useFavicon'
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

const FAVICON_SIZE = 48

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

const faviconFileInput = ref<HTMLInputElement | null>(null)
const selectedFaviconAssetId = ref<number | null>(props.tab?.favicon_asset_id ?? null)
const selectedFaviconAssetUrl = ref<string | null>(null)
const isFaviconPickerOpen = ref(false)
const faviconPickerUrls = ref<Record<number, string>>({})
const faviconPreviewUrl = computed(() => selectedFaviconAssetUrl.value || getFaviconUrl(form.value.url))
const hasUnlockedFaviconPicker = ref(!!props.tab)

function syncFormFromTab(tab: Tab | undefined) {
  form.value = {
    url: tab?.url ?? '',
    title: tab?.title ?? '',
  }
  selectedPreviewAssetId.value = tab?.preview_asset_id ?? null
  selectedFaviconAssetId.value = tab?.favicon_asset_id ?? null
  lastTestedUrl.value = tab?.url ?? ''
  hasUnlockedFaviconPicker.value = !!tab
  testError.value = null
  testSuccess.value = false
  isFaviconPickerOpen.value = false
}

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

    form.value.url = normalizedUrl
    if ((!form.value.title || !form.value.title.trim()) && response.title) {
      form.value.title = response.title
    }
    selectedFaviconAssetId.value = await ensureFaviconAssetIdForUrl(normalizedUrl)
    testSuccess.value = true
    lastTestedUrl.value = normalizedUrl
    hasUnlockedFaviconPicker.value = true
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

const { data: faviconAssets } = useLiveQuery(
  () => db.assets.where('kind').equals('favicon').toArray(),
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
const hasPendingCrop = computed(() => !!imageDataUrl.value)
const canSubmit = computed(() => !!form.value.url && !hasPendingCrop.value)
const cropperScaleX = ref(1)
const cropperScaleY = ref(1)

watch(
  () => props.tab,
  (tab) => {
    syncFormFromTab(tab)
  },
  { immediate: true },
)

async function loadSelectedPreviewAsset() {
  if (selectedPreviewAssetUrl.value) {
    URL.revokeObjectURL(selectedPreviewAssetUrl.value)
    selectedPreviewAssetUrl.value = null
  }
  if (!selectedPreviewAssetId.value || imageDataUrl.value || croppedBlobUrl.value) return
  selectedPreviewAssetUrl.value = await loadAssetObjectUrl(selectedPreviewAssetId.value)
}

async function loadSelectedFaviconAsset() {
  if (selectedFaviconAssetUrl.value) {
    URL.revokeObjectURL(selectedFaviconAssetUrl.value)
    selectedFaviconAssetUrl.value = null
  }
  if (!selectedFaviconAssetId.value) return
  selectedFaviconAssetUrl.value = await loadAssetObjectUrl(selectedFaviconAssetId.value)
}

function revokePickerPreviewUrls() {
  for (const url of Object.values(pickerPreviewUrls.value)) {
    URL.revokeObjectURL(url)
  }
  pickerPreviewUrls.value = {}
}

function revokeFaviconPickerUrls() {
  for (const url of Object.values(faviconPickerUrls.value)) {
    URL.revokeObjectURL(url)
  }
  faviconPickerUrls.value = {}
}

function destroyCropper() {
  if (cropperInstance) { cropperInstance.destroy(); cropperInstance = null }
  cropperScaleX.value = 1
  cropperScaleY.value = 1
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
    scalable:     true,
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
  const blob     = await canvasToWebpBlob(canvas)   // compact WebP preview at tile size
  croppedBlob    = blob
  if (croppedBlobUrl.value) URL.revokeObjectURL(croppedBlobUrl.value)
  croppedBlobUrl.value = URL.createObjectURL(blob)
  destroyCropper()
  imageDataUrl.value = null
}

function zoomCropper(delta: number) {
  cropperInstance?.zoom(delta)
}

function moveCropper(offsetX: number, offsetY: number) {
  cropperInstance?.move(offsetX, offsetY)
}

function flipCropperX() {
  if (!cropperInstance) return
  cropperScaleX.value = cropperScaleX.value * -1
  cropperInstance.scaleX(cropperScaleX.value)
}

function flipCropperY() {
  if (!cropperInstance) return
  cropperScaleY.value = cropperScaleY.value * -1
  cropperInstance.scaleY(cropperScaleY.value)
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

function selectExistingFavicon(asset: Asset) {
  if (selectedFaviconAssetUrl.value) {
    URL.revokeObjectURL(selectedFaviconAssetUrl.value)
    selectedFaviconAssetUrl.value = null
  }
  selectedFaviconAssetId.value = asset.id ?? null
  isFaviconPickerOpen.value = false
  void loadSelectedFaviconAsset()
}

async function normalizeFaviconBlob(blob: Blob): Promise<{ blob: Blob; width: number | null; height: number | null }> {
  if (typeof createImageBitmap !== 'function') {
    return { blob, width: null, height: null }
  }

  try {
    const bitmap = await createImageBitmap(blob)
    const { width, height } = bitmap
    const scale = Math.min(1, FAVICON_SIZE / Math.max(width, height))
    const targetWidth = Math.max(1, Math.round(width * scale))
    const targetHeight = Math.max(1, Math.round(height * scale))

    if (targetWidth === width && targetHeight === height) {
      bitmap.close()
      return { blob, width, height }
    }

    const canvas = document.createElement('canvas')
    canvas.width = targetWidth
    canvas.height = targetHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bitmap.close()
      return { blob, width, height }
    }
    ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight)
    bitmap.close()

    const normalizedBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((nextBlob) => resolve(nextBlob), 'image/png')
    })

    return {
      blob: normalizedBlob ?? blob,
      width: targetWidth,
      height: targetHeight,
    }
  } catch {
    return { blob, width: null, height: null }
  }
}

async function onFaviconFileChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  const normalized = await normalizeFaviconBlob(file)
  const assetId = await storeOrGetAsset(normalized.blob, 'favicon', normalized.width, normalized.height)
  selectedFaviconAssetId.value = assetId
  isFaviconPickerOpen.value = false
  ;(event.target as HTMLInputElement).value = ''
}

function clearFavicon() {
  if (selectedFaviconAssetUrl.value) {
    URL.revokeObjectURL(selectedFaviconAssetUrl.value)
    selectedFaviconAssetUrl.value = null
  }
  selectedFaviconAssetId.value = null
  isFaviconPickerOpen.value = false
}

onBeforeUnmount(() => {
  destroyCropper()
  if (croppedBlobUrl.value) URL.revokeObjectURL(croppedBlobUrl.value)
  if (selectedPreviewAssetUrl.value) URL.revokeObjectURL(selectedPreviewAssetUrl.value)
  if (selectedFaviconAssetUrl.value) URL.revokeObjectURL(selectedFaviconAssetUrl.value)
  revokePickerPreviewUrls()
  revokeFaviconPickerUrls()
})

watch(selectedPreviewAssetId, () => {
  void loadSelectedPreviewAsset()
}, { immediate: true })

watch(selectedFaviconAssetId, () => {
  void loadSelectedFaviconAsset()
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

watch(
  () => faviconAssets.value.map((asset) => asset.id).join('|'),
  () => {
    revokeFaviconPickerUrls()
    const nextUrls: Record<number, string> = {}
    for (const asset of faviconAssets.value) {
      if (!asset.id) continue
      nextUrls[asset.id] = URL.createObjectURL(asset.blob)
    }
    faviconPickerUrls.value = nextUrls
  },
  { immediate: true },
)

// ─── Submit ───────────────────────────────────────────────────────────────────

async function handleSubmit() {
  if (!canSubmit.value) return

  let previewAssetId: number | null = selectedPreviewAssetId.value
  if (croppedBlob) {
    previewAssetId = await storeOrGetAsset(croppedBlob, 'preview', TILE_W, TILE_H)
  }
  const faviconAssetId = selectedFaviconAssetId.value

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
      <div class="flex gap-2 items-start">
        <div class="flex-1">
          <div class="flex min-h-[39px] items-stretch rounded border border-white/10 bg-surface-950 focus-within:ring-1 focus-within:ring-indigo-500">
            <button
              type="button"
              @click="hasUnlockedFaviconPicker && (isFaviconPickerOpen = !isFaviconPickerOpen)"
              :disabled="!hasUnlockedFaviconPicker"
              class="flex shrink-0 w-[44px] items-center justify-center overflow-hidden border-r border-white/10 bg-[#252525] transition-colors"
              :class="hasUnlockedFaviconPicker ? 'hover:bg-[#2c2c2c]' : 'cursor-not-allowed opacity-45'"
              :title="hasUnlockedFaviconPicker ? 'Choose bookmark favicon' : 'Test the URL first to unlock custom favicon selection'"
            >
              <img
                :src="faviconPreviewUrl"
                alt="Favicon preview"
                class="h-full w-full max-h-[26px] object-contain"
                draggable="false"
              />
            </button>
            <input
              id="tab_url"
              v-model="form.url"
              type="url"
              placeholder="https://example.com"
              required
              class="flex-1 border-0 bg-transparent px-3 py-2 text-sm text-gray-100 focus:outline-none"
            />
          </div>
          <input
            id="tab_favicon_file"
            ref="faviconFileInput"
            type="file"
            accept="image/*"
            class="hidden"
            @change="onFaviconFileChange"
          />
        </div>

        <button
          type="button"
          @click="testUrl"
          :disabled="isTesting || !form.url"
          class="inline-flex min-h-[39px] shrink-0 items-center justify-center self-stretch rounded border border-white/10 bg-black/85 px-3 text-[10px] font-bold uppercase tracking-wider text-white/85 transition-colors hover:bg-black hover:text-white disabled:opacity-50"
        >
          {{ isTesting ? '...' : 'Test' }}
        </button>
      </div>
      <div
        v-if="isFaviconPickerOpen"
        class="mt-2 space-y-3 border border-white/10 bg-[#151515] p-2"
      >
        <section class="space-y-2">
          <h4 class="text-[10px] uppercase tracking-wider text-white/60">Favicons</h4>
          <div v-if="faviconAssets.length" class="st-favicon-picker-grid">
            <button
              v-for="asset in faviconAssets"
              :key="asset.id"
              type="button"
              @click="selectExistingFavicon(asset)"
              class="st-favicon-picker-tile border border-white/10 bg-[#262626] p-2 transition-colors hover:border-white/25 hover:bg-[#303030]"
            >
              <img
                :src="faviconPickerUrls[asset.id!] || ''"
                alt="Favicon asset"
                class="w-full h-full object-contain"
              />
            </button>
          </div>
          <p v-else class="text-[11px] text-white/55">No favicon assets available yet.</p>
        </section>

        <section class="space-y-2 border-t border-white/10 pt-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="flex flex-wrap gap-2">
            <button
              type="button"
              @click="faviconFileInput?.click()"
              class="rounded border border-white/10 bg-black/45 px-3 py-1.5 text-[10px] uppercase tracking-wider text-white/85 transition-colors hover:bg-black/65 hover:text-white"
            >
              Upload
            </button>
            <button
              type="button"
              @click="clearFavicon"
              class="rounded border border-white/10 bg-black/20 px-3 py-1.5 text-[10px] uppercase tracking-wider text-white/75 transition-colors hover:bg-black/45 hover:text-white"
            >
              Clear
            </button>
            </div>
            <button
              type="button"
              @click="isFaviconPickerOpen = false"
              class="rounded border border-white/10 bg-black/20 px-3 py-1.5 text-[10px] uppercase tracking-wider text-white/75 transition-colors hover:bg-black/45 hover:text-white"
            >
              Close
            </button>
          </div>
        </section>
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
        <img
          :src="croppedBlobUrl || selectedPreviewAssetUrl || ''"
          :style="{ width: `${TILE_W}px`, height: `${TILE_H}px` }"
          class="rounded object-cover border border-white/10"
          alt="Preview"
        />
        <button type="button" @click="clearImage" class="text-xs text-red-400 hover:text-red-300 transition-colors">Remove</button>
      </div>

      <!-- Active cropper -->
      <div v-else-if="imageDataUrl" class="space-y-2">
        <div class="relative max-h-52 overflow-hidden rounded border border-white/10 bg-black">
          <img ref="cropperImgEl" :src="imageDataUrl" class="block max-w-full" alt="Crop source" />
        </div>
        <div class="flex flex-wrap gap-2 text-[10px] uppercase tracking-wider text-white/70">
          <button
            type="button"
            @click="zoomCropper(0.1)"
            class="px-2 py-1 border border-white/10 bg-black/35 hover:bg-black/55 transition-colors"
          >
            Zoom +
          </button>
          <button
            type="button"
            @click="zoomCropper(-0.1)"
            class="px-2 py-1 border border-white/10 bg-black/35 hover:bg-black/55 transition-colors"
          >
            Zoom -
          </button>
          <button
            type="button"
            @click="moveCropper(-20, 0)"
            class="px-2 py-1 border border-white/10 bg-black/35 hover:bg-black/55 transition-colors"
          >
            Left
          </button>
          <button
            type="button"
            @click="moveCropper(20, 0)"
            class="px-2 py-1 border border-white/10 bg-black/35 hover:bg-black/55 transition-colors"
          >
            Right
          </button>
          <button
            type="button"
            @click="moveCropper(0, -20)"
            class="px-2 py-1 border border-white/10 bg-black/35 hover:bg-black/55 transition-colors"
          >
            Up
          </button>
          <button
            type="button"
            @click="moveCropper(0, 20)"
            class="px-2 py-1 border border-white/10 bg-black/35 hover:bg-black/55 transition-colors"
          >
            Down
          </button>
          <button
            type="button"
            @click="flipCropperX"
            class="px-2 py-1 border border-white/10 bg-black/35 hover:bg-black/55 transition-colors"
          >
            Flip X
          </button>
          <button
            type="button"
            @click="flipCropperY"
            class="px-2 py-1 border border-white/10 bg-black/35 hover:bg-black/55 transition-colors"
          >
            Flip Y
          </button>
        </div>
        <p class="text-[10px] text-amber-200/80">
          Crop or cancel the image before saving this bookmark.
        </p>
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
          :disabled="!canSubmit"
          class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-medium
                 shadow-lg shadow-indigo-900/20 transition-all disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-indigo-600">
          {{ tab?.id ? 'Save Changes' : 'Add Bookmark' }}
        </button>
      </div>
    </div>

  </form>
</template>
