import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter, type Href } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import { SvgXml } from 'react-native-svg'
import { MapPin, Bell, Trophy, Search, Users, MessageCircle } from 'lucide-react-native'
import { TAB_BAR_CLEARANCE } from '@/app/(tabs)/_layout'
import { font } from '@/lib/theme'
import { useApp } from '@/lib/contexts/AppContext'
import { useAuthContext } from '@/lib/contexts/AuthContext'
import { useLocation } from '@/lib/hooks/useLocation'
import { useLanguage } from '@/lib/i18n'
import InitialsAvatar from '@/components/InitialsAvatar'
import { MAPBOX_TOKEN } from '@/lib/config/mapbox'
import { adinkraPatternXml, adinkraXml, ADINKRA_ORDER } from '@/lib/brand/adinkra'
import { fetchTales } from '@/lib/services/tales'
import { pulseKind } from '@/lib/utils/pulse-extract'
import { timeAgo } from '@/lib/utils/time'
import TodaysFares from './TodaysFares'
import MyRoutesCard from './MyRoutesCard'
import NextTrainCard from './NextTrainCard'
import ReleaseWhatsOn from './ReleaseWhatsOn'
import { CARD, ORANGE, ORANGE_DEEP, ORANGE_SOFT, TEXT, TEXT2 } from './tokens'

// Store-release Home (canvas "Store release — 5 tabs"). Rendered by
// app/(tabs)/index.tsx only when RELEASE_MODE; no wallet / okada / live buses.

// Same Ghana guard the full Home uses against implausible simulator locations.
const GHANA = { minLat: 4.5, maxLat: 11.5, minLng: -3.5, maxLng: 1.5 }
const FALLBACK_LOCATION = 'Accra, GH'
const BAND_H = 330 // pattern canvas; clipped by the band

const bandPatternCache = new Map<string, string>()
function bandPattern(w: number, h: number): string {
  const key = `${w}x${h}`
  let xml = bandPatternCache.get(key)
  if (!xml) { xml = adinkraPatternXml(w, h, 26, 'rgba(255,255,255,0.09)'); bandPatternCache.set(key, xml) }
  return xml
}

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

function ActionTile({ title, sub, Icon, onPress }: { title: string; sub: string; Icon: any; onPress: () => void }) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress() }}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${sub}`}
      style={{ flex: 1, backgroundColor: CARD.bg, borderRadius: 18, borderWidth: 1, borderColor: CARD.border, padding: 14 }}
    >
      <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: ORANGE_SOFT, alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={20} color={ORANGE} strokeWidth={2.25} />
      </View>
      <Text style={{ fontFamily: font.bold, fontSize: 15, color: TEXT, marginTop: 10 }} numberOfLines={1}>{title}</Text>
      <Text style={{ fontFamily: font.regular, fontSize: 12, color: TEXT2, marginTop: 2 }} numberOfLines={2}>{sub}</Text>
    </TouchableOpacity>
  )
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

export default function ReleaseHome() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const { t } = useLanguage()
  const { profile, deviceId } = useApp()
  const { isAuthenticated } = useAuthContext()
  const locationName = useLocationName()

  const displayName = profile?.display_name || 'Commuter'
  // Auto-assigned names ("Troski Fan #CD13") aren't a person's name — greet plainly.
  const firstName = /^Troski Fan #/.test(displayName) ? null : displayName.split(' ')[0]

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#FAFAF9' }}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE + insets.bottom }}
    >
      {/* ── Brand band ── */}
      <View style={{ overflow: 'hidden', backgroundColor: ORANGE_DEEP, paddingTop: insets.top + 12, paddingBottom: 62 }}>
        <LinearGradient
          colors={['#FF5A28', ORANGE_DEEP]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
        <View style={{ position: 'absolute', top: 0, left: 0 }} pointerEvents="none">
          <SvgXml xml={bandPattern(Math.round(width), BAND_H)} width={Math.round(width)} height={BAND_H} />
        </View>
        <LinearGradient
          colors={['rgba(232,70,26,0)', ORANGE_DEEP]}
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 70 }}
          pointerEvents="none"
        />

        <View style={{ paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
            <TouchableOpacity
              onPress={() => router.push('/settings' as Href)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Open settings"
            >
              <InitialsAvatar name={displayName} deviceId={deviceId || ''} size={46} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: font.bold, fontSize: 18, color: '#FFFFFF' }} numberOfLines={1}>
                {firstName ? `${t('home.hello')}, ${firstName}` : t('home.hello')}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <MapPin size={13} color="rgba(255,255,255,0.85)" />
                <Text style={{ fontFamily: font.medium, fontSize: 13, color: 'rgba(255,255,255,0.85)' }} numberOfLines={1}>{locationName}</Text>
              </View>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {!isAuthenticated ? (
              <TouchableOpacity
                onPress={() => router.push('/auth/phone' as Href)}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="Sign in"
                style={{ height: 36, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1.5, borderColor: '#FFFFFF', justifyContent: 'center' }}
              >
                <Text style={{ fontFamily: font.semibold, fontSize: 13, color: '#FFFFFF' }}>Sign in</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/rewards' as any)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Rewards and coins"
              style={{ flexDirection: 'row', alignItems: 'center', gap: 5, height: 40, paddingHorizontal: 12, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.22)' }}
            >
              <Trophy size={16} color="#FFFFFF" />
              <Text style={{ fontFamily: font.bold, fontSize: 14, color: '#FFFFFF' }}>{profile?.total_points ?? 0}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/activity' as any)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Notifications"
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' }}
            >
              <Bell size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
        <Text style={{ fontFamily: font.semibold, fontSize: 15, color: 'rgba(255,255,255,0.95)', paddingHorizontal: 20, marginTop: 14 }}>
          Know the fare before you board.
        </Text>
      </View>

      {/* ── Search bar overlapping the band ── */}
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/routes/search?focus=to' as any) }}
        accessibilityRole="button"
        accessibilityLabel="Where to? Search a stop"
        style={{
          marginHorizontal: 20, marginTop: -40, height: 60, borderRadius: 18, backgroundColor: CARD.bg,
          flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12,
          shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.14, shadowRadius: 16, elevation: 6,
        }}
      >
        <Search size={20} color={ORANGE} strokeWidth={2.4} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: font.bold, fontSize: 15, color: TEXT }}>{t('home.whereTo')}</Text>
          <Text style={{ fontFamily: font.regular, fontSize: 12, color: TEXT2 }}>Search a stop</Text>
        </View>
      </TouchableOpacity>

      <MyRoutesCard />
      <TodaysFares />

      <View style={{ flexDirection: 'row', gap: 12, marginHorizontal: 20, marginTop: 18 }}>
        <ActionTile title="Queue status" sub="How long is the line?" Icon={Users} onPress={() => router.push('/queue/status' as any)} />
        <ActionTile title="Stations" sub="Trotro and train stops" Icon={MapPin} onPress={() => router.push('/stations' as any)} />
      </View>

      <AdinkraStrip />

      <View style={{ marginTop: 22 }}>
        <NextTrainCard />
      </View>

      <ReleaseWhatsOn />
      <RidersAsking />
    </ScrollView>
  )
}
