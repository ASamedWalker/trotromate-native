/**
 * Trip data collection service.
 * Persists every GO Mode trip to Supabase so Troski becomes the #1 hub
 * for Ghana transport route data.
 */

import { supabase } from '@/lib/supabase/client'
import NetInfo from '@react-native-community/netinfo'
import { getDistanceKm } from '@/lib/services/trip'
import { enqueueReport } from './offline-queue'

export interface CompletedTripPayload {
  device_id: string
  route_id: string | null
  train_line_id: string | null
  transport_type: 'trotro' | 'train'
  from_location: string
  to_location: string
  from_lat: number | null
  from_lng: number | null
  to_lat: number | null
  to_lng: number | null
  started_at: string       // ISO timestamp
  ended_at: string         // ISO timestamp
  duration_mins: number
  distance_km: number | null
  fare_paid: number | null
  station_count: number
  reached_destination: boolean
}

/**
 * Direct Supabase insert — no connectivity check.
 * Used by the offline queue processor and the online path.
 */
export async function saveCompletedTripDirect(payload: CompletedTripPayload): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('completed_trips')
      .insert(payload)
      .select('id')
      .single()

    if (error) {
      console.warn('[trips] Failed to save completed trip:', error.message)
      return null
    }

    return data?.id ?? null
  } catch (e) {
    console.warn('[trips] Error saving completed trip:', e)
    return null
  }
}

/**
 * Save a completed trip — checks connectivity first.
 * If offline or insert fails, queues the trip for later sync.
 * Fire-and-forget — should never block the user from navigating away.
 */
export async function saveCompletedTrip(payload: CompletedTripPayload): Promise<string | null> {
  try {
    const netState = await NetInfo.fetch()

    if (!netState.isConnected) {
      await enqueueReport('trip', payload.device_id, payload as unknown as Record<string, unknown>)
      console.log('[trips] Offline — trip queued for later sync')
      return null
    }

    const tripId = await saveCompletedTripDirect(payload)

    if (!tripId) {
      // Insert failed (server error, timeout, etc.) — queue it
      await enqueueReport('trip', payload.device_id, payload as unknown as Record<string, unknown>)
      return null
    }

    return tripId
  } catch (e) {
    // Network error — queue it
    await enqueueReport('trip', payload.device_id, payload as unknown as Record<string, unknown>).catch(() => {})
    console.warn('[trips] Error saving trip, queued offline:', e)
    return null
  }
}

/**
 * Update fare_paid on an already-saved trip (post-trip fare prompt).
 */
export async function updateTripFare(tripId: string, farePaid: number): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('completed_trips')
      .update({ fare_paid: farePaid })
      .eq('id', tripId)

    if (error) {
      console.warn('[trips] Failed to update fare:', error.message)
      return false
    }
    return true
  } catch {
    return false
  }
}

/**
 * Build a CompletedTripPayload from active trip data.
 */
export function buildCompletedTrip(params: {
  deviceId: string
  routeId: string
  routeLabel: string
  trainLineId?: string | null
  transportType: 'trotro' | 'train'
  stations: Array<{ name: string; latitude: number; longitude: number; isOrigin: boolean; isDestination: boolean }>
  startedAt: number
  reachedDestination: boolean
}): CompletedTripPayload {
  const origin = params.stations.find((s) => s.isOrigin) ?? params.stations[0]
  const dest = params.stations.find((s) => s.isDestination) ?? params.stations[params.stations.length - 1]

  const now = Date.now()
  const durationMins = Math.round((now - params.startedAt) / 60000)

  let distanceKm: number | null = null
  if (origin && dest) {
    distanceKm = Math.round(
      getDistanceKm(origin.latitude, origin.longitude, dest.latitude, dest.longitude) * 100
    ) / 100
  }

  return {
    device_id: params.deviceId,
    route_id: params.transportType === 'trotro' ? params.routeId : null,
    train_line_id: params.trainLineId ?? null,
    transport_type: params.transportType,
    from_location: origin?.name ?? params.routeLabel.split('→')[0]?.trim() ?? 'Unknown',
    to_location: dest?.name ?? params.routeLabel.split('→')[1]?.trim() ?? 'Unknown',
    from_lat: origin?.latitude ?? null,
    from_lng: origin?.longitude ?? null,
    to_lat: dest?.latitude ?? null,
    to_lng: dest?.longitude ?? null,
    started_at: new Date(params.startedAt).toISOString(),
    ended_at: new Date(now).toISOString(),
    duration_mins: durationMins,
    distance_km: distanceKm,
    fare_paid: null, // filled in by post-trip prompt
    station_count: params.stations.length,
    reached_destination: params.reachedDestination,
  }
}
