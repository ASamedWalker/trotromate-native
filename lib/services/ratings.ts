import { supabase } from '@/lib/supabase/client'
import NetInfo from '@react-native-community/netinfo'
import { validateIntRange } from '@/lib/security/validate'
import { enqueueReport } from './offline-queue'
import type { RouteRatingStats } from '@/lib/types'

export interface RideRatingPayload {
  rating: number
  tags: string[]
  deviceId: string
  routeId?: string | null
  tripType?: 'go' | 'booking'
}

/**
 * Direct Supabase insert — no connectivity check.
 * Used by the offline queue processor and the online path.
 */
export async function insertRideRatingDirect(params: RideRatingPayload): Promise<boolean> {
  const rating = validateIntRange(params.rating, 1, 5)
  if (rating === null) return false

  const tags = params.tags.slice(0, 8).map((t) => String(t).slice(0, 32))

  const { error } = await supabase.from('ride_ratings').insert({
    route_id: params.routeId || null,
    rating,
    tags,
    trip_type: params.tripType ?? 'booking',
    // Same attribution as fare_reports: uuid col accepts undashed hex deviceId
    reporter_id: params.deviceId,
  })

  if (error) {
    console.warn('[troski] rating insert failed:', error.message)
    return false
  }
  return true
}

/**
 * Persist a post-trip rating from /booking/arrived — checks connectivity first.
 * If offline or the insert fails, queues the rating for later sync so it's
 * never silently lost.
 * routeId is null on the booking demo path (no real route attached);
 * GO Mode arrivals always carry the ridden route.
 */
export async function submitRideRating(params: RideRatingPayload): Promise<boolean> {
  const rating = validateIntRange(params.rating, 1, 5)
  if (rating === null) return false

  try {
    const netState = await NetInfo.fetch()

    if (!netState.isConnected) {
      await enqueueReport('rating', params.deviceId, params as unknown as Record<string, unknown>)
      console.log('[troski] Offline — rating queued for later sync')
      return true
    }

    const ok = await insertRideRatingDirect(params)

    if (!ok) {
      // Insert failed (server error, missing table, timeout, etc.) — queue it
      await enqueueReport('rating', params.deviceId, params as unknown as Record<string, unknown>)
      return true
    }

    return true
  } catch (e) {
    // Network error — queue it
    await enqueueReport('rating', params.deviceId, params as unknown as Record<string, unknown>).catch(() => {})
    console.warn('[troski] Error saving rating, queued offline:', e)
    return true
  }
}

/** All per-route rating stats, keyed by route_id — merged into Lines cards */
export async function fetchRouteRatingStats(): Promise<Map<string, RouteRatingStats>> {
  const { data, error } = await supabase.from('route_rating_stats').select('*')
  if (error || !data) return new Map()
  return new Map(data.map((r: RouteRatingStats) => [r.route_id, r]))
}
