import { supabase } from '@/lib/supabase/client'
import { findOrCreateRoute } from './routes'
import type { TransportType } from '@/lib/types'
import {
  validateLocation,
  validateFare,
  validateEnum,
  validateIntRange,
  QUEUE_STATUSES,
  INCIDENT_TYPES,
  TRANSPORT_TYPES,
} from '@/lib/security/validate'

export async function submitFareReport(params: {
  fromLocation: string
  toLocation: string
  fare: number
  deviceId: string
  transportType?: TransportType
}): Promise<{ reportId: string; routeId: string } | null> {
  const from = validateLocation(params.fromLocation)
  const to = validateLocation(params.toLocation)
  const fare = validateFare(params.fare)
  const transport = validateEnum(params.transportType || 'trotro', TRANSPORT_TYPES) || 'trotro'

  if (!from || !to || fare === null) return null

  const routeId = await findOrCreateRoute(from, to, fare, transport)
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
  stationId?: string
  vehicleCount?: number
}): Promise<{ reportId: string } | null> {
  const stationName = validateLocation(params.stationName)
  const queueStatus = validateEnum(params.queueStatus, QUEUE_STATUSES)
  const vehicleCount = params.vehicleCount != null
    ? validateIntRange(params.vehicleCount, 0, 500)
    : null

  if (!stationName || !queueStatus) return null

  const { data: report, error } = await supabase
    .from('queue_reports')
    .insert({
      station_id: params.stationId || null,
      station_name: stationName,
      queue_status: queueStatus,
      vehicle_count: vehicleCount,
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
  const locationName = validateLocation(params.locationName)
  const incidentType = validateEnum(params.incidentType, INCIDENT_TYPES)

  if (!locationName || !incidentType) return null

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
