import React, { useState, useCallback, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native'
// expo-image (already used in 12 other screens) downsamples to the drawn size
// and caches decoded bitmaps. RN's Image decoded these at full source
// resolution, which is how six small icons cost ~195 MB of RAM on this screen.
import { Image } from 'expo-image'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { useRouter, useFocusEffect, type Href } from 'expo-router'
import {
  MapPin,
  Bell, Eye, EyeOff, Compass, BusFront as BusIcon, Users,
  ScanLine, Plus, Trophy,
} from 'lucide-react-native'
import { font, brand, ui, space, radius, type, cardShadow } from '@/lib/theme'
import { HeroText } from '@/components/HeroText'
import { Card, SectionHeader, Badge, Tap } from '@/components/ui'
import { useLanguage } from '@/lib/i18n'
import { formatGHS } from '@/lib/utils/currency'
import { useApp } from '@/lib/contexts/AppContext'
import { useLocation } from '@/lib/hooks/useLocation'
import { useAuthContext } from '@/lib/contexts/AuthContext'
import InitialsAvatar from '@/components/InitialsAvatar'
import WhatsOnAccra from '@/components/WhatsOnAccra'
import { getCachedWallet } from '@/lib/services/walletCache'
import { MAPBOX_TOKEN } from '@/lib/config/mapbox'

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
  { id: 'directions', labelKey: 'home.whereTo', subKey: 'home.directions', icon: Compass },
  { id: 'nearby', labelKey: 'home.buses', subKey: 'home.nearby', icon: BusIcon },
  { id: 'queue', labelKey: 'home.queue', subKey: 'home.status', icon: Users },
]


/* ── Component ── */

export default function HomeScreen() {
  const router = useRouter()
  const { t } = useLanguage()
  const { profile, deviceId } = useApp()
  const { user: authUser, isAuthenticated } = useAuthContext()

  const [walletBalance, setWalletBalance] = useState<number | null>(null)
  const [balanceVisible, setBalanceVisible] = useState(true)
  const [balanceFailed, setBalanceFailed] = useState(false)
  // Seed from the wallet cache so a fetch failure never renders a funded
  // wallet as GH₵ 0.00 (UX-13; same cache the Wallet tab uses).
  useEffect(() => {
    getCachedWallet().then((snap) => {
      if (snap) setWalletBalance((prev) => prev ?? snap.balance)
    })
  }, [])
  // Refetch on focus (not just mount) so the balance reflects a top-up or
  // booking debit the moment the user returns Home.
  useFocusEffect(
    useCallback(() => {
      if (!authUser?.id) return
      const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://www.troski.me'
      fetch(`${API_URL}/api/wallet/balance?auth_user_id=${authUser.id}`)
        .then(r => r.json())
        .then(data => {
          if (data.balance != null) { setWalletBalance(data.balance); setBalanceFailed(false) }
        })
        .catch(() => setBalanceFailed(true))
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
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${location.longitude},${location.latitude}.json?types=place,locality&limit=1&access_token=${MAPBOX_TOKEN}`
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
  // null = never loaded and no cache: show a dash, never a fake GH₵ 0.00 (UX-13)
  const formattedBalance = !balanceVisible
    ? '******'
    : walletBalance != null ? formatGHS(walletBalance) : 'GH₵ —'

  const handleServiceTap = useCallback((svc: Service) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    if (svc.comingSoon) { Alert.alert(svc.label, `${svc.label} is coming soon!`); return }
    if (svc.id === 'train') { router.push('/(tabs)/train' as any); return }
    if (svc.route) router.push(svc.route as any)
  }, [router])

  const handleQuickAction = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (id === 'directions') router.push('/routes/search' as any)
    else if (id === 'nearby') router.push('/terminals' as any)
    else if (id === 'queue') router.push('/queue/status' as any)
  }, [router])

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: ui.bg }}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* ── Header ── */}
        <View style={{ paddingHorizontal: space.gutter, paddingTop: space.md, paddingBottom: space.gutter }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 }}>
              <Pressable
                onPress={() => router.push('/settings' as Href)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Open settings"
              >
                <InitialsAvatar name={displayName} deviceId={deviceId || ''} size={48} />
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text style={[type.title, { color: ui.text }]} numberOfLines={1}>
                  {t('home.hello')}, {firstName}
                </Text>
                {/* Static label — was a dead Pressable with a chevron affordance (UX-26) */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                  <MapPin size={14} color={brand.orange} />
                  <Text style={[type.label, { color: ui.textSecondary }]} numberOfLines={1}>
                    {locationName}
                  </Text>
                </View>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {/* Coins chip — Rewards' daily-return hook, now that it's off the tab bar */}
              <Pressable
                onPress={() => router.push('/(tabs)/rewards' as any)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Rewards and coins"
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 5,
                  height: 44, paddingHorizontal: space.md, borderRadius: radius.pill,
                  backgroundColor: ui.warningSoft,
                }}
              >
                <Trophy size={18} color={ui.warning} />
                <Text style={[type.labelStrong, { color: ui.warning }]}>
                  {profile?.total_points ?? 0}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => router.push('/(tabs)/activity' as any)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Notifications"
                style={{
                  width: 44, height: 44, borderRadius: 22,
                  backgroundColor: ui.surface,
                  justifyContent: 'center', alignItems: 'center',
                }}
              >
                <Bell size={22} color={ui.text} />
              </Pressable>
            </View>
          </View>
        </View>

        {/* ── Wallet card — one solid brand card ── */}
        <View style={{ paddingHorizontal: space.gutter, marginBottom: space.gutter }}>
          <View
            style={{
              backgroundColor: brand.orange,
              borderRadius: radius.xl,
              padding: space.gutter,
              overflow: 'hidden',
              ...cardShadow,
            }}
          >
            {/* One soft disc for depth */}
            <View style={{ position: 'absolute', top: -60, right: -40, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.08)' }} />

            {/* Top: label + eye toggle */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[type.label, { color: 'rgba(255,255,255,0.8)' }]}>{t('home.walletBalance')}</Text>
              <Pressable
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setBalanceVisible(!balanceVisible) }}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel={balanceVisible ? 'Hide balance' : 'Show balance'}
                style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center' }}
              >
                {balanceVisible ? <Eye size={18} color={ui.onBrand} /> : <EyeOff size={18} color={ui.onBrand} />}
              </Pressable>
            </View>

            {/* Balance — HeroText carries Baloo-safe line metrics */}
            <HeroText size={40} style={{ color: ui.onBrand, letterSpacing: -1.5, marginTop: space.sm, marginBottom: balanceFailed ? space.xs : space.lg }}>
              {formattedBalance}
            </HeroText>
            {balanceFailed && (
              <Text style={[type.caption, { color: 'rgba(255,255,255,0.85)', marginBottom: space.md }]}>
                Couldn&apos;t update — {walletBalance != null ? 'showing last known balance' : 'check your connection'}
              </Text>
            )}

            {/* Actions */}
            <View style={{ flexDirection: 'row', gap: space.md }}>
              <Tap
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(isAuthenticated ? '/wallet/fund' as Href : '/auth/phone' as Href) }}
                accessibilityRole="button"
                accessibilityLabel={t('home.topupWallet')}
                style={{
                  flex: 1, height: 52, borderRadius: radius.md, backgroundColor: ui.card,
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm,
                }}
              >
                <Plus size={18} color={brand.orange} strokeWidth={2.6} />
                <Text style={[type.labelStrong, { fontSize: 15, color: ui.text }]}>{t('home.topupWallet')}</Text>
              </Tap>
              <Tap
                // Scan-to-pay is a non-functional mock (accepts any PIN, no real debit) —
                // gated coming-soon like the other not-yet-live services below.
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); Alert.alert('Scan to Pay', 'Scan to Pay is coming soon!') }}
                accessibilityRole="button"
                accessibilityLabel={`${t('home.scanToPay')}, coming soon`}
                style={{
                  flex: 1, height: 52, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.16)',
                  borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)',
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm,
                }}
              >
                <ScanLine size={17} color={ui.onBrand} />
                <Text style={[type.labelStrong, { fontSize: 15, color: ui.onBrand }]}>{t('home.scanToPay')}</Text>
                <View style={{ position: 'absolute', top: -8, right: -6 }}>
                  <Badge label="Soon" tone="dark" />
                </View>
              </Tap>
            </View>
          </View>
        </View>

        {/* ── Quick actions ── */}
        <View style={{ paddingHorizontal: space.gutter, marginBottom: space.section }}>
          <View style={{ flexDirection: 'row', gap: space.md }}>
            {QUICK_ACTIONS.map((action) => {
              const Icon = action.icon
              const actionLabel = t(action.labelKey)
              return (
                <Card key={action.id} onPress={() => handleQuickAction(action.id)} accessibilityLabel={actionLabel} style={{ flex: 1 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[type.bodyMedium, { fontFamily: font.bold, color: ui.text }]}>{actionLabel}</Text>
                    <Text style={[type.label, { fontFamily: font.regular, color: ui.textSecondary, marginBottom: space.md }]}>{t(action.subKey)}</Text>
                    <View style={{
                      width: 40, height: 40, borderRadius: 20,
                      backgroundColor: brand.orangeSoft,
                      justifyContent: 'center', alignItems: 'center',
                      alignSelf: 'flex-end',
                      marginTop: 'auto', // icons line up even when a label wraps
                    }}>
                      <Icon size={20} color={brand.orange} strokeWidth={2.25} />
                    </View>
                  </View>
                </Card>
              )
            })}
          </View>
        </View>

        {/* ── Services ── */}
        <View style={{ marginBottom: space.section }}>
          <SectionHeader title={t('home.services')} style={{ paddingHorizontal: space.gutter, marginBottom: space.lg }} />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: space.gutter, gap: space.md }}
          >
            {SERVICES.map((svc) => (
              <Tap
                key={svc.id}
                onPress={() => handleServiceTap(svc)}
                accessibilityRole="button"
                accessibilityLabel={svc.comingSoon ? `${svc.label}, coming soon` : svc.label}
                style={{
                  width: 100,
                  backgroundColor: ui.card,
                  borderRadius: radius.lg,
                  paddingTop: space.lg,
                  paddingBottom: space.md,
                  alignItems: 'center',
                  ...cardShadow,
                }}
              >
                {/* "Soon" badge — honest at a glance for not-yet-live services */}
                {svc.comingSoon && (
                  <View style={{ position: 'absolute', top: 8, right: 8 }}>
                    <Badge label="Soon" />
                  </View>
                )}
                <Image source={svc.image} style={{ width: 60, height: 60, marginBottom: space.sm, opacity: svc.comingSoon ? 0.45 : 1 }} contentFit="contain" transition={0} />
                <Text style={[type.labelStrong, { color: svc.comingSoon ? ui.textSecondary : ui.text, textAlign: 'center' }]}>{svc.label}</Text>
              </Tap>
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
