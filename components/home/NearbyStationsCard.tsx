import React, { useMemo } from 'react'
import { View, Text, Pressable, Linking } from 'react-native'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'
import { ChevronRight, MapPin } from 'lucide-react-native'
import { font, ui, brand } from '@/lib/theme'
import { fetchStations, type StationWithQueue, type QueueStatus } from '@/lib/services/stations'
import type { UserLocation } from '@/lib/hooks/useLocation'
import { HeroText } from '@/components/HeroText'
import { QueueGlyph } from '@/components/QueueGlyph'
import { queueA11y } from '@/components/QueueStatusLine'
import { QUEUE_COLOR } from '@/lib/constants/queueStatus'
import { freshness, ageLabel } from '@/lib/utils/freshness'
import { FlashOnChange } from '@/components/motion/FlashOnChange'
import { PressableScale } from '@/components/motion/PressableScale'
import { useStationLineCounts } from '@/lib/hooks/useStationLineCounts'
import { useLanguage, t as tr } from '@/lib/i18n'
import { ageT } from '@/lib/i18n/home-format'

// Same Ghana guard as everywhere else: a simulator in California is not "near you".
const GHANA = { minLat: 4.5, maxLat: 11.5, minLng: -3.5, maxLng: 1.5 }
const NO_REPORT = '#78716C'
const HAIRLINE = '#F0EFED'

export function inGhana(loc: { latitude: number; longitude: number } | null | undefined): boolean {
  return !!loc && loc.latitude >= GHANA.minLat && loc.latitude <= GHANA.maxLat &&
    loc.longitude >= GHANA.minLng && loc.longitude <= GHANA.maxLng
}

export function km(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const r = (d: number) => (d * Math.PI) / 180
  const dLat = r(bLat - aLat)
  const dLng = r(bLng - aLng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(h))
}

/** Stations sorted by distance from `loc` (km). Stations without coordinates are skipped. */
export function stationsByDistance(list: StationWithQueue[], loc: { latitude: number; longitude: number }) {
  return list
    .filter((s) => s.latitude != null && s.longitude != null)
    .map((s) => ({ s, d: km(loc.latitude, loc.longitude, Number(s.latitude), Number(s.longitude)) }))
    .sort((a, b) => a.d - b.d)
}

// ~4.8 km/h walking. Past half an hour a walk chip stops being useful, so show distance.
function walkLabel(d: number): string {
  const mins = Math.max(1, Math.round((d / 4.8) * 60))
  return mins <= 30 ? tr('homeX.walkMin', { n: mins }) : `${d.toFixed(1)} km`
}

// One short word under the glyph (UX v2 H8/H11); the glyph is never shown alone.
const SHORT_WORD: Record<QueueStatus, string> = {
  empty: 'homeX.near.empty',
  short: 'homeX.near.short',
  moderate: 'homeX.near.moderate',
  long: 'homeX.near.long',
  very_long: 'homeX.near.very_long',
}

export const STATIONS_KEY = ['stations'] as const
export function useStations() {
  return useQuery({ queryKey: STATIONS_KEY, queryFn: fetchStations, staleTime: 2 * 60 * 1000 })
}

interface Props {
  location: UserLocation | null
  /** location permission already granted (Home never asks on its own) */
  granted: boolean
  requestPermission: () => Promise<boolean>
}

/**
 * Home "Near you" (UX v2 H8): 3 closest stations — name, "N lines · age", a walk chip,
 * and QueueGlyph + one word. No GPS → the 3 busiest major stations + "Turn on location"
 * (asks only when tapped). Reads the shared ['stations'] cache; it does not open its own
 * realtime channel (two channels on one topic kill each other).
 */
export default function NearbyStationsCard({ location, granted, requestPermission }: Props) {
  const router = useRouter()
  const { t } = useLanguage()
  const lineCount = useStationLineCounts()
  const q = useStations()
  const geo = granted && inGhana(location)

  const rows = useMemo(() => {
    const list = q.data ?? []
    if (geo) return stationsByDistance(list, location!).slice(0, 3)
    const busy = (s: StationWithQueue) => s.queue_stats?.[0]?.report_count_last_hour ?? 0
    return list
      .filter((s) => s.is_major)
      .sort((a, b) => busy(b) - busy(a))
      .slice(0, 3)
      .map((s) => ({ s, d: null as number | null }))
  }, [q.data, geo, location])

  if (q.isError || (!q.isLoading && rows.length === 0)) return null

  const turnOnLocation = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const ok = await requestPermission()
    // Denied before: the OS won't ask again, so open Settings instead.
    if (!ok) Linking.openSettings().catch(() => {})
  }

  return (
    <View style={{ marginHorizontal: 20, marginTop: 18 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <HeroText size={20} style={{ color: ui.text }}>{geo ? t('homeX.nearYou') : t('homeX.busyStations')}</HeroText>
        <Pressable
          onPress={() => router.navigate('/(tabs)/stationlist' as any)}
          hitSlop={14}
          accessibilityRole="button"
          accessibilityLabel={t('homeX.allStations')}
          style={{ flexDirection: 'row', alignItems: 'center' }}
        >
          <Text style={{ fontFamily: font.medium, fontSize: 13, color: ui.textTertiary }}>{t('homeX.allStations')}</Text>
          <ChevronRight size={14} color={ui.textTertiary} />
        </Pressable>
      </View>

      {!geo ? (
        <Pressable
          onPress={turnOnLocation}
          hitSlop={{ top: 14, bottom: 14 }}
          accessibilityRole="button"
          accessibilityLabel={t('homeX.turnOnLocationA11y')}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: 2 }}
        >
          <MapPin size={14} color={brand.orangeText} />
          <Text style={{ fontFamily: font.bold, fontSize: 13, color: brand.orangeText }}>{t('homeX.turnOnLocation')}</Text>
        </Pressable>
      ) : null}

      <View style={{ marginTop: 8, backgroundColor: ui.card, borderRadius: 16, borderWidth: 1, borderColor: ui.hairline, overflow: 'hidden' }}>
        {q.isLoading ? (
          <View style={{ minHeight: 64, justifyContent: 'center', paddingHorizontal: 14 }}>
            <Text style={{ fontFamily: font.medium, fontSize: 13, color: ui.textTertiary }}>{t('homeX.checkingStations')}</Text>
          </View>
        ) : rows.map(({ s, d }, i) => {
          const stat = s.queue_stats?.[0]
          const fresh = stat ? freshness(stat.last_report_at) : 'stale'
          const live = !!stat && fresh !== 'stale'
          const color = live ? QUEUE_COLOR[stat!.current_status] : NO_REPORT
          const n = lineCount(s)
          const meta = [n ? t(n === 1 ? 'homeX.line' : 'homeX.lines', { n }) : null, live ? ageT(ageLabel(stat!.last_report_at)) : null].filter(Boolean).join(' · ')
          return (
            <PressableScale
              key={s.id}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push({ pathname: '/stations/[id]', params: { id: s.id } } as any) }}
              accessibilityRole="button"
              accessibilityLabel={`${s.name}${d != null ? `, ${walkLabel(d)}` : ''}, ${queueA11y(stat?.current_status, stat?.last_report_at)}`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 14, minHeight: 64, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: HAIRLINE }}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontFamily: font.bold, fontSize: 16, color: ui.text }} numberOfLines={1}>{s.name}</Text>
                {meta ? <Text style={{ fontFamily: font.medium, fontSize: 13, color: ui.textTertiary }} numberOfLines={1}>{meta}</Text> : null}
              </View>
              {d != null ? (
                <View style={{ height: 26, paddingHorizontal: 10, borderRadius: 999, backgroundColor: ui.surface, justifyContent: 'center' }}>
                  <Text style={{ fontFamily: font.semibold, fontSize: 13, color: ui.text }}>{walkLabel(d)}</Text>
                </View>
              ) : null}
              <FlashOnChange token={`${stat?.current_status}:${stat?.last_report_at}`}>
                <View style={{ alignItems: 'flex-end', minWidth: 64 }}>
                  <QueueGlyph status={live ? stat!.current_status : null} color={color} size={15} opacity={fresh === 'aging' ? 0.6 : 1} />
                  <Text style={{ fontFamily: font.bold, fontSize: 13, color }}>{live ? t(SHORT_WORD[stat!.current_status]) : t('homeX.noReport')}</Text>
                </View>
              </FlashOnChange>
            </PressableScale>
          )
        })}
      </View>
    </View>
  )
}
