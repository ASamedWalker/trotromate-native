// How trustworthy a crowd report is by age (redesign: docs/strategy/troski-redesign-architecture.md §4).
// Matches the 2h QUEUE_FRESH_MS window the stations / queue screens already use.

export type Freshness = 'fresh' | 'aging' | 'stale'

export const FRESH_MS = 30 * 60 * 1000
export const STALE_MS = 2 * 60 * 60 * 1000

export function freshness(reportedAt: string | null | undefined, now: number = Date.now()): Freshness {
  if (!reportedAt) return 'stale'
  const age = now - new Date(reportedAt).getTime()
  if (!Number.isFinite(age) || age > STALE_MS) return 'stale'
  return age < FRESH_MS ? 'fresh' : 'aging'
}

/** THE age text every status carries (UX v2 canvas wording): "just now",
 *  "12 min ago", "3 h ago", "4 d ago", "5 mo ago". Always a number, never a vague
 *  "months ago" (honest-data rule). */
export function ageLabel(reportedAt: string | null | undefined, now: number = Date.now()): string {
  if (!reportedAt) return ''
  const t = new Date(reportedAt).getTime()
  if (Number.isNaN(t)) return ''
  const mins = Math.max(0, Math.round((now - t) / 60000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 48) return `${hours} h ago`
  const days = Math.floor(hours / 24)
  if (days < 60) return `${days} d ago`
  return `${Math.floor(days / 30)} mo ago`
}
