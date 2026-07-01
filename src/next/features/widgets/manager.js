import {fetchOpenMeteoWeather, isWeatherCacheUsable, makeWeatherLocationKey} from '../../../composables/useOpenMeteoWeather.ts'
import {getWeatherCodeMeta} from '../../../composables/useWeatherCodes.ts'
import {clearWeatherWidgetCache, getWeatherWidgetCache, setWeatherWidgetCache} from '../../../composables/useWeatherWidgetLocal.ts'
import {openModal, isModalOpen} from '../../components/modal.js'
import {t, getLocale} from '../../utils/i18n.js'
import {getWeatherIcon, renderWeatherForecastModal, renderWeatherWidget} from './render.js'

let host = null
let widgetSettings = null
let weatherData = null
let loading = false
let refreshing = false
let error = ''
let fetchedAt = null
let usingCachedData = false
let refreshController = null
let refreshIntervalHandle = null
let visibilityBound = false

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

function getRefreshIntervalMs() {
  return Math.max(1, Number(widgetSettings?.weather?.refresh_interval_minutes ?? 30)) * 60_000
}

function isConfigured() {
  return Boolean(widgetSettings?.rail_enabled && widgetSettings?.weather?.enabled && widgetSettings?.weather?.location)
}

function isWeatherStaleNow() {
  if (!fetchedAt) return true
  return Date.now() - fetchedAt > getRefreshIntervalMs()
}

function formatTime(value) {
  if (!value) return ''
  return new Intl.DateTimeFormat(getLocale(), {
    hour: '2-digit',
    minute: '2-digit',
  }).format(value)
}

function formatForecastDay(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(getLocale(), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(date)
}

function buildState() {
  const weatherEnabled = widgetSettings?.weather?.enabled === true
  const meta = weatherData ? getWeatherCodeMeta(weatherData.condition_code, weatherData.is_day) : null
  const configured = isConfigured()
  let statusLabel = t('weather.title')

  if (!weatherEnabled) statusLabel = ''
  else if (!configured) statusLabel = t('weather.setLocation')
  else if (loading && !weatherData) statusLabel = t('weather.loading')
  else if (error && weatherData) statusLabel = t('weather.stale')
  else if (usingCachedData && isWeatherStaleNow()) statusLabel = t('weather.cached')

  const forecastRows = Array.isArray(weatherData?.daily_forecast)
    ? weatherData.daily_forecast.slice(0, 7).map((entry) => {
      const meta = getWeatherCodeMeta(entry.condition_code, true)
      const high = entry.high_temperature != null ? Math.round(entry.high_temperature) : '–'
      const low = entry.low_temperature != null ? Math.round(entry.low_temperature) : '–'

      return {
        dayLabel: formatForecastDay(entry.date),
        icon: getWeatherIcon(meta.icon),
        conditionLabel: t(meta.labelKey),
        rangeLabel: t('weather.highLow', {high, low}),
      }
    })
    : []

  return {
    enabled: weatherEnabled,
    configured,
    loading,
    refreshing,
    error,
    weatherData,
    conditionLabel: meta ? t(meta.labelKey) : t('weather.conditions.unavailableLabel'),
    conditionIcon: getWeatherIcon(meta?.icon),
    lastUpdatedLabel: formatTime(fetchedAt),
    statusLabel,
    forecastRows,
  }
}

function renderWeatherModalBody() {
  const body = document.querySelector('[data-modal][data-modal-open] [data-modal-body]')
  if (!(body instanceof HTMLElement)) return
  if (!body.closest('.st-weather-forecast-modal-shell')) return
  body.innerHTML = renderWeatherForecastModal(buildState())
}

function renderHost() {
  if (!(host instanceof HTMLElement)) return
  host.innerHTML = renderWeatherWidget(buildState())
  if (isModalOpen()) renderWeatherModalBody()
}

async function hydrateFromCache() {
  if (!isConfigured()) {
    weatherData = null
    fetchedAt = null
    usingCachedData = false
    return
  }

  try {
    const cached = await getWeatherWidgetCache()
    if (!isWeatherCacheUsable(cached, widgetSettings.weather)) {
      weatherData = null
      fetchedAt = null
      usingCachedData = false
      return
    }
    weatherData = cached.data
    fetchedAt = cached.fetched_at
    usingCachedData = true
  } catch {
    weatherData = null
    fetchedAt = null
    usingCachedData = false
  }
}

async function refreshWeather(force = false) {
  if (!isConfigured()) return
  if (document.visibilityState === 'hidden' && !force) return

  abortRefresh()
  refreshController = new AbortController()
  error = ''
  if (weatherData) refreshing = true
  else loading = true
  renderHost()

  try {
    const data = await fetchOpenMeteoWeather(widgetSettings.weather, refreshController.signal)
    const fetchedNow = Date.now()
    weatherData = data
    fetchedAt = fetchedNow
    usingCachedData = false

    const locationKey = makeWeatherLocationKey(widgetSettings.weather)
    if (locationKey) {
      await setWeatherWidgetCache({
        provider: widgetSettings.weather.provider,
        units: widgetSettings.weather.units,
        location_key: locationKey,
        fetched_at: fetchedNow,
        data,
      })
    }
  } catch (refreshError) {
    if (refreshError?.name === 'AbortError') return
    error = refreshError instanceof Error ? refreshError.message : String(refreshError)
  } finally {
    if (refreshController?.signal.aborted) return
    loading = false
    refreshing = false
    refreshController = null
    renderHost()
  }
}

function syncRefreshLoop() {
  stopRefreshLoop()
  if (!isConfigured()) return
  refreshIntervalHandle = window.setInterval(() => {
    if (document.visibilityState !== 'visible') return
    if (!isWeatherStaleNow()) return
    void refreshWeather(false)
  }, 60_000)
}

function handleVisibilityChange() {
  if (document.visibilityState !== 'visible') return
  if (!weatherData || isWeatherStaleNow()) {
    void refreshWeather(false)
  }
}

async function syncWeatherState() {
  if (!isConfigured()) {
    abortRefresh()
    stopRefreshLoop()
    try {
      await clearWeatherWidgetCache()
    } catch {
      // ignore
    }
    weatherData = null
    loading = false
    refreshing = false
    error = ''
    fetchedAt = null
    usingCachedData = false
    renderHost()
    return
  }

  await hydrateFromCache()
  renderHost()
  syncRefreshLoop()
  if (!weatherData || isWeatherStaleNow()) {
    await refreshWeather(false)
  }
}

export function initializeWidgetRail(settings) {
  widgetSettings = settings
  host = document.querySelector('[data-widget-rail-host]')
  abortRefresh()
  stopRefreshLoop()
  renderHost()

  if (!visibilityBound) {
    document.addEventListener('visibilitychange', handleVisibilityChange)
    visibilityBound = true
  }

  void syncWeatherState()
}

export async function refreshWeatherWidgetNow() {
  await refreshWeather(true)
}

export function openWeatherForecastModal() {
  openModal({
    title: weatherData?.location_label || t('weather.title'),
    content: renderWeatherForecastModal(buildState()),
    panelClass: 'st-weather-forecast-modal-shell',
    panelStyle: '--st-modal-max-width: 44rem;',
  })
}
