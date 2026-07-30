import defaultWallpaperUrl from '../../assets/wallpaper-y-tree.webp'
import {searchOpenMeteoLocations} from '../../composables/useOpenMeteoWeather.ts'
import {getWidgetSettings, saveWidgetSettings} from '../../composables/useWidgetSettings.ts'
import {YEH} from '../../lib/yai/yeh.js'
import {DEFAULT_CLOCK_DATE_FORMAT, DEFAULT_CLOCK_TIME_FORMAT, DEFAULT_CLOCK_WIDGET_SETTINGS} from '../../types/widgets.ts'
import {closeModal, openModal} from '../components/modal.js'
import {openSidepanel} from '../components/sidepanel.js'
import {
  archiveBgItem,
  deleteBgArchiveItem,
  loadAppSettings,
  loadBgArchive,
  saveAppSetting,
} from '../data/app-settings.js'
import {deleteBgAsset, loadAssetObjectUrl, loadBgAssets, normalizeImageBlob, storeOrGetAsset} from '../data/assets.js'
import {renderBgArchiveSwatches, renderBgAssetThumbs, renderFeedbackModal, renderSettingsFooter, renderSettingsPanel, renderWeatherLocationSearchState, renderWidgetSettingsPanel} from '../features/settings/render.js'
import {
  createClockPresetTimer,
  createClockTimer,
  deleteClockTimer,
  openClockToolsModal,
  openWeatherForecastModal,
  patchWidgetRailSettings,
  pauseClockStopwatch,
  refreshWeatherWidgetNow,
  resetClockStopwatch,
  resetClockTimerDraft,
  resumeClockStopwatch,
  startClockStopwatch,
  syncClockTimerCreateState,
  toggleClockTimer
} from '../features/widgets/manager.js'
import {initColorPicker, wrapColorPicker} from '../utils/color-picker.js'
import {patchInner, replaceNode} from '../utils/dom-patch.js'
import {t} from '../utils/i18n.js'

const weatherSearchState = {
  query: '',
  results: [],
  status: 'idle',
  error: '',
}

let weatherSearchController = null
let liveWidgetSettings = null

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
  if (value) {
    document.body.style.setProperty('--st-workspace-background', value)
    return
  }

  document.body.style.removeProperty('--st-workspace-background')
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

function patchWeatherLocationSearchState() {
  const body = getSettingsBody()
  if (!(body instanceof HTMLElement)) return false
  const host = body.querySelector('[data-weather-location-search-state]')
  if (!(host instanceof HTMLElement)) return false
  const location = liveWidgetSettings?.weather?.location ?? null
  return replaceNode(host, renderWeatherLocationSearchState(location, {
    ...weatherSearchState,
    displayLabel: liveWidgetSettings?.weather?.display_label ?? '',
  })) instanceof HTMLElement
}

function getSettingsPanelKind() {
  return document.querySelector('[data-sidepanel]')?.dataset?.panelKind || 'settings'
}

function focusSettingsField(id) {
  if (!id) return
  requestAnimationFrame(() => {
    const field = document.getElementById(id)
    if (!(field instanceof HTMLElement)) return
    field.scrollIntoView({block: 'center', behavior: 'smooth'})
    field.focus()
    if (field instanceof HTMLInputElement) {
      const length = field.value.length
      field.setSelectionRange(length, length)
    }
  })
}

async function rerenderSettingsBodyPreserveState(preferredFocusId = '') {
  const body = getSettingsBody()
  if (!(body instanceof HTMLElement)) return

  const scrollTop = body.scrollTop
  const openAdvancedOptions = Array.from(body.querySelectorAll('[data-settings-advanced-options]'))
    .map((entry) => entry instanceof HTMLDetailsElement && entry.open)
  const active = document.activeElement
  const activeId = active instanceof HTMLElement ? active.id : ''
  const activeName = active instanceof HTMLInputElement || active instanceof HTMLSelectElement || active instanceof HTMLTextAreaElement
    ? active.name
    : ''
  const selectionStart = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement
    ? active.selectionStart
    : null
  const selectionEnd = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement
    ? active.selectionEnd
    : null

  await renderSettingsBody(preferredFocusId)
  body.scrollTop = scrollTop

  const nextAdvancedOptions = Array.from(body.querySelectorAll('[data-settings-advanced-options]'))
  nextAdvancedOptions.forEach((entry, index) => {
    if (!(entry instanceof HTMLDetailsElement)) return
    entry.open = openAdvancedOptions[index] === true
  })

  requestAnimationFrame(() => {
    body.scrollTop = scrollTop
  })

  if (preferredFocusId) return

  requestAnimationFrame(() => {
    body.scrollTop = scrollTop
    let field = null
    if (activeId) field = document.getElementById(activeId)
    if (!field && activeName) {
      field = document.querySelector(`[name="${CSS.escape(activeName)}"]`)
    }
    if (!(field instanceof HTMLElement)) return
    field.focus()
    if (
      selectionStart !== null
      && selectionEnd !== null
      && (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)
    ) {
      field.setSelectionRange(selectionStart, selectionEnd)
    }
  })
}

function updateClockPatternRestoreButton(field) {
  const restoreButton = field?.querySelector?.('[data-restore-pattern]')
  const input = field?.querySelector?.('textarea[name="clock_date_format"]')
  if (!(restoreButton instanceof HTMLButtonElement) || !(input instanceof HTMLTextAreaElement)) return
  restoreButton.disabled = input.value.trim() === DEFAULT_CLOCK_DATE_FORMAT
}

async function renderSettingsBody(focusId = '') {
  // CRITICAL PANEL RENDER PATH:
  // DO NOT REBUILD THE SETTINGS BODY FOR SMALL LOCAL STATE CHANGES
  // IF A PATCHABLE SUBSECTION ALREADY EXISTS.
  const body = getSettingsBody()
  if (!(body instanceof HTMLElement)) return
  const [settings, persistedWidgetSettings] = await Promise.all([
    loadAppSettings(),
    getWidgetSettings(),
  ])
  const widgetSettings = getSettingsPanelKind() === 'settings-widgets' && liveWidgetSettings
    ? liveWidgetSettings
    : persistedWidgetSettings
  patchInner(body, getSettingsPanelKind() === 'settings-widgets'
    ? renderWidgetSettingsPanel(widgetSettings, weatherSearchState)
    : renderSettingsPanel(settings, widgetSettings))

  const shouldInitWidgetColorPicker = getSettingsPanelKind() === 'settings-widgets'
    && Boolean(body.querySelector('[data-coloris]'))

  if (shouldInitWidgetColorPicker) {
    await initColorPicker()
  }

  wrapColorPicker(body)
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

function hasVisibleWidgets(settings) {
  return Boolean(settings?.rail_enabled && (settings?.weather?.enabled || settings?.clock?.enabled))
}

function shouldRerenderAppForWidgetSettings(prev, next) {
  return (
    prev?.rail_enabled !== next?.rail_enabled
    || prev?.rail_position !== next?.rail_position
    || hasVisibleWidgets(prev) !== hasVisibleWidgets(next)
  )
}

function applyWidgetRailAlignment(settings) {
  const railHost = document.querySelector('[data-widget-rail-host]')
  if (railHost instanceof HTMLElement) {
    railHost.setAttribute('data-widget-rail-align', settings?.rail_align || 'left')
  }
}

function applyWidgetRailMaxWidthSetting(settings) {
  const railInner = document.querySelector('.st-widget-rail-inner')
  if (!(railInner instanceof HTMLElement)) return

  if (settings?.rail_ignore_max_width === true) {
    railInner.style.setProperty('--st-page-grid-max-width', 'unset')
    railInner.style.width = '100%'
    railInner.style.maxWidth = 'none'
    return
  }

  railInner.style.removeProperty('--st-page-grid-max-width')
  railInner.style.removeProperty('width')
  railInner.style.removeProperty('max-width')
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
    liveWidgetSettings = null
    const panel = openSidepanel({title: t('common.settings'), panelKind: 'settings', footer: renderSettingsFooter(), footerClass: 'p-1'})
    patchInner(panel.querySelector('[data-sidepanel-body]'), '')
    await renderSettingsBody()
  },

  async openWidgetSettings(focusId = '') {
    liveWidgetSettings = null
    const panel = openSidepanel({
      title: t('settings.widgetConfiguration'),
      panelKind: 'settings-widgets',
      showBack: true,
      backAction: 'openSettings',
    })
    patchInner(panel.querySelector('[data-sidepanel-body]'), '')
    await renderSettingsBody(focusId)
  },

  async openClockWidgetSettings() {
    closeModal()
    await settingsActions.openWidgetSettings('clock_display')
  },

  async openWeatherWidgetSettings() {
    closeModal()
    await settingsActions.openWidgetSettings('weather_location_query')
  },

  async openWidgetSettingsLocation() {
    liveWidgetSettings = null
    const panel = openSidepanel({
      title: t('settings.widgetConfiguration'),
      panelKind: 'settings-widgets',
      showBack: true,
      backAction: 'openSettings',
    })
    patchInner(panel.querySelector('[data-sidepanel-body]'), '')
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
    const currentSettings = liveWidgetSettings ?? await getWidgetSettings()
    const nextSettings = setWidgetSetting(target, currentSettings)
    liveWidgetSettings = nextSettings
    const widgetPath = target.dataset.widgetPath || ''

    if (shouldRerenderAppForWidgetSettings(currentSettings, nextSettings)) {
      await saveWidgetSettings(nextSettings)
      await rerenderAppAndReopenSettings()
      return
    }

    applyWidgetRailAlignment(nextSettings)
    applyWidgetRailMaxWidthSetting(nextSettings)
    patchWidgetRailSettings(nextSettings, widgetPath)

    if (target.name === 'clock_date_format') {
      updateClockPatternRestoreButton(target.closest('[data-customizer-field]'))
    }

    const needsSettingsRerender = [
      'weather.enabled',
      'clock.enabled',
    ].includes(widgetPath)

    if (target.hasAttribute('data-coloris')) {
      const persistKey = `st:widget:color:${widgetPath}`
      YEH.debounce(async () => {
        await saveWidgetSettings(nextSettings)
      }, 300, persistKey)()
      return
    }

    await saveWidgetSettings(nextSettings)

    if (needsSettingsRerender) {
      await new Promise((resolve) => setTimeout(resolve, 0))
      await rerenderSettingsBodyPreserveState()
    }
  },

  async resetClockWidgetSettings() {
    const widgetSettings = await getWidgetSettings()
    const nextSettings = structuredClone(widgetSettings)
    nextSettings.clock = structuredClone(DEFAULT_CLOCK_WIDGET_SETTINGS)
    await saveWidgetSettings(nextSettings)
    liveWidgetSettings = nextSettings
    applyWidgetRailAlignment(nextSettings)
    applyWidgetRailMaxWidthSetting(nextSettings)
    patchWidgetRailSettings(nextSettings)
    await rerenderSettingsBodyPreserveState()
  },

  async clearWidgetColor(target) {
    const widgetPath = target.dataset.widgetPath
    if (!widgetPath) return
    const currentSettings = liveWidgetSettings ?? await getWidgetSettings()
    const nextSettings = structuredClone(currentSettings)
    const parts = widgetPath.split('.')
    let cursor = nextSettings
    while (parts.length > 1) {
      const key = parts.shift()
      cursor = cursor[key]
    }
    cursor[parts[0]] = null
    await saveWidgetSettings(nextSettings)
    liveWidgetSettings = nextSettings
    applyWidgetRailAlignment(nextSettings)
    applyWidgetRailMaxWidthSetting(nextSettings)
    patchWidgetRailSettings(nextSettings, widgetPath)

    const colorInput = target.closest('[data-color-item]')?.querySelector('input[data-coloris]')
    if (colorInput instanceof HTMLInputElement) {
      colorInput.value = ''
      const clrField = colorInput.closest('.clr-field')
      if (clrField instanceof HTMLElement) {
        clrField.style.color = ''
      }
    }
  },

  toggleClockPatternList(target) {
    const field = target.closest('[data-customizer-field]')
    const list = field?.querySelector?.('[data-settings-pattern-list]')
    if (!(list instanceof HTMLElement)) return
    updateClockPatternRestoreButton(field)
    if (list.hasAttribute('hidden')) list.removeAttribute('hidden')
    else list.setAttribute('hidden', '')
  },

  async insertClockPattern(target) {
    const pattern = target.dataset.insertPattern || ''
    const insertTarget = target.dataset.insertTarget === 'time' ? 'time' : 'date'
    if (!pattern) return
    const field = target.closest('[data-customizer-field]')
    const settingsBody = getSettingsBody()
    const input = insertTarget === 'time'
      ? settingsBody?.querySelector?.('input[name="clock_time_format"]')
      : field?.querySelector?.('textarea[name="clock_date_format"]')
    if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement)) return

    if (insertTarget === 'date' && input.value.trim() === DEFAULT_CLOCK_DATE_FORMAT) {
      input.value = ''
    }
    if (insertTarget === 'time' && input.value.trim() === DEFAULT_CLOCK_TIME_FORMAT) {
      input.value = ''
    }
    const start = input.selectionStart ?? input.value.length
    const end = input.selectionEnd ?? input.value.length
    input.value = `${input.value.slice(0, start)}${pattern}${input.value.slice(end)}`
    const nextCaret = start + pattern.length
    input.focus()
    input.setSelectionRange(nextCaret, nextCaret)
    if (insertTarget === 'date') {
      updateClockPatternRestoreButton(field)
    }
    input.dispatchEvent(new Event('change', {bubbles: true}))
  },

  async restoreClockPattern(target) {
    const pattern = target.dataset.restorePattern || DEFAULT_CLOCK_DATE_FORMAT
    const field = target.closest('[data-customizer-field]')
    const input = field?.querySelector?.('textarea[name="clock_date_format"]')
    if (!(input instanceof HTMLTextAreaElement)) return
    input.value = pattern
    input.focus()
    input.setSelectionRange(pattern.length, pattern.length)
    updateClockPatternRestoreButton(field)
    input.dispatchEvent(new Event('change', {bubbles: true}))
  },

  async searchWeatherLocations(target) {
    const query = target?.value?.trim?.() ?? ''
    weatherSearchState.query = query

    if (weatherSearchController) weatherSearchController.abort()

    if (query.length < 2) {
      weatherSearchState.results = []
      weatherSearchState.status = 'idle'
      weatherSearchState.error = ''
      if (patchWeatherLocationSearchState()) {
        focusSettingsField('weather_location_query')
        return
      }
      await renderSettingsBody('weather_location_query')
      return
    }

    weatherSearchController = new AbortController()
    weatherSearchState.status = 'loading'
    weatherSearchState.error = ''
    if (patchWeatherLocationSearchState()) {
      focusSettingsField('weather_location_query')
    } else {
      await renderSettingsBody('weather_location_query')
    }

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

    if (patchWeatherLocationSearchState()) {
      focusSettingsField('weather_location_query')
      return
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

  openClockTools(target) {
    openClockToolsModal(target)
  },

  startClockStopwatch() {
    startClockStopwatch()
  },

  pauseClockStopwatch() {
    pauseClockStopwatch()
  },

  resumeClockStopwatch() {
    resumeClockStopwatch()
  },

  resetClockStopwatch() {
    resetClockStopwatch()
  },

  updateClockTimerCreateState() {
    syncClockTimerCreateState()
  },

  resetClockTimerDraft() {
    resetClockTimerDraft()
  },

  createClockTimer() {
    createClockTimer()
  },

  createClockPresetTimer(target) {
    createClockPresetTimer(target)
  },

  toggleClockTimer(target) {
    toggleClockTimer(target)
  },

  deleteClockTimer(target) {
    deleteClockTimer(target)
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
    applyBg('')
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

  openFeedbackModal() {
    openModal({
      title: t('settings.feedbackTitle'),
      content: renderFeedbackModal(),
    })
  },
}
