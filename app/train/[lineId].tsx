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
import {
  TrainFront,
  Clock,
  Users,
  Timer,
  Plus,
  BarChart3,
  AlertCircle,
  ArrowRight,
  Gauge,
  Sunrise,
  Sunset,
  Calendar,
  ChevronDown,
} from 'lucide-react-native'
import { c, themed, font, shadow } from '@/lib/theme'
import { GRDABadge } from '@/components/GRDABadge'
import { useTrainLineDetail } from '@/lib/hooks/useTrain'
import { timeAgo } from '@/lib/utils/time'
import { TRAIN_SCHEDULES } from '@/lib/constants/train-schedule'
import type { TrainReportWithNames, CrowdLevel, TrainStation } from '@/lib/types'

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

export default function LineDetailScreen() {
  const router = useRouter()
  const { lineId } = useLocalSearchParams<{ lineId: string }>()
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const t = themed(isDark)
  const s = getStyles(isDark)

  const { line, stations, recentReports, isLoading, refetch } = useTrainLineDetail(lineId!)
  const [expandedStation, setExpandedStation] = useState<string | null>(null)

  const lineColor = line?.color || '#0ea5e9'

  // Build a map of station name → schedule times (from the first schedule)
  const stationTimesMap = useMemo(() => {
    if (!line?.code || !TRAIN_SCHEDULES[line.code]) return {}
    const map: Record<string, { arrive: string | null; depart: string | null }> = {}
    // Use first schedule (morning) for default times
    const sched = TRAIN_SCHEDULES[line.code][0]
    if (sched) {
      for (const stop of sched.stops) {
        map[stop.station] = { arrive: stop.arrive, depart: stop.depart }
      }
    }
    return map
  }, [line?.code])

  // Compute live stats from recent reports
  const liveStats = useMemo(() => {
    if (!recentReports.length) return null

    const delayReports = recentReports.filter((r) => r.report_type === 'delay' && r.delay_mins)
    const avgDelay =
      delayReports.length > 0
        ? Math.round(delayReports.reduce((sum, r) => sum + (r.delay_mins || 0), 0) / delayReports.length)
        : null

    // Latest overall crowd level
    const latestCrowd = recentReports.find((r) => r.report_type === 'crowd' && r.crowd_level)

    return { avgDelay, latestCrowd, totalReports: recentReports.length }
  }, [recentReports])

  // Get latest crowd level per station
  const stationCrowdMap = useMemo(() => {
    const map: Record<string, TrainReportWithNames> = {}
    for (const r of recentReports) {
      if (r.report_type === 'crowd' && r.crowd_level && !map[r.station_id]) {
        map[r.station_id] = r
      }
    }
    return map
  }, [recentReports])

  // Group reports by station
  const stationReportsMap = useMemo(() => {
    const map: Record<string, TrainReportWithNames[]> = {}
    for (const r of recentReports) {
      if (!map[r.station_id]) map[r.station_id] = []
      map[r.station_id].push(r)
    }
    return map
  }, [recentReports])

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
          {/* Color accent */}
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
    [isDark, s]
  )

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

      return (
        <View key={station.id}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setExpandedStation(isExpanded ? null : station.id)}
            style={s.stationRow}
          >
            {/* Metro timeline connector */}
            <View style={s.connector}>
              {!isFirst && (
                <View style={[s.lineSegTop, { backgroundColor: lineColor }]} />
              )}
              {isTerminal ? (
                <View style={[s.terminalDot, { backgroundColor: lineColor }]}>
                  <TrainFront size={12} color={c.white} />
                </View>
              ) : (
                <View style={[s.stationDot, { borderColor: crowdColor || lineColor, backgroundColor: crowdColor ? `${crowdColor}15` : t.card }]}>
                  <TrainFront size={9} color={crowdColor || lineColor} />
                </View>
              )}
              {!isLast && (
                <View style={[s.lineSegBottom, { backgroundColor: lineColor }]} />
              )}
            </View>

            {/* Station info */}
            <View style={s.stationInfo}>
              <View style={{ flex: 1 }}>
                <Text style={[s.stationName, isTerminal && s.stationNameTerminal]}>
                  {station.name}
                </Text>
                {isFirst && (
                  <Text style={s.stationHint}>Origin</Text>
                )}
                {isLast && (
                  <Text style={s.stationHint}>Terminus</Text>
                )}
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
                color={t.textTertiary}
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
                style={[s.expandedAddBtn, { backgroundColor: `${lineColor}15` }]}
              >
                <Plus size={12} color={lineColor} />
                <Text style={[s.expandedAddText, { color: lineColor }]}>Add Report</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )
    },
    [stations, lineColor, stationCrowdMap, stationReportsMap, stationTimesMap, expandedStation, isDark, s, t, line, router]
  )

  if (isLoading) {
    return (
      <SafeAreaView style={s.container} edges={['bottom']}>
        <View style={s.centered}>
          <ActivityIndicator size="large" color="#0ea5e9" />
        </View>
      </SafeAreaView>
    )
  }

  if (!line) {
    return (
      <SafeAreaView style={s.container} edges={['bottom']}>
        <View style={s.centered}>
          <TrainFront size={48} color={t.textTertiary} />
          <Text style={s.emptyTitle}>Line not found</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={refetch}
            tintColor="#0ea5e9"
            colors={['#0ea5e9']}
          />
        }
      >
        {/* ─── Unified Line Card ─────────────────────────── */}
        <View style={s.body}>
          <View style={s.stationCard}>
            {/* Card header — schedule badge + route */}
            <View style={s.cardHeader}>
              <View style={s.cardHeaderTop}>
                <View style={[s.schedBadge, { backgroundColor: lineColor }]}>
                  <Text style={s.schedBadgeText}>{line.code}</Text>
                </View>
                <Text style={s.cardHeaderLabel}>{line.name}</Text>
              </View>
              <View style={s.cardHeaderRoute}>
                <TrainFront size={14} color={lineColor} />
                <Text style={s.cardHeaderFrom}>
                  {stations.length > 0 ? stations[0].name : '—'}
                </Text>
                <ArrowRight size={14} color={t.textTertiary} />
                <Text style={s.cardHeaderTo}>
                  {stations.length > 0 ? stations[stations.length - 1].name : '—'}
                </Text>
              </View>
              {/* Live stat chips */}
              {liveStats && (liveStats.avgDelay || liveStats.latestCrowd) && (
                <View style={s.liveChipsRow}>
                  {liveStats.latestCrowd && (
                    <View style={[s.liveChip, { backgroundColor: `${CROWD_COLORS[liveStats.latestCrowd.crowd_level as CrowdLevel]}15` }]}>
                      <Gauge size={12} color={CROWD_COLORS[liveStats.latestCrowd.crowd_level as CrowdLevel]} />
                      <Text style={[s.liveChipText, { color: CROWD_COLORS[liveStats.latestCrowd.crowd_level as CrowdLevel] }]}>
                        {CROWD_LABELS[liveStats.latestCrowd.crowd_level as CrowdLevel]}
                      </Text>
                    </View>
                  )}
                  {liveStats.avgDelay !== null && (
                    <View style={[s.liveChip, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
                      <AlertCircle size={12} color="#ef4444" />
                      <Text style={[s.liveChipText, { color: '#ef4444' }]}>
                        ~{liveStats.avgDelay}m delay
                      </Text>
                    </View>
                  )}
                  <View style={[s.liveChip, { backgroundColor: `${lineColor}12` }]}>
                    <BarChart3 size={12} color={lineColor} />
                    <Text style={[s.liveChipText, { color: lineColor }]}>
                      {recentReports.length} reports
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* Station timeline — flows directly from header */}
            {stations.map(renderStation)}

            {/* Fare summary bar at bottom */}
            {line.official_fare && (
              <View style={s.fareSummary}>
                <View style={s.fareSummaryLeft}>
                  <GRDABadge size="small" />
                  <Text style={s.fareSummaryPrice}>
                    GHS {line.official_fare.toFixed(2)}
                  </Text>
                </View>
                <View style={[s.fareSummaryBadge, {
                  backgroundColor: liveStats?.avgDelay ? '#fef3c7' : '#dcfce7',
                }]}>
                  <View style={[s.fareSummaryBadgeDot, {
                    backgroundColor: liveStats?.avgDelay ? '#f59e0b' : '#22c55e',
                  }]} />
                  <Text style={[s.fareSummaryBadgeText, {
                    color: liveStats?.avgDelay ? '#92400e' : '#166534',
                  }]}>
                    {liveStats?.avgDelay ? `~${liveStats.avgDelay}m Late` : 'On Time'}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* ─── Schedule Timetable ──────────────────────── */}
          {line.code && TRAIN_SCHEDULES[line.code] && (
            <>
              <View style={[s.sectionHeader, { marginTop: 28 }]}>
                <Clock size={16} color={lineColor} />
                <Text style={s.sectionTitle}>Schedule</Text>
                <GRDABadge label="GRDA Official" />
                <View style={s.schedDaysBadge}>
                  <Calendar size={10} color={t.textSecondary} />
                  <Text style={s.schedDaysText}>
                    {TRAIN_SCHEDULES[line.code][0].days}
                  </Text>
                </View>
              </View>

              {TRAIN_SCHEDULES[line.code].map((sched) => {
                const DirIcon = sched.direction === 'inbound' ? Sunrise : Sunset
                const dirColor = sched.direction === 'inbound' ? '#f59e0b' : '#8b5cf6'
                return (
                  <View key={sched.id} style={s.schedCard}>
                    {/* Header */}
                    <View style={s.schedHeader}>
                      <View style={[s.schedDirIcon, { backgroundColor: `${dirColor}15` }]}>
                        <DirIcon size={16} color={dirColor} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.schedLabel}>{sched.label}</Text>
                        <Text style={s.schedCode}>{sched.code}</Text>
                      </View>
                      <View style={[s.schedFareBadge, { backgroundColor: `${lineColor}12` }]}>
                        <Text style={[s.schedFareText, { color: lineColor }]}>
                          ₵{sched.fare.toFixed(2)}
                        </Text>
                      </View>
                    </View>

                    {/* Time table */}
                    <View style={s.schedTable}>
                      {/* Column headers */}
                      <View style={s.schedTableHead}>
                        <Text style={[s.schedColHead, { flex: 1 }]}>Station</Text>
                        <Text style={[s.schedColHead, { width: 52, textAlign: 'center' }]}>Arr</Text>
                        <Text style={[s.schedColHead, { width: 52, textAlign: 'center' }]}>Dep</Text>
                      </View>

                      {sched.stops.map((stop, idx) => {
                        const isFirst = idx === 0
                        const isLast = idx === sched.stops.length - 1
                        return (
                          <View
                            key={stop.station}
                            style={[
                              s.schedRow,
                              isLast && { borderBottomWidth: 0 },
                            ]}
                          >
                            <View style={s.schedStationCol}>
                              <View
                                style={[
                                  s.schedDot,
                                  (isFirst || isLast)
                                    ? { backgroundColor: lineColor, width: 8, height: 8, borderRadius: 4 }
                                    : { borderColor: lineColor },
                                ]}
                              />
                              <Text
                                style={[
                                  s.schedStation,
                                  (isFirst || isLast) && s.schedStationTerminal,
                                ]}
                              >
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
                  </View>
                )
              })}
            </>
          )}

          {/* ─── Community Reports ────────────────────────── */}
          <View style={[s.sectionHeader, { marginTop: 28 }]}>
            <BarChart3 size={16} color={lineColor} />
            <Text style={s.sectionTitle}>Community Reports</Text>
            <Text style={s.sectionCount}>{recentReports.length}</Text>
          </View>

          {recentReports.length === 0 ? (
            <View style={s.emptyCard}>
              <TrainFront size={32} color={t.textTertiary} />
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
                style={[s.emptyBtn, { backgroundColor: lineColor }]}
              >
                <Plus size={16} color={c.white} />
                <Text style={s.emptyBtnText}>Add Report</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {recentReports.slice(0, 10).map(renderReport)}
            </View>
          )}

          <View style={{ height: 100 }} />
        </View>
      </ScrollView>

      {/* ─── Report FAB ─────────────────────────────────── */}
      <TouchableOpacity
        onPress={() =>
          router.push({
            pathname: '/report/train',
            params: { lineId: line.id },
          })
        }
        activeOpacity={0.85}
        style={[s.fab, { backgroundColor: lineColor }]}
      >
        <Plus size={24} color={c.white} />
      </TouchableOpacity>
    </SafeAreaView>
  )
}

// ─── Styles ────────────────────────────────────────────────

const getStyles = (isDark: boolean) => {
  const t = themed(isDark)
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
    emptyTitle: { fontSize: 18, fontFamily: font.semibold, color: t.textSecondary, marginTop: 12 },

    // ── Card Header ──
    cardHeader: {
      paddingHorizontal: 20,
      paddingTop: 18,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: t.border,
    },
    cardHeaderTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 10,
    },
    schedBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
    },
    schedBadgeText: {
      fontSize: 13,
      fontFamily: font.bold,
      color: c.white,
      letterSpacing: 1,
    },
    cardHeaderLabel: {
      fontSize: 16,
      fontFamily: font.semibold,
      color: t.text,
      flex: 1,
    },
    cardHeaderRoute: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 10,
    },
    cardHeaderFrom: { fontSize: 14, fontFamily: font.medium, color: t.text },
    cardHeaderTo: { fontSize: 14, fontFamily: font.medium, color: t.text },
    liveChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    liveChip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      gap: 4,
    },
    liveChipText: { fontSize: 11, fontFamily: font.semibold },

    // ── Body ──
    body: { paddingHorizontal: 20, paddingTop: 16 },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 14,
    },
    sectionTitle: { fontSize: 16, fontFamily: font.bold, color: t.text, flex: 1 },
    sectionCount: {
      fontSize: 12,
      fontFamily: font.semibold,
      color: t.textSecondary,
      backgroundColor: t.cardAlt,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 8,
    },

    // ── Station Timeline ──
    stationCard: {
      backgroundColor: t.card,
      borderRadius: 20,
      paddingVertical: 8,
      paddingRight: 16,
      borderWidth: 1,
      borderColor: t.border,
    },
    stationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 56,
    },
    connector: {
      width: 48,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'stretch',
      position: 'relative',
    },
    lineSegTop: {
      position: 'absolute',
      top: 0,
      width: 4,
      height: '50%',
      borderRadius: 2,
    },
    lineSegBottom: {
      position: 'absolute',
      bottom: 0,
      width: 4,
      height: '50%',
      borderRadius: 2,
    },
    terminalDot: {
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1,
    },
    terminalInner: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: c.white,
    },
    stationDot: {
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 3,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1,
    },
    crowdDotInner: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    stationInfo: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 16,
      gap: 8,
    },
    stationName: { fontFamily: font.medium, fontSize: 15, color: t.text },
    stationNameTerminal: { fontFamily: font.bold, fontSize: 16 },
    stationHint: { fontSize: 11, fontFamily: font.regular, color: t.textTertiary, marginTop: 1 },
    stationTime: { fontFamily: font.semibold, fontSize: 13, color: t.textSecondary, marginRight: 4 },
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

    // ── Fare Summary Bar ──
    fareSummary: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderTopWidth: 1,
      borderTopColor: t.border,
    },
    fareSummaryLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    fareSummaryPrice: { fontFamily: font.bold, fontSize: 16, color: t.text },
    fareSummaryBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 10,
      gap: 6,
    },
    fareSummaryBadgeDot: { width: 6, height: 6, borderRadius: 3 },
    fareSummaryBadgeText: { fontFamily: font.semibold, fontSize: 12 },

    // ── Expanded Station ──
    expandedSection: {
      marginLeft: 48,
      marginRight: 16,
      paddingLeft: 12,
      paddingBottom: 12,
      borderLeftWidth: 1,
      borderLeftColor: t.border,
    },
    expandedReport: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 6,
    },
    expandedReportDot: { width: 6, height: 6, borderRadius: 3 },
    expandedReportLabel: { fontFamily: font.medium, fontSize: 12, color: t.textSecondary },
    expandedReportDetail: { fontFamily: font.semibold, fontSize: 11 },
    expandedReportTime: { fontFamily: font.regular, fontSize: 10, color: t.textTertiary, marginLeft: 'auto' },
    expandedEmpty: { fontFamily: font.regular, fontSize: 12, color: t.textTertiary, paddingVertical: 8 },
    expandedAddBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 8,
      marginTop: 6,
    },
    expandedAddText: { fontFamily: font.semibold, fontSize: 11 },

    // ── Schedule Timetable ──
    schedDaysBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: t.cardAlt,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    schedDaysText: { fontSize: 11, fontFamily: font.medium, color: t.textSecondary },
    schedCard: {
      backgroundColor: t.card,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: t.border,
      marginBottom: 12,
      overflow: 'hidden',
      ...shadow.card,
    },
    schedHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: t.border,
    },
    schedDirIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    schedLabel: { fontFamily: font.semibold, fontSize: 14, color: t.text },
    schedCode: { fontFamily: font.regular, fontSize: 11, color: t.textTertiary, marginTop: 1 },
    schedFareBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 10,
    },
    schedFareText: { fontFamily: font.semibold, fontSize: 12 },
    schedTable: { paddingHorizontal: 16, paddingVertical: 4 },
    schedTableHead: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: t.border,
    },
    schedColHead: { fontFamily: font.medium, fontSize: 11, color: t.textTertiary, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
    schedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.border,
    },
    schedStationCol: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
    schedDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      borderWidth: 1.5,
      borderColor: t.textTertiary,
    },
    schedStation: { fontFamily: font.regular, fontSize: 13, color: t.text },
    schedStationTerminal: { fontFamily: font.semibold },
    schedTime: { width: 52, textAlign: 'center' as const, fontFamily: font.medium, fontSize: 13, color: t.text },
    schedTimeDash: { color: t.textTertiary },

    // ── Report Cards ──
    reportCard: {
      flexDirection: 'row',
      borderRadius: 16,
      backgroundColor: t.card,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: t.border,
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
    reportTitle: { fontFamily: font.semibold, fontSize: 14, color: t.text },
    reportPill: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 8,
    },
    reportPillText: { fontSize: 11, fontFamily: font.semibold },
    reportStation: { fontSize: 12, fontFamily: font.regular, color: t.textSecondary, marginTop: 2 },
    reportTime: { fontSize: 11, fontFamily: font.regular, color: t.textTertiary },

    // ── Empty State ──
    emptyCard: {
      padding: 32,
      borderRadius: 20,
      backgroundColor: t.card,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: t.border,
    },
    emptyCardTitle: { fontSize: 16, fontFamily: font.semibold, color: t.text, marginTop: 12 },
    emptyCardText: {
      fontSize: 13,
      fontFamily: font.regular,
      color: t.textSecondary,
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
    },
    emptyBtnText: { color: c.white, fontFamily: font.semibold, fontSize: 14 },

    // ── FAB ──
    fab: {
      position: 'absolute',
      bottom: 24,
      right: 20,
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
    },
  })
}
