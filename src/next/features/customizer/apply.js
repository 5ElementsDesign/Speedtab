import {getUiConfigSpec} from '../../config/ui-config-spec.js'
import {getCachedAppSettings} from '../../data/app-settings.js'
import {getVisibleBookmarkMediaScope, initBookmarkMedia} from '../../utils/bookmark-media.js'
import {hasCustomUiConfig} from './normalize.js'

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

function getApplyTarget(moduleRoot, targetName) {
  if (targetName === 'grid-col') return moduleRoot.closest('[data-grid-col]')
  if (targetName === 'tabs-root') return moduleRoot.querySelector('[data-yai-tabs]')
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

export function applyModuleUiConfig(moduleRoot, effectiveConfig) {
  if (!moduleRoot || !effectiveConfig) return

  const moduleType = moduleRoot.dataset.moduleType
  if (moduleType !== 'tabs' && moduleType !== 'notes' && moduleType !== 'feeds') return

  const spec = getUiConfigSpec('module', moduleType)
  moduleRoot.toggleAttribute('data-ui-configured', hasCustomUiConfig('module', moduleType, effectiveConfig))
  applySection(moduleRoot, effectiveConfig.behavior, spec.behavior)
  applySection(moduleRoot, effectiveConfig.layout, spec.layout)
  applySection(moduleRoot, effectiveConfig.appearance, spec.appearance)
  applyModuleSubtype(moduleRoot, effectiveConfig)

  const linkBehavior = effectiveConfig.behavior?.['link-behavior'] ?? 'default'
  if (moduleType === 'tabs') {
    applyLinkTarget(moduleRoot, linkBehavior)
  }
  if (moduleType === 'tabs') {
    const mediaScope = getVisibleBookmarkMediaScope(moduleRoot.querySelector?.('[data-yai-tabs]') ?? moduleRoot)
    if (mediaScope) initBookmarkMedia(mediaScope, {force: true})
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
  applySection(shellRoot, effectiveConfig.appearance ?? {}, spec.appearance)


}

export function applyModuleUiConfigMap(root, configMap) {
  if (!root || !configMap?.size) return

  const moduleRoots = root.querySelectorAll('[data-module-card][data-sync-id]')
  moduleRoots.forEach((moduleRoot) => {
    const config = configMap.get(moduleRoot.dataset.syncId)
    if (!config) return
    applyModuleUiConfig(moduleRoot, config)
  })
}
