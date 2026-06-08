export type WidgetRailPosition = 'top' | 'bottom'
export type WidgetRailAlign = 'left' | 'center' | 'right'
export type WeatherWidgetProvider = 'open_meteo'
export type WeatherWidgetUnits = 'metric' | 'imperial'

export interface WeatherWidgetLocation {
  name: string
  country: string | null
  latitude: number
  longitude: number
  timezone: string | null
}

export interface WeatherWidgetConfig {
  enabled: boolean
  provider: WeatherWidgetProvider
  units: WeatherWidgetUnits
  refresh_interval_minutes: number
  display_label: string | null
  location: WeatherWidgetLocation | null
}

export interface WidgetSettings {
  rail_enabled: boolean
  rail_position: WidgetRailPosition
  rail_align: WidgetRailAlign
  weather: WeatherWidgetConfig
}

export interface WeatherWidgetCachePayload {
  provider: WeatherWidgetProvider
  units: WeatherWidgetUnits
  location_key: string
  fetched_at: number
  data: WeatherWidgetData
}

export interface WeatherWidgetData {
  location_label: string
  current_temperature: number
  temperature_unit_label: 'C' | 'F'
  condition_label: string
  condition_code: number
  is_day: boolean
  high_temperature: number | null
  low_temperature: number | null
  updated_at: number
}

export const DEFAULT_WIDGET_SETTINGS: WidgetSettings = {
  rail_enabled: false,
  rail_position: 'top',
  rail_align: 'left',
  weather: {
    enabled: false,
    provider: 'open_meteo',
    units: 'metric',
    refresh_interval_minutes: 30,
    display_label: null,
    location: null,
  },
}
