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

  // Fetch from OpenWeatherMap directly (free tier)
  const apiKey = process.env.EXPO_PUBLIC_OPENWEATHERMAP_API_KEY
  if (!apiKey) return null

  try {
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${ACCRA_LAT}&lon=${ACCRA_LON}&units=metric&appid=${apiKey}`
    )
    if (!res.ok) return null

    const raw = await res.json()
    const data: WeatherData = {
      temp: Math.round(raw.main.temp),
      condition: raw.weather[0]?.main || 'Clear',
      description: raw.weather[0]?.description || '',
      is_rain: ['Rain', 'Drizzle', 'Thunderstorm'].includes(raw.weather[0]?.main),
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
