/**
 * Active passes (tickets) shown on the Wallet screen.
 *
 * Source of truth is the wallet backend (troski.me), NOT a direct Supabase
 * read — tickets are financial data tied to a wallet, so they come through the
 * authenticated wallet API alongside balance/transactions. The backend resolves
 * the user's wallet from auth_user_id and returns their active tickets.
 *
 * Contract — `/api/wallet/balance?auth_user_id=` returns:
 *   { balance, transactions, passes: ActivePass[] }
 * (or a sibling `/api/wallet/passes?auth_user_id=` returning ActivePass[]).
 */
export interface ActivePass {
  trip_code: string
  route_label: string
  van_plate: string | null
  fare: number
  currency: string // 'GHS'
  status: 'active' | 'used' | 'expired'
  expires_at: string | null
}

export interface MyTicket {
  trip_code: string
  route_label: string
  van_plate: string | null
  fare: number
  currency: string
  status: 'active' | 'used' | 'expired' | 'cancelled'
  expires_at: string | null
  used_at: string | null
  created_at: string
}

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://www.troski.me'

/** All of a user's tickets (every status), newest first. */
export async function fetchMyTickets(authUserId: string): Promise<MyTicket[]> {
  try {
    const res = await fetch(`${API_URL}/api/tickets/list?auth_user_id=${authUserId}`)
    const data = await res.json().catch(() => null)
    return Array.isArray(data?.tickets) ? data.tickets : []
  } catch {
    return []
  }
}

/** Parse + keep only genuinely-active, non-expired passes, soonest expiry first */
export function normalizeActivePasses(raw: unknown, nowMs: number): ActivePass[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((p): p is ActivePass => !!p && typeof p === 'object' && (p as ActivePass).status === 'active')
    .filter((p) => !p.expires_at || new Date(p.expires_at).getTime() > nowMs)
    .sort((a, b) => {
      const ea = a.expires_at ? new Date(a.expires_at).getTime() : Infinity
      const eb = b.expires_at ? new Date(b.expires_at).getTime() : Infinity
      return ea - eb
    })
}

/** "24 Oct 2026" — expiry label for the pass card */
export function formatPassExpiry(iso: string | null): string {
  if (!iso) return 'No expiry'
  return new Date(iso).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })
}
