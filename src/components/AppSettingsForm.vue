<script setup lang="ts">
import wallpaperThumbnailUrl from '@/assets/wallpaper-y-tree-thumbnail.webp'
import { loadAssetObjectUrl, storeOrGetAsset } from '@/composables/useAsset'
import { useLiveQuery } from '@/composables/useLiveQuery'
import { searchOpenMeteoLocations, type OpenMeteoGeocodeResult } from '@/composables/useOpenMeteoWeather'
import { db } from '@/db/db'
import { isThemePreset, normalizeThemePreset, THEME_PRESETS } from '@/themePresets'
import type { WeatherWidgetLocation, WeatherWidgetUnits, WidgetRailAlign, WidgetRailPosition } from '@/types/widgets'
import type { CSSProperties } from 'vue'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

type SettingsDraft = {
  backgroundAssetId: number | null
  backgroundTheme: string | null
  backgroundPreset: string
  backgroundProperties: string | null
  uiLanguage: string
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
  backgroundProperties: string | null
  uiLanguage: string
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

const { t } = useI18n()

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

const selectedFile = ref<File | null>(null)
const previewUrl = ref<string | null>(null)
const isCleared = ref(false)
const isBackgroundPickerOpen = ref(false)
const selectedBackgroundAssetId = ref<number | null>(props.backgroundAssetId)
const backgroundTheme = ref<string | null>(props.backgroundTheme)
const backgroundPreset = ref<string>(normalizeThemePreset(props.backgroundPreset))
const uiLanguage = ref(props.uiLanguage)
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
const showCustomBgInput = ref(!!props.backgroundProperties)
const backgroundPropertiesRaw = ref<string>(props.backgroundProperties ?? '')
const backgroundProperties = ref<string | null>(props.backgroundProperties ?? null)
const backgroundPropertiesError = ref<string | null>(null)

function sanitizeBackgroundValue(input: string): string {
  return input
    .trim()
    .replace(/^background-image\s*:\s*/i, '')
    .replace(/^background\s*:\s*/i, '')
    .replace(/;$/, '')
    .trim()
}

let objectUrl: string | null = null
let locationSearchHandle: number | null = null
let locationSearchController: AbortController | null = null
const backgroundPickerUrls = ref<Record<number, string>>({})
const backgroundPickerContainer = ref<HTMLElement | null>(null)

const contentScaleOptions = computed(() => [
  { value: 0.9, label: t('settings.contentSize.small') },
  { value: 1, label: t('settings.contentSize.normal') },
  { value: 1.2, label: t('settings.contentSize.comfortable') },
  { value: 1.4, label: t('settings.contentSize.large') },
  { value: 1.6, label: t('settings.contentSize.xlarge') },
])

const weatherRefreshOptions = computed(() => [
  { value: 10, label: t('settings.refreshOptions.m10') },
  { value: 15, label: t('settings.refreshOptions.m15') },
  { value: 30, label: t('settings.refreshOptions.m30') },
  { value: 60, label: t('settings.refreshOptions.h1') },
  { value: 120, label: t('settings.refreshOptions.h2') },
  { value: 360, label: t('settings.refreshOptions.h6') },
])

const localizedBackgroundThemes = computed(() => BACKGROUND_THEMES.map((theme) => ({
  ...theme,
  label: theme.value === null
    ? t('settings.themes.speedy')
    : t(`settings.themes.${theme.value}`),
})))

const { data: backgroundAssets } = useLiveQuery(
  () => db.assets.where('kind').equals('background').toArray(),
  []
)

const { data: bgArchiveItems } = useLiveQuery(
  () => db.bg_archive.orderBy('created_at').reverse().toArray(),
  []
)

async function archiveBackground() {
  if (!backgroundProperties.value) return
  const newId = await db.bg_archive.add({
    name: '',
    value: backgroundProperties.value,
    created_at: Date.now(),
  }) as number
  await db.bg_archive.update(newId, { name: `BG #${newId}` })
}

async function deleteArchiveItem(id: number) {
  if (!window.confirm(t('settings.customBg.confirmRemoveBg'))) return
  await db.bg_archive.delete(id)
}

function loadArchiveItem(value: string) {
  backgroundPropertiesRaw.value = value
}

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

function snapshotFromProps() {
  return normalizedSettingsSnapshot({
    backgroundAssetId: props.backgroundAssetId,
    backgroundTheme: props.backgroundTheme,
    backgroundPreset: normalizeThemePreset(props.backgroundPreset),
    backgroundProperties: props.backgroundProperties ?? null,
    uiLanguage: props.uiLanguage,
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
}

const initialSettingsSnapshot = ref(snapshotFromProps())

const hasSettingsChanges = computed(() => {
  const current = currentDraft()
  const currentSnapshot = normalizedSettingsSnapshot({
    backgroundAssetId: current.backgroundAssetId,
    backgroundTheme: current.backgroundTheme,
    backgroundPreset: current.backgroundPreset,
    backgroundProperties: current.backgroundProperties,
    uiLanguage: current.uiLanguage,
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
  return currentSnapshot !== initialSettingsSnapshot.value
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
    backgroundProperties: backgroundProperties.value,
    uiLanguage: uiLanguage.value,
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
  if (!isSameTheme) {
    backgroundPropertiesRaw.value = ''
    backgroundProperties.value = null
    backgroundPropertiesError.value = null
    showCustomBgInput.value = false
    if (isThemePreset(themeValue)) {
      backgroundPreset.value = themeValue
    }
  }
}

function handleDefaultBackgroundThemeClick() {
  backgroundTheme.value = null
  backgroundPreset.value = 'dark'
  backgroundPropertiesRaw.value = ''
  backgroundProperties.value = null
  backgroundPropertiesError.value = null
  showCustomBgInput.value = false
}

watch(() => props.backgroundAssetId, loadExistingPreview, { immediate: true })
watch(() => props.backgroundAssetId, value => { selectedBackgroundAssetId.value = value })
watch(() => props.backgroundTheme, value => { backgroundTheme.value = value })
watch(() => props.backgroundPreset, value => { backgroundPreset.value = normalizeThemePreset(value) })
watch(() => props.uiLanguage, value => { uiLanguage.value = value })
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
watch(() => props.backgroundProperties, value => {
  backgroundProperties.value = value ?? null
  backgroundPropertiesRaw.value = value ?? ''
  if (value) showCustomBgInput.value = true
})
watch(backgroundPropertiesRaw, (raw) => {
  const sanitized = sanitizeBackgroundValue(raw)
  if (!sanitized) {
    backgroundPropertiesError.value = null
    backgroundProperties.value = null
    emitPreview()
    return
  }
  if (CSS.supports('background', sanitized) || CSS.supports('background-image', sanitized)) {
    backgroundPropertiesError.value = null
    backgroundProperties.value = sanitized
    backgroundTheme.value = null
    emitPreview()
  } else {
    backgroundPropertiesError.value = t('settings.customBg.notValidCssValue')
    backgroundProperties.value = null
    emitPreview()
  }
})
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
    uiLanguage,
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
          <span class="text-xs font-medium text-gray-500 uppercase tracking-wider">{{ t('settings.widgetConfiguration') }}</span>
          <button
            type="button"
            class="px-3 py-2 bg-black/85 hover:bg-black border border-white/10 rounded text-[10px] uppercase tracking-wider font-bold text-white/85 hover:text-white transition-colors"
            @click="isWeatherConfiguratorOpen = false"
          >{{ t('common.back') }}</button>
        </div>
      </div>

      <div class="grid gap-3 md:grid-cols-2">
        <div class="space-y-2">
          <label for="widget_rail_position" class="block text-xs font-medium text-gray-500 uppercase tracking-wider">{{ t('settings.railPosition') }}</label>
          <select
            id="widget_rail_position"
            v-model="widgetRailPosition"
            name="widget_rail_position"
            class="w-full bg-surface-950 border border-white/10 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="top">{{ t('settings.top') }}</option>
            <option value="bottom">{{ t('settings.bottom') }}</option>
          </select>
        </div>

        <div class="space-y-2">
          <label for="widget_rail_align" class="block text-xs font-medium text-gray-500 uppercase tracking-wider">{{ t('settings.railAlignment') }}</label>
          <select
            id="widget_rail_align"
            v-model="widgetRailAlign"
            name="widget_rail_align"
            class="w-full bg-surface-950 border border-white/10 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="left">{{ t('settings.left') }}</option>
            <option value="center">{{ t('settings.center') }}</option>
            <option value="right">{{ t('settings.right') }}</option>
          </select>
        </div>
      </div>

      <div class="space-y-3 border border-white/10 bg-[#181818] p-3">
        <div class="flex items-center justify-between gap-3">
          <p class="text-xs font-medium text-gray-500 uppercase tracking-wider">{{ t('settings.weatherWidget') }}</p>
          <label class="flex items-center gap-2 whitespace-nowrap text-sm text-gray-300">
            <input
              id="weather_enabled"
              v-model="weatherEnabled"
              name="weather_enabled"
              type="checkbox"
              class="rounded border-white/10 bg-surface-950 text-indigo-600 focus:ring-indigo-500"
            />
            <span>{{ t('settings.enableWeather') }}</span>
          </label>
        </div>

        <template v-if="weatherEnabled">
          <hr class="border-white/10" />

          <div class="space-y-2">
            <label for="weather_location_query" class="block text-xs font-medium text-gray-500 uppercase tracking-wider">{{ t('settings.weatherLocation') }}</label>
            <input
              id="weather_location_query"
              v-model="weatherLocationQuery"
              name="weather_location_query"
              type="text"
              :placeholder="t('settings.weatherLocationPlaceholder')"
              class="w-full bg-surface-950 border border-white/10 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <p class="text-[11px] text-white/55">
              {{ t('settings.weatherLocationHelp') }}
            </p>
          </div>

          <div v-if="resolvedWeatherLocationLabel" class="flex items-center justify-between gap-3 border border-white/10 bg-black/20 px-3 py-2">
            <div class="min-w-0">
              <p class="text-[10px] uppercase tracking-[0.18em] text-white/45">{{ t('settings.currentLocation') }}</p>
              <p class="mt-1 text-[11px] text-white/80 truncate">{{ resolvedWeatherLocationLabel }}</p>
            </div>
            <button
              type="button"
              class="text-[10px] uppercase tracking-[0.18em] text-red-300 hover:text-red-200 transition-colors"
              @click="clearWeatherLocation"
            >
              {{ t('settings.clear') }}
            </button>
          </div>

          <div v-if="weatherLocationSearchStatus === 'loading'" class="text-[11px] text-white/60">
            {{ t('settings.searchingLocations') }}
          </div>
          <div v-else-if="weatherLocationSearchStatus === 'error'" class="text-[11px] text-red-200/90">
            {{ weatherLocationSearchError || t('settings.locationSearchFailed') }}
          </div>
          <div v-else-if="weatherLocationSearchStatus === 'empty'" class="text-[11px] text-white/60">
            {{ t('settings.noLocationMatches') }}
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
                  {{ result.country || t('settings.unknownCountry') }}
                  <template v-if="result.timezone"> · {{ result.timezone }}</template>
                </span>
              </span>
              <span class="shrink-0 text-[10px] uppercase tracking-[0.18em] text-sky-200/85">{{ t('common.use') }}</span>
            </button>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="space-y-2">
              <label for="weather_units" class="block text-xs font-medium text-gray-500 uppercase tracking-wider">{{ t('settings.units') }}</label>
              <select
                id="weather_units"
                v-model="weatherUnits"
                name="weather_units"
                class="w-full bg-surface-950 border border-white/10 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="metric">{{ t('settings.metric') }}</option>
                <option value="imperial">{{ t('settings.imperial') }}</option>
              </select>
            </div>

            <div class="space-y-2">
              <label for="weather_display_label" class="block text-xs font-medium text-gray-500 uppercase tracking-wider">{{ t('settings.displayLabel') }}</label>
              <input
                id="weather_display_label"
                v-model="weatherDisplayLabel"
                name="weather_display_label"
                type="text"
                :placeholder="t('settings.displayLabelPlaceholder')"
                class="w-full bg-surface-950 border border-white/10 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <hr class="border-white/10" />

          <div class="space-y-2">
            <label for="weather_refresh_interval" class="block text-xs font-medium text-gray-500 uppercase tracking-wider">{{ t('settings.refreshInterval') }}</label>
            <select
              id="weather_refresh_interval"
              v-model.number="weatherRefreshIntervalMinutes"
              name="weather_refresh_interval"
              class="w-full bg-surface-950 border border-white/10 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option
                v-for="option in weatherRefreshOptions"
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
      <div class="flex items-center justify-between">
        <span class="block text-xs font-medium text-gray-500 uppercase tracking-wider">{{ t('settings.backgroundTheme') }}</span>
        <button
          type="button"
          @click="showCustomBgInput = !showCustomBgInput"
          class="px-2 py-1 border rounded text-[10px] uppercase tracking-wider font-bold transition-colors"
          :class="showCustomBgInput || backgroundProperties ? 'bg-sky-500/20 border-sky-400/60 text-sky-300' : 'bg-black/85 border-white/10 hover:border-white/20 text-white/85 hover:text-white'"
        >{{ t('common.custom') }}</button>
      </div>
      <div v-if="showCustomBgInput" class="space-y-2">
        <div class="flex gap-2">
          <input
            id="background_properties"
            name="background_properties"
            type="text"
            v-model="backgroundPropertiesRaw"
            placeholder="linear-gradient(to right, #222, #444)"
            class="flex-1 bg-surface-950 border rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-sky-500"
            :class="backgroundPropertiesError ? 'border-red-500/60' : backgroundProperties ? 'border-sky-400/60' : 'border-white/10'"
          />
          <button
            type="button"
            :disabled="!backgroundProperties"
            @click="archiveBackground"
            class="px-3 py-2 border rounded text-[10px] uppercase tracking-wider font-bold transition-colors"
            :class="backgroundProperties ? 'bg-black/85 border-white/10 hover:border-white/20 text-white/85 hover:text-white' : 'bg-black/85 border-white/10 text-white/30 cursor-not-allowed'"
          >{{ t('feedItem.archive') }}</button>
        </div>
        <p v-if="backgroundPropertiesError" class="text-[11px] text-red-400">{{ backgroundPropertiesError }}</p>
        <div
          v-if="bgArchiveItems.length"
          class="overflow-y-auto border border-white/10 bg-black/20 rounded p-2"
          style="max-height: 154px"
        >
          <div class="flex flex-wrap gap-2">
            <div
              v-for="item in bgArchiveItems"
              :key="item.id"
              class="relative"
              style="flex: 1 1 20%"
            >
              <button
                type="button"
                :data-st-bg-archive="item.value"
                @click="loadArchiveItem(item.value)"
                class="h-10 w-full rounded border text-left px-2 transition-colors relative overflow-hidden"
                :class="item.value === backgroundProperties ? 'border-sky-400/60 ring-1 ring-sky-400/40' : 'border-white/10 hover:border-white/20'"
                :style="{ background: item.value }"
              >
                <span class="relative z-10 text-[9px] font-medium text-white/80 drop-shadow bg-black/60 p-0.5">{{ item.name }}</span>
              </button>
              <button
                type="button"
                @click.stop="deleteArchiveItem(item.id!)"
                class="absolute top-0.5 right-0.5 z-20 w-5 h-5 flex items-center justify-center rounded-full bg-black/70 text-white/60 hover:text-white hover:bg-black transition-colors text-[12px] leading-none"
                aria-label="Remove"
              >×</button>
            </div>
          </div>
        </div>
      </div>
      <div class="grid grid-cols-4 gap-2 leading-none">
        <button
          v-for="theme in localizedBackgroundThemes"
          :key="theme.value ?? 'default'"
          type="button"
          @click="theme.value === null ? handleDefaultBackgroundThemeClick() : handleBackgroundThemeClick(theme.value)"
          class="h-12 rounded border text-left px-3 transition-colors relative overflow-hidden"
          :class="backgroundTheme === theme.value && !backgroundProperties ? 'border-[#5ecbff] ring-1 ring-[#5ecbff]' : 'border-white/10 hover:border-white/20'"
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
        {{ t('settings.backgroundThemeHelp') }}
      </p>
    </div>

    <hr class="border-white/10" />

    <div class="space-y-2">
      <label for="theme_preset" class="block text-xs font-medium text-gray-500 uppercase tracking-wider">{{ t('settings.themePresetOverride') }}</label>
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
        {{ t('settings.themePresetHelp') }}
      </p>
    </div>

    <hr class="border-white/10" />

    <div class="space-y-2">
      <span class="block text-xs font-medium text-gray-500 uppercase tracking-wider">{{ t('settings.appBackground') }}</span>
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
          {{ t('settings.pick') }}
        </button>
      </div>
      <p class="text-[11px] text-white/55">
        {{ t('settings.appBackgroundHelp') }}
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
              :alt="t('settings.backgroundAssetAlt')"
              class="w-full aspect-video object-cover"
            />
          </button>
        </div>
      </div>

      <div v-if="previewUrl" class="space-y-2">
        <div class="aspect-video overflow-hidden border border-white/10 bg-black/40">
          <img :src="previewUrl" :alt="t('settings.backgroundPreviewAlt')" class="w-full h-full object-cover" />
        </div>
      </div>
    </div>

    <hr class="border-white/10" />

    <div class="space-y-2">
      <label for="ui_language" class="block text-xs font-medium text-gray-500 uppercase tracking-wider">{{ t('settings.language.label') }}</label>
      <select
        id="ui_language"
        v-model="uiLanguage"
        name="ui_language"
        class="w-full bg-surface-950 border border-white/10 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      >
        <option value="en">{{ t('settings.language.english') }}</option>
        <option value="de">{{ t('settings.language.german') }}</option>
      </select>
      <p class="text-[11px] text-white/55">{{ t('settings.language.help') }}</p>
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
        {{ t('settings.openBookmarksInNewTab') }}
      </label>
    </div>

    <hr class="border-white/10" />

    <div class="space-y-2">
      <label for="feed_search_url_template" class="block text-xs font-medium text-gray-500 uppercase tracking-wider">{{ t('settings.feedSearchUrl') }}</label>
      <input
        id="feed_search_url_template"
        v-model="feedSearchUrlTemplate"
        name="feed_search_url_template"
        type="url"
        placeholder="https://www.google.com/search?q=%s"
        class="w-full bg-surface-950 border border-white/10 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />
      <p class="text-[11px] text-white/55">
        {{ t('settings.feedSearchHelp') }}
      </p>
    </div>

    <hr class="border-white/10" />

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div class="space-y-2">
        <label for="feed_content_scale" class="block text-xs font-medium text-gray-500 uppercase tracking-wider">{{ t('settings.feedsContentSize') }}</label>
        <select
          id="feed_content_scale"
          v-model.number="feedContentScale"
          name="feed_content_scale"
          class="w-full bg-surface-950 border border-white/10 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option
            v-for="option in contentScaleOptions"
            :key="option.label"
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </select>
      </div>

      <div class="space-y-2">
        <label for="note_content_scale" class="block text-xs font-medium text-gray-500 uppercase tracking-wider">{{ t('settings.notesContentSize') }}</label>
        <select
          id="note_content_scale"
          v-model.number="noteContentScale"
          name="note_content_scale"
          class="w-full bg-surface-950 border border-white/10 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option
            v-for="option in contentScaleOptions"
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
          <p class="text-xs font-medium text-gray-500 uppercase tracking-wider">{{ t('settings.widgets') }}</p>
          <p class="text-[11px] text-white/55 mt-1">{{ t('settings.widgetsHelp') }}</p>
        </div>
        <label class="flex items-center gap-2 whitespace-nowrap text-sm text-gray-300">
          <input
            id="widget_rail_enabled"
            v-model="widgetRailEnabled"
            name="widget_rail_enabled"
            type="checkbox"
            class="rounded border-white/10 bg-surface-950 text-indigo-600 focus:ring-indigo-500"
          />
          <span>{{ t('settings.enableRail') }}</span>
        </label>
      </div>

      <div class="flex items-center justify-between gap-3 pt-0">
        <button
          type="button"
          class="shrink-0 px-3 py-2 bg-black/85 hover:bg-black border border-white/10 rounded text-[10px] uppercase tracking-wider font-bold text-white/85 hover:text-white transition-colors disabled:cursor-default disabled:opacity-35 disabled:hover:bg-black/85 disabled:hover:text-white/85"
          :disabled="!widgetRailEnabled"
          @click="isWeatherConfiguratorOpen = !isWeatherConfiguratorOpen"
        >
          {{ t('settings.configureWidgets') }}
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
            {{ t('settings.removeBackgroundImage') }}
          </button>
        </div>
        <div class="flex items-center gap-3">
          <button
            type="button"
            @click="emit('cancel')"
            class="px-4 py-2 text-xs font-medium text-gray-400 hover:text-gray-200 transition-colors"
          >
            {{ t('common.cancel') }}
          </button>
          <button
            type="submit"
            :disabled="!hasSettingsChanges"
            class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-medium transition-all disabled:cursor-default disabled:opacity-45 disabled:hover:bg-indigo-600"
          >
            {{ t('settings.saveSettings') }}
          </button>
        </div>
      </div>
    </div>
  </form>
</template>
