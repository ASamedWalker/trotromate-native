import { supabase } from '@/lib/supabase/client'
import type { Station } from '@/lib/types'

type QueueStatus = 'empty' | 'short' | 'moderate' | 'long' | 'very_long'

interface QueueStat {
  current_status: QueueStatus
  report_count_last_hour: number
  last_report_at: string
}

export interface StationWithQueue extends Station {
  queue_stats?: QueueStat[]
}

export async function fetchStations(): Promise<StationWithQueue[]> {
  const { data: stations, error } = await supabase
    .from('stations')
    .select('*')
    .order('is_major', { ascending: false })
    .order('name')

  if (error || !stations) return []

  // Try the aggregated view first, fall back to raw queue_reports
  const { data: queueStats } = await supabase
    .from('station_queue_stats')
    .select('*')

  if (queueStats && queueStats.length > 0) {
    return stations.map((station: Station) => ({
      ...station,
      queue_stats: queueStats.filter((qs: { station_id: string }) => qs.station_id === station.id),
    }))
  }

  // Fallback: aggregate directly from queue_reports (matches by station_name)
  const { data: reports } = await supabase
    .from('queue_reports')
    .select('station_name, queue_status, reported_at')
    .gte('reported_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order('reported_at', { ascending: false })

  return stations.map((station: Station) => {
    const stationReports = reports?.filter(
      (r: { station_name: string }) => r.station_name?.toLowerCase() === station.name.toLowerCase()
    ) || []
    const latest = stationReports[0]
    const oneHourAgo = Date.now() - 60 * 60 * 1000
    const recentCount = stationReports.filter(
      (r: { reported_at: string }) => new Date(r.reported_at).getTime() > oneHourAgo
    ).length

    return {
      ...station,
      queue_stats: latest
        ? [{
            current_status: latest.queue_status as QueueStatus,
            report_count_last_hour: recentCount,
            last_report_at: latest.reported_at,
          }]
        : [],
    }
  })
}
