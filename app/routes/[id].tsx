import { useLocalSearchParams } from 'expo-router'
import {
  View,
  Text,
  ScrollView,
  useColorScheme,
  ActivityIndicator,
  StyleSheet,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MapPin, Clock, TrendingUp, Users } from 'lucide-react-native'
import { c, themed, font } from '@/lib/theme'
import { useRouteDetail, useFareTrend } from '@/lib/hooks/useRoutes'
import { timeAgo } from '@/lib/utils/time'
import { TripShareButton } from '@/components/TripShareButton'
import { SOSButton } from '@/components/SOSButton'
import { TrafficBadge } from '@/components/TrafficBadge'
import { BusynessMeter } from '@/components/BusynessMeter'
import { useTrafficInfo } from '@/lib/hooks/useTraffic'
import { FareTrendChart } from '@/components/FareTrendChart'

const TRAFFIC_CONDITION_COLORS: Record<string, { light: string; dark: string }> = {
  light: { light: '#059669', dark: '#34d399' },
  moderate: { light: '#d97706', dark: '#fbbf24' },
  heavy: { light: '#ea580c', dark: '#fb923c' },
  severe: { light: '#dc2626', dark: '#f87171' },
}

export default function RouteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const t = themed(isDark)
  const s = getStyles(isDark)

  const { route, recentReports, isLoading, error } = useRouteDetail(id!)
  const { data: traffic } = useTrafficInfo(id)
  const { trend, isLoading: trendLoading, days: trendDays, setDays: setTrendDays } = useFareTrend(id!)

  if (isLoading) {
    return (
      <SafeAreaView style={s.container} edges={['bottom']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={c.amber500} />
        </View>
      </SafeAreaView>
    )
  }

  if (error || !route) {
    return (
      <SafeAreaView style={s.container} edges={['bottom']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <MapPin size={48} color={t.textTertiary} />
          <Text style={[s.emptyTitle, { marginTop: 16 }]}>Route not found</Text>
        </View>
      </SafeAreaView>
    )
  }

  const displayFare = route.fare_stats?.avg_reported_fare ?? route.official_fare
  const reportCount = route.fare_stats?.report_count ?? 0
  const lastUpdated = timeAgo(route.fare_stats?.last_report_at ?? null)

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {/* Route Header */}
        <View style={s.headerCard}>
          <View style={s.headerRow}>
            <View style={s.headerIcon}>
              <MapPin size={24} color={c.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.routeTitle}>
                {route.from_location} → {route.to_location}
              </Text>
              {traffic?.duration_in_traffic_mins ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={[s.routeId, { color: TRAFFIC_CONDITION_COLORS[traffic.traffic_condition || 'light'][isDark ? 'dark' : 'light'], fontFamily: font.medium }]}>
                    {traffic.duration_in_traffic_mins} min
                  </Text>
                  {traffic.delay_mins > 0 && (
                    <Text style={[s.routeId, { fontSize: 12 }]}>
                      (+{traffic.delay_mins}m delay)
                    </Text>
                  )}
                </View>
              ) : (
                <Text style={s.routeId}>
                  {route.estimated_duration_mins ? `~${route.estimated_duration_mins} min` : `Official: ₵${route.official_fare.toFixed(2)}`}
                </Text>
              )}
            </View>
          </View>

          {/* Current Fare */}
          <View style={s.fareBox}>
            <Text style={s.fareLabel}>Current Fare</Text>
            <Text style={s.fareValue}>₵{displayFare.toFixed(2)}</Text>
            <View style={s.fareUpdated}>
              <Clock size={14} color={t.textSecondary} />
              <Text style={s.fareUpdatedText}>{lastUpdated}</Text>
            </View>
          </View>

          {/* Stats */}
          <View style={s.statsRow}>
            <View style={s.statBox}>
              <View style={s.statIconRow}>
                <TrendingUp size={16} color={c.amber500} />
                <Text style={s.statLabel}>Reports</Text>
              </View>
              <Text style={s.statValue}>{reportCount}</Text>
            </View>
            <View style={s.statBox}>
              <View style={s.statIconRow}>
                <Users size={16} color={traffic?.duration_in_traffic_mins
                  ? TRAFFIC_CONDITION_COLORS[traffic.traffic_condition || 'light'][isDark ? 'dark' : 'light'] as string
                  : c.violet500
                } />
                <Text style={s.statLabel}>
                  {traffic?.duration_in_traffic_mins ? 'Live ETA' : 'Est. Time'}
                </Text>
              </View>
              <Text style={[s.statValue, traffic?.duration_in_traffic_mins != null ? {
                color: TRAFFIC_CONDITION_COLORS[traffic.traffic_condition || 'light'][isDark ? 'dark' : 'light'],
              } : undefined]}>
                {traffic?.duration_in_traffic_mins
                  ? `${traffic.duration_in_traffic_mins}m`
                  : route.estimated_duration_mins ? `${route.estimated_duration_mins}m` : '--'
                }
              </Text>
            </View>
          </View>
        </View>

        {/* Fare Trend Chart */}
        <FareTrendChart
          key={trendDays}
          data={trend}
          officialFare={route.official_fare}
          isLoading={trendLoading}
          selectedPeriod={trendDays}
          onPeriodChange={setTrendDays}
          routeName={`${route.from_location} → ${route.to_location}`}
        />

        {/* Traffic Conditions */}
        {traffic && (traffic.traffic_condition || traffic.busyness.confidence > 0) && (
          <View style={s.trafficCard}>
            <View style={s.trafficHeader}>
              <View style={s.trafficLiveDot} />
              <Text style={s.trafficTitle}>Live Traffic</Text>
            </View>
            <TrafficBadge
              condition={traffic.traffic_condition}
              delayMins={traffic.delay_mins}
              isDark={isDark}
            />
            {traffic.duration_in_traffic_mins != null && traffic.typical_duration_mins != null && (
              <View style={{ gap: 6 }}>
                <View style={s.etaRow}>
                  <Text style={s.etaLabel}>Typical: {traffic.typical_duration_mins} min</Text>
                  <Text style={s.etaValue}>Now: {traffic.duration_in_traffic_mins} min</Text>
                </View>
                <View style={[s.durationBarBg, { backgroundColor: isDark ? '#292524' : '#f5f5f4' }]}>
                  <View style={[s.durationBarFill, {
                    backgroundColor: TRAFFIC_CONDITION_COLORS[traffic.traffic_condition || 'light'][isDark ? 'dark' : 'light'],
                    width: `${Math.min(100, (traffic.duration_in_traffic_mins / (traffic.typical_duration_mins * 1.5)) * 100)}%` as `${number}%`,
                  }]} />
                </View>
              </View>
            )}
            <BusynessMeter level={traffic.busyness.level} isDark={isDark} />
          </View>
        )}

        {/* Safety Actions */}
        <View style={s.safetyRow}>
          <TripShareButton
            routeId={id}
            from={route.from_location}
            to={route.to_location}
            estimatedMins={route.estimated_duration_mins}
          />
          <SOSButton from={route.from_location} to={route.to_location} />
        </View>

        {/* Recent Reports */}
        <View style={s.reportsSection}>
          <Text style={s.sectionTitle}>Recent Reports</Text>
          {recentReports.length > 0 ? (
            recentReports.map((report) => (
              <View key={report.id} style={s.reportRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.reportFare}>₵{report.reported_fare.toFixed(2)}</Text>
                  <Text style={s.reportTime}>{timeAgo(report.reported_at)}</Text>
                </View>
              </View>
            ))
          ) : (
            <View style={s.emptyCard}>
              <TrendingUp size={32} color={t.textTertiary} />
              <Text style={s.emptyTitle}>No recent reports yet</Text>
              <Text style={s.emptySubtitle}>Be the first to report!</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const getStyles = (isDark: boolean) => {
  const t = themed(isDark)
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    headerCard: {
      marginHorizontal: 20,
      marginTop: 16,
      padding: 20,
      borderRadius: 24,
      backgroundColor: t.card,
    },
    headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    headerIcon: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: c.amber500,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    routeTitle: { fontSize: 20, fontFamily: font.bold, color: t.text },
    routeId: { fontSize: 14, color: t.textSecondary },
    fareBox: {
      padding: 16,
      borderRadius: 16,
      marginBottom: 16,
      backgroundColor: isDark ? c.stone800 : c.amber50,
    },
    fareLabel: { fontSize: 14, marginBottom: 4, color: isDark ? c.stone400 : c.amber700 },
    fareValue: { fontSize: 32, fontFamily: font.bold, color: c.amber500 },
    fareUpdated: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
    fareUpdatedText: { fontSize: 12, marginLeft: 4, color: t.textSecondary },
    statsRow: { flexDirection: 'row', gap: 12 } as const,
    trafficCard: {
      marginHorizontal: 20,
      marginTop: 16,
      padding: 16,
      borderRadius: 20,
      backgroundColor: t.card,
      gap: 10,
    },
    trafficHeader: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 6,
    },
    trafficLiveDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#10b981',
    },
    trafficTitle: {
      fontSize: 14,
      fontFamily: font.semibold,
      color: t.text,
    },
    etaRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
    },
    etaLabel: { fontSize: 12, color: t.textSecondary },
    etaValue: { fontSize: 12, fontFamily: font.semibold, color: t.text },
    etaUsual: { fontSize: 13, fontFamily: font.medium, color: t.textSecondary },
    durationBarBg: {
      height: 8,
      borderRadius: 4,
      overflow: 'hidden' as const,
    },
    durationBarFill: {
      height: 8,
      borderRadius: 4,
    },
    safetyRow: {
      flexDirection: 'row' as const,
      gap: 12,
      marginHorizontal: 20,
      marginTop: 16,
    },
    statBox: {
      flex: 1,
      padding: 16,
      borderRadius: 16,
      backgroundColor: t.cardAlt,
    },
    statIconRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    statLabel: { marginLeft: 8, fontSize: 12, color: t.textSecondary },
    statValue: { fontSize: 20, fontFamily: font.bold, color: t.text },
    reportsSection: { paddingHorizontal: 20, marginTop: 24, marginBottom: 32 },
    sectionTitle: { fontSize: 18, fontFamily: font.semibold, marginBottom: 12, color: t.text },
    reportRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderRadius: 12,
      marginBottom: 8,
      backgroundColor: t.card,
    },
    reportFare: { fontSize: 16, fontFamily: font.semibold, color: c.amber500 },
    reportTime: { fontSize: 12, color: t.textSecondary, marginTop: 2 },
    emptyCard: {
      padding: 20,
      borderRadius: 16,
      alignItems: 'center',
      backgroundColor: t.card,
    },
    emptyTitle: { marginTop: 12, fontFamily: font.medium, color: t.textSecondary },
    emptySubtitle: { fontSize: 14, marginTop: 4, color: t.textTertiary },
  })
}
