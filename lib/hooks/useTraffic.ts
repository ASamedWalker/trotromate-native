import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { fetchRouteTraffic, fetchTrafficSummary } from '@/lib/services/traffic-api'

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
 * Fetches traffic info for a specific route.
 * Calls the PWA API first (refreshes Google Routes cache server-side).
 * Falls back to direct Supabase cache read on failure.
 */
export function useTrafficInfo(routeId: string | undefined) {
  return useQuery<TrafficInfo | null>({
    queryKey: ['traffic', routeId],
    queryFn: async () => {
      if (!routeId) return null

      // Try PWA API first — it refreshes the cache server-side
      const apiResult = await fetchRouteTraffic(routeId)
      if (apiResult && (apiResult.traffic_condition || apiResult.busyness?.confidence > 0)) {
        return apiResult
      }

      // Fallback: read Supabase cache directly + local busyness calc
      return fallbackTrafficInfo(routeId)
    },
    enabled: !!routeId,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  })
}

/**
 * Fetches traffic summary for popular routes.
 * Calls the PWA API first, falls back to direct Supabase cache read.
 */
export function useTrafficSummary() {
  return useQuery<TrafficSummaryRoute[]>({
    queryKey: ['traffic-summary'],
    queryFn: async () => {
      // Try PWA API first
      const apiResult = await fetchTrafficSummary()
      if (apiResult && apiResult.length > 0) {
        return apiResult
      }

      // Fallback: read Supabase cache directly
      return fallbackTrafficSummary()
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  })
}

// ── Fallbacks (original Supabase-only logic) ─────────────

async function fallbackTrafficInfo(routeId: string): Promise<TrafficInfo> {
  const { data: cached } = await supabase
    .from('traffic_cache')
    .select('*')
    .eq('route_id', routeId)
    .gt('expires_at', new Date().toISOString())
    .order('fetched_at', { ascending: false })
    .limit(1)
    .single()

  const { data: route } = await supabase
    .from('routes')
    .select('from_station_id, to_station_id')
    .eq('id', routeId)
    .single()

  const busyness = await computeBusyness(route, cached?.traffic_condition || null)

  if (!cached) {
    return {
      route_id: routeId,
      duration_in_traffic_mins: null,
      typical_duration_mins: null,
      traffic_condition: null,
      delay_mins: 0,
      busyness,
      fetched_at: null,
    }
  }

  return {
    route_id: routeId,
    duration_in_traffic_mins: cached.duration_in_traffic_mins,
    typical_duration_mins: cached.typical_duration_mins,
    traffic_condition: cached.traffic_condition as TrafficInfo['traffic_condition'],
    delay_mins: Math.max(0, (cached.duration_in_traffic_mins || 0) - (cached.typical_duration_mins || 0)),
    busyness,
    fetched_at: cached.fetched_at,
  }
}

async function fallbackTrafficSummary(): Promise<TrafficSummaryRoute[]> {
  const { data: routes } = await supabase
    .from('routes')
    .select('id, from_location, to_location, estimated_duration_mins')
    .eq('is_popular', true)
    .limit(10)

  if (!routes || routes.length === 0) return []

  const results: TrafficSummaryRoute[] = []

  for (const route of routes) {
    const { data: cached } = await supabase
      .from('traffic_cache')
      .select('*')
      .eq('route_id', route.id)
      .gt('expires_at', new Date().toISOString())
      .order('fetched_at', { ascending: false })
      .limit(1)
      .single()

    const busyness = await computeBusyness(
      { from_station_id: null, to_station_id: null },
      cached?.traffic_condition || null
    )

    results.push({
      route_id: route.id,
      from_location: route.from_location,
      to_location: route.to_location,
      estimated_duration_mins: route.estimated_duration_mins,
      duration_in_traffic_mins: cached?.duration_in_traffic_mins || null,
      traffic_condition: (cached?.traffic_condition as TrafficSummaryRoute['traffic_condition']) || null,
      delay_mins: cached
        ? Math.max(0, (cached.duration_in_traffic_mins || 0) - (cached.typical_duration_mins || 0))
        : 0,
      busyness,
    })
  }

  return results
}

// ── Helpers ──────────────────────────────────────────────

async function computeBusyness(
  route: { from_station_id: string | null; to_station_id: string | null } | null,
  trafficCondition: string | null
): Promise<{ level: 'low' | 'moderate' | 'busy' | 'very_busy'; confidence: number }> {
  let queueStatus: string | null = null
  let recentReports = 0

  if (route) {
    const stationIds = [route.from_station_id, route.to_station_id].filter(Boolean)
    if (stationIds.length > 0) {
      const { data: reports } = await supabase
        .from('queue_reports')
        .select('queue_status')
        .in('station_id', stationIds)
        .gt('reported_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
        .order('reported_at', { ascending: false })
        .limit(5)

      if (reports && reports.length > 0) {
        queueStatus = reports[0].queue_status
        recentReports = reports.length
      }
    }
  }

  const hourOfDay = new Date().getUTCHours() // Accra is UTC+0
  return computeBusynessScore(trafficCondition, queueStatus, recentReports, hourOfDay)
}

function computeBusynessScore(
  trafficCondition: string | null,
  queueStatus: string | null,
  recentReports: number,
  hourOfDay: number
): { level: 'low' | 'moderate' | 'busy' | 'very_busy'; confidence: number } {
  let score = 0
  let signals = 0

  if (trafficCondition) {
    signals++
    const trafficScores: Record<string, number> = { light: 0, moderate: 1, heavy: 2, severe: 3 }
    score += trafficScores[trafficCondition] ?? 1
  }

  if (queueStatus && queueStatus !== 'unknown') {
    signals++
    const queueScores: Record<string, number> = { empty: 0, short: 0.5, moderate: 1.5, long: 2.5, very_long: 3 }
    score += queueScores[queueStatus] ?? 1
  }

  signals++
  const isPeakMorning = hourOfDay >= 6 && hourOfDay <= 9
  const isPeakEvening = hourOfDay >= 16 && hourOfDay <= 19
  if (isPeakMorning || isPeakEvening) score += 2
  else if (hourOfDay >= 10 && hourOfDay <= 15) score += 1

  const normalized = signals > 0 ? score / signals : 0
  const confidence = Math.min(1, signals / 3)

  let level: 'low' | 'moderate' | 'busy' | 'very_busy'
  if (normalized <= 0.75) level = 'low'
  else if (normalized <= 1.5) level = 'moderate'
  else if (normalized <= 2.25) level = 'busy'
  else level = 'very_busy'

  return { level, confidence: Math.round(confidence * 100) / 100 }
}
