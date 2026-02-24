import { supabase } from '@/lib/supabase/client'
import type { Station } from '@/lib/types'

export type QueueStatus = 'empty' | 'short' | 'moderate' | 'long' | 'very_long'

export interface QueueStat {
  current_status: QueueStatus
  report_count_last_hour: number
  last_report_at: string
  avg_vehicle_count: number | null
  avg_wait_mins: number | null
}

export interface StationWithQueue extends Station {
  queue_stats?: QueueStat[]
}

// Dynamic wait estimate from actual data, falling back to hardcoded values
const FALLBACK_WAIT: Record<QueueStatus, string> = {
  empty: 'No wait',
  short: '~5 min',
  moderate: '~15 min',
  long: '~30 min',
  very_long: '45+ min',
}

export function getWaitEstimate(stat: QueueStat): string {
  // Prefer computed average from actual reports
  if (stat.avg_wait_mins != null && stat.avg_wait_mins > 0) {
    const mins = Math.round(stat.avg_wait_mins)
    return `~${mins} min`
  }
  // Fallback to vehicle count heuristic (~5 min per vehicle)
  if (stat.avg_vehicle_count != null && stat.avg_vehicle_count > 0) {
    const mins = Math.round(stat.avg_vehicle_count * 5)
    return `~${mins} min`
  }
  // Final fallback: hardcoded by status
  return FALLBACK_WAIT[stat.current_status]
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
      queue_stats: queueStats
        .filter((qs: { station_id: string }) => qs.station_id === station.id)
        .map((qs: any) => ({
          current_status: qs.current_status as QueueStatus,
          report_count_last_hour: qs.report_count_last_hour,
          last_report_at: qs.last_report_at,
          avg_vehicle_count: qs.avg_vehicle_count ?? null,
          avg_wait_mins: qs.avg_wait_mins ?? null,
        })),
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
            avg_vehicle_count: null,
            avg_wait_mins: null,
          }]
        : [],
    }
  })
}
