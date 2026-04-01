import { supabase } from '@/lib/supabase/client'
import type { Route, RouteWithStats, RouteFareStats, FareReport, RouteStop, TransportType } from '@/lib/types'
import { detectRegion } from '@/lib/config/regions'
import { validateGhanaLocation, validateFare, validateEnum, sanitizeString, TRANSPORT_TYPES } from '@/lib/security/validate'

export async function fetchRoutes(from?: string, to?: string, transportType?: TransportType, region?: string): Promise<RouteWithStats[]> {
  let query = supabase
    .from('routes')
    .select('*')
    .order('is_popular', { ascending: false })
    .order('from_location')

  // Sanitize search inputs to prevent injection via ilike patterns
  if (from) query = query.ilike('from_location', `%${sanitizeString(from, 200)}%`)
  if (to) query = query.ilike('to_location', `%${sanitizeString(to, 200)}%`)
  if (transportType) query = query.eq('transport_type', transportType)
  if (region) query = query.eq('region', region)

  const { data: routes, error } = await query
  if (error || !routes) return []

  const { data: fareStats } = await supabase.from('route_fare_stats').select('*')

  const routesWithStats = routes.map((route: Route) => ({
    ...route,
    fare_stats: fareStats?.find((fs: RouteFareStats) => fs.route_id === route.id) || null,
  }))

  // Sort: recently reported first, then popular, then alphabetical
  routesWithStats.sort((a, b) => {
    const aTime = a.fare_stats?.last_report_at ? new Date(a.fare_stats.last_report_at).getTime() : 0
    const bTime = b.fare_stats?.last_report_at ? new Date(b.fare_stats.last_report_at).getTime() : 0
    if (bTime !== aTime) return bTime - aTime
    if (a.is_popular !== b.is_popular) return a.is_popular ? -1 : 1
    return a.from_location.localeCompare(b.from_location)
  })

  return routesWithStats
}

export async function fetchPopularRoutes(): Promise<RouteWithStats[]> {
  // Get routes ranked by actual report count (most reported = most popular)
  const { data: fareStats } = await supabase
    .from('route_fare_stats')
    .select('*')
    .order('report_count', { ascending: false })
    .limit(10)

  if (!fareStats || fareStats.length === 0) return []

  const routeIds = fareStats.map((fs: RouteFareStats) => fs.route_id)

  const { data: routes, error } = await supabase
    .from('routes')
    .select('*')
    .in('id', routeIds)

  if (error || !routes) return []

  // Fetch cached traffic data for these routes
  const { data: trafficCache } = await supabase
    .from('traffic_cache')
    .select('route_id, duration_in_traffic_mins, traffic_condition')
    .in('route_id', routeIds)
    .gt('expires_at', new Date().toISOString())
    .order('fetched_at', { ascending: false })

  const trafficByRoute = new Map<string, { duration_in_traffic_mins: number; traffic_condition: string }>()
  for (const t of trafficCache || []) {
    if (!trafficByRoute.has(t.route_id)) {
      trafficByRoute.set(t.route_id, t)
    }
  }

  // Return routes ordered by report count (most reports first)
  return fareStats
    .map((fs: RouteFareStats) => {
      const route = routes.find((r: Route) => r.id === fs.route_id)
      if (!route) return null
      const tc = trafficByRoute.get(route.id)
      return {
        ...route,
        fare_stats: fs,
        traffic: tc ? {
          duration_in_traffic_mins: tc.duration_in_traffic_mins,
          traffic_condition: tc.traffic_condition as 'light' | 'moderate' | 'heavy' | 'severe',
          delay_mins: Math.max(0, (tc.duration_in_traffic_mins || 0) - (route.estimated_duration_mins || 0)),
        } : null,
      }
    })
    .filter(Boolean) as RouteWithStats[]
}

export async function fetchRouteById(
  id: string
): Promise<{ route: RouteWithStats; recentReports: FareReport[] } | null> {
  const { data: route, error } = await supabase
    .from('routes')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !route) return null

  const { data: fareStats } = await supabase
    .from('route_fare_stats')
    .select('*')
    .eq('route_id', id)
    .single()

  const [{ data: reports }, { data: stops }] = await Promise.all([
    supabase
      .from('fare_reports')
      .select('*')
      .eq('route_id', id)
      .order('reported_at', { ascending: false })
      .limit(10),
    supabase
      .from('route_stops')
      .select('*')
      .eq('route_id', id)
      .order('stop_order', { ascending: true }),
  ])

  return {
    route: {
      ...route,
      fare_stats: fareStats || null,
      stops: (stops as RouteStop[] | null) || [],
    },
    recentReports: reports || [],
  }
}

export async function fetchRoutesByIds(ids: string[]): Promise<RouteWithStats[]> {
  if (ids.length === 0) return []

  const [{ data: routes, error }, { data: fareStats }] = await Promise.all([
    supabase.from('routes').select('*').in('id', ids),
    supabase.from('route_fare_stats').select('*').in('route_id', ids),
  ])

  if (error || !routes) return []

  return routes.map((route: Route) => ({
    ...route,
    fare_stats: fareStats?.find((fs: RouteFareStats) => fs.route_id === route.id) || null,
  }))
}

export async function fetchFareTrend(
  routeId: string,
  days: number = 30
): Promise<{ day: string; avg_fare: number; min_fare: number; max_fare: number; report_count: number }[]> {
  const { data, error } = await supabase.rpc('get_fare_trend', {
    p_route_id: routeId,
    p_days: days,
  })

  if (error) {
    console.error('Error fetching fare trend:', error)
    return []
  }

  return (data || []).map((d: { day: string; avg_fare: number; min_fare: number; max_fare: number; report_count: number }) => ({
    day: d.day,
    avg_fare: Number(d.avg_fare),
    min_fare: Number(d.min_fare),
    max_fare: Number(d.max_fare),
    report_count: Number(d.report_count),
  }))
}

export async function findOrCreateRoute(
  fromLocation: string,
  toLocation: string,
  fare: number,
  transportType: TransportType = 'trotro',
  region?: string
): Promise<string | null> {
  const from = validateGhanaLocation(fromLocation)
  const to = validateGhanaLocation(toLocation)
  const validFare = validateFare(fare)
  const transport = validateEnum(transportType, TRANSPORT_TYPES) || 'trotro'

  if (!from || !to || validFare === null) {
    throw new Error(`Route validation failed: from=${!!from}, to=${!!to}, fare=${validFare}`)
  }

  const { data: existing, error: findError } = await supabase
    .from('routes')
    .select('id')
    .eq('from_location', from)
    .eq('to_location', to)
    .eq('transport_type', transport)
    .single()

  if (existing) return existing.id

  // Not found (PGRST116) is expected — create new route
  if (findError && findError.code !== 'PGRST116') {
    throw new Error(`Route lookup: ${findError.message}`)
  }

  const { data: newRoute, error } = await supabase
    .from('routes')
    .insert({
      from_location: from,
      to_location: to,
      official_fare: validFare,
      is_popular: false,
      transport_type: transport,
      region: region || detectRegion(from),
    })
    .select('id')
    .single()

  if (error) {
    throw new Error(`Route insert: ${error.message}`)
  }

  return newRoute?.id || null
}
