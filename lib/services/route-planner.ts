import { supabase } from '@/lib/supabase'

interface RouteLeg {
  route_id: string
  from: string
  to: string
  fare: number
  duration_mins: number
  transport_type: string
}

export interface TransferPlan {
  type: 'direct' | 'transfer'
  legs: RouteLeg[]
  total_fare: number
  total_duration_mins: number
  transfer_hub?: string
  transfer_wait_mins?: number
  // Set when the destination is an intermediate drop-off along a corridor — lets
  // route detail pre-select the alight and price the stage, not the whole corridor.
  dropoff_stop_order?: number
  dropoff_stop_name?: string
}

export async function planRoute(from: string, to: string, transportType?: string): Promise<TransferPlan[]> {
  const results: TransferPlan[] = []

  // 1. Check direct routes (both directions)
  let directQuery = supabase
    .from('routes')
    .select('id, from_location, to_location, official_fare, estimated_duration_mins, transport_type')
    .or(
      `and(from_location.ilike.%${from}%,to_location.ilike.%${to}%),` +
      `and(from_location.ilike.%${to}%,to_location.ilike.%${from}%)`
    )
    .limit(5)

  if (transportType) {
    directQuery = directQuery.eq('transport_type', transportType)
  }

  const { data: directRoutes } = await directQuery

  for (const r of directRoutes || []) {
    const isReversed = r.from_location.toLowerCase().includes(to.toLowerCase())
    results.push({
      type: 'direct',
      legs: [{
        route_id: r.id,
        from: isReversed ? r.to_location : r.from_location,
        to: isReversed ? r.from_location : r.to_location,
        fare: r.official_fare,
        duration_mins: r.estimated_duration_mins,
        transport_type: r.transport_type || 'trotro',
      }],
      total_fare: r.official_fare,
      total_duration_mins: r.estimated_duration_mins,
    })
  }

  // 1b. Stage match — destination is an INTERMEDIATE stop along a corridor.
  // e.g. "Circle → Dome" where Dome is a stop on the Circle → Taifa route, so no
  // direct Circle→Dome row exists but the rider can alight there.
  const { data: stopMatches } = await supabase
    .from('route_stops')
    .select('route_id, stop_name, stop_order, is_terminal')
    .ilike('stop_name', `%${to}%`)
    .limit(15)

  if (stopMatches?.length) {
    const routeIds = [...new Set(stopMatches.map((s) => s.route_id))]
    let stageRoutesQuery = supabase
      .from('routes')
      .select('id, from_location, to_location, official_fare, estimated_duration_mins, transport_type')
      .in('id', routeIds)
    if (transportType) stageRoutesQuery = stageRoutesQuery.eq('transport_type', transportType)
    const [{ data: stageRoutes }, { data: segFares }, { data: allStops }] = await Promise.all([
      stageRoutesQuery,
      supabase.from('segment_fares').select('route_id, to_stop_order, official_fare, avg_reported_fare').in('route_id', routeIds).eq('from_stop_order', 0),
      supabase.from('route_stops').select('route_id, stop_order, distance_from_origin_km').in('route_id', routeIds),
    ])

    for (const sm of stopMatches) {
      if (sm.is_terminal) continue // endpoint already handled by the direct match
      const r = stageRoutes?.find((x) => x.id === sm.route_id)
      if (!r) continue
      if (!r.from_location.toLowerCase().includes(from.toLowerCase())) continue // origin must match
      if (results.some((p) => p.legs[0]?.route_id === r.id)) continue // already returned as direct

      const seg = segFares?.find((sf) => sf.route_id === sm.route_id && sf.to_stop_order === sm.stop_order)
      let fare = seg?.official_fare ?? seg?.avg_reported_fare ?? null
      if (fare == null) {
        const rs = (allStops ?? []).filter((s) => s.route_id === sm.route_id)
        const total = Math.max(...rs.map((s) => s.distance_from_origin_km ?? 0))
        const d = rs.find((s) => s.stop_order === sm.stop_order)?.distance_from_origin_km
        fare = total && d != null ? Math.round(r.official_fare * (d / total) * 100) / 100 : r.official_fare
      }

      results.push({
        type: 'direct',
        legs: [{
          route_id: r.id,
          from: r.from_location,
          to: sm.stop_name,
          fare,
          duration_mins: r.estimated_duration_mins,
          transport_type: r.transport_type || 'trotro',
        }],
        total_fare: fare,
        total_duration_mins: r.estimated_duration_mins,
        dropoff_stop_order: sm.stop_order,
        dropoff_stop_name: sm.stop_name,
      })
    }
  }

  // 2. Get transfer hubs
  const { data: hubs } = await supabase
    .from('transfer_hubs')
    .select('station_name, avg_transfer_time_mins')
    .eq('is_active', true)

  // 3. For each hub, find from→hub AND hub→to
  for (const hub of hubs || []) {
    const hubName = hub.station_name

    if (
      hubName.toLowerCase() === from.toLowerCase() ||
      hubName.toLowerCase() === to.toLowerCase()
    ) continue

    let legAQuery = supabase
      .from('routes')
      .select('id, from_location, to_location, official_fare, estimated_duration_mins, transport_type')
      .or(
        `and(from_location.ilike.%${from}%,to_location.ilike.%${hubName}%),` +
        `and(from_location.ilike.%${hubName}%,to_location.ilike.%${from}%)`
      )
      .limit(1)

    if (transportType) legAQuery = legAQuery.eq('transport_type', transportType)
    const { data: legA } = await legAQuery

    if (!legA?.length) continue

    let legBQuery = supabase
      .from('routes')
      .select('id, from_location, to_location, official_fare, estimated_duration_mins, transport_type')
      .or(
        `and(from_location.ilike.%${hubName}%,to_location.ilike.%${to}%),` +
        `and(from_location.ilike.%${to}%,to_location.ilike.%${hubName}%)`
      )
      .limit(1)

    if (transportType) legBQuery = legBQuery.eq('transport_type', transportType)
    const { data: legB } = await legBQuery

    if (!legB?.length) continue

    const a = legA[0]
    const b = legB[0]
    const transferWait = hub.avg_transfer_time_mins

    results.push({
      type: 'transfer',
      legs: [
        {
          route_id: a.id,
          from: a.from_location.toLowerCase().includes(from.toLowerCase()) ? a.from_location : a.to_location,
          to: hubName,
          fare: a.official_fare,
          duration_mins: a.estimated_duration_mins,
          transport_type: a.transport_type || 'trotro',
        },
        {
          route_id: b.id,
          from: hubName,
          to: b.to_location.toLowerCase().includes(to.toLowerCase()) ? b.to_location : b.from_location,
          fare: b.official_fare,
          duration_mins: b.estimated_duration_mins,
          transport_type: b.transport_type || 'trotro',
        },
      ],
      total_fare: a.official_fare + b.official_fare,
      total_duration_mins: a.estimated_duration_mins + b.estimated_duration_mins + transferWait,
      transfer_hub: hubName,
      transfer_wait_mins: transferWait,
    })
  }

  // Sort: direct first, then cheapest, then fastest
  results.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'direct' ? -1 : 1
    if (a.total_fare !== b.total_fare) return a.total_fare - b.total_fare
    return a.total_duration_mins - b.total_duration_mins
  })

  return results.slice(0, 5)
}
