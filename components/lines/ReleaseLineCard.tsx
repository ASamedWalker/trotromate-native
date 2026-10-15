import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { Heart } from 'lucide-react-native'
import { font } from '@/lib/theme'
import { HeroText } from '@/components/HeroText'
import { LineBadge } from '@/components/LineBadge'
import { corridorFor } from '@/lib/constants/corridors'
import { formatGHS } from '@/lib/utils/currency'
import { titleCase } from '@/lib/utils/title-case'
import { fareSource, FARE_WARN_COLOR } from '@/lib/utils/fare-source'
import type { RouteWithStats } from '@/lib/types'
import { CARD, TEXT, TEXT2 } from '@/components/home/tokens'

/**
 * Lines tab card (redesign wave 3, store release). Launch corridors are blocks in
 * their corridor colour (Transit's line cards); every other line is a white card
 * with its badge. The fare is the hero number with exactly one source label
 * (lib/utils/fare-source.ts, UX v2 L1): GPRTU, "~" riders, or "Be first to report".
 */
export function ReleaseLineCard({ item, saved, onPress }: { item: RouteWithStats; saved: boolean; onPress: () => void }) {
  const from = titleCase(item.from_location)
  const to = titleCase(item.to_location)
  const { color, isLaunch } = corridorFor(item.from_location, item.to_location)
  const src = fareSource(item)
  const amount = src.amount
  const onColor = isLaunch
  const fg = onColor ? '#FFFFFF' : TEXT
  const fg2 = onColor ? 'rgba(255,255,255,0.85)' : TEXT2

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${from} to ${to}${amount != null ? `, ${src.approx ? 'about ' : ''}${formatGHS(amount)}, ${src.chip === 'GPRTU' ? 'GPRTU fare' : 'reported by riders'}` : ', no fare yet'}, ${src.provenance}${saved ? ', saved' : ''}`}
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
        {src.provenance ? (
        <Text
          style={{
            fontFamily: src.warn ? font.semibold : font.regular, fontSize: 13,
            color: src.warn ? (onColor ? '#FDE68A' : FARE_WARN_COLOR) : fg2,
            opacity: src.aged ? 0.6 : 1,
          }}
          numberOfLines={1}
        >
          {src.provenance}
        </Text>
        ) : null}
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        {amount != null ? (
          <HeroText size={24} style={{ color: fg }}>{src.approx ? '~' : ''}{formatGHS(amount)}</HeroText>
        ) : (
          <Text style={{ fontFamily: font.bold, fontSize: 16, color: fg2 }}>—</Text>
        )}
        {src.chip ? (
          <Text style={{ fontFamily: font.extrabold, fontSize: 12, letterSpacing: 0.5, color: onColor ? 'rgba(255,255,255,0.9)' : src.chip === 'GPRTU' ? '#15803D' : TEXT2 }}>{src.chip}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  )
}
