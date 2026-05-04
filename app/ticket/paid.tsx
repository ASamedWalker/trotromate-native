import { useState, useEffect, useRef } from 'react'
import { View, Text, StyleSheet, StatusBar, TouchableOpacity } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { X } from 'lucide-react-native'
import { LinearGradient } from 'expo-linear-gradient'
import QRCode from 'react-native-qrcode-svg'
import { Wallet, Clock, Shield } from 'lucide-react-native'
import { font } from '@/lib/theme'
import { useTicketTimer } from '@/lib/hooks/useTicketTimer'
import { GRADIENT_COLORS, getGradientIndex, generateTripCode } from '@/lib/utils/ticket'
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, interpolate, FadeIn, FadeInDown } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import ConfettiCannon from 'react-native-confetti-cannon'

export default function PaidTicketScreen() {
  const params = useLocalSearchParams<{
    route?: string
    plate?: string
    fare?: string
    tripCode?: string
    expiresAt?: string
  }>()

  // Defaults for testing
  const route = params.route || 'Circle → Madina'
  const plate = params.plate || 'GR-4582-21'
  const fare = params.fare || '8.00'
  const tripCode = params.tripCode || generateTripCode()
  const expiresAt = params.expiresAt || new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()

  const { formatted: countdown, isExpired } = useTicketTimer(expiresAt)

  // Live clock — updates every second (anti-screenshot)
  const [clock, setClock] = useState('')
  const [dateStr, setDateStr] = useState('')
  useEffect(() => {
    const update = () => {
      const now = new Date()
      setClock(now.toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }))
      setDateStr(now.toLocaleDateString('en-GH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [])

  // Rolling gradient animation — cycles through 4 color pairs
  const gradientPhase = useSharedValue(0)
  const [gradientIdx, setGradientIdx] = useState(0)

  useEffect(() => {
    gradientPhase.value = withRepeat(
      withTiming(4, { duration: 12000 }),
      -1,
      false,
    )
  }, [])

  // Update gradient index every 3 seconds
  useEffect(() => {
    const id = setInterval(() => {
      setGradientIdx(prev => (prev + 1) % GRADIENT_COLORS.length)
    }, 3000)
    return () => clearInterval(id)
  }, [])

  // Opacity crossfade for gradient layers
  const fadeAnim = useSharedValue(0)
  useEffect(() => {
    fadeAnim.value = withRepeat(
      withTiming(1, { duration: 3000 }),
      -1,
      true, // reverse
    )
  }, [])

  const fadeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(fadeAnim.value, [0, 1], [0.3, 1]),
  }))

  const fadeStyleInverse = useAnimatedStyle(() => ({
    opacity: interpolate(fadeAnim.value, [0, 1], [1, 0.3]),
  }))

  // Confetti + haptic on mount
  const confettiRef = useRef<any>(null)
  const router = useRouter()
  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    setTimeout(() => confettiRef.current?.start(), 800)
  }, [])

  const currentColors = GRADIENT_COLORS[gradientIdx]
  const nextColors = GRADIENT_COLORS[(gradientIdx + 1) % GRADIENT_COLORS.length]

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" />

      {/* ── Animated gradient background (stacked layers crossfading) ── */}
      <Animated.View style={[StyleSheet.absoluteFillObject, fadeStyleInverse]}>
        <LinearGradient
          colors={[currentColors[0], currentColors[1]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFillObject, fadeStyle]}>
        <LinearGradient
          colors={[nextColors[0], nextColors[1]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>

      {/* ── Watermark ── */}
      <View style={s.watermark}>
        <Wallet size={200} color="rgba(255,255,255,0.04)" />
      </View>

      {/* ── Close button ── */}
      <TouchableOpacity
        style={s.closeBtn}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back() }}
        activeOpacity={0.7}
      >
        <X size={22} color="rgba(255,255,255,0.7)" />
      </TouchableOpacity>

      {/* ── Content ── */}
      <View style={s.content}>
        {/* PAID badge */}
        <Animated.View entering={FadeInDown.duration(500)} style={s.paidBadge}>
          <Shield size={18} color="#fff" />
          <Text style={s.paidText}>PAID</Text>
        </Animated.View>

        {/* Route */}
        <Animated.View entering={FadeInDown.delay(100).duration(500)}>
          <Text style={s.routeText}>{route}</Text>
          <Text style={s.plateText}>{plate}</Text>
        </Animated.View>

        {/* Fare */}
        <Animated.View entering={FadeInDown.delay(200).duration(500)} style={s.fareRow}>
          <Text style={s.fareCurrency}>GH₵</Text>
          <Text style={s.fareAmount}>{fare}</Text>
        </Animated.View>

        {/* QR Code */}
        <Animated.View entering={FadeIn.delay(400).duration(600)} style={s.qrWrap}>
          <View style={s.qrCard}>
            <QRCode
              value={`troski://ticket/${tripCode}`}
              size={140}
              backgroundColor="#ffffff"
              color="#1c1917"
            />
          </View>
          <Text style={s.tripCodeLabel}>TRIP CODE</Text>
          <Text style={s.tripCode}>{tripCode}</Text>
        </Animated.View>

        {/* Live clock + date (anti-screenshot) */}
        <Animated.View entering={FadeInDown.delay(500).duration(500)} style={s.clockSection}>
          <Text style={s.clockText}>{clock}</Text>
          <Text style={s.dateText}>{dateStr}</Text>
        </Animated.View>

        {/* Countdown / Expired */}
        <Animated.View entering={FadeInDown.delay(600).duration(500)} style={s.countdownSection}>
          {isExpired ? (
            <View style={s.expiredBadge}>
              <Text style={s.expiredText}>EXPIRED</Text>
            </View>
          ) : (
            <>
              <Clock size={16} color="rgba(255,255,255,0.6)" />
              <Text style={s.countdownLabel}>Expires in</Text>
              <Text style={s.countdownTime}>{countdown}</Text>
            </>
          )}
        </Animated.View>

        {/* Troski branding */}
        <Animated.View entering={FadeIn.delay(700).duration(500)}>
          <Text style={s.brandText}>Troski</Text>
          <Text style={s.brandSub}>Know Your Fare. Beat the Queue.</Text>
        </Animated.View>
      </View>

      {/* Confetti */}
      <ConfettiCannon
        ref={confettiRef}
        count={60}
        origin={{ x: -10, y: 0 }}
        fadeOut
        autoStart={false}
        explosionSpeed={200}
        fallSpeed={4000}
      />
    </View>
  )
}

const s = StyleSheet.create({
  container: {
    flex: 1,
  },
  closeBtn: {
    position: 'absolute',
    top: 56,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  watermark: {
    position: 'absolute',
    top: '30%',
    alignSelf: 'center',
    opacity: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 20,
  },

  // PAID badge
  paidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  paidText: {
    fontSize: 16,
    fontFamily: font.extrabold,
    color: '#fff',
    letterSpacing: 4,
  },

  // Route
  routeText: {
    fontSize: 28,
    fontFamily: font.extrabold,
    color: '#fff',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  plateText: {
    fontSize: 14,
    fontFamily: font.semibold,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginTop: 4,
  },

  // Fare
  fareRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  fareCurrency: {
    fontSize: 20,
    fontFamily: font.bold,
    color: 'rgba(255,255,255,0.7)',
  },
  fareAmount: {
    fontSize: 44,
    fontFamily: font.extrabold,
    color: '#fff',
    letterSpacing: -2,
  },

  // QR
  qrWrap: {
    alignItems: 'center',
    gap: 8,
  },
  qrCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  tripCodeLabel: {
    fontSize: 10,
    fontFamily: font.bold,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 3,
    marginTop: 4,
  },
  tripCode: {
    fontSize: 20,
    fontFamily: font.extrabold,
    color: '#fff',
    letterSpacing: 3,
  },

  // Clock
  clockSection: {
    alignItems: 'center',
  },
  clockText: {
    fontSize: 18,
    fontFamily: font.bold,
    color: '#fff',
  },
  dateText: {
    fontSize: 12,
    fontFamily: font.regular,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },

  // Countdown
  countdownSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  countdownLabel: {
    fontSize: 13,
    fontFamily: font.medium,
    color: 'rgba(255,255,255,0.6)',
  },
  countdownTime: {
    fontSize: 16,
    fontFamily: font.bold,
    color: '#fff',
    letterSpacing: 1,
  },
  expiredBadge: {
    backgroundColor: 'rgba(239,68,68,0.8)',
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 99,
  },
  expiredText: {
    fontSize: 16,
    fontFamily: font.extrabold,
    color: '#fff',
    letterSpacing: 4,
  },

  // Brand
  brandText: {
    fontSize: 22,
    fontFamily: font.extrabold,
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  brandSub: {
    fontSize: 10,
    fontFamily: font.regular,
    color: 'rgba(255,255,255,0.2)',
    textAlign: 'center',
    letterSpacing: 1,
  },
})
