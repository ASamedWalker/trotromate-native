import { supabase } from '@/lib/supabase/client'
import type { Route, RouteWithStats, RouteFareStats, FareReport, TransportType } from '@/lib/types'

export async function fetchRoutes(from?: string, to?: string, transportType?: TransportType): Promise<RouteWithStats[]> {
  let query = supabase
    .from('routes')
    .select('*')
    .order('is_popular', { ascending: false })
    .order('from_location')

  if (from) query = query.ilike('from_location', `%${from}%`)
  if (to) query = query.ilike('to_location', `%${to}%`)
  if (transportType) query = query.eq('transport_type', transportType)

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

  const { data: reports } = await supabase
    .from('fare_reports')
    .select('*')
    .eq('route_id', id)
    .order('reported_at', { ascending: false })
    .limit(10)

  return {
    route: { ...route, fare_stats: fareStats || null },
    recentReports: reports || [],
  }
}

export async function findOrCreateRoute(
  fromLocation: string,
  toLocation: string,
  fare: number,
  transportType: TransportType = 'trotro'
): Promise<string | null> {
  const { data: existing } = await supabase
    .from('routes')
    .select('id')
    .eq('from_location', fromLocation)
    .eq('to_location', toLocation)
    .eq('transport_type', transportType)
    .single()

  if (existing) return existing.id

  const { data: newRoute, error } = await supabase
    .from('routes')
    .insert({
      from_location: fromLocation,
      to_location: toLocation,
      official_fare: fare,
      is_popular: false,
      transport_type: transportType,
    })
    .select('id')
    .single()

  if (error) {
    console.error('Error creating route:', error)
    return null
  }

  return newRoute?.id || null
}
