import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { extractRoute } from '@/lib/utils/pulse-extract'

export interface ReelRoute {
  from: string
  to: string
  /** Resolved `routes` row — undefined when no corridor matched (never invent one). */
  routeId?: string
  officialFare?: number
}

// Strip chars that would break a PostgREST .or()/ilike filter (extractRoute already
// limits captions to letters/digits/space/'.- ; this is a second guard) and cap length.
const clean = (s: string) => s.replace(/[%,()*\\"_:']/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40)
// Compare place names loosely: case, punctuation and spacing don't matter.
const norm = (s: string | null | undefined) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')

/**
 * Route chip data for a reel: from/to parsed from the caption, then ONE cheap
 * `routes` select (both directions) to find the corridor + official fare.
 * Lookup only runs when `enabled` (active / loading item) and is cached.
 */
export function useReelRoute(caption: string | undefined, enabled: boolean): ReelRoute | null {
  const parsed = useMemo(() => (caption ? extractRoute(caption) : null), [caption])
  const from = parsed ? clean(parsed.from) : ''
  const to = parsed ? clean(parsed.to) : ''

  const { data } = useQuery({
    queryKey: ['reel-route', from.toLowerCase(), to.toLowerCase()],
    enabled: enabled && !!from && !!to,
    staleTime: 10 * 60 * 1000,
    retry: false, // data cost: one attempt per route
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from('routes')
        .select('id, from_location, to_location, official_fare')
        .or(
          `and(from_location.ilike.%${from}%,to_location.ilike.%${to}%),` +
          `and(from_location.ilike.%${to}%,to_location.ilike.%${from}%)`
        )
        .order('id')
        .limit(10)
      if (error) throw error // don't cache a failure as "no route"
      const f = norm(from), t = norm(to)
      // Only accept a row whose BOTH ends match the caption's places (either
      // direction); a loose ilike hit (e.g. "Circle" on many corridors) would
      // otherwise link the wrong route and show the wrong fare.
      const list = rows ?? []
      const same = list.find((r) => norm(r.from_location) === f && norm(r.to_location) === t)
      const reverse = list.find((r) => norm(r.from_location) === t && norm(r.to_location) === f)
      const hit = same ?? reverse
      return hit
        ? { id: hit.id as string, fare: typeof hit.official_fare === 'number' && hit.official_fare > 0 ? hit.official_fare : null }
        : null
    },
  })

  if (!parsed) return null
  return {
    from: parsed.from,
    to: parsed.to,
    routeId: data?.id,
    officialFare: data?.fare ?? undefined,
  }
}
