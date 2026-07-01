import {escapeHtml} from '../../utils/html.js'
import {t} from '../../utils/i18n.js'

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

export function renderWidgetRailShell(settings = {}) {
  if (!settings?.rail_enabled || settings?.weather?.enabled !== true) return ''
  return `
    <section class="st-widget-rail" data-widget-rail data-swipe-ignore aria-label="${escapeHtml(t('widgetRail.aria'))}">
      <div class="st-widget-rail-inner">
        <div class="st-widget-rail-center" data-widget-rail-align="${escapeHtml(settings.rail_align || 'left')}">
          <div data-widget-rail-host></div>
        </div>
      </div>
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
  } = state

  if (!enabled) return ''

  if (!configured) {
    return `
      <section class="st-widget-card st-weather-widget" aria-label="${escapeHtml(t('weather.widgetAria'))}">
        <button type="button" class="st-weather-widget-empty" data-click="openWidgetSettingsLocation">
          <span class="st-weather-widget-empty-label">${escapeHtml(t('weather.title'))}</span>
          <span class="st-weather-widget-empty-copy">${escapeHtml(t('weather.emptyCopy'))}</span>
        </button>
      </section>
    `
  }

  return `
    <section
      class="st-widget-card st-weather-widget${loading || refreshing ? ' is-loading' : ''}"
      aria-label="${escapeHtml(t('weather.widgetAria'))}"
    >
      <div class="st-weather-widget-head">
        <div class="min-w-0">
          <h2 class="st-weather-widget-location truncate">${escapeHtml(weatherData?.location_label || t('weather.title'))}</h2>
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
	          <div class="st-weather-widget-primary">
	            <span class="st-weather-widget-icon" aria-hidden="true">${escapeHtml(conditionIcon)}</span>
	            <button
	              type="button"
	              class="st-weather-widget-temp"
	              data-click="openWeatherForecast"
	              aria-label="${escapeHtml(t('weather.openForecast'))}"
	              title="${escapeHtml(t('weather.openForecast'))}"
	            >${escapeHtml(String(Math.round(weatherData.current_temperature)))}°${escapeHtml(weatherData.temperature_unit_label)}</button>
	            <span class="st-weather-widget-condition">${escapeHtml(conditionLabel)}</span>
	          </div>

          <div class="st-weather-widget-secondary">
            ${weatherData.high_temperature != null && weatherData.low_temperature != null
              ? `<span>${escapeHtml(t('weather.highLow', {high: Math.round(weatherData.high_temperature), low: Math.round(weatherData.low_temperature)}))}</span>`
              : ''}
            ${lastUpdatedLabel ? `<span>${escapeHtml(t('weather.updatedAt', {time: lastUpdatedLabel}))}</span>` : ''}
            ${error ? `<span class="st-weather-widget-stale">${escapeHtml(t('weather.usingLastGoodResult'))}</span>` : ''}
          </div>
        </div>
      ` : `
        <div class="st-weather-widget-loading">
          ${escapeHtml(loading ? t('weather.loadingWeather') : (error || t('weather.unavailable')))}
        </div>
      `}

      ${statusLabel && statusLabel !== t('weather.title')
        ? `<span class="st-weather-widget-status">${escapeHtml(statusLabel)}</span>`
        : ''}
    </section>
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
