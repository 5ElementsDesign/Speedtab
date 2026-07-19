import {fetchOpenMeteoWeather, isWeatherCacheUsable, makeWeatherLocationKey} from '../../../composables/useOpenMeteoWeather.ts'
import {getWeatherCodeMeta} from '../../../composables/useWeatherCodes.ts'
import {clearWeatherWidgetCache, getWeatherWidgetCache, setWeatherWidgetCache} from '../../../composables/useWeatherWidgetLocal.ts'
import {dispatch} from '../../app/dispatch.js'
import {openModal, isModalOpen} from '../../components/modal.js'
import {createDefaultClockToolsState, getStopwatchElapsedMs, hasRunningClockTools, loadClockToolsState, normalizeClockToolsState, saveClockToolsState} from '../../data/clock-tools.js'
import {patchHost, patchInner} from '../../utils/dom-patch.js'
import {escapeHtml} from '../../utils/html.js'
import {t, getLocale} from '../../utils/i18n.js'
import {buildWeatherInlineStyle, getWeatherIcon, renderClockDateMarkup, renderClockToolsModal, renderClockWidget, renderRemoteSyncIndicator, renderWeatherForecastModal, renderWeatherWidget} from './render.js'
import {createClockDraftFromDuration, createClockDraftFromParts, createCurrentClockDraft, getClockDraftDurationMs} from './utils.js'

let host = null
let weatherHost = null
let clockHost = null
let remoteSyncHost = null
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
let clockToolsLoopHandle = null
let clockToolsWatchHandle = null
let clockTimerDraftLoopHandle = null
let visibilityBound = false
let remoteSyncListenerBound = false
let clockToolsState = createDefaultClockToolsState()
let clockToolsTrigger = null
let clockTimerDraft = createCurrentClockDraft()
let clockTimerDraftFrozen = false
let clockTimerDraftSummaryVisible = false
let remoteSyncState = {
  active: false,
  kind: '',
  label: '',
}
let remoteSyncActivity = {
  check: false,
  push: false,
}
let remoteSyncResetHandle = null

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

function stopClockToolsLoop() {
  if (clockToolsLoopHandle !== null) {
    window.clearTimeout(clockToolsLoopHandle)
    clockToolsLoopHandle = null
  }
}

function stopClockToolsWatchLoop() {
  if (clockToolsWatchHandle !== null) {
    window.clearTimeout(clockToolsWatchHandle)
    clockToolsWatchHandle = null
  }
}

function stopClockTimerDraftLoop() {
  if (clockTimerDraftLoopHandle !== null) {
    window.clearTimeout(clockTimerDraftLoopHandle)
    clockTimerDraftLoopHandle = null
  }
}

function stopRemoteSyncReset() {
  if (remoteSyncResetHandle !== null) {
    window.clearTimeout(remoteSyncResetHandle)
    remoteSyncResetHandle = null
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
  const dateSource = `${clock.date_format ?? ''}`
  const source = `${clock.time_format ?? ''}`
  if (clock.display === 'analog' && clock.smooth_motion !== false) {
    if (dateSource.includes('{second}')) return 'second'
    if (dateSource.includes('{minute}')) return 'minute'
    if (dateSource.includes('{hour}')) return 'hour'
    return dateSource.trim() ? 'hour' : null
  }
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
    case 'dayShort':
    case 'shortDay':
      return new Intl.DateTimeFormat(locale, {weekday: 'short'}).format(date)
    case 'dayName':
      return new Intl.DateTimeFormat(locale, {weekday: 'long'}).format(date)
    case 'day':
      return String(date.getDate())
    case 'monthShort':
    case 'shortMonth':
      return new Intl.DateTimeFormat(locale, {month: 'short'}).format(date)
    case 'monthName':
    case 'month':
      if (token === 'month') return String(date.getMonth() + 1)
      return new Intl.DateTimeFormat(locale, {month: 'long'}).format(date)
    case 'yearShort':
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
  return String(template ?? '')
    .replace(/\{([a-zA-Z]+)\}/g, (_match, token) => formatClockToken(date, token))
}

function buildClockState() {
  const clock = getClockConfig()
  const now = getClockDate()
  const display = clock.display === 'analog' ? 'analog' : 'digital'
  return {
    enabled: clock.enabled === true && widgetSettings?.rail_enabled === true,
    display,
    smoothMotion: clock.smooth_motion !== false,
    align: clock.align === 'right' ? 'right' : 'left',
    twoRow: clock.two_row === true,
    dateText: formatClockString(clock.date_format, now),
    timeText: formatClockString(clock.time_format, now),
    hour: now.getHours(),
    minute: now.getMinutes(),
    second: now.getSeconds(),
    millisecond: Date.now() % 1000,
    showSeconds: (clock.time_format ?? '').includes('{second}'),
    background: clock.background || '',
    shadow: clock.shadow || clock.border || '',
    dialColor: clock.dial_color || '',
    dateColor: clock.date_color || '',
    timeColor: clock.time_color || '',
    dateFontSize: clock.date_font_size,
    timeFontSize: clock.time_font_size,
  }
}

function buildState() {
  const weatherEnabled = widgetSettings?.weather?.enabled === true
  const locationLabel = widgetSettings?.weather?.display_label?.trim() || weatherData?.location_label || t('weather.title')
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
    compactMode: widgetSettings?.weather?.compact_mode === true,
    background: widgetSettings?.weather?.background || '',
    shadow: widgetSettings?.weather?.shadow || widgetSettings?.weather?.border || '',
    locationColor: widgetSettings?.weather?.location_color || '',
    temperatureColor: widgetSettings?.weather?.temperature_color || '',
    temperatureFontSize: widgetSettings?.weather?.temperature_font_size,
    mutedColor: widgetSettings?.weather?.muted_color || '',
    weatherData,
    locationLabel,
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
  patchInner(body, renderWeatherForecastModal(buildState()))
}

function renderWeatherHost() {
  if (!(weatherHost instanceof HTMLElement)) return
  const state = buildState()
  const current = weatherHost.querySelector('.st-weather-widget')
  const shouldReplace =
    !(current instanceof HTMLElement)
    || state.enabled !== true
    || state.configured !== true
    || !(current.querySelector('[data-weather-temp]') instanceof HTMLElement)
    || !(current.querySelector('[data-weather-location]') instanceof HTMLElement)
    || !(current.querySelector('[data-weather-icon]') instanceof HTMLElement)

  if (shouldReplace) {
    patchInner(weatherHost, renderWeatherWidget(state))
    if (isModalOpen()) renderWeatherModalBody()
    return
  }

  const nextStyle = buildWeatherInlineStyle(state)
  current.className = `st-widget-card st-weather-widget fade-in-down is-visible${state.loading || state.refreshing ? ' is-loading' : ''}${state.compactMode ? ' is-compact' : ''}`
  if (nextStyle) current.setAttribute('style', nextStyle)
  else current.removeAttribute('style')

  const locationLabel = String(state.locationLabel || t('weather.title'))
  const [compactLine1Raw, ...compactRest] = locationLabel.split(',')
  const compactLine1 = compactLine1Raw?.trim() || locationLabel
  const compactLine2 = compactRest.join(',').trim()
  const refreshButton = current.querySelector('.st-weather-widget-refresh')
  const locationNode = current.querySelector('[data-weather-location]')
  const iconNode = current.querySelector('[data-weather-icon]')
  const tempNode = current.querySelector('[data-weather-temp]')
  const conditionNode = current.querySelector('[data-weather-condition]')
  const compactLine1Node = current.querySelector('[data-weather-compact-line1]')
  const compactLine2Node = current.querySelector('[data-weather-compact-line2]')
  const rangeNode = current.querySelector('[data-weather-secondary-range]')
  const updatedNode = current.querySelector('[data-weather-secondary-updated]')
  const staleNode = current.querySelector('[data-weather-secondary-stale]')
  const statusNode = current.querySelector('[data-weather-status]')

  if (locationNode instanceof HTMLElement) locationNode.textContent = locationLabel
  if (iconNode instanceof HTMLElement) iconNode.textContent = state.conditionIcon
  if (tempNode instanceof HTMLElement && state.weatherData) {
    tempNode.textContent = `${Math.round(state.weatherData.current_temperature)}°${state.weatherData.temperature_unit_label}`
  }
  if (conditionNode instanceof HTMLElement) conditionNode.textContent = state.conditionLabel
  if (compactLine1Node instanceof HTMLElement) compactLine1Node.textContent = `${compactLine1}${compactLine2 ? ',' : ''}`
  if (compactLine2Node instanceof HTMLElement) compactLine2Node.textContent = compactLine2
  if (compactLine2Node instanceof HTMLElement) compactLine2Node.toggleAttribute('hidden', !compactLine2)
  if (refreshButton instanceof HTMLButtonElement) refreshButton.disabled = state.loading || state.refreshing

  const nextRange = state.weatherData?.high_temperature != null && state.weatherData?.low_temperature != null
    ? t('weather.highLow', {
      high: Math.round(state.weatherData.high_temperature),
      low: Math.round(state.weatherData.low_temperature),
    })
    : ''
  if (rangeNode instanceof HTMLElement) {
    rangeNode.textContent = nextRange
    rangeNode.toggleAttribute('hidden', !nextRange)
  }

  const nextUpdated = state.lastUpdatedLabel
    ? t('weather.updatedAt', {time: state.lastUpdatedLabel})
    : ''
  if (updatedNode instanceof HTMLElement) {
    updatedNode.textContent = nextUpdated
    updatedNode.toggleAttribute('hidden', !nextUpdated)
  }

  const nextStale = state.error ? t('weather.usingLastGoodResult') : ''
  if (staleNode instanceof HTMLElement) {
    staleNode.textContent = nextStale
    staleNode.toggleAttribute('hidden', !nextStale)
  }

  const nextStatus = state.statusLabel && state.statusLabel !== t('weather.title')
    ? state.statusLabel
    : ''
  if (statusNode instanceof HTMLElement) {
    statusNode.textContent = nextStatus
    statusNode.toggleAttribute('hidden', !nextStatus)
  }

  if (isModalOpen()) renderWeatherModalBody()
}

function renderClockHost() {
  if (!(clockHost instanceof HTMLElement)) return
  const state = buildClockState()
  clockHost.setAttribute('data-widget-align', state.align)
  const current = clockHost.querySelector('[data-widget-clock]')
  if (!(current instanceof HTMLButtonElement)) {
    patchInner(clockHost, renderClockWidget(state))
    return
  }

  const nextStyleParts = []
  if (state.background) nextStyleParts.push(`--st-clock-widget-bg:${state.background}`)
  if (state.shadow) nextStyleParts.push(`--st-clock-widget-shadow:${state.shadow}`)
  if (state.dialColor) nextStyleParts.push(`--st-clock-widget-dial-color:${state.dialColor}`)
  if (state.dateColor) nextStyleParts.push(`--st-clock-widget-date-color:${state.dateColor}`)
  if (state.timeColor) nextStyleParts.push(`--st-clock-widget-time-color:${state.timeColor}`)
  if (state.dateFontSize) nextStyleParts.push(`--st-clock-widget-date-size:${state.dateFontSize}px`)
  if (state.timeFontSize) nextStyleParts.push(`--st-clock-widget-time-size:${state.timeFontSize}px`)
  if (state.display === 'analog' && state.timeFontSize) {
    nextStyleParts.push(`--st-clock-widget-analog-size:${Math.max(56, Math.min(124, Number(state.timeFontSize) * 4.2))}px`)
  }
  const nextStyle = nextStyleParts.join(';')
  const nextDisplay = state.display === 'analog' ? 'analog' : 'digital'
  const currentDisplay = current.dataset.clockDisplay === 'analog' ? 'analog' : 'digital'
  const nextSmoothMotion = state.smoothMotion === true
  const currentSmoothMotion = current.dataset.clockSmoothMotion !== 'false'
  const nextDateText = state.dateText || ''

  current.setAttribute('data-widget-align', state.align)
  current.setAttribute('data-clock-display', nextDisplay)
  current.setAttribute('data-clock-smooth-motion', nextSmoothMotion ? 'true' : 'false')
  current.classList.toggle('is-two-row', state.twoRow === true)
  current.classList.toggle('is-analog', nextDisplay === 'analog')
  current.classList.toggle('is-digital', nextDisplay !== 'analog')
  if (nextStyle) current.setAttribute('style', nextStyle)
  else current.removeAttribute('style')

  if (currentDisplay !== nextDisplay || currentSmoothMotion !== nextSmoothMotion) {
    patchHost(current, renderClockWidget(state))
    return
  }

  const dateEl = current.querySelector('.st-clock-widget-date')
  if (dateEl instanceof HTMLElement) {
    dateEl.innerHTML = renderClockDateMarkup(nextDateText)
  }

  if (nextDisplay === 'analog') {
    const analogEl = current.querySelector('.st-clock-widget-analog')
    if (analogEl instanceof HTMLElement) {
      if (nextSmoothMotion) return
      const hour = Number(state.hour) || 0
      const minute = Number(state.minute) || 0
      const second = Number(state.second) || 0
      const showSeconds = state.showSeconds === true
      const hourAngle = ((hour % 12) + (minute / 60) + (second / 3600)) * 30
      const minuteAngle = (minute + (second / 60)) * 6
      const secondAngle = second * 6
      const hourHand = analogEl.querySelector('.st-clock-widget-analog-hand.is-hour')
      const minuteHand = analogEl.querySelector('.st-clock-widget-analog-hand.is-minute')
      const secondHand = analogEl.querySelector('.st-clock-widget-analog-hand.is-second')
      if (hourHand instanceof SVGElement) hourHand.setAttribute('transform', `rotate(${hourAngle} 50 50)`)
      if (minuteHand instanceof SVGElement) minuteHand.setAttribute('transform', `rotate(${minuteAngle} 50 50)`)
      if (showSeconds) {
        if (secondHand instanceof SVGElement) {
          secondHand.setAttribute('transform', `rotate(${secondAngle} 50 50)`)
        } else {
          patchHost(current, renderClockWidget(state))
        }
      } else if (secondHand instanceof SVGElement) {
        secondHand.remove()
      }
    }
    return
  }

  const timeEl = current.querySelector('.st-clock-widget-time')
  if (timeEl instanceof HTMLElement) {
    timeEl.textContent = state.timeText || ''
  }
}

function isClockToolsModalOpen() {
  return Boolean(document.querySelector('[data-clock-tools-modal]'))
}

function getClockToolsModalRoot() {
  const root = document.querySelector('[data-clock-tools-modal]')
  return root instanceof HTMLElement ? root : null
}

function formatStopwatchValue(ms = 0) {
  const totalTenths = Math.max(0, Math.floor(ms / 100))
  const tenths = totalTenths % 10
  const totalSeconds = Math.floor(totalTenths / 10)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${tenths}`
}

function formatTimerValue(ms = 0) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function getTimerToastLabel(timer = {}) {
  return timer.label || `${t('clock.unnamedTimer')}, ${formatTimerValue(timer.duration_ms || timer.remaining_ms || 0)}`
}

function getNewlyExpiredTimers(previousState, nextState) {
  const previousTimers = new Map((previousState?.timers || []).map((timer) => [timer.id, timer]))
  return (nextState?.timers || []).filter((timer) => (
    timer?.state === 'expired'
    && previousTimers.get(timer.id)?.state !== 'expired'
  ))
}

function decorateClockToolsState(now = Date.now()) {
  const normalized = normalizeClockToolsState(clockToolsState, now)
  clockToolsState = normalized

  return {
    ...normalized,
    stopwatch: {
      ...normalized.stopwatch,
      displayElapsed: formatStopwatchValue(getStopwatchElapsedMs(normalized.stopwatch, now)),
      hasElapsed: getStopwatchElapsedMs(normalized.stopwatch, now) > 0,
    },
    timers: normalized.timers.map((timer) => {
      const remainingMs = timer.state === 'running'
        ? Math.max(0, (timer.end_at ?? now) - now)
        : Math.max(0, timer.remaining_ms ?? 0)
      const progressPercent = timer.duration_ms > 0
        ? Math.max(0, Math.min(100, (remainingMs / timer.duration_ms) * 100))
        : 0
      return {
        ...timer,
        remaining_ms: remainingMs,
        displayRemaining: formatTimerValue(remainingMs),
        displayDuration: formatTimerValue(timer.duration_ms || remainingMs),
        displayExpiredAt: timer.expired_at ? formatTime(timer.expired_at) : '',
        progressPercent,
      }
    }),
  }
}

function getClockToolsTickDelay() {
  if (clockToolsState?.stopwatch?.running === true) return 100
  if (clockToolsState?.timers?.some?.((timer) => timer?.state === 'running')) return 1000
  return 0
}

function getClockTimerInputs(root = getClockToolsModalRoot()) {
  if (!(root instanceof HTMLElement)) return null
  return {
    root,
    labelInput: root.querySelector('input[name="clock_timer_label"]'),
    hoursInput: root.querySelector('input[name="clock_timer_hours"]'),
    minutesInput: root.querySelector('input[name="clock_timer_minutes"]'),
    secondsInput: root.querySelector('input[name="clock_timer_seconds"]'),
    summary: root.querySelector('[data-clock-timer-summary]'),
    button: root.querySelector('[data-clock-timer-create-btn]'),
  }
}

function isClockTimerSegmentInput(element) {
  return element instanceof HTMLInputElement
    && ['clock_timer_hours', 'clock_timer_minutes', 'clock_timer_seconds'].includes(element.name)
}

function freezeClockTimerDraftAtCurrentTimeIfNeeded(controls = getClockTimerInputs()) {
  if (!controls || clockTimerDraftFrozen) return
  if (!isClockTimerSegmentInput(document.activeElement)) return
  clockTimerDraft = createCurrentClockDraft(Date.now())
  clockTimerDraftFrozen = true
  writeClockTimerInputs(clockTimerDraft, controls.root)
  stopClockTimerDraftLoop()
}

function writeClockTimerInputs(draft = clockTimerDraft, root = getClockToolsModalRoot()) {
  const controls = getClockTimerInputs(root)
  if (!controls) return
  if (controls.hoursInput instanceof HTMLInputElement) controls.hoursInput.value = String(draft.hours)
  if (controls.minutesInput instanceof HTMLInputElement) controls.minutesInput.value = String(draft.minutes)
  if (controls.secondsInput instanceof HTMLInputElement) controls.secondsInput.value = String(draft.seconds)
  if (controls.summary instanceof HTMLElement) controls.summary.textContent = draft.summaryLabel
}

function getTimerDraftValues() {
  const controls = getClockTimerInputs()
  if (!controls) return null
  const draft = createClockDraftFromParts(clockTimerDraft.baseTimestamp, {
    hours: controls.hoursInput instanceof HTMLInputElement ? controls.hoursInput.value : clockTimerDraft.hours,
    minutes: controls.minutesInput instanceof HTMLInputElement ? controls.minutesInput.value : clockTimerDraft.minutes,
    seconds: controls.secondsInput instanceof HTMLInputElement ? controls.secondsInput.value : clockTimerDraft.seconds,
  })

  return {
    label: controls.labelInput instanceof HTMLInputElement ? controls.labelInput.value.trim() : '',
    hours: draft.hours,
    minutes: draft.minutes,
    seconds: draft.seconds,
    durationMs: getClockDraftDurationMs(draft),
    draft,
  }
}

function updateClockTimerCreateState() {
  const controls = getClockTimerInputs()
  if (!controls || !(controls.button instanceof HTMLButtonElement)) return
  freezeClockTimerDraftAtCurrentTimeIfNeeded(controls)
  const draft = getTimerDraftValues()
  if (!draft) return
  clockTimerDraft = draft.draft
  writeClockTimerInputs(clockTimerDraft, controls.root)
  clockTimerDraftSummaryVisible = draft.durationMs > 0
  if (controls.summary instanceof HTMLElement) {
    controls.summary.hidden = !clockTimerDraftSummaryVisible
  }
  controls.button.disabled = draft.durationMs <= 0
}

function syncLiveClockTimerDraft() {
  const root = getClockToolsModalRoot()
  if (!(root instanceof HTMLElement)) return
  const controls = getClockTimerInputs(root)
  if (!controls) return
  if (clockTimerDraftFrozen) return
  if (isClockTimerSegmentInput(document.activeElement)) {
    freezeClockTimerDraftAtCurrentTimeIfNeeded(controls)
    return
  }
  clockTimerDraft = createCurrentClockDraft(Date.now())
  writeClockTimerInputs(clockTimerDraft, controls.root)
  if (controls.summary instanceof HTMLElement) {
    controls.summary.hidden = true
  }
  if (controls.button instanceof HTMLButtonElement) {
    controls.button.disabled = true
  }
}

function queueClockTimerDraftLoop() {
  stopClockTimerDraftLoop()
  if (!isClockToolsModalOpen()) return
  if (document.visibilityState === 'hidden') return
  if (clockTimerDraftFrozen) return
  const now = Date.now()
  const delay = Math.max(1, 1000 - (now % 1000))
  clockTimerDraftLoopHandle = window.setTimeout(() => {
    syncLiveClockTimerDraft()
    queueClockTimerDraftLoop()
  }, delay)
}

function renderClockToolsStopwatch() {
  const root = getClockToolsModalRoot()
  if (!(root instanceof HTMLElement)) return
  const nextHtml = renderClockToolsModal(decorateClockToolsState())
  const nextRoot = document.createElement('div')
  nextRoot.innerHTML = nextHtml
  const nextModal = nextRoot.firstElementChild
  if (!(nextModal instanceof HTMLElement)) return

  const stopwatchTime = root.querySelector('[data-clock-stopwatch-time]')
  const nextStopwatchTime = nextModal.querySelector('[data-clock-stopwatch-time]')
  if (stopwatchTime instanceof HTMLElement && nextStopwatchTime instanceof HTMLElement) {
    stopwatchTime.textContent = nextStopwatchTime.textContent
  }

  const stopwatchActions = root.querySelector('.st-clock-tools-stopwatch-actions')
  const nextStopwatchActions = nextModal.querySelector('.st-clock-tools-stopwatch-actions')
  if (stopwatchActions instanceof HTMLElement && nextStopwatchActions instanceof HTMLElement) {
    patchHost(stopwatchActions, nextStopwatchActions.outerHTML)
  }
}

function renderClockToolsLists() {
  const root = getClockToolsModalRoot()
  if (!(root instanceof HTMLElement)) return
  const nextHtml = renderClockToolsModal(decorateClockToolsState())
  const nextRoot = document.createElement('div')
  nextRoot.innerHTML = nextHtml
  const nextModal = nextRoot.firstElementChild
  if (!(nextModal instanceof HTMLElement)) return

  const activeList = root.querySelector('[data-clock-timer-active-list]')
  const nextActiveList = nextModal.querySelector('[data-clock-timer-active-list]')
  if (activeList instanceof HTMLElement && nextActiveList instanceof HTMLElement) {
    patchHost(activeList, nextActiveList.outerHTML)
  }

  const expiredList = root.querySelector('[data-clock-timer-expired-list]')
  const nextExpiredList = nextModal.querySelector('[data-clock-timer-expired-list]')
  if (expiredList instanceof HTMLElement && nextExpiredList instanceof HTMLElement) {
    patchHost(expiredList, nextExpiredList.outerHTML)
  }

  updateClockTimerCreateState()
}

function patchClockToolsTick(now = Date.now()) {
  const previousState = clockToolsState
  const state = decorateClockToolsState(now)
  const root = getClockToolsModalRoot()
  const newlyExpired = getNewlyExpiredTimers(previousState, state)

  if (root instanceof HTMLElement) {
    const stopwatchTime = root.querySelector('[data-clock-stopwatch-time]')
    if (stopwatchTime instanceof HTMLElement) {
      stopwatchTime.textContent = state.stopwatch.displayElapsed
    }

    state.timers.forEach((timer) => {
      const row = root.querySelector(`[data-timer-id="${CSS.escape(timer.id)}"]`)
      if (!(row instanceof HTMLElement)) return
      const remaining = row.querySelector('[data-clock-timer-remaining]')
      if (remaining instanceof HTMLElement) remaining.textContent = timer.displayRemaining
      const progress = row.querySelector('[data-clock-timer-progress]')
      if (progress instanceof HTMLElement) progress.style.width = `${timer.progressPercent}%`
      row.dataset.timerState = timer.state
      row.dataset.remainingMs = String(timer.remaining_ms || 0)
    })
  }

  if (newlyExpired.length) {
    newlyExpired.forEach((timer) => {
      dispatch('toast', {
        title: t('clock.timerDoneTitle'),
        message: t('clock.timerDoneMessage', {label: getTimerToastLabel(timer)}),
        tone: 'success',
      })
    })
    void persistClockToolsState()
    if (root instanceof HTMLElement) {
      renderClockToolsLists()
    }
  }
}

function queueClockToolsLoop() {
  stopClockToolsLoop()
  if (!isClockToolsModalOpen()) return
  if (document.visibilityState === 'hidden') return
  const delay = getClockToolsTickDelay()
  if (!delay) return
  clockToolsLoopHandle = window.setTimeout(() => {
    patchClockToolsTick(Date.now())
    queueClockToolsLoop()
  }, delay)
}

function queueClockToolsWatchLoop() {
  stopClockToolsWatchLoop()
  if (document.visibilityState === 'hidden') return
  if (!hasRunningClockTools(clockToolsState)) return
  clockToolsWatchHandle = window.setTimeout(() => {
    patchClockToolsTick(Date.now())
    queueClockToolsWatchLoop()
  }, 1000)
}

async function persistClockToolsState() {
  clockToolsState = await saveClockToolsState(clockToolsState)
  queueClockToolsLoop()
  queueClockToolsWatchLoop()
  return clockToolsState
}

function buildRemoteSyncState() {
  return {
    enabled: widgetSettings?.rail_enabled === true && widgetSettings?.remote_sync_indicator === true,
    active: remoteSyncState.active === true,
    kind: remoteSyncState.kind || '',
    label: remoteSyncState.label || t('widgetRail.syncIndicatorIdle'),
  }
}

function renderRemoteSyncHost() {
  if (!(remoteSyncHost instanceof HTMLElement)) return
  patchInner(remoteSyncHost, renderRemoteSyncIndicator(buildRemoteSyncState()))
}

function resetRemoteSyncIndicator() {
  stopRemoteSyncReset()
  remoteSyncActivity = {
    check: false,
    push: false,
  }
  remoteSyncState = {
    active: false,
    kind: '',
    label: t('widgetRail.syncIndicatorIdle'),
  }
  renderRemoteSyncHost()
}

function scheduleRemoteSyncReset(delay = 1400) {
  stopRemoteSyncReset()
  remoteSyncResetHandle = window.setTimeout(() => {
    remoteSyncResetHandle = null
    resetRemoteSyncIndicator()
  }, delay)
}

function getRemoteSyncLabel(detail = {}) {
  if (detail.kind === 'push') {
    return detail.phase === 'start'
      ? t('widgetRail.syncIndicatorPushing')
      : t('widgetRail.syncIndicatorPushed')
  }
  return detail.phase === 'start'
    ? t('widgetRail.syncIndicatorChecking')
    : t('widgetRail.syncIndicatorChecked')
}

function deriveRemoteSyncState(detail = null) {
  if (remoteSyncActivity.push) {
    return {
      active: true,
      kind: 'push',
      label: t('widgetRail.syncIndicatorPushing'),
    }
  }

  if (remoteSyncActivity.check) {
    return {
      active: true,
      kind: 'check',
      label: t('widgetRail.syncIndicatorChecking'),
    }
  }

  if (detail) {
    const kind = detail.kind === 'push' ? 'push' : 'check'
    const phase = detail.phase === 'start' ? 'start' : 'end'
    return {
      active: true,
      kind,
      label: getRemoteSyncLabel({kind, phase}),
    }
  }

  return {
    active: false,
    kind: '',
    label: t('widgetRail.syncIndicatorIdle'),
  }
}

function handleRemoteSyncActivity(event) {
  if (!(widgetSettings?.rail_enabled === true && widgetSettings?.remote_sync_indicator === true)) return
  const detail = event?.detail ?? {}
  const kind = detail.kind === 'push' ? 'push' : 'check'
  const phase = detail.phase === 'start' ? 'start' : 'end'

  if (phase === 'start') {
    remoteSyncActivity[kind] = true
    stopRemoteSyncReset()
    remoteSyncState = deriveRemoteSyncState({kind, phase})
    renderRemoteSyncHost()
    return
  }

  remoteSyncActivity[kind] = false
  remoteSyncState = deriveRemoteSyncState(remoteSyncActivity.push || remoteSyncActivity.check ? null : {kind, phase})
  renderRemoteSyncHost()

  if (!remoteSyncActivity.push && !remoteSyncActivity.check) {
    scheduleRemoteSyncReset(1400)
  }
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
  dateNode.innerHTML = renderClockDateMarkup(state.dateText || '')
  timeNode.textContent = state.timeText
}

function renderHost() {
  if (!(host instanceof HTMLElement)) return
  renderWeatherHost()
  renderRemoteSyncHost()
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
  if (document.visibilityState !== 'visible') {
    stopClockToolsLoop()
    stopClockToolsWatchLoop()
    stopClockTimerDraftLoop()
    return
  }
  if (isClockToolsModalOpen()) {
    clockToolsState = normalizeClockToolsState(clockToolsState)
    renderClockToolsLists()
    queueClockToolsLoop()
    queueClockTimerDraftLoop()
  }
  queueClockToolsWatchLoop()
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
  remoteSyncHost = document.querySelector('[data-widget-remote-sync-host]')
  clockHost = document.querySelector('[data-widget-clock-host]')
  abortRefresh()
  stopRefreshLoop()
  stopClockLoop()
  stopClockToolsLoop()
  stopClockToolsWatchLoop()
  stopClockTimerDraftLoop()
  stopRemoteSyncReset()
  renderHost()

  if (!visibilityBound) {
    document.addEventListener('visibilitychange', handleVisibilityChange)
    visibilityBound = true
  }

  if (!remoteSyncListenerBound) {
    document.addEventListener('speedtab:remote-sync-activity', handleRemoteSyncActivity)
    remoteSyncListenerBound = true
  }

  void loadClockToolsState().then((state) => {
    clockToolsState = state
    queueClockToolsWatchLoop()
  })
  void syncWeatherState()
  queueClockRender()
}

function refreshWidgetHosts() {
  host = document.querySelector('[data-widget-rail-host]')
  weatherHost = document.querySelector('[data-widget-weather-host]')
  remoteSyncHost = document.querySelector('[data-widget-remote-sync-host]')
  clockHost = document.querySelector('[data-widget-clock-host]')
}

function shouldResyncWeather(previousSettings, nextSettings, changedPath = '') {
  if (!changedPath || !changedPath.startsWith('weather.')) return false

  return (
    previousSettings?.weather?.enabled !== nextSettings?.weather?.enabled
    || previousSettings?.weather?.provider !== nextSettings?.weather?.provider
    || previousSettings?.weather?.units !== nextSettings?.weather?.units
    || previousSettings?.weather?.refresh_interval_minutes !== nextSettings?.weather?.refresh_interval_minutes
    || JSON.stringify(previousSettings?.weather?.location || null) !== JSON.stringify(nextSettings?.weather?.location || null)
  )
}

export function patchWidgetRailSettings(nextSettings, changedPath = '') {
  const previousSettings = widgetSettings
  widgetSettings = nextSettings
  refreshWidgetHosts()

  if (!(host instanceof HTMLElement)) return

  if (!changedPath) {
    renderHost()
    queueClockRender()
    return
  }

  if (changedPath.startsWith('clock.')) {
    stopClockLoop()
    renderClockHost()
    queueClockRender()
    return
  }

  if (changedPath.startsWith('weather.')) {
    if (shouldResyncWeather(previousSettings, nextSettings, changedPath)) {
      void syncWeatherState()
      return
    }
    renderWeatherHost()
    queueClockRender()
    return
  }

  if (changedPath === 'remote_sync_indicator') {
    if (nextSettings?.remote_sync_indicator !== true) {
      resetRemoteSyncIndicator()
    } else {
      renderRemoteSyncHost()
    }
    return
  }

  renderHost()
  queueClockRender()
}

export async function refreshWeatherWidgetNow() {
  await refreshWeather(true)
}

export async function openClockToolsModal(trigger = null) {
  clockToolsTrigger = trigger instanceof HTMLElement ? trigger : document.querySelector('[data-click="openClockTools"]')
  clockToolsState = await loadClockToolsState()
  clockTimerDraft = createCurrentClockDraft()
  clockTimerDraftFrozen = false
  clockTimerDraftSummaryVisible = false
  const state = {
    ...decorateClockToolsState(),
    clockDraft: clockTimerDraft,
  }

  openModal({
    title: t('clock.modalTitle'),
    content: renderClockToolsModal(state),
    headerActions: `<button type="button" class="st-btn" data-btn="ghost" data-click="openClockWidgetSettings">${escapeHtml(t('clock.configure'))}</button>`,
    panelClass: 'st-clock-tools-modal-shell',
    panelStyle: '--st-modal-max-width: 46rem;',
    onClose: () => {
      stopClockToolsLoop()
      stopClockTimerDraftLoop()
      const triggerEl = clockToolsTrigger
      clockToolsTrigger = null
      if (triggerEl instanceof HTMLElement && triggerEl.isConnected) {
        triggerEl.focus()
      }
    },
  })

  updateClockTimerCreateState()
  queueClockToolsLoop()
  queueClockTimerDraftLoop()
}

export async function startClockStopwatch() {
  const now = Date.now()
  if (clockToolsState.stopwatch.running) return
  clockToolsState = normalizeClockToolsState({
    ...clockToolsState,
    stopwatch: {
      ...clockToolsState.stopwatch,
      running: true,
      started_at: now,
    },
  }, now)
  await persistClockToolsState()
  renderClockToolsStopwatch()
}

export async function pauseClockStopwatch() {
  const now = Date.now()
  if (clockToolsState.stopwatch.running !== true) return
  clockToolsState = normalizeClockToolsState({
    ...clockToolsState,
    stopwatch: {
      running: false,
      started_at: null,
      elapsed_ms: getStopwatchElapsedMs(clockToolsState.stopwatch, now),
    },
  }, now)
  await persistClockToolsState()
  renderClockToolsStopwatch()
}

export async function resumeClockStopwatch() {
  await startClockStopwatch()
}

export async function resetClockStopwatch() {
  if (clockToolsState.stopwatch.running === true) return
  clockToolsState = normalizeClockToolsState({
    ...clockToolsState,
    stopwatch: {
      running: false,
      started_at: null,
      elapsed_ms: 0,
    },
  })
  await persistClockToolsState()
  renderClockToolsStopwatch()
}

export function syncClockTimerCreateState() {
  updateClockTimerCreateState()
}

export function resetClockTimerDraft() {
  clockTimerDraft = createCurrentClockDraft()
  clockTimerDraftFrozen = false
  clockTimerDraftSummaryVisible = false
  writeClockTimerInputs(clockTimerDraft)
  updateClockTimerCreateState()
  queueClockTimerDraftLoop()
}

export async function createClockTimer() {
  const draft = getTimerDraftValues()
  if (!draft || draft.durationMs <= 0) return
  const now = Date.now()
  clockToolsState = normalizeClockToolsState({
    ...clockToolsState,
    timers: [
      ...clockToolsState.timers,
      {
        id: crypto.randomUUID(),
        label: draft.label,
        duration_ms: draft.durationMs,
        state: 'running',
        created_at: now,
        started_at: now,
        end_at: now + draft.durationMs,
        remaining_ms: draft.durationMs,
      },
    ],
  }, now)
  await persistClockToolsState()
  renderClockToolsLists()
  const controls = getClockTimerInputs()
  if (controls?.labelInput instanceof HTMLInputElement) controls.labelInput.value = ''
  clockTimerDraft = createCurrentClockDraft()
  clockTimerDraftFrozen = false
  clockTimerDraftSummaryVisible = false
  writeClockTimerInputs(clockTimerDraft)
  updateClockTimerCreateState()
  queueClockTimerDraftLoop()
}

export async function createClockPresetTimer(target) {
  const minutes = Math.max(0, Number.parseInt(target?.dataset?.presetMinutes || '0', 10) || 0)
  if (!minutes) return
  const controls = getClockTimerInputs()
  if (controls?.labelInput instanceof HTMLInputElement && !controls.labelInput.value.trim()) {
    controls.labelInput.value = `${minutes}m`
  }
  clockTimerDraft = createClockDraftFromDuration(clockTimerDraft.baseTimestamp, minutes * 60_000)
  clockTimerDraftFrozen = true
  writeClockTimerInputs(clockTimerDraft)
  updateClockTimerCreateState()
  await createClockTimer()
}

export async function toggleClockTimer(target) {
  const timerId = target?.dataset?.timerId || ''
  if (!timerId) return
  const now = Date.now()
  clockToolsState = normalizeClockToolsState({
    ...clockToolsState,
    timers: clockToolsState.timers.map((timer) => {
      if (timer.id !== timerId) return timer
      if (timer.state === 'paused') {
        return {
          ...timer,
          state: 'running',
          started_at: now,
          end_at: now + Math.max(0, timer.remaining_ms ?? timer.duration_ms),
        }
      }
      if (timer.state === 'running') {
        return {
          ...timer,
          state: 'paused',
          started_at: null,
          end_at: null,
          remaining_ms: Math.max(0, (timer.end_at ?? now) - now),
        }
      }
      return timer
    }),
  }, now)
  await persistClockToolsState()
  renderClockToolsLists()
}

export async function deleteClockTimer(target) {
  const timerId = target?.dataset?.timerId || ''
  if (!timerId) return
  clockToolsState = normalizeClockToolsState({
    ...clockToolsState,
    timers: clockToolsState.timers.filter((timer) => timer.id !== timerId),
  })
  await persistClockToolsState()
  renderClockToolsLists()
}

export function openWeatherForecastModal() {
  openModal({
    title: widgetSettings?.weather?.display_label?.trim() || weatherData?.location_label || t('weather.title'),
    content: renderWeatherForecastModal(buildState()),
    headerActions: `<button type="button" class="st-btn" data-btn="ghost" data-click="openWeatherWidgetSettings">${escapeHtml(t('clock.configure'))}</button>`,
    panelClass: 'st-weather-forecast-modal-shell',
    panelStyle: '--st-modal-max-width: 44rem;',
  })
}
