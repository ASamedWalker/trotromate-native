import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { SvgXml } from 'react-native-svg'
import { TriangleAlert, ChevronRight } from 'lucide-react-native'
import { font } from '@/lib/theme'
import { adinkraXml } from '@/lib/brand/adinkra'
import { ageLabel } from '@/lib/utils/freshness'
import { CATEGORY_LABEL, SEVERITY_STYLE, type ServiceAlert } from '@/lib/hooks/useAlerts'

function scope(a: ServiceAlert): string {
  return a.citywide ? 'Accra-wide' : `Affects ${a.corridors.map((k) => k.replace('|', '·')).join(', ')}`
}

/** One-line alert (Home strip, route page): title, scope, source, age. Always names its source. */
export function AlertRow({ alert, onPress }: { alert: ServiceAlert; onPress?: () => void }) {
  const sev = SEVERITY_STYLE[alert.severity]
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${sev.label}: ${alert.title}. ${scope(alert)}. Source: ${alert.source}. ${ageLabel(alert.created_at)}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: sev.bg, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14 }}
    >
      <TriangleAlert size={18} color={sev.fg} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontFamily: font.extrabold, fontSize: 14, color: sev.fg }} numberOfLines={2}>{alert.title}</Text>
        <Text style={{ fontFamily: font.regular, fontSize: 12, color: sev.fg }} numberOfLines={1}>
          {scope(alert)} · Source: {alert.source} · {ageLabel(alert.created_at)}
        </Text>
      </View>
      {onPress ? <ChevronRight size={18} color={sev.fg} /> : null}
    </TouchableOpacity>
  )
}

let nyansapo: string | null = null

/** Pulse rail card: severity + category, title, body, source. Faint Nyansapo (wisdom knot) watermark. */
export function AlertCard({ alert, width = 280 }: { alert: ServiceAlert; width?: number }) {
  const sev = SEVERITY_STYLE[alert.severity]
  if (!nyansapo) nyansapo = adinkraXml('nyansapo', 64, '#000000')
  return (
    <View
      accessible
      accessibilityLabel={`${sev.label}, ${CATEGORY_LABEL[alert.category]}: ${alert.title}. ${alert.body ?? ''} ${scope(alert)}. Source: ${alert.source}`}
      style={{ width, backgroundColor: sev.bg, borderRadius: 16, padding: 14, gap: 6, overflow: 'hidden' }}
    >
      <View style={{ position: 'absolute', right: -8, bottom: -10, opacity: 0.08 }} pointerEvents="none">
        <SvgXml xml={nyansapo} width={64} height={64} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <TriangleAlert size={15} color={sev.fg} />
        <Text style={{ fontFamily: font.extrabold, fontSize: 11, letterSpacing: 0.8, color: sev.fg }}>{CATEGORY_LABEL[alert.category]}</Text>
        <Text style={{ fontFamily: font.regular, fontSize: 12, color: sev.fg }}>· {ageLabel(alert.created_at)}</Text>
      </View>
      <Text style={{ fontFamily: font.extrabold, fontSize: 15, color: '#111111' }} numberOfLines={2}>{alert.title}</Text>
      {alert.body ? <Text style={{ fontFamily: font.regular, fontSize: 13, color: '#1F2937' }} numberOfLines={3}>{alert.body}</Text> : null}
      <Text style={{ fontFamily: font.semibold, fontSize: 12, color: sev.fg }} numberOfLines={1}>{scope(alert)} · Source: {alert.source}</Text>
    </View>
  )
}
