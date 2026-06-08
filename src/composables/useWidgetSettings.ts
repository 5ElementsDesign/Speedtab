import { db as defaultDb, type SpeedtabDB } from '@/db/db'
import { DEFAULT_WIDGET_SETTINGS, type WeatherWidgetConfig, type WeatherWidgetLocation, type WidgetSettings } from '@/types/widgets'

export const WIDGET_SETTINGS_KEY = 'widget_settings'

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
  return {
    enabled: candidate.enabled === true,
    provider: candidate.provider === 'open_meteo' ? candidate.provider : 'open_meteo',
    units: candidate.units === 'imperial' ? 'imperial' : 'metric',
    refresh_interval_minutes: [10, 15, 30, 60, 120, 360].includes(Number(candidate.refresh_interval_minutes))
      ? Number(candidate.refresh_interval_minutes)
      : 30,
    display_label: typeof candidate.display_label === 'string' && candidate.display_label.trim()
      ? candidate.display_label.trim()
      : null,
    location: normalizeLocation(candidate.location),
  }
}

export function parseWidgetSettings(valueJson: string | null | undefined): WidgetSettings {
  if (!valueJson) return structuredClone(DEFAULT_WIDGET_SETTINGS)
  try {
    const parsed = JSON.parse(valueJson) as Record<string, unknown>
    return {
      rail_enabled: parsed.rail_enabled === true,
      rail_position: parsed.rail_position === 'bottom' ? 'bottom' : 'top',
      rail_align: parsed.rail_align === 'center' || parsed.rail_align === 'right' ? parsed.rail_align : 'left',
      weather: normalizeWeatherConfig(parsed.weather),
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
