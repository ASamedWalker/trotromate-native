import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { X, Lock, Check } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import { font, brand, ui, space, radius, type } from '@/lib/theme'
import { WalletCard, CARD_THEMES } from '@/components/WalletCard'
import { CARD_TIERS, isCardUnlocked, useWalletCardTheme } from '@/lib/hooks/useWalletCardTheme'
import { LEVELS, calculateLevel, getNextLevel } from '@/lib/constants/rewards'

/**
 * "Your card" — pick a wallet card. Each Rewards tier unlocks one card;
 * locked cards say what unlocks them. Coins are recognition, not money.
 */
export default function ChooseCardScreen() {
  const router = useRouter()
  const { theme, points, choose } = useWalletCardTheme()
  const level = calculateLevel(points)
  const next = getNextLevel(level)
  const span = next ? next.min_points - LEVELS[level].min_points : 1
  const progress = next ? Math.min(1, Math.max(0, (points - LEVELS[level].min_points) / span)) : 1

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <Text style={s.title}>Your card</Text>
        <TouchableOpacity onPress={() => router.back()} style={s.close} accessibilityRole="button" accessibilityLabel="Close">
          <X size={20} color={ui.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <Text style={s.lede}>Report fares and queues to earn coins. Each tier unlocks a new card.</Text>

        <View style={s.progressCard} accessible accessibilityLabel={`${LEVELS[level].name}, ${points} coins${next ? `, ${next.min_points - points} to ${next.name}` : ''}`}>
          <View style={s.progressRow}>
            <Text style={s.progressStrong}>{LEVELS[level].name} · {points} coins</Text>
            {next && <Text style={s.progressMuted}>{next.min_points - points} to {next.name}</Text>}
          </View>
          <View style={s.track}><View style={[s.fill, { width: `${Math.round(progress * 100)}%` }]} /></View>
        </View>

        {CARD_TIERS.map(({ theme: cardTheme, level: cardLevel }) => {
          const unlocked = isCardUnlocked(cardTheme, points)
          const selected = cardTheme === theme
          const tierName = CARD_THEMES[cardTheme].tier
          return (
            <TouchableOpacity
              key={cardTheme}
              activeOpacity={unlocked ? 0.8 : 1}
              disabled={!unlocked}
              onPress={() => { Haptics.selectionAsync(); choose(cardTheme) }}
              style={[s.row, selected && s.rowSelected]}
              accessibilityRole="button"
              accessibilityState={{ disabled: !unlocked, selected }}
              accessibilityLabel={
                unlocked
                  ? `${tierName} card${selected ? ', in use' : ''}`
                  : `${tierName} card, locked. Unlocks at ${LEVELS[cardLevel].name}, ${LEVELS[cardLevel].min_points} coins`
              }
            >
              <View style={s.thumb} pointerEvents="none">
                <WalletCard theme={cardTheme} balanceText="" balanceVisible onToggleBalance={() => {}} compact />
                {!unlocked && (
                  <View style={s.lockVeil}>
                    <View style={s.lockDot}><Lock size={14} color="#FFFFFF" /></View>
                  </View>
                )}
              </View>
              <View style={s.rowText}>
                <Text style={s.rowTitle}>{tierName}</Text>
                <Text style={s.rowSub}>
                  {cardLevel === 'passenger'
                    ? 'Everyone starts here'
                    : unlocked
                      ? `Unlocked at ${LEVELS[cardLevel].name}`
                      : `Unlocks at ${LEVELS[cardLevel].name} · ${LEVELS[cardLevel].min_points} coins`}
                </Text>
                {selected ? (
                  <View style={s.usingPill}><Check size={12} color="#FFFFFF" /><Text style={s.usingText}>Using</Text></View>
                ) : unlocked ? (
                  <Text style={s.useText}>Use this card</Text>
                ) : null}
              </View>
            </TouchableOpacity>
          )
        })}
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: ui.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: space.gutter, paddingTop: space.sm, paddingBottom: space.md,
  },
  title: { ...type.title },
  close: { width: 44, height: 44, borderRadius: 22, backgroundColor: ui.card, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: space.gutter, paddingBottom: 40, gap: space.md },
  lede: { ...type.body, color: ui.textSecondary },
  progressCard: { backgroundColor: ui.card, borderRadius: radius.lg, padding: space.md, gap: 8 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 },
  progressStrong: { ...type.labelStrong, color: ui.text },
  progressMuted: { ...type.label, color: ui.textSecondary },
  track: { height: 8, borderRadius: 4, backgroundColor: ui.surface, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: brand.orange },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14, padding: 10,
    backgroundColor: ui.card, borderRadius: radius.lg, borderWidth: 1.5, borderColor: ui.surfaceStrong,
  },
  rowSelected: { borderWidth: 2.5, borderColor: brand.orange },
  thumb: { width: 132 },
  lockVeil: {
    ...StyleSheet.absoluteFillObject, borderRadius: 8, backgroundColor: 'rgba(250,246,242,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  lockDot: { width: 30, height: 30, borderRadius: 15, backgroundColor: ui.text, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 18, fontFamily: font.extrabold, color: ui.text },
  rowSub: { ...type.label, color: ui.textSecondary },
  usingPill: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4,
    backgroundColor: ui.success, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 2,
  },
  usingText: { fontSize: 13, fontFamily: font.bold, color: '#FFFFFF' },
  useText: { ...type.labelStrong, color: brand.orangeText, marginTop: 4 },
})
