import {fetchOpenMeteoWeather, isWeatherCacheUsable, makeWeatherLocationKey} from '../../../composables/useOpenMeteoWeather.ts'
import {getWeatherCodeMeta} from '../../../composables/useWeatherCodes.ts'
import {clearWeatherWidgetCache, getWeatherWidgetCache, setWeatherWidgetCache} from '../../../composables/useWeatherWidgetLocal.ts'
import {openModal, isModalOpen} from '../../components/modal.js'
import {t, getLocale} from '../../utils/i18n.js'
import {getWeatherIcon, renderClockWidget, renderWeatherForecastModal, renderWeatherWidget} from './render.js'

let host = null
let weatherHost = null
let clockHost = null
let widgetSettings = null
let weatherData = null
let loading = false
let refreshing = false
let error = ''
let fetchedAt = null
let usingCachedData = false
let refreshController = null
let refreshIntervalHandle = null
let clockTickHandle = null
let visibilityBound = false

function stopRefreshLoop() {
  if (refreshIntervalHandle !== null) {
    window.clearInterval(refreshIntervalHandle)
    refreshIntervalHandle = null
  }
}

function stopClockLoop() {
  if (clockTickHandle !== null) {
    window.clearTimeout(clockTickHandle)
    clockTickHandle = null
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

function getClockConfig() {
  return widgetSettings?.clock ?? {}
}

function getClockTickUnit() {
  const clock = getClockConfig()
  const source = `${clock.time_format ?? ''}`
  if (source.includes('{second}')) return 'second'
  if (source.includes('{minute}')) return 'minute'
  if (source.includes('{hour}')) return 'hour'
  return null
}

function getClockTickDelay(unit) {
  const now = new Date()
  const ms = now.getMilliseconds()
  const sec = now.getSeconds()
  const min = now.getMinutes()

  if (unit === 'second') {
    return Math.max(1, 1000 - ms)
  }
  if (unit === 'minute') {
    return Math.max(1, 60_000 - ((sec * 1000) + ms))
  }
  if (unit === 'hour') {
    return Math.max(1, 3_600_000 - ((min * 60_000) + (sec * 1000) + ms))
  }
  return 0
}

function getClockDate() {
  const timezone = widgetSettings?.weather?.location?.timezone || undefined
  if (!timezone) return new Date()
  try {
    const localized = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(new Date())
    const read = (type) => localized.find((part) => part.type === type)?.value ?? '00'
    return new Date(`${read('year')}-${read('month')}-${read('day')}T${read('hour')}:${read('minute')}:${read('second')}`)
  } catch {
    return new Date()
  }
}

function formatClockToken(date, token) {
  const locale = getLocale()
  switch (token) {
    case 'shortDay':
      return new Intl.DateTimeFormat(locale, {weekday: 'short'}).format(date)
    case 'day':
      return String(date.getDate())
    case 'shortMonth':
      return new Intl.DateTimeFormat(locale, {month: 'short'}).format(date)
    case 'month':
      return new Intl.DateTimeFormat(locale, {month: 'long'}).format(date)
    case 'shortYear':
      return new Intl.DateTimeFormat(locale, {year: '2-digit'}).format(date)
    case 'year':
      return new Intl.DateTimeFormat(locale, {year: 'numeric'}).format(date)
    case 'hour':
      return String(date.getHours()).padStart(2, '0')
    case 'minute':
      return String(date.getMinutes()).padStart(2, '0')
    case 'second':
      return String(date.getSeconds()).padStart(2, '0')
    default:
      return ''
  }
}

function formatClockString(template = '', date) {
  return String(template ?? '').replace(/\{([a-zA-Z]+)\}/g, (_match, token) => formatClockToken(date, token))
}

function buildClockState() {
  const clock = getClockConfig()
  const now = getClockDate()
  return {
    enabled: clock.enabled === true && widgetSettings?.rail_enabled === true,
    align: clock.align === 'right' ? 'right' : 'left',
    twoRow: clock.two_row === true,
    dateText: formatClockString(clock.date_format, now),
    timeText: formatClockString(clock.time_format, now),
    background: clock.background || '',
    border: clock.border || '',
    dateColor: clock.date_color || '',
    timeColor: clock.time_color || '',
    dateFontSize: clock.date_font_size,
    timeFontSize: clock.time_font_size,
  }
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

function renderWeatherHost() {
  if (!(weatherHost instanceof HTMLElement)) return
  weatherHost.innerHTML = renderWeatherWidget(buildState())
  if (isModalOpen()) renderWeatherModalBody()
}

function renderClockHost() {
  if (!(clockHost instanceof HTMLElement)) return
  const state = buildClockState()
  clockHost.setAttribute('data-widget-align', state.align)
  clockHost.innerHTML = renderClockWidget(state)
}

function updateClockText() {
  if (!(clockHost instanceof HTMLElement)) return
  const dateNode = clockHost.querySelector('.st-clock-widget-date')
  const timeNode = clockHost.querySelector('.st-clock-widget-time')
  if (!(dateNode instanceof HTMLElement) || !(timeNode instanceof HTMLElement)) {
    renderClockHost()
    return
  }
  const state = buildClockState()
  clockHost.setAttribute('data-widget-align', state.align)
  dateNode.textContent = state.dateText
  timeNode.textContent = state.timeText
}

function renderHost() {
  if (!(host instanceof HTMLElement)) return
  renderWeatherHost()
  renderClockHost()
}

function queueClockRender() {
  stopClockLoop()
  const clock = getClockConfig()
  if (!(widgetSettings?.rail_enabled && clock?.enabled)) return
  const unit = getClockTickUnit()
  if (!unit) return
  const interval = getClockTickDelay(unit)
  clockTickHandle = window.setTimeout(() => {
    updateClockText()
    queueClockRender()
  }, interval)
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
    queueClockRender()
    return
  }

  await hydrateFromCache()
  renderHost()
  queueClockRender()
  syncRefreshLoop()
  if (!weatherData || isWeatherStaleNow()) {
    await refreshWeather(false)
  }
}

export function initializeWidgetRail(settings) {
  widgetSettings = settings
  host = document.querySelector('[data-widget-rail-host]')
  weatherHost = document.querySelector('[data-widget-weather-host]')
  clockHost = document.querySelector('[data-widget-clock-host]')
  abortRefresh()
  stopRefreshLoop()
  stopClockLoop()
  renderHost()

  if (!visibilityBound) {
    document.addEventListener('visibilitychange', handleVisibilityChange)
    visibilityBound = true
  }

  void syncWeatherState()
  queueClockRender()
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
