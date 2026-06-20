import { supabase } from '@/lib/supabase/client'
import { haversineKm } from '@/lib/utils/distance'
import { QUEUE_META } from '@/lib/services/queueStatus'
import type { QueueStatus } from '@/lib/security/validate'

export interface Terminal {
  id: string
  name: string
  city: string | null
  latitude: number | null
  longitude: number | null
  routeCount: number
  // Latest crowdsourced queue level, if any recent report exists
  queueStatus: QueueStatus | null
  queueAgeMins: number | null
  distanceKm: number | null
}

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Terminals = stations that are real boarding hubs: a route origin OR flagged
 * major. Enriched with how many routes leave from there, the latest queue
 * level, and distance from the user. Sorted nearest-first when location is
 * known, otherwise busiest-hub-first (most routes).
 */
export async function fetchTerminals(
  userLoc: { latitude: number; longitude: number } | null,
  nowMs: number,
): Promise<Terminal[]> {
  const [{ data: stations }, { data: routes }, { data: queues }] = await Promise.all([
    supabase.from('stations').select('id, name, location, latitude, longitude, is_major'),
    supabase.from('routes').select('from_location'),
    supabase
      .from('queue_reports')
      .select('station_name, queue_status, reported_at')
      .order('reported_at', { ascending: false })
      .limit(500),
  ])

  if (!stations) return []

  // Routes departing per origin name
  const routeCounts = new Map<string, number>()
  for (const r of routes || []) {
    const k = norm(r.from_location || '')
    if (k) routeCounts.set(k, (routeCounts.get(k) || 0) + 1)
  }

  // Latest queue report per station name
  const queueByName = new Map<string, { status: QueueStatus; ageMins: number }>()
  for (const q of queues || []) {
    const k = norm(q.station_name || '')
    if (!k || queueByName.has(k)) continue
    const status = q.queue_status as QueueStatus
    if (!QUEUE_META[status]) continue
    const ageMins = Math.max(0, Math.round((nowMs - new Date(q.reported_at).getTime()) / 60000))
    queueByName.set(k, { status, ageMins })
  }

  const terminals: Terminal[] = []
  for (const st of stations) {
    const key = norm(st.name)
    const routeCount = routeCounts.get(key) || 0
    // Keep only meaningful hubs: route origins or flagged-major stations
    if (routeCount === 0 && !st.is_major) continue

    const q = queueByName.get(key)
    const distanceKm =
      userLoc && st.latitude != null && st.longitude != null
        ? haversineKm(userLoc.latitude, userLoc.longitude, st.latitude, st.longitude)
        : null

    terminals.push({
      id: st.id,
      name: st.name,
      city: st.location ?? null,
      latitude: st.latitude,
      longitude: st.longitude,
      routeCount,
      queueStatus: q?.status ?? null,
      queueAgeMins: q?.ageMins ?? null,
      distanceKm,
    })
  }

  terminals.sort((a, b) => {
    if (a.distanceKm != null && b.distanceKm != null) return a.distanceKm - b.distanceKm
    if (a.distanceKm != null) return -1
    if (b.distanceKm != null) return 1
    return b.routeCount - a.routeCount
  })

  return terminals
}
