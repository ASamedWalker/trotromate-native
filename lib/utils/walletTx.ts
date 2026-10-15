import { Clock, X, Ticket, Undo2, Plus, type LucideIcon } from 'lucide-react-native'
import { formatGHS } from '@/lib/utils/currency'
import { hhmm } from '@/lib/utils/clock'
import { NETWORK_NAME, maskPhone } from '@/lib/services/topup'

/**
 * How one wallet transaction reads in a list or detail (UX v2 W4/W7):
 * true "−" for debits, credits green only when settled, refunds neutral with
 * ↶ (Undo2), failed red ✕ with the amount struck through, and a status pill
 * only for Waiting / Failed / Refunded.
 */
export type TxTone = 'wait' | 'brand' | 'bad' | 'neutral' | 'ok'

export const TX_TONE: Record<TxTone, { bg: string; fg: string }> = {
  wait: { bg: '#FFFBEB', fg: '#B45309' },
  brand: { bg: '#FFF1EC', fg: '#C2360F' },
  bad: { bg: '#FEF2F2', fg: '#B91C1C' },
  neutral: { bg: '#F3F4F6', fg: '#44403C' },
  ok: { bg: '#ECFDF3', fg: '#15803D' },
}

export type TxPill = 'Waiting' | 'Failed' | 'Refunded'
export const TX_PILL: Record<TxPill, { bg: string; fg: string }> = {
  Waiting: { bg: '#FEF3C7', fg: '#B45309' },
  Failed: { bg: '#FEE2E2', fg: '#B91C1C' },
  Refunded: { bg: '#F3F4F6', fg: '#44403C' },
}

export interface TxView {
  tone: TxTone
  Icon: LucideIcon
  title: string
  sub: string
  /** "+GH₵10.00", "−GH₵8.95", or unsigned for failed */
  amountText: string
  amountColor: string
  strike: boolean
  pill: TxPill | null
  /** Detail-screen status line (W7) */
  statusLabel: string
  credit: boolean
}

/** "GH₵10.00" (no space — row style on the mockups). */
export const ghs = (n: number) => formatGHS(n).replace('GH₵ ', 'GH₵')

export function txView(tx: any): TxView {
  const amount = Math.abs(Number(tx?.amount) || 0)
  const status = String(tx?.status ?? 'success')
  const time = hhmm(tx?.created_at)
  const isTopup = tx?.type === 'topup'
  const isRefund = tx?.type === 'refund'
  const route = String(tx?.description || '')
    .replace(/^(Booking|Refund|Payment):\s*/i, '')
    .replace(/\bGHS\b/g, 'GH₵')
    .trim()

  if (isTopup) {
    const net = NETWORK_NAME[String(tx?.metadata?.provider ?? '')]
    const title = `Top-up · ${net ? `${net} MoMo` : 'MoMo'}`
    const phone = tx?.metadata?.phone ? maskPhone(String(tx.metadata.phone)) : ''
    if (status === 'pending') {
      return {
        tone: 'wait', Icon: Clock, title, sub: [time, phone].filter(Boolean).join(' · '),
        amountText: `+${ghs(amount)}`, amountColor: '#57534E', strike: false, pill: 'Waiting',
        statusLabel: 'Waiting for approval', credit: true,
      }
    }
    if (status === 'failed') {
      return {
        tone: 'bad', Icon: X, title, sub: `${time} · didn't go through`,
        amountText: ghs(amount), amountColor: '#A8A29E', strike: true, pill: 'Failed',
        statusLabel: 'Failed', credit: true,
      }
    }
    return {
      tone: 'ok', Icon: Plus, title, sub: [time, phone].filter(Boolean).join(' · '),
      amountText: `+${ghs(amount)}`, amountColor: '#15803D', strike: false, pill: null,
      statusLabel: 'Complete', credit: true,
    }
  }

  if (isRefund) {
    return {
      tone: 'neutral', Icon: Undo2, title: route || 'Ticket refund', sub: `${time} · ticket refund`,
      amountText: `+${ghs(amount)}`, amountColor: '#0A0A0A', strike: false, pill: 'Refunded',
      statusLabel: 'Refunded', credit: true,
    }
  }

  if (status === 'failed') {
    return {
      tone: 'bad', Icon: X, title: route || 'Payment', sub: `${time} · didn't go through`,
      amountText: ghs(amount), amountColor: '#A8A29E', strike: true, pill: 'Failed',
      statusLabel: 'Failed', credit: false,
    }
  }
  return {
    tone: 'brand', Icon: Ticket, title: route || 'Payment', sub: `${time} · Trotro ticket`,
    amountText: `−${ghs(amount)}`, amountColor: '#0A0A0A', strike: false, pill: status === 'pending' ? 'Waiting' : null,
    statusLabel: status === 'pending' ? 'Waiting' : 'Complete', credit: false,
  }
}

/** Route params for app/wallet/transaction-detail. */
export function txDetailHref(tx: any) {
  return {
    pathname: '/wallet/transaction-detail',
    params: {
      type: String(tx?.type ?? ''),
      amount: String(tx?.amount ?? ''),
      status: String(tx?.status ?? ''),
      description: String(tx?.description ?? ''),
      created_at: String(tx?.created_at ?? ''),
      reference: String(tx?.paystack_reference ?? tx?.id ?? ''),
      balance_after: String(tx?.balance_after ?? ''),
      provider: String(tx?.metadata?.provider ?? ''),
      phone: String(tx?.metadata?.phone ?? ''),
    },
  } as const
}
