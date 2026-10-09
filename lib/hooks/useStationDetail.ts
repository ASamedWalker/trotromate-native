import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { fetchStations, type QueueStatus, type StationWithQueue } from '@/lib/services/stations'

export interface StationLine {
  id: string
  from_location: string
  to_location: string
  official_fare: number | null
  is_gprtu_verified: boolean | null
}

export interface StationReport {
  id: string
  queue_status: QueueStatus
  reported_at: string
}

// PostgREST .or() filters are comma/paren separated; keep names to letters, digits and spaces.
const safe = (s: string) => s.replace(/[^A-Za-z0-9 ]/g, ' ').trim()

/** Station page data: the station (from the shared stations cache), lines that start or end here, last reports. */
export function useStationDetail(id: string | undefined) {
  const stations = useQuery({ queryKey: ['stations'], queryFn: fetchStations, staleTime: 2 * 60 * 1000, enabled: !!id })
  const station: StationWithQueue | undefined = stations.data?.find((s) => s.id === id)
  const name = station ? safe(station.name) : ''

  const lines = useQuery({
    queryKey: ['station-lines', id, name],
    enabled: !!id && !!station,
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<StationLine[]> => {
      const cols = 'id, from_location, to_location, official_fare, is_gprtu_verified'
      const byId = await supabase.from('routes').select(cols).or(`from_station_id.eq.${id},to_station_id.eq.${id}`).limit(30)
      if (byId.error) throw byId.error
      if ((byId.data ?? []).length > 0 || !name) return byId.data as StationLine[]
      // Many routes are linked by name only (from_station_id is nullable).
      const byName = await supabase.from('routes').select(cols).or(`from_location.ilike.%${name}%,to_location.ilike.%${name}%`).limit(30)
      if (byName.error) throw byName.error
      return (byName.data ?? []) as StationLine[]
    },
  })

  const reports = useQuery({
    queryKey: ['station-reports', id, name],
    enabled: !!id && !!station,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<StationReport[]> => {
      const filter = name ? `station_id.eq.${id},station_name.ilike.${name}` : `station_id.eq.${id}`
      const { data, error } = await supabase
        .from('queue_reports')
        .select('id, queue_status, reported_at')
        .or(filter)
        .order('reported_at', { ascending: false })
        .limit(5)
      if (error) throw error
      return (data ?? []) as StationReport[]
    },
  })

  return { station, isLoading: stations.isLoading, isError: stations.isError, lines, reports }
}
