import React, { useMemo } from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'
import { ChevronRight, MapPin } from 'lucide-react-native'
import { font } from '@/lib/theme'
import { fetchStations, type StationWithQueue } from '@/lib/services/stations'
import { useLocation } from '@/lib/hooks/useLocation'
import { QueueStatusLine, queueA11y } from '@/components/QueueStatusLine'
import { FlashOnChange } from '@/components/motion/FlashOnChange'
import { PressableScale } from '@/components/motion/PressableScale'
import { useStationLineCounts } from '@/lib/hooks/useStationLineCounts'
import { CARD, ORANGE, TEXT, TEXT2 } from './tokens'

// Same Ghana guard as the band's location name: a simulator in California is not "nearby".
const GHANA = { minLat: 4.5, maxLat: 11.5, minLng: -3.5, maxLng: 1.5 }

function km(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const r = (d: number) => (d * Math.PI) / 180
  const dLat = r(bLat - aLat)
  const dLng = r(bLng - aLng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(h))
}

function fmtKm(d: number): string {
  return d < 1 ? `${Math.round(d * 1000 / 50) * 50} m` : `${d.toFixed(1)} km`
}

/**
 * Home "Nearby stations": the 3 closest stations with their queue status and age
 * (Transit's nearby list, without the map). No location → the 3 busiest major
 * stations. Reads the shared ['stations'] cache; it does not open its own
 * realtime channel (the Stations tab owns that — two channels on one topic
 * kill each other).
 */
export default function NearbyStationsCard() {
  const router = useRouter()
  const lineCount = useStationLineCounts()
  const { location } = useLocation()
  const q = useQuery({ queryKey: ['stations'], queryFn: fetchStations, staleTime: 2 * 60 * 1000 })

  const inGhana = !!location &&
    location.latitude >= GHANA.minLat && location.latitude <= GHANA.maxLat &&
    location.longitude >= GHANA.minLng && location.longitude <= GHANA.maxLng

  const rows = useMemo(() => {
    const list = (q.data ?? []).filter((s) => s.latitude != null && s.longitude != null)
    if (inGhana) {
      return list
        .map((s) => ({ s, d: km(location!.latitude, location!.longitude, Number(s.latitude), Number(s.longitude)) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 3)
    }
    const busy = (s: StationWithQueue) => s.queue_stats?.[0]?.report_count_last_hour ?? 0
    return list
      .filter((s) => s.is_major)
      .sort((a, b) => busy(b) - busy(a))
      .slice(0, 3)
      .map((s) => ({ s, d: null as number | null }))
  }, [q.data, inGhana, location])

  if (q.isError || (!q.isLoading && rows.length === 0)) return null

  return (
    <View style={{ marginHorizontal: 20, marginTop: 18, backgroundColor: CARD.bg, borderRadius: 18, borderWidth: 1, borderColor: CARD.border, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
        <Text style={{ fontFamily: font.extrabold, fontSize: 19, color: TEXT }}>{inGhana ? 'Nearby stations' : 'Busy stations'}</Text>
        <TouchableOpacity
          onPress={() => router.navigate('/(tabs)/stationlist' as any)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="See all stations"
          style={{ flexDirection: 'row', alignItems: 'center' }}
        >
          <Text style={{ fontFamily: font.bold, fontSize: 14, color: ORANGE }}>See all</Text>
          <ChevronRight size={16} color={ORANGE} />
        </TouchableOpacity>
      </View>
      {!inGhana ? (
        <Text style={{ fontFamily: font.regular, fontSize: 12, color: TEXT2 }}>Turn on location to see stations near you</Text>
      ) : null}

      {q.isLoading ? (
        <View style={{ gap: 12, paddingVertical: 12 }}>
          {[0, 1, 2].map((i) => <View key={i} style={{ height: 40, borderRadius: 10, backgroundColor: '#F3F1EF' }} />)}
        </View>
      ) : rows.map(({ s, d }, i) => {
        const stat = s.queue_stats?.[0]
        return (
          <PressableScale
            key={s.id}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push({ pathname: '/stations/[id]', params: { id: s.id } } as any) }}
            accessibilityRole="button"
            accessibilityLabel={`${s.name}${d != null ? `, ${fmtKm(d)} away` : ''}, ${queueA11y(stat?.current_status, stat?.last_report_at)}`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: CARD.border }}
          >
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#F3F1EF', alignItems: 'center', justifyContent: 'center' }}>
              <MapPin size={20} color={TEXT} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                <Text style={{ fontFamily: font.extrabold, fontSize: 15, color: TEXT, flexShrink: 1 }} numberOfLines={1}>{s.name}</Text>
                {d != null ? <Text style={{ fontFamily: font.regular, fontSize: 13, color: TEXT2 }}>{fmtKm(d)}</Text> : null}
              </View>
              <FlashOnChange token={`${stat?.current_status}:${stat?.last_report_at}`}>
                <QueueStatusLine status={stat?.current_status} reportedAt={stat?.last_report_at} size={13} />
              </FlashOnChange>
            </View>
            {lineCount(s) ? <Text style={{ fontFamily: font.bold, fontSize: 12, color: TEXT2 }}>{lineCount(s)} {lineCount(s) === 1 ? 'line' : 'lines'}</Text> : null}
            <ChevronRight size={18} color="#9CA3AF" />
          </PressableScale>
        )
      })}
    </View>
  )
}
