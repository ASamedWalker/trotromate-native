import { useCallback, useMemo } from 'react'
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
  ArrowDownUp,
  Gauge,
  Sunrise,
  Sunset,
  Calendar,
} from 'lucide-react-native'
import { c, themed, font } from '@/lib/theme'
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

  const lineColor = line?.color || '#0ea5e9'

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

      return (
        <View key={station.id} style={s.stationRow}>
          {/* Metro timeline connector */}
          <View style={s.connector}>
            {/* Top line */}
            {!isFirst && (
              <View style={[s.lineSegTop, { backgroundColor: lineColor }]} />
            )}
            {/* Station dot — terminals are larger and filled */}
            {isTerminal ? (
              <View style={[s.terminalDot, { backgroundColor: lineColor }]}>
                <View style={s.terminalInner} />
              </View>
            ) : (
              <View style={[s.stationDot, { borderColor: lineColor, backgroundColor: t.card }]}>
                {crowdColor && (
                  <View style={[s.crowdDotInner, { backgroundColor: crowdColor }]} />
                )}
              </View>
            )}
            {/* Bottom line */}
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
          </View>
        </View>
      )
    },
    [stations, lineColor, stationCrowdMap, isDark, s, t]
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
        {/* ─── Hero Header ─────────────────────────────────── */}
        <View style={[s.hero, { backgroundColor: lineColor }]}>
          <View style={s.heroGlow} />
          <View style={s.heroContent}>
            <View style={s.heroTopRow}>
              <View style={s.heroIconBox}>
                <TrainFront size={28} color={c.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.heroCode}>{line.code}</Text>
                <Text style={s.heroName}>{line.name}</Text>
              </View>
            </View>
            {/* Route summary */}
            <View style={s.heroRoute}>
              <Text style={s.heroRouteText}>
                {stations.length > 0
                  ? `${stations[0].name}  →  ${stations[stations.length - 1].name}`
                  : `${stations.length} stations`}
              </Text>
            </View>
            {/* Stat chips */}
            <View style={s.heroChips}>
              <View style={s.heroChip}>
                <Text style={s.heroChipText}>{stations.length} stops</Text>
              </View>
              {line.official_fare && (
                <View style={s.heroChip}>
                  <Text style={s.heroChipText}>₵{line.official_fare.toFixed(2)} fare</Text>
                </View>
              )}
              {liveStats && liveStats.totalReports > 0 && (
                <View style={s.heroChip}>
                  <Text style={s.heroChipText}>{liveStats.totalReports} reports</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* ─── Live Stats Row ──────────────────────────────── */}
        {liveStats && (liveStats.avgDelay || liveStats.latestCrowd) && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.statsScroll}
          >
            {liveStats.latestCrowd && (
              <View style={s.statCard}>
                <View style={[s.statIconBox, { backgroundColor: `${CROWD_COLORS[liveStats.latestCrowd.crowd_level as CrowdLevel]}15` }]}>
                  <Gauge
                    size={18}
                    color={CROWD_COLORS[liveStats.latestCrowd.crowd_level as CrowdLevel]}
                  />
                </View>
                <Text style={s.statValue}>
                  {CROWD_LABELS[liveStats.latestCrowd.crowd_level as CrowdLevel]}
                </Text>
                <Text style={s.statLabel}>Live Crowd</Text>
              </View>
            )}
            {liveStats.avgDelay !== null && (
              <View style={s.statCard}>
                <View style={[s.statIconBox, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
                  <AlertCircle size={18} color="#ef4444" />
                </View>
                <Text style={s.statValue}>{liveStats.avgDelay}m</Text>
                <Text style={s.statLabel}>Avg Delay</Text>
              </View>
            )}
            <View style={s.statCard}>
              <View style={[s.statIconBox, { backgroundColor: `${lineColor}15` }]}>
                <BarChart3 size={18} color={lineColor} />
              </View>
              <Text style={s.statValue}>{recentReports.length}</Text>
              <Text style={s.statLabel}>Reports</Text>
            </View>
          </ScrollView>
        )}

        <View style={s.body}>
          {/* ─── Station Timeline ────────────────────────────── */}
          <View style={s.sectionHeader}>
            <ArrowDownUp size={16} color={lineColor} />
            <Text style={s.sectionTitle}>Stations</Text>
          </View>

          <View style={s.stationCard}>
            {stations.map(renderStation)}
          </View>

          {/* ─── Schedule Timetable ──────────────────────── */}
          {line.code && TRAIN_SCHEDULES[line.code] && (
            <>
              <View style={[s.sectionHeader, { marginTop: 28 }]}>
                <Clock size={16} color={lineColor} />
                <Text style={s.sectionTitle}>Schedule</Text>
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

    // ── Hero ──
    hero: {
      paddingBottom: 24,
      borderBottomLeftRadius: 32,
      borderBottomRightRadius: 32,
      overflow: 'hidden',
    },
    heroGlow: {
      position: 'absolute',
      top: -40,
      right: -40,
      width: 160,
      height: 160,
      borderRadius: 80,
      backgroundColor: 'rgba(255,255,255,0.08)',
    },
    heroContent: { paddingHorizontal: 24, paddingTop: 16 },
    heroTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    heroIconBox: {
      width: 56,
      height: 56,
      borderRadius: 18,
      backgroundColor: 'rgba(255,255,255,0.18)',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 16,
    },
    heroCode: {
      color: 'rgba(255,255,255,0.7)',
      fontSize: 13,
      fontFamily: font.bold,
      letterSpacing: 2,
      textTransform: 'uppercase',
    },
    heroName: { color: c.white, fontSize: 22, fontFamily: font.bold, marginTop: 2 },
    heroRoute: {
      backgroundColor: 'rgba(255,255,255,0.12)',
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 16,
      marginBottom: 14,
    },
    heroRouteText: {
      color: c.white,
      fontSize: 14,
      fontFamily: font.semibold,
      textAlign: 'center',
      letterSpacing: 0.5,
    },
    heroChips: { flexDirection: 'row', gap: 8 },
    heroChip: {
      backgroundColor: 'rgba(255,255,255,0.15)',
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 20,
    },
    heroChipText: { color: c.white, fontSize: 12, fontFamily: font.semibold },

    // ── Stats Row ──
    statsScroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 4, gap: 10 },
    statCard: {
      backgroundColor: t.card,
      borderRadius: 16,
      padding: 14,
      width: 110,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: t.border,
    },
    statIconBox: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    statValue: { fontSize: 16, fontFamily: font.bold, color: t.text },
    statLabel: { fontSize: 11, fontFamily: font.regular, color: t.textSecondary, marginTop: 2 },

    // ── Body ──
    body: { paddingHorizontal: 20, paddingTop: 24 },
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
