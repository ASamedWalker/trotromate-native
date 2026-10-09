import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'

interface RouteEnds {
  from_station_id: string | null
  to_station_id: string | null
  from_location: string
  to_location: string
}

/**
 * "N lines" per station (redesign): routes that start or end there, by station id or,
 * for routes linked by name only, by exact name. One small cached query for all stations.
 */
export function useStationLineCounts() {
  const q = useQuery({
    queryKey: ['station-line-ends'],
    staleTime: 30 * 60 * 1000,
    queryFn: async (): Promise<RouteEnds[]> => {
      const { data, error } = await supabase
        .from('routes')
        .select('from_station_id, to_station_id, from_location, to_location')
        .limit(2000)
      if (error) throw error
      return (data ?? []) as RouteEnds[]
    },
  })
  const routes = q.data ?? []
  return (station: { id: string; name: string }): number | null => {
    if (!q.data) return null
    const name = station.name.trim().toLowerCase()
    let n = 0
    for (const r of routes) {
      if (r.from_station_id === station.id || r.to_station_id === station.id ||
          r.from_location.trim().toLowerCase() === name || r.to_location.trim().toLowerCase() === name) n++
    }
    return n
  }
}
