import { useEffect, useRef } from 'react'
import { View, Text, Animated, Easing, StyleSheet, Image } from 'react-native'
import { useRouter } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { font } from '@/lib/theme'

const GOLD = '#F5A623'
const STAGE_H = 160
const BUS_H = 96

/* A coin dropping into the bus — looping, staggered by `delay`. */
function Coin({ delay }: { delay: number }) {
  const drop = STAGE_H - BUS_H + 14
  const y = useRef(new Animated.Value(0)).current
  const opacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const run = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(opacity, { toValue: 1, duration: 120, useNativeDriver: true }),
          Animated.timing(y, { toValue: drop, duration: 540, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        ]),
        Animated.timing(opacity, { toValue: 0, duration: 110, useNativeDriver: true }),
        Animated.timing(y, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.delay(Math.max(0, 920 - delay)),
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
  const bob = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 650, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 650, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start()
    const t = setTimeout(() => router.replace('/booking/receipt' as never), 2300)
    return () => clearTimeout(t)
  }, [router, bob])

  const busY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -6] })

  return (
    <View style={styles.container}>
      {/* ── Animation zone — booking-payment Lottie goes here (unique to bookings;
            the wallet-topup flow uses the coins-into-safe animation) ── */}
      <View style={styles.stage}>
        <Coin delay={0} />
        <Coin delay={306} />
        <Coin delay={612} />
        <Animated.Image
          source={require('@/assets/images/home/bus_icon_bg_removed.png')}
          style={[styles.bus, { transform: [{ translateY: busY }] }]}
          resizeMode="contain"
        />
      </View>

      <Text style={styles.title}>Processing payment</Text>
      <Text style={styles.sub}>Securing your booking…</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAF9', alignItems: 'center', justifyContent: 'center' },
  stage: { width: 150, height: STAGE_H, alignItems: 'center', justifyContent: 'flex-end', marginBottom: 36 },
  coin: { position: 'absolute', top: 0, alignSelf: 'center', width: 26, height: 26, borderRadius: 13, backgroundColor: GOLD, borderWidth: 2, borderColor: '#E0911A', justifyContent: 'center', alignItems: 'center' },
  coinText: { fontFamily: font.extrabold, fontSize: 13, color: '#fff' },
  bus: { width: 132, height: BUS_H },
  title: { fontFamily: font.bold, fontSize: 18, color: '#111' },
  sub: { fontFamily: font.regular, fontSize: 14, color: '#9CA3AF', marginTop: 4 },
})
