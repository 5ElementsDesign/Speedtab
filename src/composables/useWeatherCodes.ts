export interface WeatherCodeMeta {
  labelKey: string
  icon: string
}

export function getWeatherCodeMeta(code: number, isDay: boolean): WeatherCodeMeta {
  switch (code) {
    case 0:
      return isDay ? { labelKey: 'weather.conditions.clearSky', icon: 'sun' } : { labelKey: 'weather.conditions.clearNight', icon: 'moon' }
    case 1:
      return isDay ? { labelKey: 'weather.conditions.mostlyClear', icon: 'sun-haze' } : { labelKey: 'weather.conditions.mostlyClear', icon: 'moon-cloud' }
    case 2:
      return { labelKey: 'weather.conditions.partlyCloudy', icon: 'cloud-sun' }
    case 3:
      return { labelKey: 'weather.conditions.overcast', icon: 'cloud' }
    case 45:
    case 48:
      return { labelKey: 'weather.conditions.fog', icon: 'fog' }
    case 51:
    case 53:
    case 55:
      return { labelKey: 'weather.conditions.drizzle', icon: 'drizzle' }
    case 56:
    case 57:
      return { labelKey: 'weather.conditions.freezingDrizzle', icon: 'sleet' }
    case 61:
    case 63:
    case 65:
      return { labelKey: 'weather.conditions.rain', icon: 'rain' }
    case 66:
    case 67:
      return { labelKey: 'weather.conditions.freezingRain', icon: 'sleet' }
    case 71:
    case 73:
    case 75:
    case 77:
      return { labelKey: 'weather.conditions.snow', icon: 'snow' }
    case 80:
    case 81:
    case 82:
      return { labelKey: 'weather.conditions.rainShowers', icon: 'showers' }
    case 85:
    case 86:
      return { labelKey: 'weather.conditions.snowShowers', icon: 'snow' }
    case 95:
      return { labelKey: 'weather.conditions.thunderstorm', icon: 'storm' }
    case 96:
    case 99:
      return { labelKey: 'weather.conditions.stormWithHail', icon: 'storm' }
    default:
      return { labelKey: 'weather.conditions.unavailableLabel', icon: 'cloud' }
  }
}
