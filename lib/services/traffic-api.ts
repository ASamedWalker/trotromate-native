const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://www.troski.me'
const TIMEOUT_MS = 10_000

interface TrafficInfo {
  route_id: string
  duration_in_traffic_mins: number | null
  typical_duration_mins: number | null
  traffic_condition: 'light' | 'moderate' | 'heavy' | 'severe' | null
  delay_mins: number
  busyness: { level: 'low' | 'moderate' | 'busy' | 'very_busy'; confidence: number }
  fetched_at: string | null
}

interface TrafficSummaryRoute {
  route_id: string
  from_location: string
  to_location: string
  estimated_duration_mins: number | null
  duration_in_traffic_mins: number | null
  traffic_condition: 'light' | 'moderate' | 'heavy' | 'severe' | null
  delay_mins: number
  busyness: { level: 'low' | 'moderate' | 'busy' | 'very_busy'; confidence: number }
}

/**
 * Fetch traffic info for a route via the PWA API.
 * The PWA refreshes the Google Routes API cache server-side if expired.
 * Returns null on failure (caller should fall back to local data).
 */
export async function fetchRouteTraffic(routeId: string): Promise<TrafficInfo | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

    const res = await fetch(`${API_URL}/api/traffic/${routeId}`, {
      signal: controller.signal,
    })
    clearTimeout(timer)

    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

/**
 * Fetch traffic summary for popular routes via the PWA API.
 * Returns null on failure (caller should fall back to local data).
 */
export async function fetchTrafficSummary(): Promise<TrafficSummaryRoute[] | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

    const res = await fetch(`${API_URL}/api/traffic/summary`, {
      signal: controller.signal,
    })
    clearTimeout(timer)

    if (!res.ok) return null
    const data = await res.json()
    return data.routes || null
  } catch {
    return null
  }
}
