import {on} from '../../app/dispatch.js'
import {getSidepanelState, isSidepanelOpen, onSidepanelClose, openSidepanel} from '../../components/sidepanel.js'
import {loadAppSettings, loadBgArchive} from '../../data/app-settings.js'
import {loadAssetObjectUrl, loadBgAssets} from '../../data/assets.js'
import {loadPageBySyncId} from '../../data/pages.js'
import {loadModuleBySyncId} from '../../data/modules.js'
import {loadStoredUiConfigsByEntitySyncIds, loadUiConfigsByEntitySyncIds} from '../../data/ui-config.js'
import {closeColorPicker, initColorPicker, wrapColorPicker} from '../../utils/color-picker.js'
import {t} from '../../utils/i18n.js'
import {hasCustomUiConfig} from './normalize.js'
import {renderCustomizerForm, renderCustomizerList, SHELL_SYNC_ID} from './render.js'

let activeCustomizerTrigger = null

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
      <span>${t('next.customizer.moreOptions')}</span>
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
  body.innerHTML = renderCustomizerList(moduleCards, shellHasConfig, pageLabel, pageSyncId, showResetOptions)
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

export function openCustomizerListPanel(showResetOptions = false, trigger = activeCustomizerTrigger) {
  const panelEl = openSidepanel({
    title: t('common.customize'),
    syncId: '',
    moduleType: '',
    panelKind: 'customizer-list',
    footer: renderCustomizerListFooter(showResetOptions),
  })
  panelEl.dataset.showResetOptions = showResetOptions ? 'true' : ''
  onSidepanelClose(clearCustomizerFocus)
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
  if (body) body.innerHTML = `<p data-customizer-loading>${t('common.loading')}</p>`

  const [effectiveConfigMap, storedConfigMap, bgData, moduleData] = await Promise.all([
    loadUiConfigsByEntitySyncIds(entityType, [{sync_id: syncId, type: isShell ? 'app' : moduleType}]),
    loadStoredUiConfigsByEntitySyncIds([{sync_id: syncId, type: isShell ? 'app' : moduleType}]),
    isShell ? loadShellBgData() : Promise.resolve(null),
    isShell ? Promise.resolve(null) : loadModuleBySyncId(syncId),
  ])
  const effectiveConfig = effectiveConfigMap.get(syncId)
  const storedConfig = storedConfigMap.get(syncId)

  if (body && isSidepanelOpen()) {
    body.innerHTML = renderCustomizerForm(
      entityType,
      isShell ? 'app' : moduleType,
      storedConfig ?? {behavior: {}, layout: {}, appearance: {}},
      bgData,
      moduleData,
      effectiveConfig,
    )
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
