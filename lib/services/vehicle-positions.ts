import { supabase } from '@/lib/supabase'

export interface VehiclePosition {
  vanId: string
  plateNumber: string
  routeId: string | null
  routeLabel: string | null
  latitude: number
  longitude: number
  heading: number | null
  speed: number | null
  updatedAt: string
  isStale: boolean // no update in >2 min
}

/**
 * Fetch all active vehicle positions in one call.
 * Consumer calls this on app open + pull-to-refresh.
 * Lightweight — reads from vehicle_positions table (1 row per vehicle).
 */
export async function fetchVehiclePositions(routeId?: string): Promise<VehiclePosition[]> {
  let query = supabase
    .from('vehicle_positions')
    .select('van_id, plate_number, route_id, route_label, latitude, longitude, heading, speed, updated_at')
    .eq('is_active', true)

  if (routeId) {
    query = query.eq('route_id', routeId)
  }

  const { data, error } = await query

  if (error || !data) return []

  const now = Date.now()
  const STALE_MS = 2 * 60 * 1000 // 2 minutes

  return data.map((row: any) => ({
    vanId: row.van_id,
    plateNumber: row.plate_number,
    routeId: row.route_id,
    routeLabel: row.route_label,
    latitude: row.latitude,
    longitude: row.longitude,
    heading: row.heading,
    speed: row.speed,
    updatedAt: row.updated_at,
    isStale: now - new Date(row.updated_at).getTime() > STALE_MS,
  }))
}
