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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { TAB_BAR_CLEARANCE } from '@/app/(tabs)/_layout'
import * as Haptics from 'expo-haptics'
import { useRouter, useFocusEffect, type Href } from 'expo-router'
import {
  MapPin,
  Bell, Compass, BusFront as BusIcon, Users,
  ScanLine, Plus, Trophy,
} from 'lucide-react-native'
import { font, brand, ui, space, radius, type, cardShadow } from '@/lib/theme'
import { WalletCard } from '@/components/WalletCard'
import { useWalletCardTheme } from '@/lib/hooks/useWalletCardTheme'
import { Card, SectionHeader, Badge, Tap } from '@/components/ui'
import { useLanguage } from '@/lib/i18n'
import { formatGHS } from '@/lib/utils/currency'
import { useApp } from '@/lib/contexts/AppContext'
import { useLocation } from '@/lib/hooks/useLocation'
import { useAuthContext } from '@/lib/contexts/AuthContext'
import InitialsAvatar from '@/components/InitialsAvatar'
import WhatsOnAccra from '@/components/WhatsOnAccra'
import { getCachedWallet, cacheWalletBalance } from '@/lib/services/walletCache'
import { MAPBOX_TOKEN } from '@/lib/config/mapbox'
import { authedFetch } from '@/lib/services/authedFetch'
import { RELEASE_MODE } from '@/lib/config/release'
import ReleaseHome from '@/components/home/ReleaseHome'
import MyRoutesCard from '@/components/home/MyRoutesCard'

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

// Store release shows the slim home; the full home below is untouched.
export default function HomeScreen() {
  return RELEASE_MODE ? <ReleaseHome /> : <FullHomeScreen />
}

function FullHomeScreen() {
  const { theme: cardTheme } = useWalletCardTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { t } = useLanguage()
  const { profile, deviceId } = useApp()
  const { user: authUser, isAuthenticated } = useAuthContext()

  const [walletBalance, setWalletBalance] = useState<number | null>(null)
  const [balanceVisible, setBalanceVisible] = useState(true)
  const [balanceFailed, setBalanceFailed] = useState(false)
  // Seed from the wallet cache so a fetch failure never renders a funded
  // wallet as GH₵ 0.00 (UX-13; same cache the Wallet tab uses).
  useEffect(() => {
    setWalletBalance(null)
    getCachedWallet(authUser?.id).then((snap) => {
      if (snap) setWalletBalance((prev) => prev ?? snap.balance)
    })
  }, [authUser?.id])
  // Refetch on focus (not just mount) so the balance reflects a top-up or
  // booking debit the moment the user returns Home.
  useFocusEffect(
    useCallback(() => {
      if (!authUser?.id) return
      // Paint the latest snapshot first (checkout writes the post-debit balance
      // there), then confirm with the server.
      getCachedWallet(authUser.id).then((snap) => { if (snap) setWalletBalance(snap.balance) })
      const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://www.troski.me'
      authedFetch(`${API_URL}/api/wallet/balance?auth_user_id=${authUser.id}`)
        .then(r => { if (!r.ok) throw new Error(`wallet ${r.status}`); return r.json() })
        .then(data => {
          if (data.balance != null) { setWalletBalance(data.balance); setBalanceFailed(false); cacheWalletBalance(Number(data.balance), authUser.id) }
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
  // Auto-assigned names ("Troski Fan #CD13") aren't a person's name — greet plainly.
  const firstName = /^Troski Fan #/.test(displayName) ? null : displayName.split(' ')[0]
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
    if (id === 'directions') router.push('/routes/search?focus=to' as any)
    else if (id === 'nearby') router.push('/terminals' as any)
    else if (id === 'queue') router.push('/queue/status' as any)
  }, [router])

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: ui.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE + insets.bottom }}>

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
                  {firstName ? `${t('home.hello')}, ${firstName}` : t('home.hello')}
                </Text>
                {!isAuthenticated ? (
                  <Pressable
                    onPress={() => router.push('/auth/phone' as Href)}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel="Sign in"
                    style={{
                      alignSelf: 'flex-start', height: 32, paddingHorizontal: 14, marginTop: 4, marginBottom: 2,
                      borderRadius: radius.pill, borderWidth: 1.5, borderColor: brand.orange,
                      justifyContent: 'center', alignItems: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 13, fontFamily: font.semibold, color: brand.orange }}>Sign in</Text>
                  </Pressable>
                ) : null}
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

        {/* ── My routes: saved routes' fare + queue (same data as the morning push) ── */}
        <MyRoutesCard style={{ marginHorizontal: space.gutter, marginTop: 0, marginBottom: space.gutter }} />

        {/* ── Wallet card — split Ghana transit-card design, actions underneath ── */}
        <View style={{ paddingHorizontal: space.gutter, marginBottom: space.gutter, gap: space.md }}>
          <WalletCard
            theme={cardTheme}
            onPressCard={() => router.push('/wallet/card' as Href)}
            label={t('home.walletBalance')}
            balanceText={formattedBalance}
            balanceVisible={balanceVisible}
            onToggleBalance={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setBalanceVisible(!balanceVisible) }}
            footnote={balanceFailed ? (walletBalance != null ? 'Offline · last known balance' : 'Offline · check connection') : undefined}
          />
          <View style={{ flexDirection: 'row', gap: space.md }}>
            <Tap
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(isAuthenticated ? '/wallet/fund' as Href : '/auth/phone' as Href) }}
              accessibilityRole="button"
              accessibilityLabel={t('home.topupWallet')}
              style={{
                flex: 1, height: 52, borderRadius: radius.md, backgroundColor: brand.orange,
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm,
              }}
            >
              <Plus size={18} color={ui.onBrand} strokeWidth={2.6} />
              <Text style={[type.labelStrong, { fontSize: 15, color: ui.onBrand }]}>{t('home.topupWallet')}</Text>
            </Tap>
            <Tap
              // Scan-to-pay is a non-functional mock (accepts any PIN, no real debit) —
              // gated coming-soon like the other not-yet-live services below.
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); Alert.alert('Scan to Pay', 'Scan to Pay is coming soon!') }}
              accessibilityRole="button"
              accessibilityLabel={`${t('home.scanToPay')}, coming soon`}
              accessibilityState={{ disabled: true }}
              style={{
                flex: 1, height: 52, borderRadius: radius.md, backgroundColor: ui.card,
                borderWidth: 1.5, borderColor: ui.surfaceStrong, opacity: 0.75,
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm,
              }}
            >
              <ScanLine size={17} color={ui.text} />
              <Text style={[type.labelStrong, { fontSize: 15, color: ui.text }]}>{t('home.scanToPay')}</Text>
              <View style={{ position: 'absolute', top: -8, right: -6 }}>
                <Badge label="Soon" tone="dark" />
              </View>
            </Tap>
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
                    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={[type.bodyMedium, { fontFamily: font.bold, color: ui.text }]}>{actionLabel}</Text>
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

      </ScrollView>
    </SafeAreaView>
  )
}
