import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import type { RouteStop } from '@/lib/types'

interface RouteLineData {
  routeId: string
  stops: RouteStop[]
}

/**
 * Fetches all route_stops and builds GeoJSON for the homepage map.
 * Returns polylines (one per route) and stop dots.
 */
export function useRouteStopsMap() {
  const { data: routeLines = [] } = useQuery<RouteLineData[]>({
    queryKey: ['route-stops-map'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('route_stops')
        .select('*')
        .order('route_id')
        .order('stop_order', { ascending: true })

      if (error || !data) return []

      // Group by route_id
      const grouped = new Map<string, RouteStop[]>()
      for (const stop of data as RouteStop[]) {
        const existing = grouped.get(stop.route_id)
        if (existing) existing.push(stop)
        else grouped.set(stop.route_id, [stop])
      }

      return Array.from(grouped.entries())
        .filter(([, stops]) => stops.length >= 2)
        .map(([routeId, stops]) => ({ routeId, stops }))
    },
    staleTime: 10 * 60 * 1000, // 10 minutes — route stops don't change often
  })

  // Route polylines GeoJSON
  const linesGeoJSON = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: routeLines.map(({ routeId, stops }) => ({
      type: 'Feature' as const,
      properties: { routeId },
      geometry: {
        type: 'LineString' as const,
        coordinates: stops.map(s => [s.longitude, s.latitude]),
      },
    })),
  }), [routeLines])

  // All stop dots GeoJSON
  const stopsGeoJSON = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: routeLines.flatMap(({ stops }) =>
      stops.map(stop => ({
        type: 'Feature' as const,
        properties: {
          name: stop.stop_name,
          isTerminal: stop.is_terminal,
        },
        geometry: {
          type: 'Point' as const,
          coordinates: [stop.longitude, stop.latitude],
        },
      }))
    ),
  }), [routeLines])

  return { linesGeoJSON, stopsGeoJSON, routeCount: routeLines.length }
}
