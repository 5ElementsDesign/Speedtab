<script setup lang="ts">
import { loadAssetObjectUrl, storeOrGetAsset } from '@/composables/useAsset'
import { onMounted, onUnmounted, ref, watch } from 'vue'

const props = defineProps<{
  backgroundAssetId: number | null
  backgroundTheme: string | null
  backgroundPreset: string | null
  openBookmarksInNewTab: boolean
}>()

const emit = defineEmits<{
  save: [backgroundAssetId: number | null, backgroundTheme: string | null, backgroundPreset: string | null, openBookmarksInNewTab: boolean]
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

const THEME_PRESETS = [
  { value: '', label: 'None' },
  { value: 'nordic', label: 'Nordic' },
  { value: 'matrix', label: 'Matrix' },
] as const

const selectedFile = ref<File | null>(null)
const previewUrl = ref<string | null>(null)
const isCleared = ref(false)
const backgroundTheme = ref<string | null>(props.backgroundTheme)
const backgroundPreset = ref<string>(props.backgroundPreset ?? '')
const openBookmarksInNewTab = ref(props.openBookmarksInNewTab)

let objectUrl: string | null = null

function revokePreview() {
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl)
    objectUrl = null
  }
}

async function loadExistingPreview() {
  revokePreview()
  previewUrl.value = null
  if (selectedFile.value || isCleared.value || !props.backgroundAssetId) return
  objectUrl = await loadAssetObjectUrl(props.backgroundAssetId)
  previewUrl.value = objectUrl
}

watch(() => props.backgroundAssetId, loadExistingPreview, { immediate: true })
watch(() => props.backgroundTheme, value => { backgroundTheme.value = value })
watch(() => props.backgroundPreset, value => { backgroundPreset.value = value ?? '' })
watch(() => props.openBookmarksInNewTab, value => { openBookmarksInNewTab.value = value })
onMounted(loadExistingPreview)
onUnmounted(revokePreview)

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
}

function clearBackground() {
  selectedFile.value = null
  isCleared.value = true
  revokePreview()
  previewUrl.value = null
}

async function handleSubmit() {
  const presetValue = backgroundPreset.value || null
  if (isCleared.value) {
    emit('save', null, backgroundTheme.value, presetValue, openBookmarksInNewTab.value)
    return
  }
  if (!selectedFile.value) {
    emit('save', props.backgroundAssetId, backgroundTheme.value, presetValue, openBookmarksInNewTab.value)
    return
  }

  const assetId = await storeOrGetAsset(selectedFile.value, 'background', null, null)
  emit('save', assetId, backgroundTheme.value, presetValue, openBookmarksInNewTab.value)
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

    <div class="space-y-2">
      <span class="block text-xs font-medium text-gray-500 uppercase tracking-wider">App Background</span>
      <input
        type="file"
        accept="image/*"
        @change="onFileChange"
        class="block w-full text-sm text-gray-200 file:mr-3 file:px-3 file:py-2 file:border-0 file:bg-black/85 file:text-white/85 file:rounded file:cursor-pointer"
      />
      <p class="text-[11px] text-white/55">
        Upload a default background image for Speedtab. Individual pages can override it.
      </p>
    </div>

    <div v-if="previewUrl" class="space-y-2">
      <div class="aspect-video overflow-hidden border border-white/10 bg-black/40">
        <img :src="previewUrl" alt="Background preview" class="w-full h-full object-cover" />
      </div>
    </div>

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
