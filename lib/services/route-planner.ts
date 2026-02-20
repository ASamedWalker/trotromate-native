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
}

export async function planRoute(from: string, to: string): Promise<TransferPlan[]> {
  const results: TransferPlan[] = []

  // 1. Check direct routes (both directions)
  const { data: directRoutes } = await supabase
    .from('routes')
    .select('id, from_location, to_location, official_fare, estimated_duration_mins, transport_type')
    .or(
      `and(from_location.ilike.%${from}%,to_location.ilike.%${to}%),` +
      `and(from_location.ilike.%${to}%,to_location.ilike.%${from}%)`
    )
    .limit(5)

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

    const { data: legA } = await supabase
      .from('routes')
      .select('id, from_location, to_location, official_fare, estimated_duration_mins, transport_type')
      .or(
        `and(from_location.ilike.%${from}%,to_location.ilike.%${hubName}%),` +
        `and(from_location.ilike.%${hubName}%,to_location.ilike.%${from}%)`
      )
      .limit(1)

    if (!legA?.length) continue

    const { data: legB } = await supabase
      .from('routes')
      .select('id, from_location, to_location, official_fare, estimated_duration_mins, transport_type')
      .or(
        `and(from_location.ilike.%${hubName}%,to_location.ilike.%${to}%),` +
        `and(from_location.ilike.%${to}%,to_location.ilike.%${hubName}%)`
      )
      .limit(1)

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
