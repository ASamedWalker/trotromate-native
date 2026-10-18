import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { font, ui } from '@/lib/theme'
import { HeroText } from '@/components/HeroText'
import { formatGHSRange } from '@/lib/utils/currency'
import {
  INTERCITY_CHECKED_SHORT,
  INTERCITY_OPERATORS,
  intercityOperators,
  intercityRange,
  type IntercityPair,
} from '@/lib/utils/intercity'
import { LINE_ROW_MIN_H } from '@/components/lines/LineRow'

/** "GH₵125–150", or "GH₵75" when every operator lists the same price. */
export function intercityFareText(pair: IntercityPair): string {
  const { min, max } = intercityRange(pair)
  return min === max ? `GH₵${min}` : formatGHSRange(min, max)
}

/** Grey operator chip (STC / VIP), 12/800 like the Lines source chips. */
export function OperatorChip({ label }: { label: string }) {
  return (
    <View style={{ borderRadius: 6, paddingHorizontal: 7, paddingVertical: 1, backgroundColor: '#F5F5F4' }}>
      <Text style={{ fontFamily: font.extrabold, fontSize: 12, letterSpacing: 0.6, color: '#44403C' }}>{label}</Text>
    </View>
  )
}

/**
 * One intercity town pair in the Lines list: same 72 pt grouped-card row as LineRow.
 * "Accra → Kumasi" over operator chips + "checked 17 Oct"; fare range on the right.
 */
export function IntercityRow({
  pair,
  onPress,
  first = true,
  last = true,
}: {
  pair: IntercityPair
  onPress: () => void
  first?: boolean
  last?: boolean
}) {
  const ops = intercityOperators(pair).map((id) => INTERCITY_OPERATORS[id].name)
  const fare = intercityFareText(pair)
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Travel bus fare, ${pair.from} to ${pair.to}, ${fare.replace('–', ' to ')}, ${ops.join(' and ')}, checked ${INTERCITY_CHECKED_SHORT}`}
      style={{
        minHeight: LINE_ROW_MIN_H,
        paddingVertical: 8,
        paddingHorizontal: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: ui.card,
        borderLeftWidth: 1,
        borderRightWidth: 1,
        borderTopWidth: 1,
        borderBottomWidth: last ? 1 : 0,
        borderColor: ui.hairline,
        borderTopColor: first ? ui.hairline : '#F0EFED',
        borderTopLeftRadius: first ? 16 : 0,
        borderTopRightRadius: first ? 16 : 0,
        borderBottomLeftRadius: last ? 16 : 0,
        borderBottomRightRadius: last ? 16 : 0,
      }}
    >
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Text style={{ fontFamily: font.bold, fontSize: 16, color: ui.text }}>{pair.from} {'→'} {pair.to}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {ops.map((o) => <OperatorChip key={o} label={o} />)}
          <Text style={{ fontFamily: font.medium, fontSize: 13, color: ui.textTertiary }}>checked {INTERCITY_CHECKED_SHORT}</Text>
        </View>
      </View>
      <HeroText size={22} style={{ color: ui.text, fontVariant: ['tabular-nums'] }}>{fare}</HeroText>
    </TouchableOpacity>
  )
}
