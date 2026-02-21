import { supabase } from '@/lib/supabase'

export interface TripShare {
  id: string
  from_location: string
  to_location: string
  share_token: string
  status: 'active' | 'arrived' | 'cancelled'
  started_at: string
  estimated_arrival: string | null
}

export interface EmergencyContact {
  id: string
  device_id: string
  contact_name: string
  contact_phone: string
}

export async function createTripShare(
  deviceId: string,
  from: string,
  to: string,
  routeId?: string,
  estimatedMins?: number
): Promise<TripShare | null> {
  const shareToken = Array.from({ length: 8 }, () => Math.floor(Math.random() * 16).toString(16)).join('')

  const estimatedArrival = estimatedMins
    ? new Date(Date.now() + estimatedMins * 60 * 1000).toISOString()
    : null

  const { data, error } = await supabase
    .from('trip_shares')
    .insert({
      device_id: deviceId,
      route_id: routeId || null,
      from_location: from,
      to_location: to,
      share_token: shareToken,
      estimated_arrival: estimatedArrival,
    })
    .select()
    .single()

  if (error) {
    console.error('Trip share error:', error)
    return null
  }

  return data as TripShare
}

export async function updateTripStatus(shareToken: string, status: 'arrived' | 'cancelled') {
  const { error } = await supabase
    .from('trip_shares')
    .update({ status })
    .eq('share_token', shareToken)

  return !error
}

export async function submitSafetyRating(
  deviceId: string,
  routeId: string,
  rating: 'positive' | 'negative',
  category?: string
) {
  const { data, error } = await supabase
    .from('safety_ratings')
    .insert({
      device_id: deviceId,
      route_id: routeId,
      rating,
      category: category || null,
    })
    .select()
    .single()

  if (error) {
    console.error('Safety rating error:', error)
    return null
  }

  return data
}

export async function getEmergencyContact(deviceId: string): Promise<EmergencyContact | null> {
  const { data } = await supabase
    .from('emergency_contacts')
    .select('*')
    .eq('device_id', deviceId)
    .single()

  return data as EmergencyContact | null
}

export async function saveEmergencyContact(
  deviceId: string,
  contactName: string,
  contactPhone: string
): Promise<EmergencyContact | null> {
  const { data, error } = await supabase
    .from('emergency_contacts')
    .upsert(
      { device_id: deviceId, contact_name: contactName, contact_phone: contactPhone },
      { onConflict: 'device_id' }
    )
    .select()
    .single()

  if (error) {
    console.error('Emergency contact error:', error)
    return null
  }

  return data as EmergencyContact
}
