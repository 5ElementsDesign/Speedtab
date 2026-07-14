import {SPEEDTAB_SVG} from '../../components/icons.js'
import {escapeHtml} from '../../utils/html.js'
import {t} from '../../utils/i18n.js'
import {createCurrentClockDraft} from './utils.js'

const WEATHER_ICONS = {
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

export function renderClockDateMarkup(value = '') {
  const source = String(value ?? '')
  if (!source) return ''
  return escapeHtml(source)
    .replace(/\[br\]/gi, '<br>')
    .replace(/\[hr\]/gi, '<span class="st-clock-widget-date-rule" aria-hidden="true"></span>')
}

export function renderWidgetRailShell(settings = {}) {
  const hasWeather = settings?.weather?.enabled === true
  const hasClock = settings?.clock?.enabled === true
  const hasRemoteSyncIndicator = settings?.remote_sync_indicator === true
  if (!settings?.rail_enabled || (!hasWeather && !hasClock && !hasRemoteSyncIndicator)) return ''
  const railPosition = settings?.rail_position === 'bottom' ? 'bottom' : 'top'
  return `
    <section class="st-widget-rail" data-widget-rail data-widget-rail-position="${escapeHtml(railPosition)}" data-swipe-ignore aria-label="${escapeHtml(t('widgetRail.aria'))}">
      <div class="st-widget-rail-inner">
        <div class="st-widget-rail-center">
          <div data-widget-rail-host data-widget-rail-align="${escapeHtml(settings.rail_align || 'left')}">
            <div data-widget-weather-host></div>
            <div data-widget-remote-sync-host></div>
            <div data-widget-clock-host></div>
          </div>
        </div>
      </div>
    </section>
  `
}

export function renderRemoteSyncIndicator(state = {}) {
  const {
    enabled = false,
    active = false,
    kind = '',
    label = '',
  } = state

  if (!enabled) return ''
  const hidden = !active
  const displayLabel = active ? (label || t('widgetRail.syncIndicatorIdle')) : t('widgetRail.syncIndicatorIdle')

  return `
    <section
      class="st-widget-card st-remote-sync-indicator${active ? ' is-active' : ''}${kind ? ` is-${escapeHtml(kind)}` : ''}"
      data-remote-sync-indicator
      aria-hidden="${hidden ? 'true' : 'false'}"
      aria-label="${escapeHtml(displayLabel)}"
      title="${escapeHtml(displayLabel)}"
    >
      <span class="st-remote-sync-indicator-dot" aria-hidden="true"></span>
    </section>
  `
}

export function renderWeatherWidget(state = {}) {
  const {
    enabled = false,
    configured = false,
    loading = false,
    refreshing = false,
    error = '',
    weatherData = null,
    conditionLabel = '',
    conditionIcon = '☁',
    lastUpdatedLabel = '',
    statusLabel = '',
    compactMode = false,
    background = '',
    border = '',
    locationColor = '',
    temperatureColor = '',
    temperatureFontSize = null,
    mutedColor = '',
  } = state

  if (!enabled) return ''

  const weatherStyle = buildWeatherInlineStyle(state)
  const weatherStyleAttr = weatherStyle ? ` style="${escapeHtml(weatherStyle)}"` : ''

  const locationLabel = String(weatherData?.location_label || t('weather.title'))
  const [compactLine1Raw, ...compactRest] = locationLabel.split(',')
  const compactLine1 = compactLine1Raw?.trim() || locationLabel
  const compactLine2 = compactRest.join(',').trim()

  if (!configured) {
    return `
      <section class="st-widget-card st-weather-widget fade-in-down is-visible${compactMode ? ' is-compact' : ''}" aria-label="${escapeHtml(t('weather.widgetAria'))}"${weatherStyleAttr}>
        <button type="button" class="st-weather-widget-empty" data-click="openWidgetSettingsLocation">
          <span class="st-weather-widget-empty-label" data-weather-empty-label>${escapeHtml(t('weather.title'))}</span>
          <span class="st-weather-widget-empty-copy" data-weather-empty-copy>${escapeHtml(t('weather.emptyCopy'))}</span>
        </button>
      </section>
    `
  }

  return `
    <section
      class="st-widget-card st-weather-widget fade-in-down is-visible${loading || refreshing ? ' is-loading' : ''}${compactMode ? ' is-compact' : ''}"
      aria-label="${escapeHtml(t('weather.widgetAria'))}"
      ${weatherStyleAttr}
    >
      <div class="st-weather-widget-head">
        <div class="min-w-0">
          <h2 class="st-weather-widget-location truncate" data-weather-location>${escapeHtml(weatherData?.location_label || t('weather.title'))}</h2>
        </div>
        <button
          type="button"
          class="st-weather-widget-refresh st-btn"
          data-click="refreshWeatherWidget"
          ${loading || refreshing ? 'disabled' : ''}
          aria-label="${escapeHtml(t('weather.refreshNow'))}"
          title="${escapeHtml(t('weather.refreshNow'))}"
        >↻</button>
      </div>

      ${weatherData ? `
	        <div class="st-weather-widget-body">
	          <div class="st-weather-widget-primary${compactMode ? ' is-compact' : ''}">
	            <span class="st-weather-widget-icon" data-weather-icon aria-hidden="true">${escapeHtml(conditionIcon)}</span>
	            <button
	              type="button"
	              class="st-weather-widget-temp"
                data-weather-temp
	              data-click="openWeatherForecast"
	              aria-label="${escapeHtml(t('weather.openForecast'))}"
	              title="${escapeHtml(t('weather.openForecast'))}"
	            >${escapeHtml(String(Math.round(weatherData.current_temperature)))}°${escapeHtml(weatherData.temperature_unit_label)}</button>
              <span class="st-weather-widget-condition" data-weather-condition>${escapeHtml(conditionLabel)}</span>
              <span class="st-weather-widget-compact-copy">
                <span class="st-weather-widget-location st-weather-widget-location-compact" data-weather-compact-line1>${escapeHtml(compactLine1)}${compactLine2 ? ',' : ''}</span>
                <span class="st-weather-widget-location st-weather-widget-location-compact" data-weather-compact-line2>${escapeHtml(compactLine2)}</span>
              </span>
	          </div>

          <div class="st-weather-widget-secondary">
            ${weatherData.high_temperature != null && weatherData.low_temperature != null
              ? `<span data-weather-secondary-range>${escapeHtml(t('weather.highLow', {high: Math.round(weatherData.high_temperature), low: Math.round(weatherData.low_temperature)}))}</span>`
              : ''}
            ${lastUpdatedLabel ? `<span data-weather-secondary-updated>${escapeHtml(t('weather.updatedAt', {time: lastUpdatedLabel}))}</span>` : ''}
            ${error ? `<span class="st-weather-widget-stale" data-weather-secondary-stale>${escapeHtml(t('weather.usingLastGoodResult'))}</span>` : ''}
          </div>
        </div>
      ` : `
        <div class="st-weather-widget-loading" data-weather-loading>
          ${escapeHtml(loading ? t('weather.loadingWeather') : (error || t('weather.unavailable')))}
        </div>
      `}

      ${statusLabel && statusLabel !== t('weather.title')
        ? `<span class="st-weather-widget-status" data-weather-status>${escapeHtml(statusLabel)}</span>`
        : ''}
    </section>
  `
}

export function buildWeatherInlineStyle(state = {}) {
  const {
    background = '',
    border = '',
    locationColor = '',
    temperatureColor = '',
    temperatureFontSize = null,
    mutedColor = '',
  } = state

  return [
    background ? `--st-weather-widget-bg:${background}` : '',
    border ? `--st-weather-widget-border:${border}` : '',
    locationColor ? `--st-weather-widget-location-color:${locationColor}` : '',
    temperatureColor ? `--st-weather-widget-temp-color:${temperatureColor}` : '',
    temperatureFontSize ? `--st-weather-widget-temp-size:${temperatureFontSize}px` : '',
    mutedColor ? `--st-weather-widget-muted-color:${mutedColor}` : '',
  ].filter(Boolean).join(';')
}

function buildClockInlineStyle(state = {}) {
  const declarations = []
  if (state.background) declarations.push(`--st-clock-widget-bg:${state.background}`)
  if (state.border) declarations.push(`--st-clock-widget-border:${state.border}`)
  if (state.dateColor) declarations.push(`--st-clock-widget-date-color:${state.dateColor}`)
  if (state.timeColor) declarations.push(`--st-clock-widget-time-color:${state.timeColor}`)
  if (state.dateFontSize) declarations.push(`--st-clock-widget-date-size:${state.dateFontSize}px`)
  if (state.timeFontSize) declarations.push(`--st-clock-widget-time-size:${state.timeFontSize}px`)
  if (state.display === 'analog' && state.timeFontSize) {
    declarations.push(`--st-clock-widget-analog-size:${Math.max(56, Math.min(124, Number(state.timeFontSize) * 4.2))}px`)
  }
  return declarations.length ? ` style="${escapeHtml(declarations.join(';'))}"` : ''
}

function renderAnalogClockSvg(state = {}) {
  const hour = Number(state.hour) || 0
  const minute = Number(state.minute) || 0
  const second = Number(state.second) || 0
  const millisecond = Number(state.millisecond) || 0
  const showSeconds = state.showSeconds === true
  const smoothMotion = state.smoothMotion === true
  const hourAngle = ((hour % 12) + (minute / 60) + (second / 3600)) * 30
  const minuteAngle = (minute + (second / 60)) * 6
  const secondAngle = second * 6
  const secondOffset = second + (millisecond / 1000)
  const minuteOffset = (minute * 60) + secondOffset
  const hourOffset = ((hour % 12) * 3600) + minuteOffset
  const hourRotation = `rotate(${hourAngle} 50 50)`
  const minuteRotation = `rotate(${minuteAngle} 50 50)`
  const secondRotation = `rotate(${secondAngle} 50 50)`
  const markers = Array.from({length: 12}, (_value, index) => {
    const angle = (index * 30) * (Math.PI / 180)
    const outerX = 50 + Math.sin(angle) * 40
    const outerY = 50 - Math.cos(angle) * 40
    const innerX = 50 + Math.sin(angle) * 33
    const innerY = 50 - Math.cos(angle) * 33
    return `<line x1="${innerX.toFixed(2)}" y1="${innerY.toFixed(2)}" x2="${outerX.toFixed(2)}" y2="${outerY.toFixed(2)}" class="st-clock-widget-analog-marker" />`
  }).join('')

  return `
    <svg
      class="st-clock-widget-analog-svg${smoothMotion ? ' is-smooth' : ''}"
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
      style="
        --st-clock-hour-angle:${hourAngle}deg;
        --st-clock-minute-angle:${minuteAngle}deg;
        --st-clock-second-angle:${secondAngle}deg;
        --st-clock-hour-delay:-${hourOffset}s;
        --st-clock-minute-delay:-${minuteOffset}s;
        --st-clock-second-delay:-${secondOffset}s;
      "
    >
      <circle cx="50" cy="50" r="46" class="st-clock-widget-analog-ring" />
      ${markers}
      <line x1="50" y1="50" x2="50" y2="28" ${smoothMotion ? '' : `transform="${hourRotation}"`} class="st-clock-widget-analog-hand is-hour" />
      <line x1="50" y1="50" x2="50" y2="18" ${smoothMotion ? '' : `transform="${minuteRotation}"`} class="st-clock-widget-analog-hand is-minute" />
      ${showSeconds
        ? `<line x1="50" y1="54" x2="50" y2="14" ${smoothMotion ? '' : `transform="${secondRotation}"`} class="st-clock-widget-analog-hand is-second" />`
        : ''}
      <circle cx="50" cy="50" r="3.5" class="st-clock-widget-analog-center" />
    </svg>
  `
}

export function renderClockWidget(state = {}) {
  const {
    enabled = false,
    display = 'digital',
    align = 'left',
    twoRow = false,
    dateText = '',
    timeText = '',
  } = state

  if (!enabled) return ''
  const clockLabel = dateText && timeText ? `${dateText} ${timeText}`.trim() : (timeText || dateText || t('clock.widgetAria'))
  const isAnalog = display === 'analog'

  return `
    <button
      type="button"
      class="st-widget-card st-clock-widget fade-in-up is-visible${twoRow ? ' is-two-row' : ''}${isAnalog ? ' is-analog' : ' is-digital'}"
      data-widget-clock
      data-widget-align="${escapeHtml(align)}"
      data-clock-display="${escapeHtml(display)}"
      data-clock-smooth-motion="${state.smoothMotion === true ? 'true' : 'false'}"
      data-click="openClockTools"
      aria-label="${escapeHtml(t('clock.openTools'))}"
      title="${escapeHtml(t('clock.openTools'))}"
      ${buildClockInlineStyle(state)}
    >
      <div class="st-clock-widget-body">
        ${isAnalog
          ? `
            ${dateText ? `<div class="st-clock-widget-date st-clock-widget-date-analog">${renderClockDateMarkup(dateText)}</div>` : ''}
            <span class="st-clock-widget-analog" aria-hidden="true">${renderAnalogClockSvg(state)}</span>
          `
          : `
            <div class="st-clock-widget-date">${renderClockDateMarkup(dateText)}</div>
            <strong class="st-clock-widget-time">${escapeHtml(timeText)}</strong>
          `
        }
      </div>
    </button>
  `
}

function renderTimerRows(timers = [], kind = 'active') {
  const visibleTimers = timers.filter((timer) => (
    kind === 'expired' ? timer.state === 'expired' : timer.state !== 'expired'
  ))

  if (!visibleTimers.length) {
    return kind === 'expired'
      ? `<p class="st-clock-tools-empty">${escapeHtml(t('clock.noExpiredTimers'))}</p>`
      : `<p class="st-clock-tools-empty">${escapeHtml(t('clock.noTimersYet'))}</p>`
  }

  return `
    <div class="st-clock-tools-timer-list">
      ${visibleTimers.map((timer) => {
        const isExpired = timer.state === 'expired'
        const isPaused = timer.state === 'paused'
        const label = timer.label || `${t('clock.unnamedTimer')}, ${timer.displayDuration || timer.displayRemaining || '00:00:00'}`
        return `
          <article
            class="st-clock-tools-timer-row${isExpired ? ' is-expired' : ''}"
            data-clock-timer-row
            data-timer-id="${escapeHtml(timer.id)}"
            data-timer-state="${escapeHtml(timer.state)}"
            data-duration-ms="${escapeHtml(String(timer.duration_ms || 0))}"
            data-remaining-ms="${escapeHtml(String(timer.remaining_ms || 0))}"
          >
            <div class="st-clock-tools-timer-main">
              <div class="st-clock-tools-timer-copy">
                <strong class="st-clock-tools-timer-label" title="${escapeHtml(label)}">${escapeHtml(label)}</strong>
                <span class="st-clock-tools-timer-status">${escapeHtml(
                  isExpired
                    ? `${t('clock.expired')}${timer.displayExpiredAt ? ` · ${timer.displayExpiredAt}` : ''}`
                    : (isPaused ? t('clock.paused') : t('clock.running'))
                )}</span>
              </div>
              <strong class="st-clock-tools-timer-time" data-clock-timer-remaining>${escapeHtml(timer.displayRemaining || '00:00')}</strong>
            </div>
            <div class="st-clock-tools-timer-progress">
              <span data-clock-timer-progress style="width:${escapeHtml(String(timer.progressPercent || 0))}%;"></span>
            </div>
            <div class="st-clock-tools-timer-actions">
              ${isExpired
                ? ''
                : `<button type="button" class="st-btn" data-btn="ghost" data-click="toggleClockTimer" data-timer-id="${escapeHtml(timer.id)}">${escapeHtml(isPaused ? t('clock.resume') : t('clock.pause'))}</button>`
              }
              <button type="button" class="st-btn" data-btn="danger" data-click="deleteClockTimer" data-timer-id="${escapeHtml(timer.id)}">${escapeHtml(t('common.delete'))}</button>
            </div>
          </article>
        `
      }).join('')}
    </div>
  `
}

export function renderClockToolsModal(state = {}) {
  const stopwatch = state?.stopwatch ?? {}
  const timers = Array.isArray(state?.timers) ? state.timers : []
  const draft = state?.clockDraft ?? createCurrentClockDraft()

  return `
    <div class="st-clock-tools-modal" data-clock-tools-modal>
      <section class="st-clock-tools-stopwatch">
        <div class="st-clock-tools-stopwatch-head">
          <div class="st-clock-tools-stopwatch-meta">
            <span class="st-clock-tools-kicker">${escapeHtml(t('clock.stopwatch'))}</span>
            <div class="st-clock-tools-stopwatch-actions">
              ${stopwatch.running
                ? `<button type="button" class="st-btn" data-btn="warning" data-click="pauseClockStopwatch">${escapeHtml(t('clock.pause'))}</button>`
                : `<button type="button" class="st-btn" data-btn="primary" data-click="${stopwatch.hasElapsed ? 'resumeClockStopwatch' : 'startClockStopwatch'}">${escapeHtml(stopwatch.hasElapsed ? t('clock.resume') : t('clock.start'))}</button>`
              }
              <button type="button" class="st-btn" data-btn="ghost" data-stop-watch-reset data-click="resetClockStopwatch" title="${escapeHtml(t('clock.reset'))}" aria-label="${escapeHtml(t('clock.reset'))}" ${stopwatch.running ? 'disabled' : ''}>${SPEEDTAB_SVG.x}</button>
            </div>
          </div>
          <strong class="st-clock-tools-stopwatch-time" data-clock-stopwatch-time>${escapeHtml(stopwatch.displayElapsed || '00:00.0')}</strong>
        </div>
      </section>

      <hr>

      <section class="st-clock-tools-create">
        <div class="st-clock-tools-section-head">
          <h3 class="st-clock-tools-section-title">${escapeHtml(t('clock.timers'))}</h3>
        </div>

        <div class="st-clock-tools-create-row" data-clock-timer-create>
          <label data-customizer-field data-customizer-field-layout="stack">
            <span data-customizer-field-label>${escapeHtml(t('clock.labelOptional'))}</span>
            <input type="text" name="clock_timer_label" maxlength="80" placeholder="${escapeHtml(t('clock.timerLabelPlaceholder'))}" data-input-immediate="updateClockTimerCreateState">
          </label>
          <div class="st-clock-tools-duration-grid">
            <div class="st-clock-tools-duration-inputs">
              <label class="st-clock-tools-duration-field" data-customizer-field data-customizer-field-layout="stack">
                <span data-customizer-field-label>${escapeHtml(t('clock.hoursShort'))}</span>
                <input type="number" name="clock_timer_hours" min="0" step="1" value="${escapeHtml(String(draft.hours ?? 0))}" inputmode="numeric" data-input-immediate="updateClockTimerCreateState">
              </label>
              <label class="st-clock-tools-duration-field" data-customizer-field data-customizer-field-layout="stack">
                <span data-customizer-field-label>${escapeHtml(t('clock.minutesShort'))}</span>
                <input type="number" name="clock_timer_minutes" min="0" step="1" value="${escapeHtml(String(draft.minutes ?? 0))}" inputmode="numeric" data-input-immediate="updateClockTimerCreateState">
              </label>
              <label class="st-clock-tools-duration-field" data-customizer-field data-customizer-field-layout="stack">
                <span data-customizer-field-label>${escapeHtml(t('clock.secondsShort'))}</span>
                <input type="number" name="clock_timer_seconds" min="0" step="1" value="${escapeHtml(String(draft.seconds ?? 0))}" inputmode="numeric" data-input-immediate="updateClockTimerCreateState">
              </label>
              <div class="st-clock-tools-duration-summary" data-clock-timer-summary hidden>${escapeHtml(draft.summaryLabel || '0h 10m 0s')}</div>
            </div>
          </div>
          <div class="st-clock-tools-create-actions">
            <div class="st-clock-tools-create-primary">
              <button type="button" class="st-btn" data-btn="primary" data-click="createClockTimer" data-clock-timer-create-btn>${escapeHtml(t('clock.createTimer'))}</button>
              <button type="button" class="st-btn" data-btn="ghost" data-clock-timer-reset data-click="resetClockTimerDraft" title="${escapeHtml(t('clock.reset'))}" aria-label="${escapeHtml(t('clock.reset'))}">${SPEEDTAB_SVG.x}</button>
            </div>
            <div class="st-clock-tools-presets">
              <button type="button" class="st-btn" data-btn="ghost" data-click="createClockPresetTimer" data-preset-minutes="5">5m</button>
              <button type="button" class="st-btn" data-btn="ghost" data-click="createClockPresetTimer" data-preset-minutes="10">10m</button>
              <button type="button" class="st-btn" data-btn="ghost" data-click="createClockPresetTimer" data-preset-minutes="15">15m</button>
            </div>
          </div>
        </div>
      </section>

      <hr>

      <section class="st-clock-tools-active">
        <div class="st-clock-tools-section-head">
          <h3 class="st-clock-tools-section-title">${escapeHtml(t('clock.activeTimers'))}</h3>
        </div>
        <div data-clock-timer-active-list>
          ${renderTimerRows(timers, 'active')}
        </div>
      </section>

      <section class="st-clock-tools-expired">
        <div class="st-clock-tools-section-head">
          <h3 class="st-clock-tools-section-title">${escapeHtml(t('clock.expiredTimers'))}</h3>
        </div>
        <div data-clock-timer-expired-list>
          ${renderTimerRows(timers, 'expired')}
        </div>
      </section>
    </div>
  `
}

export function renderWeatherForecastModal(state = {}) {
  const {
    weatherData = null,
    conditionLabel = '',
    conditionIcon = '☁',
    lastUpdatedLabel = '',
    forecastRows = [],
    error = '',
    loading = false,
    refreshing = false,
  } = state

  if (!weatherData) {
    return `
      <div class="st-weather-forecast-modal">
        <p class="m-0">${escapeHtml(loading || refreshing ? t('weather.loadingWeather') : (error || t('weather.unavailable')))}</p>
      </div>
    `
  }

  return `
    <div class="st-weather-forecast-modal">
      <div class="st-weather-forecast-current">
        <div class="st-weather-forecast-current-primary">
          <span class="st-weather-forecast-current-icon" aria-hidden="true">${escapeHtml(conditionIcon)}</span>
          <strong class="st-weather-forecast-current-temp">${escapeHtml(String(Math.round(weatherData.current_temperature)))}°${escapeHtml(weatherData.temperature_unit_label)}</strong>
          <span class="st-weather-forecast-current-condition">${escapeHtml(conditionLabel)}</span>
        </div>
        <div class="st-weather-forecast-current-meta">
          ${weatherData.high_temperature != null && weatherData.low_temperature != null
            ? `<span>${escapeHtml(t('weather.highLow', {high: Math.round(weatherData.high_temperature), low: Math.round(weatherData.low_temperature)}))}</span>`
            : ''}
          ${lastUpdatedLabel ? `<span>${escapeHtml(t('weather.updatedAt', {time: lastUpdatedLabel}))}</span>` : ''}
          ${error ? `<span class="st-weather-widget-stale">${escapeHtml(t('weather.usingLastGoodResult'))}</span>` : ''}
        </div>
      </div>

      ${forecastRows.length ? `
        <div class="st-weather-forecast-list">
          <div class="st-weather-forecast-head">
            <h3 class="st-weather-forecast-title">${escapeHtml(t('weather.forecastTitle'))}</h3>
            <div class="st-weather-forecast-legend">
              <span>${escapeHtml(t('weather.highLabel'))}</span>
              <span>${escapeHtml(t('weather.lowLabel'))}</span>
            </div>
          </div>
          ${forecastRows.map((row) => `
            <div class="st-weather-forecast-row">
              <span class="st-weather-forecast-day">${escapeHtml(row.dayLabel)}</span>
              <span class="st-weather-forecast-icon" aria-hidden="true">${escapeHtml(row.icon)}</span>
              <span class="st-weather-forecast-condition">${escapeHtml(row.conditionLabel)}</span>
              <span class="st-weather-forecast-range">${escapeHtml(row.rangeLabel)}</span>
            </div>
          `).join('')}
        </div>
      ` : `
        <p class="m-0">${escapeHtml(t('weather.noForecast'))}</p>
      `}
    </div>
  `
}

export function getWeatherIcon(name = 'cloud') {
  return WEATHER_ICONS[name] ?? WEATHER_ICONS.cloud
}
