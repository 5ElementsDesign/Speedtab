import {SPEEDTAB_SVG} from '../../components/icons.js'
import {escapeHtml} from '../../utils/html.js'
import {t} from '../../utils/i18n.js'

function toColorInputValue(value) {
  if (!value) return ''
  if (/^#[0-9a-fA-F]{6,8}$/.test(value)) return value
  if (/^#[0-9a-fA-F]{3}$/.test(value)) {
    const [, r, g, b] = value
    return `#${r}${r}${g}${g}${b}${b}`
  }
  return ''
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
        >${SPEEDTAB_SVG.x}</button>
      </div>
    `
  }).join('')
}

function section(title, body) {
  return `
    <div data-customizer-section>
      <p data-customizer-section-title>${escapeHtml(title)}</p>
      ${body}
    </div>
  `
}

function renderRailSettingsSection(widgetSettings = {}) {
  const railEnabled = widgetSettings?.rail_enabled === true
  const railPosition = widgetSettings?.rail_position === 'bottom' ? 'bottom' : 'top'
  const railAlign = widgetSettings?.rail_align === 'center' || widgetSettings?.rail_align === 'right'
    ? widgetSettings.rail_align
    : 'left'
  return section(t('settings.rail'), `
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
        </select>
      </div>
    ` : ''}
  `)
}

function renderWeatherSettingsSection(widgetSettings = {}, weatherState = {}) {
  const weather = widgetSettings?.weather ?? {}
  const weatherEnabled = weather.enabled === true
  const location = weather.location ?? null
  const results = weatherState.results ?? []
  const status = weatherState.status ?? 'idle'
  const query = weatherState.query ?? ''
  const error = weatherState.error ?? ''

  return `
    <div data-customizer-divider aria-hidden="true"></div>
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
                <span>${escapeHtml(location.country ? `${location.name}, ${location.country}` : location.name)}</span>
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
          <span data-customizer-field-label>${t('settings.displayLabel')}</span>
          <input
            id="weather_display_label"
            name="weather_display_label"
            type="text"
            value="${escapeHtml(weather.display_label ?? '')}"
            placeholder="${escapeHtml(t('settings.displayLabelPlaceholder'))}"
            data-change="changeWidgetSetting"
            data-widget-path="weather.display_label"
            data-value-type="string"
          />
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
      <div data-customizer-field>
        <span data-customizer-field-label>${t('settings.widgetConfiguration')}</span>
        <button type="button" class="st-btn" data-click="openWidgetSettings">${escapeHtml(t('settings.configureWidgets'))}</button>
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
        >${SPEEDTAB_SVG.x}</button>
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
  return `
    <div data-settings-form data-customizer-form>
      <p data-settings-hint>${escapeHtml(t('settings.widgetsHelp'))}</p>
      ${renderRailSettingsSection(widgetSettings)}
      ${renderWeatherSettingsSection(widgetSettings, weatherState)}
    </div>
  `
}
