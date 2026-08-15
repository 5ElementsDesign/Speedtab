import { db as defaultDb, type SpeedtabDB } from '@/db/db'
import { DEFAULT_WIDGET_SETTINGS, type ClockWidgetConfig, type WeatherWidgetConfig, type WeatherWidgetLocation, type WidgetSettings } from '@/types/widgets'

export const WIDGET_SETTINGS_KEY = 'widget_settings'

const LEGACY_WIDGET_DEFAULTS = {
  background: '#00000030',
  shadow: 'rgb(0 0 0 / 0.22)',
  muted: '#b6b9bc',
  text: '#d9dde2',
} as const

function normalizeThemeColorOverride(input: unknown, fallback: string | null): string | null {
  if (typeof input !== 'string') return fallback
  const trimmed = input.trim()
  if (!trimmed) return fallback
  if (
    trimmed === LEGACY_WIDGET_DEFAULTS.background
    || trimmed === LEGACY_WIDGET_DEFAULTS.shadow
    || trimmed === LEGACY_WIDGET_DEFAULTS.muted
    || trimmed === LEGACY_WIDGET_DEFAULTS.text
  ) {
    return null
  }
  return trimmed
}

function normalizeLocation(value: unknown): WeatherWidgetLocation | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Record<string, unknown>
  if (typeof candidate.name !== 'string') return null
  if (typeof candidate.latitude !== 'number' || typeof candidate.longitude !== 'number') return null
  return {
    name: candidate.name,
    country: typeof candidate.country === 'string' ? candidate.country : null,
    latitude: candidate.latitude,
    longitude: candidate.longitude,
    timezone: typeof candidate.timezone === 'string' ? candidate.timezone : null,
  }
}

function normalizeWeatherConfig(value: unknown): WeatherWidgetConfig {
  if (!value || typeof value !== 'object') return { ...DEFAULT_WIDGET_SETTINGS.weather }
  const candidate = value as Record<string, unknown>
  const defaultWeather = DEFAULT_WIDGET_SETTINGS.weather
  const normalizeSize = (input: unknown, fallback: number): number => {
    const parsed = Number(input)
    if (!Number.isFinite(parsed)) return fallback
    return Math.max(8, Math.min(96, parsed))
  }
  return {
    enabled: candidate.enabled === true,
    provider: candidate.provider === 'open_meteo' ? candidate.provider : 'open_meteo',
    units: candidate.units === 'imperial' ? 'imperial' : 'metric',
    refresh_interval_minutes: [10, 15, 30, 60, 120, 360].includes(Number(candidate.refresh_interval_minutes))
      ? Number(candidate.refresh_interval_minutes)
      : defaultWeather.refresh_interval_minutes,
    display_label: typeof candidate.display_label === 'string' && candidate.display_label.trim()
      ? candidate.display_label.trim()
      : null,
    compact_mode: typeof candidate.compact_mode === 'boolean'
      ? candidate.compact_mode
      : defaultWeather.compact_mode,
    background: normalizeThemeColorOverride(candidate.background, defaultWeather.background),
    shadow: normalizeThemeColorOverride(candidate.shadow ?? candidate.border, defaultWeather.shadow),
    location_color: normalizeThemeColorOverride(candidate.location_color, defaultWeather.location_color),
    temperature_color: normalizeThemeColorOverride(candidate.temperature_color, defaultWeather.temperature_color),
    temperature_font_size: normalizeSize(candidate.temperature_font_size, defaultWeather.temperature_font_size ?? 24),
    muted_color: normalizeThemeColorOverride(candidate.muted_color, defaultWeather.muted_color),
    location: normalizeLocation(candidate.location),
  }
}

function normalizeClockConfig(value: unknown): ClockWidgetConfig {
  if (!value || typeof value !== 'object') return { ...DEFAULT_WIDGET_SETTINGS.clock }
  const candidate = value as Record<string, unknown>
  const defaultClock = DEFAULT_WIDGET_SETTINGS.clock
  const normalizeSize = (input: unknown, fallback: number): number => {
    const parsed = Number(input)
    if (!Number.isFinite(parsed)) return fallback
    return Math.max(8, Math.min(96, parsed))
  }
  const normalizeFormat = (input: unknown, fallback: string): string => {
    if (typeof input !== 'string') return fallback
    const trimmed = input.replace(/\r\n/g, '\n').trim()
    return trimmed || fallback
  }

  return {
    enabled: candidate.enabled === true,
    align: candidate.align === 'left' ? 'left' : defaultClock.align,
    display: candidate.display === 'analog' || candidate.display === 'digital'
      ? candidate.display
      : defaultClock.display,
    smooth_motion: typeof candidate.smooth_motion === 'boolean'
      ? candidate.smooth_motion
      : defaultClock.smooth_motion,
    two_row: typeof candidate.two_row === 'boolean'
      ? candidate.two_row
      : defaultClock.two_row,
    date_format: normalizeFormat(candidate.date_format, defaultClock.date_format ?? ''),
    time_format: normalizeFormat(candidate.time_format, defaultClock.time_format ?? ''),
    background: normalizeThemeColorOverride(candidate.background, defaultClock.background),
    shadow: normalizeThemeColorOverride(candidate.shadow ?? candidate.border, defaultClock.shadow),
    dial_color: normalizeThemeColorOverride(candidate.dial_color, defaultClock.dial_color),
    date_color: normalizeThemeColorOverride(candidate.date_color, defaultClock.date_color),
    time_color: normalizeThemeColorOverride(candidate.time_color, defaultClock.time_color),
    date_font_size: normalizeSize(candidate.date_font_size, defaultClock.date_font_size || 14),
    time_font_size: normalizeSize(candidate.time_font_size, defaultClock.time_font_size || 18),
  }
}

export function parseWidgetSettings(valueJson: string | null | undefined): WidgetSettings {
  if (!valueJson) return structuredClone(DEFAULT_WIDGET_SETTINGS)
  try {
    const parsed = JSON.parse(valueJson) as Record<string, unknown>
    const railAlignOptions = new Set(['left', 'center', 'right', 'space-between', 'space-around'])
    const defaultSettings = DEFAULT_WIDGET_SETTINGS
    return {
      rail_enabled: parsed.rail_enabled === true,
      rail_position: parsed.rail_position === 'top' || parsed.rail_position === 'bottom'
        ? parsed.rail_position
        : defaultSettings.rail_position,
      rail_align: railAlignOptions.has(String(parsed.rail_align))
        ? parsed.rail_align as WidgetSettings['rail_align']
        : defaultSettings.rail_align,
      rail_ignore_max_width: parsed.rail_ignore_max_width === true,
      remote_sync_indicator: parsed.remote_sync_indicator === true,
      weather: normalizeWeatherConfig(parsed.weather),
      clock: normalizeClockConfig(parsed.clock),
    }
  } catch {
    return structuredClone(DEFAULT_WIDGET_SETTINGS)
  }
}

export async function getWidgetSettings(database: SpeedtabDB = defaultDb): Promise<WidgetSettings> {
  const setting = await database.app_settings.get(WIDGET_SETTINGS_KEY)
  return parseWidgetSettings(setting?.value_json)
}

export async function saveWidgetSettings(settings: WidgetSettings, database: SpeedtabDB = defaultDb): Promise<void> {
  await database.app_settings.put({
    key: WIDGET_SETTINGS_KEY,
    value_json: JSON.stringify(settings),
    updated_at: Date.now(),
  })
}
