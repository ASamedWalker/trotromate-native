import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { Heart } from 'lucide-react-native'
import { font } from '@/lib/theme'
import { HeroText } from '@/components/HeroText'
import { LineBadge } from '@/components/LineBadge'
import { corridorFor } from '@/lib/constants/corridors'
import { formatGHS } from '@/lib/utils/currency'
import { titleCase } from '@/lib/utils/title-case'
import { ageLabel } from '@/lib/utils/freshness'
import type { RouteWithStats } from '@/lib/types'
import { CARD, TEXT, TEXT2 } from '@/components/home/tokens'

/**
 * Lines tab card (redesign wave 3, store release). Launch corridors are blocks in
 * their corridor colour (Transit's line cards); every other line is a white card
 * with its badge. The fare is the hero number and always says where it came from:
 * GPRTU when verified, "~ reported" from riders, otherwise "No fare yet".
 */
export function ReleaseLineCard({ item, saved, onPress }: { item: RouteWithStats; saved: boolean; onPress: () => void }) {
  const from = titleCase(item.from_location)
  const to = titleCase(item.to_location)
  const { color, isLaunch } = corridorFor(item.from_location, item.to_location)
  const reports = item.fare_stats?.report_count ?? 0
  const gprtu = item.is_gprtu_verified && item.official_fare != null && item.official_fare > 0
  const reported = !gprtu && reports > 0 && item.fare_stats?.avg_reported_fare != null
  const amount = gprtu ? Number(item.official_fare) : reported ? Number(item.fare_stats!.avg_reported_fare) : null
  const sub = gprtu
    ? (reports > 0 ? `Riders paid ${formatGHS(Number(item.fare_stats!.avg_reported_fare))} · ${ageLabel(item.fare_stats!.last_report_at)}` : 'Official GPRTU fare')
    : reported ? `Reported by riders · ${ageLabel(item.fare_stats!.last_report_at)}` : 'Be the first to report the fare'
  const label = gprtu ? 'GPRTU' : reported ? 'REPORTED' : 'NO FARE YET'

  const onColor = isLaunch
  const fg = onColor ? '#FFFFFF' : TEXT
  const fg2 = onColor ? 'rgba(255,255,255,0.85)' : TEXT2

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${from} to ${to}${amount != null ? `, ${formatGHS(amount)}, ${gprtu ? 'GPRTU fare' : 'reported by riders'}` : ', no fare yet'}${saved ? ', saved' : ''}`}
      style={{
        marginBottom: 10, borderRadius: 18, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: onColor ? color : CARD.bg, borderWidth: onColor ? 0 : 1, borderColor: CARD.border,
      }}
    >
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {onColor ? (
            <HeroText size={20} style={{ color: '#FFFFFF', letterSpacing: 0.3 }}>{corridorFor(item.from_location, item.to_location).code}</HeroText>
          ) : (
            <LineBadge from={item.from_location} to={item.to_location} />
          )}
          {saved ? <Heart size={15} color={onColor ? '#FFFFFF' : '#EF4444'} fill={onColor ? '#FFFFFF' : '#EF4444'} /> : null}
        </View>
        <Text style={{ fontFamily: font.extrabold, fontSize: 16, color: fg }} numberOfLines={1}>{from} → {to}</Text>
        <Text style={{ fontFamily: font.regular, fontSize: 13, color: fg2 }} numberOfLines={1}>{sub}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        {amount != null ? (
          <HeroText size={24} style={{ color: fg }}>{reported ? '~' : ''}{formatGHS(amount)}</HeroText>
        ) : (
          <Text style={{ fontFamily: font.bold, fontSize: 16, color: fg2 }}>—</Text>
        )}
        <Text style={{ fontFamily: font.extrabold, fontSize: 10, letterSpacing: 0.5, color: onColor ? 'rgba(255,255,255,0.9)' : gprtu ? '#15803D' : TEXT2 }}>{label}</Text>
      </View>
    </TouchableOpacity>
  )
}
