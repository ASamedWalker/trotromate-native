import { formatGHS } from '@/lib/utils/currency'
import { ageLabel, STALE_MS } from '@/lib/utils/freshness'
import type { RouteWithStats } from '@/lib/types'
import { t } from '@/lib/i18n'
import { ageT } from '@/lib/i18n/home-format'

// Exactly one fare-source label per line row (UX v2 L1 / L6).
//   gprtu   GPRTU only                        → "GPRTU fare"
//   riders  riders only                       → "~GH₵12" + "8 reports · 40 min ago"
//   agree   both, riders within 20%           → GPRTU fare + "Riders agree · 2h ago"
//   differ  both, riders more than 20% off    → GPRTU fare + "Riders paid GH₵5.50 · 2h ago" (amber when higher)
//   none    no verified fare, no reports      → "Be first to report"
export type FareSourceKind = 'gprtu' | 'riders' | 'agree' | 'differ' | 'none'

export interface FareSource {
  kind: FareSourceKind
  /** the hero number; null when there is no fare to show */
  amount: number | null
  /** rider-only fares carry a "~" in front of the amount */
  approx: boolean
  /** the one chip beside the fare */
  chip: 'GPRTU' | 'RIDERS' | null
  /** the one provenance line under the name ('' when the chip says it all) */
  provenance: string
  /** provenance carries a report age */
  hasAge: boolean
  /** riders paid noticeably MORE than the GPRTU fare */
  warn: boolean
  /** the provenance age is over 2 h — render it at 60% opacity */
  aged: boolean
}

export const FARE_AGREE_TOLERANCE = 0.2

export function fareSource(item: Pick<RouteWithStats, 'is_gprtu_verified' | 'official_fare' | 'fare_stats'>, now: number = Date.now()): FareSource {
  const reports = item.fare_stats?.report_count ?? 0
  const avg = item.fare_stats?.avg_reported_fare != null ? Number(item.fare_stats.avg_reported_fare) : null
  const lastAt = item.fare_stats?.last_report_at ?? null
  const official = item.official_fare != null ? Number(item.official_fare) : null
  const gprtu = !!item.is_gprtu_verified && official != null && official > 0
  const hasRiders = reports > 0 && avg != null && avg > 0
  const age = ageLabel(lastAt, now)
  const aged = !!lastAt && now - new Date(lastAt).getTime() > STALE_MS
  const withAge = (s: string) => (age ? `${s} · ${ageT(age)}` : s)

  if (gprtu && hasRiders) {
    const diff = (avg! - official!) / official!
    if (Math.abs(diff) <= FARE_AGREE_TOLERANCE) {
      return { kind: 'agree', amount: official, approx: false, chip: 'GPRTU', provenance: withAge(t('fare.ridersAgree')), hasAge: !!age, warn: false, aged }
    }
    return { kind: 'differ', amount: official, approx: false, chip: 'GPRTU', provenance: withAge(t('fare.ridersPaid', { amount: formatGHS(avg!) })), hasAge: !!age, warn: diff > 0, aged }
  }
  if (gprtu) {
    // The chip already says GPRTU; no second label.
    return { kind: 'gprtu', amount: official, approx: false, chip: 'GPRTU', provenance: '', hasAge: false, warn: false, aged: false }
  }
  if (hasRiders) {
    return {
      kind: 'riders', amount: avg, approx: true, chip: 'RIDERS',
      provenance: withAge(t(reports === 1 ? 'fare.report.one' : 'fare.report.many', { n: reports })), hasAge: !!age, warn: false, aged,
    }
  }
  return { kind: 'none', amount: null, approx: true, chip: null, provenance: t('fare.beFirst'), hasAge: false, warn: false, aged: false }
}

/** Amber that passes 4.5:1 on white (matches QUEUE_COLOR.moderate). */
export const FARE_WARN_COLOR = '#B45309'
