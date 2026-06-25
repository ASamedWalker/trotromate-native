import { supabase } from '@/lib/supabase/client'

export interface AssignedVehicle {
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
    const { data, error } = await supabase
      .from('fleet_vans')
      .select('plate_number, vehicle_type, capacity, fleet_drivers(name, is_on_shift, photo_url, kyc_status, created_at)')
      .ilike('route_label', `%${from.trim()}%`)
      .ilike('route_label', `%${to.trim()}%`)
      .eq('is_active', true)
      .limit(1)
    if (error) return null
    type Drv = { name: string; is_on_shift: boolean; photo_url: string | null; kyc_status: string | null; created_at: string | null }
    const v = data?.[0] as
      | { plate_number: string; vehicle_type: string | null; capacity: number | null; fleet_drivers: Drv[] | Drv | null }
      | undefined
    if (!v) return null
    const d = Array.isArray(v.fleet_drivers) ? v.fleet_drivers[0] : v.fleet_drivers
    return {
      plate: v.plate_number,
      vehicleType: v.vehicle_type,
      capacity: v.capacity,
      driverName: d?.name ?? null,
      isOnShift: !!d?.is_on_shift,
      driverPhotoUrl: d?.photo_url ?? null,
      kycVerified: d?.kyc_status === 'approved' || d?.kyc_status === 'verified',
      driverSince: d?.created_at ?? null,
    }
  } catch {
    return null
  }
}
