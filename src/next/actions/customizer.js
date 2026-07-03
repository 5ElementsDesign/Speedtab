import {closeSidepanel, getSidepanelState} from '../components/sidepanel.js'
import {saveAppSetting} from '../data/app-settings.js'
import {getUiConfigSpec} from '../config/ui-config-spec.js'
import {loadModuleBySyncId, saveModuleData, softDeleteModule} from '../data/modules.js'
import {deleteUiConfig, upsertUiConfig} from '../data/ui-config.js'
import {applyModuleUiConfig, applyShellUiConfig} from '../features/customizer/apply.js'
import {contrastRatio, getGroupForKey, GROUP_PAIR_KEYS} from '../features/customizer/contrast.js'
import {INLINE_COLOR_FIELD_PAIRS, INLINE_COLOR_FIELD_SECONDARIES, SHELL_SYNC_ID, updateContrastBadgeDOM} from '../features/customizer/render.js'
import {initCustomizerListeners, openCustomizerAppearancePanel, openCustomizerFormPanel, openCustomizerListPanel, refreshCustomizerListIfOpen} from '../features/customizer/panel.js'
import {getVisibleBookmarkMediaScope, initBookmarkMedia} from '../utils/bookmark-media.js'
import {t} from '../utils/i18n.js'
import {YEH} from '../../lib/yai/yeh.js'

export {initCustomizerListeners} from '../features/customizer/panel.js'

const CUSTOMIZER_GROUP_KEYS = {
  shellAppearance: [
    '--st-ws-shell-header-background-color',
    '--st-ws-shell-header-text-color',
    '--st-ws-shell-nav-background-color',
    '--st-ws-shell-nav-text-color',
    '--st-ws-shell-nav-active-background-color',
    '--st-ws-shell-nav-active-text-color',
    '--st-ws-module-background-color',
    '--st-ws-module-shadow-color',
  ],
  moduleSurface: ['--st-ws-module-background-color', '--st-ws-module-shadow-color'],
  bookmarkSurface: ['--st-module-bookmark-preview-background-color', '--st-module-bookmark-preview-text-color'],
}

// ─── Core persist ────────────────────────────────────────────────────────────

async function persistAndApply({syncId, moduleType, section, key, value}) {
  const isShell = syncId === SHELL_SYNC_ID
  const effectiveConfig = await upsertUiConfig({
    entityType: isShell ? 'shell' : 'module',
    entitySubtype: isShell ? 'app' : moduleType,
    entitySyncId: syncId,
    patch: {[section]: {[key]: value}},
  })
  if (isShell) {
    applyShellUiConfig(effectiveConfig)
  } else {
    const moduleRoot = document.querySelector(`[data-module-card][data-sync-id="${CSS.escape(syncId)}"]`)
    if (moduleRoot) applyModuleUiConfig(moduleRoot, effectiveConfig)
  }
  return effectiveConfig
}

function getPreviewApplyTarget(moduleRoot, targetName) {
  if (targetName === 'document-root') return document.documentElement
  if (targetName === 'grid-col') return moduleRoot?.closest?.('[data-grid-col]') ?? null
  if (targetName === 'tabs-root') return moduleRoot?.querySelector?.('[data-yai-tabs]') ?? null
  if (targetName === 'controller') return moduleRoot?.querySelector?.('[data-yai-tabs] > [data-controller]') ?? null
  return moduleRoot
}

function previewAttribute(target, name, value, spec) {
  if (!target) return
  if (spec.valueType === 'boolean') {
    if (value) target.setAttribute(name, spec.applyAs.trueValue ?? '')
    else target.removeAttribute(name)
    return
  }
  if (value == null || value === '') {
    target.removeAttribute(name)
    return
  }
  target.setAttribute(name, String(value))
}

function previewCssVariable(target, name, value, spec) {
  if (!target) return
  if (value == null || value === '') {
    target.style.removeProperty(name)
    if (name === '--st-grid-col-span') {
      target.style.removeProperty('--st-grid-col-track')
      target.style.removeProperty('grid-column')
      target.style.removeProperty('flex')
    }
    return
  }
  const nextValue = typeof spec.applyAs.serialize === 'function'
    ? spec.applyAs.serialize(value)
    : String(value)
  target.style.setProperty(name, nextValue)
  if (name === '--st-grid-col-span') {
    target.style.setProperty('--st-grid-col-track', `span ${nextValue} / span ${nextValue}`)
    target.style.setProperty('grid-column', `span ${nextValue} / span ${nextValue}`)
    target.style.setProperty('flex', `0 0 ${Math.max(8.333333, (Number(nextValue) / 12) * 100)}%`)
  }
}

function previewCssVariables(target, variables, value) {
  if (!target) return
  variables.forEach((entry) => {
    if (value == null || value === '') {
      target.style.removeProperty(entry.name)
      return
    }
    const nextValue = typeof entry.serialize === 'function' ? entry.serialize(value) : String(value)
    target.style.setProperty(entry.name, nextValue)
  })
}

function previewCustomizerValue(syncId, moduleType, section, key, value) {
  const isShell = syncId === SHELL_SYNC_ID
  const entityType = isShell ? 'shell' : 'module'
  const entitySubtype = isShell ? 'app' : moduleType
  const sectionSpec = getUiConfigSpec(entityType, entitySubtype)?.[section]
  const spec = sectionSpec?.[key]
  if (!spec) return

  const moduleRoot = isShell
    ? document.querySelector('[data-app]')
    : document.querySelector(`[data-module-card][data-sync-id="${CSS.escape(syncId)}"]`)
  const applyTarget = getPreviewApplyTarget(moduleRoot, spec.target)
  if (!applyTarget) return

  if (spec.applyAs.type === 'attribute') {
    previewAttribute(applyTarget, spec.applyAs.name, value, spec)
    return
  }
  if (spec.applyAs.type === 'css-variable') {
    previewCssVariable(applyTarget, spec.applyAs.name, value, spec)
    return
  }
  if (spec.applyAs.type === 'css-variables') {
    previewCssVariables(applyTarget, spec.applyAs.variables ?? [], value)
  }
}

function maybeUpdateContrastBadge(task, section, key) {
  if (section !== 'appearance') return
  const group = getGroupForKey(key)
  if (group) task.then((config) => updateContrastBadgeDOM(group, config?.appearance))
}

// ─── Contrast guard ──────────────────────────────────────────────────────────

function getStoredHex(syncId, cssVarName) {
  const el = cssVarName?.startsWith?.('--st-notes-')
    ? document.documentElement
    : syncId === SHELL_SYNC_ID
      ? document.querySelector('[data-app]')
      : document.querySelector(`[data-module-card][data-sync-id="${CSS.escape(syncId)}"]`)
  const v = el?.style.getPropertyValue(cssVarName) ?? ''
  return /^#[0-9a-fA-F]{6,8}$/.test(v.trim()) ? v.trim() : ''
}

function contrastWouldFail(section, key, value, syncId) {
  if (section !== 'appearance' || !value) return false
  const group = getGroupForKey(key)
  if (!group) return false
  const pairKeys = GROUP_PAIR_KEYS[group]
  const isText = key.includes('text')
  const isBg = key.includes('background')
  if (!isText && !isBg) return false
  // Only block when the paired color is also explicitly set (both must be set to enforce)
  const pairedStored = getStoredHex(syncId, isText ? pairKeys.bg : pairKeys.text)
  if (!pairedStored) return false
  const ratio = contrastRatio(isBg ? value : pairedStored, isText ? value : pairedStored)
  return ratio !== null && ratio < 3
}

function flashContrastBadge(key) {
  const group = getGroupForKey(key)
  if (!group) return
  const badge = document.querySelector(
    `[data-sidepanel][data-sidepanel-open] [data-customizer-contrast-badge][data-group="${CSS.escape(group)}"]`
  )
  if (!badge) return
  badge.setAttribute('data-contrast-blocked', '')
  setTimeout(() => badge.removeAttribute('data-contrast-blocked'), 650)
}

function updateModuleTitleDom(syncId, title) {
  const moduleRoot = document.querySelector(`[data-module-card][data-sync-id="${CSS.escape(syncId)}"]`)
  moduleRoot?.querySelector('[data-module-card-title]')?.replaceChildren(document.createTextNode(title))
}

function syncInlineColorPairDom(fieldName) {
  const primaryKey = INLINE_COLOR_FIELD_PAIRS[fieldName]
    ? fieldName
    : [...Object.entries(INLINE_COLOR_FIELD_PAIRS)].find(([, secondaryKey]) => secondaryKey === fieldName)?.[0]

  if (!primaryKey) return

  const sidepanel = document.querySelector('[data-sidepanel][data-sidepanel-open]')
  const primaryInput = sidepanel?.querySelector(`input[name="${CSS.escape(primaryKey)}"]`)
  const secondaryKey = INLINE_COLOR_FIELD_PAIRS[primaryKey]
  const secondaryInput = secondaryKey
    ? sidepanel?.querySelector(`input[name="${CSS.escape(secondaryKey)}"]`)
    : null
  const secondaryWrap = sidepanel?.querySelector(`[data-inline-secondary-for="${CSS.escape(primaryKey)}"]`)

  if (!(primaryInput instanceof HTMLInputElement) || !(secondaryWrap instanceof HTMLElement)) return
  const shouldShow = primaryInput.value.trim()
    || (secondaryInput instanceof HTMLInputElement && secondaryInput.value.trim())
  secondaryWrap.style.display = shouldShow ? '' : 'none'
}

function refreshModuleBookmarkMedia(syncId) {
  if (!syncId || syncId === SHELL_SYNC_ID) return
  const moduleRoot = document.querySelector(`[data-module-card][data-sync-id="${CSS.escape(syncId)}"]`)
  if (!(moduleRoot instanceof HTMLElement)) return
  const mediaScope = getVisibleBookmarkMediaScope(moduleRoot.querySelector('[data-yai-tabs]') ?? moduleRoot)
  if (mediaScope) initBookmarkMedia(mediaScope)
}

function persistCustomizerValue({syncId, moduleType, section, key, value}) {
  const task = persistAndApply({syncId, moduleType, section, key, value})
  maybeUpdateContrastBadge(task, section, key)
  if (moduleType === 'tabs' && section === 'behavior' && (key === 'module-tabs-force-favicon' || key === 'module-tabs-quicklinks')) {
    task.then(() => refreshModuleBookmarkMedia(syncId))
  }
  return task
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export const customizerActions = {
  async openCustomizer(target, event) {
    const moduleCard = target.closest('[data-module-card]')
    if (!moduleCard) return
    const syncId = moduleCard.dataset.syncId
    const moduleType = moduleCard.dataset.moduleType
    if (!syncId || !moduleType) return
    await openCustomizerFormPanel(syncId, moduleType, event?.__dropdownTrigger ?? null)
  },

  openCustomizerList(target, event) {
    openCustomizerListPanel(false, event?.__dropdownTrigger ?? null)
  },

  async openCustomizerAppearance(target, event) {
    await openCustomizerAppearancePanel(SHELL_SYNC_ID, 'app', event?.__dropdownTrigger ?? null)
  },

  async openShellCustomizer() {
    await openCustomizerFormPanel(SHELL_SYNC_ID, 'app')
  },

  async openCustomizerFor(target) {
    const syncId = target.dataset.syncId
    const moduleType = target.dataset.moduleType
    if (!syncId || !moduleType) return
    await openCustomizerFormPanel(syncId, moduleType)
  },

  toggleCustomizerListOptions(target) {
    openCustomizerListPanel(target.checked)
  },

  customizerClearColor(target) {
    const {syncId, moduleType} = getSidepanelState()
    if (!syncId || !moduleType) return
    const section = target.dataset.configSection
    const key = target.dataset.fieldName
    if (!section || !key) return
    const colorItem = target.closest('[data-color-item]')
    const input = colorItem?.querySelector(`input[name="${CSS.escape(key)}"]`)
    if (input) {
      input.value = ''
      const clrField = input.closest('.clr-field')
      if (clrField) clrField.style.color = ''
    }
    syncInlineColorPairDom(key)
    const task = persistAndApply({syncId, moduleType, section, key, value: ''})
    maybeUpdateContrastBadge(task, section, key)
  },

  async customizerResetGroup(target) {
    const {syncId, moduleType} = getSidepanelState()
    if (!syncId) return
    const section = target.dataset.configSection
    const groupId = target.dataset.group
    if (!section || !groupId) return
    const pairKeys = GROUP_PAIR_KEYS[groupId]
    const resetKeys = pairKeys
      ? [pairKeys.bg, pairKeys.text]
      : (CUSTOMIZER_GROUP_KEYS[groupId] ?? [])
    if (!resetKeys.length) return

    const isShell = syncId === SHELL_SYNC_ID
    const effectiveConfig = await upsertUiConfig({
      entityType: isShell ? 'shell' : 'module',
      entitySubtype: isShell ? 'app' : moduleType,
      entitySyncId: syncId,
      patch: {
        [section]: Object.fromEntries(resetKeys.map((key) => [key, ''])),
      },
    })
    if (isShell) {
      applyShellUiConfig(effectiveConfig)
    } else {
      const moduleRoot = document.querySelector(`[data-module-card][data-sync-id="${CSS.escape(syncId)}"]`)
      if (moduleRoot) applyModuleUiConfig(moduleRoot, effectiveConfig)
    }
    updateContrastBadgeDOM(groupId, effectiveConfig?.appearance)

    const sidepanel = document.querySelector('[data-sidepanel][data-sidepanel-open]')
    const groupEl = sidepanel?.querySelector(`[data-customizer-color-group][data-group="${CSS.escape(groupId)}"]`)
    if (groupEl) {
      groupEl.querySelectorAll('[data-coloris]').forEach((input) => {
        input.value = ''
        const clrField = input.closest('.clr-field')
        if (clrField) clrField.style.color = ''
      })
    }
  },

  async customizerResetStyles(target) {
    const state = getSidepanelState()
    const sidepanel = document.querySelector('[data-sidepanel][data-sidepanel-open]')
    const showResetOptions = sidepanel?.dataset?.showResetOptions === 'true'
    const syncId = target?.dataset?.resetSyncId || state.syncId
    const moduleType = target?.dataset?.resetModuleType || state.moduleType
    if (!syncId || !moduleType) return
    const resetLabel = target?.dataset?.resetLabel || ''
    const message = resetLabel
      ? t('customizer.confirmResetStylesTarget', {target: resetLabel})
      : t('customizer.confirmResetStyles')
    if (!confirm(message)) return

    const isShell = syncId === SHELL_SYNC_ID
    const effectiveConfig = await deleteUiConfig({
      entityType: isShell ? 'shell' : 'module',
      entitySubtype: isShell ? 'app' : moduleType,
      entitySyncId: syncId,
    })

    if (isShell) {
      await saveAppSetting('background_properties', null)
      await saveAppSetting('background_asset_id', null)
      const shellRoot = document.querySelector('[data-app]')
      if (shellRoot) shellRoot.style.background = ''
      applyShellUiConfig(effectiveConfig)
    } else {
      const moduleRoot = document.querySelector(`[data-module-card][data-sync-id="${CSS.escape(syncId)}"]`)
      if (moduleRoot) applyModuleUiConfig(moduleRoot, effectiveConfig)
    }

    if (state.syncId === syncId && state.moduleType === moduleType) {
      await openCustomizerFormPanel(syncId, moduleType)
    } else {
      openCustomizerListPanel(showResetOptions)
    }
  },

  async deleteModule(target) {
    const syncId = target?.dataset?.syncId || getSidepanelState().syncId
    if (!syncId) return
    const module = await loadModuleBySyncId(syncId)
    if (!module?.id) return
    const moduleTitle = module?.title?.trim() || t('modules.untitled')
    if (!confirm(t('app.confirms.deleteModule'))) return
    await softDeleteModule(module.id)
    closeSidepanel()
    const {renderNextRoot} = await import('../app/bootstrap.js')
    await renderNextRoot()
  },

  async customizerModuleTitleChange(target) {
    const {syncId} = getSidepanelState()
    if (!syncId || syncId === SHELL_SYNC_ID) return
    const nextTitle = target?.value?.trim() ?? ''
    if (!nextTitle) return
    const module = await loadModuleBySyncId(syncId)
    if (!module?.id) return
    if ((module.title ?? '') === nextTitle) return
    await saveModuleData(module.id, {title: nextTitle})
    updateModuleTitleDom(syncId, nextTitle)
    refreshCustomizerListIfOpen()
  },

  customizerChange(target) {
    const {syncId, moduleType} = getSidepanelState()
    if (!syncId || !moduleType) return
    const section = target.dataset.configSection
    const key = target.name
    if (!section || !key) return

    let value
    if (target.type === 'checkbox') {
      value = target.checked
    } else if (target.dataset.valueType === 'integer') {
      value = parseInt(target.value, 10)
    } else {
      value = target.value
    }

    if (contrastWouldFail(section, key, value, syncId)) {
      flashContrastBadge(key)
      return
    }

    // Keep Coloris swatch in sync when user types a hex directly into the input
    if (/^#[0-9a-fA-F]{6}$/.test(value)) {
      const clrField = target.closest('.clr-field')
      if (clrField) clrField.style.color = value
    }

    if (INLINE_COLOR_FIELD_PAIRS[key] || INLINE_COLOR_FIELD_SECONDARIES.has(key)) {
      syncInlineColorPairDom(key)
    }

    previewCustomizerValue(syncId, moduleType, section, key, value)
    if (target.hasAttribute('data-coloris')) {
      const persistKey = `st:customizer:color:${syncId}:${moduleType}:${section}:${key}`
      YEH.debounce(() => {
        persistCustomizerValue({syncId, moduleType, section, key, value})
      }, 500, persistKey)()
      return
    }

    persistCustomizerValue({syncId, moduleType, section, key, value})
  },
}
