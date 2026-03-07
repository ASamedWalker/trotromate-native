import { useLocalSearchParams, useRouter } from 'expo-router'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  useColorScheme,
  ActivityIndicator,
  StyleSheet,
} from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MapPin, Clock, TrendingUp, Users, Plus } from 'lucide-react-native'
import { c, themed, font } from '@/lib/theme'
import { useRouteDetail, useFareTrend } from '@/lib/hooks/useRoutes'
import { timeAgo } from '@/lib/utils/time'
import { TripShareButton } from '@/components/TripShareButton'
import { SOSButton } from '@/components/SOSButton'
import { TrafficBadge } from '@/components/TrafficBadge'
import { BusynessMeter } from '@/components/BusynessMeter'
import { useTrafficInfo } from '@/lib/hooks/useTraffic'
import { FareTrendChart } from '@/components/FareTrendChart'
import { useHaptics } from '@/lib/hooks/useHaptics'
import { detectRegion, REGION_HEROES } from '@/lib/config/regions'

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

  const router = useRouter()
  const haptics = useHaptics()

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
  const minFare = route.fare_stats?.min_reported_fare
  const maxFare = route.fare_stats?.max_reported_fare
  const hasFareRange = minFare != null && maxFare != null && minFare !== maxFare

  // Detect region for hero image
  const regionKey = detectRegion(route.from_location)
  const hero = REGION_HEROES.find(h => h.key === regionKey)

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {/* Hero Header with City Image */}
        <View style={s.heroSection}>
          {hero ? (
            <>
              <Image
                source={{ uri: hero.heroImage }}
                style={[StyleSheet.absoluteFillObject, { backgroundColor: hero.placeholderColor }]}
                contentFit="cover"
                transition={400}
                cachePolicy="disk"
              />
              <LinearGradient
                colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.65)']}
                style={StyleSheet.absoluteFillObject}
              />
            </>
          ) : (
            <LinearGradient
              colors={[c.amber500, c.amber700]}
              style={StyleSheet.absoluteFillObject}
            />
          )}
          <View style={s.heroContent}>
            <Text style={s.heroRouteTitle}>
              {route.from_location} → {route.to_location}
            </Text>
            {traffic?.duration_in_traffic_mins ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[s.heroSubtitle, { color: TRAFFIC_CONDITION_COLORS[traffic.traffic_condition || 'light'].dark }]}>
                  {traffic.duration_in_traffic_mins} min
                </Text>
                {traffic.delay_mins > 0 && (
                  <Text style={s.heroSubtitle}>(+{traffic.delay_mins}m delay)</Text>
                )}
              </View>
            ) : (
              <Text style={s.heroSubtitle}>
                {route.estimated_duration_mins ? `~${route.estimated_duration_mins} min` : hero?.label || ''}
              </Text>
            )}
          </View>
        </View>

        {/* Fare Card */}
        <View style={s.fareCard}>
          <View style={s.fareCardHeader}>
            <Text style={s.fareLabel}>Current Fare</Text>
            <View style={s.fareUpdated}>
              <Clock size={14} color={t.textSecondary} />
              <Text style={s.fareUpdatedText}>{lastUpdated}</Text>
            </View>
          </View>
          <Text style={s.fareValue}>₵{displayFare.toFixed(2)}</Text>
          {hasFareRange && (
            <Text style={s.fareRange}>
              Range: ₵{minFare.toFixed(2)} – ₵{maxFare.toFixed(2)}
            </Text>
          )}
        </View>

        {/* Stats Row */}
        <View style={s.statsRowContainer}>
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

        {/* Fare Trend Chart */}
        <FareTrendChart
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
          <View style={s.reportsTitleRow}>
            <Text style={s.sectionTitle}>Recent Reports</Text>
            {reportCount > 0 && (
              <View style={s.reportCountBadge}>
                <Text style={s.reportCountText}>{reportCount}</Text>
              </View>
            )}
          </View>
          {recentReports.length > 0 ? (
            recentReports.map((report) => (
              <View key={report.id} style={s.reportRow}>
                <View style={s.reportAccent} />
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

        {/* Report Fare CTA */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => {
            haptics.light()
            router.push('/report/fare')
          }}
          style={s.reportCta}
        >
          <Plus size={20} color={c.white} />
          <Text style={s.reportCtaText}>Report a Fare</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const getStyles = (isDark: boolean) => {
  const t = themed(isDark)
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    // Hero header
    heroSection: {
      height: 180,
      overflow: 'hidden' as const,
    },
    heroContent: {
      flex: 1,
      justifyContent: 'flex-end' as const,
      padding: 20,
    },
    heroRouteTitle: {
      fontSize: 22,
      fontFamily: font.bold,
      color: c.white,
    },
    heroSubtitle: {
      fontSize: 14,
      fontFamily: font.medium,
      color: 'rgba(255,255,255,0.85)',
      marginTop: 4,
    },
    // Fare card
    fareCard: {
      marginHorizontal: 20,
      marginTop: 16,
      padding: 20,
      borderRadius: 20,
      backgroundColor: t.card,
      borderWidth: isDark ? 0 : 1,
      borderColor: t.border,
    },
    fareCardHeader: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      marginBottom: 8,
    },
    fareLabel: { fontSize: 14, color: isDark ? c.stone400 : c.amber700 },
    fareValue: { fontSize: 36, fontFamily: font.bold, color: c.amber500 },
    fareRange: {
      fontSize: 13,
      fontFamily: font.medium,
      color: t.textSecondary,
      marginTop: 4,
    },
    fareUpdated: { flexDirection: 'row' as const, alignItems: 'center' as const },
    fareUpdatedText: { fontSize: 12, marginLeft: 4, color: t.textSecondary },
    // Stats row
    statsRowContainer: {
      flexDirection: 'row' as const,
      gap: 12,
      marginHorizontal: 20,
      marginTop: 12,
    },
    statBox: {
      flex: 1,
      padding: 16,
      borderRadius: 16,
      backgroundColor: t.cardAlt,
      borderWidth: isDark ? 0 : 1,
      borderColor: t.border,
    },
    statIconRow: { flexDirection: 'row' as const, alignItems: 'center' as const, marginBottom: 8 },
    statLabel: { marginLeft: 8, fontSize: 12, color: t.textSecondary },
    statValue: { fontSize: 20, fontFamily: font.bold, color: t.text },
    // Traffic card
    trafficCard: {
      marginHorizontal: 20,
      marginTop: 16,
      padding: 16,
      borderRadius: 20,
      backgroundColor: t.card,
      gap: 10,
      borderWidth: isDark ? 0 : 1,
      borderColor: t.border,
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
    durationBarBg: {
      height: 8,
      borderRadius: 4,
      overflow: 'hidden' as const,
    },
    durationBarFill: {
      height: 8,
      borderRadius: 4,
    },
    // Safety row
    safetyRow: {
      flexDirection: 'row' as const,
      gap: 12,
      marginHorizontal: 20,
      marginTop: 16,
    },
    // Reports section
    reportsSection: { paddingHorizontal: 20, marginTop: 24 },
    reportsTitleRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 8,
      marginBottom: 12,
    },
    sectionTitle: { fontSize: 18, fontFamily: font.semibold, color: t.text },
    reportCountBadge: {
      backgroundColor: c.amber500,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
    },
    reportCountText: {
      fontSize: 12,
      fontFamily: font.semibold,
      color: c.white,
    },
    reportRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      padding: 16,
      borderRadius: 12,
      marginBottom: 8,
      backgroundColor: t.card,
      borderWidth: isDark ? 0 : 1,
      borderColor: t.border,
    },
    reportAccent: {
      width: 3,
      height: 32,
      borderRadius: 2,
      backgroundColor: c.amber500,
      marginRight: 12,
    },
    reportFare: { fontSize: 16, fontFamily: font.semibold, color: c.amber500 },
    reportTime: { fontSize: 12, color: t.textSecondary, marginTop: 2 },
    // Report CTA
    reportCta: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      gap: 8,
      marginHorizontal: 20,
      marginTop: 20,
      marginBottom: 32,
      paddingVertical: 16,
      borderRadius: 16,
      backgroundColor: c.amber500,
    },
    reportCtaText: {
      fontSize: 16,
      fontFamily: font.semibold,
      color: c.white,
    },
    // Empty state
    emptyCard: {
      padding: 20,
      borderRadius: 16,
      alignItems: 'center' as const,
      backgroundColor: t.card,
      borderWidth: isDark ? 0 : 1,
      borderColor: t.border,
    },
    emptyTitle: { marginTop: 12, fontFamily: font.medium, color: t.textSecondary },
    emptySubtitle: { fontSize: 14, marginTop: 4, color: t.textTertiary },
  })
}
