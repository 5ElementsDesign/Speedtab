import { describe, expect, it } from 'vitest'
import { UI_CONFIG_VERSION, getUiConfigDefaults } from '../config/ui-config-defaults.js'
import {
  getEffectiveUiConfig,
  hasCustomUiConfig,
  normalizeUiConfig,
} from '../features/customizer/normalize.js'

// Convenience shortcuts
const TYPE = 'module'
const SUBTYPE = 'tabs'

describe('getUiConfigDefaults', () => {
  it('returns tabs defaults for module/tabs', () => {
    const defaults = getUiConfigDefaults(TYPE, SUBTYPE)
    expect(defaults.behavior['module-tabs-color-accent']).toBe('secondary')
    expect(defaults.behavior['module-tabs-behavior']).toBe('zoom')
    expect(defaults.layout['module-column-span']).toBe(6)
  })

  it('returns empty sections for unknown entity type', () => {
    const defaults = getUiConfigDefaults('unknown', 'thing')
    expect(defaults.behavior).toEqual({})
    expect(defaults.layout).toEqual({})
    expect(defaults.appearance).toEqual({})
  })

  it('returns focused Speed Dial defaults without a column-span option', () => {
    const defaults = getUiConfigDefaults('module', 'speed-dial')
    expect(defaults.layout['speed-dial-tile-height-px']).toBe(132)
    expect(defaults.layout['speed-dial-content-align']).toBe('start')
    expect(defaults.layout['module-content-gap-px']).toBe(10)
    expect(defaults.layout['speed-dial-fill-height']).toBe(false)
    expect(defaults.layout['module-column-span']).toBeUndefined()
  })
})

describe('normalizeUiConfig', () => {
  it('returns empty sections when no config is provided', () => {
    const result = normalizeUiConfig(TYPE, SUBTYPE, {})
    expect(result.behavior).toEqual({})
    expect(result.layout).toEqual({})
    expect(result.appearance).toEqual({})
  })

  it('strips keys that equal their default value', () => {
    // The default for module-tabs-behavior is 'zoom' — storing 'zoom' is redundant
    const result = normalizeUiConfig(TYPE, SUBTYPE, {
      behavior: { 'module-tabs-behavior': 'zoom' },
    })
    expect(result.behavior['module-tabs-behavior']).toBeUndefined()
  })

  it('retains keys that differ from their default', () => {
    const result = normalizeUiConfig(TYPE, SUBTYPE, {
      behavior: { 'module-tabs-behavior': 'fade' },
    })
    expect(result.behavior['module-tabs-behavior']).toBe('fade')
  })

  it('rejects invalid enum values', () => {
    const result = normalizeUiConfig(TYPE, SUBTYPE, {
      behavior: { 'module-tabs-behavior': 'spin' }, // not a valid behavior
    })
    expect(result.behavior['module-tabs-behavior']).toBeUndefined()
  })

  it('rejects invalid boolean values', () => {
    const result = normalizeUiConfig(TYPE, SUBTYPE, {
      behavior: { 'module-hide-header': 'yes' }, // should be boolean
    })
    expect(result.behavior['module-hide-header']).toBeUndefined()
  })

  it('retains valid layout integers', () => {
    const result = normalizeUiConfig(TYPE, SUBTYPE, {
      layout: { 'module-column-span': 5 },
    })
    expect(result.layout['module-column-span']).toBe(5)
  })

  it('rejects layout integers out of allowed range', () => {
    const result = normalizeUiConfig(TYPE, SUBTYPE, {
      layout: { 'module-column-span': 99 }, // max is 12
    })
    expect(result.layout['module-column-span']).toBeUndefined()
  })

  it('ignores keys not in the spec', () => {
    const result = normalizeUiConfig(TYPE, SUBTYPE, {
      behavior: { 'totally-made-up': 'value' },
    })
    expect('totally-made-up' in result.behavior).toBe(false)
  })

  it('works with shell/app entity type', () => {
    const result = normalizeUiConfig('shell', 'app', {
      behavior: { 'shell-behavior': 'slide-up' },
      layout: { 'shell-max-width': 1200 },
    })
    expect(result.behavior['shell-behavior']).toBe('slide-up')
    expect(result.layout['shell-max-width']).toBe(1200)
  })

  it('accepts Speed Dial tile heights only within 100–300px', () => {
    expect(normalizeUiConfig('module', 'speed-dial', {
      layout: {'speed-dial-tile-height-px': 220},
    }).layout['speed-dial-tile-height-px']).toBe(220)

    expect(normalizeUiConfig('module', 'speed-dial', {
      layout: {'speed-dial-tile-height-px': 301},
    }).layout['speed-dial-tile-height-px']).toBeUndefined()
  })

  it('accepts only start, center, and end for Speed Dial content alignment', () => {
    expect(normalizeUiConfig('module', 'speed-dial', {
      layout: {'speed-dial-content-align': 'center'},
    }).layout['speed-dial-content-align']).toBe('center')

    expect(normalizeUiConfig('module', 'speed-dial', {
      layout: {'speed-dial-content-align': 'bottom'},
    }).layout['speed-dial-content-align']).toBeUndefined()
  })
})

describe('getEffectiveUiConfig', () => {
  it('returns defaults merged with empty stored config', () => {
    const effective = getEffectiveUiConfig(TYPE, SUBTYPE, {})
    expect(effective.version).toBe(UI_CONFIG_VERSION)
    expect(effective.behavior['module-tabs-behavior']).toBe('zoom')      // default
    expect(effective.behavior['module-tabs-color-accent']).toBe('secondary') // default
    expect(effective.layout['module-column-span']).toBe(6)               // default
  })

  it('overrides defaults with non-default stored values', () => {
    const effective = getEffectiveUiConfig(TYPE, SUBTYPE, {
      behavior: { 'module-tabs-behavior': 'fade' },
      layout: { 'module-column-span': 6 },
    })
    expect(effective.behavior['module-tabs-behavior']).toBe('fade')
    expect(effective.layout['module-column-span']).toBe(6)
    // other defaults remain
    expect(effective.behavior['module-tabs-color-accent']).toBe('secondary')
  })

  it('includes the correct version field', () => {
    const effective = getEffectiveUiConfig(TYPE, SUBTYPE, {})
    expect(effective.version).toBe(1)
  })
})

describe('hasCustomUiConfig', () => {
  it('returns false when config is empty', () => {
    expect(hasCustomUiConfig(TYPE, SUBTYPE, {})).toBe(false)
  })

  it('returns false when all stored values equal their defaults', () => {
    // Normalize strips defaults, so nothing remains
    expect(hasCustomUiConfig(TYPE, SUBTYPE, {
      behavior: { 'module-tabs-behavior': 'zoom' }, // default
    })).toBe(false)
  })

  it('returns true when at least one non-default value is stored', () => {
    expect(hasCustomUiConfig(TYPE, SUBTYPE, {
      behavior: { 'module-tabs-behavior': 'fade' },
    })).toBe(true)
  })

  it('returns true for non-default layout value', () => {
    expect(hasCustomUiConfig(TYPE, SUBTYPE, {
      layout: { 'module-column-span': 4 },
    })).toBe(true)
  })
})
