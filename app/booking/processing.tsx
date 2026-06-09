import { useEffect, useRef } from 'react'
import { View, Text, Animated, Easing, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Lock } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import { font } from '@/lib/theme'

const GOLD = '#F5A623'
const STAGE_H = 150
const SAFE_H = 64

/* A single coin dropping into the safe — looping, staggered by `delay`. */
function Coin({ delay }: { delay: number }) {
  const drop = STAGE_H - SAFE_H - 2
  const y = useRef(new Animated.Value(0)).current
  const opacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const run = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(opacity, { toValue: 1, duration: 120, useNativeDriver: true }),
          Animated.timing(y, { toValue: drop, duration: 520, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        ]),
        Animated.timing(opacity, { toValue: 0, duration: 100, useNativeDriver: true }),
        Animated.timing(y, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.delay(Math.max(0, 880 - delay)),
      ])
    )
    run.start()
    return () => run.stop()
  }, [delay, drop, y, opacity])

  return (
    <Animated.View style={[styles.coin, { transform: [{ translateY: y }], opacity }]}>
      <Text style={styles.coinText}>₵</Text>
    </Animated.View>
  )
}

export default function ProcessingScreen() {
  const router = useRouter()

  useEffect(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const t = setTimeout(() => router.replace('/booking/receipt' as never), 2300)
    return () => clearTimeout(t)
  }, [router])

  return (
    <View style={styles.container}>
      {/* ── Animation zone — replace with the branded Lottie when ready ── */}
      <View style={styles.stage}>
        <Coin delay={0} />
        <Coin delay={300} />
        <Coin delay={600} />
        <View style={styles.safe}>
          <View style={styles.slot} />
          <Lock size={22} color="#fff" />
        </View>
      </View>

      <Text style={styles.title}>Processing payment</Text>
      <Text style={styles.sub}>Securing your booking…</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAF9', alignItems: 'center', justifyContent: 'center' },
  stage: { width: 120, height: STAGE_H, alignItems: 'center', justifyContent: 'flex-end', marginBottom: 36 },
  coin: { position: 'absolute', top: 0, width: 26, height: 26, borderRadius: 13, backgroundColor: GOLD, borderWidth: 2, borderColor: '#E0911A', justifyContent: 'center', alignItems: 'center' },
  coinText: { fontFamily: font.extrabold, fontSize: 13, color: '#fff' },
  safe: { width: 92, height: SAFE_H, borderRadius: 16, backgroundColor: '#1F2937', justifyContent: 'center', alignItems: 'center' },
  slot: { position: 'absolute', top: 11, width: 40, height: 5, borderRadius: 3, backgroundColor: GOLD },
  title: { fontFamily: font.bold, fontSize: 18, color: '#111' },
  sub: { fontFamily: font.regular, fontSize: 14, color: '#9CA3AF', marginTop: 4 },
})
