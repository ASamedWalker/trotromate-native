import { useCallback, useMemo, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  useColorScheme,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { Image } from 'expo-image'
import {
  TrainFront,
  Clock,
  Users,
  Timer,
  Plus,
  ChevronLeft,
  ShieldCheck,
  ChevronDown,
  Sunrise,
  Sunset,
  Calendar,
  MessageSquare,
  Zap,
} from 'lucide-react-native'
import { font } from '@/lib/theme'
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated'
import { GRDABadge } from '@/components/GRDABadge'
import { useTrainLineDetail } from '@/lib/hooks/useTrain'
import { timeAgo } from '@/lib/utils/time'
import { TRAIN_SCHEDULES } from '@/lib/constants/train-schedule'
import type { TrainReportWithNames, CrowdLevel } from '@/lib/types'

// ─── Constants ──────────────────────────────────────────

const CROWD_LABELS: Record<CrowdLevel, string> = {
  empty: 'Empty',
  few_seats: 'Few Seats',
  standing: 'Standing',
  packed: 'Packed',
}

const CROWD_EMOJI: Record<CrowdLevel, string> = {
  empty: '💺',
  few_seats: '🪑',
  standing: '🧍',
  packed: '😰',
}

const REPORT_CONFIG: Record<string, { Icon: typeof Clock; label: string; color: string }> = {
  schedule: { Icon: Clock, label: 'Train Spotted', color: '#0ea5e9' },
  crowd: { Icon: Users, label: 'Crowd Report', color: '#8b5cf6' },
  delay: { Icon: Timer, label: 'Delay Report', color: '#ef4444' },
}

const HERO_IMAGES: Record<string, string> = {
  TMA: 'https://images.unsplash.com/photo-1474487548417-781cb71495f3?w=800&q=80',
  TMP: 'https://images.unsplash.com/photo-1532105956626-9569c03602f6?w=800&q=80',
  STK: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&q=80',
}
const FALLBACK_HERO = 'https://images.unsplash.com/photo-1474487548417-781cb71495f3?w=800&q=80'

const LINE_META: Record<string, { heroTitle: string; heroDesc: string }> = {
  TMA: {
    heroTitle: 'Tema – Accra',
    heroDesc: 'Suburban commuter rail connecting Tema and Accra Central with scheduled stops along the coastal corridor.',
  },
  TMP: {
    heroTitle: 'Tema – Mpakadan',
    heroDesc: 'Inter-regional service through the Eastern Corridor connecting Tema Port to Mpakadan via Koforidua.',
  },
  STK: {
    heroTitle: 'Sekondi – Takoradi',
    heroDesc: 'Western Line commuter shuttle via Kojokrom. Connecting Sekondi and Takoradi harbour along the coastal rail corridor.',
  },
}

const DEFAULT_LINE_META = {
  heroTitle: 'Rail Service',
  heroDesc: 'Official GRDA rail service. View schedules, stations, and live passenger reports.',
}

// ─── Component ──────────────────────────────────────────

export default function LineDetailScreen() {
  const router = useRouter()
  const { lineId } = useLocalSearchParams<{ lineId: string }>()
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const s = useMemo(() => getStyles(isDark), [isDark])

  const { line, stations, recentReports, isLoading, refetch } = useTrainLineDetail(lineId!)
  const [expandedSchedule, setExpandedSchedule] = useState<string | null>(null)

  const meta = LINE_META[line?.code ?? ''] ?? DEFAULT_LINE_META
  const heroImage = HERO_IMAGES[line?.code ?? ''] ?? FALLBACK_HERO

  // Timeline stops — driven by the schedule itself so the timeline, the times,
  // and the official timetable below all agree. The train_stations table and
  // TRAIN_SCHEDULES disagree on station set + order, so using the schedule as
  // the single source of truth is what keeps the times correct (no more
  // "Expected —"). Falls back to the DB stations only when no schedule exists.
  const timelineStops = useMemo(() => {
    const sched = line?.code ? TRAIN_SCHEDULES[line.code]?.[0] : null
    if (sched) {
      return sched.stops.map((stop, i) => ({
        key: `${stop.station}-${i}`,
        name: stop.station,
        displayTime: stop.depart || stop.arrive || null,
      }))
    }
    return stations.map((st) => ({
      key: st.id,
      name: st.name,
      displayTime: null as string | null,
    }))
  }, [line?.code, stations])

  // Live stats from reports
  const liveStats = useMemo(() => {
    if (!recentReports.length) return null
    const delayReports = recentReports.filter((r) => r.report_type === 'delay' && r.delay_mins)
    const avgDelay =
      delayReports.length > 0
        ? Math.round(delayReports.reduce((sum, r) => sum + (r.delay_mins || 0), 0) / delayReports.length)
        : null
    const latestCrowd = recentReports.find((r) => r.report_type === 'crowd' && r.crowd_level)
    return { avgDelay, latestCrowd, totalReports: recentReports.length }
  }, [recentReports])

  // ─── Station renderer (Stitch tube-line style) ─────────

  const renderStation = useCallback(
    (stop: { key: string; name: string; displayTime: string | null }, index: number) => {
      const isFirst = index === 0
      const isLast = index === timelineStops.length - 1
      const displayTime = stop.displayTime

      // Status badge logic
      let statusLabel = 'On Time'
      let statusBg = isDark ? 'rgba(34,197,94,0.15)' : '#dcfce7'
      let statusColor = isDark ? '#4ade80' : '#15803d'

      // If there's delay data, show it on relevant stations
      if (liveStats?.avgDelay && index > 0 && index < timelineStops.length - 1) {
        statusLabel = `~${liveStats.avgDelay}m Delay`
        statusBg = isDark ? 'rgba(245,158,11,0.15)' : '#fef3c7'
        statusColor = isDark ? '#fbbf24' : '#92400e'
      }

      return (
        <View key={stop.key} style={s.stationItem}>
          {/* Dot on the tube line */}
          <View style={s.stationDotWrap}>
            <View style={[
              s.stationDot,
              { borderColor: '#06b6d4' },
            ]}>
              {(isFirst || isLast) && <View style={s.stationDotInner} />}
            </View>
          </View>

          {/* Station content */}
          <View style={s.stationContent}>
            <View style={{ flex: 1 }}>
              <Text style={s.stationName}>{stop.name}</Text>
              <Text style={s.stationSub}>
                {isFirst ? `Platform 1 • Departs ${displayTime || '—'}` :
                 isLast ? `Terminating • Arrives ${displayTime || '—'}` :
                 `Arrives ${displayTime || '—'}`}
              </Text>
            </View>
            <View style={[s.statusBadge, { backgroundColor: statusBg }]}>
              <Text style={[s.statusBadgeText, { color: statusColor }]}>{statusLabel}</Text>
            </View>
          </View>
        </View>
      )
    },
    [timelineStops, liveStats, isDark, s]
  )

  // ─── Feedback card renderer ────────────────────────────

  const renderFeedback = useCallback(
    (report: TrainReportWithNames, index: number) => {
      const config = REPORT_CONFIG[report.report_type] || REPORT_CONFIG.schedule

      // Build a natural-language feedback string
      let feedbackText = ''
      if (report.report_type === 'crowd' && report.crowd_level) {
        const label = CROWD_LABELS[report.crowd_level as CrowdLevel] || report.crowd_level
        const emoji = CROWD_EMOJI[report.crowd_level as CrowdLevel] || ''
        feedbackText = `${emoji} Train is ${label.toLowerCase()} at ${report.station_name || 'this station'}.`
      } else if (report.report_type === 'delay' && report.delay_mins) {
        feedbackText = `Train running ~${report.delay_mins} minutes late at ${report.station_name || 'this station'}.`
      } else if (report.report_type === 'schedule') {
        const schedules = line?.code ? TRAIN_SCHEDULES[line.code] : null
        const inboundDest = schedules?.[0]?.stops[schedules[0].stops.length - 1]?.station || 'terminal'
        const outboundDest = schedules?.[1]?.stops[schedules[1].stops.length - 1]?.station || 'terminal'
        const dir = report.direction === 'inbound' ? `heading to ${inboundDest}` : `heading to ${outboundDest}`
        feedbackText = `Train spotted at ${report.station_name || 'station'}, ${dir}.`
      } else {
        feedbackText = `Report from ${report.station_name || 'station'}.`
      }

      // Generate avatar colors based on index
      const avatarColors = ['#06b6d4', '#8b5cf6', '#f59e0b', '#22c55e', '#ef4444']
      const avatarBg = avatarColors[index % avatarColors.length]
      const initials = `P${index + 1}`

      return (
        <View key={report.id} style={s.feedbackCard}>
          {/* Avatar */}
          <View style={[s.feedbackAvatar, { backgroundColor: `${avatarBg}20` }]}>
            <Text style={[s.feedbackAvatarText, { color: avatarBg }]}>{initials}</Text>
          </View>

          {/* Content */}
          <View style={{ flex: 1 }}>
            <View style={s.feedbackMeta}>
              <Text style={s.feedbackName}>Passenger</Text>
              <View style={[s.feedbackTypeDot, { backgroundColor: config.color }]} />
              <Text style={s.feedbackTime}>{timeAgo(report.reported_at)}</Text>
            </View>
            <Text style={s.feedbackText}>"{feedbackText}"</Text>
          </View>
        </View>
      )
    },
    [s]
  )

  // ─── Loading / empty states ────────────────────────────

  if (isLoading) {
    return (
      <SafeAreaView style={s.container} edges={['top', 'bottom']}>
        <View style={s.centered}>
          <ActivityIndicator size="large" color="#0891b2" />
        </View>
      </SafeAreaView>
    )
  }

  if (!line) {
    return (
      <SafeAreaView style={s.container} edges={['top', 'bottom']}>
        <View style={s.centered}>
          <TrainFront size={48} color={isDark ? '#57534e' : '#a8a29e'} />
          <Text style={s.emptyTitle}>Line not found</Text>
        </View>
      </SafeAreaView>
    )
  }

  // ─── Main render ───────────────────────────────────────

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      {/* GRDA Header Bar */}
      <LinearGradient
        colors={['#0891b2', '#1e40af']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={s.headerBar}
      >
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={s.headerBack}>
          <ChevronLeft size={20} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>{line.code} - {meta.heroTitle}</Text>
          <Text style={s.headerSub}>GRDA OFFICIAL SERVICE</Text>
        </View>
        <View style={s.headerShield}>
          <ShieldCheck size={16} color="#fff" />
        </View>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={refetch} tintColor="#0891b2" colors={['#0891b2']} />
        }
      >
        {/* ─── Hero Section ─────────────────────────────── */}
        <Animated.View entering={FadeIn.duration(500)} style={s.heroCard}>
          <View style={s.heroContent}>
            {/* Live badge */}
            <View style={s.heroBadge}>
              <View style={s.heroBadgeDot} />
              <Text style={s.heroBadgeText}>LIVE SERVICE</Text>
            </View>

            <Text style={s.heroTitle}>{line.name}</Text>
            <Text style={s.heroDesc}>{meta.heroDesc}</Text>
          </View>

          {/* Train image */}
          <View style={s.heroImageWrap}>
            <Image
              source={{ uri: heroImage }}
              style={s.heroImage}
              contentFit="cover"
              cachePolicy="disk"
              placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
              transition={300}
            />
          </View>
        </Animated.View>

        {/* ─── Station Timeline ─────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={s.sectionWrap}>
          <View style={s.timelineCard}>
            <View style={s.timelineHeader}>
              <TrainFront size={18} color="#0891b2" />
              <Text style={s.timelineTitle}>Station Timeline</Text>
            </View>

            <View style={s.timelineBody}>
              {/* Tube gradient line */}
              <LinearGradient
                colors={['#22d3ee', '#0369a1']}
                style={s.tubeLine}
              />

              {/* Station list */}
              <View style={s.stationList}>
                {timelineStops.map(renderStation)}
              </View>
            </View>

            {/* Fare summary strip */}
            {line.official_fare && (
              <View style={s.fareStrip}>
                <GRDABadge size="small" />
                <Text style={s.farePrice}>GHS {line.official_fare.toFixed(2)}</Text>
                <View style={{ flex: 1 }} />
                <Text style={s.fareStations}>{timelineStops.length} stations</Text>
              </View>
            )}
          </View>
        </Animated.View>

        {/* ─── Official Timetable ───────────────────────── */}
        {line.code && TRAIN_SCHEDULES[line.code] && (
          <View style={s.sectionWrap}>
            {TRAIN_SCHEDULES[line.code].map((sched) => {
              const DirIcon = sched.direction === 'inbound' ? Sunrise : Sunset
              const dirColor = sched.direction === 'inbound' ? '#f59e0b' : '#8b5cf6'
              const isOpen = expandedSchedule === sched.id

              return (
                <View key={sched.id} style={s.schedCard}>
                  <TouchableOpacity
                    onPress={() => setExpandedSchedule(isOpen ? null : sched.id)}
                    activeOpacity={0.7}
                    style={s.schedHeader}
                  >
                    <View style={s.schedHeaderLeft}>
                      <Clock size={18} color="#815100" />
                      <Text style={s.schedHeaderTitle}>Official Timetable</Text>
                    </View>
                    <View style={s.schedHeaderRight}>
                      <View style={[s.schedDirPill, { backgroundColor: `${dirColor}15` }]}>
                        <DirIcon size={12} color={dirColor} />
                        <Text style={[s.schedDirText, { color: dirColor }]}>{sched.label}</Text>
                      </View>
                      <ChevronDown
                        size={18}
                        color={isDark ? 'rgba(255,255,255,0.3)' : '#9ca3af'}
                        style={{ transform: [{ rotate: isOpen ? '180deg' : '0deg' }] }}
                      />
                    </View>
                  </TouchableOpacity>

                  {isOpen && (
                    <View style={s.schedBody}>
                      {sched.stops.map((stop, idx) => {
                        const isStopFirst = idx === 0
                        const isStopLast = idx === sched.stops.length - 1
                        const isTerminal = isStopFirst || isStopLast
                        return (
                          <View
                            key={stop.station}
                            style={[s.schedRow, isStopLast && { borderBottomWidth: 0 }]}
                          >
                            <Text style={[s.schedStation, isTerminal && s.schedStationBold]}>
                              {stop.station}
                            </Text>
                            <Text style={s.schedTime}>
                              {stop.arrive || '—'} – {stop.depart || '—'}
                            </Text>
                          </View>
                        )
                      })}
                      <View style={s.schedFareRow}>
                        <Calendar size={12} color={isDark ? '#a8a29e' : '#78716c'} />
                        <Text style={s.schedDays}>{sched.days}</Text>
                        <View style={{ flex: 1 }} />
                        <Text style={s.schedFare}>₵{sched.fare.toFixed(2)}</Text>
                      </View>
                    </View>
                  )}
                </View>
              )
            })}
          </View>
        )}

        {/* ─── Passenger Feedback ───────────────────────── */}
        <View style={s.sectionWrap}>
          <View style={s.feedbackHeader}>
            <MessageSquare size={18} color="#795500" />
            <Text style={s.feedbackSectionTitle}>Passenger Feedback</Text>
          </View>

          {recentReports.length === 0 ? (
            <View style={s.emptyCard}>
              <TrainFront size={32} color={isDark ? '#57534e' : '#a8a29e'} />
              <Text style={s.emptyCardTitle}>No reports yet</Text>
              <Text style={s.emptyCardText}>
                Be the first to share schedule, crowding, or delay info
              </Text>
              <TouchableOpacity
                onPress={() =>
                  router.push({ pathname: '/report/train', params: { lineId: line.id } })
                }
                activeOpacity={0.8}
                style={s.emptyBtn}
              >
                <Plus size={16} color="#fff" />
                <Text style={s.emptyBtnText}>Add Report</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={{ gap: 12 }}>
                {recentReports.slice(0, 8).map(renderFeedback)}
              </View>

              {/* Share Live Update button */}
              <TouchableOpacity
                onPress={() =>
                  router.push({ pathname: '/report/train', params: { lineId: line.id } })
                }
                activeOpacity={0.7}
                style={s.shareLiveBtn}
              >
                <Plus size={16} color="#0891b2" />
                <Text style={s.shareLiveBtnText}>Share Live Update</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ─── ACTIVATE GO MODE — DISABLED (uncomment to restore) ───
      {line?.code !== 'STK' && (
        <View style={s.goModeWrap}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => router.push({
              pathname: '/trip/[routeId]',
              params: { routeId: lineId!, type: 'train', lineId: lineId! },
            } as any)}
            style={s.goModeBtn}
          >
            <Text style={s.goModeBtnText}>ACTIVATE GO MODE</Text>
            <Zap size={20} color="#0c4a6e" />
          </TouchableOpacity>
        </View>
      )}
      */}
    </SafeAreaView>
  )
}

// ─── Styles ─────────────────────────────────────────────

const getStyles = (isDark: boolean) => {
  const surface = isDark ? '#1c1c1e' : '#fcf5f2'
  const surfaceLowest = isDark ? '#1c1c1e' : '#ffffff'
  const surfaceLow = isDark ? 'rgba(255,255,255,0.04)' : '#f6efed'
  const surfaceHigh = isDark ? 'rgba(255,255,255,0.08)' : '#e3dbd8'
  const onSurface = isDark ? '#f5f5f4' : '#312e2d'
  const onSurfaceVariant = isDark ? 'rgba(255,255,255,0.5)' : '#5f5b59'
  const outlineVariant = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(178,172,170,0.2)'

  return StyleSheet.create({
    container: { flex: 1, backgroundColor: surface },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
    emptyTitle: { fontSize: 18, fontFamily: font.semibold, color: onSurfaceVariant, marginTop: 12 },

    // ── Header Bar ──
    headerBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 14,
      gap: 10,
    },
    headerBack: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(255,255,255,0.15)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 15,
      fontFamily: font.extrabold,
      color: '#fff',
      letterSpacing: -0.3,
      textTransform: 'uppercase',
    },
    headerSub: {
      fontSize: 10,
      fontFamily: font.semibold,
      color: 'rgba(255,255,255,0.5)',
      letterSpacing: 1.5,
      marginTop: 1,
    },
    headerShield: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(255,255,255,0.15)',
      alignItems: 'center',
      justifyContent: 'center',
    },

    // ── Hero Card ──
    heroCard: {
      marginHorizontal: 16,
      marginTop: 20,
      marginBottom: 8,
      backgroundColor: surfaceHigh,
      borderRadius: 24,
      padding: 24,
      flexDirection: 'row',
      gap: 16,
      alignItems: 'center',
      overflow: 'hidden',
    },
    heroContent: {
      flex: 1,
    },
    heroBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 20,
      backgroundColor: isDark ? 'rgba(34,211,238,0.12)' : '#ecfeff',
      marginBottom: 12,
    },
    heroBadgeDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: '#06b6d4',
    },
    heroBadgeText: {
      fontSize: 10,
      fontFamily: font.bold,
      color: isDark ? '#22d3ee' : '#0e7490',
      letterSpacing: 1.2,
    },
    heroTitle: {
      fontSize: 28,
      fontFamily: font.extrabold,
      color: onSurface,
      letterSpacing: -0.5,
      marginBottom: 6,
    },
    heroDesc: {
      fontSize: 13,
      fontFamily: font.regular,
      color: onSurfaceVariant,
      lineHeight: 19,
    },
    heroImageWrap: {
      width: 120,
      height: 140,
      borderRadius: 16,
      overflow: 'hidden',
      backgroundColor: isDark ? '#2a2a2c' : '#e2e8f0',
    },
    heroImage: {
      width: '100%',
      height: '100%',
    },

    // ── Section Wrap ──
    sectionWrap: {
      paddingHorizontal: 16,
      marginTop: 20,
    },

    // ── Station Timeline ──
    timelineCard: {
      backgroundColor: surfaceLow,
      borderRadius: 24,
      overflow: 'hidden',
    },
    timelineHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 24,
      paddingTop: 24,
      paddingBottom: 8,
    },
    timelineTitle: {
      fontSize: 18,
      fontFamily: font.bold,
      color: onSurface,
    },
    timelineBody: {
      position: 'relative',
      paddingLeft: 24,
      paddingBottom: 12,
    },
    tubeLine: {
      position: 'absolute',
      left: 35,
      top: 20,
      bottom: 20,
      width: 6,
      borderRadius: 3,
    },
    stationList: {
      gap: 0,
    },
    stationItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingVertical: 18,
    },
    stationDotWrap: {
      width: 28,
      alignItems: 'center',
      paddingTop: 2,
    },
    stationDot: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: isDark ? '#1c1c1e' : '#ffffff',
      borderWidth: 4,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2,
    },
    stationDotInner: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: '#06b6d4',
    },
    stationContent: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginLeft: 16,
      paddingRight: 24,
    },
    stationName: {
      fontSize: 17,
      fontFamily: font.bold,
      color: onSurface,
      lineHeight: 20,
    },
    stationSub: {
      fontSize: 12,
      fontFamily: font.medium,
      color: onSurfaceVariant,
      marginTop: 3,
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      marginLeft: 8,
      marginTop: 1,
    },
    statusBadgeText: {
      fontSize: 10,
      fontFamily: font.bold,
      letterSpacing: -0.3,
      textTransform: 'uppercase',
    },

    // ── Fare Strip ──
    fareStrip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 24,
      paddingVertical: 14,
      borderTopWidth: 1,
      borderTopColor: outlineVariant,
    },
    farePrice: {
      fontFamily: font.bold,
      fontSize: 15,
      color: onSurface,
    },
    fareStations: {
      fontFamily: font.medium,
      fontSize: 12,
      color: onSurfaceVariant,
    },

    // ── Schedule Accordion ──
    schedCard: {
      backgroundColor: surfaceHigh,
      borderRadius: 24,
      overflow: 'hidden',
      marginBottom: 12,
    },
    schedHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 20,
    },
    schedHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    schedHeaderTitle: {
      fontSize: 17,
      fontFamily: font.bold,
      color: onSurface,
    },
    schedHeaderRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    schedDirPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    schedDirText: {
      fontSize: 11,
      fontFamily: font.semibold,
    },
    schedBody: {
      paddingHorizontal: 20,
      paddingBottom: 16,
    },
    schedRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: outlineVariant,
    },
    schedStation: {
      fontSize: 14,
      fontFamily: font.regular,
      color: onSurfaceVariant,
    },
    schedStationBold: {
      fontFamily: font.bold,
      color: onSurface,
    },
    schedTime: {
      fontSize: 14,
      fontFamily: font.semibold,
      color: onSurface,
    },
    schedFareRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingTop: 14,
    },
    schedDays: {
      fontSize: 12,
      fontFamily: font.medium,
      color: onSurfaceVariant,
    },
    schedFare: {
      fontSize: 14,
      fontFamily: font.bold,
      color: '#815100',
    },

    // ── Passenger Feedback ──
    feedbackHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 16,
      paddingHorizontal: 4,
    },
    feedbackSectionTitle: {
      fontSize: 18,
      fontFamily: font.bold,
      color: onSurface,
    },
    feedbackCard: {
      flexDirection: 'row',
      backgroundColor: surfaceLowest,
      borderRadius: 16,
      padding: 16,
      gap: 14,
      borderWidth: 1,
      borderColor: outlineVariant,
    },
    feedbackAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    feedbackAvatarText: {
      fontSize: 14,
      fontFamily: font.bold,
    },
    feedbackMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 4,
    },
    feedbackName: {
      fontSize: 13,
      fontFamily: font.bold,
      color: onSurface,
    },
    feedbackTypeDot: {
      width: 4,
      height: 4,
      borderRadius: 2,
    },
    feedbackTime: {
      fontSize: 10,
      fontFamily: font.medium,
      color: onSurfaceVariant,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    feedbackText: {
      fontSize: 14,
      fontFamily: font.regular,
      color: onSurface,
      lineHeight: 20,
      fontStyle: 'italic',
    },
    shareLiveBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      marginTop: 12,
      borderRadius: 16,
      backgroundColor: isDark ? 'rgba(8,145,178,0.1)' : '#ecfeff',
    },
    shareLiveBtnText: {
      fontSize: 14,
      fontFamily: font.bold,
      color: '#0891b2',
    },

    // ── Empty State ──
    emptyCard: {
      padding: 32,
      borderRadius: 20,
      backgroundColor: surfaceLowest,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: outlineVariant,
    },
    emptyCardTitle: { fontSize: 16, fontFamily: font.semibold, color: onSurface, marginTop: 12 },
    emptyCardText: {
      fontSize: 13,
      fontFamily: font.regular,
      color: onSurfaceVariant,
      marginTop: 4,
      textAlign: 'center',
      lineHeight: 18,
    },
    emptyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 12,
      marginTop: 16,
      gap: 6,
      backgroundColor: '#0891b2',
    },
    emptyBtnText: { color: '#fff', fontFamily: font.semibold, fontSize: 14 },

    // ── GO Mode ──
    goModeWrap: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      paddingHorizontal: 24,
      paddingBottom: 34,
      paddingTop: 16,
      backgroundColor: isDark ? 'rgba(28,28,30,0.95)' : 'rgba(252,245,242,0.95)',
    },
    goModeBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      height: 60,
      borderRadius: 16,
      backgroundColor: '#22d3ee',
      shadowColor: '#06b6d4',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 16,
      elevation: 8,
    },
    goModeBtnText: {
      fontSize: 18,
      fontFamily: font.extrabold,
      color: '#0c4a6e',
      letterSpacing: -0.5,
      textTransform: 'uppercase',
    },
  })
}
