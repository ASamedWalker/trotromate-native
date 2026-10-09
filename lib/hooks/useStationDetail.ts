import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { fetchStations, type QueueStatus, type StationWithQueue } from '@/lib/services/stations'

export interface StationLine {
  id: string
  from_station_id: string | null
  to_station_id: string | null
  from_location: string
  to_location: string
  official_fare: number | null
  is_gprtu_verified: boolean | null
}

export interface StationReport {
  id: string
  queue_status: QueueStatus
  reported_at: string
  source?: 'rider' | 'reporter' | 'whatsapp'
}

// PostgREST .or() filters are comma/paren separated; keep names to letters, digits and spaces.
const safe = (s: string) => s.replace(/[^A-Za-z0-9 ]/g, ' ').trim()

/** Station page data: the station (from the shared stations cache), lines that start or end here, last reports. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function useStationDetail(rawId: string | undefined) {
  // Deep links can carry anything; only a uuid ever reaches a PostgREST filter.
  const id = rawId && UUID.test(rawId) ? rawId : undefined
  const stations = useQuery({ queryKey: ['stations'], queryFn: fetchStations, staleTime: 2 * 60 * 1000, enabled: !!id })
  const station: StationWithQueue | undefined = stations.data?.find((s) => s.id === id)
  const name = station ? safe(station.name) : ''

  const lines = useQuery({
    queryKey: ['station-lines', id, name],
    enabled: !!id && !!station,
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<StationLine[]> => {
      const cols = 'id, from_station_id, to_station_id, from_location, to_location, official_fare, is_gprtu_verified'
      const byId = await supabase.from('routes').select(cols).or(`from_station_id.eq.${id},to_station_id.eq.${id}`).limit(30)
      if (byId.error) throw byId.error
      if ((byId.data ?? []).length > 0 || !name) return byId.data as StationLine[]
      // Many routes are linked by name only (from_station_id is nullable).
      const byName = await supabase.from('routes').select(cols).or(`from_location.ilike.${name}*,to_location.ilike.${name}*`).limit(30)
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
      const run = (cols: string) => supabase
        .from('queue_reports')
        .select(cols)
        .or(filter)
        .order('reported_at', { ascending: false })
        .limit(5)
      // `source` arrives with web migration 100; before that, read without it.
      let res = await run('id, queue_status, reported_at, source')
      if (res.error) res = await run('id, queue_status, reported_at')
      if (res.error) throw res.error
      return (res.data ?? []) as unknown as StationReport[]
    },
  })

  // "Still like this? Confirm" targets the newest report while it is under 2 h old (migration 100).
  const latest = reports.data?.[0]
  const latestFresh = latest && Date.now() - new Date(latest.reported_at).getTime() < 2 * 60 * 60 * 1000 ? latest : undefined
  const confirmations = useQuery({
    queryKey: ['queue-confirmations', latestFresh?.id],
    enabled: !!latestFresh,
    staleTime: 30 * 1000,
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase.rpc('queue_confirmation_counts', { p_report_ids: [latestFresh!.id] })
      if (error) return 0 // before migration 100: no counts yet
      return (data as { confirmations: number }[] | null)?.[0]?.confirmations ?? 0
    },
  })
  const qc = useQueryClient()
  const confirm = useMutation({
    mutationFn: async (): Promise<number> => {
      const { data, error } = await supabase.rpc('confirm_queue_report', { p_report_id: latestFresh!.id })
      if (error) throw error
      if (typeof data !== 'number' || data < 0) throw new Error('This report can no longer be confirmed')
      return data
    },
    onSuccess: (n) => qc.setQueryData(['queue-confirmations', latestFresh?.id], n),
  })

  return { station, isLoading: stations.isLoading, isError: stations.isError, lines, reports, latestFresh, confirmations, confirm }
}
