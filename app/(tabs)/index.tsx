import React, { useState, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  Image,
  TouchableOpacity,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { useRouter, useFocusEffect, type Href } from 'expo-router'
import {
  MapPin, ChevronDown,
  Bell, Eye, EyeOff, Compass, BusFront as BusIcon, Users,
  ScanLine, Plus,
} from 'lucide-react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { BlurView } from 'expo-blur'
import { font } from '@/lib/theme'
import { useLanguage } from '@/lib/i18n'
import { formatGHS } from '@/lib/utils/currency'
import { useApp } from '@/lib/contexts/AppContext'
import { useLocation } from '@/lib/hooks/useLocation'
import { useAuthContext } from '@/lib/contexts/AuthContext'
import InitialsAvatar from '@/components/InitialsAvatar'
import WhatsOnAccra from '@/components/WhatsOnAccra'

const BRAND = '#FF4D1C'

// Approx Ghana bounding box — used only to guard against implausible
// reverse-geocode results (e.g. simulator default location showing
// "San Francisco, US"). Does not affect how location is fetched.
const GHANA_BOUNDS = { minLat: 4.5, maxLat: 11.5, minLng: -3.5, maxLng: 1.5 }
const GHANA_FALLBACK_LOCATION = 'Accra, GH'

function isWithinGhana(lat: number, lng: number): boolean {
  return (
    lat >= GHANA_BOUNDS.minLat && lat <= GHANA_BOUNDS.maxLat &&
    lng >= GHANA_BOUNDS.minLng && lng <= GHANA_BOUNDS.maxLng
  )
}

// Uber Base tokens adapted for Troski
const BASE = {
  radius: { sm: 8, md: 12, lg: 16, xl: 20, full: 9999 },
  shadow: {
    card: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 4 },
    subtle: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
}

/* ── Service data ── */

interface Service {
  id: string; label: string; image: any; route?: string; comingSoon?: boolean
}

const SERVICES: Service[] = [
  { id: 'bus', label: 'Bus', image: require('@/assets/images/home/bus_icon_bg_removed.png'), route: '/routes/search' },
  { id: 'okada', label: 'Okada', image: require('@/assets/images/home/okada_icon_bg_removed.png'), comingSoon: true },
  { id: 'train', label: 'Train', image: require('@/assets/images/home/train_bg_removed.png') },
  { id: 'pragya', label: 'Pragya', image: require('@/assets/images/home/Pragya_icon_bg_removed.png'), comingSoon: true },
  { id: 'courier', label: 'Courier', image: require('@/assets/images/home/van_bg_removed.png'), comingSoon: true },
  // EV: built but gated as coming-soon until there's real GH charging data
  // (set EXPO_PUBLIC_OCM_KEY or run migration 068, then restore route: '/ev').
  { id: 'ev', label: 'EV', image: require('@/assets/images/home/ev_bg_removed.png'), comingSoon: true },
]

/* ── Quick Actions ── */

const QUICK_ACTIONS = [
  { id: 'directions', labelKey: 'home.whereTo', subKey: 'home.directions', icon: Compass, color: '#1C1917' },
  { id: 'nearby', labelKey: 'home.buses', subKey: 'home.nearby', icon: BusIcon, color: '#10B981' },
  { id: 'queue', labelKey: 'home.queue', subKey: 'home.status', icon: Users, color: '#EF4444' },
]


/* ── Component ── */

export default function HomeScreen() {
  const router = useRouter()
  const { t } = useLanguage()
  const { profile, deviceId } = useApp()
  const { user: authUser, isAuthenticated } = useAuthContext()

  const [walletBalance, setWalletBalance] = useState<number | null>(null)
  const [balanceVisible, setBalanceVisible] = useState(true)
  // Refetch on focus (not just mount) so the balance reflects a top-up or
  // booking debit the moment the user returns Home.
  useFocusEffect(
    useCallback(() => {
      if (!authUser?.id) return
      const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://www.troski.me'
      fetch(`${API_URL}/api/wallet/balance?auth_user_id=${authUser.id}`)
        .then(r => r.json())
        .then(data => { if (data.balance != null) setWalletBalance(data.balance) })
        .catch(() => {})
    }, [authUser?.id]),
  )

  const { location } = useLocation()
  const [locationName, setLocationName] = useState('Accra, GH')

  React.useEffect(() => {
    if (!location) return
    // Display-only guard: outside Ghana's bounds the coords are implausible
    // (e.g. simulator default location) — skip the raw geocode and show the
    // fallback instead. Does not change how location is fetched.
    if (!isWithinGhana(location.latitude, location.longitude)) {
      setLocationName(GHANA_FALLBACK_LOCATION)
      return
    }
    const fetchName = async () => {
      try {
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${location.longitude},${location.latitude}.json?types=place,locality&limit=1&access_token=pk.eyJ1Ijoic2FtcHkxIiwiYSI6ImNranl2NHNjdTAxZzQzMWxldmx5dGhkaDEifQ.1eOzL1554nbXGIPai5Kmlg`
        )
        const data = await res.json()
        if (data.features?.[0]) {
          const place = data.features[0].text
          const country = data.features[0].context?.find((ctx: any) => ctx.id?.startsWith('country'))?.short_code?.toUpperCase() || 'GH'
          setLocationName(`${place}, ${country}`)
        } else {
          setLocationName(GHANA_FALLBACK_LOCATION)
        }
      } catch (e) {
        console.warn("[troski] silent error:", e)
        setLocationName(GHANA_FALLBACK_LOCATION)
      }
    }
    fetchName()
  }, [location?.latitude, location?.longitude])

  const displayName = profile?.display_name || 'Commuter'
  const firstName = displayName.split(' ')[0]
  const balance = walletBalance ?? 0
  const formattedBalance = balanceVisible
    ? formatGHS(balance)
    : '******'

  const handleServiceTap = useCallback((svc: Service) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    if (svc.comingSoon) { Alert.alert(svc.label, `${svc.label} is coming soon!`); return }
    if (svc.id === 'train') { router.push('/(tabs)/lines?tab=train' as any); return }
    if (svc.route) router.push(svc.route as any)
  }, [router])

  const handleQuickAction = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (id === 'directions') router.push('/routes/search' as any)
    else if (id === 'nearby') router.push('/terminals' as any)
    else if (id === 'queue') router.push('/queue/status' as any)
  }, [router])

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#FAFAF9' }}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* ── Header ── */}
        <View style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <Pressable onPress={() => router.push('/settings' as Href)} hitSlop={8}>
                <InitialsAvatar name={displayName} deviceId={deviceId || ''} size={48} />
              </Pressable>
              <View>
                <Text style={{ fontFamily: font.bold, fontSize: 24, color: '#000', letterSpacing: -0.5 }}>
                  {t('home.hello')}, {firstName}
                </Text>
                <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }} hitSlop={6}>
                  <MapPin size={14} color={BRAND} />
                  <Text style={{ fontFamily: font.medium, fontSize: 14, color: '#6B7280' }} numberOfLines={1}>
                    {locationName}
                  </Text>
                  <ChevronDown size={14} color="#6B7280" />
                </Pressable>
              </View>
            </View>
            <Pressable
              onPress={() => router.push('/(tabs)/activity' as any)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Notifications"
              style={{
                width: 44, height: 44, borderRadius: 22,
                backgroundColor: '#F3F4F6',
                justifyContent: 'center', alignItems: 'center',
              }}
            >
              <Bell size={22} color="#374151" />
            </Pressable>
          </View>
        </View>

        {/* ── Wallet Card (stacked-deck look — peeks on the right) ── */}
        <View style={{ paddingHorizontal: 24, marginBottom: 24 }}>
          {/* Back card 2 — furthest, teal, peeks most on the right */}
          <LinearGradient
            colors={['#22D3EE', '#0891B2']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              position: 'absolute', top: 16, bottom: 16, left: 64, right: 6,
              borderRadius: BASE.radius.xl,
              ...BASE.shadow.card, shadowColor: '#0891B2', shadowOpacity: 0.3,
            }}
          />
          {/* Back card 1 — middle, violet, peeks slightly on the right */}
          <LinearGradient
            colors={['#A78BFA', '#7C3AED']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              position: 'absolute', top: 8, bottom: 8, left: 52, right: 16,
              borderRadius: BASE.radius.xl,
              ...BASE.shadow.card, shadowColor: '#7C3AED', shadowOpacity: 0.3,
            }}
          />
          {/* Front card — wallet balance (narrower so the deck peeks at right) */}
          <LinearGradient
            colors={[BRAND, '#D63A12']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderRadius: BASE.radius.xl, padding: 24, overflow: 'hidden',
              ...BASE.shadow.card,
              shadowColor: BRAND, shadowOpacity: 0.3,
            }}
          >
            {/* Decorative discs for depth */}
            <View style={{ position: 'absolute', top: -45, right: -35, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.08)' }} />
            <View style={{ position: 'absolute', bottom: -55, left: -45, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.06)' }} />

            {/* Top: label + eye toggle */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontFamily: font.medium, fontSize: 14, color: 'rgba(255,255,255,0.75)' }}>{t('home.walletBalance')}</Text>
              <Pressable
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setBalanceVisible(!balanceVisible) }}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel={balanceVisible ? 'Hide balance' : 'Show balance'}
                style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center' }}
              >
                {balanceVisible ? <Eye size={18} color="#fff" /> : <EyeOff size={18} color="#fff" />}
              </Pressable>
            </View>

            {/* Balance */}
            <Text style={{ fontFamily: font.extrabold, fontSize: 40, color: '#fff', letterSpacing: -1.5, marginTop: 14, marginBottom: 22 }}>{formattedBalance}</Text>

            {/* Actions */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(isAuthenticated ? '/wallet/fund' as Href : '/auth/phone' as Href) }}
                activeOpacity={0.8}
                style={{ flex: 1 }}
              >
                <View style={{ height: 52, borderRadius: BASE.radius.md, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 }}>
                  <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center' }}>
                    <Plus size={16} color="#fff" strokeWidth={2.6} />
                  </View>
                  <Text style={{ fontFamily: font.bold, fontSize: 15, color: '#1c1917' }}>{t('home.topupWallet')}</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                // Scan-to-pay is a non-functional mock (accepts any PIN, no real debit) —
                // gated coming-soon like the other not-yet-live services below.
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); Alert.alert('Scan to Pay', 'Scan to Pay is coming soon!') }}
                activeOpacity={0.8}
                style={{ flex: 1 }}
              >
                {/* Frosted glass over the gradient — height pinned to match the
                    primary button exactly (border-box, so the border is inside) */}
                <View style={{ height: 52, borderRadius: BASE.radius.md, overflow: 'hidden', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.45)' }}>
                  <BlurView intensity={24} tint="light" style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, backgroundColor: 'rgba(255,255,255,0.14)' }}>
                    <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.28)', alignItems: 'center', justifyContent: 'center' }}>
                      <ScanLine size={15} color="#fff" />
                    </View>
                    <Text style={{ fontFamily: font.bold, fontSize: 15, color: '#fff' }}>{t('home.scanToPay')}</Text>
                  </BlurView>
                </View>
                {/* "Soon" badge — same coming-soon treatment used for not-yet-live services */}
                <View style={{ position: 'absolute', top: -6, right: -6, backgroundColor: '#6B7280', borderRadius: 100, paddingHorizontal: 7, paddingVertical: 2 }}>
                  <Text style={{ fontFamily: font.bold, fontSize: 9, color: '#fff', letterSpacing: 0.3 }}>SOON</Text>
                </View>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>

        {/* ── Quick Actions ── */}
        <View style={{ paddingHorizontal: 24, marginBottom: 28 }}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {QUICK_ACTIONS.map((action) => {
              const Icon = action.icon
              return (
                <TouchableOpacity
                  key={action.id}
                  onPress={() => handleQuickAction(action.id)}
                  activeOpacity={0.8}
                  style={{
                    flex: 1,
                    backgroundColor: '#FFFFFF',
                    borderRadius: BASE.radius.lg,
                    padding: 16,
                    ...BASE.shadow.card,
                  }}
                >
                  <Text style={{ fontFamily: font.bold, fontSize: 16, color: '#000', marginBottom: 2 }}>{t(action.labelKey)}</Text>
                  <Text style={{ fontFamily: font.regular, fontSize: 14, color: '#6B7280', marginBottom: 14 }}>{t(action.subKey)}</Text>
                  <View style={{
                    width: 40, height: 40, borderRadius: 20,
                    backgroundColor: action.color,
                    justifyContent: 'center', alignItems: 'center',
                    alignSelf: 'flex-end',
                    marginTop: 'auto',
                  }}>
                    <Icon size={20} color="#fff" />
                  </View>
                </TouchableOpacity>
              )
            })}
          </View>
        </View>

        {/* ── Services ── */}
        <View style={{ marginBottom: 28 }}>
          <Text style={{ fontFamily: font.bold, fontSize: 24, color: '#000', letterSpacing: -0.5, marginBottom: 16, paddingHorizontal: 24 }}>
            {t('home.services')}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 24, gap: 14 }}
          >
            {SERVICES.map((svc) => (
              <TouchableOpacity
                key={svc.id}
                onPress={() => handleServiceTap(svc)}
                activeOpacity={0.7}
                style={{
                  width: 100,
                  backgroundColor: '#F3F4F6',
                  borderRadius: BASE.radius.lg,
                  paddingTop: 16,
                  paddingBottom: 12,
                  alignItems: 'center',
                }}
              >
                {/* "Soon" badge — honest at a glance for not-yet-live services */}
                {svc.comingSoon && (
                  <View style={{ position: 'absolute', top: 8, right: 8, backgroundColor: '#6B7280', borderRadius: 100, paddingHorizontal: 7, paddingVertical: 2 }}>
                    <Text style={{ fontFamily: font.bold, fontSize: 9, color: '#fff', letterSpacing: 0.3 }}>SOON</Text>
                  </View>
                )}
                <Image source={svc.image} style={{ width: 60, height: 60, marginBottom: 8, opacity: svc.comingSoon ? 0.45 : 1 }} resizeMode="contain" />
                <Text style={{ fontFamily: font.bold, fontSize: 14, color: svc.comingSoon ? '#6B7280' : '#000', textAlign: 'center' }}>{svc.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ── What's On in Accra (events + ad placements) ── */}
        <WhatsOnAccra />

        <View style={{ height: 120 }} />
      </ScrollView>
    </SafeAreaView>
  )
}
