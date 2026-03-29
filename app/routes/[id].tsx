import { useState } from 'react'
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
import { MapPin, Clock, TrendingUp, Users, Plus, AlertTriangle, ChevronRight, ShieldCheck } from 'lucide-react-native'
import { c, font } from '@/lib/theme'
import { useRouteDetail, useFareTrend } from '@/lib/hooks/useRoutes'
import { timeAgo } from '@/lib/utils/time'
import { TripShareButton } from '@/components/TripShareButton'
import { SOSButton } from '@/components/SOSButton'
import { TrafficBadge } from '@/components/TrafficBadge'
import { BusynessMeter } from '@/components/BusynessMeter'
import { useTrafficInfo } from '@/lib/hooks/useTraffic'
import { FareTrendChart } from '@/components/FareTrendChart'
import { useHaptics } from '@/lib/hooks/useHaptics'
// GPRTUBadge replaced with inline ShieldCheck in Stitch redesign
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
  const s = getStyles(isDark)

  const router = useRouter()
  const haptics = useHaptics()
  const [activeTab, setActiveTab] = useState<'details' | 'trend' | 'reports'>('details')

  const { route, recentReports, isLoading, error } = useRouteDetail(id!)
  const { data: traffic } = useTrafficInfo(id)
  const { trend, isLoading: trendLoading, days: trendDays, setDays: setTrendDays } = useFareTrend(id!)

  if (isLoading) {
    return (
      <SafeAreaView style={s.container} edges={['top', 'bottom']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={c.amber500} />
        </View>
      </SafeAreaView>
    )
  }

  if (error || !route) {
    return (
      <SafeAreaView style={s.container} edges={['top', 'bottom']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <MapPin size={48} color="#b2acaa" />
          <Text style={[s.emptyTitle, { marginTop: 16 }]}>Route not found</Text>
        </View>
      </SafeAreaView>
    )
  }

  const displayFare = route.fare_stats?.avg_reported_fare ?? route.official_fare
  const reportCount = route.fare_stats?.report_count ?? 0
  const lastUpdated = timeAgo(route.fare_stats?.last_report_at ?? null)
  const maxFare = route.fare_stats?.max_reported_fare
  const isOvercharge = route.is_gprtu_verified
    && route.fare_stats?.avg_reported_fare != null
    && route.fare_stats.avg_reported_fare > route.official_fare * 1.2

  // Detect region for hero image
  const regionKey = detectRegion(route.from_location)
  const hero = REGION_HEROES.find(h => h.key === regionKey)

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Stitch Hero — tall with cinematic image */}
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
                colors={['transparent', 'rgba(0,0,0,0.25)', isDark ? 'rgba(28,28,30,0.95)' : 'rgba(252,245,242,0.95)']}
                locations={[0, 0.4, 1]}
                style={StyleSheet.absoluteFillObject}
              />
            </>
          ) : (
            <LinearGradient
              colors={['#815100', '#f8a010']}
              style={StyleSheet.absoluteFillObject}
            />
          )}
          <View style={s.heroContent}>
            {/* Badges row */}
            <View style={s.heroBadges}>
              <View style={s.routeTypeBadge}>
                <Text style={s.routeTypeBadgeText}>
                  TROTRO ROUTE
                </Text>
              </View>
              {lastUpdated && (
                <View style={s.lastUpdatedBadge}>
                  <Clock size={10} color={isDark ? '#e5e5e5' : '#5f5b59'} />
                  <Text style={s.lastUpdatedText}>{lastUpdated}</Text>
                </View>
              )}
            </View>

            {/* Route name — massive */}
            <Text style={s.heroRouteTitle}>
              {route.from_location} → {route.to_location}
            </Text>

            {/* Fare display */}
            <View style={s.heroFareRow}>
              <Text style={s.heroFareValue}>GH₵ {displayFare.toFixed(2)}</Text>
              <Text style={s.heroFareLabel}>
                {route.is_gprtu_verified ? 'official fare' : 'reported fare'}
              </Text>
            </View>

            {/* Meta */}
            <View style={s.heroMeta}>
              <Users size={16} color="#815100" />
              <Text style={s.heroMetaText}>{reportCount} Reports</Text>
            </View>
          </View>
        </View>

        {/* Trust & Verification — overlaps hero */}
        <View style={s.trustSection}>
          {/* GPRTU Verified card */}
          {route.is_gprtu_verified && (
            <View style={s.gprtuCard}>
              <View style={s.gprtuIconWrap}>
                <ShieldCheck size={22} color="#059669" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.gprtuTitle}>GPRTU Verified</Text>
                <Text style={s.gprtuSub}>Official union-approved station</Text>
              </View>
              <ChevronRight size={20} color="#b2acaa" />
            </View>
          )}

          {/* Overcharge Warning */}
          {isOvercharge && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.push('/report/fare')}
              style={s.overchargeCard}
            >
              <AlertTriangle size={20} color="#b02500" />
              <View style={{ flex: 1 }}>
                <Text style={s.overchargeTitle}>Overcharge Warning</Text>
                <Text style={s.overchargeDesc}>
                  Community reports suggest fares up to{' '}
                  <Text style={s.overchargeBold}>GH₵ {maxFare?.toFixed(2)}</Text>
                  {' '}during peak hours. Avoid paying above the regulated rate.
                </Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Tab pills — Stitch style */}
        <View style={s.tabRow}>
          {(['details', 'trend', 'reports'] as const).map((tab) => {
            const isActive = activeTab === tab
            const label = tab === 'details' ? 'Details' : tab === 'trend' ? 'Fare Trend' : 'Reports'
            return isActive ? (
              <TouchableOpacity key={tab} activeOpacity={0.9} onPress={() => setActiveTab(tab)}>
                <LinearGradient
                  colors={['#815100', '#f8a010']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.tabPillActive}
                >
                  <Text style={s.tabPillActiveText}>{label}</Text>
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                key={tab}
                activeOpacity={0.7}
                onPress={() => setActiveTab(tab)}
                style={s.tabPill}
              >
                <Text style={s.tabPillText}>{label}</Text>
              </TouchableOpacity>
            )
          })}
        </View>

        {/* ── Details tab ── */}
        {activeTab === 'details' && (
          <>
        {/* Real-time Pulse card — Stitch editorial */}
        {traffic && (traffic.traffic_condition || traffic.busyness.confidence > 0) && (
          <View style={s.pulseCard}>
            <Text style={s.pulseHeading}>REAL-TIME PULSE</Text>

            {/* Station Busyness */}
            <View style={s.pulseRow}>
              <Text style={s.pulseLabel}>Station Busyness</Text>
              <BusynessMeter level={traffic.busyness.level} isDark={isDark} />
            </View>

            {/* Busyness bar */}
            {traffic.busyness.level != null && (
              <View style={s.pulseBarBg}>
                <View style={[s.pulseBarFill, {
                  width: `${traffic.busyness.level === 'very_busy' ? 90 : traffic.busyness.level === 'busy' ? 65 : traffic.busyness.level === 'moderate' ? 40 : 20}%` as `${number}%`,
                  backgroundColor: traffic.busyness.level === 'very_busy' ? '#b02500' : traffic.busyness.level === 'busy' ? '#d97706' : '#059669',
                }]} />
              </View>
            )}

            {/* Traffic Condition */}
            <View style={s.pulseRow}>
              <Text style={s.pulseLabel}>Traffic Condition</Text>
              <TrafficBadge
                condition={traffic.traffic_condition}
                delayMins={traffic.delay_mins}
                isDark={isDark}
              />
            </View>

            {/* ETA comparison */}
            {traffic.duration_in_traffic_mins != null && traffic.typical_duration_mins != null && (
              <View style={s.etaCompare}>
                <View style={s.etaRow}>
                  <Text style={s.etaLabel}>Typical: {traffic.typical_duration_mins} min</Text>
                  <Text style={s.etaValue}>Now: {traffic.duration_in_traffic_mins} min</Text>
                </View>
                <View style={s.durationBarBg}>
                  <View style={[s.durationBarFill, {
                    backgroundColor: TRAFFIC_CONDITION_COLORS[traffic.traffic_condition || 'light'][isDark ? 'dark' : 'light'],
                    width: `${Math.min(100, (traffic.duration_in_traffic_mins / (traffic.typical_duration_mins * 1.5)) * 100)}%` as `${number}%`,
                  }]} />
                </View>
              </View>
            )}
          </View>
        )}
          </>
        )}

        {/* ── Fare Trend tab ── */}
        {activeTab === 'trend' && (
          <FareTrendChart
            data={trend}
            officialFare={route.official_fare}
            isLoading={trendLoading}
            selectedPeriod={trendDays}
            onPeriodChange={setTrendDays}
            routeName={`${route.from_location} → ${route.to_location}`}
          />
        )}

        {/* ── Reports tab ── */}
        {activeTab === 'reports' && (
          <View style={s.reportsSection}>
            <View style={s.reportsTitleRow}>
              <Text style={s.sectionTitle}>Recent Fare Reports</Text>
              {reportCount > 0 && (
                <TouchableOpacity activeOpacity={0.7}>
                  <Text style={s.viewAllBtn}>View all</Text>
                </TouchableOpacity>
              )}
            </View>
            {recentReports.length > 0 ? (
              recentReports.map((report) => (
                <View key={report.id} style={s.reportCard}>
                  <View style={s.reportAvatar}>
                    <Text style={s.reportAvatarText}>
                      {(report as any).reporter_name?.[0]?.toUpperCase() ?? '?'}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.reporterName}>
                      {(report as any).reporter_name ?? 'Anonymous'}
                    </Text>
                    <Text style={s.reportTime}>{timeAgo(report.reported_at)}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={s.reportFare}>GH₵ {report.reported_fare.toFixed(2)}</Text>
                    {route.official_fare && Math.abs(report.reported_fare - route.official_fare) < 0.5 ? (
                      <View style={s.exactBadge}>
                        <Text style={s.exactBadgeText}>Exact</Text>
                      </View>
                    ) : report.reported_fare > (route.official_fare || 0) ? (
                      <View style={s.overBadge}>
                        <Text style={s.overBadgeText}>
                          + GH₵ {(report.reported_fare - (route.official_fare || 0)).toFixed(2)}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              ))
            ) : (
              <View style={s.emptyCard}>
                <TrendingUp size={32} color="#b2acaa" />
                <Text style={s.emptyTitle}>No recent reports yet</Text>
                <Text style={s.emptySubtitle}>Be the first to report!</Text>
              </View>
            )}

            {/* Report Fare inline CTA */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => {
                haptics.light()
                router.push('/report/fare')
              }}
              style={s.reportCta}
            >
              <Plus size={18} color="#815100" />
              <Text style={s.reportCtaText}>Report a Fare</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Safety Row — always visible */}
        <View style={s.safetyRow}>
          <TripShareButton
            routeId={id}
            from={route.from_location}
            to={route.to_location}
            estimatedMins={route.estimated_duration_mins}
          />
          <SOSButton from={route.from_location} to={route.to_location} />
        </View>
      </ScrollView>

      {/* Safety row doubles as bottom padding */}
    </SafeAreaView>
  )
}

const getStyles = (isDark: boolean) => {
  // Stitch M3 tokens
  const surface = isDark ? '#1c1c1e' : '#fcf5f2'
  const surfaceLowest = isDark ? '#1c1c1e' : '#ffffff'
  const surfaceLow = isDark ? 'rgba(255,255,255,0.04)' : '#f6efed'
  const surfaceHigh = isDark ? 'rgba(255,255,255,0.08)' : '#e8e1de'
  const onSurface = isDark ? '#f5f5f4' : '#312e2d'
  const onSurfaceVariant = isDark ? 'rgba(255,255,255,0.5)' : '#5f5b59'
  const outlineVariant = isDark ? 'rgba(255,255,255,0.1)' : '#b2acaa'

  return StyleSheet.create({
    container: { flex: 1, backgroundColor: surface },

    // ── Hero — tall cinematic ──
    heroSection: {
      height: 340,
      overflow: 'hidden' as const,
    },
    heroContent: {
      flex: 1,
      justifyContent: 'flex-end' as const,
      paddingHorizontal: 24,
      paddingBottom: 28,
      gap: 10,
    },
    heroBadges: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 10,
    },
    routeTypeBadge: {
      backgroundColor: '#815100',
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 20,
    },
    routeTypeBadgeText: {
      color: '#fff',
      fontSize: 10,
      fontFamily: font.bold,
      letterSpacing: 1.5,
    },
    lastUpdatedBadge: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 4,
    },
    lastUpdatedText: {
      fontSize: 11,
      fontFamily: font.medium,
      color: onSurfaceVariant,
    },
    heroRouteTitle: {
      fontSize: 34,
      fontFamily: font.extrabold,
      color: onSurface,
      letterSpacing: -0.5,
    },
    heroFareRow: {
      flexDirection: 'row' as const,
      alignItems: 'flex-end' as const,
      gap: 10,
    },
    heroFareValue: {
      fontSize: 44,
      fontFamily: font.extrabold,
      color: '#f8a010',
      lineHeight: 48,
    },
    heroFareLabel: {
      fontSize: 14,
      fontFamily: font.medium,
      color: onSurfaceVariant,
      paddingBottom: 6,
    },
    heroMeta: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 6,
      marginTop: 4,
    },
    heroMetaText: {
      fontSize: 13,
      fontFamily: font.medium,
      color: onSurfaceVariant,
    },

    // ── Tab pills ──
    tabRow: {
      flexDirection: 'row' as const,
      gap: 8,
      paddingHorizontal: 24,
      marginTop: 20,
      marginBottom: 4,
    },
    tabPillActive: {
      paddingHorizontal: 22,
      paddingVertical: 10,
      borderRadius: 24,
    },
    tabPillActiveText: {
      fontSize: 13,
      fontFamily: font.bold,
      color: '#fff',
    },
    tabPill: {
      paddingHorizontal: 22,
      paddingVertical: 10,
      borderRadius: 24,
      backgroundColor: surfaceHigh,
    },
    tabPillText: {
      fontSize: 13,
      fontFamily: font.medium,
      color: onSurfaceVariant,
    },

    // ── Trust & Verification — overlaps hero ──
    trustSection: {
      paddingHorizontal: 24,
      marginTop: -16,
      gap: 12,
    },
    gprtuCard: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      backgroundColor: surfaceLowest,
      padding: 16,
      borderRadius: 20,
      gap: 12,
      shadowColor: '#312e2d',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0 : 0.06,
      shadowRadius: 12,
      elevation: isDark ? 0 : 3,
    },
    gprtuIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: isDark ? 'rgba(5,150,105,0.15)' : '#ecfdf5',
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    gprtuTitle: {
      fontSize: 14,
      fontFamily: font.bold,
      color: onSurface,
    },
    gprtuSub: {
      fontSize: 11,
      fontFamily: font.regular,
      color: onSurfaceVariant,
      marginTop: 1,
    },

    // Overcharge Warning — Stitch error banner with left border
    overchargeCard: {
      flexDirection: 'row' as const,
      alignItems: 'flex-start' as const,
      gap: 12,
      backgroundColor: isDark ? 'rgba(176,37,0,0.12)' : 'rgba(176,37,0,0.06)',
      borderLeftWidth: 4,
      borderLeftColor: '#b02500',
      padding: 16,
      borderRadius: 16,
    },
    overchargeTitle: {
      fontSize: 14,
      fontFamily: font.bold,
      color: '#b02500',
    },
    overchargeDesc: {
      fontSize: 12,
      fontFamily: font.regular,
      color: onSurfaceVariant,
      marginTop: 4,
      lineHeight: 18,
    },
    overchargeBold: {
      fontFamily: font.bold,
      color: onSurface,
    },

    // ── Real-time Pulse card (Live Traffic + Busyness) ──
    pulseCard: {
      marginHorizontal: 24,
      marginTop: 20,
      padding: 24,
      borderRadius: 28,
      backgroundColor: surfaceLow,
      borderLeftWidth: 4,
      borderLeftColor: '#815100',
      gap: 16,
    },
    pulseHeading: {
      fontSize: 11,
      fontFamily: font.bold,
      color: onSurfaceVariant,
      letterSpacing: 3,
    },
    pulseRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
    },
    pulseLabel: {
      fontSize: 14,
      fontFamily: font.medium,
      color: onSurface,
    },
    pulseBarBg: {
      height: 10,
      borderRadius: 5,
      backgroundColor: surfaceHigh,
      overflow: 'hidden' as const,
    },
    pulseBarFill: {
      height: 10,
      borderRadius: 5,
    },
    etaCompare: {
      gap: 8,
    },
    etaRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
    },
    etaLabel: {
      fontSize: 12,
      fontFamily: font.regular,
      color: onSurfaceVariant,
    },
    etaValue: {
      fontSize: 12,
      fontFamily: font.semibold,
      color: onSurface,
    },
    durationBarBg: {
      height: 8,
      borderRadius: 4,
      backgroundColor: surfaceHigh,
      overflow: 'hidden' as const,
    },
    durationBarFill: {
      height: 8,
      borderRadius: 4,
    },

    // ── Reports section ──
    reportsSection: {
      paddingHorizontal: 24,
      marginTop: 28,
    },
    reportsTitleRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 18,
      fontFamily: font.bold,
      color: onSurface,
    },
    viewAllBtn: {
      fontSize: 13,
      fontFamily: font.bold,
      color: '#815100',
    },
    reportCard: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      backgroundColor: surfaceLowest,
      padding: 16,
      borderRadius: 20,
      marginBottom: 10,
      gap: 12,
      shadowColor: '#312e2d',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0 : 0.04,
      shadowRadius: 8,
      elevation: isDark ? 0 : 2,
    },
    reportAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: surfaceHigh,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    reportAvatarText: {
      fontSize: 16,
      fontFamily: font.bold,
      color: onSurfaceVariant,
    },
    reporterName: {
      fontSize: 14,
      fontFamily: font.bold,
      color: onSurface,
    },
    reportTime: {
      fontSize: 10,
      fontFamily: font.medium,
      color: onSurfaceVariant,
      marginTop: 2,
    },
    reportFare: {
      fontSize: 15,
      fontFamily: font.extrabold,
      color: onSurface,
    },
    exactBadge: {
      backgroundColor: isDark ? 'rgba(5,150,105,0.15)' : '#ecfdf5',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
      marginTop: 4,
    },
    exactBadgeText: {
      fontSize: 10,
      fontFamily: font.bold,
      color: '#059669',
    },
    overBadge: {
      backgroundColor: isDark ? 'rgba(217,119,6,0.15)' : '#fffbeb',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
      marginTop: 4,
    },
    overBadgeText: {
      fontSize: 10,
      fontFamily: font.bold,
      color: '#d97706',
    },

    // Report CTA — dashed outline
    reportCta: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      gap: 8,
      marginTop: 16,
      paddingVertical: 14,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: outlineVariant,
      borderStyle: 'dashed' as const,
    },
    reportCtaText: {
      fontSize: 14,
      fontFamily: font.semibold,
      color: '#815100',
    },

    // Safety row
    safetyRow: {
      flexDirection: 'row' as const,
      gap: 12,
      marginHorizontal: 24,
      marginTop: 20,
      marginBottom: 24,
    },

    // ── Bottom bar — fixed START TRIP ──
    bottomBar: {
      paddingHorizontal: 24,
      paddingVertical: 12,
      backgroundColor: surfaceLowest,
      borderTopWidth: 1,
      borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    },
    startTripBtn: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      gap: 10,
      height: 60,
      borderRadius: 20,
      shadowColor: '#815100',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.3,
      shadowRadius: 16,
      elevation: 8,
    },
    startTripText: {
      color: '#fff',
      fontSize: 17,
      fontFamily: font.extrabold,
      letterSpacing: 3,
    },

    // Empty state
    emptyCard: {
      padding: 24,
      borderRadius: 20,
      alignItems: 'center' as const,
      backgroundColor: surfaceLow,
    },
    emptyTitle: {
      marginTop: 12,
      fontFamily: font.medium,
      color: onSurfaceVariant,
    },
    emptySubtitle: {
      fontSize: 14,
      marginTop: 4,
      color: outlineVariant,
    },
  })
}
