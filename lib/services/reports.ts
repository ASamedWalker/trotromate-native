import { supabase } from '@/lib/supabase/client'
import { findOrCreateRoute } from './routes'

export async function submitFareReport(params: {
  fromLocation: string
  toLocation: string
  fare: number
  deviceId: string
}): Promise<{ reportId: string; routeId: string } | null> {
  const { fromLocation, toLocation, fare } = params

  const routeId = await findOrCreateRoute(fromLocation, toLocation, fare)
  if (!routeId) return null

  const { data: report, error } = await supabase
    .from('fare_reports')
    .insert({
      route_id: routeId,
      reported_fare: fare,
      reporter_phone: null,
    })
    .select('id')
    .single()

  if (error) {
    console.error('Error submitting fare report:', error)
    return null
  }

  return { reportId: report.id, routeId }
}

export async function submitQueueReport(params: {
  stationName: string
  queueStatus: string
  deviceId: string
}): Promise<{ reportId: string } | null> {
  const { stationName, queueStatus } = params

  const { data: report, error } = await supabase
    .from('queue_reports')
    .insert({
      station_id: null,
      station_name: stationName,
      queue_status: queueStatus,
      reporter_phone: null,
    })
    .select('id')
    .single()

  if (error) {
    console.error('Error submitting queue report:', error)
    return null
  }

  return { reportId: report.id }
}

export async function submitIncidentReport(params: {
  locationName: string
  incidentType: string
  deviceId: string
}): Promise<{ reportId: string } | null> {
  const { locationName, incidentType } = params

  const { data: report, error } = await supabase
    .from('incident_reports')
    .insert({
      location_name: locationName,
      incident_type: incidentType,
    })
    .select('id')
    .single()

  if (error) {
    console.error('Error submitting incident report:', error)
    return null
  }

  return { reportId: report.id }
}
