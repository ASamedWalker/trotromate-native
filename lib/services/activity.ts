import { supabase } from '@/lib/supabase/client'

interface FareReportRow {
  id: string
  route_id: string
  reported_fare: number
  reported_at: string
  routes: { from_location: string; to_location: string } | null
}

interface TrainReportRow {
  id: string
  report_type: string
  reported_at: string
  train_stations: { name: string } | null
  train_lines: { name: string } | null
}

export interface ActivityItem {
  id: string
  type: 'fare' | 'queue' | 'incident' | 'tale' | 'train' | 'trip'
  title: string
  subtitle: string
  timestamp: string
  meta?: string
}

export const PAGE_SIZE = 10

export async function fetchRecentActivity(
  limit = PAGE_SIZE,
  before?: string
): Promise<ActivityItem[]> {
  const items: ActivityItem[] = []

  let fareQuery = supabase
    .from('fare_reports')
    .select('id, route_id, reported_fare, reported_at, routes!inner(from_location, to_location)')
    .order('reported_at', { ascending: false })
    .limit(limit)

  let queueQuery = supabase
    .from('queue_reports')
    .select('id, station_name, queue_status, reported_at')
    .order('reported_at', { ascending: false })
    .limit(limit)

  let incidentQuery = supabase
    .from('incident_reports')
    .select('id, location_name, incident_type, reported_at')
    .order('reported_at', { ascending: false })
    .limit(limit)

  let taleQuery = supabase
    .from('tale_posts')
    .select('id, display_name, location_name, post_type, created_at')
    .eq('is_hidden', false)
    .order('created_at', { ascending: false })
    .limit(limit)

  let trainQuery = supabase
    .from('train_reports')
    .select('id, report_type, reported_at, train_stations(name), train_lines(name)')
    .order('reported_at', { ascending: false })
    .limit(limit)

  let tripQuery = supabase
    .from('completed_trips')
    .select('id, from_location, to_location, transport_type, duration_mins, fare_paid, reached_destination, started_at')
    .order('started_at', { ascending: false })
    .limit(limit)

  // Cursor-based pagination: fetch only items older than `before`
  if (before) {
    fareQuery = fareQuery.lt('reported_at', before)
    queueQuery = queueQuery.lt('reported_at', before)
    incidentQuery = incidentQuery.lt('reported_at', before)
    taleQuery = taleQuery.lt('created_at', before)
    trainQuery = trainQuery.lt('reported_at', before)
    tripQuery = tripQuery.lt('started_at', before)
  }

  const [fareRes, queueRes, incidentRes, taleRes, trainRes, tripRes] = await Promise.all([
    fareQuery,
    queueQuery,
    incidentQuery,
    taleQuery,
    trainQuery,
    tripQuery,
  ])

  if (fareRes.data) {
    for (const r of fareRes.data) {
      const route = (r as unknown as FareReportRow).routes
      items.push({
        id: `fare-${r.id}`,
        type: 'fare',
        title: `${route?.from_location ?? '?'} → ${route?.to_location ?? '?'}`,
        subtitle: `Fare reported: ₵${(r.reported_fare as number).toFixed(2)}`,
        timestamp: r.reported_at as string,
      })
    }
  }

  if (queueRes.data) {
    for (const r of queueRes.data) {
      items.push({
        id: `queue-${r.id}`,
        type: 'queue',
        title: r.station_name ?? 'Unknown Station',
        subtitle: `Queue: ${r.queue_status}`,
        timestamp: r.reported_at as string,
      })
    }
  }

  if (incidentRes.data) {
    for (const r of incidentRes.data) {
      const typeLabels: Record<string, string> = {
        traffic: 'Heavy Traffic',
        accident: 'Accident',
        police: 'Police Checkpoint',
        roadwork: 'Road Work',
      }
      items.push({
        id: `incident-${r.id}`,
        type: 'incident',
        title: r.location_name ?? 'Unknown',
        subtitle: typeLabels[r.incident_type as string] ?? r.incident_type,
        timestamp: r.reported_at as string,
      })
    }
  }

  if (taleRes.data) {
    for (const r of taleRes.data) {
      items.push({
        id: `tale-${r.id}`,
        type: 'tale',
        title: (r.display_name as string) ?? 'Someone',
        subtitle: `Shared a tale from ${r.location_name}`,
        timestamp: r.created_at as string,
      })
    }
  }

  if (trainRes.data) {
    const trainTypeLabels: Record<string, string> = {
      schedule: 'Train Spotted',
      crowd: 'Crowd Report',
      fare: 'Fare Report',
      delay: 'Delay Report',
    }
    for (const r of trainRes.data) {
      const station = (r as unknown as TrainReportRow).train_stations
      const line = (r as unknown as TrainReportRow).train_lines
      items.push({
        id: `train-${r.id}`,
        type: 'train',
        title: station?.name ?? 'Train Station',
        subtitle: `${trainTypeLabels[r.report_type as string] ?? r.report_type}${line?.name ? ` · ${line.name}` : ''}`,
        timestamp: r.reported_at as string,
      })
    }
  }

  if (tripRes.data) {
    for (const r of tripRes.data) {
      const farePart = r.fare_paid ? ` · GH₵${Number(r.fare_paid).toFixed(2)}` : ''
      const durationPart = r.duration_mins ? `${r.duration_mins} min` : ''
      items.push({
        id: `trip-${r.id}`,
        type: 'trip',
        title: `${r.from_location} → ${r.to_location}`,
        subtitle: `${r.transport_type === 'train' ? 'Train' : 'Trotro'} trip${durationPart ? ` · ${durationPart}` : ''}${farePart}`,
        timestamp: r.started_at as string,
        meta: r.reached_destination ? 'arrived' : 'ended',
      })
    }
  }

  items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  return items.slice(0, limit)
}
