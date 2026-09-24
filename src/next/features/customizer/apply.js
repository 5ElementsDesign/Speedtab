import {getUiConfigSpec} from '../../config/ui-config-spec.js'
import {isBookmarkModuleType} from '../../config/module-types.js'
import {getCachedAppSettings} from '../../data/app-settings.js'
import {getVisibleBookmarkMediaScope, initBookmarkMedia} from '../../utils/bookmark-media.js'
import {hasCustomUiConfig} from './normalize.js'

const SHELL_DIRECT_APPEARANCE_KEYS = [
  '--st-ws-shell-header-background-color',
  '--st-ws-shell-header-text-color',
  '--st-ws-shell-nav-background-color',
  '--st-ws-shell-nav-text-color',
  '--st-ws-shell-nav-active-background-color',
  '--st-ws-shell-nav-active-text-color',
  '--st-nav-header-background-color',
  '--st-nav-header-text-color',
  '--st-nav-background-color',
  '--st-nav-text-color',
  '--st-nav-active-background-color',
  '--st-nav-active-text-color',
  '--st-ws-module-background-color',
]

const SHELL_APPEARANCE_OVERRIDE_STYLE_ID = 'st-shell-appearance-overrides'

function applyAttribute(target, name, value, spec) {
  if (!target) return
  if (spec.valueType === 'boolean') {
    if (value) {
      target.setAttribute(name, spec.applyAs.trueValue ?? '')
    } else {
      target.removeAttribute(name)
    }
    return
  }

  if (value == null || value === '') {
    target.removeAttribute(name)
    return
  }

  target.setAttribute(name, String(value))
}

function applyCssVariable(target, name, value, spec) {
  if (!target) return
  if (value == null || value === '') {
    target.style.removeProperty(name)
    if (name === '--st-grid-col-span') {
      target.style.removeProperty('--st-grid-col-track')
      target.style.removeProperty('grid-column')
      target.style.removeProperty('--st-grid-col-basis')
      target.style.removeProperty('flex')
      target.style.removeProperty('max-width')
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
    target.style.removeProperty('--st-grid-col-basis')
    target.style.removeProperty('flex')
    target.style.removeProperty('max-width')
  }
}

function applyCssVariables(target, variables, value) {
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

function applyLinkTarget(moduleRoot, behavior) {
  const globalNewTab = getCachedAppSettings().bookmarks_open_in_new_tab ?? true
  const newTab = behavior === 'new-tab' || (behavior !== 'same-tab' && globalNewTab)
  moduleRoot.querySelectorAll('[data-bookmark-link]').forEach((a) => {
    if (newTab) {
      a.setAttribute('target', '_blank')
      a.setAttribute('rel', 'noopener noreferrer')
    } else {
      a.removeAttribute('target')
      a.removeAttribute('rel')
    }
  })
}

function applyModuleSubtype(moduleRoot, effectiveConfig) {
  if (!moduleRoot) return
  const quicklinksEnabled = effectiveConfig?.behavior?.['module-tabs-quicklinks'] === true
  if (quicklinksEnabled) {
    moduleRoot.setAttribute('data-module-sub-type', 'quicklinks')
    moduleRoot.setAttribute('data-quicklinks', '')
    return
  }
  moduleRoot.removeAttribute('data-module-sub-type')
  moduleRoot.removeAttribute('data-quicklinks')
}

function applyInlineAddTileVisibility(moduleRoot, moduleType, effectiveConfig) {
  if (!moduleRoot) return
  const showAddTile = effectiveConfig?.behavior?.['module-tabs-show-add-tile'] !== false

  if (isBookmarkModuleType(moduleType)) {
    moduleRoot.querySelectorAll('[data-bookmark-add-tile]').forEach((tile) => {
      tile.toggleAttribute('hidden', !showAddTile)
    })
    return
  }

  if (moduleType === 'notes') {
    moduleRoot.querySelectorAll('[data-note-add-tile]').forEach((tile) => {
      tile.toggleAttribute('hidden', !showAddTile)
    })
  }
}

function getApplyTarget(moduleRoot, targetName) {
  if (targetName === 'document-root') return document.documentElement
  if (targetName === 'grid-col') return moduleRoot.closest('[data-grid-col]')
  if (targetName === 'tabs-root') return moduleRoot.querySelector('[data-yai-tabs]')
  if (targetName === 'controller') return moduleRoot.querySelector('[data-yai-tabs] > [data-controller]')
  return moduleRoot
}

function applySection(moduleRoot, values, sectionSpec) {
  if (!values || typeof values !== 'object') return
  for (const [key, value] of Object.entries(values)) {
    const spec = sectionSpec[key]
    if (!spec) continue

    const applyTarget = getApplyTarget(moduleRoot, spec.target)
    if (!applyTarget) continue

    if (spec.applyAs.type === 'attribute') {
      applyAttribute(applyTarget, spec.applyAs.name, value, spec)
      continue
    }

    if (spec.applyAs.type === 'css-variable') {
      applyCssVariable(applyTarget, spec.applyAs.name, value, spec)
      continue
    }

    if (spec.applyAs.type === 'css-variables') {
      applyCssVariables(applyTarget, spec.applyAs.variables ?? [], value)
    }

    // link-target is handled by applyLinkTarget after the section loop
  }
}

function applyShellAppearanceOverrides(appearance) {
  const rules = []
  const add = (selector, property, key) => {
    const value = appearance[key]
    if (value != null && value !== '') rules.push(`${selector}{${property}:${value} !important}`)
  }

  const mainHeader = 'html body #app :is([data-app-brand-wrap],[data-app-header-nav],[data-app-header-actions])'
  const mainHeaderControls = 'html body #app [data-app-brand],html body #app :is([data-app-brand-wrap],[data-app-header-actions]) :is(button,a),html body #app [data-app-header-nav] > :is(button,a,[data-dropdown] > [data-dropdown-trigger])'
  const mainControllerHeader = 'html body #app [data-yai-tabs] > :is([data-controller],[data-module-actions])'
  const mainControllerHeaderControls = 'html body #app [data-yai-tabs] > [data-controller] > [data-open]:not(.active),html body #app [data-yai-tabs] > [data-module-actions] :is(button,a)'
  const mainNav = 'html body #app [data-yai-tabs] > [data-controller] > [data-open]:not(.active),html body #app [data-app-header-nav] > [data-dropdown] > [data-dropdown-trigger]'
  const mainNavActive = 'html body #app [data-yai-tabs] > [data-controller] > [data-open].active'
  const navHeader = 'html body #app [data-yai-tabs]:not([data-app]) > :is([data-controller],[data-module-actions])'
  const navHeaderControls = 'html body #app [data-yai-tabs]:not([data-app]) > [data-controller] > [data-open]:not(.active),html body #app [data-yai-tabs]:not([data-app]) > [data-module-actions] :is(button,a)'
  const nav = 'html body #app [data-yai-tabs]:not([data-app]) > [data-controller] > [data-open]:not(.active)'
  const navActive = 'html body #app [data-yai-tabs]:not([data-app]) > [data-controller] > [data-open].active'
  const moduleSurface = 'html body #app [data-module-tabs-shell] > [data-yai-tabs]'

  add(mainHeader, 'background-color', '--st-ws-shell-header-background-color')
  add(`${mainHeader},${mainHeaderControls}`, 'color', '--st-ws-shell-header-text-color')
  if (appearance['--st-ws-shell-header-background-color']) {
    rules.push(`${mainControllerHeader}{background-color:color-mix(in srgb, ${appearance['--st-ws-shell-header-background-color']} 80%, transparent) !important}`)
  }
  add(`${mainControllerHeader},${mainControllerHeaderControls}`, 'color', '--st-ws-shell-header-text-color')
  add(mainNav, 'background-color', '--st-ws-shell-nav-background-color')
  add(mainNav, 'color', '--st-ws-shell-nav-text-color')
  add(mainNavActive, 'background-color', '--st-ws-shell-nav-active-background-color')
  add(mainNavActive, 'color', '--st-ws-shell-nav-active-text-color')
  add(navHeader, 'background-color', '--st-nav-header-background-color')
  add(`${navHeader},${navHeaderControls}`, 'color', '--st-nav-header-text-color')
  add(nav, 'background-color', '--st-nav-background-color')
  add(nav, 'color', '--st-nav-text-color')
  add(navActive, 'background-color', '--st-nav-active-background-color')
  add(navActive, 'color', '--st-nav-active-text-color')
  add(moduleSurface, 'background-color', '--st-ws-module-background-color')

  const existing = document.getElementById(SHELL_APPEARANCE_OVERRIDE_STYLE_ID)
  if (!rules.length) {
    existing?.remove()
    return
  }
  const style = existing ?? document.head.appendChild(document.createElement('style'))
  style.id = SHELL_APPEARANCE_OVERRIDE_STYLE_ID
  style.textContent = rules.join('')
}

export function applyModuleUiConfig(moduleRoot, effectiveConfig) {
  if (!moduleRoot || !effectiveConfig) return

  const moduleType = moduleRoot.dataset.moduleType
  const spec = getUiConfigSpec('module', moduleType)
  moduleRoot.toggleAttribute('data-ui-configured', hasCustomUiConfig('module', moduleType, effectiveConfig))
  applySection(moduleRoot, effectiveConfig.behavior, spec.behavior)
  applySection(moduleRoot, effectiveConfig.layout, spec.layout)
  applySection(moduleRoot, effectiveConfig.appearance, spec.appearance)
  applyModuleSubtype(moduleRoot, effectiveConfig)

  const linkBehavior = effectiveConfig.behavior?.['link-behavior'] ?? 'default'
  if (isBookmarkModuleType(moduleType)) {
    applyLinkTarget(moduleRoot, linkBehavior)
  }
  applyInlineAddTileVisibility(moduleRoot, moduleType, effectiveConfig)
  if (isBookmarkModuleType(moduleType)) {
    const mediaScope = getVisibleBookmarkMediaScope(moduleRoot.querySelector?.('[data-yai-tabs]') ?? moduleRoot)
    if (mediaScope) initBookmarkMedia(mediaScope)
  }
}

export function applyShellUiConfig(effectiveConfig) {
  if (!effectiveConfig) return
  const shellRoot = document.querySelector('[data-app]')
  if (!shellRoot) return
  const spec = getUiConfigSpec('shell', 'app')
  shellRoot.toggleAttribute('data-ui-configured', hasCustomUiConfig('shell', 'app', effectiveConfig))
  applySection(shellRoot, effectiveConfig.behavior ?? {}, spec.behavior)
  applySection(shellRoot, effectiveConfig.layout ?? {}, spec.layout)
  const appearance = effectiveConfig.appearance ?? {}
  const inheritedAppearance = {...appearance}
  SHELL_DIRECT_APPEARANCE_KEYS.forEach((key) => {
    delete inheritedAppearance[key]
    const field = spec.appearance[key]
    const target = field ? getApplyTarget(shellRoot, field.target) : null
    if (field?.applyAs?.type === 'css-variable') target?.style.removeProperty(field.applyAs.name)
  })
  applySection(shellRoot, inheritedAppearance, spec.appearance)
  applyShellAppearanceOverrides(appearance)
  const borderRadius = effectiveConfig.layout?.['shell-border-radius-px']
  shellRoot.toggleAttribute('data-border-radius', borderRadius != null && borderRadius !== '')
}

export function applyModuleUiConfigMap(root, configMap) {
  if (!root || !configMap?.size) return

  const moduleRoots = []
  if (root.matches?.('[data-module-card][data-sync-id]')) {
    moduleRoots.push(root)
  }
  moduleRoots.push(...root.querySelectorAll('[data-module-card][data-sync-id]'))

  moduleRoots.forEach((moduleRoot) => {
    const config = configMap.get(moduleRoot.dataset.syncId)
    if (!config) return
    applyModuleUiConfig(moduleRoot, config)
  })
}
