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
import { useRouteDetail } from '@/lib/hooks/useRoutes'
import { timeAgo } from '@/lib/utils/time'

export default function RouteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const t = themed(isDark)
  const s = getStyles(isDark)

  const { route, recentReports, isLoading, error } = useRouteDetail(id!)

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
              <Text style={s.routeId}>
                {route.estimated_duration_mins ? `~${route.estimated_duration_mins} min` : `Official: ₵${route.official_fare.toFixed(2)}`}
              </Text>
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
                <Users size={16} color={c.violet500} />
                <Text style={s.statLabel}>Est. Time</Text>
              </View>
              <Text style={s.statValue}>
                {route.estimated_duration_mins ? `${route.estimated_duration_mins}m` : '--'}
              </Text>
            </View>
          </View>
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
    statsRow: { flexDirection: 'row', gap: 12 },
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
