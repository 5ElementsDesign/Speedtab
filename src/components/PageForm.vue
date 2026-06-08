<script setup lang="ts">
import { loadAssetObjectUrl, storeOrGetAsset } from '@/composables/useAsset'
import { ref, onMounted, onUnmounted, watch } from 'vue'
import type { Page, PortableInput } from '@/types/db'

const PRESET_PAGE_ICONS = [
  '⭕', '⚡', '🏠', '⭐', '📁', '📌', '🧩', '📝', '📚', '📰',
  '📡', '🧠', '💼', '📊', '📈', '🛠️', '🔧', '🎯', '🚀', '🌐',
  '🧭', '🗂️', '📂', '💡', '🔒', '🔖', '🗞️', '🧪', '🎨', '🧵',
  '📷', '🎵', '🎬', '🛒', '💳', '🏦', '🧾', '🧰', '🖥️', '📱',
  '⌨️', '🕹️', '☁️', '🌙', '☀️', '🔥', '🌿', '🌊', '📍', '✅',
]

const PAGE_MAX_WIDTH_MIN = 300
const PAGE_MAX_WIDTH_MAX = 2000

const props = defineProps<{
  page?: Page
  defaultMaxWidth?: number | null
}>()

const emit = defineEmits<{
  save:   [data: PortableInput<Page>]
  delete: [id: number]
  cancel: []
}>()

// Parse existing layout config (modulesPerRow, maxWidth, background) out of config_json.
function parseConfig(): { modulesPerRow: number; maxWidth: number | null; backgroundAssetId: number | null } {
  if (!props.page?.config_json) {
    return {
      modulesPerRow: 2,
      maxWidth: typeof props.defaultMaxWidth === 'number' ? props.defaultMaxWidth : null,
      backgroundAssetId: null,
    }
  }
  try {
    const c = JSON.parse(props.page.config_json)
    return {
      modulesPerRow: typeof c.modulesPerRow === 'number' ? c.modulesPerRow : 2,
      maxWidth:      typeof c.maxWidth === 'number' ? c.maxWidth : null,
      backgroundAssetId: typeof c.background_asset_id === 'number' ? c.background_asset_id : null,
    }
  } catch { return { modulesPerRow: 2, maxWidth: null, backgroundAssetId: null } }
}
const initialCfg = parseConfig()

const form = ref<PortableInput<Page>>({
  slug:        props.page?.slug ?? '',
  title:       props.page?.title ?? '',
  nav_group:   props.page?.nav_group ?? 'main',
  icon:        props.page?.icon ?? '⭕',
  is_home:     props.page?.is_home ?? 0,
  sort_order:  props.page?.sort_order ?? 0,
  config_json: props.page?.config_json ?? null,
})

const modulesPerRow = ref<number>(initialCfg.modulesPerRow)
const maxWidth      = ref<number | null>(initialCfg.maxWidth)
const backgroundAssetId = ref<number | null>(initialCfg.backgroundAssetId)
const selectedBackgroundFile = ref<File | null>(null)
const backgroundPreviewUrl = ref<string | null>(null)
const isIconPickerOpen = ref(false)

const titleInput = ref<HTMLInputElement | null>(null)
onMounted(() => titleInput.value?.focus())

let backgroundObjectUrl: string | null = null

function revokeBackgroundPreview() {
  if (backgroundObjectUrl) {
    URL.revokeObjectURL(backgroundObjectUrl)
    backgroundObjectUrl = null
  }
}

async function loadBackgroundPreview() {
  revokeBackgroundPreview()
  backgroundPreviewUrl.value = null
  if (selectedBackgroundFile.value || !backgroundAssetId.value) return
  backgroundObjectUrl = await loadAssetObjectUrl(backgroundAssetId.value)
  backgroundPreviewUrl.value = backgroundObjectUrl
}

watch(backgroundAssetId, loadBackgroundPreview, { immediate: true })
onUnmounted(revokeBackgroundPreview)

function onBackgroundFileChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0] ?? null
  selectedBackgroundFile.value = file
  revokeBackgroundPreview()
  backgroundPreviewUrl.value = null
  if (!file) {
    void loadBackgroundPreview()
    return
  }
  backgroundObjectUrl = URL.createObjectURL(file)
  backgroundPreviewUrl.value = backgroundObjectUrl
}

function clearBackgroundOverride() {
  selectedBackgroundFile.value = null
  backgroundAssetId.value = null
  revokeBackgroundPreview()
  backgroundPreviewUrl.value = null
}

function selectIcon(icon: string) {
  form.value.icon = icon
  isIconPickerOpen.value = false
}

async function handleSubmit() {
  if (!form.value.title) return
  if (!form.value.slug) {
    form.value.slug = form.value.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  }
  if (selectedBackgroundFile.value) {
    backgroundAssetId.value = await storeOrGetAsset(selectedBackgroundFile.value, 'background', null, null)
  }
  // Persist layout settings as a single JSON blob.
  form.value.config_json = JSON.stringify({
    modulesPerRow: Math.max(1, Math.min(12, Number(modulesPerRow.value) || 2)),
    maxWidth:      maxWidth.value && maxWidth.value > 0
      ? Math.max(PAGE_MAX_WIDTH_MIN, Math.min(PAGE_MAX_WIDTH_MAX, Number(maxWidth.value)))
      : null,
    background_asset_id: backgroundAssetId.value,
  })
  // Emit a plain shallow copy — IndexedDB's structured clone cannot serialize Vue's reactive Proxy.
  emit('save', { ...form.value })
}
</script>

<template>
  <form @submit.prevent="handleSubmit" class="space-y-4">
    <div>
      <label for="page_title" class="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Title</label>
      <input
        id="page_title"
        ref="titleInput"
        v-model="form.title"
        type="text"
        placeholder="Page name"
        class="w-full min-h-[40px] bg-surface-950 border border-white/10 rounded px-3 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        required
      />
    </div>

    <div class="grid grid-cols-2 gap-4 items-start">
      <div>
        <label for="page_icon" class="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Icon (Emoji)</label>
        <div class="flex gap-2">
          <input
            id="page_icon"
            v-model="form.icon"
            type="text"
            class="min-w-0 flex-1 min-h-[40px] bg-surface-950 border border-white/10 rounded px-3 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <button
            type="button"
            @click="isIconPickerOpen = !isIconPickerOpen"
            class="shrink-0 min-h-[40px] px-3 bg-white/10 hover:bg-white/15 border border-white/10 rounded text-[10px] uppercase tracking-wider text-white/80 hover:text-white transition-colors"
          >
            Pick
          </button>
        </div>
      </div>
      <div>
        <label for="page_nav_group" class="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Nav Group</label>
        <select
          id="page_nav_group"
          v-model="form.nav_group"
          class="w-full min-h-[40px] bg-surface-950 border border-white/10 rounded px-3 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="main">Main Nav</option>
          <option value="overflow">Overflow</option>
        </select>
      </div>
    </div>

    <div v-if="isIconPickerOpen">
      <div class="flex flex-wrap gap-1 p-2 border border-white/10 bg-black/90 rounded-sm shadow-2xl">
        <button
          v-for="icon in PRESET_PAGE_ICONS"
          :key="icon"
          type="button"
          @click="selectIcon(icon)"
          class="h-12 w-12 rounded-sm bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-[18px] transition-colors"
        >
          {{ icon }}
        </button>
      </div>
    </div>

    <div class="flex items-center gap-2">
      <input
        id="is_home"
        type="checkbox"
        :checked="form.is_home === 1"
        @change="form.is_home = ($event.target as HTMLInputElement).checked ? 1 : 0"
        class="rounded border-white/10 bg-surface-950 text-indigo-600 focus:ring-indigo-500"
      />
      <label for="is_home" class="text-sm text-gray-300 select-none">Set as Home Page</label>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div>
        <label for="page_modules_per_row" class="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Modules per row</label>
        <input
          id="page_modules_per_row"
          v-model.number="modulesPerRow"
          type="number"
          min="1"
          max="12"
          class="w-full min-h-[40px] bg-surface-950 border border-white/10 rounded px-3 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>
      <div>
        <label for="page_max_width" class="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Max content width (px)</label>
        <input
          id="page_max_width"
          v-model.number="maxWidth"
          type="number"
          min="300"
          max="2000"
          placeholder="300 - 2000"
          class="w-full min-h-[40px] bg-surface-950 border border-white/10 rounded px-3 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>
    </div>

    <div class="space-y-2">
      <span class="block text-xs font-medium text-gray-500 uppercase tracking-wider">Background Override</span>
      <input
        id="page_background_file"
        name="page_background_file"
        type="file"
        accept="image/*"
        @change="onBackgroundFileChange"
        class="block w-full text-sm text-gray-200 file:mr-3 file:px-3 file:py-2 file:border-0 file:bg-black/85 file:text-white/85 file:rounded file:cursor-pointer"
      />
      <p class="text-[11px] text-white/55">
        Leave empty to use the global app background for this page.
      </p>
      <div v-if="backgroundPreviewUrl" class="aspect-video overflow-hidden border border-white/10 bg-black/40">
        <img :src="backgroundPreviewUrl" alt="Page background preview" class="w-full h-full object-cover" />
      </div>
      <button
        v-if="backgroundAssetId || backgroundPreviewUrl"
        type="button"
        @click="clearBackgroundOverride"
        class="text-xs text-red-400 hover:text-red-300 transition-colors"
      >
        Use App Background
      </button>
    </div>

    <div class="pt-4 mt-4 border-t border-white/10 flex items-center justify-between">
      <button
        v-if="page?.id"
        type="button"
        @click="emit('delete', page.id!)"
        class="text-xs text-red-400 hover:text-red-300 transition-colors"
      >
        Delete Page
      </button>
      <div v-else></div>

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
          class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-medium shadow-lg shadow-indigo-900/20 transition-all"
        >
          {{ page?.id ? 'Save Changes' : 'Create Page' }}
        </button>
      </div>
    </div>
  </form>
</template>
