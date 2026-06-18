/**
 * Booking / ticketing client. Calls the authenticated booking endpoint which
 * atomically debits the wallet and issues a ticket (see
 * docs/BACKEND_BOOKING_SPEC.md). The booking screens consume this; until the
 * endpoint ships, createBooking returns { ok: false, reason: 'unavailable' }
 * and checkout falls back to the existing demo flow.
 */
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://www.troski.me'

export interface BookingRequest {
  authUserId: string
  routeId: string
  fromLocation: string
  toLocation: string
  fare: number
  serviceFee: number
  paymentMethod: 'wallet' | 'momo'
  momoProvider?: 'mtn' | 'atl' | 'tgo'
}

export interface IssuedTicket {
  trip_code: string
  route_label: string
  van_plate: string | null
  fare: number
  currency: string
  status: 'active'
  expires_at: string | null
  qr_payload: string
}

export type BookingResult =
  | { ok: true; bookingId: string; ticket: IssuedTicket }
  | { ok: false; reason: 'insufficient_funds'; balance?: number; required?: number }
  | { ok: false; reason: 'momo_pending'; bookingId?: string }
  | { ok: false; reason: 'unavailable' | 'error'; message?: string }

export async function createBooking(req: BookingRequest): Promise<BookingResult> {
  try {
    const res = await fetch(`${API_URL}/api/booking`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auth_user_id: req.authUserId,
        route_id: req.routeId,
        from_location: req.fromLocation,
        to_location: req.toLocation,
        fare: req.fare,
        service_fee: req.serviceFee,
        payment_method: req.paymentMethod,
        momo_provider: req.momoProvider,
      }),
    })

    // Endpoint not deployed yet → let the caller fall back to the demo flow
    if (res.status === 404) return { ok: false, reason: 'unavailable' }

    const data = await res.json().catch(() => null)

    if (res.ok && data?.ticket) {
      return { ok: true, bookingId: data.booking_id, ticket: data.ticket }
    }
    if (res.status === 402) {
      return { ok: false, reason: 'insufficient_funds', balance: data?.balance, required: data?.required }
    }
    if (res.status === 409 && data?.error === 'momo_pending') {
      return { ok: false, reason: 'momo_pending', bookingId: data?.booking_id }
    }
    return { ok: false, reason: 'error', message: data?.error }
  } catch (e: any) {
    return { ok: false, reason: 'error', message: e?.message }
  }
}
