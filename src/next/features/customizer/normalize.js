import {getUiConfigDefaults, UI_CONFIG_VERSION} from '../../config/ui-config-defaults.js'
import {getUiConfigSpec} from '../../config/ui-config-spec.js'

function cloneSections(source = {}) {
  const safeSource = source && typeof source === 'object' ? source : {}
  return {
    behavior: {...(safeSource.behavior ?? {})},
    layout: {...(safeSource.layout ?? {})},
    appearance: {...(safeSource.appearance ?? {})},
  }
}

function normalizeSection(sectionName, values, sectionSpec, sectionDefaults) {
  const normalized = {}
  const input = values && typeof values === 'object' ? values : {}

  for (const [key, spec] of Object.entries(sectionSpec)) {
    if (!(key in input)) continue

    const value = input[key]
    if (!spec.validate(value)) continue
    if (value === sectionDefaults[key]) continue
    if (value === '' && spec.defaultValue === '') continue

    normalized[key] = value
  }

  return normalized
}

export function normalizeUiConfig(entityType, entitySubtype, config = {}) {
  const defaults = cloneSections(getUiConfigDefaults(entityType, entitySubtype))
  const spec = getUiConfigSpec(entityType, entitySubtype)
  const input = cloneSections(config)

  return {
    behavior: normalizeSection('behavior', input.behavior, spec.behavior, defaults.behavior),
    layout: normalizeSection('layout', input.layout, spec.layout, defaults.layout),
    appearance: normalizeSection('appearance', input.appearance, spec.appearance, defaults.appearance),
  }
}

export function getEffectiveUiConfig(entityType, entitySubtype, config = {}) {
  const defaults = cloneSections(getUiConfigDefaults(entityType, entitySubtype))
  const normalized = normalizeUiConfig(entityType, entitySubtype, config)

  return {
    version: UI_CONFIG_VERSION,
    behavior: {...defaults.behavior, ...normalized.behavior},
    layout: {...defaults.layout, ...normalized.layout},
    appearance: {...defaults.appearance, ...normalized.appearance},
  }
}

export function hasCustomUiConfig(entityType, entitySubtype, config = {}) {
  const normalized = normalizeUiConfig(entityType, entitySubtype, config)
  return ['behavior', 'layout', 'appearance'].some((section) =>
    Object.keys(normalized[section] ?? {}).length > 0
  )
}
