import { supabase } from '@/lib/supabase/client'
import { findOrCreateRoute } from './routes'
import type { TransportType } from '@/lib/types'
import {
  validateLocation,
  validateGhanaLocation,
  validateFare,
  validateEnum,
  validateIntRange,
  QUEUE_STATUSES,
  INCIDENT_TYPES,
  TRANSPORT_TYPES,
} from '@/lib/security/validate'

/** Broadcast push to all users except reporter */
async function broadcastPush(title: string, body: string, excludeDeviceId: string, data?: Record<string, unknown>) {
  try {
    const { data: profiles } = await supabase
      .from('contributor_profiles')
      .select('push_token')
      .not('push_token', 'is', null)
      .neq('device_id', excludeDeviceId)

    const tokens = (profiles || [])
      .map(p => p.push_token!)
      .filter(t => t.startsWith('ExponentPushToken['))

    if (tokens.length === 0) return

    // Batch in chunks of 100
    for (let i = 0; i < tokens.length; i += 100) {
      const chunk = tokens.slice(i, i + 100).map(token => ({
        to: token, title, body, sound: 'default' as const,
        channelId: 'default', data,
      }))
      fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chunk),
      }).catch(() => {})
    }
  } catch (e) { console.warn("[troski] silent error:", e) }
}

export async function submitFareReport(params: {
  fromLocation: string
  toLocation: string
  fare: number
  deviceId: string
  transportType?: TransportType
  region?: string
}): Promise<{ reportId: string; routeId: string } | null> {
  const from = validateGhanaLocation(params.fromLocation)
  const to = validateGhanaLocation(params.toLocation)
  const fare = validateFare(params.fare)
  const transport = validateEnum(params.transportType || 'trotro', TRANSPORT_TYPES) || 'trotro'

  if (!from || !to || fare === null) {
    throw new Error(`Validation failed: from=${!!from}, to=${!!to}, fare=${fare}`)
  }

  const routeId = await findOrCreateRoute(from, to, fare, transport, params.region)
  if (!routeId) {
    throw new Error('Route creation failed')
  }

  const { data: report, error } = await supabase
    .from('fare_reports')
    .insert({
      route_id: routeId,
      reported_fare: fare,
      // Attribution powers Line Champions + per-line recognition.
      // reporter_id is uuid-typed; Postgres accepts the undashed hex deviceId.
      reporter_id: params.deviceId,
      reporter_phone: null,
    })
    .select('id')
    .single()

  if (error) {
    throw new Error(`Fare report insert: ${error.message}`)
  }

  // Push notification to all users
  broadcastPush(
    '🚐 New Fare Report',
    `GH₵${fare.toFixed(2)} reported on ${from} → ${to}`,
    params.deviceId,
    { screen: 'route-detail', routeId },
  )

  return { reportId: report.id, routeId }
}

export async function submitQueueReport(params: {
  stationName: string
  queueStatus: string
  deviceId: string
  stationId?: string
  vehicleCount?: number
  waitTimeMins?: number
}): Promise<{ reportId: string } | null> {
  const stationName = validateLocation(params.stationName)
  const queueStatus = validateEnum(params.queueStatus, QUEUE_STATUSES)
  const vehicleCount = params.vehicleCount != null
    ? validateIntRange(params.vehicleCount, 0, 500)
    : null
  const waitTimeMins = params.waitTimeMins != null
    ? validateIntRange(params.waitTimeMins, 0, 120)
    : null

  if (!stationName || !queueStatus) return null

  const { data: report, error } = await supabase
    .from('queue_reports')
    .insert({
      station_id: params.stationId || null,
      station_name: stationName,
      queue_status: queueStatus,
      vehicle_count: vehicleCount,
      wait_time_estimate_mins: waitTimeMins,
      reporter_phone: null,
    })
    .select('id')
    .single()

  if (error) {
    console.error('Error submitting queue report:', error)
    return null
  }

  // Push notification to all users
  broadcastPush(
    '🚏 Queue Update',
    `${stationName}: ${queueStatus === 'very_long' ? 'Very long' : queueStatus === 'long' ? 'Long' : queueStatus === 'moderate' ? 'Moderate' : 'Short'} queue`,
    params.deviceId,
    { screen: 'stations' },
  )

  return { reportId: report.id }
}

export async function submitIncidentReport(params: {
  locationName: string
  incidentType: string
  deviceId: string
  latitude?: number
  longitude?: number
}): Promise<{ reportId: string } | null> {
  const locationName = validateLocation(params.locationName)
  const incidentType = validateEnum(params.incidentType, INCIDENT_TYPES)

  if (!locationName || !incidentType) return null

  // Map expanded types to DB-safe values until migration 035 runs
  const DB_TYPE_MAP: Record<string, string> = {
    police_checkpoint: 'police',
    road_closure: 'roadwork',
    flooding: 'traffic',
    breakdown: 'roadwork',
    demonstration: 'traffic',
    other: 'traffic',
  }
  const dbType = DB_TYPE_MAP[incidentType] || incidentType

  const insertData: Record<string, unknown> = {
    location_name: locationName,
    incident_type: dbType,
  }
  if (params.latitude != null && params.longitude != null) {
    insertData.latitude = params.latitude
    insertData.longitude = params.longitude
  }

  const { data: report, error } = await supabase
    .from('incident_reports')
    .insert(insertData)
    .select('id')
    .single()

  if (error) {
    console.error('Error submitting incident report:', error)
    return null
  }

  // Push notification to all users
  broadcastPush(
    '⚠️ Incident Report',
    `${incidentType === 'traffic' ? 'Traffic' : incidentType === 'accident' ? 'Accident' : incidentType === 'police_checkpoint' ? 'Police checkpoint' : incidentType === 'road_closure' ? 'Road closure' : incidentType === 'flooding' ? 'Flooding' : 'Incident'} at ${locationName}`,
    params.deviceId,
    { screen: 'stations' },
  )

  return { reportId: report.id }
}

/* ── Line Champions ──────────────────────────────────────────
   Top fare-report contributors for a single corridor. Per-line
   recognition is the verified Transit pattern for driving
   contribution (each line gets its own leaderboard). */

export interface LineChampion {
  deviceId: string
  displayName: string
  reportCount: number
}

export async function fetchLineChampions(routeId: string, limit = 3): Promise<LineChampion[]> {
  try {
    const { data: reports } = await supabase
      .from('fare_reports')
      .select('reporter_id')
      .eq('route_id', routeId)
      .not('reporter_id', 'is', null)
      .order('reported_at', { ascending: false })
      .limit(400)
    if (!reports || reports.length === 0) return []

    // reporter_id is uuid-typed (comes back dashed); contributor_profiles
    // stores the raw 32-hex deviceId — normalize before tallying/joining
    const tally = new Map<string, number>()
    for (const r of reports) {
      if (!r.reporter_id) continue
      const raw = String(r.reporter_id).replace(/-/g, '')
      tally.set(raw, (tally.get(raw) ?? 0) + 1)
    }
    const top = [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit)
    if (top.length === 0) return []

    const { data: profiles } = await supabase
      .from('contributor_profiles')
      .select('device_id, display_name')
      .in('device_id', top.map(([id]) => id))
    const nameOf = new Map((profiles ?? []).map((p) => [p.device_id, p.display_name]))

    return top.map(([deviceId, reportCount]) => ({
      deviceId,
      reportCount,
      displayName: nameOf.get(deviceId) || 'Troski Rider',
    }))
  } catch {
    return []
  }
}
