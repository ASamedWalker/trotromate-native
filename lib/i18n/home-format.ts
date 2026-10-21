import { t } from './index'
import type { QueueStatus } from '@/lib/services/stations'

/**
 * Translation helpers for the Home / Lines / Stations / route screens. They wrap
 * shared English helpers (ageLabel, QUEUE_WORD, train "when") without changing
 * them. Callers must be inside a component that calls useLanguage() so they
 * re-render on a language change.
 */

/** Translate an ageLabel()/timeAgo() result: "just now", "12 min ago", "3 h ago", "4 d ago", "5 mo ago". */
export function ageT(label: string): string {
  if (!label) return label
  if (label === 'just now') return t('homeX.age.now')
  if (label === 'No reports yet') return t('homeX.noReportsYet')
  const m = /^(\d+) (min|h|d|mo) ago$/.exec(label)
  return m ? t(`homeX.age.${m[2]}`, { n: m[1] }) : label
}

/** QUEUE_WORD in the current language ("Long queue"). */
export function queueWordT(status: QueueStatus): string {
  return t(`homeX.q.${status}`)
}

/** QUEUE_WORD without the trailing "queue" ("Long"). */
export function queueShortT(status: QueueStatus): string {
  return t(`homeX.qs.${status}`)
}

/** Train departure "when": Today / Tomorrow / weekday name. */
export function dayT(when: string): string {
  if (when === 'Today') return t('homeX.today')
  if (when === 'Tomorrow') return t('homeX.tomorrow')
  const k = `homeX.day.${when}`
  const v = t(k)
  return v === k ? when : v
}

/** "Madina Station" / "Gare de Madina" / "Gare d'Achimota". */
export function stationNameT(name: string): string {
  return t(/^[aeiouhàâäéèêëîïôöûüÀÂÄÉÈÊËÎÏÔÖÛÜAEIOUH]/.test(name) ? 'stations.stationOfV' : 'stations.stationOf', { name })
}
