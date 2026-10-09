import React, { useMemo, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, FlatList, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { ChevronRight, Map as MapIcon, MapPin, Plus, Search } from 'lucide-react-native'
import { font } from '@/lib/theme'
import { TAB_BAR_CLEARANCE } from '@/app/(tabs)/_layout'
import { useStations } from '@/lib/hooks/useStations'
import { useLocation } from '@/lib/hooks/useLocation'
import { AdinkraWallpaper } from '@/components/AdinkraWallpaper'
import { QueueStatusLine, queueA11y } from '@/components/QueueStatusLine'
import { freshness } from '@/lib/utils/freshness'
import type { StationWithQueue } from '@/lib/services/stations'
import { CARD, ORANGE, TEXT, TEXT2 } from '@/components/home/tokens'

type Sort = 'nearby' | 'busiest' | 'az'

const GHANA = { minLat: 4.5, maxLat: 11.5, minLng: -3.5, maxLng: 1.5 }

function km(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const r = (d: number) => (d * Math.PI) / 180
  const h = Math.sin(r(bLat - aLat) / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(r(bLng - aLng) / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(h))
}

const fmtKm = (d: number) => (d < 1 ? `${Math.round((d * 1000) / 50) * 50} m` : `${d.toFixed(1)} km`)

/**
 * Stations tab (redesign wave 2): every station as a list with its queue status
 * and how old the report is. Nearby / Busiest / A–Z. The map is opt-in ("Map").
 */
export default function StationsTab() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const { stations, isLoading } = useStations()
  const { location } = useLocation()
  const inGhana = !!location &&
    location.latitude >= GHANA.minLat && location.latitude <= GHANA.maxLat &&
    location.longitude >= GHANA.minLng && location.longitude <= GHANA.maxLng
  // null = automatic: Nearby once location is known, Busiest until then.
  const [chosenSort, setSort] = useState<Sort | null>(null)
  const sort: Sort = chosenSort ?? (inGhana ? 'nearby' : 'busiest')
  const [query, setQuery] = useState('')

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = stations.map((s) => ({
      s,
      d: inGhana && s.latitude != null && s.longitude != null
        ? km(location!.latitude, location!.longitude, Number(s.latitude), Number(s.longitude))
        : null,
    }))
    if (q) list = list.filter(({ s }) => s.name.toLowerCase().includes(q))
    const fresh = (s: StationWithQueue) => (freshness(s.queue_stats?.[0]?.last_report_at) === 'stale' ? 0 : 1)
    const busy = (s: StationWithQueue) => s.queue_stats?.[0]?.report_count_last_hour ?? 0
    if (sort === 'nearby' && inGhana) list.sort((a, b) => (a.d ?? 1e9) - (b.d ?? 1e9))
    else if (sort === 'az') list.sort((a, b) => a.s.name.localeCompare(b.s.name))
    else list.sort((a, b) => fresh(b.s) - fresh(a.s) || busy(b.s) - busy(a.s) || Number(b.s.is_major) - Number(a.s.is_major))
    return list
  }, [stations, query, sort, inGhana, location])

  const header = (
    <View>
      <View style={{ overflow: 'hidden', backgroundColor: '#FFF3EA', paddingTop: insets.top + 16, paddingBottom: 14 }}>
        <AdinkraWallpaper width={width} height={insets.top + 220} size={26} color="rgba(232,70,26,0.10)" />
        <View style={{ paddingHorizontal: 20, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: font.extrabold, fontSize: 30, lineHeight: 40, color: TEXT }}>Stations</Text>
            <Text style={{ fontFamily: font.regular, fontSize: 14, color: TEXT2 }}>Queues at trotro stations</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/stations' as any)}
            accessibilityRole="button"
            accessibilityLabel="Open the stations map. Uses more data"
            style={{ height: 40, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: CARD.border, backgroundColor: CARD.bg, flexDirection: 'row', alignItems: 'center', gap: 6 }}
          >
            <MapIcon size={16} color={TEXT} />
            <Text style={{ fontFamily: font.bold, fontSize: 14, color: TEXT }}>Map</Text>
          </TouchableOpacity>
        </View>
        <View style={{ marginHorizontal: 20, marginTop: 14, height: 48, borderRadius: 14, backgroundColor: CARD.bg, borderWidth: 1, borderColor: CARD.border, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 10 }}>
          <Search size={18} color={TEXT2} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search a station"
            placeholderTextColor="#6B7280"
            accessibilityLabel="Search stations"
            style={{ flex: 1, fontFamily: font.regular, fontSize: 15, color: TEXT }}
          />
        </View>
        <View style={{ marginHorizontal: 20, marginTop: 10, flexDirection: 'row', gap: 4, backgroundColor: '#EFEDEA', borderRadius: 14, padding: 4 }}>
          {(['nearby', 'busiest', 'az'] as Sort[]).map((k) => {
            const on = sort === k
            const label = k === 'nearby' ? 'Nearby' : k === 'busiest' ? 'Busiest' : 'A–Z'
            return (
              <TouchableOpacity
                key={k}
                onPress={() => { Haptics.selectionAsync(); setSort(k) }}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={{ flex: 1, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? '#FFFFFF' : 'transparent' }}
              >
                <Text style={{ fontFamily: font.extrabold, fontSize: 14, color: on ? TEXT : TEXT2 }}>{label}</Text>
              </TouchableOpacity>
            )
          })}
        </View>
        {sort === 'nearby' && !inGhana ? (
          <Text style={{ marginHorizontal: 20, marginTop: 8, fontFamily: font.regular, fontSize: 12, color: TEXT2 }}>
            Turn on location to sort by distance. Showing busiest instead.
          </Text>
        ) : null}
      </View>
    </View>
  )

  return (
    <View style={{ flex: 1, backgroundColor: '#FAFAF9' }}>
      <FlatList
        data={isLoading && rows.length === 0 ? [] : rows}
        keyExtractor={({ s }) => s.id}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE + insets.bottom + 70 }}
        ListEmptyComponent={
          <Text style={{ margin: 20, fontFamily: font.regular, fontSize: 14, color: TEXT2 }}>
            {isLoading ? 'Loading stations…' : 'No station matches that name.'}
          </Text>
        }
        renderItem={({ item: { s, d }, index }) => {
          const stat = s.queue_stats?.[0]
          return (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push({ pathname: '/stations/[id]', params: { id: s.id } } as any) }}
              accessibilityRole="button"
              accessibilityLabel={`${s.name}${d != null ? `, ${fmtKm(d)} away` : ''}, ${queueA11y(stat?.current_status, stat?.last_report_at)}`}
              style={{
                marginHorizontal: 20, backgroundColor: CARD.bg, paddingHorizontal: 16, paddingVertical: 12,
                flexDirection: 'row', alignItems: 'center', gap: 12,
                borderLeftWidth: 1, borderRightWidth: 1, borderColor: CARD.border,
                borderTopWidth: index === 0 ? 1 : 0, borderBottomWidth: 1, borderBottomColor: index === rows.length - 1 ? CARD.border : '#F3F1EF',
                borderTopLeftRadius: index === 0 ? 18 : 0, borderTopRightRadius: index === 0 ? 18 : 0,
                borderBottomLeftRadius: index === rows.length - 1 ? 18 : 0, borderBottomRightRadius: index === rows.length - 1 ? 18 : 0,
                marginTop: index === 0 ? 14 : 0,
              }}
            >
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#F3F1EF', alignItems: 'center', justifyContent: 'center' }}>
                <MapPin size={20} color={TEXT} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                  <Text style={{ fontFamily: font.extrabold, fontSize: 15, color: TEXT, flexShrink: 1 }} numberOfLines={1}>{s.name}</Text>
                  {d != null ? <Text style={{ fontFamily: font.regular, fontSize: 13, color: TEXT2 }}>{fmtKm(d)}</Text> : null}
                </View>
                <QueueStatusLine status={stat?.current_status} reportedAt={stat?.last_report_at} size={13} />
              </View>
              <ChevronRight size={18} color="#9CA3AF" />
            </TouchableOpacity>
          )
        }}
      />
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push('/report/queue' as any) }}
        accessibilityRole="button"
        accessibilityLabel="Report a queue"
        style={{
          position: 'absolute', right: 20, bottom: TAB_BAR_CLEARANCE + insets.bottom + 8, height: 52, paddingHorizontal: 18, borderRadius: 26,
          backgroundColor: ORANGE, flexDirection: 'row', alignItems: 'center', gap: 8,
          shadowColor: ORANGE, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
        }}
      >
        <Plus size={18} color="#FFFFFF" />
        <Text style={{ fontFamily: font.extrabold, fontSize: 15, color: '#FFFFFF' }}>Report queue</Text>
      </TouchableOpacity>
    </View>
  )
}
