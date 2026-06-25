import { supabase } from '@/lib/supabase/client'
import type { RouteStop } from '@/lib/types'

/**
 * Per-drop-off (stage) fares — the fare a rider pays from a boarding stop to an
 * alighting stop along a route. Resolution precedence:
 *   1. official segment fare (GPRTU / authoritative)
 *   2. crowdsourced average for that segment
 *   3. distance-interpolated from the flat corridor fare
 *   4. the flat corridor fare (fallback while segment data is thin)
 *
 * Safe before migration 052 is run: fetchSegmentFare degrades to null, so callers
 * fall through to interpolation/corridor.
 */
export interface SegmentFare {
  fare: number
  source: 'official' | 'reported' | 'interpolated' | 'corridor'
  isOfficial: boolean
  reportCount: number
  effectiveDate?: string | null
}

interface SegmentFareRow {
  official_fare: number | null
  avg_reported_fare: number | null
  report_count: number | null
  is_official: boolean | null
  effective_date: string | null
}

/** Exact stored segment fare (board order → alight order). null if none/absent table. */
export async function fetchSegmentFare(
  routeId: string, fromOrder: number, toOrder: number,
): Promise<SegmentFareRow | null> {
  try {
    const { data, error } = await supabase
      .from('segment_fares')
      .select('official_fare, avg_reported_fare, report_count, is_official, effective_date')
      .eq('route_id', routeId)
      .eq('from_stop_order', fromOrder)
      .eq('to_stop_order', toOrder)
      .maybeSingle()
    if (error) return null
    return (data as SegmentFareRow) ?? null
  } catch {
    return null
  }
}

/**
 * Distance-interpolate when no exact segment exists: scale the corridor fare by
 * the share of corridor distance the board→alight segment covers. Returns null
 * when stops lack distance data.
 */
export function interpolateFare(
  stops: RouteStop[], fromOrder: number, toOrder: number, corridorFare: number,
): number | null {
  if (!stops?.length || !corridorFare) return null
  const dist = (order: number) =>
    stops.find((s) => s.stop_order === order)?.distance_from_origin_km ?? null
  const dFrom = dist(fromOrder)
  const dTo = dist(toOrder)
  const total = Math.max(...stops.map((s) => s.distance_from_origin_km ?? 0))
  if (dFrom == null || dTo == null || !total) return null
  const seg = Math.abs(dTo - dFrom)
  return Math.round(corridorFare * (seg / total) * 100) / 100
}

/** Resolve the board→alight fare with full precedence. Always returns a number. */
export async function resolveDropoffFare(opts: {
  routeId: string
  fromOrder: number
  toOrder: number
  stops: RouteStop[]
  corridorFare: number
}): Promise<SegmentFare> {
  const { routeId, fromOrder, toOrder, stops, corridorFare } = opts

  const row = await fetchSegmentFare(routeId, fromOrder, toOrder)
  if (row?.official_fare != null) {
    return { fare: Number(row.official_fare), source: 'official', isOfficial: true, reportCount: row.report_count ?? 0, effectiveDate: row.effective_date }
  }
  if (row?.avg_reported_fare != null) {
    return { fare: Number(row.avg_reported_fare), source: 'reported', isOfficial: false, reportCount: row.report_count ?? 0, effectiveDate: row.effective_date }
  }

  const interp = interpolateFare(stops, fromOrder, toOrder, corridorFare)
  if (interp != null) {
    return { fare: interp, source: 'interpolated', isOfficial: false, reportCount: 0 }
  }
  return { fare: corridorFare, source: 'corridor', isOfficial: false, reportCount: 0 }
}

/**
 * Persist a crowdsourced fare report tied to a drop-off, then fold it into the
 * segment aggregate (server-side via apply_fare_report_to_segment). Best-effort.
 */
export async function recordSegmentFareReport(opts: {
  routeId: string
  fromStopId?: string | null
  toStopId?: string | null
  fromOrder: number
  toOrder: number
  fare: number
}): Promise<void> {
  const { routeId, fromStopId, toStopId, fromOrder, toOrder, fare } = opts
  try {
    await supabase.from('fare_reports').insert({
      route_id: routeId,
      reported_fare: fare,
      from_stop_id: fromStopId ?? null,
      to_stop_id: toStopId ?? null,
    })
    await supabase.rpc('apply_fare_report_to_segment', {
      p_route_id: routeId, p_from_order: fromOrder, p_to_order: toOrder, p_fare: fare,
    })
  } catch {
    /* best-effort — fare reporting must never block the user */
  }
}
