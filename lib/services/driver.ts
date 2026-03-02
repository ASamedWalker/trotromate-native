import { supabase } from '@/lib/supabase'
import {
  validateDisplayName,
  validateLocation,
  validateFare,
  validateIntRange,
  validateEnum,
  validateVehicleNumber,
  DRIVER_ROLES,
} from '@/lib/security/validate'

export interface DriverProfile {
  id: string
  device_id: string
  display_name: string
  role: 'driver' | 'mate'
  vehicle_number: string | null
  is_active: boolean
}

export interface DriverTrip {
  id: string
  from_location: string
  to_location: string
  passengers: number
  fare_collected: number
  departed_at: string
}

export interface DriverStats {
  total_trips: number
  total_earnings: number
  total_passengers: number
  avg_fare: number
}

export async function getDriverProfile(deviceId: string): Promise<DriverProfile | null> {
  const { data } = await supabase
    .from('driver_profiles')
    .select('*')
    .eq('device_id', deviceId)
    .single()
  return data as DriverProfile | null
}

export async function registerDriver(
  deviceId: string,
  displayName: string,
  role: 'driver' | 'mate',
  vehicleNumber?: string
): Promise<DriverProfile | null> {
  const name = validateDisplayName(displayName)
  const validRole = validateEnum(role, DRIVER_ROLES)
  const vehicle = validateVehicleNumber(vehicleNumber)

  if (!name || !validRole) return null

  const { data, error } = await supabase
    .from('driver_profiles')
    .upsert(
      {
        device_id: deviceId,
        display_name: name,
        role: validRole,
        vehicle_number: vehicle,
      },
      { onConflict: 'device_id' }
    )
    .select()
    .single()

  if (error) {
    console.error('Driver registration error:', error)
    return null
  }
  return data as DriverProfile
}

export async function getDriverTrips(
  deviceId: string,
  period: 'today' | 'week' | 'month' = 'today'
): Promise<{ trips: DriverTrip[]; stats: DriverStats }> {
  const now = new Date()
  let startDate: string
  if (period === 'week') {
    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  } else if (period === 'month') {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  } else {
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  }

  const { data: trips } = await supabase
    .from('driver_trips')
    .select('*')
    .eq('driver_device_id', deviceId)
    .gte('departed_at', startDate)
    .order('departed_at', { ascending: false })

  const tripList = (trips || []) as DriverTrip[]
  const totalTrips = tripList.length
  const totalEarnings = tripList.reduce((sum, t) => sum + (t.fare_collected || 0), 0)
  const totalPassengers = tripList.reduce((sum, t) => sum + (t.passengers || 0), 0)

  return {
    trips: tripList,
    stats: {
      total_trips: totalTrips,
      total_earnings: totalEarnings,
      total_passengers: totalPassengers,
      avg_fare: totalTrips > 0 ? totalEarnings / totalTrips : 0,
    },
  }
}

export async function logTrip(
  deviceId: string,
  from: string,
  to: string,
  passengers: number,
  fareCollected: number,
  routeId?: string
): Promise<DriverTrip | null> {
  const fromClean = validateLocation(from)
  const toClean = validateLocation(to)
  const validPassengers = validateIntRange(passengers, 0, 200)
  const validFare = validateFare(fareCollected)

  if (!fromClean || !toClean || validPassengers === null || validFare === null) return null

  const { data, error } = await supabase
    .from('driver_trips')
    .insert({
      driver_device_id: deviceId,
      route_id: routeId || null,
      from_location: fromClean,
      to_location: toClean,
      passengers: validPassengers,
      fare_collected: validFare,
    })
    .select()
    .single()

  if (error) {
    console.error('Trip log error:', error)
    return null
  }
  return data as DriverTrip
}
