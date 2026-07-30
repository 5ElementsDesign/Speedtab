export type WidgetRailPosition = 'top' | 'bottom'
export type WidgetRailAlign = 'left' | 'center' | 'right' | 'space-between' | 'space-around'
export type ClockWidgetAlign = 'left' | 'right'
export type ClockWidgetDisplay = 'digital' | 'analog'
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
  compact_mode: boolean
  background: string | null
  shadow: string | null
  location_color: string | null
  temperature_color: string | null
  temperature_font_size: number | null
  muted_color: string | null
  location: WeatherWidgetLocation | null
}

export interface ClockWidgetConfig {
  enabled: boolean
  align: ClockWidgetAlign
  display: ClockWidgetDisplay
  smooth_motion: boolean
  two_row: boolean
  date_format: string
  time_format: string
  background: string | null
  shadow: string | null
  dial_color: string | null
  date_color: string | null
  time_color: string | null
  date_font_size: number | null
  time_font_size: number | null
}

export interface WidgetSettings {
  rail_enabled: boolean
  rail_position: WidgetRailPosition
  rail_align: WidgetRailAlign
  rail_ignore_max_width: boolean
  remote_sync_indicator: boolean
  weather: WeatherWidgetConfig
  clock: ClockWidgetConfig
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
  condition_code: number
  is_day: boolean
  high_temperature: number | null
  low_temperature: number | null
  daily_forecast: Array<{
    date: string
    condition_code: number
    high_temperature: number | null
    low_temperature: number | null
  }>
  updated_at: number
}

export const DEFAULT_CLOCK_DATE_FORMAT = '{dayName} [hr] {day}. {monthShort}'
export const DEFAULT_CLOCK_TIME_FORMAT = '{hour}:{minute}:{second}'

export const DEFAULT_CLOCK_WIDGET_SETTINGS: ClockWidgetConfig = {
  enabled: true,
  align: 'left',
  display: 'analog',
  smooth_motion: true,
  two_row: false,
  date_format: DEFAULT_CLOCK_DATE_FORMAT,
  time_format: DEFAULT_CLOCK_TIME_FORMAT,
  background: null,
  shadow: null,
  dial_color: null,
  date_color: null,
  time_color: null,
  date_font_size: 14,
  time_font_size: 20,
}

export const DEFAULT_WEATHER_WIDGET_SETTINGS: WeatherWidgetConfig = {
  enabled: true,
  provider: 'open_meteo',
  units: 'metric',
  refresh_interval_minutes: 120,
  display_label: null,
  compact_mode: false,
  background: null,
  shadow: null,
  location_color: null,
  temperature_color: null,
  temperature_font_size: 24,
  muted_color: null,
  location: null,
}

export const DEFAULT_WIDGET_SETTINGS: WidgetSettings = {
  rail_enabled: true,
  rail_position: 'bottom',
  rail_align: 'space-between',
  rail_ignore_max_width: false,
  remote_sync_indicator: false,
  weather: DEFAULT_WEATHER_WIDGET_SETTINGS,
  clock: DEFAULT_CLOCK_WIDGET_SETTINGS,
}
