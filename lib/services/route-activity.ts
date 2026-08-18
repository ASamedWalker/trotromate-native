import { supabase } from '@/lib/supabase/client'
import { fetchPostsForRoute } from '@/lib/services/tales'

/**
 * What riders have contributed about a corridor recently — Pulse posts AND
 * fare reports, merged into one timeline.
 *
 * Why both: the Pulse feed is thin, but riders HAVE been contributing — 14 fare
 * reports in the last 30 days against a handful of posts. That is real, fresh,
 * route-attached rider input sitting in a table nobody sees. Surfacing it fills
 * the route page with genuine activity instead of waiting for the social feed
 * to reach critical mass.
 *
 * A fare report is rendered as a report, never dressed up as somebody's post —
 * they are different kinds of claim and the UI keeps them visually distinct.
 */
export type RouteActivityItem =
  | {
      kind: 'post'
      id: string
      created_at: string
      location_name: string
      caption: string | null
    }
  | {
      kind: 'fare'
      id: string
      created_at: string
      fare: number
    }

export async function fetchRouteActivity(opts: {
  routeId: string
  placeNames: string[]
  limit?: number
  maxAgeDays?: number
}): Promise<RouteActivityItem[]> {
  const { routeId, placeNames, limit = 3, maxAgeDays = 30 } = opts
  const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000).toISOString()

  const [posts, fares] = await Promise.all([
    fetchPostsForRoute(placeNames, limit, maxAgeDays),
    (async () => {
      try {
        const { data, error } = await supabase
          .from('fare_reports')
          .select('id, reported_fare, reported_at')
          .eq('route_id', routeId)
          .gt('reported_at', cutoff)
          .order('reported_at', { ascending: false })
          .limit(limit)
        if (error) return []
        return data ?? []
      } catch {
        return []
      }
    })(),
  ])

  const items: RouteActivityItem[] = [
    ...posts.map((p) => ({
      kind: 'post' as const,
      id: p.id,
      created_at: p.created_at,
      location_name: p.location_name,
      caption: p.caption,
    })),
    ...fares.map((f) => ({
      kind: 'fare' as const,
      id: f.id as string,
      created_at: f.reported_at as string,
      fare: Number(f.reported_fare),
    })),
  ]

  items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  return items.slice(0, limit)
}
