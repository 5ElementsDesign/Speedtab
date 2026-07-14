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
  border: string | null
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
  border: string | null
  date_color: string | null
  time_color: string | null
  date_font_size: number | null
  time_font_size: number | null
}

export interface WidgetSettings {
  rail_enabled: boolean
  rail_position: WidgetRailPosition
  rail_align: WidgetRailAlign
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

export const DEFAULT_WIDGET_SETTINGS: WidgetSettings = {
  rail_enabled: true,
  rail_position: 'bottom',
  rail_align: 'left',
  remote_sync_indicator: false,
  weather: {
    enabled: false,
    provider: 'open_meteo',
    units: 'metric',
    refresh_interval_minutes: 30,
    display_label: null,
    compact_mode: false,
    background: '#00000030',
    border: '#3b383847',
    location_color: '#b6b9bc',
    temperature_color: '#d9dde2',
    temperature_font_size: 24,
    muted_color: '#b6b9bc',
    location: null,
  },
  clock: {
    enabled: true,
    align: 'right',
    display: 'analog',
    smooth_motion: true,
    two_row: false,
    date_format: '{dayName} [hr] {day}. {monthShort} {yearShort}',
    time_format: '{hour}:{minute}:{second}',
    background: '#00000030',
    border: '#3b383847',
    date_color: '#b6b9bc',
    time_color: '#d9dde2',
    date_font_size: 14,
    time_font_size: 20,
  },
}
