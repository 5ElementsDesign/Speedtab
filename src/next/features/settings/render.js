import {DEFAULT_CLOCK_DATE_FORMAT, DEFAULT_WIDGET_SETTINGS} from '../../../types/widgets.ts'
import {customizerSection, section as renderSection} from '../../ui/primitives.js'
import {escapeHtml} from '../../utils/html.js'
import {t} from '../../utils/i18n.js'

function getExtensionVersion() {
  try {
    return globalThis.chrome?.runtime?.getManifest?.().version ?? ''
  } catch {
    return ''
  }
}

export function renderSettingsFooter() {
  const version = getExtensionVersion()
  const feedbackHref = `mailto:5.smart.mailbot@gmail.com?subject=Speedtab%20Feedback%20v${encodeURIComponent(version)}&body=Hi!%20I%20have%20some%20feedback%20about%20Speedtab:%0A%0A`
  return `
    <div data-settings-footer>
      <span>v${escapeHtml(version)}</span>
      <button type="button" data-click="openFeedbackModal" class="feedback-link">Feedback &amp; Bugs</button>
    </div>
  `
}

export function renderFeedbackModal() {
  const version = getExtensionVersion()
  const subject = encodeURIComponent(`Speedtab Feedback v${version}`)
  const body = encodeURIComponent('Hi! I have some feedback about Speedtab:\n\n')
  return `
    <p>${escapeHtml(t('settings.feedbackVersion', {version}))}</p>
    <hr>
    <p>${escapeHtml(t('settings.feedbackPrompt'))}</p>
    <p>${escapeHtml(t('settings.feedbackFeaturePrompt'))}</p>
    <hr>
    <ul class="m-0">
      <li><a href="mailto:5.smart.mailbot@gmail.com?subject=${subject}&amp;body=${body}" class="feedback-link">${escapeHtml(t('settings.feedbackEmail'))}</a></li>
      <li><a href="https://github.com/5ElementsDesign/Speedtab/issues" target="_blank" rel="noopener noreferrer" class="feedback-link">${escapeHtml(t('settings.feedbackGithub'))}</a></li>
    </ul>
  `
}

function section(title, children) {
  return renderSection({title, children})
}

function toColorInputValue(value) {
  if (!value) return ''
  if (/^#[0-9a-fA-F]{6,8}$/.test(value)) return value
  if (/^#[0-9a-fA-F]{3}$/.test(value)) {
    const [, r, g, b] = value
    return `#${r}${r}${g}${g}${b}${b}`
  }
  return ''
}

function renderSettingsColorInput(name, value, widgetPath) {
  return `
    <div data-color-item>
      <input
        type="text"
        name="${escapeHtml(name)}"
        value="${escapeHtml(toColorInputValue(value))}"
        data-coloris
        data-input-immediate="changeWidgetSetting"
        data-change="changeWidgetSetting"
        data-widget-path="${escapeHtml(widgetPath)}"
        data-value-type="string"
      >
      <button
        type="button"
        data-click="clearWidgetColor"
        data-widget-path="${escapeHtml(widgetPath)}"
        data-customizer-clear
        title="${escapeHtml(t('customizer.reset'))}"
        aria-label="${escapeHtml(t('customizer.reset'))}"
      >&times;</button>
    </div>
  `
}

function renderWidgetAdvancedOptions(children) {
  return `
    <details data-settings-advanced-options>
      <summary class="st-btn text-left">${escapeHtml(t('customizer.moreOptions'))}</summary>
      <div data-settings-advanced-options-panel>
        ${children}
      </div>
    </details>
  `
}

function formatWeatherLocationLabel(location = null) {
  if (!location) return ''
  return location.country ? `${location.name}, ${location.country}` : location.name
}

export function renderWeatherLocationSearchState(location = null, weatherState = {}) {
  const results = weatherState.results ?? []
  const status = weatherState.status ?? 'idle'
  const query = weatherState.query ?? ''
  const error = weatherState.error ?? ''
  const displayLabel = weatherState.displayLabel ?? ''

  return `
    <div data-weather-location-search-state>
      <input
        id="weather_location_query"
        name="weather_location_query"
        type="text"
        value="${escapeHtml(query)}"
        placeholder="${escapeHtml(t('settings.weatherLocationPlaceholder'))}"
        data-input="searchWeatherLocations"
        data-settings-wide-input
      />
      <span data-settings-hint>${escapeHtml(t('settings.weatherLocationHelp'))}</span>
      ${location ? `
        <div data-configuration-ww-current-location>
          <div data-settings-current-location>
            <strong>${escapeHtml(t('settings.currentLocation'))}</strong>
            <input
              id="weather_current_location"
              type="text"
              name="weather_current_location"
              value="${escapeHtml(displayLabel || formatWeatherLocationLabel(location))}"
              spellcheck="false"
              autocomplete="off"
              data-settings-current-location-input
              data-change="changeWidgetSetting"
              data-widget-path="weather.display_label"
              data-value-type="string"
              aria-label="${escapeHtml(t('settings.currentLocation'))}"
            />
          </div>
          <button type="button" class="st-btn" data-click="clearWeatherLocation">${escapeHtml(t('settings.clear'))}</button>
        </div>
      ` : ''}
      ${status === 'loading' ? `<div data-settings-hint>${escapeHtml(t('settings.searchingLocations'))}</div>` : ''}
      ${status === 'error' ? `<div data-settings-hint>${escapeHtml(error || t('settings.locationSearchFailed'))}</div>` : ''}
      ${status === 'empty' ? `<div data-settings-hint>${escapeHtml(t('settings.noLocationMatches'))}</div>` : ''}
      ${results.length ? `
        <div data-settings-search-results>
          ${results.map((result) => `
            <button
              type="button"
              class="st-btn"
              data-click="selectWeatherLocation"
              data-location-name="${escapeHtml(result.name)}"
              data-location-country="${escapeHtml(result.country ?? '')}"
              data-location-latitude="${escapeHtml(String(result.latitude))}"
              data-location-longitude="${escapeHtml(String(result.longitude))}"
              data-location-timezone="${escapeHtml(result.timezone ?? '')}"
            >
              ${escapeHtml(result.country ? `${result.name}, ${result.country}` : result.name)}
            </button>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `
}

export function renderBgAssetThumbs(assets) {
  if (!assets.length) return ''
  return assets.map((asset) => {
    const objUrl = asset._objectUrl ?? ''
    return `
      <div data-bg-asset-card>
        <button
          type="button"
          data-click="loadBgAsset"
          data-asset-id="${escapeHtml(String(asset.id))}"
          data-bg-asset-thumb
          style="--st-bg-thumb:url('${escapeHtml(objUrl)}');"
        ></button>
        <button
          type="button"
          data-click="deleteBgAsset"
          data-asset-id="${escapeHtml(String(asset.id))}"
          aria-label="${escapeHtml(t('common.delete'))}"
          data-bg-remove-btn
        ><i data-icon="x" aria-hidden="true"></i></button>
      </div>
    `
  }).join('')
}

function renderRailSettingsSection(widgetSettings = {}) {
  const railEnabled = widgetSettings?.rail_enabled === true
  const railPosition = widgetSettings?.rail_position === 'top' || widgetSettings?.rail_position === 'bottom'
    ? widgetSettings.rail_position
    : DEFAULT_WIDGET_SETTINGS.rail_position
  const railAlignOptions = new Set(['left', 'center', 'right', 'space-between', 'space-around'])
  const railAlign = railAlignOptions.has(widgetSettings?.rail_align)
    ? widgetSettings.rail_align
    : DEFAULT_WIDGET_SETTINGS.rail_align
  const railIgnoreMaxWidth = widgetSettings?.rail_ignore_max_width === true
  return customizerSection({title: t('settings.rail'), children: `
    <label data-customizer-field data-customizer-field-type="boolean" data-customizer-label-clickable>
      <span data-customizer-field-label>${t('settings.enableRail')}</span>
      <input
        type="checkbox"
        name="widget_rail_enabled"
        data-change="changeWidgetSetting"
        data-widget-path="rail_enabled"
        data-value-type="boolean"
        ${railEnabled ? 'checked' : ''}
      />
    </label>

    ${railEnabled ? `
      <div data-customizer-divider aria-hidden="true"></div>

      <div data-customizer-field>
        <span data-customizer-field-label>${t('settings.railPosition')}</span>
        <select
          id="widget_rail_position"
          name="widget_rail_position"
          data-change="changeWidgetSetting"
          data-widget-path="rail_position"
        >
          <option value="top"${railPosition === 'top' ? ' selected' : ''}>${escapeHtml(t('settings.top'))}</option>
          <option value="bottom"${railPosition === 'bottom' ? ' selected' : ''}>${escapeHtml(t('settings.bottom'))}</option>
        </select>
      </div>

      <div data-customizer-field>
        <span data-customizer-field-label>${t('settings.railAlignment')}</span>
        <select
          id="widget_rail_align"
          name="widget_rail_align"
          data-change="changeWidgetSetting"
          data-widget-path="rail_align"
        >
          <option value="left"${railAlign === 'left' ? ' selected' : ''}>${escapeHtml(t('settings.left'))}</option>
          <option value="center"${railAlign === 'center' ? ' selected' : ''}>${escapeHtml(t('settings.center'))}</option>
          <option value="right"${railAlign === 'right' ? ' selected' : ''}>${escapeHtml(t('settings.right'))}</option>
          <option value="space-between"${railAlign === 'space-between' ? ' selected' : ''}>${escapeHtml(t('settings.spaceBetween'))}</option>
          <option value="space-around"${railAlign === 'space-around' ? ' selected' : ''}>${escapeHtml(t('settings.spaceAround'))}</option>
        </select>
      </div>

      <label data-customizer-field data-customizer-field-type="boolean" data-customizer-label-clickable>
        <span data-customizer-field-label>${t('settings.railIgnoreMaxWidth')}</span>
        <input
          type="checkbox"
          name="widget_rail_ignore_max_width"
          data-change="changeWidgetSetting"
          data-widget-path="rail_ignore_max_width"
          data-value-type="boolean"
          ${railIgnoreMaxWidth ? 'checked' : ''}
        />
      </label>
    ` : ''}
  `})
}

function renderWeatherSettingsSection(widgetSettings = {}, weatherState = {}) {
  const weather = widgetSettings?.weather ?? DEFAULT_WIDGET_SETTINGS.weather
  const weatherEnabled = weather.enabled === true
  const location = weather.location ?? null

  return `
    <div data-customizer-section data-config-weather-widget>
      <label data-customizer-field data-customizer-field-type="boolean" data-customizer-label-clickable>
        <span data-customizer-field-label>${t('settings.weatherWidget')}</span>
        <input
          type="checkbox"
          name="weather_enabled"
          data-change="changeWidgetSetting"
          data-widget-path="weather.enabled"
          data-value-type="boolean"
          ${weatherEnabled ? 'checked' : ''}
        />
      </label>

      ${weatherEnabled ? `
        <div data-customizer-field data-customizer-field-layout="stack" data-customizer-gap="sm">
          <span data-customizer-field-label>${escapeHtml(t('settings.weatherLocation'))}</span>
          ${renderWeatherLocationSearchState(location, {...weatherState, displayLabel: weather.display_label})}
        </div>
        ${renderWidgetAdvancedOptions(`
          <label data-customizer-field data-customizer-field-type="boolean" data-customizer-label-clickable>
            <span data-customizer-field-label>${t('settings.compactMode')}</span>
            <input
              type="checkbox"
              name="weather_compact_mode"
              data-change="changeWidgetSetting"
              data-widget-path="weather.compact_mode"
              data-value-type="boolean"
              ${weather.compact_mode === true ? 'checked' : ''}
            />
          </label>

          <div data-customizer-field>
            <span data-customizer-field-label>${t('settings.units')}</span>
            <select
              id="weather_units"
              name="weather_units"
              data-change="changeWidgetSetting"
              data-widget-path="weather.units"
            >
              <option value="metric"${weather.units === 'metric' ? ' selected' : ''}>${escapeHtml(t('settings.metric'))}</option>
              <option value="imperial"${weather.units === 'imperial' ? ' selected' : ''}>${escapeHtml(t('settings.imperial'))}</option>
            </select>
          </div>

          <div data-customizer-field>
            <span data-customizer-field-label>${t('settings.refreshInterval')}</span>
            <select
              id="weather_refresh_interval"
              name="weather_refresh_interval"
              data-change="changeWidgetSetting"
              data-widget-path="weather.refresh_interval_minutes"
              data-value-type="number"
            >
              <option value="10"${Number(weather.refresh_interval_minutes) === 10 ? ' selected' : ''}>${escapeHtml(t('settings.refreshOptions.m10'))}</option>
              <option value="15"${Number(weather.refresh_interval_minutes) === 15 ? ' selected' : ''}>${escapeHtml(t('settings.refreshOptions.m15'))}</option>
              <option value="30"${Number(weather.refresh_interval_minutes) === 30 ? ' selected' : ''}>${escapeHtml(t('settings.refreshOptions.m30'))}</option>
              <option value="60"${Number(weather.refresh_interval_minutes) === 60 ? ' selected' : ''}>${escapeHtml(t('settings.refreshOptions.h1'))}</option>
              <option value="120"${Number(weather.refresh_interval_minutes) === 120 ? ' selected' : ''}>${escapeHtml(t('settings.refreshOptions.h2'))}</option>
              <option value="360"${Number(weather.refresh_interval_minutes) === 360 ? ' selected' : ''}>${escapeHtml(t('settings.refreshOptions.h6'))}</option>
            </select>
          </div>

          <div data-customizer-field data-customizer-field-type="color">
            <span data-customizer-field-label>${escapeHtml(t('settings.widgetBackground'))}</span>
            <div data-color-pair-row>
              ${renderSettingsColorInput('weather_background', weather.background, 'weather.background')}
            </div>
          </div>

          <div data-customizer-field data-customizer-field-type="color">
            <span data-customizer-field-label>${escapeHtml(t('settings.widgetShadow'))}</span>
            <div data-color-pair-row>
              ${renderSettingsColorInput('weather_shadow', weather.shadow, 'weather.shadow')}
            </div>
          </div>

          <div data-customizer-field data-customizer-field-type="color">
            <span data-customizer-field-label>${escapeHtml(t('settings.locationColor'))}</span>
            <div data-color-pair-row>
              ${renderSettingsColorInput('weather_location_color', weather.location_color, 'weather.location_color')}
            </div>
          </div>

          <div data-customizer-field data-customizer-field-type="color">
            <span data-customizer-field-label>${escapeHtml(t('settings.temperatureColor'))}</span>
            <div data-color-pair-row>
              ${renderSettingsColorInput('weather_temperature_color', weather.temperature_color, 'weather.temperature_color')}
            </div>
          </div>

          <div data-customizer-field data-customizer-field-type="color">
            <span data-customizer-field-label>${escapeHtml(t('settings.mutedColor'))}</span>
            <div data-color-pair-row>
              ${renderSettingsColorInput('weather_muted_color', weather.muted_color, 'weather.muted_color')}
            </div>
          </div>

          <div data-customizer-field>
            <span data-customizer-field-label>${escapeHtml(t('settings.temperatureFontSize'))}</span>
            <input
              id="weather_temperature_font_size"
              name="weather_temperature_font_size"
              type="number"
              min="8"
              max="96"
              value="${escapeHtml(String(weather.temperature_font_size ?? ''))}"
              data-change="changeWidgetSetting"
              data-widget-path="weather.temperature_font_size"
              data-value-type="number"
            />
          </div>
        `)}
      ` : ''}
    </div>
  `
}

function renderClockSettingsSection(widgetSettings = {}) {
  const clock = widgetSettings?.clock ?? DEFAULT_WIDGET_SETTINGS.clock
  const clockEnabled = clock.enabled === true
  const patternTokens = ['{dayShort}', '{dayName}', '{day}', '{monthShort}', '{monthName}', '{month}', '{yearShort}', '{year}', '{hour}', '{minute}', '{second}', '[br]', '[hr]']

  return `
    <div data-customizer-divider aria-hidden="true"></div>
    <div data-customizer-section data-config-clock-widget>
      <label data-customizer-field data-customizer-field-type="boolean" data-customizer-label-clickable>
        <span data-customizer-field-label>${t('settings.clockWidget')}</span>
        <input
          type="checkbox"
          name="clock_enabled"
          data-change="changeWidgetSetting"
          data-widget-path="clock.enabled"
          data-value-type="boolean"
          ${clockEnabled ? 'checked' : ''}
        />
      </label>

      ${clockEnabled ? `
        <div data-customizer-field>
          <span data-customizer-field-label>${t('settings.clockDisplay')}</span>
          <select
            id="clock_display"
            name="clock_display"
            data-change="changeWidgetSetting"
            data-widget-path="clock.display"
          >
            <option value="digital"${clock.display === 'analog' ? '' : ' selected'}>${escapeHtml(t('settings.digital'))}</option>
            <option value="analog"${clock.display === 'analog' ? ' selected' : ''}>${escapeHtml(t('settings.analog'))}</option>
          </select>
        </div>

        <label data-customizer-field data-customizer-field-type="boolean" data-customizer-label-clickable>
          <span data-customizer-field-label>${t('settings.smoothMotion')}</span>
          <input
            type="checkbox"
            name="clock_smooth_motion"
            data-change="changeWidgetSetting"
            data-widget-path="clock.smooth_motion"
            data-value-type="boolean"
            ${clock.smooth_motion !== false ? 'checked' : ''}
          />
        </label>

        <label data-customizer-field data-customizer-field-type="boolean" data-customizer-label-clickable>
          <span data-customizer-field-label>${t('settings.twoRowView')}</span>
          <input
            type="checkbox"
            name="clock_two_row"
            data-change="changeWidgetSetting"
            data-widget-path="clock.two_row"
            data-value-type="boolean"
            ${clock.two_row === true ? 'checked' : ''}
          />
        </label>
        ${renderWidgetAdvancedOptions(`
          <div data-customizer-field data-customizer-field-layout="stack" data-customizer-gap="sm">
            <button type="button" class="st-btn text-left" data-click="toggleClockPatternList">${escapeHtml(t('settings.dateFormat'))}</button>
            <textarea
              id="clock_date_format"
              name="clock_date_format"
              rows="2"
              class="min-h-0"
              data-change="changeWidgetSetting"
              data-widget-path="clock.date_format"
              data-value-type="string"
              data-settings-wide-input
            >${escapeHtml(clock.date_format ?? '')}</textarea>
            <span data-settings-hint>${escapeHtml(t('settings.clockDateFormatHelp'))}</span>
            <div data-settings-pattern-list hidden>
              ${patternTokens.map((token) => {
                const target = ['{hour}', '{minute}', '{second}'].includes(token) ? 'time' : 'date'
                return `<button type="button" class="st-btn" data-btn="ghost" data-click="insertClockPattern" data-insert-pattern="${escapeHtml(token)}" data-insert-target="${target}" title="${escapeHtml(token)}">${escapeHtml(token)}</button>`
              }).join('')}
              <button
                type="button"
                class="st-btn"
                data-click="restoreClockPattern"
                data-restore-pattern="${escapeHtml(DEFAULT_CLOCK_DATE_FORMAT)}"
                ${clock.date_format === DEFAULT_CLOCK_DATE_FORMAT ? 'disabled' : ''}
              >${escapeHtml(t('common.restore'))}</button>
            </div>
          </div>

          <div data-customizer-field data-customizer-field-layout="stack" data-customizer-gap="sm">
            <span data-customizer-field-label>${escapeHtml(t('settings.timeFormat'))}</span>
            <input
              id="clock_time_format"
              name="clock_time_format"
              type="text"
              value="${escapeHtml(clock.time_format ?? '')}"
              data-change="changeWidgetSetting"
              data-widget-path="clock.time_format"
              data-value-type="string"
              data-settings-wide-input
            />
            <span data-settings-hint>${escapeHtml(t('settings.clockTimeFormatHelp'))}</span>
          </div>

          <div data-customizer-field data-customizer-field-type="color">
            <span data-customizer-field-label>${escapeHtml(t('settings.widgetBackground'))}</span>
            <div data-color-pair-row>
              ${renderSettingsColorInput('clock_background', clock.background, 'clock.background')}
            </div>
          </div>

          <div data-customizer-field data-customizer-field-type="color">
            <span data-customizer-field-label>${escapeHtml(t('settings.widgetShadow'))}</span>
            <div data-color-pair-row>
              ${renderSettingsColorInput('clock_shadow', clock.shadow, 'clock.shadow')}
            </div>
          </div>

          <div data-customizer-field data-customizer-field-type="color">
            <span data-customizer-field-label>${escapeHtml(t('settings.dialColor'))}</span>
            <div data-color-pair-row>
              ${renderSettingsColorInput('clock_dial_color', clock.dial_color, 'clock.dial_color')}
            </div>
          </div>

          <div data-customizer-field data-customizer-field-type="color">
            <span data-customizer-field-label>${escapeHtml(t('settings.dateColor'))}</span>
            <div data-color-pair-row>
              ${renderSettingsColorInput('clock_date_color', clock.date_color, 'clock.date_color')}
            </div>
          </div>

          <div data-customizer-field data-customizer-field-type="color">
            <span data-customizer-field-label>${escapeHtml(t('settings.timeColor'))}</span>
            <div data-color-pair-row>
              ${renderSettingsColorInput('clock_time_color', clock.time_color, 'clock.time_color')}
            </div>
          </div>

          <div data-customizer-field>
            <span data-customizer-field-label>${escapeHtml(t('settings.dateFontSize'))}</span>
            <input
              id="clock_date_font_size"
              name="clock_date_font_size"
              type="number"
              min="8"
              max="96"
              value="${escapeHtml(String(clock.date_font_size ?? ''))}"
              data-change="changeWidgetSetting"
              data-widget-path="clock.date_font_size"
              data-value-type="number"
            />
          </div>

          <div data-customizer-field>
            <span data-customizer-field-label>${escapeHtml(t('settings.timeFontSize'))}</span>
            <input
              id="clock_time_font_size"
              name="clock_time_font_size"
              type="number"
              min="8"
              max="96"
              value="${escapeHtml(String(clock.time_font_size ?? ''))}"
              data-change="changeWidgetSetting"
              data-widget-path="clock.time_font_size"
              data-value-type="number"
            />
          </div>

          <div data-customizer-divider aria-hidden="true"></div>
          <div data-customizer-field data-customizer-field-layout="end">
            <button type="button" class="st-btn" data-btn="danger" data-click="resetClockWidgetSettings">${escapeHtml(t('customizer.reset'))}</button>
          </div>
        `)}
      ` : ''}
    </div>
  `
}

function renderWidgetEntrySection(widgetSettings = {}) {
  const railEnabled = widgetSettings?.rail_enabled === true
  return section(t('settings.widgets'), `
    <label data-customizer-field data-customizer-field-type="boolean" data-customizer-label-clickable>
      <span data-customizer-field-label>${t('settings.enableRail')}</span>
      <input
        type="checkbox"
        name="widget_rail_enabled"
        data-change="changeWidgetSetting"
        data-widget-path="rail_enabled"
        data-value-type="boolean"
        ${railEnabled ? 'checked' : ''}
      />
    </label>

    ${railEnabled ? `
      <div class="mt-1" data-customizer-field>
        <button type="button" class="st-btn w-100" data-click="openWidgetSettings" title="${escapeHtml(t('settings.widgetConfiguration'))}">${escapeHtml(t('settings.configureWidgets'))}</button>
      </div>
    ` : ''}
  `)
}

export function renderBgArchiveSwatches(items) {
  if (!items.length) return ''
  return items.map((item) => `
    <div data-bg-archive-card>
      <button
        type="button"
        class="st-btn"
        data-click="loadBgArchiveItem"
        data-bg-value="${escapeHtml(item.value)}"
        title="${escapeHtml(item.name)}"
        data-bg-archive-swatch
        style="--st-bg-archive:${escapeHtml(item.value)};"
      >
        <span data-bg-archive-label>${escapeHtml(item.name)}</span>
      </button>
        <button
          type="button"
          class="st-btn"
          data-click="deleteBgArchiveItem"
          data-archive-id="${escapeHtml(String(item.id))}"
          aria-label="${escapeHtml(t('common.delete'))}"
          data-bg-remove-btn
          data-variant="archive"
        ><i data-icon="x" aria-hidden="true"></i></button>
    </div>
  `).join('')
}

export function renderBackgroundSettingsSection(bgData = {}, options = {}) {
  const {
    title = t('customizer.sections.background'),
    textInputAction = 'previewBgProperty',
    textInputSettingKey = 'background_properties',
    textInputName = 'previewBgPropertyInput',
    textInputPlaceholder = t('customizer.backgroundPlaceholder'),
    clearAction = 'clearBgProperty',
    archiveAction = 'archiveBgProperty',
    uploadAction = 'uploadBgWallpaper',
    triggerUploadAction = 'triggerWallpaperUpload',
    uploadInputName = 'uploadBgWallpaperInput',
    uploadInputId = 'st-wallpaper-upload',
  } = options

  const {background_properties = '', bgArchive = [], bgAssets = []} = bgData
  const backgroundColorValue = toColorInputValue(background_properties?.trim?.() ?? background_properties)

  return section(title, `
    <div data-customizer-field data-customizer-field-layout="background-input">
      <div data-color-item>
        <input
          type="text"
          name="${escapeHtml(`${textInputName}Color`)}"
          data-coloris
          data-input-immediate="${escapeHtml(textInputAction)}"
          data-change="changeAppSetting"
          data-setting-key="${escapeHtml(textInputSettingKey)}"
          data-bg-color-input
          value="${escapeHtml(backgroundColorValue)}"
        >
        <button
          type="button"
          data-click="${escapeHtml(clearAction)}"
          data-customizer-clear
          title="${escapeHtml(t('customizer.reset'))}"
          aria-label="${escapeHtml(t('customizer.reset'))}"
        >&times;</button>
      </div>
      <input
        type="text"
        name="${escapeHtml(textInputName)}"
        class="w-100"
        data-input="${escapeHtml(textInputAction)}"
        data-change="changeAppSetting"
        data-setting-key="${escapeHtml(textInputSettingKey)}"
        data-bg-property-input
        value="${escapeHtml(background_properties)}"
        placeholder="${escapeHtml(textInputPlaceholder)}"
      />
      <button type="button" data-btn="primary" data-click="${escapeHtml(archiveAction)}" data-customizer-compact-btn>${t('customizer.archive')}</button>
      <button type="button" data-btn="warning" data-click="${escapeHtml(clearAction)}" data-customizer-compact-btn>${t('settings.clear')}</button>
    </div>
    ${bgArchive.length
      ? `<div data-bg-archive-list>${renderBgArchiveSwatches(bgArchive)}</div>`
      : '<div data-bg-archive-list></div>'}
    <div data-customizer-field data-customizer-field-layout="stack" data-customizer-gap="md">
      <label data-customizer-upload-row>
        <span data-customizer-field-label>${t('customizer.uploadWallpaper')}</span>
        <input type="file" name="${escapeHtml(uploadInputName)}" accept="image/*" data-change="${escapeHtml(uploadAction)}" hidden id="${escapeHtml(uploadInputId)}">
        <button type="button" data-click="${escapeHtml(triggerUploadAction)}" data-customizer-compact-btn>${t('customizer.chooseImage')}</button>
      </label>
    </div>
    ${bgAssets.length
      ? `<div data-bg-asset-list>${renderBgAssetThumbs(bgAssets)}</div>`
      : '<div data-bg-asset-list></div>'}
  `)
}

export function renderSettingsPanel(settings, widgetSettings = {}) {
  const {
    ui_language,
    bookmarks_open_in_new_tab,
    feed_search_url_template,
    html_cache,
  } = settings

  return `
    <div data-settings-form data-customizer-form>

      ${section(t('settings.language.label'), `
        <div data-customizer-field>
          <span data-customizer-field-label>${t('settings.language.label')}</span>
          <select
            name="ui_languageInput"
            data-change="changeUiLanguage"
            data-setting-key="ui_language"
            data-settings-scale-select
          >
            <option value="">${escapeHtml(t('noteForm.code.autoDetect'))}</option>
            <option value="en" lang="en"${ui_language === 'en' ? ' selected' : ''}>English</option>
            <option value="de" lang="de"${ui_language === 'de' ? ' selected' : ''}>Deutsch</option>
            <option value="tr" lang="tr"${ui_language === 'tr' ? ' selected' : ''}>Türkçe</option>
            <option value="hi" lang="hi"${ui_language === 'hi' ? ' selected' : ''}>हिन्दी</option>
          </select>
        </div>
        <p data-settings-hint>${t('settings.language.help')}</p>
        <div data-customizer-divider aria-hidden="true"></div>
      `)}

      ${section(t('settings.sections.performance'), `
        <label data-customizer-field data-customizer-field-type="boolean" data-customizer-label-clickable>
          <span data-customizer-field-label>${t('settings.htmlCache')}</span>
          <input type="checkbox"
            name="html_cacheInput"
            data-change="changeAppSetting"
            data-setting-key="html_cache"
            data-value-type="boolean"
            ${html_cache !== false ? 'checked' : ''}
          />
        </label>
        <p data-settings-hint>
          ${t('settings.htmlCacheHelp')}
        </p>
        <div data-customizer-divider aria-hidden="true"></div>
      `)}

      ${section(t('app.moduleTypes.tabs'), `
        <label data-customizer-field data-customizer-field-type="boolean" data-customizer-label-clickable>
          <span data-customizer-field-label>${t('settings.openBookmarksInNewTab')}</span>
          <input type="checkbox"
            name="bookmarks_open_in_new_tabInput"
            data-change="changeAppSetting"
            data-setting-key="bookmarks_open_in_new_tab"
            data-value-type="boolean"
            ${bookmarks_open_in_new_tab ? 'checked' : ''}
          />
        </label>
        <div data-customizer-divider aria-hidden="true"></div>
      `)}

      ${section(t('app.moduleTypes.feeds'), `
        <div data-customizer-field data-customizer-field-layout="stack" data-customizer-gap="sm">
          <span data-customizer-field-label>${t('settings.feedSearchUrl')}</span>
          <input
            type="text"
            name="feed_search_url_templateInput"
            class="min-w-100"
            data-change="changeAppSetting"
            data-setting-key="feed_search_url_template"
            value="${escapeHtml(feed_search_url_template ?? '')}"
            placeholder="${escapeHtml('https://www.google.com/search?q=%s')}"
            data-settings-wide-input
          />
          <span data-settings-hint>${t('settings.feedSearchHelp')}</span>
        </div>
        <div data-customizer-divider aria-hidden="true"></div>
      `)}

      ${renderWidgetEntrySection(widgetSettings)}

    </div>
  `
}

export function renderWidgetSettingsPanel(widgetSettings = {}, weatherState = {}) {
  const railEnabled = widgetSettings?.rail_enabled === true
  const railPosition = widgetSettings?.rail_position === 'bottom' ? 'bottom' : 'top'
  const railAlignOptions = new Set(['left', 'center', 'right', 'space-between', 'space-around'])
  const railAlign = railAlignOptions.has(widgetSettings?.rail_align)
    ? widgetSettings.rail_align
    : 'left'
  const railIgnoreMaxWidth = widgetSettings?.rail_ignore_max_width === true

  return `
    <div data-settings-form data-customizer-form>
      <p data-settings-hint>${escapeHtml(t('settings.widgetsHelp'))}</p>
      ${railEnabled ? `
        <div data-customizer-section>
          <div data-customizer-field>
            <span data-customizer-field-label>${t('settings.railPosition')}</span>
            <select
              id="widget_rail_position"
              name="widget_rail_position"
              data-change="changeWidgetSetting"
              data-widget-path="rail_position"
            >
              <option value="top"${railPosition === 'top' ? ' selected' : ''}>${escapeHtml(t('settings.top'))}</option>
              <option value="bottom"${railPosition === 'bottom' ? ' selected' : ''}>${escapeHtml(t('settings.bottom'))}</option>
            </select>
          </div>

          <div data-customizer-field>
            <span data-customizer-field-label>${t('settings.railAlignment')}</span>
            <select
              id="widget_rail_align"
              name="widget_rail_align"
              data-change="changeWidgetSetting"
              data-widget-path="rail_align"
            >
              <option value="left"${railAlign === 'left' ? ' selected' : ''}>${escapeHtml(t('settings.left'))}</option>
              <option value="center"${railAlign === 'center' ? ' selected' : ''}>${escapeHtml(t('settings.center'))}</option>
              <option value="right"${railAlign === 'right' ? ' selected' : ''}>${escapeHtml(t('settings.right'))}</option>
              <option value="space-between"${railAlign === 'space-between' ? ' selected' : ''}>${escapeHtml(t('settings.spaceBetween'))}</option>
              <option value="space-around"${railAlign === 'space-around' ? ' selected' : ''}>${escapeHtml(t('settings.spaceAround'))}</option>
            </select>
          </div>

          <label data-customizer-field data-customizer-field-type="boolean" data-customizer-label-clickable>
            <span data-customizer-field-label>${t('settings.railIgnoreMaxWidth')}</span>
            <input
              type="checkbox"
              name="widget_rail_ignore_max_width"
              data-change="changeWidgetSetting"
              data-widget-path="rail_ignore_max_width"
              data-value-type="boolean"
              ${railIgnoreMaxWidth ? 'checked' : ''}
            />
          </label>

          <div data-customizer-divider aria-hidden="true"></div>
        </div>
      ` : ''}
      ${renderWeatherSettingsSection(widgetSettings, weatherState)}
      ${renderClockSettingsSection(widgetSettings)}
    </div>
  `
}
