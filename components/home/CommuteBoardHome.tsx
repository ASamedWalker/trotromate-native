import React, { useCallback, useEffect, useState } from 'react'
import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter, useFocusEffect, type Href } from 'expo-router'
import { setStatusBarStyle } from 'expo-status-bar'
import * as Haptics from 'expo-haptics'
import { Bell, Search, TriangleAlert, ChevronRight, MapPin, ArrowRight } from 'lucide-react-native'
import { TAB_BAR_CLEARANCE } from '@/app/(tabs)/_layout'
import { font, ui, brand } from '@/lib/theme'
import { useApp } from '@/lib/contexts/AppContext'
import { useAuthContext } from '@/lib/contexts/AuthContext'
import { useLocation, type UserLocation } from '@/lib/hooks/useLocation'
import { useSearchHistory } from '@/lib/hooks/useSearchHistory'
import { useAlerts, type ServiceAlert } from '@/lib/hooks/useAlerts'
import { usePullToRefresh } from '@/lib/hooks/usePullToRefresh'
import { corridorKey } from '@/lib/constants/corridors'
import { ageLabel } from '@/lib/utils/freshness'
import { RELEASE_MODE } from '@/lib/config/release'
import { HeroText } from '@/components/HeroText'
import InitialsAvatar from '@/components/InitialsAvatar'
import TroskiCoin from '@/components/TroskiCoin'
import { CountText } from '@/components/motion/CountText'
import { PressableScale } from '@/components/motion/PressableScale'
import MyRoutesCard, { useCommute } from './MyRoutesCard'
import NearbyStationsCard, { inGhana, stationsByDistance, useStations } from './NearbyStationsCard'
import NextTrainCard from './NextTrainCard'
import WalletLine from './WalletLine'
import { UpdatedStamp } from './UpdatedStamp'

// UX v2 Home, Direction A "Commute Board" (canvas https://claude.ai/artifact/DKeQW7FFEXLn8fmPaSs8Qd,
// row Home → Proposed). One Home for both layouts: store (RELEASE_MODE) and full (wallet).
// Order: header → Where to + chips → alerts (≤2) → line blocks → "At <station>?" prompt
// → Near you → next train → wallet line (full layout, signed in).

// Everything Home shows; pull-to-refresh refetches only these.
const HOME_QUERIES = [['home-commute'], ['stations'], ['service-alerts'], ['station-line-ends']]
// The live data the "Updated N min ago" stamp speaks for (line blocks + station queues).
const STAMP_QUERIES = [['home-commute'], ['stations']]

const PROMPT_RADIUS_KM = 0.25
// A cached fix older than this can't place the rider at a station.
const PROMPT_MAX_FIX_AGE_MS = 15 * 60 * 1000

function greeting(): string {
  const h = new Date().getUTCHours() // Ghana = UTC+0
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

// Commute hours for the station prompt (UX v2 H6): 05–09 and 16–20 Ghana time.
function inCommuteHours(d: Date): boolean {
  const h = d.getUTCHours()
  return (h >= 5 && h < 9) || (h >= 16 && h < 20)
}

const ALERT_ACCENT: Record<ServiceAlert['severity'], { bg: string; edge: string; icon: string }> = {
  info: { bg: '#DBEAFE', edge: '#1D4ED8', icon: '#1D4ED8' },
  warning: { bg: '#FEF3C7', edge: '#B45309', icon: '#B45309' },
  severe: { bg: '#FEE2E2', edge: '#B91C1C', icon: '#B91C1C' },
}

/** Alert strip row: title + "SOURCE · age", tinted by severity with a 4 pt edge. */
function AlertStrip({ alert, onPress }: { alert: ServiceAlert; onPress: () => void }) {
  const a = ALERT_ACCENT[alert.severity]
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${alert.title}. Source: ${alert.source}, ${ageLabel(alert.created_at)}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: a.bg, borderRadius: 12, borderLeftWidth: 4, borderLeftColor: a.edge, paddingVertical: 10, paddingHorizontal: 12, minHeight: 56 }}
    >
      <TriangleAlert size={18} color={a.icon} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontFamily: font.bold, fontSize: 15, color: ui.text }} numberOfLines={1}>{alert.title}</Text>
        <Text style={{ fontFamily: font.medium, fontSize: 13, color: ui.textTertiary }} numberOfLines={1}>{alert.source} · {ageLabel(alert.created_at)}</Text>
      </View>
      <ChevronRight size={18} color={ui.textTertiary} />
    </Pressable>
  )
}

/** Grey shortcut chip under "Where to?" (32 pt visual, 48 pt touch). */
function Chip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8 }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ height: 32, paddingHorizontal: 12, borderRadius: 999, backgroundColor: ui.surface, justifyContent: 'center', alignItems: 'center', flexDirection: 'row' }}
    >
      <Text style={{ fontFamily: font.semibold, fontSize: 14, color: ui.text }} numberOfLines={1}>{label}</Text>
    </Pressable>
  )
}

/**
 * "At Madina? Report the queue" (UX v2 H6). Only when location permission is ALREADY
 * granted (Home never prompts), the fix is recent, the rider is within 250 m of a
 * station, and it is commute time (05–09, 16–20).
 */
function StationPrompt({ location, granted }: { location: UserLocation | null; granted: boolean }) {
  const router = useRouter()
  const stations = useStations()
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60 * 1000)
    return () => clearInterval(id)
  }, [])
  if (!granted || !location || !inGhana(location) || !inCommuteHours(now)) return null
  if (now.getTime() - location.timestamp > PROMPT_MAX_FIX_AGE_MS) return null
  const nearest = stationsByDistance(stations.data ?? [], location)[0]
  if (!nearest || nearest.d > PROMPT_RADIUS_KM) return null
  const name = nearest.s.name
  return (
    <PressableScale
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push({ pathname: '/report/queue', params: { station_id: nearest.s.id, station_name: name } } as any) }}
      accessibilityRole="button"
      accessibilityLabel={`At ${name}? Report the queue`}
      style={{ marginHorizontal: 20, marginTop: 12, height: 56, borderRadius: 14, backgroundColor: brand.orange, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 }}
    >
      <MapPin size={20} color={ui.onBrand} />
      <Text style={{ flex: 1, fontFamily: font.bold, fontSize: 16, color: ui.onBrand }} numberOfLines={1}>At {name}? Report the queue</Text>
      <ArrowRight size={18} color={ui.onBrand} />
    </PressableScale>
  )
}

export default function CommuteBoardHome() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { profile, deviceId, refreshProfile } = useApp()
  const { user: authUser, isAuthenticated } = useAuthContext()
  const { refreshing, onRefresh } = usePullToRefresh(HOME_QUERIES, refreshProfile)
  const loc = useLocation()
  const commute = useCommute()
  const { getRecentSearches } = useSearchHistory()
  const alertsQ = useAlerts()

  // Plain light header (no band): dark status-bar icons.
  useFocusEffect(useCallback(() => { setStatusBarStyle('dark') }, []))

  const displayName = profile?.display_name || 'Commuter'
  // Auto-assigned names ("Troski Fan #CD13") aren't a person's name — greet plainly.
  const firstName = /^Troski Fan #/.test(displayName) ? null : displayName.split(' ')[0]
  const coins = profile?.total_points ?? 0

  // Alerts on a corridor the rider saved first, then city-wide ones; at most two on Home.
  const savedKeys = new Set(commute.saved.map((f) => corridorKey(f.from, f.to)))
  const homeAlerts = (alertsQ.data ?? [])
    .filter((a) => a.citywide || a.corridors.some((k) => savedKeys.has(k)))
    .sort((a, b) => Number(b.corridors.some((k) => savedKeys.has(k))) - Number(a.corridors.some((k) => savedKeys.has(k))))
    .slice(0, 2)

  // Shortcut chips: the first saved line's two ends (neutral — the rider never said which
  // end is home or work), then recent destinations.
  const openRoute = (id: string) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push({ pathname: '/routes/[id]', params: { id } } as any) }
  const first = commute.saved[0]
  const chips: { key: string; label: string; onPress: () => void }[] = []
  if (first) {
    chips.push({ key: 'to', label: `To ${first.to}`, onPress: () => openRoute(first.id) })
    chips.push({ key: 'from', label: `From ${first.from}`, onPress: () => openRoute(first.id) })
  }
  const used = new Set(chips.length ? [first!.to.toLowerCase(), first!.from.toLowerCase()] : [])
  for (const r of getRecentSearches(10)) {
    if (chips.length >= 3) break
    const k = r.to.trim().toLowerCase()
    if (!k || used.has(k)) continue
    used.add(k)
    chips.push({ key: `r-${r.routeId}`, label: r.to, onPress: () => openRoute(r.routeId) })
  }

  const granted = loc.isPermissionGranted

  return (
    <View style={{ flex: 1, backgroundColor: ui.bg }}>
    <ScrollView
      style={{ flex: 1, backgroundColor: ui.bg }}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingTop: insets.top + 6, paddingBottom: TAB_BAR_CLEARANCE + insets.bottom + 8 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={brand.orange} colors={[brand.orange]} progressBackgroundColor="#FFFFFF" />}
    >
      {/* ── Header: greeting + updated stamp · coins · bell ── */}
      <View style={{ paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <HeroText size={20} numberOfLines={2} style={{ color: ui.text }}>
            {firstName ? `${greeting()}, ${firstName}` : greeting()}
          </HeroText>
          <UpdatedStamp keys={STAMP_QUERIES} style={{ fontSize: 13, color: ui.textTertiary }} />
        </View>
        {!isAuthenticated ? (
          <Pressable
            onPress={() => router.push('/auth/phone' as Href)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Sign in"
            style={{ height: 36, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1.5, borderColor: ui.text, justifyContent: 'center' }}
          >
            <Text style={{ fontFamily: font.semibold, fontSize: 13, color: ui.text }}>Sign in</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => router.push('/(tabs)/rewards' as any)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`Rewards, ${coins} ${coins === 1 ? 'coin' : 'coins'}`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 5, height: 36, paddingHorizontal: 12, borderRadius: 999, backgroundColor: brand.orangeSoft }}
        >
          <TroskiCoin size={16} />
          <CountText value={coins} format={(n) => `${n} ${n === 1 ? 'coin' : 'coins'}`} style={{ fontFamily: font.bold, fontSize: 14, color: brand.orangeText }} />
        </Pressable>
        <Pressable
          onPress={() => router.push('/(tabs)/activity' as any)}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel="Notifications"
          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: ui.surface, alignItems: 'center', justifyContent: 'center' }}
        >
          <Bell size={20} color={ui.text} />
        </Pressable>
        {/* Profile has no other entry point yet, so the avatar stays (small) until it does.
            Signed out, "Sign in" takes its place. */}
        {isAuthenticated ? <Pressable
          onPress={() => router.push('/(tabs)/profile' as Href)}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel="Open your profile"
        >
          <InitialsAvatar name={displayName} deviceId={deviceId || ''} size={36} />
        </Pressable> : null}
      </View>

      {/* ── Where to? + shortcut chips ── */}
      <View style={{ paddingHorizontal: 20, marginTop: 14 }}>
        <Pressable
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/routes/search?focus=to' as any) }}
          accessibilityRole="button"
          accessibilityLabel="Where to? Search a station or line"
          style={{
            height: 52, borderRadius: 16, backgroundColor: ui.card, borderWidth: 1, borderColor: '#E7E5E4',
            flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16,
            shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
          }}
        >
          <Search size={20} color={ui.text} strokeWidth={2.2} />
          <Text style={{ fontFamily: font.bold, fontSize: 16, color: ui.textSecondary }}>Where to?</Text>
        </Pressable>
        {chips.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10, marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 2, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {chips.map((c) => <Chip key={c.key} label={c.label} onPress={c.onPress} />)}
          </ScrollView>
        ) : null}
      </View>

      {/* ── Alerts (≤2, each with source + age) ── */}
      {homeAlerts.length > 0 ? (
        <View style={{ marginHorizontal: 20, marginTop: 14, gap: 8 }}>
          {homeAlerts.map((a) => (
            <AlertStrip key={a.id} alert={a} onPress={() => router.navigate('/(tabs)/tales' as any)} />
          ))}
        </View>
      ) : null}

      {/* ── Saved lines as corridor colour blocks ── */}
      <MyRoutesCard commute={commute} />

      {/* ── Contextual station prompt ── */}
      <StationPrompt location={loc.location} granted={granted} />

      {/* ── Near you ── */}
      <NearbyStationsCard location={loc.location} granted={granted} requestPermission={loc.requestPermission} />

      {/* ── Next train (timetable) ── */}
      <NextTrainCard />

      {/* ── Wallet: one line, full layout + signed in only ── */}
      {!RELEASE_MODE && isAuthenticated && authUser?.id ? <WalletLine authUserId={authUser.id} /> : null}
    </ScrollView>
    {/* Opaque backdrop under the status bar so scrolled content never runs beneath the clock. */}
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top, backgroundColor: ui.bg }} />
    </View>
  )
}
