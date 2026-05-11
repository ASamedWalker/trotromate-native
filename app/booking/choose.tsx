import { useMemo, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  useColorScheme,
  ScrollView,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { ArrowLeft } from 'lucide-react-native'
import { c, font } from '@/lib/theme'
import { useVehiclePositions } from '@/lib/hooks/useVehiclePositions'
import { useAuthContext } from '@/lib/contexts/AuthContext'
import * as Haptics from 'expo-haptics'
import Animated, { FadeInDown } from 'react-native-reanimated'

export default function ChooseRideScreen() {
  const router = useRouter()
  const isDark = useColorScheme() === 'dark'
  const s = useMemo(() => getStyles(isDark), [isDark])
  const params = useLocalSearchParams<{
    routeId?: string
    from?: string
    to?: string
    fare?: string
    duration?: string
  }>()

  const from = params.from || ''
  const to = params.to || ''
  const fare = Number(params.fare) || 8
  const duration = Number(params.duration) || 0
  const routeLabel = `${from} → ${to}`

  const { vehicles } = useVehiclePositions()
  const { user: authUser, isAuthenticated } = useAuthContext()

  const activeVehicles = vehicles.filter(v => !v.isStale)
  const matchingVehicles = activeVehicles.filter(v => {
    const rl = v.routeLabel?.toLowerCase() || ''
    return rl.includes(from.toLowerCase()) || rl.includes(to.toLowerCase())
  })

  const handleBook = useCallback((plate: string) => {
    if (!isAuthenticated) {
      router.push('/auth/phone' as any)
      return
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    const part = (len: number) =>
      Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
    const tripCode = `TRO-${part(4)}-${part(4)}`
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()

    router.push({
      pathname: '/ticket/paid',
      params: { route: routeLabel, plate, fare: String(fare), tripCode, expiresAt },
    } as any)

    if (authUser?.id) {
      const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://www.troski.me'
      fetch(`${API_URL}/api/tickets/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auth_user_id: authUser.id,
          route_label: routeLabel,
          van_plate: plate,
          fare,
        }),
      }).catch(() => {})
    }
  }, [isAuthenticated, authUser, routeLabel, fare, router])

  return (
    <View style={s.root}>
      <SafeAreaView edges={['top']}>
        {/* Header */}
        <View style={s.header}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [s.backBtn, pressed && { opacity: 0.7 }]}
            hitSlop={12}
          >
            <ArrowLeft size={20} color={isDark ? '#FAFAF9' : '#1C1917'} />
          </Pressable>
          <View style={s.headerCenter}>
            <Text style={s.headerTitle}>Choose a ride</Text>
            <Text style={s.headerSub}>{routeLabel}</Text>
          </View>
          <View style={{ width: 44 }} />
        </View>
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
      >
        {/* Summary Card */}
        <Animated.View entering={FadeInDown.duration(300)} style={s.summaryCard}>
          <View style={s.summaryRow}>
            <Text style={s.summaryLabel}>Route</Text>
            <Text style={s.summaryValue}>{routeLabel}</Text>
          </View>
          <View style={s.divider} />
          <View style={s.summaryRow}>
            <Text style={s.summaryLabel}>Fare</Text>
            <Text style={s.summaryFare}>GH₵{fare.toFixed(2)}</Text>
          </View>
          {duration > 0 && (
            <>
              <View style={s.divider} />
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>Est. time</Text>
                <Text style={s.summaryValue}>~{duration} min</Text>
              </View>
            </>
          )}
        </Animated.View>

        {/* Vehicle section */}
        <Animated.View entering={FadeInDown.delay(100).duration(300)}>
          <Text style={s.sectionTitle}>
            {matchingVehicles.length > 0
              ? `${matchingVehicles.length} trotro${matchingVehicles.length !== 1 ? 's' : ''} available`
              : 'No trotros on this route right now'}
          </Text>
        </Animated.View>

        {matchingVehicles.length > 0 ? (
          <View style={s.vehicleList}>
            {matchingVehicles.map((v, idx) => (
              <Animated.View key={v.vanId} entering={FadeInDown.delay(150 + idx * 50).duration(300)}>
                <Pressable
                  onPress={() => handleBook(v.plateNumber)}
                  style={({ pressed }) => [s.vehicleCard, pressed && { transform: [{ scale: 0.98 }] }]}
                >
                  <View style={s.vehicleIcon}>
                    <Text style={{ fontSize: 26 }}>🚐</Text>
                  </View>

                  <View style={s.vehicleInfo}>
                    <Text style={s.vehiclePlate}>{v.plateNumber}</Text>
                    <View style={s.vehicleMeta}>
                      <View style={s.liveDot} />
                      <Text style={s.liveLabel}>Live</Text>
                      {v.speed != null && v.speed > 0 && (
                        <Text style={s.vehicleSpeed}> · {Math.round(v.speed)} km/h</Text>
                      )}
                    </View>
                  </View>

                  <View style={s.vehicleRight}>
                    <Text style={s.vehicleFare}>₵{fare.toFixed(0)}</Text>
                    <Text style={s.chevron}>›</Text>
                  </View>
                </Pressable>
              </Animated.View>
            ))}
          </View>
        ) : (
          <Animated.View entering={FadeInDown.delay(200).duration(300)} style={s.emptyCard}>
            <Text style={{ fontSize: 44 }}>🚐</Text>
            <Text style={s.emptyTitle}>No trotros broadcasting GPS</Text>
            <Text style={s.emptySub}>Try again later or check another route</Text>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [s.retryBtn, pressed && { transform: [{ scale: 0.97 }] }]}
            >
              <Text style={s.retryText}>Try another route</Text>
            </Pressable>
          </Animated.View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  )
}

function getStyles(isDark: boolean) {
  const bg = isDark ? '#0C0A09' : '#FAFAF9'
  const surface = isDark ? '#1C1917' : '#FFFFFF'
  const text = isDark ? '#FAFAF9' : '#1C1917'
  const sub = isDark ? '#78716c' : '#a8a29e'
  const border = isDark ? '#292524' : '#E7E5E4'

  return StyleSheet.create({
    root: { flex: 1, backgroundColor: bg },

    /* Header */
    header: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, paddingBottom: 16,
    },
    backBtn: {
      width: 44, height: 44, borderRadius: 22,
      justifyContent: 'center', alignItems: 'center',
    },
    headerCenter: { flex: 1, alignItems: 'center' },
    headerTitle: { fontFamily: font.black, fontSize: 20, color: text, letterSpacing: -0.5 },
    headerSub: { fontFamily: font.regular, fontSize: 13, color: sub, marginTop: 2 },

    scroll: { paddingHorizontal: 20, gap: 20 },

    /* Summary */
    summaryCard: {
      backgroundColor: surface, borderRadius: 16, padding: 18,
      borderWidth: 1, borderColor: border,
      ...Platform.select({
        ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
        android: { elevation: 1 },
      }),
    },
    summaryRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingVertical: 6,
    },
    summaryLabel: { fontFamily: font.regular, fontSize: 14, color: sub },
    summaryValue: { fontFamily: font.bold, fontSize: 14, color: text },
    summaryFare: { fontFamily: font.extrabold, fontSize: 16, color: '#F59E0B' },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: border, marginVertical: 6 },

    /* Section */
    sectionTitle: { fontFamily: font.bold, fontSize: 15, color: text },

    /* Vehicles */
    vehicleList: { gap: 10 },
    vehicleCard: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      backgroundColor: surface, borderRadius: 16, padding: 16,
      borderWidth: 1, borderColor: border,
      ...Platform.select({
        ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
        android: { elevation: 1 },
      }),
    },
    vehicleIcon: {
      width: 52, height: 52, borderRadius: 26,
      backgroundColor: isDark ? '#292524' : '#FFF7ED',
      justifyContent: 'center', alignItems: 'center',
    },
    vehicleInfo: { flex: 1, gap: 4 },
    vehiclePlate: { fontFamily: font.bold, fontSize: 16, color: text, letterSpacing: 0.5 },
    vehicleMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#22c55e' },
    liveLabel: { fontFamily: font.semibold, fontSize: 13, color: '#22c55e' },
    vehicleSpeed: { fontFamily: font.regular, fontSize: 13, color: sub },
    vehicleRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    vehicleFare: { fontFamily: font.black, fontSize: 20, color: '#F59E0B', letterSpacing: -0.5 },
    chevron: { fontFamily: font.regular, fontSize: 22, color: sub },

    /* Empty */
    emptyCard: {
      backgroundColor: isDark ? '#1C1917' : '#FFF7ED',
      borderRadius: 20, padding: 32, alignItems: 'center', gap: 10,
      borderWidth: 1, borderColor: isDark ? '#292524' : '#FDE68A',
    },
    emptyTitle: { fontFamily: font.bold, fontSize: 16, color: text, textAlign: 'center' },
    emptySub: { fontFamily: font.regular, fontSize: 14, color: sub, textAlign: 'center' },
    retryBtn: {
      backgroundColor: '#F59E0B', paddingHorizontal: 24, paddingVertical: 12,
      borderRadius: 99, marginTop: 8,
    },
    retryText: { fontFamily: font.bold, fontSize: 14, color: '#1C1917' },
  })
}
