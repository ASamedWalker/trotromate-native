import React, { useEffect, useState } from 'react'
import { View, Text } from 'react-native'
import { useRouter } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { TrainFront } from 'lucide-react-native'
import { nextDepartures, formatRemaining, LINE_COLORS } from '@/lib/utils/train-stations'
import { font, ui } from '@/lib/theme'
import { HeroText } from '@/components/HeroText'
import { PressableScale } from '@/components/motion/PressableScale'
import { AdinkraCardPattern } from '@/components/AdinkraAccent'
import { useLanguage } from '@/lib/i18n'
import { dayT } from '@/lib/i18n/home-format'

const NAVY = '#0B1B3F'
const GREEN = '#15803D'
const SOON_MIN = 15

/**
 * Home next-train row (UX v2 H9): line chip, route, departure time, and the wait —
 * green only when 15 min or less. Times come from the published GRDA timetable
 * (same util as the Train tab), so the row says "Timetable · GRDA", never "live".
 */
export default function NextTrainCard() {
  const router = useRouter()
  const { t } = useLanguage()
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(id)
  }, [])

  const next = nextDepartures(now)[0]
  if (!next) return null
  const today = next.offset === 0
  const mins = next.remainingMinutes ?? null
  const soon = today && mins != null && mins <= SOON_MIN
  const wait = today && mins != null ? t('homeX.inTime', { time: mins < 60 ? `${mins} min` : formatRemaining(mins) }) : dayT(next.when)
  const chip = LINE_COLORS[next.lineCode] ?? { main: ui.text, tint: ui.surface }

  return (
    <PressableScale
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.navigate('/(tabs)/train' as any) }}
      accessibilityRole="button"
      accessibilityLabel={t('homeX.nextTrainA11y', { line: next.lineName, from: next.origin, to: next.destination, time: next.departTime, wait })}
      style={{
        marginHorizontal: 20, marginTop: 18, backgroundColor: ui.card, borderRadius: 16, borderWidth: 1, borderColor: ui.hairline,
        paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12, overflow: 'hidden',
      }}
    >
      {/* Navy Adinkra wallpaper, very faint on the white card. */}
      <AdinkraCardPattern height={120} ink="rgba(15,23,42,0.06)" size={24} />
      <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: NAVY, alignItems: 'center', justifyContent: 'center' }}>
        <TrainFront size={22} color="#FFFFFF" />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ backgroundColor: chip.tint, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 1 }}>
            <Text style={{ fontFamily: font.extrabold, fontSize: 12, letterSpacing: 0.6, color: chip.main }}>{next.lineCode}</Text>
          </View>
          <Text style={{ fontFamily: font.medium, fontSize: 13, color: ui.textTertiary, flexShrink: 1 }} numberOfLines={1}>
            {next.origin} → {next.destination}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
          <HeroText size={20} style={{ color: ui.text, fontVariant: ['tabular-nums'] }}>{next.departTime}</HeroText>
          <Text style={{ fontFamily: font.bold, fontSize: 14, color: soon ? GREEN : ui.textTertiary }}>{wait}</Text>
        </View>
      </View>
      <Text style={{ fontFamily: font.medium, fontSize: 12, color: ui.textTertiary, textAlign: 'right' }}>{t('homeX.timetableGrda')}</Text>
    </PressableScale>
  )
}
