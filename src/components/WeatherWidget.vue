<script setup lang="ts">
import { fetchOpenMeteoWeather, isWeatherCacheUsable, makeWeatherLocationKey } from '@/composables/useOpenMeteoWeather'
import { getWeatherCodeMeta } from '@/composables/useWeatherCodes'
import {
  clearWeatherWidgetCache,
  getWeatherWidgetCache,
  setWeatherWidgetCache,
} from '@/composables/useWeatherWidgetLocal'
import type { WeatherWidgetConfig, WeatherWidgetData } from '@/types/widgets'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

const props = defineProps<{
  config: WeatherWidgetConfig
}>()

const emit = defineEmits<{
  configure: []
}>()

const WEATHER_ICONS: Record<string, string> = {
  sun: '☀',
  moon: '☾',
  'sun-haze': '☀',
  'moon-cloud': '☁',
  'cloud-sun': '⛅',
  cloud: '☁',
  fog: '〰',
  drizzle: '🌦',
  sleet: '🌨',
  rain: '🌧',
  snow: '❄',
  showers: '🌦',
  storm: '⛈',
}

const weatherData = ref<WeatherWidgetData | null>(null)
const loading = ref(false)
const refreshing = ref(false)
const error = ref<string | null>(null)
const fetchedAt = ref<number | null>(null)
const usingCachedData = ref(false)
const nowTick = ref(Date.now())

let refreshController: AbortController | null = null
let refreshIntervalHandle: number | null = null

const isConfigured = computed(() => !!props.config.location)
const effectiveRefreshIntervalMs = computed(() => Math.max(1, props.config.refresh_interval_minutes) * 60_000)
const conditionMeta = computed(() => {
  if (!weatherData.value) return null
  return getWeatherCodeMeta(weatherData.value.condition_code, weatherData.value.is_day)
})
const conditionIcon = computed(() => conditionMeta.value ? (WEATHER_ICONS[conditionMeta.value.icon] ?? '☁') : '☁')
const lastUpdatedLabel = computed(() => {
  if (!fetchedAt.value) return null
  return new Date(fetchedAt.value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
})

function isWeatherStaleNow() {
  if (!fetchedAt.value) return true
  return nowTick.value - fetchedAt.value > effectiveRefreshIntervalMs.value
}

const isStale = computed(() => {
  return isWeatherStaleNow()
})
const statusLabel = computed(() => {
  if (!isConfigured.value) return 'Set location'
  if (loading.value && !weatherData.value) return 'Loading'
  if (error.value && weatherData.value) return 'Stale'
  if (usingCachedData.value && isStale.value) return 'Cached'
  return 'Weather'
})

function resetState() {
  weatherData.value = null
  loading.value = false
  refreshing.value = false
  error.value = null
  fetchedAt.value = null
  usingCachedData.value = false
}

function stopRefreshLoop() {
  if (refreshIntervalHandle !== null) {
    window.clearInterval(refreshIntervalHandle)
    refreshIntervalHandle = null
  }
}

function abortRefresh() {
  if (refreshController) {
    refreshController.abort()
    refreshController = null
  }
}

async function hydrateFromCache() {
  if (!isConfigured.value) {
    resetState()
    return
  }
  try {
    const cached = await getWeatherWidgetCache()
    if (!isWeatherCacheUsable(cached, props.config)) {
      weatherData.value = null
      fetchedAt.value = null
      usingCachedData.value = false
      return
    }
    weatherData.value = cached.data
    fetchedAt.value = cached.fetched_at
    usingCachedData.value = true
  } catch {
    weatherData.value = null
    fetchedAt.value = null
    usingCachedData.value = false
  }
}

async function refreshWeather(force = false) {
  if (!isConfigured.value) return
  if (document.visibilityState === 'hidden' && !force) return

  abortRefresh()
  refreshController = new AbortController()
  error.value = null

  if (weatherData.value) {
    refreshing.value = true
  } else {
    loading.value = true
  }

  try {
    const data = await fetchOpenMeteoWeather(props.config, refreshController.signal)
    const fetchedNow = Date.now()
    weatherData.value = data
    fetchedAt.value = fetchedNow
    usingCachedData.value = false

    const locationKey = makeWeatherLocationKey(props.config)
    if (locationKey) {
      await setWeatherWidgetCache({
        provider: props.config.provider,
        units: props.config.units,
        location_key: locationKey,
        fetched_at: fetchedNow,
        data,
      })
    }
  } catch (refreshError) {
    if ((refreshError as Error).name === 'AbortError') return
    error.value = (refreshError as Error).message
  } finally {
    if (refreshController?.signal.aborted) return
    loading.value = false
    refreshing.value = false
    refreshController = null
  }
}

function syncRefreshLoop() {
  stopRefreshLoop()
  if (!isConfigured.value) return
  refreshIntervalHandle = window.setInterval(() => {
    nowTick.value = Date.now()
    if (document.visibilityState !== 'visible') return
    if (!isWeatherStaleNow()) return
    void refreshWeather(false)
  }, 60_000)
}

function handleVisibilityChange() {
  nowTick.value = Date.now()
  if (document.visibilityState !== 'visible') return
  if (!weatherData.value || isWeatherStaleNow()) {
    void refreshWeather(false)
  }
}

async function syncWeatherState() {
  if (!isConfigured.value) {
    abortRefresh()
    stopRefreshLoop()
    try {
      await clearWeatherWidgetCache()
    } catch {
      // ignore local cache cleanup failures
    }
    resetState()
    return
  }

  nowTick.value = Date.now()
  await hydrateFromCache()
  syncRefreshLoop()
  if (!weatherData.value || isWeatherStaleNow()) {
    await refreshWeather(false)
  }
}

watch(
  () => JSON.stringify(props.config),
  () => { void syncWeatherState() },
  { immediate: true },
)

onMounted(() => {
  document.addEventListener('visibilitychange', handleVisibilityChange)
})

onUnmounted(() => {
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  abortRefresh()
  stopRefreshLoop()
})
</script>

<template>
  <section
    class="st-widget-card st-weather-widget"
    :class="{ 'is-loading': loading || refreshing }"
    aria-label="Weather widget"
  >
    <template v-if="!isConfigured">
      <button
        type="button"
        class="st-weather-widget-empty"
        @click="emit('configure')"
      >
        <span class="st-weather-widget-empty-label">Weather</span>
        <span class="st-weather-widget-empty-copy">Set location to enable the widget.</span>
      </button>
    </template>

    <template v-else>
      <div class="st-weather-widget-head">
        <div class="min-w-0">
          <h2 class="st-weather-widget-location truncate">
            {{ weatherData?.location_label || 'Weather' }}
          </h2>
        </div>

        <button
          type="button"
          class="st-weather-widget-refresh"
          :disabled="loading || refreshing"
          @click="refreshWeather(true)"
          aria-label="Refresh weather now"
          title="Refresh weather now"
        >
          ↻
        </button>
      </div>

      <div v-if="weatherData" class="st-weather-widget-body">
        <div class="st-weather-widget-primary">
          <span class="st-weather-widget-icon" aria-hidden="true">{{ conditionIcon }}</span>
          <span class="st-weather-widget-temp">
            {{ Math.round(weatherData.current_temperature) }}°{{ weatherData.temperature_unit_label }}
          </span>
          <span class="st-weather-widget-condition">{{ weatherData.condition_label }}</span>
        </div>

        <div class="st-weather-widget-secondary">
          <span v-if="weatherData.high_temperature !== null && weatherData.low_temperature !== null">
            H {{ Math.round(weatherData.high_temperature) }}° · L {{ Math.round(weatherData.low_temperature) }}°
          </span>
          <span v-if="lastUpdatedLabel">
            Updated {{ lastUpdatedLabel }}
          </span>
          <span v-if="error" class="st-weather-widget-stale">Using last good result</span>
        </div>
      </div>

      <div v-else class="st-weather-widget-loading">
        {{ loading ? 'Loading weather…' : (error || 'Weather unavailable.') }}
      </div>

      <span
        v-if="statusLabel !== 'Weather'"
        class="st-weather-widget-status"
      >
        {{ statusLabel }}
      </span>
    </template>
  </section>
</template>
