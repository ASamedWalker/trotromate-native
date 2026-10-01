import { supabase } from '@/lib/supabase/client'

export interface AssignedVehicle {
  vanId: string
  driverId: string | null
  plate: string
  vehicleType: string | null
  capacity: number | null
  driverName: string | null
  isOnShift: boolean
  driverPhotoUrl: string | null
  kycVerified: boolean
  driverSince: string | null // ISO — for "N yrs with Troski"
}

/**
 * The Troski bus assigned to a route (Phase 1 = own fleet). Matches an active
 * fleet_van whose route_label covers the booked origin + destination, with its
 * assigned driver. Returns null when no bus is assigned to that route yet.
 */
export async function fetchAssignedVehicle(from?: string, to?: string): Promise<AssignedVehicle | null> {
  if (!from?.trim() || !to?.trim()) return null
  try {
    // public_checkout_vehicles (migration 079): first name + safe fields only.
    // Signed-in users can no longer read fleet_vans/fleet_drivers directly.
    const { data, error } = await supabase
      .from('public_checkout_vehicles')
      .select('van_id, plate_number, vehicle_type, capacity, driver_id, first_name, is_on_shift, photo_url, kyc_status, driver_since')
      .ilike('route_label', `%${from.trim()}%`)
      .ilike('route_label', `%${to.trim()}%`)
      .limit(1)
    if (error) return null
    const v = data?.[0] as
      | {
          van_id: string; plate_number: string; vehicle_type: string | null; capacity: number | null
          driver_id: string | null; first_name: string | null; is_on_shift: boolean | null
          photo_url: string | null; kyc_status: string | null; driver_since: string | null
        }
      | undefined
    if (!v) return null
    return {
      vanId: v.van_id,
      driverId: v.driver_id,
      plate: v.plate_number,
      vehicleType: v.vehicle_type,
      capacity: v.capacity,
      driverName: v.first_name,
      isOnShift: !!v.is_on_shift,
      driverPhotoUrl: v.photo_url,
      kycVerified: v.kyc_status === 'approved' || v.kyc_status === 'verified',
      driverSince: v.driver_since,
    }
  } catch {
    return null
  }
}
