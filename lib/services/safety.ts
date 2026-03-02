import { supabase } from '@/lib/supabase'
import {
  validateLocation,
  validateEnum,
  validateIntRange,
  validateDisplayName,
  isValidGhanaPhone,
  sanitizeString,
  SAFETY_RATINGS,
  TRIP_STATUSES,
  SAFETY_CATEGORIES,
} from '@/lib/security/validate'

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

/** Generate a cryptographically stronger 32-char hex token */
function generateShareToken(): string {
  const bytes = new Uint8Array(16)
  // globalThis.crypto is available in React Native's Hermes engine
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes)
  } else {
    // Fallback — still 32 chars, much better than 8
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256)
    }
  }
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

export async function createTripShare(
  deviceId: string,
  from: string,
  to: string,
  routeId?: string,
  estimatedMins?: number
): Promise<TripShare | null> {
  const fromClean = validateLocation(from)
  const toClean = validateLocation(to)
  if (!fromClean || !toClean) return null

  const mins = estimatedMins != null
    ? validateIntRange(estimatedMins, 1, 600)
    : null

  const shareToken = generateShareToken()

  const estimatedArrival = mins
    ? new Date(Date.now() + mins * 60 * 1000).toISOString()
    : null

  const { data, error } = await supabase
    .from('trip_shares')
    .insert({
      device_id: deviceId,
      route_id: routeId || null,
      from_location: fromClean,
      to_location: toClean,
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
  const validStatus = validateEnum(status, TRIP_STATUSES)
  if (!validStatus || validStatus === 'active') return false

  const { error } = await supabase
    .from('trip_shares')
    .update({ status: validStatus })
    .eq('share_token', shareToken)

  return !error
}

export async function submitSafetyRating(
  deviceId: string,
  routeId: string,
  rating: 'positive' | 'negative',
  category?: string
) {
  const validRating = validateEnum(rating, SAFETY_RATINGS)
  if (!validRating) return null

  const validCategory = category ? validateEnum(category, SAFETY_CATEGORIES) : null

  const { data, error } = await supabase
    .from('safety_ratings')
    .insert({
      device_id: deviceId,
      route_id: routeId,
      rating: validRating,
      category: validCategory,
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
  const name = validateDisplayName(contactName)
  if (!name) return null

  const cleanPhone = contactPhone.replace(/[\s-]/g, '')
  if (!isValidGhanaPhone(cleanPhone)) return null

  const { data, error } = await supabase
    .from('emergency_contacts')
    .upsert(
      {
        device_id: deviceId,
        contact_name: sanitizeString(name, 100),
        contact_phone: cleanPhone,
      },
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
