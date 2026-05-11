import React, { useMemo, useState, useCallback, useRef } from 'react'
import {
  View,
  Text,
  ScrollView,
  useColorScheme,
  StyleSheet,
  Pressable,
  Alert,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { useRouter } from 'expo-router'
import {
  Bus, Bike, Utensils, Zap, Calendar, Package, ReceiptText, Plus,
  MapPin, ChevronRight, ChevronDown, Search, Navigation, Calculator,
  Bell,
} from 'lucide-react-native'
import { font } from '@/lib/theme'
import { useApp } from '@/lib/contexts/AppContext'
import { useLocation } from '@/lib/hooks/useLocation'
import { useAuthContext } from '@/lib/contexts/AuthContext'
import InitialsAvatar from '@/components/InitialsAvatar'
import Animated, { FadeInDown } from 'react-native-reanimated'
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet'
import type { LucideIcon } from 'lucide-react-native'

const GREEN = '#08b64f'
const DARK_GREEN = '#087d3c'
const ORANGE = '#ff9400'

/* ── Services ── */

interface ServiceAction { id: string; label: string; desc: string; icon: LucideIcon }
interface Service {
  id: string; label: string; icon: LucideIcon; iconColor: string
  cta: string; actions: ServiceAction[]; comingSoon?: boolean; route?: string
}

const SERVICES: Service[] = [
  {
    id: 'troski', label: 'Troski', icon: Bus, iconColor: DARK_GREEN, cta: 'Start Booking', route: '/booking',
    actions: [
      { id: 'find-route', label: 'Find a route', desc: 'Search trotro routes across Accra', icon: Search },
      { id: 'book-trotro', label: 'Book trotro', desc: 'Reserve your seat before you arrive', icon: Calendar },
      { id: 'live-vehicles', label: 'View live vehicles', desc: 'See active vehicles near your station', icon: Navigation },
    ],
  },
  {
    id: 'okada', label: 'Okada', icon: Bike, iconColor: DARK_GREEN, cta: 'Find Okada',
    actions: [
      { id: 'request-rider', label: 'Request nearby rider', desc: "We'll find a rider close to you", icon: Navigation },
      { id: 'set-pickup', label: 'Set pickup', desc: 'Choose your pickup location', icon: MapPin },
      { id: 'estimate-fare', label: 'Estimate fare', desc: 'See price estimate before you ride', icon: Calculator },
    ],
  },
  {
    id: 'food', label: 'Food', icon: Utensils, iconColor: ORANGE, cta: 'Order Food', comingSoon: true,
    actions: [{ id: 'nearby-food', label: 'Nearby restaurants', desc: 'Find local food vendors', icon: Search }],
  },
  {
    id: 'ev-charge', label: 'EV Charge', icon: Zap, iconColor: GREEN, cta: 'View Stations', comingSoon: true,
    actions: [{ id: 'nearby-stations', label: 'Nearby stations', desc: 'Find EV stations nearby', icon: MapPin }],
  },
  {
    id: 'booking', label: 'Booking', icon: Calendar, iconColor: ORANGE, cta: 'Book Trip', comingSoon: true,
    actions: [{ id: 'find-trip', label: 'Find intercity trip', desc: 'Search buses between cities', icon: Search }],
  },
  {
    id: 'courier', label: 'Courier', icon: Package, iconColor: DARK_GREEN, cta: 'Send Package', comingSoon: true,
    actions: [{ id: 'send-package', label: 'Send package', desc: 'Request pickup for a parcel', icon: Package }],
  },
  {
    id: 'bills', label: 'Bills', icon: ReceiptText, iconColor: DARK_GREEN, cta: 'Pay Bill', comingSoon: true,
    actions: [{ id: 'pay-electricity', label: 'Pay electricity', desc: 'Buy prepaid power', icon: Zap }],
  },
  {
    id: 'more', label: 'More', icon: Plus, iconColor: '#777', cta: 'Explore More',
    actions: [{ id: 'view-all', label: 'View all services', desc: 'See everything on Troski', icon: Plus }],
  },
]

/* ── Component ── */

export default function HomeScreen() {
  const router = useRouter()
  const isDark = useColorScheme() === 'dark'
  const s = useMemo(() => getStyles(isDark), [isDark])
  const { profile } = useApp()
  const { user: authUser, isAuthenticated } = useAuthContext()

  // Wallet balance
  const [walletBalance, setWalletBalance] = useState<number | null>(null)
  React.useEffect(() => {
    if (!authUser?.id) return
    const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://www.troski.me'
    fetch(`${API_URL}/api/wallet/balance?auth_user_id=${authUser.id}`)
      .then(r => r.json())
      .then(data => { if (data.balance != null) setWalletBalance(data.balance) })
      .catch(() => {})
  }, [authUser?.id])

  const { location } = useLocation()
  const [locationName, setLocationName] = useState('Accra, GH')

  // Reverse geocode user location
  React.useEffect(() => {
    if (!location) return
    const fetchName = async () => {
      try {
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${location.longitude},${location.latitude}.json?types=place,locality&limit=1&access_token=pk.eyJ1Ijoic2FtcHkxIiwiYSI6ImNranl2NHNjdTAxZzQzMWxldmx5dGhkaDEifQ.1eOzL1554nbXGIPai5Kmlg`
        )
        const data = await res.json()
        if (data.features?.[0]) {
          const place = data.features[0].text
          const country = data.features[0].context?.find((c: any) => c.id?.startsWith('country'))?.short_code?.toUpperCase() || 'GH'
          setLocationName(`${place}, ${country}`)
        }
      } catch {}
    }
    fetchName()
  }, [location?.latitude, location?.longitude])

  const sheetRef = useRef<BottomSheet>(null)
  const [activeSvc, setActiveSvc] = useState<Service | null>(null)

  const onTapService = useCallback((svc: Service) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    if (svc.comingSoon) { Alert.alert(svc.label, `${svc.label} is coming soon!`, [{ text: 'OK' }]); return }
    setActiveSvc(svc)
    sheetRef.current?.snapToIndex(0)
  }, [])

  const onTapAction = useCallback((svc: Service, act: ServiceAction) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    sheetRef.current?.close()
    setActiveSvc(null)
    if (svc.route) router.push(svc.route as any)
    else if (act.id === 'find-route') router.push('/routes/plan' as any)
    else Alert.alert(act.label, act.desc)
  }, [router])

  return (
    <View style={s.root}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

          {/* ── Header ── */}
          <Animated.View entering={FadeInDown.duration(300)} style={s.header}>
            <View style={s.headerLeft}>
              <View style={s.locationIcon}>
                <MapPin size={24} color={GREEN} fill={GREEN} />
              </View>
              <View>
                <Text style={s.locationSub}>Current Location</Text>
                <View style={s.locationRow}>
                  <Text style={s.locationText}>{locationName}</Text>
                  <ChevronDown size={16} color="#777" />
                </View>
              </View>
            </View>
            <View style={s.headerRight}>
              <Pressable onPress={() => router.push('/(tabs)/activity' as any)} hitSlop={10} style={s.bellWrap}>
                <Bell size={26} color={isDark ? '#FAFAF9' : '#111'} />
                <View style={s.bellDot} />
              </Pressable>
              <Pressable onPress={() => router.push('/profile' as any)} hitSlop={8}>
                <InitialsAvatar name={profile?.display_name || 'U'} deviceId={profile?.device_id || ''} size={48} />
              </Pressable>
            </View>
          </Animated.View>

          {/* ── Wallet ── */}
          <View style={s.activeCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={{ fontFamily: font.bold, fontSize: 10, color: isDark ? '#9CA3AF' : '#6B7280', textTransform: 'uppercase', letterSpacing: 1 }}>Wallet Balance</Text>
                <Text style={{ fontFamily: font.bold, fontSize: 22, color: isDark ? '#F9FAFB' : '#111', letterSpacing: -0.5 }}>
                  {walletBalance != null ? `₵${Number(walletBalance).toFixed(2)}` : isAuthenticated ? '₵...' : '₵0.00'}
                </Text>
              </View>
              <Pressable
                onPress={() => router.push(isAuthenticated ? '/wallet/fund' as any : '/auth/phone' as any)}
                style={{ backgroundColor: GREEN, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 }}
              >
                <Text style={{ fontFamily: font.bold, fontSize: 13, color: '#fff' }}>Top Up</Text>
              </Pressable>
            </View>
          </View>

          {/* ── Service Grid ── */}
          <Animated.View entering={FadeInDown.delay(140).duration(400)}>
            {[0, 4].map((startIdx) => (
              <View key={startIdx} style={s.gridRow}>
                {SERVICES.slice(startIdx, startIdx + 4).map((svc) => {
                  const Icon = svc.icon
                  const isActive = activeSvc?.id === svc.id
                  return (
                    <Pressable
                      key={svc.id}
                      onPress={() => onTapService(svc)}
                      style={({ pressed }) => [
                        s.gridItem,
                        pressed && { transform: [{ scale: 0.92 }] },
                        svc.comingSoon && { opacity: 0.4 },
                      ]}
                    >
                      <View style={[s.gridCircle, isActive && s.gridCircleActive]}>
                        <Icon size={24} color={svc.iconColor} strokeWidth={1.8} />
                      </View>
                      <Text style={[s.gridLabel, isActive && { color: GREEN }]} numberOfLines={1}>{svc.label}</Text>
                    </Pressable>
                  )
                })}
              </View>
            ))}
          </Animated.View>

          {/* ── Active Ride ── */}
          <Animated.View entering={FadeInDown.delay(220).duration(400)} style={s.activeCard}>
            <Text style={s.activeTag}>Active Now</Text>
            <View style={s.activeBody}>
              <View style={s.activeIconBox}>
                <Bus size={28} color="#fff" />
              </View>
              <View style={s.activeInfo}>
                <Text style={s.activeRoute}>Circle → Madina</Text>
                <Text style={s.activeMeta}>
                  Trotro arriving in <Text style={{ fontFamily: font.bold, color: GREEN }}>6 min</Text>
                </Text>
                <Text style={s.activePlate}>GR-4582-50</Text>
                <View style={s.progressTrack}>
                  <View style={s.progressFill}>
                    <View style={s.progressKnob} />
                  </View>
                </View>
              </View>
              <Pressable
                onPress={() => Alert.alert('Track', 'Trip tracking coming soon')}
                style={s.trackBtn}
              >
                <Text style={s.trackText}>Track</Text>
              </Pressable>
            </View>
          </Animated.View>

          <View style={{ height: 120 }} />
        </ScrollView>
      </SafeAreaView>

      {/* ── Bottom Sheet ── */}
      <BottomSheet
        ref={sheetRef}
        index={-1}
        snapPoints={['50%']}
        enablePanDownToClose
        handleIndicatorStyle={{ backgroundColor: isDark ? '#555' : '#D1D5DB', width: 48, height: 5, borderRadius: 3 }}
        backgroundStyle={{ backgroundColor: isDark ? '#1C1917' : '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28 }}
        onClose={() => setActiveSvc(null)}
      >
        <BottomSheetView style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 }}>
          {activeSvc && (
            <>
              {/* Title centered */}
              <Text style={{ fontFamily: font.extrabold, fontSize: 22, color: isDark ? '#F9FAFB' : '#111', textAlign: 'center', marginBottom: 4 }}>
                {activeSvc.label}
              </Text>
              <Text style={{ fontFamily: font.regular, fontSize: 13, color: isDark ? '#9CA3AF' : '#6B7280', textAlign: 'center', marginBottom: 20 }}>
                {activeSvc.actions[0]?.desc}
              </Text>

              {/* Action rows */}
              <View style={{ marginBottom: 20 }}>
                {activeSvc.actions.map((act) => {
                  const ActIcon = act.icon
                  return (
                    <Pressable
                      key={act.id}
                      onPress={() => onTapAction(activeSvc, act)}
                      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}
                    >
                      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: isDark ? '#14532d' : '#ECFDF5', justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
                        <ActIcon size={18} color={DARK_GREEN} />
                      </View>
                      <Text style={{ fontFamily: font.bold, fontSize: 14, color: isDark ? '#F9FAFB' : '#111', flex: 1 }}>{act.label}</Text>
                      <ChevronRight size={18} color="#9CA3AF" />
                    </Pressable>
                  )
                })}
              </View>

              {/* CTA */}
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                  sheetRef.current?.close()
                  if (activeSvc.route) router.push(activeSvc.route as any)
                }}
                style={({ pressed }) => [
                  { backgroundColor: GREEN, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Text style={{ fontFamily: font.bold, fontSize: 15, color: '#fff' }}>{activeSvc.cta}</Text>
              </Pressable>
            </>
          )}
        </BottomSheetView>
      </BottomSheet>
    </View>
  )
}

/* ── Styles ── */

function getStyles(isDark: boolean) {
  const bg = isDark ? '#0C0A09' : '#F3F4F6'
  const cardBg = isDark ? '#1C1917' : '#FFFFFF'
  const text = isDark ? '#F9FAFB' : '#151515'
  const sub = isDark ? '#9CA3AF' : '#6B7280'
  const border = isDark ? '#292524' : '#F3F4F6'

  return StyleSheet.create({
    root: { flex: 1, backgroundColor: bg },
    scroll: { paddingHorizontal: 16, paddingTop: 12, gap: 24 },

    /* Header */
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    locationIcon: {
      width: 48, height: 48, borderRadius: 14,
      backgroundColor: cardBg, justifyContent: 'center', alignItems: 'center',
      ...Platform.select({
        ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6 },
        android: { elevation: 2 },
      }),
    },
    locationSub: { fontFamily: font.medium, fontSize: 13, color: sub },
    locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    locationText: { fontFamily: font.bold, fontSize: 16, color: text },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    bellWrap: { position: 'relative' },
    bellDot: {
      position: 'absolute', top: 0, right: 0,
      width: 8, height: 8, borderRadius: 4, backgroundColor: GREEN,
    },

    /* Wallet */
    walletCard: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      backgroundColor: isDark ? '#1C1917' : '#FFFFFF',
      borderRadius: 20, padding: 16,
      borderWidth: 1.5, borderColor: isDark ? '#292524' : '#D1D5DB',
    },
    walletLabel: { fontFamily: font.bold, fontSize: 10, color: sub, textTransform: 'uppercase', letterSpacing: 1 },
    walletAmount: { fontFamily: font.bold, fontSize: 22, color: text, letterSpacing: -0.5 },
    topUpBtn: {
      backgroundColor: GREEN, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10,
      ...Platform.select({
        ios: { shadowColor: GREEN, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12 },
        android: { elevation: 4 },
      }),
    },
    topUpText: { fontFamily: font.bold, fontSize: 13, color: '#fff' },

    /* Grid */
    gridRow: {
      flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16,
    },
    gridItem: {
      flex: 1, alignItems: 'center', gap: 6,
    },
    gridCircle: {
      width: 54, height: 54, borderRadius: 27,
      backgroundColor: cardBg, justifyContent: 'center', alignItems: 'center',
      borderWidth: 1, borderColor: isDark ? '#292524' : '#E5E7EB',
      ...Platform.select({
        ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12 },
        android: { elevation: 2 },
      }),
    },
    gridCircleActive: {
      borderWidth: 2, borderColor: GREEN,
    },
    gridLabel: { fontFamily: font.bold, fontSize: 11, color: text, textAlign: 'center' },

    /* Active Ride */
    activeCard: {
      backgroundColor: cardBg, borderRadius: 24, padding: 16,
      ...Platform.select({
        ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.10, shadowRadius: 24 },
        android: { elevation: 4 },
      }),
    },
    activeTag: { fontFamily: font.bold, fontSize: 13, color: GREEN, marginBottom: 10 },
    activeBody: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    activeIconBox: {
      width: 72, height: 72, borderRadius: 18,
      backgroundColor: isDark ? '#14532d' : '#ECFDF5',
      justifyContent: 'center', alignItems: 'center',
    },
    activeInfo: { flex: 1, gap: 2 },
    activeRoute: { fontFamily: font.extrabold, fontSize: 19, color: text, letterSpacing: -0.5 },
    activeMeta: { fontFamily: font.regular, fontSize: 14, color: sub },
    activePlate: { fontFamily: font.regular, fontSize: 14, color: sub },
    progressTrack: {
      height: 8, borderRadius: 4, backgroundColor: isDark ? '#292524' : '#E5E7EB', marginTop: 10,
    },
    progressFill: {
      width: '60%', height: 8, borderRadius: 4, backgroundColor: GREEN,
      justifyContent: 'center', alignItems: 'flex-end',
    },
    progressKnob: {
      width: 14, height: 14, borderRadius: 7,
      backgroundColor: '#fff', borderWidth: 3, borderColor: GREEN,
      marginRight: -7,
    },
    trackBtn: {
      borderWidth: 1.5, borderColor: isDark ? '#22C55E' : '#BBF7D0',
      paddingHorizontal: 20, paddingVertical: 12, borderRadius: 16,
    },
    trackText: { fontFamily: font.bold, fontSize: 15, color: isDark ? '#4ADE80' : '#0A9D49' },

    /* Sheet */
    sheetBg: { backgroundColor: cardBg, borderTopLeftRadius: 34, borderTopRightRadius: 34 },
    sheetHandle: { backgroundColor: isDark ? '#555' : '#999', width: 56, height: 5, borderRadius: 3 },
    sheetBody: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 20 },

    sheetTop: { marginBottom: 16 },
    sheetTitle: { fontFamily: font.extrabold, fontSize: 24, color: text, letterSpacing: -0.5 },
    sheetDesc: { fontFamily: font.regular, fontSize: 15, color: sub, marginTop: 2 },

    actionList: {
      borderRadius: 18, borderWidth: 1, borderColor: border,
      overflow: 'hidden', marginBottom: 16,
    },
    actionRow: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      paddingVertical: 14, paddingHorizontal: 14,
    },
    actionBorder: { borderBottomWidth: 1, borderBottomColor: border },
    actionIcon: {
      width: 44, height: 44, borderRadius: 14,
      backgroundColor: isDark ? '#14532d' : '#ECFDF5',
      justifyContent: 'center', alignItems: 'center',
    },
    actionInfo: { flex: 1, gap: 2 },
    actionLabel: { fontFamily: font.extrabold, fontSize: 15, color: text },
    actionSub: { fontFamily: font.regular, fontSize: 13, color: sub },

    ctaBtn: {
      backgroundColor: GREEN, height: 56, borderRadius: 16,
      justifyContent: 'center', alignItems: 'center',
      ...Platform.select({
        ios: { shadowColor: GREEN, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.28, shadowRadius: 22 },
        android: { elevation: 6 },
      }),
    },
    ctaText: { fontFamily: font.extrabold, fontSize: 17, color: '#fff' },
  })
}
