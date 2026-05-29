const presetThemeModules = import.meta.glob('./assets/theme/preset/*.css', { eager: true })

function themeNameFromPath(path: string): string {
  return path.split('/').pop()?.replace(/\.css$/i, '') ?? ''
}

function themeLabelFromName(name: string): string {
  return name
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export const DEFAULT_THEME_PRESET = 'dark'

export const THEME_PRESET_VALUES = Object.keys(presetThemeModules)
  .map(themeNameFromPath)
  .filter(Boolean)
  .sort((a, b) => {
    if (a === DEFAULT_THEME_PRESET) return -1
    if (b === DEFAULT_THEME_PRESET) return 1
    return a.localeCompare(b)
  })

const THEME_PRESET_SET = new Set(THEME_PRESET_VALUES)

export const THEME_PRESETS = THEME_PRESET_VALUES.map((value) => ({
  value,
  label: themeLabelFromName(value),
}))

export function normalizeThemePreset(value: unknown): string {
  return typeof value === 'string' && THEME_PRESET_SET.has(value)
    ? value
    : DEFAULT_THEME_PRESET
}

export function isThemePreset(value: unknown): value is string {
  return typeof value === 'string' && THEME_PRESET_SET.has(value)
}
