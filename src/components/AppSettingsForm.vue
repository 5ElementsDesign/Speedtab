<script setup lang="ts">
import { loadAssetObjectUrl, storeOrGetAsset } from '@/composables/useAsset'
import { useLiveQuery } from '@/composables/useLiveQuery'
import { db } from '@/db/db'
import { THEME_PRESETS, normalizeThemePreset } from '@/themePresets'
import { onMounted, onUnmounted, ref, watch } from 'vue'

type AppearanceDraft = {
  backgroundAssetId: number | null
  backgroundTheme: string | null
  backgroundPreset: string
  openBookmarksInNewTab: boolean
  feedSearchUrlTemplate: string
  feedContentScale: number
  noteContentScale: number
  backgroundPreviewUrl?: string | null
}

const props = defineProps<{
  backgroundAssetId: number | null
  backgroundTheme: string | null
  backgroundPreset: string | null
  openBookmarksInNewTab: boolean
  feedSearchUrlTemplate: string
  feedContentScale: number
  noteContentScale: number
}>()

const emit = defineEmits<{
  preview: [draft: AppearanceDraft]
  save: [draft: AppearanceDraft]
  cancel: []
}>()

const BACKGROUND_THEMES = [
  { value: 'charcoal', label: 'Charcoal', className: 'st-bg-theme-charcoal', light: false },
  { value: 'ocean', label: 'Ocean', className: 'st-bg-theme-ocean', light: false },
  { value: 'sunshine', label: 'Sunshine', className: 'st-bg-theme-sunshine', light: true },
  { value: 'ember', label: 'Ember', className: 'st-bg-theme-ember', light: false },
  { value: 'moss', label: 'Moss', className: 'st-bg-theme-moss', light: false },
  { value: 'paper', label: 'Paper', className: 'st-bg-theme-paper', light: true },
] as const

const CONTENT_SCALE_OPTIONS = [
  { value: 0.8, label: 'Small' },
  { value: 1, label: 'Normal' },
  { value: 1.2, label: 'Comfortable' },
  { value: 1.4, label: 'Large' },
] as const

const selectedFile = ref<File | null>(null)
const previewUrl = ref<string | null>(null)
const isCleared = ref(false)
const isBackgroundPickerOpen = ref(false)
const selectedBackgroundAssetId = ref<number | null>(props.backgroundAssetId)
const backgroundTheme = ref<string | null>(props.backgroundTheme)
const backgroundPreset = ref<string>(normalizeThemePreset(props.backgroundPreset))
const openBookmarksInNewTab = ref(props.openBookmarksInNewTab)
const feedSearchUrlTemplate = ref(props.feedSearchUrlTemplate)
const feedContentScale = ref(props.feedContentScale)
const noteContentScale = ref(props.noteContentScale)

let objectUrl: string | null = null
const backgroundPickerUrls = ref<Record<number, string>>({})
const backgroundPickerContainer = ref<HTMLElement | null>(null)

const { data: backgroundAssets } = useLiveQuery(
  () => db.assets.where('kind').equals('background').toArray(),
  []
)

function revokePreview() {
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl)
    objectUrl = null
  }
}

function revokeBackgroundPickerUrls() {
  for (const url of Object.values(backgroundPickerUrls.value)) {
    URL.revokeObjectURL(url)
  }
  backgroundPickerUrls.value = {}
}

function currentDraft(): AppearanceDraft {
  return {
    backgroundAssetId: isCleared.value ? null : selectedBackgroundAssetId.value,
    backgroundTheme: backgroundTheme.value,
    backgroundPreset: backgroundPreset.value,
    openBookmarksInNewTab: openBookmarksInNewTab.value,
    feedSearchUrlTemplate: feedSearchUrlTemplate.value.trim(),
    feedContentScale: feedContentScale.value,
    noteContentScale: noteContentScale.value,
    backgroundPreviewUrl: selectedFile.value ? previewUrl.value : null,
  }
}

function emitPreview() {
  emit('preview', currentDraft())
}

async function loadExistingPreview() {
  revokePreview()
  previewUrl.value = null
  if (selectedFile.value || isCleared.value || !selectedBackgroundAssetId.value) return
  objectUrl = await loadAssetObjectUrl(selectedBackgroundAssetId.value)
  previewUrl.value = objectUrl
}

watch(() => props.backgroundAssetId, loadExistingPreview, { immediate: true })
watch(() => props.backgroundAssetId, value => { selectedBackgroundAssetId.value = value })
watch(() => props.backgroundTheme, value => { backgroundTheme.value = value })
watch(() => props.backgroundPreset, value => { backgroundPreset.value = normalizeThemePreset(value) })
watch(() => props.openBookmarksInNewTab, value => { openBookmarksInNewTab.value = value })
watch(() => props.feedSearchUrlTemplate, value => { feedSearchUrlTemplate.value = value })
watch(() => props.feedContentScale, value => { feedContentScale.value = value })
watch(() => props.noteContentScale, value => { noteContentScale.value = value })
onMounted(loadExistingPreview)
onUnmounted(() => {
  revokePreview()
  revokeBackgroundPickerUrls()
})

watch(
  () => backgroundAssets.value.map((asset) => asset.id).join('|'),
  () => {
    revokeBackgroundPickerUrls()
    const nextUrls: Record<number, string> = {}
    for (const asset of backgroundAssets.value) {
      if (!asset.id) continue
      nextUrls[asset.id] = URL.createObjectURL(asset.blob)
    }
    backgroundPickerUrls.value = nextUrls
  },
  { immediate: true },
)

watch(
  [
    selectedBackgroundAssetId,
    backgroundTheme,
    backgroundPreset,
    openBookmarksInNewTab,
    feedSearchUrlTemplate,
    feedContentScale,
    noteContentScale,
  ],
  () => { emitPreview() },
  { immediate: true },
)

watch(
  () => isBackgroundPickerOpen.value,
  async (open) => {
    if (!open || !selectedBackgroundAssetId.value) return
    await new Promise((resolve) => requestAnimationFrame(resolve))
    const active = backgroundPickerContainer.value?.querySelector<HTMLElement>('[data-active-background="true"]')
    active?.scrollIntoView({ block: 'nearest' })
  }
)

function onFileChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0] ?? null
  selectedFile.value = file
  isCleared.value = false
  revokePreview()
  previewUrl.value = null
  if (!file) {
    void loadExistingPreview()
    return
  }
  objectUrl = URL.createObjectURL(file)
  previewUrl.value = objectUrl
  emitPreview()
}

function clearBackground() {
  selectedFile.value = null
  isCleared.value = true
  selectedBackgroundAssetId.value = null
  revokePreview()
  previewUrl.value = null
  emitPreview()
}

function pickExistingBackground(assetId: number) {
  selectedFile.value = null
  isCleared.value = false
  selectedBackgroundAssetId.value = assetId
  revokePreview()
  previewUrl.value = null
  void loadExistingPreview()
}

async function handleSubmit() {
  if (isCleared.value) {
    emit('save', currentDraft())
    return
  }
  if (!selectedFile.value) {
    emit('save', currentDraft())
    return
  }

  const assetId = await storeOrGetAsset(selectedFile.value, 'background', null, null)
  emit('save', {
    ...currentDraft(),
    backgroundAssetId: assetId,
    backgroundPreviewUrl: null,
  })
}
</script>

<template>
  <form @submit.prevent="handleSubmit" class="space-y-4">
    <div class="space-y-2">
      <span class="block text-xs font-medium text-gray-500 uppercase tracking-wider">Background Theme</span>
      <div class="grid grid-cols-3 gap-2 leading-none">
        <button
          v-for="theme in BACKGROUND_THEMES"
          :key="theme.value"
          type="button"
          @click="backgroundTheme = backgroundTheme === theme.value ? null : theme.value"
          class="h-12 rounded border text-left px-3 transition-colors relative overflow-hidden"
          :class="backgroundTheme === theme.value ? 'border-[#5ecbff] ring-1 ring-[#5ecbff]' : 'border-white/10 hover:border-white/20'"
        >
          <span class="absolute inset-0" :class="theme.className"></span>
          <span
            class="relative z-10 text-[11px] font-medium"
            :class="theme.light ? 'text-black/80' : 'text-white/90'"
          >{{ theme.label }}</span>
        </button>
      </div>
      <p class="text-[11px] text-white/55">
        Theme colors are used when no background image is active.
      </p>
    </div>

    <hr class="border-white/10" />

    <div class="space-y-2">
      <label for="theme_preset" class="block text-xs font-medium text-gray-500 uppercase tracking-wider">Theme Preset Override</label>
      <select
        id="theme_preset"
        v-model="backgroundPreset"
        class="w-full bg-surface-950 border border-white/10 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      >
        <option
          v-for="preset in THEME_PRESETS"
          :key="preset.value"
          :value="preset.value"
        >
          {{ preset.label }}
        </option>
      </select>
      <p class="text-[11px] text-white/55">
        Presets override theme variables and can be layered on top of a base background theme.
      </p>
    </div>

    <hr class="border-white/10" />

    <div class="space-y-2">
      <span class="block text-xs font-medium text-gray-500 uppercase tracking-wider">App Background</span>
      <div class="flex items-center gap-2">
        <input
          type="file"
          accept="image/*"
          @change="onFileChange"
          class="block w-full text-sm text-gray-200 file:mr-3 file:px-3 file:py-2 file:border-0 file:bg-black/85 file:text-white/85 file:rounded file:cursor-pointer"
        />
        <button
          v-if="backgroundAssets.length"
          type="button"
          @click="isBackgroundPickerOpen = !isBackgroundPickerOpen"
          class="px-3 py-2 bg-black/85 hover:bg-black border border-white/10 rounded text-[10px] uppercase tracking-wider font-bold text-white/85 hover:text-white transition-colors"
        >
          Pick
        </button>
      </div>
      <p class="text-[11px] text-white/55">
        Upload a default background image for Speedtab. Individual pages can override it.
      </p>
      <div
        v-if="isBackgroundPickerOpen && backgroundAssets.length"
        ref="backgroundPickerContainer"
        class="max-h-72 overflow-y-auto border border-white/10 bg-black/40 p-2"
      >
        <div class="grid grid-cols-2 gap-2">
          <button
            v-for="asset in backgroundAssets"
            :key="asset.id"
            type="button"
            @click="pickExistingBackground(asset.id!)"
            class="border overflow-hidden transition-colors"
            :class="selectedBackgroundAssetId === asset.id ? 'border-sky-400' : 'border-white/10 hover:border-white/20'"
            :data-active-background="selectedBackgroundAssetId === asset.id ? 'true' : undefined"
          >
            <img
              :src="backgroundPickerUrls[asset.id!] || ''"
              alt="Background asset"
              class="w-full aspect-video object-cover"
            />
          </button>
        </div>
      </div>

      <div v-if="previewUrl" class="space-y-2">
        <div class="aspect-video overflow-hidden border border-white/10 bg-black/40">
          <img :src="previewUrl" alt="Background preview" class="w-full h-full object-cover" />
        </div>
      </div>
    </div>

    <hr class="border-white/10" />

    <div class="flex items-center gap-2">
      <input
        id="open_bookmarks_new_tab"
        v-model="openBookmarksInNewTab"
        type="checkbox"
        class="rounded border-white/10 bg-surface-950 text-indigo-600 focus:ring-indigo-500"
      />
      <label for="open_bookmarks_new_tab" class="text-sm text-gray-300 select-none">
        Open bookmarks in new tabs by default
      </label>
    </div>

    <hr class="border-white/10" />

    <div class="space-y-2">
      <label for="feed_search_url_template" class="block text-xs font-medium text-gray-500 uppercase tracking-wider">Feed Search URL</label>
      <input
        id="feed_search_url_template"
        v-model="feedSearchUrlTemplate"
        type="url"
        placeholder="https://www.google.com/search?q=%s"
        class="w-full bg-surface-950 border border-white/10 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />
      <p class="text-[11px] text-white/55">
        Use <code>%s</code> as the placeholder for the encoded feed headline.
      </p>
    </div>

    <hr class="border-white/10" />

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div class="space-y-2">
        <label for="feed_content_scale" class="block text-xs font-medium text-gray-500 uppercase tracking-wider">Feeds Content Size</label>
        <select
          id="feed_content_scale"
          v-model.number="feedContentScale"
          class="w-full bg-surface-950 border border-white/10 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option
            v-for="option in CONTENT_SCALE_OPTIONS"
            :key="option.label"
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </select>
      </div>

      <div class="space-y-2">
        <label for="note_content_scale" class="block text-xs font-medium text-gray-500 uppercase tracking-wider">Notes Content Size</label>
        <select
          id="note_content_scale"
          v-model.number="noteContentScale"
          class="w-full bg-surface-950 border border-white/10 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option
            v-for="option in CONTENT_SCALE_OPTIONS"
            :key="option.label"
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </select>
      </div>
    </div>

    <div class="flex items-center justify-between pt-4 mt-4 border-t border-white/10">
      <button
        type="button"
        @click="clearBackground"
        class="text-xs text-red-400 hover:text-red-300 transition-colors"
      >
        Remove Background Image
      </button>

      <div class="flex gap-3">
        <button
          type="button"
          @click="emit('cancel')"
          class="px-4 py-2 text-xs font-medium text-gray-400 hover:text-gray-200 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-medium transition-all"
        >
          Save Settings
        </button>
      </div>
    </div>
  </form>
</template>
