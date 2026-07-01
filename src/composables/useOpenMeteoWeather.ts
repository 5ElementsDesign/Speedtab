import type { WeatherWidgetCachePayload, WeatherWidgetConfig, WeatherWidgetData } from '@/types/widgets'
import { getLocale } from '../next/utils/i18n.js'

export interface OpenMeteoGeocodeResult {
  id: number
  name: string
  country: string | null
  latitude: number
  longitude: number
  timezone: string | null
}

export async function searchOpenMeteoLocations(
  query: string,
  signal?: AbortSignal,
): Promise<OpenMeteoGeocodeResult[]> {
  const trimmed = query.trim()
  if (trimmed.length < 2) return []

  const language = String(getLocale?.() || globalThis.navigator?.language || 'en')
    .slice(0, 2)
    .toLowerCase()
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search')
  url.searchParams.set('name', trimmed)
  url.searchParams.set('count', '5')
  url.searchParams.set('language', language)
  url.searchParams.set('format', 'json')

  const response = await fetch(url, { signal })
  if (!response.ok) {
    throw new Error(`Geocoding failed: ${response.status}`)
  }

  const payload = await response.json() as { results?: Array<Record<string, unknown>> }
  return (payload.results ?? [])
    .filter((entry) =>
      typeof entry.id === 'number' &&
      typeof entry.name === 'string' &&
      typeof entry.latitude === 'number' &&
      typeof entry.longitude === 'number',
    )
    .map((entry) => ({
      id: entry.id as number,
      name: entry.name as string,
      country: typeof entry.country === 'string' ? entry.country : null,
      latitude: entry.latitude as number,
      longitude: entry.longitude as number,
      timezone: typeof entry.timezone === 'string' ? entry.timezone : null,
    }))
}

function buildLocationLabel(config: WeatherWidgetConfig): string {
  if (config.display_label?.trim()) return config.display_label.trim()
  if (!config.location) return 'Unknown location'
  return config.location.country
    ? `${config.location.name}, ${config.location.country}`
    : config.location.name
}

export function makeWeatherLocationKey(config: WeatherWidgetConfig): string | null {
  if (!config.location) return null
  return [
    config.provider,
    config.units,
    config.location.latitude.toFixed(4),
    config.location.longitude.toFixed(4),
  ].join(':')
}

export async function fetchOpenMeteoWeather(
  config: WeatherWidgetConfig,
  signal?: AbortSignal,
): Promise<WeatherWidgetData> {
  if (!config.location) {
    throw new Error('Weather location is not configured')
  }

  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', String(config.location.latitude))
  url.searchParams.set('longitude', String(config.location.longitude))
  url.searchParams.set('current', 'temperature_2m,is_day,weather_code')
  url.searchParams.set('daily', 'weather_code,temperature_2m_max,temperature_2m_min')
  url.searchParams.set('timezone', 'auto')
  if (config.units === 'imperial') {
    url.searchParams.set('temperature_unit', 'fahrenheit')
  }

  const response = await fetch(url, { signal })
  if (!response.ok) {
    throw new Error(`Weather request failed: ${response.status}`)
  }

  const payload = await response.json() as {
    current?: {
      temperature_2m?: number
      is_day?: number
      weather_code?: number
      time?: string
    }
    daily?: {
      time?: string[]
      weather_code?: number[]
      temperature_2m_max?: number[]
      temperature_2m_min?: number[]
    }
  }

  const current = payload.current
  const daily = payload.daily
  if (
    typeof current?.temperature_2m !== 'number' ||
    typeof current?.is_day !== 'number' ||
    typeof current?.weather_code !== 'number'
  ) {
    throw new Error('Weather response is incomplete')
  }

  const isDay = current.is_day === 1
  const forecastDates = Array.isArray(daily?.time) ? daily.time : []
  const forecastCodes = Array.isArray(daily?.weather_code) ? daily.weather_code : []
  const forecastHighs = Array.isArray(daily?.temperature_2m_max) ? daily.temperature_2m_max : []
  const forecastLows = Array.isArray(daily?.temperature_2m_min) ? daily.temperature_2m_min : []

  return {
    location_label: buildLocationLabel(config),
    current_temperature: current.temperature_2m,
    temperature_unit_label: config.units === 'imperial' ? 'F' : 'C',
    condition_code: current.weather_code,
    is_day: isDay,
    high_temperature: Array.isArray(daily?.temperature_2m_max) && typeof daily.temperature_2m_max[0] === 'number'
      ? daily.temperature_2m_max[0]
      : null,
    low_temperature: Array.isArray(daily?.temperature_2m_min) && typeof daily.temperature_2m_min[0] === 'number'
      ? daily.temperature_2m_min[0]
      : null,
    daily_forecast: forecastDates.map((date, index) => ({
      date,
      condition_code: typeof forecastCodes[index] === 'number' ? forecastCodes[index] : -1,
      high_temperature: typeof forecastHighs[index] === 'number' ? forecastHighs[index] : null,
      low_temperature: typeof forecastLows[index] === 'number' ? forecastLows[index] : null,
    })),
    updated_at: current.time ? Date.parse(current.time) : Date.now(),
  }
}

export function isWeatherCacheUsable(
  cache: WeatherWidgetCachePayload | null,
  config: WeatherWidgetConfig,
): cache is WeatherWidgetCachePayload {
  if (!cache) return false
  const locationKey = makeWeatherLocationKey(config)
  if (!locationKey) return false
  return cache.provider === config.provider &&
    cache.units === config.units &&
    cache.location_key === locationKey
}
