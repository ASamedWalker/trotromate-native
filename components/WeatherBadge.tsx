import { useState, useEffect } from 'react'
import { View, Text, useColorScheme } from 'react-native'
import { CloudRain, Sun, Cloud, CloudSun, CloudLightning, CloudDrizzle, Snowflake } from 'lucide-react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { c, themed, font } from '@/lib/theme'

interface WeatherData {
  temp: number
  condition: string
  description: string
  is_rain: boolean
}

const WEATHER_CACHE_KEY = 'troski-weather-cache'
const CACHE_TTL = 30 * 60 * 1000 // 30 min
const ACCRA_LAT = 5.6037
const ACCRA_LON = -0.187

const CONDITION_ICONS: Record<string, typeof Sun> = {
  Clear: Sun,
  Clouds: Cloud,
  Rain: CloudRain,
  Drizzle: CloudDrizzle,
  Thunderstorm: CloudLightning,
  Snow: Snowflake,
}

// Map WMO weather codes to conditions
function wmoToCondition(code: number): { condition: string; description: string; is_rain: boolean } {
  if (code <= 1) return { condition: 'Clear', description: 'clear sky', is_rain: false }
  if (code <= 3) return { condition: 'Clouds', description: 'cloudy', is_rain: false }
  if (code <= 48) return { condition: 'Clouds', description: 'fog', is_rain: false }
  if (code <= 57) return { condition: 'Drizzle', description: 'drizzle', is_rain: true }
  if (code <= 67) return { condition: 'Rain', description: 'rain', is_rain: true }
  if (code <= 77) return { condition: 'Snow', description: 'snow', is_rain: false }
  if (code <= 82) return { condition: 'Rain', description: 'rain showers', is_rain: true }
  if (code <= 86) return { condition: 'Snow', description: 'snow showers', is_rain: false }
  if (code <= 99) return { condition: 'Thunderstorm', description: 'thunderstorm', is_rain: true }
  return { condition: 'Clear', description: 'unknown', is_rain: false }
}

async function fetchWeatherData(): Promise<WeatherData | null> {
  // Check cache
  try {
    const cached = await AsyncStorage.getItem(WEATHER_CACHE_KEY)
    if (cached) {
      const parsed = JSON.parse(cached)
      if (Date.now() - parsed.timestamp < CACHE_TTL) {
        return parsed.data
      }
    }
  } catch {}

  // Open-Meteo: free, open-source, no API key needed
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${ACCRA_LAT}&longitude=${ACCRA_LON}&current=temperature_2m,weather_code`
    )
    if (!res.ok) return null

    const raw = await res.json()
    const current = raw.current
    const { condition, description, is_rain } = wmoToCondition(current.weather_code)

    const data: WeatherData = {
      temp: Math.round(current.temperature_2m),
      condition,
      description,
      is_rain,
    }

    // Cache
    await AsyncStorage.setItem(
      WEATHER_CACHE_KEY,
      JSON.stringify({ data, timestamp: Date.now() })
    )

    return data
  } catch {
    return null
  }
}

export function WeatherBadge() {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const t = themed(isDark)
  const [weather, setWeather] = useState<WeatherData | null>(null)

  useEffect(() => {
    fetchWeatherData().then(setWeather)
  }, [])

  if (!weather) return null

  const Icon = CONDITION_ICONS[weather.condition] || CloudSun

  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: isDark ? c.stone800 : c.stone100,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    }}>
      <Icon size={14} color={c.amber500} />
      <Text style={{ fontSize: 12, fontFamily: font.semibold, color: t.text }}>
        {weather.temp}°C
      </Text>
      <Text style={{ fontSize: 10, fontFamily: font.regular, color: t.textSecondary }}>
        Accra
      </Text>
    </View>
  )
}

export function WeatherRainAlert() {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const t = themed(isDark)
  const [weather, setWeather] = useState<WeatherData | null>(null)

  useEffect(() => {
    fetchWeatherData().then(setWeather)
  }, [])

  if (!weather?.is_rain) return null

  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginHorizontal: 20,
      marginTop: 12,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 16,
      backgroundColor: isDark ? 'rgba(14,165,233,0.12)' : 'rgba(14,165,233,0.06)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(14,165,233,0.2)' : 'rgba(14,165,233,0.12)',
    }}>
      <CloudRain size={16} color="#0ea5e9" />
      <Text style={{ flex: 1, fontSize: 12, fontFamily: font.medium, color: t.text }}>
        Rain in Accra — expect longer queues & higher fares
      </Text>
    </View>
  )
}
