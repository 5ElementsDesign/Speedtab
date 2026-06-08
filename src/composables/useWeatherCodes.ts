export interface WeatherCodeMeta {
  label: string
  icon: string
}

export function getWeatherCodeMeta(code: number, isDay: boolean): WeatherCodeMeta {
  switch (code) {
    case 0:
      return isDay ? { label: 'Clear sky', icon: 'sun' } : { label: 'Clear night', icon: 'moon' }
    case 1:
      return isDay ? { label: 'Mostly clear', icon: 'sun-haze' } : { label: 'Mostly clear', icon: 'moon-cloud' }
    case 2:
      return { label: 'Partly cloudy', icon: 'cloud-sun' }
    case 3:
      return { label: 'Overcast', icon: 'cloud' }
    case 45:
    case 48:
      return { label: 'Fog', icon: 'fog' }
    case 51:
    case 53:
    case 55:
      return { label: 'Drizzle', icon: 'drizzle' }
    case 56:
    case 57:
      return { label: 'Freezing drizzle', icon: 'sleet' }
    case 61:
    case 63:
    case 65:
      return { label: 'Rain', icon: 'rain' }
    case 66:
    case 67:
      return { label: 'Freezing rain', icon: 'sleet' }
    case 71:
    case 73:
    case 75:
    case 77:
      return { label: 'Snow', icon: 'snow' }
    case 80:
    case 81:
    case 82:
      return { label: 'Rain showers', icon: 'showers' }
    case 85:
    case 86:
      return { label: 'Snow showers', icon: 'snow' }
    case 95:
      return { label: 'Thunderstorm', icon: 'storm' }
    case 96:
    case 99:
      return { label: 'Storm with hail', icon: 'storm' }
    default:
      return { label: 'Weather unavailable', icon: 'cloud' }
  }
}
