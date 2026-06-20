import { supabase } from '@/lib/supabase/client'
import type { QueueStatus } from '@/lib/security/validate'

// Visual + ordering metadata per queue level. Capacity % drives the figma-style
// fill bar; it's a representation of the level, not a measured occupancy.
export const QUEUE_META: Record<QueueStatus, {
  label: string
  color: string
  bg: string
  capacity: number
  rank: number
}> = {
  empty:     { label: 'Empty',     color: '#15803d', bg: '#dcfce7', capacity: 8,  rank: 0 },
  short:     { label: 'Short',     color: '#15803d', bg: '#dcfce7', capacity: 28, rank: 1 },
  moderate:  { label: 'Moderate',  color: '#b45309', bg: '#fef3c7', capacity: 55, rank: 2 },
  long:      { label: 'Long',      color: '#c2410c', bg: '#ffedd5', capacity: 80, rank: 3 },
  very_long: { label: 'Very Long', color: '#dc2626', bg: '#fee2e2', capacity: 95, rank: 4 },
}

export interface StationQueue {
  stationName: string
  status: QueueStatus
  reportedAt: string
  vehicleCount: number | null
  ageMins: number
  isStale: boolean // queue status decays fast; flag anything older than 2h
}

export interface QueueStatusResult {
  stations: StationQueue[]
  // Summary buckets for the header chips
  total: number
  liveNow: number // reported within the last hour
  busy: number // moderate
  nearFull: number // long + very_long
}

const STALE_MS = 2 * 60 * 60 * 1000 // 2 hours

/**
 * Latest queue report per station, busiest first. Reads queue_reports directly
 * (the station_queue_stats view is windowed to 24h and is often empty), dedups
 * to the most recent report per station, and tags staleness so the UI never
 * presents a day-old queue as if it were live.
 */
export async function fetchQueueStatus(nowMs: number): Promise<QueueStatusResult> {
  const { data, error } = await supabase
    .from('queue_reports')
    .select('station_name, queue_status, reported_at, vehicle_count')
    .order('reported_at', { ascending: false })
    .limit(500)

  if (error || !data) {
    return { stations: [], total: 0, liveNow: 0, busy: 0, nearFull: 0 }
  }

  // First row per station_name is the latest (already ordered desc)
  const latest = new Map<string, StationQueue>()
  for (const r of data) {
    const name = (r.station_name || '').trim()
    if (!name || latest.has(name)) continue
    const status = r.queue_status as QueueStatus
    if (!QUEUE_META[status]) continue
    const reportedMs = new Date(r.reported_at).getTime()
    const ageMins = Math.max(0, Math.round((nowMs - reportedMs) / 60000))
    latest.set(name, {
      stationName: name,
      status,
      reportedAt: r.reported_at,
      vehicleCount: r.vehicle_count ?? null,
      ageMins,
      isStale: nowMs - reportedMs > STALE_MS,
    })
  }

  const stations = Array.from(latest.values()).sort((a, b) => {
    const r = QUEUE_META[b.status].rank - QUEUE_META[a.status].rank
    return r !== 0 ? r : a.ageMins - b.ageMins
  })

  return {
    stations,
    total: stations.length,
    liveNow: stations.filter((s) => s.ageMins <= 60).length,
    busy: stations.filter((s) => s.status === 'moderate').length,
    nearFull: stations.filter((s) => s.status === 'long' || s.status === 'very_long').length,
  }
}
