import { View, Text } from 'react-native'
import { font } from '@/lib/theme'
import { FreshnessDot } from '@/components/FreshnessDot'
import { QueueGlyph } from '@/components/QueueGlyph'
import { QUEUE_COLOR } from '@/lib/constants/queueStatus'
import { freshness, ageLabel } from '@/lib/utils/freshness'
import type { QueueStatus } from '@/lib/services/stations'
import { useLanguage, t } from '@/lib/i18n'
import { ageT, queueWordT } from '@/lib/i18n/home-format'

interface Props {
  status: QueueStatus | null | undefined
  reportedAt: string | null | undefined
  size?: number
  /** white text for use on corridor-colour blocks */
  onColor?: boolean
  /** extra text after the age, e.g. "3 confirmed" */
  suffix?: string
}

/** QueueGlyph + "Long queue · 12 min ago" — or "— No recent report" once older than 2 h. */
export function QueueStatusLine({ status, reportedAt, size = 14, onColor = false, suffix }: Props) {
  useLanguage() // re-render on language change
  const kind = status ? freshness(reportedAt) : 'stale'
  if (kind === 'stale' || !status) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <FreshnessDot kind="stale" color="#9CA3AF" />
        <Text style={{ fontFamily: font.semibold, fontSize: size, color: onColor ? 'rgba(255,255,255,0.85)' : '#6B7280' }}>{t('homeX.noRecentReport')}</Text>
      </View>
    )
  }
  const color = onColor ? '#FFFFFF' : QUEUE_COLOR[status]
  const sub = onColor ? 'rgba(255,255,255,0.85)' : '#5F6670'
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
      <QueueGlyph status={status} color={color} size={size} opacity={kind === 'aging' ? 0.8 : 1} />
      <Text style={{ fontFamily: font.extrabold, fontSize: size, color, opacity: kind === 'aging' ? 0.8 : 1 }}>{queueWordT(status)}</Text>
      <Text style={{ fontFamily: font.regular, fontSize: size - 1, color: sub, flexShrink: 1 }} numberOfLines={1}>
        · {ageT(ageLabel(reportedAt))}{suffix ? ` · ${suffix}` : ''}
      </Text>
    </View>
  )
}

export function queueA11y(status: QueueStatus | null | undefined, reportedAt: string | null | undefined): string {
  if (!status || freshness(reportedAt) === 'stale') return t('homeX.queueA11yNone')
  return t('homeX.queueA11y', { status: queueWordT(status), age: ageT(ageLabel(reportedAt)) })
}
