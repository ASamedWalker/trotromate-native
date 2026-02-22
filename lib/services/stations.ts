import { supabase } from '@/lib/supabase/client'
import type { Station } from '@/lib/types'

export interface StationWithQueue extends Station {
  queue_stats?: {
    current_status: 'empty' | 'short' | 'moderate' | 'long' | 'very_long'
    report_count_last_hour: number
    last_report_at: string
  }[]
}

export async function fetchStations(): Promise<StationWithQueue[]> {
  const { data: stations, error } = await supabase
    .from('stations')
    .select('*')
    .order('is_major', { ascending: false })
    .order('name')

  if (error || !stations) return []

  // Fetch queue stats
  const { data: queueStats } = await supabase
    .from('station_queue_stats')
    .select('*')

  return stations.map((station: Station) => ({
    ...station,
    queue_stats: queueStats?.filter((qs: { station_id: string }) => qs.station_id === station.id) || [],
  }))
}
