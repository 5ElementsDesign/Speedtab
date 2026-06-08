import type { WeatherWidgetCachePayload } from '@/types/widgets'

const WEATHER_WIDGET_API_KEY_KEY = 'widget_weather_api_key'
const WEATHER_WIDGET_CACHE_KEY = 'widget_weather_cache_v1'

type StorageAreaLike = Pick<chrome.storage.StorageArea, 'get' | 'set' | 'remove'>

function getStorageArea(): StorageAreaLike {
  const storageArea = globalThis.chrome?.storage?.local
  if (!storageArea) {
    throw new Error('chrome.storage.local is unavailable')
  }
  return storageArea
}

function getChromeRuntimeError(): Error | null {
  const message = globalThis.chrome?.runtime?.lastError?.message
  return message ? new Error(message) : null
}

function storageGet(area: StorageAreaLike, keys: readonly string[]): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    area.get([...keys], (items) => {
      const error = getChromeRuntimeError()
      if (error) {
        reject(error)
        return
      }
      resolve(items as Record<string, unknown>)
    })
  })
}

function storageSet(area: StorageAreaLike, values: Record<string, unknown>): Promise<void> {
  return new Promise((resolve, reject) => {
    area.set(values, () => {
      const error = getChromeRuntimeError()
      if (error) {
        reject(error)
        return
      }
      resolve()
    })
  })
}

function storageRemove(area: StorageAreaLike, keys: readonly string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    area.remove([...keys], () => {
      const error = getChromeRuntimeError()
      if (error) {
        reject(error)
        return
      }
      resolve()
    })
  })
}

function parseCachePayload(value: unknown): WeatherWidgetCachePayload | null {
  if (typeof value !== 'string') return null
  try {
    const parsed = JSON.parse(value) as WeatherWidgetCachePayload
    if (!parsed || typeof parsed !== 'object') return null
    if (parsed.provider !== 'open_meteo') return null
    if (parsed.units !== 'metric' && parsed.units !== 'imperial') return null
    if (typeof parsed.location_key !== 'string' || typeof parsed.fetched_at !== 'number') return null
    if (!parsed.data || typeof parsed.data !== 'object') return null
    return parsed
  } catch {
    return null
  }
}

export async function getWeatherWidgetApiKey(area: StorageAreaLike = getStorageArea()): Promise<string | null> {
  const stored = await storageGet(area, [WEATHER_WIDGET_API_KEY_KEY])
  return typeof stored[WEATHER_WIDGET_API_KEY_KEY] === 'string'
    ? stored[WEATHER_WIDGET_API_KEY_KEY] as string
    : null
}

export async function setWeatherWidgetApiKey(value: string | null, area: StorageAreaLike = getStorageArea()): Promise<void> {
  const trimmed = value?.trim() ?? ''
  if (!trimmed) {
    await storageRemove(area, [WEATHER_WIDGET_API_KEY_KEY])
    return
  }
  await storageSet(area, { [WEATHER_WIDGET_API_KEY_KEY]: trimmed })
}

export async function getWeatherWidgetCache(area: StorageAreaLike = getStorageArea()): Promise<WeatherWidgetCachePayload | null> {
  const stored = await storageGet(area, [WEATHER_WIDGET_CACHE_KEY])
  return parseCachePayload(stored[WEATHER_WIDGET_CACHE_KEY])
}

export async function setWeatherWidgetCache(payload: WeatherWidgetCachePayload, area: StorageAreaLike = getStorageArea()): Promise<void> {
  await storageSet(area, { [WEATHER_WIDGET_CACHE_KEY]: JSON.stringify(payload) })
}

export async function clearWeatherWidgetCache(area: StorageAreaLike = getStorageArea()): Promise<void> {
  await storageRemove(area, [WEATHER_WIDGET_CACHE_KEY])
}
