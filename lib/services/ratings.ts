import { supabase } from '@/lib/supabase/client'
import { validateIntRange } from '@/lib/security/validate'
import type { RouteRatingStats } from '@/lib/types'

/**
 * Persist a post-trip rating from /booking/arrived.
 * routeId is null on the booking demo path (no real route attached);
 * GO Mode arrivals always carry the ridden route.
 */
export async function submitRideRating(params: {
  rating: number
  tags: string[]
  deviceId: string
  routeId?: string | null
  tripType?: 'go' | 'booking'
}): Promise<boolean> {
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

/** All per-route rating stats, keyed by route_id — merged into Lines cards */
export async function fetchRouteRatingStats(): Promise<Map<string, RouteRatingStats>> {
  const { data, error } = await supabase.from('route_rating_stats').select('*')
  if (error || !data) return new Map()
  return new Map(data.map((r: RouteRatingStats) => [r.route_id, r]))
}
