import en from '@/locales/en'

export interface WeatherCodeMeta {
  label: string
  icon: string
}

export function getWeatherCodeMeta(code: number, isDay: boolean): WeatherCodeMeta {
  switch (code) {
    case 0:
      return isDay ? { label: en.weather.conditions.clearSky, icon: 'sun' } : { label: en.weather.conditions.clearNight, icon: 'moon' }
    case 1:
      return isDay ? { label: en.weather.conditions.mostlyClear, icon: 'sun-haze' } : { label: en.weather.conditions.mostlyClear, icon: 'moon-cloud' }
    case 2:
      return { label: en.weather.conditions.partlyCloudy, icon: 'cloud-sun' }
    case 3:
      return { label: en.weather.conditions.overcast, icon: 'cloud' }
    case 45:
    case 48:
      return { label: en.weather.conditions.fog, icon: 'fog' }
    case 51:
    case 53:
    case 55:
      return { label: en.weather.conditions.drizzle, icon: 'drizzle' }
    case 56:
    case 57:
      return { label: en.weather.conditions.freezingDrizzle, icon: 'sleet' }
    case 61:
    case 63:
    case 65:
      return { label: en.weather.conditions.rain, icon: 'rain' }
    case 66:
    case 67:
      return { label: en.weather.conditions.freezingRain, icon: 'sleet' }
    case 71:
    case 73:
    case 75:
    case 77:
      return { label: en.weather.conditions.snow, icon: 'snow' }
    case 80:
    case 81:
    case 82:
      return { label: en.weather.conditions.rainShowers, icon: 'showers' }
    case 85:
    case 86:
      return { label: en.weather.conditions.snowShowers, icon: 'snow' }
    case 95:
      return { label: en.weather.conditions.thunderstorm, icon: 'storm' }
    case 96:
    case 99:
      return { label: en.weather.conditions.stormWithHail, icon: 'storm' }
    default:
      return { label: en.weather.conditions.unavailableLabel, icon: 'cloud' }
  }
}
