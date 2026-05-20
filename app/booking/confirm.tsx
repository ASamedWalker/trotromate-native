import React, { useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  useColorScheme,
  StyleSheet,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { ArrowLeft, ChevronRight, Users } from 'lucide-react-native'
import { font } from '@/lib/theme'
import { useAuthContext } from '@/lib/contexts/AuthContext'
import { useLocation } from '@/lib/hooks/useLocation'
import * as Haptics from 'expo-haptics'
import Mapbox from '@rnmapbox/maps'
import BottomSheet from '@gorhom/bottom-sheet'

const MAP_LIGHT = 'mapbox://styles/sampy1/cmnhofbx0005q01s84a9vbm31'
const MAP_DARK = 'mapbox://styles/mapbox/dark-v11'
const GREEN = '#00A859'

const VEHICLES = [
  { id: 'everyday', name: 'Everyday', seats: 4, price: 4.92, oldPrice: 10.92, pickup: '1 min', emoji: '🚐' },
  { id: 'xl', name: 'Everyday XL', seats: 6, price: 5.40, oldPrice: 11.40, pickup: '3 min', emoji: '🚌' },
  { id: 'premium', name: 'Premium', seats: 4, price: 14.60, oldPrice: 20.60, pickup: '4 min', emoji: '🚎' },
  { id: 'premium-xl', name: 'Premium XL', seats: 6, price: 15.65, oldPrice: 21.65, pickup: '9 min', emoji: '🚍' },
]

export default function ConfirmRideScreen() {
  const router = useRouter()
  const isDark = useColorScheme() === 'dark'
  const sheetRef = useRef<BottomSheet>(null)
  const [selectedId, setSelectedId] = useState('everyday')

  const params = useLocalSearchParams<{ pickup?: string; dropoff?: string }>()
  const pickup = params.pickup || 'Current location'
  const dropoff = params.dropoff || 'Destination'

  const { location } = useLocation()
  const { user: authUser, isAuthenticated } = useAuthContext()

  const text = isDark ? '#F9FAFB' : '#1A1A1A'
  const sub = isDark ? '#78716c' : '#6B7280'
  const cardBg = isDark ? '#1C1917' : '#FFFFFF'

  const center = location ? [location.longitude, location.latitude] : [-0.187, 5.6037]
  const snaps = useMemo(() => ['55%', '88%'], [])

  const selected = VEHICLES.find(v => v.id === selectedId)!

  const [booking, setBooking] = useState(false)

  const handleBook = async () => {
    if (!isAuthenticated) { router.push('/auth/phone' as any); return }
    if (booking) return
    setBooking(true)

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    const routeLabel = `${pickup} → ${dropoff}`
    const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://www.troski.me'

    // Optimistic — navigate immediately
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    const part = (len: number) => Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
    const fallbackCode = `TRO-${part(4)}-${part(4)}`

    router.push({
      pathname: '/ticket/paid',
      params: { route: routeLabel, plate: 'GR-4582-50', fare: String(selected.price), tripCode: fallbackCode, expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() },
    } as any)

    // Real booking in background
    if (authUser?.id) {
      try {
        const res = await fetch(`${API_URL}/api/bookings/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            auth_user_id: authUser.id,
            route_label: routeLabel,
            pickup_name: pickup,
            dropoff_name: dropoff,
            vehicle_type: selected.id,
            fare: selected.price,
            plate_number: 'GR-4582-50',
          }),
        })
        const data = await res.json()
        if (!data.success) console.warn('[booking] Failed:', data.error)
      } catch (e) { console.warn("[troski] silent error:", e) }
    }
    setBooking(false)
  }

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? '#0C0A09' : '#F8FAF8' }}>
      {/* Map */}
      <Mapbox.MapView
        style={StyleSheet.absoluteFillObject}
        styleURL={isDark ? MAP_DARK : MAP_LIGHT}
        attributionEnabled={false} logoEnabled={false} compassEnabled={false} scaleBarEnabled={false}
      >
        <Mapbox.Camera centerCoordinate={center as [number, number]} zoomLevel={14} animationMode="flyTo" animationDuration={800} />
        <Mapbox.UserLocation visible />
      </Mapbox.MapView>

      {/* Top bar: Back + Route pill */}
      <SafeAreaView edges={['top']} style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, paddingHorizontal: 16 }} pointerEvents="box-none">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Pressable onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: cardBg, justifyContent: 'center', alignItems: 'center', elevation: 3 }}>
            <ArrowLeft size={20} color={text} />
          </Pressable>
          <View style={{ flex: 1, backgroundColor: isDark ? 'rgba(28,25,23,0.9)' : 'rgba(255,255,255,0.95)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, elevation: 3 }}>
            <Text style={{ fontFamily: font.medium, fontSize: 13, color: text }} numberOfLines={1}>
              {pickup}  →  {dropoff}
            </Text>
          </View>
        </View>
      </SafeAreaView>

      {/* Bottom Sheet */}
      <BottomSheet
        ref={sheetRef}
        index={0}
        snapPoints={snaps}
        handleIndicatorStyle={{ backgroundColor: isDark ? '#555' : '#D1D5DB', width: 48, height: 6, borderRadius: 3 }}
        backgroundStyle={{ backgroundColor: cardBg, borderTopLeftRadius: 32, borderTopRightRadius: 32 }}
      >
        <View style={{ paddingHorizontal: 20, paddingTop: 4 }}>
          {/* Vehicle cards */}
          {VEHICLES.map((v) => {
            const isSel = selectedId === v.id
            return (
              <Pressable
                key={v.id}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedId(v.id) }}
                style={{
                  flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, marginBottom: 6,
                  borderWidth: isSel ? 1.5 : 0,
                  borderColor: isSel ? GREEN : 'transparent',
                  backgroundColor: isSel ? (isDark ? '#0a2e1a' : '#F0FDF4') : 'transparent',
                  overflow: 'hidden',
                }}
              >
                {isSel && <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, backgroundColor: GREEN, borderTopLeftRadius: 16, borderBottomLeftRadius: 16 }} />}

                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: isDark ? '#292524' : '#F8FAF8', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                  <Text style={{ fontSize: 24 }}>{v.emoji}</Text>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: font.bold, fontSize: 15, color: text }}>{v.name}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <Users size={11} color={sub} />
                    <Text style={{ fontFamily: font.medium, fontSize: 11, color: sub }}>{v.seats}</Text>
                  </View>
                </View>

                <View style={{ alignItems: 'flex-end' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                    <Text style={{ fontFamily: font.medium, fontSize: 11, color: sub, textDecorationLine: 'line-through' }}>₵{v.oldPrice.toFixed(2)}</Text>
                    <Text style={{ fontFamily: font.bold, fontSize: 15, color: text }}>₵{v.price.toFixed(2)}</Text>
                  </View>
                  <Text style={{ fontFamily: font.semibold, fontSize: 11, color: isSel ? GREEN : sub, marginTop: 2 }}>Pick-up: {v.pickup}</Text>
                </View>
              </Pressable>
            )
          })}

        </View>

        {/* Footer */}
        <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28, backgroundColor: cardBg, borderTopWidth: 1, borderTopColor: isDark ? '#292524' : '#F3F4F6' }}>
          <Pressable
            onPress={() => router.push(isAuthenticated ? '/wallet/fund' as any : '/auth/phone' as any)}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}
          >
            <Text style={{ fontFamily: font.medium, fontSize: 14, color: text }}>Add payment method</Text>
            <ChevronRight size={18} color={sub} />
          </Pressable>

          <Pressable
            onPress={handleBook}
            style={({ pressed }) => [
              { backgroundColor: GREEN, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
              pressed && { opacity: 0.9 },
            ]}
          >
            <Text style={{ fontFamily: font.bold, fontSize: 17, color: '#fff' }}>Book a ride</Text>
          </Pressable>
        </View>
      </BottomSheet>
    </View>
  )
}
