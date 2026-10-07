import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'
import { ChevronRight } from 'lucide-react-native'
import { supabase } from '@/lib/supabase/client'
import { font } from '@/lib/theme'
import { formatGHS } from '@/lib/utils/currency'
import { timeAgo } from '@/lib/utils/time'
import { REPORT_POINTS } from '@/lib/constants/rewards'
import type { RouteFareStats } from '@/lib/types'
import { CARD, ORANGE, ORANGE_SOFT, TEXT, TEXT2 } from './tokens'

// Same source + filters as the Plan a Trip "Popular trips" carousel
// (app/routes/search.tsx fetchPopularTrips): official GPRTU fares on the current
// schedule. Rider-reported fare comes from the route_fare_stats view.
const CURRENT_SCHEDULE_FROM = '2026-09-26'
const MAX_ROWS = 3

interface FareRow {
  key: string
  from: string
  to: string
  official: number
  riderAvg: number | null
  lastReportAt: string | null
}

async function fetchTodaysFares(): Promise<FareRow[]> {
  const { data, error } = await supabase
    .from('routes')
    .select('id,from_location,to_location,official_fare,is_popular')
    .eq('is_gprtu_verified', true)
    .eq('region', 'greater_accra')
    .gte('fare_approved_at', CURRENT_SCHEDULE_FROM)
    .gt('official_fare', 0)
    .order('is_popular', { ascending: false })
    .order('official_fare', { ascending: true })
    .limit(60)
  if (error) throw error
  const seen = new Set<string>()
  const picked: { id: string; from: string; to: string; official: number }[] = []
  for (const r of data ?? []) {
    const pair = [r.from_location, r.to_location].sort().join('|')
    if (seen.has(pair)) continue
    seen.add(pair)
    picked.push({ id: r.id, from: r.from_location, to: r.to_location, official: Number(r.official_fare) })
    if (picked.length === MAX_ROWS) break
  }
  if (picked.length === 0) return []
  const { data: stats } = await supabase
    .from('route_fare_stats')
    .select('route_id,avg_reported_fare,report_count,last_report_at')
    .in('route_id', picked.map((p) => p.id))
  const byRoute = new Map<string, Pick<RouteFareStats, 'route_id' | 'avg_reported_fare' | 'report_count' | 'last_report_at'>>(
    (stats ?? []).map((s) => [s.route_id, s]),
  )
  return picked.map((p) => {
    const s = byRoute.get(p.id)
    const has = s && s.report_count > 0 && Number(s.avg_reported_fare) > 0
    return {
      key: `${p.id}`, from: p.from, to: p.to, official: p.official,
      riderAvg: has ? Number(s!.avg_reported_fare) : null,
      lastReportAt: has ? s!.last_report_at : null,
    }
  })
}

function Skeleton() {
  return (
    <View style={{ gap: 14, paddingTop: 6 }}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={{ height: 40, borderRadius: 10, backgroundColor: '#F3F1EF' }} />
      ))}
    </View>
  )
}

export default function TodaysFares() {
  const router = useRouter()
  const q = useQuery({
    queryKey: ['release-home-fares', CURRENT_SCHEDULE_FROM],
    queryFn: fetchTodaysFares,
    staleTime: 10 * 60 * 1000,
  })

  // Never a fake card: hide on error or when there is nothing to show.
  if (q.isError || (!q.isLoading && (q.data?.length ?? 0) === 0)) return null

  return (
    <View style={{ marginHorizontal: 20, marginTop: 18, backgroundColor: CARD.bg, borderRadius: 18, borderWidth: 1, borderColor: CARD.border, padding: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text style={{ fontFamily: font.bold, fontSize: 17, color: TEXT }}>Today&apos;s fares</Text>
        <TouchableOpacity
          activeOpacity={0.6}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.navigate('/(tabs)/lines' as any) }}
          accessibilityRole="button"
          accessibilityLabel="All fares"
          hitSlop={8}
          style={{ flexDirection: 'row', alignItems: 'center' }}
        >
          <Text style={{ fontFamily: font.bold, fontSize: 14, color: ORANGE }}>All fares</Text>
          <ChevronRight size={16} color={ORANGE} />
        </TouchableOpacity>
      </View>

      {q.isLoading ? <Skeleton /> : (
        <View>
          {q.data!.map((r, i) => (
            <View
              key={r.key}
              style={{
                paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10,
                borderTopWidth: i === 0 ? 0 : 1, borderTopColor: CARD.border,
              }}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontFamily: font.bold, fontSize: 15, color: TEXT }} numberOfLines={1}>
                  {r.from} → {r.to}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                  <View style={{ backgroundColor: '#E8F6EE', borderRadius: 100, paddingHorizontal: 8, paddingVertical: 2 }}>
                    <Text style={{ fontFamily: font.bold, fontSize: 10, color: '#15803D', letterSpacing: 0.2 }}>GPRTU OFFICIAL</Text>
                  </View>
                  {r.riderAvg != null ? (
                    <Text style={{ fontFamily: font.regular, fontSize: 12, color: TEXT2, flexShrink: 1 }} numberOfLines={1}>
                      Riders paid {formatGHS(r.riderAvg)} · {timeAgo(r.lastReportAt)}
                    </Text>
                  ) : null}
                </View>
              </View>
              <Text style={{ fontFamily: font.extrabold, fontSize: 17, color: TEXT }}>{formatGHS(r.official)}</Text>
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/report/fare' as any) }}
        accessibilityRole="button"
        accessibilityLabel={`Report a fare you paid, plus ${REPORT_POINTS.fare} coins`}
        style={{
          marginTop: 6, height: 46, borderRadius: 12, backgroundColor: ORANGE_SOFT,
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Text style={{ fontFamily: font.bold, fontSize: 14, color: ORANGE }}>
          Report a fare you paid · +{REPORT_POINTS.fare}
        </Text>
      </TouchableOpacity>
    </View>
  )
}
