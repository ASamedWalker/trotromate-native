import React from 'react'
import { View, Text, ScrollView, TouchableOpacity } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { ChevronRight, Map as MapIcon, Users } from 'lucide-react-native'
import { font } from '@/lib/theme'
import { BackButton } from '@/components/BackButton'
import { HeroText } from '@/components/HeroText'
import { FreshnessDot } from '@/components/FreshnessDot'
import { LineBadge } from '@/components/LineBadge'
import { QUEUE_COLOR, QUEUE_WORD } from '@/lib/constants/queueStatus'
import { freshness, ageLabel } from '@/lib/utils/freshness'
import { formatGHS } from '@/lib/utils/currency'
import { useStationDetail } from '@/lib/hooks/useStationDetail'
import { CARD, ORANGE, ORANGE_SOFT, TEXT, TEXT2 } from '@/components/home/tokens'

/**
 * Station page (redesign wave 2): "is there a queue / which lines leave here?"
 * Queue status as the hero with its age, a report button, the lines from here
 * and the last reports. The map stays opt-in.
 */
export default function StationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { station, isLoading, isError, lines, reports } = useStationDetail(id)

  if (isLoading) {
    return <View style={{ flex: 1, backgroundColor: '#FAFAF9', paddingTop: insets.top + 12, paddingHorizontal: 20 }}><BackButton /></View>
  }
  if (isError || !station) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FAFAF9', paddingTop: insets.top + 12, paddingHorizontal: 20, gap: 16 }}>
        <BackButton />
        <Text style={{ fontFamily: font.bold, fontSize: 18, color: TEXT }}>{isError ? 'Could not load this station' : 'Station not found'}</Text>
      </View>
    )
  }

  const stat = station.queue_stats?.[0]
  const kind = stat?.current_status ? freshness(stat.last_report_at) : 'stale'
  const status = stat?.current_status
  const heroColor = kind === 'stale' || !status ? '#6B7280' : QUEUE_COLOR[status]
  const report = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    router.push({ pathname: '/report/queue', params: { station_id: station.id, station_name: station.name } } as any)
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#FAFAF9' }} contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40, paddingHorizontal: 20, gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <BackButton />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: font.extrabold, fontSize: 22, lineHeight: 30, color: TEXT }} numberOfLines={2}>{station.name}</Text>
          {station.location ? <Text style={{ fontFamily: font.regular, fontSize: 13, color: TEXT2 }} numberOfLines={1}>{station.location}</Text> : null}
        </View>
        <TouchableOpacity
          onPress={() => router.push('/stations' as any)}
          accessibilityRole="button"
          accessibilityLabel="View on map. Uses more data"
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: CARD.bg, borderWidth: 1, borderColor: CARD.border, alignItems: 'center', justifyContent: 'center' }}
        >
          <MapIcon size={20} color={TEXT} />
        </TouchableOpacity>
      </View>

      {/* Queue hero */}
      <View style={{ backgroundColor: CARD.bg, borderRadius: 18, borderWidth: 1, borderColor: CARD.border, padding: 16 }}>
        <Text style={{ fontFamily: font.extrabold, fontSize: 12, letterSpacing: 1, color: TEXT2 }}>QUEUE RIGHT NOW</Text>
        <View
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 }}
          accessible
          accessibilityLabel={kind === 'stale' || !status ? 'No recent queue report' : `${QUEUE_WORD[status]}, reported ${ageLabel(stat?.last_report_at)}`}
        >
          <FreshnessDot kind={kind} color={heroColor} size={14} />
          <HeroText size={32} style={{ color: heroColor }}>{kind === 'stale' || !status ? 'No recent report' : QUEUE_WORD[status]}</HeroText>
        </View>
        <Text style={{ fontFamily: font.regular, fontSize: 14, color: TEXT2 }}>
          {kind === 'stale' || !status
            ? 'Be the first to say how the queue looks.'
            : `Reported ${ageLabel(stat?.last_report_at)}${stat?.report_count_last_hour ? ` · ${stat.report_count_last_hour} ${stat.report_count_last_hour === 1 ? 'report' : 'reports'} in the last hour` : ''}`}
        </Text>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={report}
          accessibilityRole="button"
          accessibilityLabel={`Report the queue at ${station.name}`}
          style={{ marginTop: 14, height: 56, borderRadius: 14, backgroundColor: ORANGE, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          <Users size={18} color="#FFFFFF" />
          <Text style={{ fontFamily: font.extrabold, fontSize: 15, color: '#FFFFFF' }}>Report the queue here</Text>
        </TouchableOpacity>
      </View>

      {/* Lines from here */}
      <View style={{ backgroundColor: CARD.bg, borderRadius: 18, borderWidth: 1, borderColor: CARD.border, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 }}>
        <Text style={{ fontFamily: font.extrabold, fontSize: 19, color: TEXT, marginBottom: 4 }}>Lines from here</Text>
        {lines.isLoading ? (
          <View style={{ height: 40, borderRadius: 10, backgroundColor: '#F3F1EF', marginVertical: 10 }} />
        ) : (lines.data ?? []).length === 0 ? (
          <Text style={{ fontFamily: font.regular, fontSize: 14, color: TEXT2, paddingVertical: 10 }}>No lines linked to this station yet.</Text>
        ) : (lines.data ?? []).map((r, i) => {
          const dest = r.from_location.toLowerCase().includes(station.name.toLowerCase().split(' ')[0]) ? r.to_location : r.from_location
          return (
            <TouchableOpacity
              key={r.id}
              activeOpacity={0.7}
              onPress={() => router.push({ pathname: '/routes/[id]', params: { id: r.id } } as any)}
              accessibilityRole="button"
              accessibilityLabel={`${r.from_location} to ${r.to_location}${r.official_fare && r.is_gprtu_verified ? `, ${formatGHS(Number(r.official_fare))} GPRTU fare` : ''}`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: CARD.border }}
            >
              <LineBadge from={r.from_location} to={r.to_location} />
              <Text style={{ flex: 1, fontFamily: font.bold, fontSize: 15, color: TEXT }} numberOfLines={1}>to {dest}</Text>
              {r.official_fare && r.is_gprtu_verified ? (
                <>
                  <Text style={{ fontFamily: font.extrabold, fontSize: 16, color: TEXT }}>{formatGHS(Number(r.official_fare))}</Text>
                  <Text style={{ fontFamily: font.extrabold, fontSize: 10, color: '#15803D' }}>GPRTU</Text>
                </>
              ) : null}
              <ChevronRight size={16} color="#9CA3AF" />
            </TouchableOpacity>
          )
        })}
      </View>

      {/* Recent reports */}
      {(reports.data ?? []).length > 0 ? (
        <View style={{ backgroundColor: CARD.bg, borderRadius: 18, borderWidth: 1, borderColor: CARD.border, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 }}>
          <Text style={{ fontFamily: font.extrabold, fontSize: 19, color: TEXT, marginBottom: 4 }}>Recent reports</Text>
          {(reports.data ?? []).map((r, i) => {
            const k = freshness(r.reported_at)
            const c = k === 'stale' ? '#6B7280' : QUEUE_COLOR[r.queue_status]
            return (
              <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: CARD.border }}>
                <FreshnessDot kind={k} color={c} />
                <Text style={{ flex: 1, fontFamily: font.extrabold, fontSize: 14, color: c }}>{QUEUE_WORD[r.queue_status] ?? r.queue_status}</Text>
                <Text style={{ fontFamily: font.regular, fontSize: 13, color: TEXT2 }}>{ageLabel(r.reported_at)}</Text>
              </View>
            )
          })}
          <Text style={{ fontFamily: font.regular, fontSize: 12, color: TEXT2, paddingVertical: 8 }}>Reports older than 2 hours are greyed out.</Text>
        </View>
      ) : null}

      <TouchableOpacity
        onPress={report}
        accessibilityRole="button"
        accessibilityLabel="Report the queue"
        style={{ height: 46, borderRadius: 12, backgroundColor: ORANGE_SOFT, alignItems: 'center', justifyContent: 'center' }}
      >
        <Text style={{ fontFamily: font.bold, fontSize: 14, color: ORANGE }}>At {station.name}? Tell riders how it looks</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}
