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
import {
  TrainFront,
  Clock,
  Users,
  Timer,
  Plus,
  ChevronLeft,
  ShieldCheck,
  Navigation,
  ChevronDown,
  Sunrise,
  Sunset,
  Calendar,
  MessageSquare,
} from 'lucide-react-native'
import { font } from '@/lib/theme'
import { GRDABadge } from '@/components/GRDABadge'
import { useTrainLineDetail } from '@/lib/hooks/useTrain'
import { timeAgo } from '@/lib/utils/time'
import { TRAIN_SCHEDULES } from '@/lib/constants/train-schedule'
import type { TrainReportWithNames, CrowdLevel, TrainStation } from '@/lib/types'

// ─── Crowd constants ────────────────────────────────────

const CROWD_COLORS: Record<CrowdLevel, string> = {
  empty: '#22c55e',
  few_seats: '#eab308',
  standing: '#f97316',
  packed: '#ef4444',
}

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

// ─── Line metadata ──────────────────────────────────────

const LINE_META: Record<string, { subtitle: string; heroDesc: string }> = {
  TMA: {
    subtitle: 'Suburban Commuter',
    heroDesc: 'Suburban commuter rail connecting Accra and Tema via coastal stations. Operated by Ghana Railway Development Authority.',
  },
  TMP: {
    subtitle: 'Inter-Regional',
    heroDesc: 'Inter-regional service connecting Tema and Mpakadan through the Eastern Corridor. Operated by Ghana Railway Development Authority.',
  },
}

const DEFAULT_LINE_META = {
  subtitle: 'Rail Service',
  heroDesc: 'Official GRDA rail service. View live schedules, station information, and community reports.',
}

// ─── Component ──────────────────────────────────────────

export default function LineDetailScreen() {
  const router = useRouter()
  const { lineId } = useLocalSearchParams<{ lineId: string }>()
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const s = getStyles(isDark)

  const { line, stations, recentReports, isLoading, refetch } = useTrainLineDetail(lineId!)
  const [expandedStation, setExpandedStation] = useState<string | null>(null)
  const [expandedSchedule, setExpandedSchedule] = useState<string | null>(null)

  const lineColor = line?.color || '#0ea5e9'
  const meta = LINE_META[line?.code ?? ''] ?? DEFAULT_LINE_META

  // Build station → schedule times map
  const stationTimesMap = useMemo(() => {
    if (!line?.code || !TRAIN_SCHEDULES[line.code]) return {}
    const map: Record<string, { arrive: string | null; depart: string | null }> = {}
    const sched = TRAIN_SCHEDULES[line.code][0]
    if (sched) {
      for (const stop of sched.stops) {
        map[stop.station] = { arrive: stop.arrive, depart: stop.depart }
      }
    }
    return map
  }, [line?.code])

  // Live stats from recent reports
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

  // Crowd level per station
  const stationCrowdMap = useMemo(() => {
    const map: Record<string, TrainReportWithNames> = {}
    for (const r of recentReports) {
      if (r.report_type === 'crowd' && r.crowd_level && !map[r.station_id]) {
        map[r.station_id] = r
      }
    }
    return map
  }, [recentReports])

  // Reports grouped by station
  const stationReportsMap = useMemo(() => {
    const map: Record<string, TrainReportWithNames[]> = {}
    for (const r of recentReports) {
      if (!map[r.station_id]) map[r.station_id] = []
      map[r.station_id].push(r)
    }
    return map
  }, [recentReports])

  // ─── Station renderer ──────────────────────────────────

  const renderStation = useCallback(
    (station: TrainStation, index: number) => {
      const isFirst = index === 0
      const isLast = index === stations.length - 1
      const isTerminal = isFirst || isLast
      const crowdReport = stationCrowdMap[station.id]
      const crowdColor = crowdReport
        ? CROWD_COLORS[crowdReport.crowd_level as CrowdLevel]
        : undefined
      const isExpanded = expandedStation === station.id
      const stationReports = stationReportsMap[station.id] || []
      const times = stationTimesMap[station.name]
      const displayTime = times?.depart || times?.arrive

      // Gradient progress: 0 at top, 1 at bottom
      const progress = stations.length > 1 ? index / (stations.length - 1) : 0
      const segColor = interpolateColor('#06b6d4', '#1d4ed8', progress)

      return (
        <View key={station.id}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setExpandedStation(isExpanded ? null : station.id)}
            style={s.stationRow}
          >
            {/* Tube-line connector */}
            <View style={s.connector}>
              {!isFirst && (
                <View style={[s.lineSegTop, { backgroundColor: segColor }]} />
              )}
              {isTerminal ? (
                <View style={[s.terminalDot, { backgroundColor: segColor }]}>
                  <TrainFront size={11} color="#fff" />
                </View>
              ) : (
                <View style={[s.stationDot, { borderColor: segColor, backgroundColor: crowdColor ? `${crowdColor}15` : isDark ? '#1c1c1e' : '#fff' }]}>
                  {crowdColor ? (
                    <View style={[s.crowdDotInner, { backgroundColor: crowdColor }]} />
                  ) : null}
                </View>
              )}
              {!isLast && (
                <View style={[s.lineSegBottom, { backgroundColor: segColor }]} />
              )}
            </View>

            {/* Station info */}
            <View style={s.stationInfo}>
              <View style={{ flex: 1 }}>
                <Text style={[s.stationName, isTerminal && s.stationNameTerminal]}>
                  {station.name}
                </Text>
                {isFirst && <Text style={s.stationHint}>Origin</Text>}
                {isLast && <Text style={s.stationHint}>Terminus</Text>}
              </View>
              {crowdColor && crowdReport && (
                <View style={[s.crowdChip, { backgroundColor: `${crowdColor}18` }]}>
                  <View style={[s.crowdChipDot, { backgroundColor: crowdColor }]} />
                  <Text style={[s.crowdChipText, { color: crowdColor }]}>
                    {CROWD_LABELS[crowdReport.crowd_level as CrowdLevel]}
                  </Text>
                </View>
              )}
              {displayTime && (
                <Text style={s.stationTime}>{displayTime}</Text>
              )}
              <ChevronDown
                size={14}
                color={isDark ? 'rgba(255,255,255,0.3)' : '#9ca3af'}
                style={{ transform: [{ rotate: isExpanded ? '180deg' : '0deg' }] }}
              />
            </View>
          </TouchableOpacity>

          {/* Expanded reports */}
          {isExpanded && (
            <View style={s.expandedSection}>
              {stationReports.length > 0 ? (
                stationReports.slice(0, 5).map((report) => {
                  const config = REPORT_CONFIG[report.report_type] || REPORT_CONFIG.schedule
                  let detail = ''
                  if (report.report_type === 'crowd' && report.crowd_level) {
                    detail = `${CROWD_EMOJI[report.crowd_level as CrowdLevel] || ''} ${CROWD_LABELS[report.crowd_level as CrowdLevel] || report.crowd_level}`
                  } else if (report.report_type === 'delay' && report.delay_mins) {
                    detail = `${report.delay_mins} min late`
                  } else if (report.report_type === 'schedule' && report.direction) {
                    detail = report.direction === 'inbound' ? '→ Accra' : '→ Tema'
                  }
                  return (
                    <View key={report.id} style={s.expandedReport}>
                      <View style={[s.expandedReportDot, { backgroundColor: config.color }]} />
                      <Text style={s.expandedReportLabel}>{config.label}</Text>
                      {detail ? (
                        <Text style={[s.expandedReportDetail, { color: config.color }]}>{detail}</Text>
                      ) : null}
                      <Text style={s.expandedReportTime}>{timeAgo(report.reported_at)}</Text>
                    </View>
                  )
                })
              ) : (
                <Text style={s.expandedEmpty}>No reports for this station yet</Text>
              )}
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: '/report/train',
                    params: { lineId: line!.id, stationId: station.id },
                  })
                }
                activeOpacity={0.8}
                style={s.expandedAddBtn}
              >
                <Plus size={12} color="#0891b2" />
                <Text style={s.expandedAddText}>Add Report</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )
    },
    [stations, stationCrowdMap, stationReportsMap, stationTimesMap, expandedStation, isDark, s, line, router]
  )

  // ─── Report card renderer ─────────────────────────────

  const renderReport = useCallback(
    (report: TrainReportWithNames) => {
      const config = REPORT_CONFIG[report.report_type] || REPORT_CONFIG.schedule
      const Icon = config.Icon

      let detail = ''
      if (report.report_type === 'crowd' && report.crowd_level) {
        detail = `${CROWD_EMOJI[report.crowd_level as CrowdLevel] || ''} ${CROWD_LABELS[report.crowd_level as CrowdLevel] || report.crowd_level}`
      } else if (report.report_type === 'delay' && report.delay_mins) {
        detail = `${report.delay_mins} min late`
      } else if (report.report_type === 'schedule' && report.direction) {
        detail = report.direction === 'inbound' ? '→ Accra' : '→ Tema'
      }

      return (
        <View key={report.id} style={s.reportCard}>
          <View style={[s.reportAccent, { backgroundColor: config.color }]} />
          <View style={s.reportBody}>
            <View style={[s.reportIconBox, { backgroundColor: `${config.color}15` }]}>
              <Icon size={16} color={config.color} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={s.reportTitle}>{config.label}</Text>
                {detail ? (
                  <View style={[s.reportPill, { backgroundColor: `${config.color}15` }]}>
                    <Text style={[s.reportPillText, { color: config.color }]}>{detail}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={s.reportStation}>{report.station_name || 'Station'}</Text>
            </View>
            <Text style={s.reportTime}>{timeAgo(report.reported_at)}</Text>
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
          <Text style={s.headerTitle}>{line.name}</Text>
          <Text style={s.headerSub}>GRDA Official Service</Text>
        </View>
        <View style={s.headerShield}>
          <ShieldCheck size={16} color="#fff" />
        </View>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={refetch}
            tintColor="#0891b2"
            colors={['#0891b2']}
          />
        }
      >
        {/* ─── Hero Section ─────────────────────────────── */}
        <View style={s.hero}>
          {/* Live service badge */}
          <View style={s.heroStatusRow}>
            <View style={[s.heroBadge, {
              backgroundColor: liveStats ? 'rgba(34,197,94,0.12)' : 'rgba(156,163,175,0.12)',
            }]}>
              <View style={[s.heroBadgeDot, {
                backgroundColor: liveStats ? '#22c55e' : '#9ca3af',
              }]} />
              <Text style={[s.heroBadgeText, {
                color: liveStats ? (isDark ? '#4ade80' : '#15803d') : (isDark ? '#9ca3af' : '#6b7280'),
              }]}>
                {liveStats ? 'LIVE SERVICE' : 'NO REPORTS'}
              </Text>
            </View>
            <View style={[s.lineBadge, { backgroundColor: lineColor }]}>
              <Text style={s.lineBadgeText}>{line.code}</Text>
            </View>
          </View>

          <Text style={s.heroTitle}>{line.name}</Text>
          <Text style={s.heroSubtitle}>{meta.subtitle}</Text>
          <Text style={s.heroDesc}>{meta.heroDesc}</Text>

          {/* Hero stat chips */}
          {liveStats && (liveStats.avgDelay || liveStats.latestCrowd) && (
            <View style={s.heroChips}>
              {liveStats.latestCrowd && (
                <View style={[s.heroChip, { backgroundColor: `${CROWD_COLORS[liveStats.latestCrowd.crowd_level as CrowdLevel]}12` }]}>
                  <View style={[s.heroChipDot, { backgroundColor: CROWD_COLORS[liveStats.latestCrowd.crowd_level as CrowdLevel] }]} />
                  <Text style={[s.heroChipText, { color: CROWD_COLORS[liveStats.latestCrowd.crowd_level as CrowdLevel] }]}>
                    {CROWD_LABELS[liveStats.latestCrowd.crowd_level as CrowdLevel]}
                  </Text>
                </View>
              )}
              {liveStats.avgDelay !== null && (
                <View style={[s.heroChip, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
                  <Timer size={12} color="#ef4444" />
                  <Text style={[s.heroChipText, { color: '#ef4444' }]}>~{liveStats.avgDelay}m delay</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* ─── Station Timeline ─────────────────────────── */}
        <View style={s.sectionWrap}>
          <View style={s.sectionHeader}>
            <TrainFront size={16} color="#0891b2" />
            <Text style={s.sectionTitle}>Station Timeline</Text>
            <View style={s.sectionCountBadge}>
              <Text style={s.sectionCountText}>{stations.length} stops</Text>
            </View>
          </View>

          <View style={s.timelineCard}>
            {/* Fare summary header */}
            {line.official_fare && (
              <View style={s.fareHeader}>
                <GRDABadge size="small" />
                <Text style={s.farePrice}>GHS {line.official_fare.toFixed(2)}</Text>
                <View style={{ flex: 1 }} />
                <View style={[s.fareStatusBadge, {
                  backgroundColor: liveStats?.avgDelay ? '#fef3c7' : '#dcfce7',
                }]}>
                  <View style={[s.fareStatusDot, {
                    backgroundColor: liveStats?.avgDelay ? '#f59e0b' : '#22c55e',
                  }]} />
                  <Text style={[s.fareStatusText, {
                    color: liveStats?.avgDelay ? '#92400e' : '#166534',
                  }]}>
                    {liveStats?.avgDelay ? `~${liveStats.avgDelay}m Late` : 'On Time'}
                  </Text>
                </View>
              </View>
            )}

            {/* Station list */}
            {stations.map(renderStation)}
          </View>
        </View>

        {/* ─── Official Timetable ───────────────────────── */}
        {line.code && TRAIN_SCHEDULES[line.code] && (
          <View style={s.sectionWrap}>
            <View style={s.sectionHeader}>
              <Clock size={16} color="#0891b2" />
              <Text style={s.sectionTitle}>Official Timetable</Text>
              <GRDABadge label="GRDA Official" />
              <View style={s.daysBadge}>
                <Calendar size={10} color={isDark ? '#a8a29e' : '#78716c'} />
                <Text style={s.daysText}>{TRAIN_SCHEDULES[line.code][0].days}</Text>
              </View>
            </View>

            {TRAIN_SCHEDULES[line.code].map((sched) => {
              const DirIcon = sched.direction === 'inbound' ? Sunrise : Sunset
              const dirColor = sched.direction === 'inbound' ? '#f59e0b' : '#8b5cf6'
              const isOpen = expandedSchedule === sched.id

              return (
                <View key={sched.id} style={s.schedCard}>
                  {/* Accordion header */}
                  <TouchableOpacity
                    onPress={() => setExpandedSchedule(isOpen ? null : sched.id)}
                    activeOpacity={0.7}
                    style={s.schedHeader}
                  >
                    <View style={[s.schedDirIcon, { backgroundColor: `${dirColor}15` }]}>
                      <DirIcon size={16} color={dirColor} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.schedLabel}>{sched.label}</Text>
                      <Text style={s.schedCode}>{sched.code}</Text>
                    </View>
                    <View style={[s.schedFareBadge, { backgroundColor: `${lineColor}12` }]}>
                      <Text style={[s.schedFareText, { color: lineColor }]}>₵{sched.fare.toFixed(2)}</Text>
                    </View>
                    <ChevronDown
                      size={16}
                      color={isDark ? 'rgba(255,255,255,0.3)' : '#9ca3af'}
                      style={{ marginLeft: 8, transform: [{ rotate: isOpen ? '180deg' : '0deg' }] }}
                    />
                  </TouchableOpacity>

                  {/* Expanded timetable */}
                  {isOpen && (
                    <View style={s.schedTable}>
                      <View style={s.schedTableHead}>
                        <Text style={[s.schedColHead, { flex: 1 }]}>Station</Text>
                        <Text style={[s.schedColHead, { width: 52, textAlign: 'center' }]}>Arr</Text>
                        <Text style={[s.schedColHead, { width: 52, textAlign: 'center' }]}>Dep</Text>
                      </View>
                      {sched.stops.map((stop, idx) => {
                        const isStopFirst = idx === 0
                        const isStopLast = idx === sched.stops.length - 1
                        return (
                          <View
                            key={stop.station}
                            style={[s.schedRow, isStopLast && { borderBottomWidth: 0 }]}
                          >
                            <View style={s.schedStationCol}>
                              <View
                                style={[
                                  s.schedDot,
                                  (isStopFirst || isStopLast)
                                    ? { backgroundColor: lineColor, width: 8, height: 8, borderRadius: 4, borderWidth: 0 }
                                    : { borderColor: lineColor },
                                ]}
                              />
                              <Text style={[s.schedStation, (isStopFirst || isStopLast) && s.schedStationTerminal]}>
                                {stop.station}
                              </Text>
                            </View>
                            <Text style={[s.schedTime, !stop.arrive && s.schedTimeDash]}>
                              {stop.arrive || '—'}
                            </Text>
                            <Text style={[s.schedTime, !stop.depart && s.schedTimeDash]}>
                              {stop.depart || '—'}
                            </Text>
                          </View>
                        )
                      })}
                    </View>
                  )}
                </View>
              )
            })}
          </View>
        )}

        {/* ─── Passenger Feedback ───────────────────────── */}
        <View style={s.sectionWrap}>
          <View style={s.sectionHeader}>
            <MessageSquare size={16} color="#0891b2" />
            <Text style={s.sectionTitle}>Passenger Feedback</Text>
            <View style={s.sectionCountBadge}>
              <Text style={s.sectionCountText}>{recentReports.length}</Text>
            </View>
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
                  router.push({
                    pathname: '/report/train',
                    params: { lineId: line.id },
                  })
                }
                activeOpacity={0.8}
                style={s.emptyBtn}
              >
                <Plus size={16} color="#fff" />
                <Text style={s.emptyBtnText}>Add Report</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {recentReports.slice(0, 10).map(renderReport)}
            </View>
          )}
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ─── ACTIVATE GO MODE ──────────────────────────── */}
      <View style={s.goModeWrap}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.push({
            pathname: '/trip/[routeId]',
            params: { routeId: lineId!, type: 'train', lineId: lineId! },
          } as any)}
        >
          <LinearGradient
            colors={['#0891b2', '#1e40af']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.goModeBtn}
          >
            <Navigation size={20} color="#fff" />
            <View style={{ flex: 1 }}>
              <Text style={s.goModeBtnTitle}>ACTIVATE GO MODE</Text>
              <Text style={s.goModeBtnSub}>Track your train in real-time</Text>
            </View>
            <View style={s.goModeArrow}>
              <ChevronLeft size={16} color="#fff" style={{ transform: [{ rotate: '180deg' }] }} />
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* ─── Report FAB ────────────────────────────────── */}
      <TouchableOpacity
        onPress={() =>
          router.push({
            pathname: '/report/train',
            params: { lineId: line.id },
          })
        }
        activeOpacity={0.85}
        style={s.fab}
      >
        <LinearGradient
          colors={['#0891b2', '#1e40af']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={s.fabGradient}
        >
          <Plus size={24} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>
    </SafeAreaView>
  )
}

// ─── Color interpolation helper ─────────────────────────

function interpolateColor(from: string, to: string, t: number): string {
  const f = parseInt(from.slice(1), 16)
  const tC = parseInt(to.slice(1), 16)
  const r1 = (f >> 16) & 255, g1 = (f >> 8) & 255, b1 = f & 255
  const r2 = (tC >> 16) & 255, g2 = (tC >> 8) & 255, b2 = tC & 255
  const r = Math.round(r1 + (r2 - r1) * t)
  const g = Math.round(g1 + (g2 - g1) * t)
  const b = Math.round(b1 + (b2 - b1) * t)
  return `rgb(${r},${g},${b})`
}

// ─── Styles ─────────────────────────────────────────────

const getStyles = (isDark: boolean) => {
  const surface = isDark ? '#1c1c1e' : '#fcf5f2'
  const surfaceLowest = isDark ? '#1c1c1e' : '#ffffff'
  const surfaceLow = isDark ? 'rgba(255,255,255,0.04)' : '#f6efed'
  const onSurface = isDark ? '#f5f5f4' : '#312e2d'
  const onSurfaceVariant = isDark ? 'rgba(255,255,255,0.5)' : '#5f5b59'
  const outlineVariant = isDark ? 'rgba(255,255,255,0.1)' : '#e7e5e4'

  return StyleSheet.create({
    container: { flex: 1, backgroundColor: surface },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
    emptyTitle: { fontSize: 18, fontFamily: font.semibold, color: onSurfaceVariant, marginTop: 12 },

    // ── GRDA Header Bar ──
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
      fontSize: 16,
      fontFamily: font.extrabold,
      color: '#fff',
      letterSpacing: -0.3,
    },
    headerSub: {
      fontSize: 11,
      fontFamily: font.semibold,
      color: 'rgba(255,255,255,0.6)',
      letterSpacing: 0.5,
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

    // ── Hero ──
    hero: {
      paddingHorizontal: 20,
      paddingTop: 24,
      paddingBottom: 20,
    },
    heroStatusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 14,
    },
    heroBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 12,
    },
    heroBadgeDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    heroBadgeText: {
      fontSize: 10,
      fontFamily: font.bold,
      letterSpacing: 1,
    },
    lineBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
    },
    lineBadgeText: {
      fontSize: 12,
      fontFamily: font.bold,
      color: '#fff',
      letterSpacing: 1,
    },
    heroTitle: {
      fontSize: 28,
      fontFamily: font.extrabold,
      color: onSurface,
      letterSpacing: -0.5,
      marginBottom: 4,
    },
    heroSubtitle: {
      fontSize: 14,
      fontFamily: font.semibold,
      color: '#0891b2',
      marginBottom: 8,
    },
    heroDesc: {
      fontSize: 14,
      fontFamily: font.regular,
      color: onSurfaceVariant,
      lineHeight: 20,
    },
    heroChips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 14,
    },
    heroChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 10,
    },
    heroChipDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    heroChipText: {
      fontSize: 12,
      fontFamily: font.semibold,
    },

    // ── Sections ──
    sectionWrap: {
      paddingHorizontal: 20,
      marginBottom: 24,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 14,
    },
    sectionTitle: {
      fontSize: 16,
      fontFamily: font.bold,
      color: onSurface,
      flex: 1,
    },
    sectionCountBadge: {
      backgroundColor: surfaceLow,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    sectionCountText: {
      fontSize: 11,
      fontFamily: font.semibold,
      color: onSurfaceVariant,
    },

    // ── Station Timeline ──
    timelineCard: {
      backgroundColor: surfaceLowest,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: outlineVariant,
      overflow: 'hidden',
    },
    fareHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: outlineVariant,
    },
    farePrice: {
      fontFamily: font.bold,
      fontSize: 16,
      color: onSurface,
    },
    fareStatusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 10,
      gap: 6,
    },
    fareStatusDot: { width: 6, height: 6, borderRadius: 3 },
    fareStatusText: { fontFamily: font.semibold, fontSize: 12 },
    stationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 56,
    },
    connector: {
      width: 52,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'stretch',
      position: 'relative',
    },
    lineSegTop: {
      position: 'absolute',
      top: 0,
      width: 4,
      height: '50%' as unknown as number,
      borderRadius: 2,
    },
    lineSegBottom: {
      position: 'absolute',
      bottom: 0,
      width: 4,
      height: '50%' as unknown as number,
      borderRadius: 2,
    },
    terminalDot: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1,
    },
    stationDot: {
      width: 16,
      height: 16,
      borderRadius: 8,
      borderWidth: 3,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1,
    },
    crowdDotInner: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    stationInfo: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 16,
      paddingRight: 16,
      gap: 8,
    },
    stationName: { fontFamily: font.medium, fontSize: 15, color: onSurface },
    stationNameTerminal: { fontFamily: font.bold, fontSize: 16 },
    stationHint: { fontSize: 11, fontFamily: font.regular, color: onSurfaceVariant, marginTop: 1 },
    stationTime: { fontFamily: font.semibold, fontSize: 13, color: onSurfaceVariant, marginRight: 4 },
    crowdChip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 10,
      gap: 5,
    },
    crowdChipDot: { width: 6, height: 6, borderRadius: 3 },
    crowdChipText: { fontSize: 11, fontFamily: font.semibold },

    // ── Expanded Station ──
    expandedSection: {
      marginLeft: 52,
      marginRight: 16,
      paddingLeft: 12,
      paddingBottom: 12,
      borderLeftWidth: 1,
      borderLeftColor: outlineVariant,
    },
    expandedReport: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 6,
    },
    expandedReportDot: { width: 6, height: 6, borderRadius: 3 },
    expandedReportLabel: { fontFamily: font.medium, fontSize: 12, color: onSurfaceVariant },
    expandedReportDetail: { fontFamily: font.semibold, fontSize: 11 },
    expandedReportTime: { fontFamily: font.regular, fontSize: 10, color: isDark ? 'rgba(255,255,255,0.3)' : '#a8a29e', marginLeft: 'auto' },
    expandedEmpty: { fontFamily: font.regular, fontSize: 12, color: onSurfaceVariant, paddingVertical: 8 },
    expandedAddBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 8,
      backgroundColor: isDark ? 'rgba(8,145,178,0.15)' : '#ecfeff',
      marginTop: 6,
    },
    expandedAddText: { fontFamily: font.semibold, fontSize: 11, color: '#0891b2' },

    // ── Schedule Timetable ──
    daysBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: surfaceLow,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    daysText: { fontSize: 11, fontFamily: font.medium, color: onSurfaceVariant },
    schedCard: {
      backgroundColor: surfaceLowest,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: outlineVariant,
      marginBottom: 12,
      overflow: 'hidden',
    },
    schedHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
    },
    schedDirIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    schedLabel: { fontFamily: font.semibold, fontSize: 14, color: onSurface },
    schedCode: { fontFamily: font.regular, fontSize: 11, color: onSurfaceVariant, marginTop: 1 },
    schedFareBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 10,
    },
    schedFareText: { fontFamily: font.semibold, fontSize: 12 },
    schedTable: {
      paddingHorizontal: 16,
      paddingVertical: 4,
      borderTopWidth: 1,
      borderTopColor: outlineVariant,
    },
    schedTableHead: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: outlineVariant,
    },
    schedColHead: {
      fontFamily: font.medium,
      fontSize: 11,
      color: onSurfaceVariant,
      textTransform: 'uppercase' as const,
      letterSpacing: 0.5,
    },
    schedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: outlineVariant,
    },
    schedStationCol: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
    schedDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      borderWidth: 1.5,
      borderColor: onSurfaceVariant,
    },
    schedStation: { fontFamily: font.regular, fontSize: 13, color: onSurface },
    schedStationTerminal: { fontFamily: font.semibold },
    schedTime: { width: 52, textAlign: 'center' as const, fontFamily: font.medium, fontSize: 13, color: onSurface },
    schedTimeDash: { color: onSurfaceVariant },

    // ── Report Cards ──
    reportCard: {
      flexDirection: 'row',
      borderRadius: 16,
      backgroundColor: surfaceLowest,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: outlineVariant,
    },
    reportAccent: { width: 4 },
    reportBody: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
    },
    reportIconBox: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    reportTitle: { fontFamily: font.semibold, fontSize: 14, color: onSurface },
    reportPill: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 8,
    },
    reportPillText: { fontSize: 11, fontFamily: font.semibold },
    reportStation: { fontSize: 12, fontFamily: font.regular, color: onSurfaceVariant, marginTop: 2 },
    reportTime: { fontSize: 11, fontFamily: font.regular, color: isDark ? 'rgba(255,255,255,0.3)' : '#a8a29e' },

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
      paddingHorizontal: 20,
      paddingBottom: 32,
      paddingTop: 12,
      backgroundColor: isDark ? 'rgba(28,28,30,0.95)' : 'rgba(252,245,242,0.95)',
    },
    goModeBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      padding: 16,
      borderRadius: 20,
    },
    goModeBtnTitle: {
      color: '#fff',
      fontSize: 15,
      fontFamily: font.extrabold,
      letterSpacing: 1,
    },
    goModeBtnSub: {
      color: 'rgba(255,255,255,0.7)',
      fontSize: 12,
      fontFamily: font.regular,
      marginTop: 2,
    },
    goModeArrow: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: 'rgba(255,255,255,0.2)',
      alignItems: 'center',
      justifyContent: 'center',
    },

    // ── FAB ──
    fab: {
      position: 'absolute',
      bottom: 100,
      right: 20,
      width: 56,
      height: 56,
      borderRadius: 28,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
    },
    fabGradient: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
  })
}
