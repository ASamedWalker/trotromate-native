import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter, type Href } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'
import { SvgXml } from 'react-native-svg'
import { Bell, Trophy, Search, MessageCircle, Briefcase, House } from 'lucide-react-native'
import { TAB_BAR_CLEARANCE } from '@/app/(tabs)/_layout'
import { font } from '@/lib/theme'
import { useApp } from '@/lib/contexts/AppContext'
import { useAuthContext } from '@/lib/contexts/AuthContext'
import { useLocation } from '@/lib/hooks/useLocation'
import InitialsAvatar from '@/components/InitialsAvatar'
import { MAPBOX_TOKEN } from '@/lib/config/mapbox'
import { adinkraXml, ADINKRA_ORDER } from '@/lib/brand/adinkra'
import { fetchTales } from '@/lib/services/tales'
import { pulseKind } from '@/lib/utils/pulse-extract'
import { timeAgo } from '@/lib/utils/time'
import MyRoutesCard, { useCommute } from './MyRoutesCard'
import NearbyStationsCard from './NearbyStationsCard'
import { useAlerts } from '@/lib/hooks/useAlerts'
import { AlertRow } from '@/components/AlertRow'
import { corridorKey } from '@/lib/constants/corridors'
import { AdinkraWallpaper } from '@/components/AdinkraWallpaper'
import { formatGHS } from '@/lib/utils/currency'
import NextTrainCard from './NextTrainCard'
import ReleaseWhatsOn from './ReleaseWhatsOn'
import { CARD, ORANGE, TEXT, TEXT2 } from './tokens'

// Store-release Home (canvas "Store release — 5 tabs"). Rendered by
// app/(tabs)/index.tsx only when RELEASE_MODE; no wallet / okada / live buses.

// Same Ghana guard the full Home uses against implausible simulator locations.
const GHANA = { minLat: 4.5, maxLat: 11.5, minLng: -3.5, maxLng: 1.5 }
const FALLBACK_LOCATION = 'Accra, GH'

const STRIP_COUNT = 9
let stripXmls: string[] | null = null
function stripSymbols(): string[] {
  if (!stripXmls) {
    stripXmls = Array.from({ length: STRIP_COUNT }, (_, i) => adinkraXml(ADINKRA_ORDER[i % ADINKRA_ORDER.length], 18, '#E7DED6'))
  }
  return stripXmls
}

function AdinkraStrip() {
  return (
    <View style={{ marginHorizontal: 20, marginTop: 22, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }} pointerEvents="none">
      {stripSymbols().map((xml, i) => <SvgXml key={i} xml={xml} width={18} height={18} />)}
    </View>
  )
}

function useLocationName(): string {
  const { location } = useLocation()
  const [name, setName] = useState(FALLBACK_LOCATION)
  useEffect(() => {
    if (!location) return
    const { latitude: lat, longitude: lng } = location
    if (lat < GHANA.minLat || lat > GHANA.maxLat || lng < GHANA.minLng || lng > GHANA.maxLng) {
      setName(FALLBACK_LOCATION)
      return
    }
    let cancelled = false
    fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?types=place,locality&limit=1&access_token=${MAPBOX_TOKEN}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        const f = data.features?.[0]
        if (!f) { setName(FALLBACK_LOCATION); return }
        const country = f.context?.find((c: any) => c.id?.startsWith('country'))?.short_code?.toUpperCase() || 'GH'
        setName(`${f.text}, ${country}`)
      })
      .catch(() => { if (!cancelled) setName(FALLBACK_LOCATION) })
    return () => { cancelled = true }
  }, [location?.latitude, location?.longitude]) // eslint-disable-line react-hooks/exhaustive-deps
  return name
}

// Latest Pulse question (same feed service as the Pulse tab).
function RidersAsking() {
  const router = useRouter()
  const q = useQuery({
    queryKey: ['release-home-question'],
    queryFn: async () => {
      const { posts } = await fetchTales({ limit: 30 })
      return posts.find((p) => pulseKind(p) === 'question' && (p.caption ?? '').trim().length > 0) ?? null
    },
    staleTime: 5 * 60 * 1000,
  })
  const post = q.data
  if (!post) return null
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.navigate('/(tabs)/tales' as any) }}
      accessibilityRole="button"
      accessibilityLabel="Riders are asking. Open Pulse"
      style={{ marginHorizontal: 20, marginTop: 22, backgroundColor: CARD.bg, borderRadius: 18, borderWidth: 1, borderColor: CARD.border, padding: 16 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <MessageCircle size={16} color={ORANGE} />
        <Text style={{ fontFamily: font.bold, fontSize: 13, color: ORANGE, letterSpacing: 0.3 }}>RIDERS ARE ASKING</Text>
      </View>
      <Text style={{ fontFamily: font.semibold, fontSize: 16, color: TEXT, marginTop: 8 }} numberOfLines={3}>{post.caption}</Text>
      <Text style={{ fontFamily: font.regular, fontSize: 12, color: TEXT2, marginTop: 8 }} numberOfLines={1}>
        {post.comment_count > 0 ? `${post.comment_count} ${post.comment_count === 1 ? 'answer' : 'answers'} · ` : ''}{timeAgo(post.created_at)}
      </Text>
    </TouchableOpacity>
  )
}

// Daylight (05:00–18:00 Ghana time, UTC+0) = warm band with the Adinkra
// wallpaper behind "Where to?"; after sunset = dark band with a faint pattern.
function useIsNight(): boolean {
  const h = new Date().getUTCHours()
  return h >= 18 || h < 5
}

function greeting(): string {
  const h = new Date().getUTCHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

const DAY_BAND = '#FFF3EA'
const NIGHT_BAND = '#16110D'

export default function ReleaseHome() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const { profile, deviceId } = useApp()
  const { isAuthenticated } = useAuthContext()
  const locationName = useLocationName()
  const night = useIsNight()
  const { saved, variant, infoById } = useCommute()
  const alertsQ = useAlerts()
  // Alerts on a corridor the rider saved first, then city-wide ones; at most two on Home.
  const savedKeys = new Set(saved.map((f) => corridorKey(f.from, f.to)))
  const homeAlerts = (alertsQ.data ?? [])
    .filter((a) => a.citywide || a.corridors.some((k) => savedKeys.has(k)))
    .sort((a, b) => Number(b.corridors.some((k) => savedKeys.has(k))) - Number(a.corridors.some((k) => savedKeys.has(k))))
    .slice(0, 2)

  const displayName = profile?.display_name || 'Commuter'
  // Auto-assigned names ("Troski Fan #CD13") aren't a person's name — greet plainly.
  const firstName = /^Troski Fan #/.test(displayName) ? null : displayName.split(' ')[0]

  const fg = night ? '#FFFFFF' : TEXT
  const sub = night ? 'rgba(255,255,255,0.75)' : TEXT2
  const chipBg = night ? 'rgba(255,255,255,0.12)' : '#FFFFFF'
  const coinColor = night ? '#FCD34D' : '#B45309'
  const bandH = insets.top + 200

  // Work / Home shortcut (Transit's home shortcut in the search bar): the first
  // saved route, in today's direction, with its fare instead of a made-up ETA.
  const first = saved[0]
  const firstInfo = first ? infoById.get(first.id) : undefined
  const shortcutName = variant === 'morning' ? 'Work' : 'Home'

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#FAFAF9' }}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE + insets.bottom }}
    >
      {/* ── Band: Adinkra wallpaper behind the greeting and "Where to?" ── */}
      <View style={{ overflow: 'hidden', backgroundColor: night ? NIGHT_BAND : DAY_BAND, paddingTop: insets.top + 12, paddingBottom: 92 }}>
        <AdinkraWallpaper
          width={width}
          height={bandH}
          size={30}
          color={night ? 'rgba(255,255,255,0.07)' : 'rgba(232,70,26,0.13)'}
        />
        <View style={{ paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/profile' as Href)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Open your profile"
          >
            <InitialsAvatar name={displayName} deviceId={deviceId || ''} size={44} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: font.semibold, fontSize: 14, color: sub }} numberOfLines={1}>{greeting()}</Text>
            <Text style={{ fontFamily: font.extrabold, fontSize: 20, color: fg }} numberOfLines={1}>
              {firstName ?? 'Commuter'}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ fontFamily: font.medium, fontSize: 13, color: sub }} numberOfLines={1}>
                {variant === 'morning' ? 'Heading out?' : 'Heading home?'} · {locationName}
              </Text>
            </View>
          </View>
          {!isAuthenticated ? (
            <TouchableOpacity
              onPress={() => router.push('/auth/phone' as Href)}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Sign in"
              style={{ height: 36, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1.5, borderColor: fg, justifyContent: 'center' }}
            >
              <Text style={{ fontFamily: font.semibold, fontSize: 13, color: fg }}>Sign in</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/rewards' as any)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Rewards, ${profile?.total_points ?? 0} coins`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 5, height: 40, paddingHorizontal: 12, borderRadius: 999, backgroundColor: chipBg }}
          >
            <Trophy size={16} color={coinColor} />
            <Text style={{ fontFamily: font.extrabold, fontSize: 14, color: coinColor }}>{profile?.total_points ?? 0}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/activity' as any)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Notifications"
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: chipBg, alignItems: 'center', justifyContent: 'center' }}
          >
            <Bell size={20} color={fg} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Search bar on the wallpaper, with the Work/Home shortcut ── */}
      <View style={{
        marginHorizontal: 20, marginTop: -66, height: 60, borderRadius: 18, backgroundColor: CARD.bg, flexDirection: 'row', overflow: 'hidden',
        shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.14, shadowRadius: 16, elevation: 6,
      }}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/routes/search?focus=to' as any) }}
          accessibilityRole="button"
          accessibilityLabel="Where to? Search a station or line"
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12 }}
        >
          <Search size={20} color={ORANGE} strokeWidth={2.4} />
          <Text style={{ fontFamily: font.bold, fontSize: 15, color: TEXT }}>Where to?</Text>
        </TouchableOpacity>
        {first ? (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push({ pathname: '/routes/[id]', params: { id: first.id } } as any) }}
            accessibilityRole="button"
            accessibilityLabel={`${shortcutName}: ${firstInfo?.from ?? first.from} to ${firstInfo?.to ?? first.to}${firstInfo?.fare ? `, ${formatGHS(firstInfo.fare.amount)}` : ''}`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, borderLeftWidth: 1, borderLeftColor: CARD.border, backgroundColor: '#FFF7F2' }}
          >
            {variant === 'morning' ? <Briefcase size={20} color={ORANGE} /> : <House size={20} color={ORANGE} />}
            <View>
              <Text style={{ fontFamily: font.extrabold, fontSize: 13, color: TEXT }}>{shortcutName}</Text>
              <Text style={{ fontFamily: font.bold, fontSize: 12, color: TEXT2 }}>
                {firstInfo?.fare ? `${firstInfo.fare.source === 'reported' ? '~' : ''}${formatGHS(firstInfo.fare.amount)}` : '—'}
              </Text>
            </View>
          </TouchableOpacity>
        ) : null}
      </View>

      {homeAlerts.length > 0 ? (
        <View style={{ marginHorizontal: 20, marginTop: 18, gap: 8 }}>
          {homeAlerts.map((a) => (
            <AlertRow key={a.id} alert={a} onPress={() => router.navigate('/(tabs)/tales' as any)} />
          ))}
        </View>
      ) : null}

      <MyRoutesCard />
      <NearbyStationsCard />

      <AdinkraStrip />

      <View style={{ marginTop: 22 }}>
        <NextTrainCard />
      </View>

      <ReleaseWhatsOn />
      <RidersAsking />
    </ScrollView>
  )
}
