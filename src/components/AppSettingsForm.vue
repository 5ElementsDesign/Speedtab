<script setup lang="ts">
import wallpaperThumbnailUrl from '@/assets/wallpaper-y-tree-thumbnail.webp'
import { loadAssetObjectUrl, storeOrGetAsset } from '@/composables/useAsset'
import { useLiveQuery } from '@/composables/useLiveQuery'
import { searchOpenMeteoLocations, type OpenMeteoGeocodeResult } from '@/composables/useOpenMeteoWeather'
import { db } from '@/db/db'
import { isThemePreset, THEME_PRESETS, normalizeThemePreset } from '@/themePresets'
import type { WeatherWidgetLocation, WeatherWidgetUnits, WidgetRailAlign, WidgetRailPosition } from '@/types/widgets'
import type { CSSProperties } from 'vue'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

type SettingsDraft = {
  backgroundAssetId: number | null
  backgroundTheme: string | null
  backgroundPreset: string
  openBookmarksInNewTab: boolean
  feedSearchUrlTemplate: string
  feedContentScale: number
  noteContentScale: number
  widgetRailEnabled: boolean
  widgetRailPosition: WidgetRailPosition
  widgetRailAlign: WidgetRailAlign
  weatherEnabled: boolean
  weatherUnits: WeatherWidgetUnits
  weatherRefreshIntervalMinutes: number
  weatherDisplayLabel: string
  weatherLocation: WeatherWidgetLocation | null
  weatherApiKey: string
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
  widgetRailEnabled: boolean
  widgetRailPosition: WidgetRailPosition
  widgetRailAlign: WidgetRailAlign
  weatherEnabled: boolean
  weatherUnits: WeatherWidgetUnits
  weatherRefreshIntervalMinutes: number
  weatherDisplayLabel: string
  weatherLocation: WeatherWidgetLocation | null
  weatherApiKey: string
  openWidgetConfigurator?: boolean
}>()

const emit = defineEmits<{
  preview: [draft: SettingsDraft]
  save: [draft: SettingsDraft]
  cancel: []
  dirtyChange: [dirty: boolean]
}>()

type BackgroundThemeOption = {
  value: string | null
  label: string
  className: string
  light: boolean
  style?: CSSProperties
}

const BACKGROUND_THEMES: readonly BackgroundThemeOption[] = [
  {
    value: null,
    label: 'Speedy',
    className: '',
    light: false,
    style: {
      backgroundImage: `url(${wallpaperThumbnailUrl})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    },
  },
  { value: 'charcoal', label: 'Charcoal', className: 'st-bg-theme-charcoal', light: false },
  { value: 'ocean', label: 'Ocean', className: 'st-bg-theme-ocean', light: false },
  { value: 'light', label: 'Light', className: 'st-bg-theme-light', light: true },
  { value: 'ember', label: 'Ember', className: 'st-bg-theme-ember', light: false },
  { value: 'nordic', label: 'Nordic', className: 'st-bg-theme-nordic', light: false },
  { value: 'moss', label: 'Moss', className: 'st-bg-theme-moss', light: false },
  { value: 'sunshine', label: 'Sunshine', className: 'st-bg-theme-sunshine', light: true },
] as const

const CONTENT_SCALE_OPTIONS = [
  { value: 0.9, label: 'Small' },
  { value: 1, label: 'Normal' },
  { value: 1.2, label: 'Comfortable' },
  { value: 1.4, label: 'Large' },
  { value: 1.6, label: 'X-Large' },
] as const

const WEATHER_REFRESH_OPTIONS = [
  { value: 10, label: '10 minutes' },
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' },
  { value: 120, label: '2 hours' },
  { value: 360, label: '6 hours' },
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
const widgetRailEnabled = ref(props.widgetRailEnabled)
const widgetRailPosition = ref<WidgetRailPosition>(props.widgetRailPosition)
const widgetRailAlign = ref<WidgetRailAlign>(props.widgetRailAlign)
const weatherEnabled = ref(props.weatherEnabled)
const weatherUnits = ref<WeatherWidgetUnits>(props.weatherUnits)
const weatherRefreshIntervalMinutes = ref(props.weatherRefreshIntervalMinutes)
const weatherDisplayLabel = ref(props.weatherDisplayLabel)
const weatherLocation = ref<WeatherWidgetLocation | null>(props.weatherLocation)
const weatherApiKey = ref(props.weatherApiKey)
const isWeatherConfiguratorOpen = ref(false)
const weatherLocationQuery = ref('')
const weatherLocationResults = ref<OpenMeteoGeocodeResult[]>([])
const weatherLocationSearchStatus = ref<'idle' | 'loading' | 'error' | 'empty'>('idle')
const weatherLocationSearchError = ref<string | null>(null)

let objectUrl: string | null = null
let locationSearchHandle: number | null = null
let locationSearchController: AbortController | null = null
const backgroundPickerUrls = ref<Record<number, string>>({})
const backgroundPickerContainer = ref<HTMLElement | null>(null)

const { data: backgroundAssets } = useLiveQuery(
  () => db.assets.where('kind').equals('background').toArray(),
  []
)

const resolvedWeatherLocationLabel = computed(() => {
  if (!weatherLocation.value) return null
  return weatherLocation.value.country
    ? `${weatherLocation.value.name}, ${weatherLocation.value.country}`
    : weatherLocation.value.name
})

const showRemoveBackgroundButton = computed(() => {
  if (isCleared.value) return false
  return !!selectedFile.value || selectedBackgroundAssetId.value != null || props.backgroundAssetId != null
})

function normalizedSettingsSnapshot(value: Omit<SettingsDraft, 'backgroundPreviewUrl'>) {
  return JSON.stringify(value)
}

const hasSettingsChanges = computed(() => {
  const current = currentDraft()
  const currentSnapshot = normalizedSettingsSnapshot({
    backgroundAssetId: current.backgroundAssetId,
    backgroundTheme: current.backgroundTheme,
    backgroundPreset: current.backgroundPreset,
    openBookmarksInNewTab: current.openBookmarksInNewTab,
    feedSearchUrlTemplate: current.feedSearchUrlTemplate,
    feedContentScale: current.feedContentScale,
    noteContentScale: current.noteContentScale,
    widgetRailEnabled: current.widgetRailEnabled,
    widgetRailPosition: current.widgetRailPosition,
    widgetRailAlign: current.widgetRailAlign,
    weatherEnabled: current.weatherEnabled,
    weatherUnits: current.weatherUnits,
    weatherRefreshIntervalMinutes: current.weatherRefreshIntervalMinutes,
    weatherDisplayLabel: current.weatherDisplayLabel,
    weatherLocation: current.weatherLocation,
    weatherApiKey: current.weatherApiKey,
  })
  const initialSnapshot = normalizedSettingsSnapshot({
    backgroundAssetId: props.backgroundAssetId,
    backgroundTheme: props.backgroundTheme,
    backgroundPreset: normalizeThemePreset(props.backgroundPreset),
    openBookmarksInNewTab: props.openBookmarksInNewTab,
    feedSearchUrlTemplate: props.feedSearchUrlTemplate.trim(),
    feedContentScale: props.feedContentScale,
    noteContentScale: props.noteContentScale,
    widgetRailEnabled: props.widgetRailEnabled,
    widgetRailPosition: props.widgetRailPosition,
    widgetRailAlign: props.widgetRailAlign,
    weatherEnabled: props.weatherEnabled,
    weatherUnits: props.weatherUnits,
    weatherRefreshIntervalMinutes: props.weatherRefreshIntervalMinutes,
    weatherDisplayLabel: props.weatherDisplayLabel.trim(),
    weatherLocation: props.weatherLocation,
    weatherApiKey: props.weatherApiKey.trim(),
  })
  return currentSnapshot !== initialSnapshot
})

watch(hasSettingsChanges, (dirty) => {
  emit('dirtyChange', dirty)
}, { immediate: true })

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

function currentDraft(): SettingsDraft {
  return {
    backgroundAssetId: isCleared.value ? null : selectedBackgroundAssetId.value,
    backgroundTheme: backgroundTheme.value,
    backgroundPreset: backgroundPreset.value,
    openBookmarksInNewTab: openBookmarksInNewTab.value,
    feedSearchUrlTemplate: feedSearchUrlTemplate.value.trim(),
    feedContentScale: feedContentScale.value,
    noteContentScale: noteContentScale.value,
    widgetRailEnabled: widgetRailEnabled.value,
    widgetRailPosition: widgetRailPosition.value,
    widgetRailAlign: widgetRailAlign.value,
    weatherEnabled: weatherEnabled.value,
    weatherUnits: weatherUnits.value,
    weatherRefreshIntervalMinutes: weatherRefreshIntervalMinutes.value,
    weatherDisplayLabel: weatherDisplayLabel.value.trim(),
    weatherLocation: weatherLocation.value,
    weatherApiKey: weatherApiKey.value.trim(),
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

function clearLocationSearch() {
  if (locationSearchHandle !== null) {
    window.clearTimeout(locationSearchHandle)
    locationSearchHandle = null
  }
  if (locationSearchController) {
    locationSearchController.abort()
    locationSearchController = null
  }
}

async function runLocationSearch(query: string) {
  clearLocationSearch()
  const trimmed = query.trim()
  if (trimmed.length < 2) {
    weatherLocationResults.value = []
    weatherLocationSearchStatus.value = 'idle'
    weatherLocationSearchError.value = null
    return
  }

  weatherLocationSearchStatus.value = 'loading'
  weatherLocationSearchError.value = null
  locationSearchController = new AbortController()

  try {
    const results = await searchOpenMeteoLocations(trimmed, locationSearchController.signal)
    weatherLocationResults.value = results
    weatherLocationSearchStatus.value = results.length ? 'idle' : 'empty'
  } catch (error) {
    if ((error as Error).name === 'AbortError') return
    weatherLocationResults.value = []
    weatherLocationSearchStatus.value = 'error'
    weatherLocationSearchError.value = (error as Error).message
  } finally {
    locationSearchController = null
  }
}

function pickWeatherLocation(result: OpenMeteoGeocodeResult) {
  weatherLocation.value = {
    name: result.name,
    country: result.country,
    latitude: result.latitude,
    longitude: result.longitude,
    timezone: result.timezone,
  }
  weatherLocationQuery.value = ''
  weatherLocationResults.value = []
  weatherLocationSearchStatus.value = 'idle'
  weatherLocationSearchError.value = null
  emitPreview()
}

function clearWeatherLocation() {
  weatherLocation.value = null
  weatherLocationQuery.value = ''
  weatherLocationResults.value = []
  weatherLocationSearchStatus.value = 'idle'
  weatherLocationSearchError.value = null
  emitPreview()
}

function handleBackgroundThemeClick(themeValue: string) {
  const isSameTheme = backgroundTheme.value === themeValue
  backgroundTheme.value = isSameTheme ? null : themeValue
  if (!isSameTheme && isThemePreset(themeValue)) {
    backgroundPreset.value = themeValue
  }
}

function handleDefaultBackgroundThemeClick() {
  backgroundTheme.value = null
  backgroundPreset.value = 'dark'
}

watch(() => props.backgroundAssetId, loadExistingPreview, { immediate: true })
watch(() => props.backgroundAssetId, value => { selectedBackgroundAssetId.value = value })
watch(() => props.backgroundTheme, value => { backgroundTheme.value = value })
watch(() => props.backgroundPreset, value => { backgroundPreset.value = normalizeThemePreset(value) })
watch(() => props.openBookmarksInNewTab, value => { openBookmarksInNewTab.value = value })
watch(() => props.feedSearchUrlTemplate, value => { feedSearchUrlTemplate.value = value })
watch(() => props.feedContentScale, value => { feedContentScale.value = value })
watch(() => props.noteContentScale, value => { noteContentScale.value = value })
watch(() => props.widgetRailEnabled, value => { widgetRailEnabled.value = value })
watch(() => props.widgetRailPosition, value => { widgetRailPosition.value = value })
watch(() => props.widgetRailAlign, value => { widgetRailAlign.value = value })
watch(() => props.weatherEnabled, value => { weatherEnabled.value = value })
watch(() => props.weatherUnits, value => { weatherUnits.value = value })
watch(() => props.weatherRefreshIntervalMinutes, value => { weatherRefreshIntervalMinutes.value = value })
watch(() => props.weatherDisplayLabel, value => { weatherDisplayLabel.value = value })
watch(() => props.weatherLocation, value => { weatherLocation.value = value })
watch(() => props.weatherApiKey, value => { weatherApiKey.value = value })
watch(() => props.openWidgetConfigurator, value => {
  if (value && widgetRailEnabled.value) {
    isWeatherConfiguratorOpen.value = true
  }
}, { immediate: true })
watch(widgetRailEnabled, (enabled) => {
  if (!enabled) {
    isWeatherConfiguratorOpen.value = false
  }
})

watch(
  () => weatherLocationQuery.value,
  (value) => {
    clearLocationSearch()
    if (value.trim().length < 2) {
      weatherLocationResults.value = []
      weatherLocationSearchStatus.value = 'idle'
      weatherLocationSearchError.value = null
      return
    }
    locationSearchHandle = window.setTimeout(() => {
      void runLocationSearch(value)
    }, 240)
  },
)

onMounted(loadExistingPreview)
onUnmounted(() => {
  revokePreview()
  revokeBackgroundPickerUrls()
  clearLocationSearch()
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
    widgetRailEnabled,
    widgetRailPosition,
    widgetRailAlign,
    weatherEnabled,
    weatherUnits,
    weatherRefreshIntervalMinutes,
    weatherDisplayLabel,
    weatherLocation,
    weatherApiKey,
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
  if (!hasSettingsChanges.value) return
  if (isCleared.value || !selectedFile.value) {
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
  <form @submit.prevent="handleSubmit" class="flex h-full min-h-0 flex-col">
    <div class="px-3 py-3 flex-1 min-h-0 overflow-y-auto space-y-4">

    <template v-if="isWeatherConfiguratorOpen">
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-gray-500 uppercase tracking-wider">Widget configuration</span>
          <button
            type="button"
            class="px-3 py-2 bg-black/85 hover:bg-black border border-white/10 rounded text-[10px] uppercase tracking-wider font-bold text-white/85 hover:text-white transition-colors"
            @click="isWeatherConfiguratorOpen = false"
          >
            Back
          </button>
        </div>
      </div>

      <div class="grid gap-3 md:grid-cols-2">
        <div class="space-y-2">
          <label for="widget_rail_position" class="block text-xs font-medium text-gray-500 uppercase tracking-wider">Rail Position</label>
          <select
            id="widget_rail_position"
            v-model="widgetRailPosition"
            name="widget_rail_position"
            class="w-full bg-surface-950 border border-white/10 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="top">Top</option>
            <option value="bottom">Bottom</option>
          </select>
        </div>

        <div class="space-y-2">
          <label for="widget_rail_align" class="block text-xs font-medium text-gray-500 uppercase tracking-wider">Rail Alignment</label>
          <select
            id="widget_rail_align"
            v-model="widgetRailAlign"
            name="widget_rail_align"
            class="w-full bg-surface-950 border border-white/10 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </div>
      </div>

      <div class="space-y-3 border border-white/10 bg-[#181818] p-3">
        <div class="flex items-center justify-between gap-3">
          <p class="text-xs font-medium text-gray-500 uppercase tracking-wider">Weather Widget</p>
          <label class="flex items-center gap-2 whitespace-nowrap text-sm text-gray-300">
            <input
              id="weather_enabled"
              v-model="weatherEnabled"
              name="weather_enabled"
              type="checkbox"
              class="rounded border-white/10 bg-surface-950 text-indigo-600 focus:ring-indigo-500"
            />
            <span>Enable weather</span>
          </label>
        </div>

        <template v-if="weatherEnabled">
          <hr class="border-white/10" />

          <div class="space-y-2">
            <label for="weather_location_query" class="block text-xs font-medium text-gray-500 uppercase tracking-wider">Weather Location</label>
            <input
              id="weather_location_query"
              v-model="weatherLocationQuery"
              name="weather_location_query"
              type="text"
              placeholder="Search for a city or place"
              class="w-full bg-surface-950 border border-white/10 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <p class="text-[11px] text-white/55">
              Search uses Open-Meteo geocoding. Speedtab stores only the resolved location.
            </p>
          </div>

          <div v-if="resolvedWeatherLocationLabel" class="flex items-center justify-between gap-3 border border-white/10 bg-black/20 px-3 py-2">
            <div class="min-w-0">
              <p class="text-[10px] uppercase tracking-[0.18em] text-white/45">Current Location</p>
              <p class="mt-1 text-[11px] text-white/80 truncate">{{ resolvedWeatherLocationLabel }}</p>
            </div>
            <button
              type="button"
              class="text-[10px] uppercase tracking-[0.18em] text-red-300 hover:text-red-200 transition-colors"
              @click="clearWeatherLocation"
            >
              Clear
            </button>
          </div>

          <div v-if="weatherLocationSearchStatus === 'loading'" class="text-[11px] text-white/60">
            Searching locations…
          </div>
          <div v-else-if="weatherLocationSearchStatus === 'error'" class="text-[11px] text-red-200/90">
            {{ weatherLocationSearchError || 'Location search failed.' }}
          </div>
          <div v-else-if="weatherLocationSearchStatus === 'empty'" class="text-[11px] text-white/60">
            No location matches found.
          </div>

          <div v-if="weatherLocationResults.length" class="border border-white/10 bg-black/30">
            <button
              v-for="result in weatherLocationResults"
              :key="result.id"
              type="button"
              class="flex w-full items-center justify-between gap-3 border-b border-white/10 px-3 py-2 text-left last:border-b-0 hover:bg-white/5"
              @click="pickWeatherLocation(result)"
            >
              <span class="min-w-0">
                <span class="block text-[11px] text-white/90 truncate">{{ result.name }}</span>
                <span class="block text-[10px] text-white/55 truncate">
                  {{ result.country || 'Unknown country' }}
                  <template v-if="result.timezone"> · {{ result.timezone }}</template>
                </span>
              </span>
              <span class="shrink-0 text-[10px] uppercase tracking-[0.18em] text-sky-200/85">Use</span>
            </button>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="space-y-2">
              <label for="weather_units" class="block text-xs font-medium text-gray-500 uppercase tracking-wider">Units</label>
              <select
                id="weather_units"
                v-model="weatherUnits"
                name="weather_units"
                class="w-full bg-surface-950 border border-white/10 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="metric">Metric</option>
                <option value="imperial">Imperial</option>
              </select>
            </div>

            <div class="space-y-2">
              <label for="weather_display_label" class="block text-xs font-medium text-gray-500 uppercase tracking-wider">Display Label</label>
              <input
                id="weather_display_label"
                v-model="weatherDisplayLabel"
                name="weather_display_label"
                type="text"
                placeholder="Optional custom label"
                class="w-full bg-surface-950 border border-white/10 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <hr class="border-white/10" />

          <div class="space-y-2">
            <label for="weather_refresh_interval" class="block text-xs font-medium text-gray-500 uppercase tracking-wider">Refresh Interval</label>
            <select
              id="weather_refresh_interval"
              v-model.number="weatherRefreshIntervalMinutes"
              name="weather_refresh_interval"
              class="w-full bg-surface-950 border border-white/10 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option
                v-for="option in WEATHER_REFRESH_OPTIONS"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
          </div>
        </template>
      </div>

    </template>

    <template v-else>
    <div class="space-y-2">
      <span class="block text-xs font-medium text-gray-500 uppercase tracking-wider">Background Theme</span>
      <div class="grid grid-cols-4 gap-2 leading-none">
        <button
          v-for="theme in BACKGROUND_THEMES"
          :key="theme.value ?? 'default'"
          type="button"
          @click="theme.value === null ? handleDefaultBackgroundThemeClick() : handleBackgroundThemeClick(theme.value)"
          class="h-12 rounded border text-left px-3 transition-colors relative overflow-hidden"
          :class="backgroundTheme === theme.value ? 'border-[#5ecbff] ring-1 ring-[#5ecbff]' : 'border-white/10 hover:border-white/20'"
        >
          <span
            class="absolute inset-0"
            :class="theme.className"
            :style="theme.style"
          ></span>
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
        name="theme_preset"
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
          id="app-settings-wallpaper-file"
          name="app_settings_wallpaper_file"
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
        name="open_bookmarks_new_tab"
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
        name="feed_search_url_template"
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
          name="feed_content_scale"
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
          name="note_content_scale"
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

    <hr class="border-white/10" />

    <div class="space-y-4">
      <div class="flex items-center justify-between gap-3">
        <div>
          <p class="text-xs font-medium text-gray-500 uppercase tracking-wider">Widgets</p>
          <p class="text-[11px] text-white/55 mt-1">Enable additional features</p>
        </div>
        <label class="flex items-center gap-2 whitespace-nowrap text-sm text-gray-300">
          <input
            id="widget_rail_enabled"
            v-model="widgetRailEnabled"
            name="widget_rail_enabled"
            type="checkbox"
            class="rounded border-white/10 bg-surface-950 text-indigo-600 focus:ring-indigo-500"
          />
          <span>Enable rail</span>
        </label>
      </div>

      <div class="flex items-center justify-between gap-3 pt-0">
        <button
          type="button"
          class="shrink-0 px-3 py-2 bg-black/85 hover:bg-black border border-white/10 rounded text-[10px] uppercase tracking-wider font-bold text-white/85 hover:text-white transition-colors disabled:cursor-default disabled:opacity-35 disabled:hover:bg-black/85 disabled:hover:text-white/85"
          :disabled="!widgetRailEnabled"
          @click="isWeatherConfiguratorOpen = !isWeatherConfiguratorOpen"
        >
          Configure Widgets
        </button>
      </div>
    </div>

    </template>
    </div>

    <div class="border-t border-white/10 bg-black/30 px-3 py-3 sticky bottom-0">
      <div class="flex items-center justify-between">
        <div>
          <button
            v-if="showRemoveBackgroundButton"
            type="button"
            @click="clearBackground"
            class="text-xs text-red-400 hover:text-red-300 transition-colors"
          >
            Remove Background Image
          </button>
        </div>
        <div class="flex items-center gap-3">
          <button
            type="button"
            @click="emit('cancel')"
            class="px-4 py-2 text-xs font-medium text-gray-400 hover:text-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            :disabled="!hasSettingsChanges"
            class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-medium transition-all disabled:cursor-default disabled:opacity-45 disabled:hover:bg-indigo-600"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  </form>
</template>
