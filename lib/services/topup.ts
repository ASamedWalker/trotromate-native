import { authedFetch } from '@/lib/services/authedFetch'

/**
 * MoMo top-ups are async: POST /api/wallet/topup only SENDS a prompt to the rider's
 * phone (a request, not a payment). Money lands when the rider approves with their
 * PIN and Paystack confirms (webhook or the server's reconcile). These helpers keep
 * those states apart: prompt_sent (pending) → credited (success) or failed.
 */

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://www.troski.me'

/** Help copy for "No prompt?". TODO(owner): confirm the real per-network USSD
 *  approval steps (MTN *170# path, Telecel, AirtelTigo) before showing them. */
export const NO_PROMPT_HELP = 'Open your MoMo menu and look for pending approvals.'

/** Pending top-ups older than this stop showing in the Wallet strip / checkout. */
export const PENDING_WINDOW_MS = 60 * 60 * 1000

export type TopupProvider = 'mtn' | 'tgo' | 'atl'
export const NETWORK_NAME: Record<string, string> = { mtn: 'MTN', tgo: 'Telecel', atl: 'AirtelTigo' }

export type StartTopupResult =
  | { ok: true; reference: string }
  | { ok: false; status: number; error: string }

export async function startTopup(p: {
  userId: string; amount: number; phone: string; provider: string
}): Promise<StartTopupResult> {
  try {
    const res = await authedFetch(`${API_URL}/api/wallet/topup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ auth_user_id: p.userId, amount: p.amount, phone: p.phone, provider: p.provider }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok && data?.success && typeof data.reference === 'string') return { ok: true, reference: data.reference }
    return {
      ok: false,
      status: res.status,
      error: typeof data?.error === 'string' ? data.error : 'We could not send the MoMo prompt. Check the number and try again.',
    }
  } catch {
    return { ok: false, status: 0, error: 'Could not reach Troski. Check your connection and try again.' }
  }
}

export type TopupState = 'pending' | 'success' | 'failed' | 'unknown'
export interface TopupStatus { state: TopupState; amount: number | null; newBalance: number | null }

const toState = (s: unknown): TopupState =>
  s === 'pending' ? 'pending' : s === 'success' ? 'success' : s === 'failed' ? 'failed' : 'unknown'

/**
 * One top-up's status. Uses GET /api/wallet/topup/status; if that route isn't
 * deployed yet (404 without our code), falls back to the balance endpoint's
 * recent transactions (which also reconciles pending top-ups server-side).
 * Throws on network/server errors so the caller can just try again next tick.
 */
export async function fetchTopupStatus(userId: string, reference: string): Promise<TopupStatus> {
  const q = `auth_user_id=${encodeURIComponent(userId)}&reference=${encodeURIComponent(reference)}`
  const res = await authedFetch(`${API_URL}/api/wallet/topup/status?${q}`)
  const data = await res.json().catch(() => null)
  if (res.ok && data) {
    return { state: toState(data.status), amount: num(data.amount), newBalance: num(data.new_balance) }
  }
  if (res.status === 404 && data?.code === 'TOPUP_NOT_FOUND') return { state: 'unknown', amount: null, newBalance: null }
  if (res.status !== 404) throw new Error(`topup status ${res.status}`)

  const bal = await authedFetch(`${API_URL}/api/wallet/balance?auth_user_id=${encodeURIComponent(userId)}`)
  if (!bal.ok) throw new Error(`wallet ${bal.status}`)
  const b = await bal.json()
  const tx = (Array.isArray(b.transactions) ? b.transactions : []).find((t: any) => t?.paystack_reference === reference)
  if (!tx) return { state: 'unknown', amount: null, newBalance: num(b.balance) }
  return { state: toState(tx.status), amount: num(tx.amount), newBalance: num(b.balance) }
}

function num(v: unknown): number | null {
  const n = Number(v)
  return v == null || !isFinite(n) ? null : n
}

/** A pending top-up row from the balance endpoint's transactions. */
export interface PendingTopup {
  reference: string
  amount: number
  phone: string
  provider: string
  createdAt: string
}

/** Pending MoMo top-ups from the last hour, newest first. */
export function pendingTopups(transactions: any[], now = Date.now()): PendingTopup[] {
  return (transactions ?? [])
    .filter((t) => t?.type === 'topup' && t?.status === 'pending' && typeof t?.paystack_reference === 'string')
    .filter((t) => {
      const at = new Date(t.created_at).getTime()
      return isFinite(at) && now - at < PENDING_WINDOW_MS
    })
    .map((t) => ({
      reference: t.paystack_reference,
      amount: Number(t.amount) || 0,
      phone: String(t.metadata?.phone ?? ''),
      provider: String(t.metadata?.provider ?? ''),
      createdAt: String(t.created_at),
    }))
}

/** "GH₵10" for whole cedis, "GH₵10.50" otherwise (headline copy). */
export function shortGHS(n: number): string {
  return Number.isInteger(n) ? `GH₵${n}` : `GH₵${n.toFixed(2)}`
}

/** "+233244567890" / "0244567890" → "024 ••• 7890". */
export function maskPhone(phone: string): string {
  const local = phone.replace(/\D/g, '').replace(/^233/, '').replace(/^0/, '')
  if (local.length < 7) return phone
  return `0${local.slice(0, 2)} ••• ${local.slice(-4)}`
}

/** "0:42", "3:05" */
export function formatElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Route params for the pending/credited/failed screen. */
export function topupStatusHref(p: PendingTopup & { returnTo?: string; pops?: string }) {
  return {
    pathname: '/wallet/topup-status',
    params: {
      reference: p.reference,
      amount: String(p.amount),
      phone: p.phone,
      provider: p.provider,
      startedAt: p.createdAt,
      ...(p.returnTo ? { return: p.returnTo } : {}),
      ...(p.pops ? { pops: p.pops } : {}),
    },
  } as const
}
