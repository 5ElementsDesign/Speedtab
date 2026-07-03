import {openSidepanel} from '../components/sidepanel.js'
import {
  archiveBgItem,
  deleteBgArchiveItem,
  loadAppSettings,
  loadBgArchive,
  saveAppSetting,
} from '../data/app-settings.js'
import {deleteBgAsset, loadAssetObjectUrl, loadBgAssets, normalizeImageBlob, storeOrGetAsset} from '../data/assets.js'
import {renderBgArchiveSwatches, renderBgAssetThumbs, renderSettingsPanel, renderWidgetSettingsPanel} from '../features/settings/render.js'
import {openWeatherForecastModal, refreshWeatherWidgetNow} from '../features/widgets/manager.js'
import {getWidgetSettings, saveWidgetSettings} from '../../composables/useWidgetSettings.ts'
import {searchOpenMeteoLocations} from '../../composables/useOpenMeteoWeather.ts'
import {t} from '../utils/i18n.js'
import defaultWallpaperUrl from '../../assets/wallpaper-y-tree.webp'

const weatherSearchState = {
  query: '',
  results: [],
  status: 'idle',
  error: '',
}

let weatherSearchController = null

function sanitizeBg(raw) {
  return (raw ?? '')
    .trim()
    .replace(/^background-image\s*:\s*/i, '')
    .replace(/^background\s*:\s*/i, '')
    .replace(/;$/, '')
    .trim()
}

function isValidBg(value) {
  if (!value) return true
  return CSS.supports('background', value) || CSS.supports('background-image', value)
}

function applyBg(value) {
  const app = document.querySelector('[data-app]')
  if (app) app.style.background = value || ''
}

function toBgColorValue(raw) {
  const value = sanitizeBg(raw)
  if (!value) return ''
  if (/^#[0-9a-fA-F]{6,8}$/.test(value)) return value
  if (/^#[0-9a-fA-F]{3}$/.test(value)) {
    const [, r, g, b] = value
    return `#${r}${r}${g}${g}${b}${b}`
  }
  return ''
}

function getBgTextInput() {
  return document.querySelector('[data-bg-property-input]')
}

function getBgColorInput() {
  return document.querySelector('[data-bg-color-input]')
}

function syncBgInputs(value, source = null) {
  const normalizedValue = sanitizeBg(value)
  const colorValue = toBgColorValue(normalizedValue)
  const textInput = getBgTextInput()
  const colorInput = getBgColorInput()

  if (textInput && textInput !== source) {
    textInput.value = normalizedValue
  }

  if (colorInput && colorInput !== source) {
    colorInput.value = colorValue
    const clrField = colorInput.closest('.clr-field')
    if (clrField) clrField.style.color = colorValue || ''
  }
}

async function buildBgAssets() {
  const assets = await loadBgAssets()
  // Attach ephemeral object URL for thumbnail rendering — caller must not revoke these;
  // they live for the lifetime of the settings panel.
  return Promise.all(assets.map(async (asset) => {
    const url = await loadAssetObjectUrl(asset.id)
    return {...asset, _objectUrl: url ?? ''}
  }))
}

function flashBgArchiveSwatch(value) {
  if (!value) return
  const swatch = document.querySelector(`[data-bg-archive-swatch][data-bg-value="${CSS.escape(value)}"]`)
  if (!(swatch instanceof HTMLElement)) return
  swatch.removeAttribute('data-bg-archive-hit')
  requestAnimationFrame(() => {
    swatch.setAttribute('data-bg-archive-hit', '')
    setTimeout(() => swatch.removeAttribute('data-bg-archive-hit'), 900)
  })
}

function getSettingsBody() {
  return document.querySelector('[data-sidepanel-body]')
}

function getSettingsPanelKind() {
  return document.querySelector('[data-sidepanel]')?.dataset?.panelKind || 'settings'
}

function focusSettingsField(id) {
  if (!id) return
  requestAnimationFrame(() => {
    const field = document.getElementById(id)
    if (!(field instanceof HTMLInputElement)) return
    field.focus()
    const length = field.value.length
    field.setSelectionRange(length, length)
  })
}

async function renderSettingsBody(focusId = '') {
  const body = getSettingsBody()
  if (!(body instanceof HTMLElement)) return
  const [settings, widgetSettings] = await Promise.all([
    loadAppSettings(),
    getWidgetSettings(),
  ])
  body.innerHTML = getSettingsPanelKind() === 'settings-widgets'
    ? renderWidgetSettingsPanel(widgetSettings, weatherSearchState)
    : renderSettingsPanel(settings, widgetSettings)
  if (focusId) focusSettingsField(focusId)
}

async function rerenderAppAndReopenSettings() {
  const {renderNextRoot} = await import('../app/bootstrap.js')
  await renderNextRoot()
  if (getSettingsPanelKind() === 'settings-widgets') {
    await settingsActions.openWidgetSettings()
    return
  }
  await settingsActions.openSettings()
}

async function rerenderAppOnly() {
  const {renderNextRoot} = await import('../app/bootstrap.js')
  await renderNextRoot()
}

function setWidgetSetting(target, settings) {
  const path = target.dataset.widgetPath
  if (!path) return settings

  let value
  if (target.dataset.valueType === 'boolean') value = target.checked
  else if (target.dataset.valueType === 'number') value = Number(target.value)
  else value = target.value?.trim?.() ?? target.value

  const next = structuredClone(settings)
  const parts = path.split('.')
  let cursor = next
  while (parts.length > 1) {
    const key = parts.shift()
    cursor[key] ??= {}
    cursor = cursor[key]
  }
  cursor[parts[0]] = value === '' ? null : value

  if (path === 'weather.enabled' && value === true) {
    next.rail_enabled = true
  }

  return next
}

export const settingsActions = {
  async openSettings() {
    const panel = openSidepanel({title: t('common.settings'), panelKind: 'settings'})
    panel.querySelector('[data-sidepanel-body]').innerHTML = ''
    await renderSettingsBody()
  },

  async openWidgetSettings() {
    const panel = openSidepanel({
      title: t('settings.widgetConfiguration'),
      panelKind: 'settings-widgets',
      showBack: true,
      backAction: 'openSettings',
    })
    panel.querySelector('[data-sidepanel-body]').innerHTML = ''
    await renderSettingsBody()
  },

  async openWidgetSettingsLocation() {
    const panel = openSidepanel({
      title: t('settings.widgetConfiguration'),
      panelKind: 'settings-widgets',
      showBack: true,
      backAction: 'openSettings',
    })
    panel.querySelector('[data-sidepanel-body]').innerHTML = ''
    await renderSettingsBody('weather_location_query')
  },

  async changeUiLanguage(target) {
    await saveAppSetting('ui_language', target.value?.trim() || null)
    if (target.closest?.('[data-sidepanel][data-panel-kind]')) {
      await rerenderAppAndReopenSettings()
      return
    }
    await rerenderAppOnly()
  },

  async changeAppSetting(target) {
    const key = target.dataset.settingKey
    if (!key) return
    let value
    if (target.dataset.valueType === 'boolean') {
      value = target.checked
    } else if (target.dataset.valueType === 'number') {
      value = parseFloat(target.value)
    } else {
      value = sanitizeBg(target.value) || null
    }
    await saveAppSetting(key, value)
    if (key === 'background_properties') {
      syncBgInputs(value, target)
      applyBg(value)
      await saveAppSetting('background_asset_id', null)
    }
  },

  async changeWidgetSetting(target) {
    const widgetSettings = await getWidgetSettings()
    const nextSettings = setWidgetSetting(target, widgetSettings)
    await saveWidgetSettings(nextSettings)
    await rerenderAppAndReopenSettings()
  },

  async searchWeatherLocations(target) {
    const query = target?.value?.trim?.() ?? ''
    weatherSearchState.query = query

    if (weatherSearchController) weatherSearchController.abort()

    if (query.length < 2) {
      weatherSearchState.results = []
      weatherSearchState.status = 'idle'
      weatherSearchState.error = ''
      await renderSettingsBody('weather_location_query')
      return
    }

    weatherSearchController = new AbortController()
    weatherSearchState.status = 'loading'
    weatherSearchState.error = ''
    await renderSettingsBody('weather_location_query')

    try {
      const results = await searchOpenMeteoLocations(query, weatherSearchController.signal)
      weatherSearchState.results = results
      weatherSearchState.status = results.length ? 'idle' : 'empty'
      weatherSearchState.error = ''
    } catch (error) {
      if (error?.name === 'AbortError') return
      weatherSearchState.results = []
      weatherSearchState.status = 'error'
      weatherSearchState.error = error instanceof Error ? error.message : String(error)
    }

    await renderSettingsBody('weather_location_query')
  },

  async selectWeatherLocation(target) {
    const widgetSettings = await getWidgetSettings()
    const nextSettings = structuredClone(widgetSettings)
    nextSettings.rail_enabled = true
    nextSettings.weather.enabled = true
    nextSettings.weather.location = {
      name: target.dataset.locationName || '',
      country: target.dataset.locationCountry || null,
      latitude: Number(target.dataset.locationLatitude),
      longitude: Number(target.dataset.locationLongitude),
      timezone: target.dataset.locationTimezone || null,
    }
    weatherSearchState.query = ''
    weatherSearchState.results = []
    weatherSearchState.status = 'idle'
    weatherSearchState.error = ''
    await saveWidgetSettings(nextSettings)
    await rerenderAppAndReopenSettings()
  },

  async clearWeatherLocation() {
    const widgetSettings = await getWidgetSettings()
    const nextSettings = structuredClone(widgetSettings)
    nextSettings.weather.location = null
    weatherSearchState.query = ''
    weatherSearchState.results = []
    weatherSearchState.status = 'idle'
    weatherSearchState.error = ''
    await saveWidgetSettings(nextSettings)
    await rerenderAppAndReopenSettings()
  },

  async refreshWeatherWidget() {
    await refreshWeatherWidgetNow()
  },

  openWeatherForecast() {
    openWeatherForecastModal()
  },

  previewBgProperty(target) {
    const value = sanitizeBg(target.value)
    syncBgInputs(value, target)
    applyBg(isValidBg(value) ? value : '')
  },

  async archiveBgProperty() {
    const value = sanitizeBg(getBgTextInput()?.value)
    if (!value || !isValidBg(value)) return
    const result = await archiveBgItem(value)
    const items = await loadBgArchive()
    const list  = document.querySelector('[data-bg-archive-list]')
    if (list) list.innerHTML = renderBgArchiveSwatches(items)
    if (result?.item?.value) flashBgArchiveSwatch(result.item.value)
  },

  clearBgProperty() {
    syncBgInputs('')
    applyBg(`url('${defaultWallpaperUrl}') center/cover no-repeat`)
    saveAppSetting('background_properties', null)
    saveAppSetting('background_asset_id', null)
  },

  async loadBgArchiveItem(target) {
    const value = target.closest('[data-click]')?.dataset?.bgValue ?? ''
    if (!value || !isValidBg(value)) return
    await saveAppSetting('background_properties', value)
    await saveAppSetting('background_asset_id', null)
    syncBgInputs(value)
    applyBg(value)
  },

  async deleteBgArchiveItem(target) {
    const id = target.dataset.archiveId
    if (!id) return
    await deleteBgArchiveItem(id)
    const items = await loadBgArchive()
    const list  = document.querySelector('[data-bg-archive-list]')
    if (list) list.innerHTML = renderBgArchiveSwatches(items)
  },

  triggerWallpaperUpload() {
    document.getElementById('st-wallpaper-upload')?.click()
  },

  // Wallpaper upload
  async uploadBgWallpaper(target) {
    const file = target.files?.[0]
    if (!file) return
    target.value = ''

    const {blob, width, height} = await normalizeImageBlob(file)
    const assetId = await storeOrGetAsset(blob, 'background', width, height)
    await saveAppSetting('background_asset_id', assetId)
    await saveAppSetting('background_properties', null)

    const objUrl = URL.createObjectURL(blob)
    applyBg(`url('${objUrl}') center/cover no-repeat`)
    syncBgInputs('')

    const bgAssets = await buildBgAssets()
    const list = document.querySelector('[data-bg-asset-list]')
    if (list) list.innerHTML = renderBgAssetThumbs(bgAssets)
  },

  async loadBgAsset(target) {
    const assetId = Number(target.closest('[data-click]')?.dataset?.assetId)
    if (!assetId) return
    const objUrl = await loadAssetObjectUrl(assetId)
    if (!objUrl) return
    applyBg(`url('${objUrl}') center/cover no-repeat`)
    await saveAppSetting('background_asset_id', assetId)
    await saveAppSetting('background_properties', null)
    syncBgInputs('')
  },

  async deleteBgAsset(target) {
    const assetId = Number(target.closest('[data-click]')?.dataset?.assetId)
    if (!assetId) return
    await deleteBgAsset(assetId)
    const bgAssets = await buildBgAssets()
    const list = document.querySelector('[data-bg-asset-list]')
    if (list) list.innerHTML = renderBgAssetThumbs(bgAssets)
  },

  openImportExport() {
    const importExportUrl = chrome?.runtime?.getURL
      ? chrome.runtime.getURL('src/import-export.html')
      : './import-export.html'
    window.location.href = importExportUrl
  },

  openAbout() {
    openModal({
      title: t('settings.aboutTitle'),
      content: `<p>${t('settings.aboutCopy')}</p>`,
    })
  },
}
