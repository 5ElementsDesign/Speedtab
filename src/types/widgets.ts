export type WidgetRailPosition = 'top' | 'bottom'
export type WidgetRailAlign = 'left' | 'center' | 'right'
export type ClockWidgetAlign = 'left' | 'right'
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

export interface ClockWidgetConfig {
  enabled: boolean
  align: ClockWidgetAlign
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
  rail_enabled: false,
  rail_position: 'bottom',
  rail_align: 'left',
  weather: {
    enabled: false,
    provider: 'open_meteo',
    units: 'metric',
    refresh_interval_minutes: 30,
    display_label: null,
    location: null,
  },
  clock: {
    enabled: false,
    align: 'right',
    two_row: true,
    date_format: '{shortDay}, {day}. {shortMonth} {shortYear}',
    time_format: '{hour}:{minute}:{second}',
    background: '#00000030',
    border: '#3b383847',
    date_color: '#b6b9bc',
    time_color: '#ffffff',
    date_font_size: 14,
    time_font_size: 18,
  },
}
