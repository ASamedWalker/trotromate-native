/**
 * Booking client — calls the real backend POST /api/bookings/create, which
 * atomically debits the wallet (debit_wallet) and issues a ticket.
 * Backend contract (trotromate/app/api/bookings/create):
 *   body: { auth_user_id, route_label, pickup_name, dropoff_name, vehicle_type, fare, plate_number? }
 *   200:  { success, booking:{id,status,route_label,fare,vehicle_type}, ticket:{trip_code,expires_at}, new_balance }
 *   400:  { error: 'Insufficient balance', balance } | other validation
 */
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://www.troski.me'

export interface BookingRequest {
  authUserId: string
  routeLabel: string
  pickupName?: string
  dropoffName?: string
  vehicleType?: string
  fare: number
  plateNumber?: string
}

export interface BookingTicket {
  trip_code: string
  expires_at: string
  route_label: string
  fare: number
}

export type BookingResult =
  | { ok: true; ticket: BookingTicket; bookingId: string; newBalance: number }
  | { ok: false; reason: 'insufficient_balance'; balance?: number }
  | { ok: false; reason: 'error'; message?: string }

export async function createBooking(req: BookingRequest): Promise<BookingResult> {
  try {
    const res = await fetch(`${API_URL}/api/bookings/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auth_user_id: req.authUserId,
        route_label: req.routeLabel,
        pickup_name: req.pickupName ?? null,
        dropoff_name: req.dropoffName ?? null,
        vehicle_type: req.vehicleType ?? 'everyday',
        fare: req.fare,
        plate_number: req.plateNumber ?? null,
      }),
    })
    const data = await res.json().catch(() => null)

    if (res.ok && data?.success && data?.ticket) {
      return {
        ok: true,
        bookingId: data.booking?.id,
        newBalance: Number(data.new_balance ?? 0),
        ticket: {
          trip_code: data.ticket.trip_code,
          expires_at: data.ticket.expires_at,
          route_label: data.booking?.route_label ?? req.routeLabel,
          fare: Number(data.booking?.fare ?? req.fare),
        },
      }
    }
    if (res.status === 400 && /insufficient/i.test(data?.error ?? '')) {
      return { ok: false, reason: 'insufficient_balance', balance: data?.balance }
    }
    return { ok: false, reason: 'error', message: data?.error }
  } catch (e: any) {
    return { ok: false, reason: 'error', message: e?.message }
  }
}
