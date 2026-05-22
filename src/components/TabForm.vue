<script setup lang="ts">
import { ref, watch, nextTick, onBeforeUnmount } from 'vue'
import type { PortableInput, Tab } from '@/types/db'
import { TILE_W, TILE_H, storeOrGetAsset, canvasToWebpBlob } from '@/composables/useAsset'

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

// ─── Cropper pipeline ─────────────────────────────────────────────────────────

const fileInput      = ref<HTMLInputElement | null>(null)
const cropperImgEl   = ref<HTMLImageElement  | null>(null)
const imageDataUrl   = ref<string | null>(null)  // raw file data URL → shows cropper
const croppedBlobUrl = ref<string | null>(null)  // object URL of final crop preview
let   croppedBlob:      Blob | null = null
let   cropperInstance:  CropperInstance | null = null
/** Preserve existing preview_asset_id across edits unless user changes the image */
let   currentPreviewId: number | null = props.tab?.preview_asset_id ?? null

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
    aspectRatio:  TILE_W / TILE_H,   // strict 98/56 = 1.75
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
  const reader = new FileReader()
  reader.onload = (ev) => { imageDataUrl.value = ev.target?.result as string }
  reader.readAsDataURL(file)
}

async function applyCrop() {
  if (!cropperInstance) return
  // Export cropped region resampled to exact tile pixels
  const canvas   = cropperInstance.getCroppedCanvas({ width: TILE_W, height: TILE_H })
  const blob     = await canvasToWebpBlob(canvas)   // ~1–4 KB at 98×56
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
  currentPreviewId = null
}

onBeforeUnmount(() => {
  destroyCropper()
  if (croppedBlobUrl.value) URL.revokeObjectURL(croppedBlobUrl.value)
})

// ─── Submit ───────────────────────────────────────────────────────────────────

async function handleSubmit() {
  if (!form.value.url) return

  let previewAssetId: number | null = currentPreviewId
  if (croppedBlob) {
    previewAssetId = await storeOrGetAsset(croppedBlob, 'preview', TILE_W, TILE_H)
  }

  let displayTitle = form.value.title.trim()
  if (!displayTitle) {
    try { displayTitle = new URL(form.value.url).hostname } catch { displayTitle = form.value.url }
  }

  emit('save', {
    collection_id:    props.collectionId,
    title:            displayTitle,
    url:              form.value.url,
    description:      null,
    favicon_asset_id: props.tab?.favicon_asset_id ?? null,
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
      <input id="tab_url" v-model="form.url" type="url" placeholder="https://example.com" required
        class="w-full bg-surface-950 border border-white/10 rounded px-3 py-2 text-sm text-gray-100
               focus:outline-none focus:ring-1 focus:ring-indigo-500" />
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
        Preview Image <span class="normal-case font-normal text-gray-600">(98×56 WebP, ≤5 KB)</span>
      </label>

      <!-- Cropped result preview -->
      <div v-if="croppedBlobUrl" class="flex items-center gap-3">
        <img :src="croppedBlobUrl" class="w-[98px] h-[56px] rounded object-cover border border-white/10" alt="Preview" />
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
            Apply Crop (98 × 56)
          </button>
          <button type="button" @click="clearImage"
            class="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors">
            Cancel
          </button>
        </div>
      </div>

      <!-- File picker trigger -->
      <div v-else>
        <input id="tab_preview_file" ref="fileInput" type="file" accept="image/*" class="hidden" @change="onFileChange" />
        <button type="button" @click="fileInput?.click()"
          class="w-full py-4 border border-dashed border-white/10 rounded text-xs text-gray-500
                 hover:text-gray-300 hover:border-white/20 transition-colors">
          ↑ Upload screenshot or thumbnail
        </button>
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
