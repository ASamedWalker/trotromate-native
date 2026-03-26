import AsyncStorage from '@react-native-async-storage/async-storage'
import type { RouteWithStats } from '@/lib/types'
import type { StationWithQueue } from './stations'

const KEYS = {
  routes: '@troski_cache_routes',
  popularRoutes: '@troski_cache_popular_routes',
  stations: '@troski_cache_stations',
  timestamp: '@troski_cache_timestamp',
} as const

const MAX_CACHE_AGE_MS = 48 * 60 * 60 * 1000 // 48 hours

// ── Write ──

export async function cacheRoutes(routes: RouteWithStats[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.routes, JSON.stringify(routes))
    await AsyncStorage.setItem(KEYS.timestamp, Date.now().toString())
  } catch {
    // silent — caching is best-effort
  }
}

export async function cachePopularRoutes(routes: RouteWithStats[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.popularRoutes, JSON.stringify(routes))
  } catch {
    // silent
  }
}

export async function cacheStations(stations: StationWithQueue[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.stations, JSON.stringify(stations))
    await AsyncStorage.setItem(KEYS.timestamp, Date.now().toString())
  } catch {
    // silent
  }
}

// ── Read ──

export async function getCachedRoutes(): Promise<RouteWithStats[] | null> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.routes)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export async function getCachedPopularRoutes(): Promise<RouteWithStats[] | null> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.popularRoutes)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export async function getCachedStations(): Promise<StationWithQueue[] | null> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.stations)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

// ── Staleness ──

export async function getCacheAge(): Promise<number> {
  try {
    const ts = await AsyncStorage.getItem(KEYS.timestamp)
    return ts ? Date.now() - parseInt(ts, 10) : Infinity
  } catch {
    return Infinity
  }
}

export async function isCacheStale(): Promise<boolean> {
  const age = await getCacheAge()
  return age > MAX_CACHE_AGE_MS
}
