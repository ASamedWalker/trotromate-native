import React from 'react'
import { View, Text, ScrollView, TouchableOpacity, Linking } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter, type Href } from 'expo-router'
import { ArrowLeftRight, ExternalLink, Info, MapPin } from 'lucide-react-native'
import { font, ui, brand, space, radius, type } from '@/lib/theme'
import { BackButton } from '@/components/BackButton'
import { HeroText } from '@/components/HeroText'
import { AdinkraBand } from '@/components/AdinkraAccent'
import { Button } from '@/components/ui'
import { TicketCard, TICKET_INK } from '@/components/TicketCard'
import { OperatorChip, intercityFareText } from '@/components/lines/IntercityRow'
import { formatGHSRange } from '@/lib/utils/currency'
import { useHaptics } from '@/lib/hooks/useHaptics'
import {
  INTERCITY_CHECKED_LONG,
  INTERCITY_OPERATORS,
  fareTerminals,
  getIntercityPair,
  getReversePair,
  type IntercityFare,
} from '@/lib/utils/intercity'

/**
 * Intercity town pair (STC / VIP Jeoun), information only: no booking, no tickets.
 * Adinkra wallpaper header → H1 "Accra to Kumasi" → answer-first fare line →
 * one card per operator + class (fare, departure terminal, source link) →
 * reverse direction → "Confirm at the terminal" note.
 * Deep link: troski://intercity/accra-to-kumasi
 */

const range = (min: number, max: number) => (min === max ? `GH₵${min}` : formatGHSRange(min, max))
const fareText = (f: IntercityFare) => range(f.fareMin, f.fareMax)
/** Web data says "Class not stated" for STC; keep the class line only when it's named. */
const classOf = (f: IntercityFare) => (f.classKey === 'not-stated' ? null : f.classLabel)

function OperatorCard({ fare }: { fare: IntercityFare }) {
  const op = INTERCITY_OPERATORS[fare.operator]
  const haptics = useHaptics()
  const terminals = fareTerminals(fare)
  // Per-terminal prices only add information when the fare varies.
  const showTerminalFares = fare.fareMin !== fare.fareMax
  const open = () => {
    haptics.light()
    Linking.openURL(fare.sourceUrl).catch(() => {})
  }
  return (
    <TicketCard
      tone="fare"
      label={op.fullName}
      value={fare.sourceUrl.replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, '')}
      accessibilityLabel={`${op.fullName}, ${fare.classLabel}`}
      bodyStyle={{ gap: 10, paddingBottom: 4 }}
    >
      <View style={{ gap: 2 }}>
        <Text style={{ fontFamily: font.medium, fontSize: 15, color: ui.textSecondary }}>{fare.classLabel}</Text>
        <HeroText
          size={34}
          style={{ color: TICKET_INK, fontVariant: ['tabular-nums'], letterSpacing: -0.5 }}
          accessibilityLabel={fare.fareMin === fare.fareMax ? `${fare.fareMin} cedis` : `${fare.fareMin} to ${fare.fareMax} cedis`}
        >
          {fareText(fare)}
        </HeroText>
      </View>
      {showTerminalFares && (
        <Text style={{ fontFamily: font.medium, fontSize: 13, color: ui.textTertiary }}>
          {op.name} lists more than one price on this route; it depends on the bus and terminal.
        </Text>
      )}

      {terminals.map((t) => (
        <View key={t.terminal} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
          <MapPin size={16} color={ui.textSecondary} style={{ marginTop: 3 }} />
          <Text style={{ flex: 1, fontFamily: font.medium, fontSize: 15, color: ui.text }}>
            Departs {t.terminal}{showTerminalFares ? ` · ${range(t.min, t.max)}` : ''}
          </Text>
        </View>
      ))}
      {fare.effectiveNote ? (
        <Text style={{ fontFamily: font.medium, fontSize: 13, color: ui.textTertiary }}>
          Fare {fare.effectiveNote}
        </Text>
      ) : null}

      <TouchableOpacity
        onPress={open}
        activeOpacity={0.7}
        accessibilityRole="link"
        accessibilityLabel={`Source: ${op.sourceLabel}, checked ${INTERCITY_CHECKED_LONG}. Opens ${fare.sourceUrl.replace(/^https:\/\/(www\.)?/, '')}`}
        style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: '#F0EFED', marginTop: 2, paddingTop: 6 }}
      >
        <Text style={{ flex: 1, fontFamily: font.semibold, fontSize: 13, color: brand.orangeText }}>
          Source: {op.sourceLabel} · checked {INTERCITY_CHECKED_LONG}
        </Text>
        <ExternalLink size={16} color={brand.orangeText} />
      </TouchableOpacity>
    </TicketCard>
  )
}

export default function IntercityPairScreen() {
  const { pair: slug } = useLocalSearchParams<{ pair: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const pair = getIntercityPair(slug)

  if (!pair) {
    return (
      <View style={{ flex: 1, backgroundColor: ui.bg }}>
        <AdinkraBand patternHeight={200} style={{ paddingTop: insets.top + 12, paddingHorizontal: space.xl, paddingBottom: 20, gap: 12 }}>
          <BackButton />
          <HeroText size={24} style={{ color: ui.text }} accessibilityRole="header">Travel fare not found</HeroText>
        </AdinkraBand>
        <View style={{ padding: space.xl, gap: 16 }}>
          <Text style={{ ...type.body, color: ui.textSecondary }}>We only list STC and VIP town pairs from their own booking sites.</Text>
          <Button label="See all travel fares" variant="secondary" onPress={() => router.replace({ pathname: '/(tabs)/lines', params: { transport: 'intercity' } } as Href)} />
        </View>
      </View>
    )
  }

  const reverse = getReversePair(pair)
  const answer = pair.fares
    .map((f) => `${INTERCITY_OPERATORS[f.operator].name}${classOf(f) ? ` ${classOf(f)!.toLowerCase()}` : ''} ${fareText(f)}`)
    .join(' · ')

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: ui.bg }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Adinkra wallpaper band (owner rule: repeating pattern, not one symbol) */}
      <AdinkraBand patternHeight={340} style={{ paddingTop: insets.top + 12, paddingHorizontal: space.xl, paddingBottom: 22 }}>
        <BackButton />
        <Text style={{ fontFamily: font.extrabold, fontSize: 12, letterSpacing: 1, color: brand.orangeText, marginTop: 14 }}>TRAVEL · BUS FARE</Text>
        <HeroText size={30} style={{ color: ui.text, letterSpacing: -0.5 }} accessibilityRole="header">
          {pair.from} to {pair.to}
        </HeroText>
        {/* Answer first: the fare, then who charges what */}
        <HeroText size={36} style={{ color: ui.text, fontVariant: ['tabular-nums'], marginTop: 6 }}>
          {intercityFareText(pair)}
        </HeroText>
        <Text style={{ fontFamily: font.semibold, fontSize: 16, color: ui.text }}>{answer}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          {[...new Set(pair.fares.map((f) => f.operator))].map((id) => <OperatorChip key={id} label={INTERCITY_OPERATORS[id].name} />)}
          <Text style={{ fontFamily: font.medium, fontSize: 13, color: ui.textTertiary }}>Operator fares · checked {INTERCITY_CHECKED_LONG}</Text>
        </View>
      </AdinkraBand>

      <View style={{ paddingHorizontal: space.xl, paddingTop: 20, gap: 16 }}>
        {pair.fares.map((f) => (
          <OperatorCard key={`${f.operator}-${f.classKey}`} fare={f} />
        ))}

        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: ui.warningSoft, borderRadius: radius.md, padding: 14, marginTop: 4 }}>
          <Info size={18} color={ui.warning} style={{ marginTop: 2 }} />
          <Text style={{ flex: 1, fontFamily: font.semibold, fontSize: 15, color: '#78350F' }}>
            Confirm at the terminal; fares can change.
          </Text>
        </View>

        {reverse ? (
          <Button
            label={`${reverse.from} to ${reverse.to}`}
            icon={ArrowLeftRight}
            variant="outline"
            style={{ marginTop: 8 }}
            onPress={() => router.replace({ pathname: '/intercity/[pair]', params: { pair: reverse.slug } } as Href)}
          />
        ) : (
          <Text style={{ ...type.caption, color: ui.textTertiary, textAlign: 'center', marginTop: 8 }}>
            No operator fare listed for {pair.to} to {pair.from} yet.
          </Text>
        )}
      </View>
    </ScrollView>
  )
}
