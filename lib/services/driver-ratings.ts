import { supabase } from '@/lib/supabase/client'

/** A rider rates + comments on the driver after alighting. Best-effort. */
export async function submitDriverRating(p: {
  driverId: string
  vanId?: string | null
  routeLabel?: string | null
  deviceId?: string | null
  authUserId?: string | null
  stars: number
  comment?: string | null
}): Promise<void> {
  try {
    await supabase.from('driver_ratings').insert({
      driver_id: p.driverId,
      van_id: p.vanId ?? null,
      route_label: p.routeLabel ?? null,
      rider_device_id: p.deviceId ?? null,
      rider_auth_user_id: p.authUserId ?? null,
      stars: p.stars,
      comment: p.comment?.trim() || null,
    })
  } catch {
    /* never block the user on a rating write */
  }
}

export interface DriverRatingStats { avgRating: number | null; ratingCount: number }

export async function fetchDriverRatingStats(driverId: string): Promise<DriverRatingStats> {
  try {
    const { data } = await supabase
      .from('driver_rating_stats')
      .select('avg_rating, rating_count')
      .eq('driver_id', driverId)
      .maybeSingle()
    return { avgRating: data?.avg_rating != null ? Number(data.avg_rating) : null, ratingCount: data?.rating_count ?? 0 }
  } catch {
    return { avgRating: null, ratingCount: 0 }
  }
}

/** Total trips a driver has completed (sum of shifts). */
export async function fetchDriverRides(driverId: string): Promise<number> {
  try {
    const { data } = await supabase
      .from('driver_shifts')
      .select('trips_completed')
      .eq('driver_id', driverId)
    return (data ?? []).reduce((sum, r: { trips_completed: number | null }) => sum + (r.trips_completed || 0), 0)
  } catch {
    return 0
  }
}

export interface DriverReview { stars: number; comment: string; created_at: string }

export async function fetchDriverReviews(driverId: string, limit = 10): Promise<DriverReview[]> {
  try {
    const { data } = await supabase
      .from('driver_ratings')
      .select('stars, comment, created_at')
      .eq('driver_id', driverId)
      .not('comment', 'is', null)
      .order('created_at', { ascending: false })
      .limit(limit)
    return (data as DriverReview[]) ?? []
  } catch {
    return []
  }
}
