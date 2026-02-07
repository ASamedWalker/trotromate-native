import { supabase } from '@/lib/supabase/client'
import type { Route, RouteWithStats, RouteFareStats, FareReport } from '@/lib/types'

export async function fetchRoutes(from?: string, to?: string): Promise<RouteWithStats[]> {
  let query = supabase
    .from('routes')
    .select('*')
    .order('is_popular', { ascending: false })
    .order('from_location')

  if (from) query = query.ilike('from_location', `%${from}%`)
  if (to) query = query.ilike('to_location', `%${to}%`)

  const { data: routes, error } = await query
  if (error || !routes) return []

  const { data: fareStats } = await supabase.from('route_fare_stats').select('*')

  return routes.map((route: Route) => ({
    ...route,
    fare_stats: fareStats?.find((fs: RouteFareStats) => fs.route_id === route.id) || null,
  }))
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

  // Return routes ordered by report count (most reports first)
  return fareStats
    .map((fs: RouteFareStats) => {
      const route = routes.find((r: Route) => r.id === fs.route_id)
      if (!route) return null
      return { ...route, fare_stats: fs }
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
  fare: number
): Promise<string | null> {
  const { data: existing } = await supabase
    .from('routes')
    .select('id')
    .eq('from_location', fromLocation)
    .eq('to_location', toLocation)
    .single()

  if (existing) return existing.id

  const { data: newRoute, error } = await supabase
    .from('routes')
    .insert({
      from_location: fromLocation,
      to_location: toLocation,
      official_fare: fare,
      is_popular: false,
    })
    .select('id')
    .single()

  if (error) {
    console.error('Error creating route:', error)
    return null
  }

  return newRoute?.id || null
}
