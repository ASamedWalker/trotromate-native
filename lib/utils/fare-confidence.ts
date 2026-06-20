import type { RouteWithStats } from '@/lib/types'

/**
 * Crowd-confidence grade for a route's fare data — surfaces the contributor
 * loop back to riders (Transit pattern: per-line crowd scores). Derived from
 * how many reports back the fare and how fresh the latest one is.
 */
export interface FareConfidence {
  level: 'high' | 'medium' | 'low'
  label: string
  color: string
}

const DAY_MS = 86_400_000

export function fareConfidence(stats?: RouteWithStats['fare_stats'] | null): FareConfidence | null {
  const count = stats?.report_count ?? 0
  if (count === 0) return null // cards already show "No reports yet"

  const last = stats?.last_report_at ? Date.parse(stats.last_report_at) : 0
  const ageDays = last > 0 ? (Date.now() - last) / DAY_MS : Number.POSITIVE_INFINITY

  if (count >= 5 && ageDays <= 7) {
    return { level: 'high', label: 'Reliable fare', color: '#16a34a' }
  }
  if (count >= 2 && ageDays <= 30) {
    return { level: 'medium', label: `${count} reports`, color: '#d97706' }
  }
  return { level: 'low', label: 'Few reports', color: '#9CA3AF' }
}
