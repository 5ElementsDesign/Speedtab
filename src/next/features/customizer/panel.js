import {on} from '../../app/dispatch.js'
import {getSidepanelState, isSidepanelOpen, onSidepanelClose, openSidepanel} from '../../components/sidepanel.js'
import {loadAppSettings, loadBgArchive} from '../../data/app-settings.js'
import {loadAssetObjectUrl, loadBgAssets} from '../../data/assets.js'
import {loadPageBySyncId} from '../../data/pages.js'
import {loadModuleBySyncId} from '../../data/modules.js'
import {getUiConfigSpec} from '../../config/ui-config-spec.js'
import {loadStoredUiConfigsByEntitySyncIds, loadUiConfigsByEntitySyncIds} from '../../data/ui-config.js'
import {closeColorPicker, initColorPicker, wrapColorPicker} from '../../utils/color-picker.js'
import {patchInner} from '../../utils/dom-patch.js'
import {t} from '../../utils/i18n.js'
import {hasCustomUiConfig} from './normalize.js'
import {renderCustomizerAppearancePanel, renderCustomizerForm, renderCustomizerList, SHELL_SYNC_ID} from './render.js'

let activeCustomizerTrigger = null
let customizerHoverDelegationActive = false

async function activateCustomizerHoverDelegation() {
  if (customizerHoverDelegationActive) return
  const {handler} = await import('../../app/bootstrap.js')
  handler?.addEvent?.('[data-sidepanel]', 'mouseover')
  handler?.addEvent?.('[data-sidepanel]', 'mouseout')
  customizerHoverDelegationActive = true
}

async function deactivateCustomizerHoverDelegation() {
  if (!customizerHoverDelegationActive) return
  const {handler} = await import('../../app/bootstrap.js')
  handler?.removeEvent?.('[data-sidepanel]', 'mouseover')
  handler?.removeEvent?.('[data-sidepanel]', 'mouseout')
  customizerHoverDelegationActive = false
}

function getActivePagePanel() {
  const activeBtn = document.querySelector('[data-controller] [data-tab-action="open"][aria-selected="true"]')
  if (activeBtn?.dataset?.open) {
    return document.querySelector(`[data-tab="${CSS.escape(activeBtn.dataset.open)}"]`)
  }
  return document.querySelector('[data-app-tab-panel]:not([inert])')
}

function renderCustomizerListFooter(showResetOptions = false) {
  return `
    <label data-customizer-list-footer>
      <input
        type="checkbox"
        data-change="toggleCustomizerListOptions"
        ${showResetOptions ? 'checked' : ''}
      >
      <span>${t('customizer.moreOptions')}</span>
    </label>
  `
}

function renderCustomizerModuleFooter(syncId = '') {
  return `
    <div data-sidepanel-action-footer>
      <button
        type="button"
        data-btn="danger"
        data-click="deleteModule"
        data-sync-id="${syncId}"
      >${t('moduleForm.deleteModule')}</button>
    </div>
  `
}

function removeActiveCustomizerDropdownUi() {
  document.querySelectorAll('[data-dropdown-trigger][data-customizer-active]')
    .forEach((trigger) => trigger.removeAttribute('data-customizer-active'))
}

function syncActiveCustomizerTrigger(trigger = activeCustomizerTrigger) {
  removeActiveCustomizerDropdownUi()
  if (!(trigger instanceof HTMLElement) || !trigger.isConnected) return
  trigger.setAttribute('data-customizer-active', '')
  activeCustomizerTrigger = trigger
}

function releaseActiveCustomizerTrigger() {
  removeActiveCustomizerDropdownUi()
  activeCustomizerTrigger = null
}

export function clearCustomizerFocus() {
  document.querySelectorAll('[data-module-card][data-customizer-focus]')
    .forEach((card) => card.removeAttribute('data-customizer-focus'))
}

async function renderCustomizerListBody(body, showResetOptions = false) {
  // CRITICAL PANEL RENDER PATH:
  // KEEP THIS FOR REAL LIST SHAPE CHANGES ONLY.
  // DO NOT ROUTE SIMPLE FIELD OR TOGGLE STATE THROUGH A LIST REBUILD.
  clearCustomizerFocus()
  const activePanel = getActivePagePanel()
  const pageSyncId = activePanel?.querySelector('[data-app-tab-shell]')?.dataset?.pageSyncId ?? ''
  const activePageBtn = document.querySelector('[data-controller] [data-tab-action="open"][aria-selected="true"]')
  let pageLabel = activePageBtn?.querySelector('.st-next-page-button-label')?.textContent?.trim()
    ?? activePageBtn?.textContent?.trim()
    ?? t('nav.page')
  if ((!pageLabel || pageLabel === t('nav.page')) && pageSyncId) {
    const activePage = await loadPageBySyncId(pageSyncId)
    if (activePage?.title?.trim()) pageLabel = activePage.title.trim()
  }
  const moduleCards = [...(activePanel ?? document).querySelectorAll('[data-module-card][data-sync-id]')]
  const shellConfigMap = await loadUiConfigsByEntitySyncIds('shell', [{sync_id: SHELL_SYNC_ID, type: 'app'}])
  const shellConfig = shellConfigMap.get(SHELL_SYNC_ID)
  const shellHasConfig = hasCustomUiConfig('shell', 'app', shellConfig)
  patchInner(body, renderCustomizerList(moduleCards, shellHasConfig, pageLabel, pageSyncId, showResetOptions))
}

function colorToHex(value = '') {
  const normalized = value.trim()
  if (!normalized) return ''
  if (/^#[0-9a-fA-F]{6,8}$/.test(normalized)) return normalized
  if (/^#[0-9a-fA-F]{3}$/.test(normalized)) {
    const [, r, g, b] = normalized
    return `#${r}${r}${g}${g}${b}${b}`
  }

  const match = normalized.match(/^rgba?\(([^)]+)\)$/i)
  if (!match) return ''

  const parts = match[1].split(',').map((part) => part.trim())
  if (parts.length < 3) return ''

  const [r, g, b] = parts.slice(0, 3).map((part) => Math.max(0, Math.min(255, Number.parseInt(part, 10) || 0)))
  const alpha = parts[3] == null ? null : Math.max(0, Math.min(1, Number.parseFloat(parts[3]) || 0))
  const toHex = (channel) => channel.toString(16).padStart(2, '0')

  if (alpha == null || alpha >= 1) {
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`
  }

  return `#${toHex(r)}${toHex(g)}${toHex(b)}${toHex(Math.round(alpha * 255))}`
}

async function loadShellBgData() {
  const [settings, bgArchive, assets] = await Promise.all([
    loadAppSettings(),
    loadBgArchive(),
    loadBgAssets(),
  ])
  const bgAssets = await Promise.all(assets.map(async (asset) => {
    const url = await loadAssetObjectUrl(asset.id)
    return {...asset, _objectUrl: url ?? ''}
  }))
  return {
    background_properties: settings.background_properties ?? '',
    bgArchive,
    bgAssets,
  }
}

function resolveCssVariableColor(target, cssVarName) {
  if (!(target instanceof Element) || !cssVarName) return ''
  const probe = document.createElement('span')
  probe.style.color = `var(${cssVarName})`
  probe.style.position = 'absolute'
  probe.style.opacity = '0'
  probe.style.pointerEvents = 'none'
  probe.style.inset = '0 auto auto 0'
  target.appendChild(probe)
  const resolved = getComputedStyle(probe).color
  probe.remove()
  return colorToHex(resolved)
}

function resolveElementPropertyColor(selector, property) {
  const el = document.querySelector(selector)
  if (!(el instanceof Element)) return ''
  return colorToHex(getComputedStyle(el)[property] || '')
}

function resolveComputedVarColor(selector, cssVarName) {
  const el = document.querySelector(selector)
  if (!(el instanceof Element) || !cssVarName) return ''
  return colorToHex(getComputedStyle(el).getPropertyValue(cssVarName) || '')
}

function resolveShellAppearanceField(key, fieldSpec, shellRoot, docRoot) {
  const sampleResolvers = {
    '--st-ws-shell-header-background-color': () => resolveElementPropertyColor('[data-app-brand-wrap]', 'backgroundColor'),
    '--st-ws-shell-header-text-color': () => resolveElementPropertyColor('[data-app-brand-wrap]', 'color'),
    '--st-ws-shell-nav-background-color': () => resolveElementPropertyColor('[data-app-header-nav] [data-open]:not(.active)', 'backgroundColor')
      || resolveElementPropertyColor('[data-app-header-nav] [data-open]', 'backgroundColor'),
    '--st-ws-shell-nav-text-color': () => resolveElementPropertyColor('[data-app-header-nav] [data-open]:not(.active)', 'color')
      || resolveElementPropertyColor('[data-app-header-nav] [data-open]', 'color'),
    '--st-ws-shell-nav-active-background-color': () => resolveElementPropertyColor('[data-app-header-nav] [data-open].active', 'backgroundColor'),
    '--st-ws-shell-nav-active-text-color': () => resolveElementPropertyColor('[data-app-header-nav] [data-open].active', 'color'),
    '--st-module-bookmark-preview-background-color': () => resolveElementPropertyColor('[data-bookmark-tile] .st-trigger-tab-title', 'backgroundColor')
      || resolveElementPropertyColor('[data-bookmark-tile] .st-trigger-tab', 'backgroundColor'),
    '--st-module-bookmark-preview-text-color': () => resolveElementPropertyColor('[data-bookmark-tile] .st-trigger-tab-title', 'color')
      || resolveElementPropertyColor('[data-bookmark-tile] [data-title]', 'color'),
    '--st-ws-module-shadow-color': () => resolveComputedVarColor('[data-module-card] [data-yai-tabs]', '--yai-tabs-shadow-medium-color')
      || resolveComputedVarColor('[data-app]', '--st-ws-module-shadow-color'),
  }

  const resolver = sampleResolvers[key]
  if (resolver) {
    const resolved = resolver()
    if (resolved) return resolved
  }

  const applyName = fieldSpec.applyAs?.name
  const target = fieldSpec.target === 'document-root' ? docRoot : shellRoot
  return resolveCssVariableColor(target, applyName)
}

function resolveShellAppearancePreview(config = {}) {
  const spec = getUiConfigSpec('shell', 'app')
  const shellRoot = document.querySelector('[data-app]')
  const docRoot = document.documentElement
  const resolved = {
    behavior: {...(config.behavior ?? {})},
    layout: {...(config.layout ?? {})},
    appearance: {...(config.appearance ?? {})},
  }

  for (const [key, fieldSpec] of Object.entries(spec.appearance ?? {})) {
    if (fieldSpec.valueType !== 'color') continue
    if (resolved.appearance[key]) continue

    const value = resolveShellAppearanceField(key, fieldSpec, shellRoot, docRoot)
    if (value) resolved.appearance[key] = value
  }

  return resolved
}

export function openCustomizerListPanel(showResetOptions = false, trigger = activeCustomizerTrigger) {
  const panelEl = openSidepanel({
    title: t('common.customize'),
    syncId: '',
    moduleType: '',
    panelKind: 'customizer-list',
    footer: renderCustomizerListFooter(showResetOptions),
  })
  panelEl.dataset.showResetOptions = showResetOptions ? 'true' : ''
  void activateCustomizerHoverDelegation()
  onSidepanelClose(clearCustomizerFocus)
  onSidepanelClose(() => {
    void deactivateCustomizerHoverDelegation()
  })
  onSidepanelClose((reason) => {
    if (reason === 'close') {
      releaseActiveCustomizerTrigger()
      return
    }
    removeActiveCustomizerDropdownUi()
  })
  if (trigger) activeCustomizerTrigger = trigger
  syncActiveCustomizerTrigger(trigger)
  const body = panelEl.querySelector('[data-sidepanel-body]')
  if (body) renderCustomizerListBody(body, showResetOptions)
}

export async function openCustomizerFormPanel(syncId, moduleType, trigger = activeCustomizerTrigger) {
  const isShell = syncId === SHELL_SYNC_ID
  const entityType = isShell ? 'shell' : 'module'
  const title = isShell ? t('app.shell') : t('common.customize')
  const meta = !isShell && moduleType ? t(`app.moduleTypes.${moduleType}`) : ''
  const panelEl = openSidepanel({
    title,
    meta,
    syncId,
    moduleType,
    panelKind: 'customizer-form',
    showBack: true,
    backAction: 'openCustomizerList',
    footer: !isShell ? renderCustomizerModuleFooter(syncId) : '',
  })

  onSidepanelClose(clearCustomizerFocus)
  onSidepanelClose(() => closeColorPicker())
  onSidepanelClose((reason) => {
    if (reason === 'close') {
      releaseActiveCustomizerTrigger()
      return
    }
    removeActiveCustomizerDropdownUi()
  })
  if (trigger) activeCustomizerTrigger = trigger
  syncActiveCustomizerTrigger(trigger)

  if (!isShell) {
    const moduleCard = document.querySelector(`[data-module-card][data-sync-id="${CSS.escape(syncId)}"]`)
    if (moduleCard) {
      moduleCard.setAttribute('data-customizer-focus', '')
      onSidepanelClose(() => moduleCard.removeAttribute('data-customizer-focus'))
    }
  }

  const body = panelEl.querySelector('[data-sidepanel-body]')
  if (body) patchInner(body, `<p data-customizer-loading>${t('common.loading')}</p>`)

  const [effectiveConfigMap, storedConfigMap, bgData, moduleData] = await Promise.all([
    loadUiConfigsByEntitySyncIds(entityType, [{sync_id: syncId, type: isShell ? 'app' : moduleType}]),
    loadStoredUiConfigsByEntitySyncIds([{sync_id: syncId, type: isShell ? 'app' : moduleType}]),
    isShell ? loadShellBgData() : Promise.resolve(null),
    isShell ? Promise.resolve(null) : loadModuleBySyncId(syncId),
  ])
  const effectiveConfig = effectiveConfigMap.get(syncId)
  const storedConfig = storedConfigMap.get(syncId)

  if (body && isSidepanelOpen()) {
    // CRITICAL PANEL RENDER PATH:
    // THIS REBUILDS THE CUSTOMIZER FORM BODY.
    // PATCH LOCAL CONTROLS IN PLACE WHEN STRUCTURE DID NOT CHANGE.
    patchInner(body, renderCustomizerForm(
      entityType,
      isShell ? 'app' : moduleType,
      storedConfig ?? {behavior: {}, layout: {}, appearance: {}},
      bgData,
      moduleData,
      effectiveConfig,
    ))
    await initColorPicker()
    wrapColorPicker(body)
  }
}

export async function openCustomizerAppearancePanel(syncId = SHELL_SYNC_ID, moduleType = 'app', trigger = activeCustomizerTrigger) {
  const isShell = syncId === SHELL_SYNC_ID
  if (!isShell) return

  const panelEl = openSidepanel({
    title: t('common.appearance'),
    meta: t('app.shell'),
    syncId,
    moduleType,
    panelKind: 'customizer-appearance',
    panelSize: 'wide',
    showBack: true,
    backAction: 'openShellCustomizer',
  })

  onSidepanelClose(clearCustomizerFocus)
  onSidepanelClose(() => closeColorPicker())
  onSidepanelClose((reason) => {
    if (reason === 'close') {
      releaseActiveCustomizerTrigger()
      return
    }
    removeActiveCustomizerDropdownUi()
  })
  if (trigger) activeCustomizerTrigger = trigger
  syncActiveCustomizerTrigger(trigger)

  const body = panelEl.querySelector('[data-sidepanel-body]')
  if (body) patchInner(body, `<p data-customizer-loading>${t('common.loading')}</p>`)

  const [effectiveConfigMap, storedConfigMap, bgData] = await Promise.all([
    loadUiConfigsByEntitySyncIds('shell', [{sync_id: syncId, type: 'app'}]),
    loadStoredUiConfigsByEntitySyncIds([{sync_id: syncId, type: 'app'}]),
    loadShellBgData(),
  ])
  const effectiveConfig = effectiveConfigMap.get(syncId)
  const storedConfig = storedConfigMap.get(syncId)
  const resolvedEffectiveConfig = resolveShellAppearancePreview(effectiveConfig)

  if (body && isSidepanelOpen()) {
    // CRITICAL PANEL RENDER PATH:
    // APPEARANCE BODY REBUILDS ARE ONLY FOR REAL SECTION SHAPE CHANGES.
    patchInner(body, renderCustomizerAppearancePanel(
      'shell',
      'app',
      storedConfig ?? {behavior: {}, layout: {}, appearance: {}},
      bgData,
      resolvedEffectiveConfig,
    ))
    await initColorPicker()
    wrapColorPicker(body)
  }
}

export function refreshCustomizerListIfOpen() {
  if (!isSidepanelOpen()) return
  const {panelKind, syncId} = getSidepanelState()
  if (panelKind !== 'customizer-list' || syncId) return
  const sidepanel = document.querySelector('[data-sidepanel][data-sidepanel-open]')
  const body = sidepanel?.querySelector('[data-sidepanel-body]')
  const showResetOptions = sidepanel?.dataset?.showResetOptions === 'true'
  if (body) renderCustomizerListBody(body, showResetOptions)
}

export function initCustomizerListeners() {
  on('page-hydrated', (e) => {
    if (!isSidepanelOpen()) return
    const {panelKind, syncId} = getSidepanelState()
    if (panelKind === 'customizer-form' && syncId) {
      e.detail.content
        ?.querySelector(`[data-module-card][data-sync-id="${CSS.escape(syncId)}"]`)
        ?.setAttribute('data-customizer-focus', '')
      return
    }
    refreshCustomizerListIfOpen()
  })
}
