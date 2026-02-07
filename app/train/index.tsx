import { useState, useEffect, useCallback, useMemo } from 'react'
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
import { useRouter } from 'expo-router'
import {
  TrainFront,
  ChevronRight,
  MapPin,
  BarChart3,
  Clock,
  ArrowRight,
} from 'lucide-react-native'
import { themed, font } from '@/lib/theme'
import { useTrainLines } from '@/lib/hooks/useTrain'
import { timeAgo, getGhanaTime, formatGhanaTime } from '@/lib/utils/time'
import { TRAIN_SCHEDULES, type TrainSchedule } from '@/lib/constants/train-schedule'
import type { TrainLineWithStats } from '@/lib/types'

// ─── Schedule helpers ────────────────────────────────────

function parseTimeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function getCurrentStation(schedule: TrainSchedule, currentMinutes: number) {
  for (let i = schedule.stops.length - 1; i >= 0; i--) {
    const time = parseTimeToMinutes(schedule.stops[i].arrive || schedule.stops[i].depart!)
    if (currentMinutes >= time) {
      return {
        current: schedule.stops[i].station,
        next: i < schedule.stops.length - 1 ? schedule.stops[i + 1].station : null,
        nextArr: i < schedule.stops.length - 1 ? schedule.stops[i + 1].arrive : null,
      }
    }
  }
  return {
    current: schedule.stops[0].station,
    next: schedule.stops[1]?.station || null,
    nextArr: schedule.stops[1]?.arrive || null,
  }
}

type DepartureInfo =
  | {
      type: 'waiting'
      schedule: TrainSchedule
      remaining: number
      origin: string
      destination: string
      departTime: string
      tomorrow?: boolean
    }
  | {
      type: 'in-transit'
      schedule: TrainSchedule
      progress: number
      destination: string
      currentStation: string
      nextStation: string | null
      nextArrival: string | null
      arrivalTime: string
    }
  | { type: 'no-service' }

function computeDeparture(schedules: TrainSchedule[]): DepartureInfo {
  const ghana = getGhanaTime()
  const day = ghana.day
  const currentMinutes = ghana.hours * 60 + ghana.minutes
  const currentSeconds = ghana.seconds
  const totalSeconds = currentMinutes * 60 + currentSeconds

  if (day === 0) return { type: 'no-service' }

  const morning = schedules.find((s) => s.direction === 'inbound')
  const evening = schedules.find((s) => s.direction === 'outbound')
  if (!morning || !evening) return { type: 'no-service' }

  const mDepart = parseTimeToMinutes(morning.stops[0].depart!)
  const mArrive = parseTimeToMinutes(morning.stops[morning.stops.length - 1].arrive!)
  const eDepart = parseTimeToMinutes(evening.stops[0].depart!)
  const eArrive = parseTimeToMinutes(evening.stops[evening.stops.length - 1].arrive!)

  if (currentMinutes < mDepart) {
    return {
      type: 'waiting',
      schedule: morning,
      remaining: mDepart * 60 - totalSeconds,
      origin: morning.stops[0].station,
      destination: morning.stops[morning.stops.length - 1].station,
      departTime: morning.stops[0].depart!,
    }
  }

  if (currentMinutes <= mArrive) {
    const pos = getCurrentStation(morning, currentMinutes)
    return {
      type: 'in-transit',
      schedule: morning,
      progress: (currentMinutes - mDepart) / (mArrive - mDepart),
      destination: morning.stops[morning.stops.length - 1].station,
      currentStation: pos.current,
      nextStation: pos.next,
      nextArrival: pos.nextArr,
      arrivalTime: morning.stops[morning.stops.length - 1].arrive!,
    }
  }

  if (currentMinutes < eDepart) {
    return {
      type: 'waiting',
      schedule: evening,
      remaining: eDepart * 60 - totalSeconds,
      origin: evening.stops[0].station,
      destination: evening.stops[evening.stops.length - 1].station,
      departTime: evening.stops[0].depart!,
    }
  }

  if (currentMinutes <= eArrive) {
    const pos = getCurrentStation(evening, currentMinutes)
    return {
      type: 'in-transit',
      schedule: evening,
      progress: (currentMinutes - eDepart) / (eArrive - eDepart),
      destination: evening.stops[evening.stops.length - 1].station,
      currentStation: pos.current,
      nextStation: pos.next,
      nextArrival: pos.nextArr,
      arrivalTime: evening.stops[evening.stops.length - 1].arrive!,
    }
  }

  // After last service — show next morning
  const remaining = (24 * 60 - currentMinutes + mDepart) * 60 - currentSeconds
  return {
    type: 'waiting',
    schedule: morning,
    remaining,
    origin: morning.stops[0].station,
    destination: morning.stops[morning.stops.length - 1].station,
    departTime: morning.stops[0].depart!,
    tomorrow: true,
  }
}

// ─── Flip-digit component ────────────────────────────────

function FlipDigit({ digit, s }: { digit: string; s: ReturnType<typeof getStyles> }) {
  return (
    <View style={s.digit}>
      <Text style={s.digitText}>{digit}</Text>
    </View>
  )
}

// ─── Main screen ─────────────────────────────────────────

export default function TrainLinesScreen() {
  const router = useRouter()
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const t = themed(isDark)
  const s = getStyles(isDark)

  const { lines, isLoading, refetch } = useTrainLines()

  // Live clock — ticks every second (Ghana time)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const scheduleCode = useMemo(() => {
    if (lines.length > 0 && TRAIN_SCHEDULES[lines[0].code]) return lines[0].code
    return Object.keys(TRAIN_SCHEDULES)[0] || null
  }, [lines])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const departure = useMemo(() => {
    if (!scheduleCode) return null
    return computeDeparture(TRAIN_SCHEDULES[scheduleCode])
  }, [scheduleCode, tick])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const currentTime = useMemo(() => formatGhanaTime(), [tick])

  const renderLine = useCallback(
    (item: TrainLineWithStats) => (
      <TouchableOpacity
        key={item.id}
        onPress={() =>
          router.push({ pathname: '/train/[lineId]', params: { lineId: item.id } })
        }
        activeOpacity={0.7}
        style={s.card}
      >
        <View style={[s.accentBar, { backgroundColor: item.color }]} />
        <View style={s.cardBody}>
          <View style={s.cardTop}>
            <View style={[s.iconBox, { backgroundColor: `${item.color}20` }]}>
              <TrainFront size={22} color={item.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.lineName}>{item.name}</Text>
              <Text style={s.lineCode}>{item.code}</Text>
            </View>
            <ChevronRight size={20} color={t.textTertiary} />
          </View>
          <View style={s.statsRow}>
            <View style={s.stat}>
              <MapPin size={14} color={t.textTertiary} />
              <Text style={s.statText}>{item.station_count} stations</Text>
            </View>
            <View style={s.stat}>
              <BarChart3 size={14} color={t.textTertiary} />
              <Text style={s.statText}>{item.stats?.total_reports ?? 0} reports</Text>
            </View>
            {item.official_fare != null && (
              <View style={s.fareBadge}>
                <Text style={s.fareText}>₵{item.official_fare.toFixed(2)}</Text>
              </View>
            )}
          </View>
          {item.stats?.last_report_at && (
            <Text style={s.lastReport}>
              Last report {timeAgo(item.stats.last_report_at)}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    ),
    [isDark, s, t, router]
  )

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
        {/* ─── Departure Board ─────────────────────────── */}
        {departure && (
          <View style={s.board}>
            <View style={s.boardGlow} />

            {/* Top row */}
            <View style={s.boardTopRow}>
              <View style={s.liveBadge}>
                <View style={s.liveDot} />
                <Text style={s.liveText}>LIVE</Text>
              </View>
              <View style={{ flex: 1 }} />
              <Text style={s.boardLabel}>
                {departure.type === 'in-transit' ? 'IN TRANSIT' : 'DEPARTURES'}
              </Text>
              <Clock
                size={12}
                color="rgba(255,255,255,0.5)"
                style={{ marginLeft: 6, marginRight: 4 }}
              />
              <Text style={s.boardTime}>{currentTime}</Text>
            </View>

            {/* ── Waiting state — countdown ── */}
            {departure.type === 'waiting' && (
              <>
                <View style={s.clockRow}>
                  {(() => {
                    const h = String(Math.floor(departure.remaining / 3600)).padStart(2, '0')
                    const m = String(
                      Math.floor((departure.remaining % 3600) / 60)
                    ).padStart(2, '0')
                    const sec = String(departure.remaining % 60).padStart(2, '0')
                    return (
                      <>
                        <View style={s.clockGroup}>
                          <View style={s.digitPair}>
                            <FlipDigit digit={h[0]} s={s} />
                            <FlipDigit digit={h[1]} s={s} />
                          </View>
                          <Text style={s.clockUnit}>HRS</Text>
                        </View>
                        <Text style={s.clockColon}>:</Text>
                        <View style={s.clockGroup}>
                          <View style={s.digitPair}>
                            <FlipDigit digit={m[0]} s={s} />
                            <FlipDigit digit={m[1]} s={s} />
                          </View>
                          <Text style={s.clockUnit}>MIN</Text>
                        </View>
                        <Text style={s.clockColon}>:</Text>
                        <View style={s.clockGroup}>
                          <View style={s.digitPair}>
                            <FlipDigit digit={sec[0]} s={s} />
                            <FlipDigit digit={sec[1]} s={s} />
                          </View>
                          <Text style={s.clockUnit}>SEC</Text>
                        </View>
                      </>
                    )
                  })()}
                </View>

                <View style={s.depInfo}>
                  <View style={s.depCodeBadge}>
                    <Text style={s.depCodeText}>{departure.schedule.code}</Text>
                  </View>
                  <Text style={s.depLabel}>{departure.schedule.label}</Text>
                </View>

                <View style={s.depRoute}>
                  <Text style={s.depStation}>{departure.origin}</Text>
                  <ArrowRight size={14} color="rgba(255,255,255,0.4)" />
                  <Text style={s.depStation}>{departure.destination}</Text>
                </View>

                <View style={s.depFooter}>
                  <Text style={s.depTime}>
                    Departs {departure.departTime}
                    {departure.tomorrow ? ' tomorrow' : ''}
                  </Text>
                  <View style={s.onTimeBadge}>
                    <View style={[s.statusDot, { backgroundColor: '#22c55e' }]} />
                    <Text style={s.onTimeText}>On Time</Text>
                  </View>
                </View>
              </>
            )}

            {/* ── In-transit state — progress ── */}
            {departure.type === 'in-transit' && (
              <>
                <View style={s.transitSection}>
                  <View style={s.progressTrack}>
                    <View
                      style={[
                        s.progressFill,
                        { width: `${Math.min(departure.progress * 100, 100)}%` as any },
                      ]}
                    />
                    <View
                      style={[
                        s.progressDot,
                        { left: `${Math.min(departure.progress * 100, 100)}%` as any },
                      ]}
                    />
                  </View>
                  <View style={s.transitEndpoints}>
                    <Text style={s.transitEndpoint}>
                      {departure.schedule.stops[0].station}
                    </Text>
                    <Text style={s.transitEndpoint}>{departure.destination}</Text>
                  </View>
                </View>

                <View style={s.depInfo}>
                  <View style={[s.depCodeBadge, { backgroundColor: 'rgba(14,165,233,0.25)' }]}>
                    <Text style={s.depCodeText}>{departure.schedule.code}</Text>
                  </View>
                  <Text style={s.depLabel}>{departure.schedule.label}</Text>
                </View>

                <View style={s.transitDetails}>
                  <View style={s.transitRow}>
                    <View style={s.transitLiveDot} />
                    <Text style={s.transitText}>
                      At{' '}
                      <Text style={s.transitHighlight}>{departure.currentStation}</Text>
                    </Text>
                  </View>
                  {departure.nextStation && (
                    <View style={s.transitRow}>
                      <ArrowRight size={12} color="rgba(255,255,255,0.35)" />
                      <Text style={s.transitText}>
                        Next:{' '}
                        <Text style={s.transitHighlight}>{departure.nextStation}</Text>
                        {departure.nextArrival ? ` · ${departure.nextArrival}` : ''}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={s.depFooter}>
                  <Text style={s.depTime}>
                    Arriving {departure.destination} at {departure.arrivalTime}
                  </Text>
                  <View style={s.transitBadge}>
                    <View style={[s.statusDot, { backgroundColor: '#0ea5e9' }]} />
                    <Text style={s.transitBadgeText}>In Transit</Text>
                  </View>
                </View>
              </>
            )}

            {/* ── No service state ── */}
            {departure.type === 'no-service' && (
              <View style={s.noService}>
                <TrainFront size={32} color="rgba(255,255,255,0.25)" />
                <Text style={s.noServiceTitle}>No Service Today</Text>
                <Text style={s.noServiceSub}>Sunday · Resumes Monday 06:00</Text>
              </View>
            )}

            {/* Bottom info strip */}
            <View style={s.boardStrip}>
              <Text style={s.stripText}>Mon – Sat</Text>
              <View style={s.stripDot} />
              <Text style={s.stripText}>GH₵5.00</Text>
              <View style={s.stripDot} />
              <Text style={s.stripText}>360 seats</Text>
            </View>
          </View>
        )}

        {/* ─── Train Lines ─────────────────────────────── */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <TrainFront size={16} color="#0ea5e9" />
            <Text style={s.sectionTitle}>Lines</Text>
          </View>

          {isLoading ? (
            <View style={s.centered}>
              <ActivityIndicator size="large" color="#0ea5e9" />
            </View>
          ) : lines.length === 0 ? (
            <View style={s.emptyCard}>
              <TrainFront size={40} color={t.textTertiary} />
              <Text style={s.emptyTitle}>No train lines yet</Text>
              <Text style={s.emptySub}>
                Train lines will appear here once available
              </Text>
            </View>
          ) : (
            <View style={{ gap: 14 }}>{lines.map(renderLine)}</View>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

// ─── Styles ──────────────────────────────────────────────

const getStyles = (isDark: boolean) => {
  const t = themed(isDark)
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    centered: { padding: 40, alignItems: 'center', justifyContent: 'center' },

    // ── Departure Board (always dark — like a real station display) ──
    board: {
      backgroundColor: '#0c1220',
      margin: 16,
      marginTop: 8,
      borderRadius: 24,
      padding: 20,
      overflow: 'hidden',
    },
    boardGlow: {
      position: 'absolute',
      top: -30,
      right: -30,
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: 'rgba(14,165,233,0.06)',
    },
    boardTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 20,
    },
    liveBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(34,197,94,0.15)',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
      gap: 5,
    },
    liveDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: '#22c55e',
    },
    liveText: {
      fontSize: 10,
      fontFamily: font.bold,
      color: '#22c55e',
      letterSpacing: 1,
    },
    boardLabel: {
      fontSize: 10,
      fontFamily: font.bold,
      color: 'rgba(255,255,255,0.4)',
      letterSpacing: 1.5,
    },
    boardTime: {
      fontSize: 13,
      fontFamily: font.semibold,
      color: 'rgba(255,255,255,0.6)',
    },

    // ── Flip Clock ──
    clockRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'center',
      marginBottom: 24,
      gap: 6,
    },
    clockGroup: { alignItems: 'center' },
    digitPair: { flexDirection: 'row', gap: 4 },
    digit: {
      width: 38,
      height: 52,
      borderRadius: 10,
      backgroundColor: '#1a2535',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.06)',
    },
    digitText: {
      fontSize: 28,
      fontFamily: font.bold,
      color: '#e2e8f0',
      includeFontPadding: false,
    },
    clockColon: {
      fontSize: 28,
      fontFamily: font.bold,
      color: '#0ea5e9',
      marginTop: 8,
      marginHorizontal: 2,
    },
    clockUnit: {
      fontSize: 9,
      fontFamily: font.bold,
      color: 'rgba(255,255,255,0.3)',
      letterSpacing: 2,
      marginTop: 6,
    },

    // ── Departure info ──
    depInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 8,
    },
    depCodeBadge: {
      backgroundColor: 'rgba(255,255,255,0.1)',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    depCodeText: {
      fontSize: 12,
      fontFamily: font.bold,
      color: '#0ea5e9',
      letterSpacing: 1,
    },
    depLabel: {
      fontSize: 14,
      fontFamily: font.semibold,
      color: 'rgba(255,255,255,0.85)',
    },
    depRoute: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12,
    },
    depStation: {
      fontSize: 13,
      fontFamily: font.medium,
      color: 'rgba(255,255,255,0.5)',
    },
    depFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    depTime: {
      fontSize: 12,
      fontFamily: font.regular,
      color: 'rgba(255,255,255,0.4)',
    },
    onTimeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(34,197,94,0.15)',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      gap: 5,
    },
    onTimeText: {
      fontSize: 11,
      fontFamily: font.semibold,
      color: '#22c55e',
    },
    statusDot: { width: 6, height: 6, borderRadius: 3 },

    // ── In-transit ──
    transitSection: { marginBottom: 20 },
    progressTrack: {
      height: 4,
      backgroundColor: 'rgba(255,255,255,0.1)',
      borderRadius: 2,
      marginBottom: 8,
      position: 'relative',
    },
    progressFill: {
      position: 'absolute',
      top: 0,
      left: 0,
      height: 4,
      backgroundColor: '#0ea5e9',
      borderRadius: 2,
    },
    progressDot: {
      position: 'absolute',
      top: -4,
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: '#0ea5e9',
      borderWidth: 2,
      borderColor: '#0c1220',
      marginLeft: -6,
    },
    transitEndpoints: { flexDirection: 'row', justifyContent: 'space-between' },
    transitEndpoint: {
      fontSize: 11,
      fontFamily: font.regular,
      color: 'rgba(255,255,255,0.35)',
    },
    transitDetails: { gap: 6, marginBottom: 12 },
    transitRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    transitLiveDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#22c55e',
    },
    transitText: {
      fontSize: 13,
      fontFamily: font.regular,
      color: 'rgba(255,255,255,0.5)',
    },
    transitHighlight: {
      fontFamily: font.semibold,
      color: 'rgba(255,255,255,0.85)',
    },
    transitBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(14,165,233,0.2)',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      gap: 5,
    },
    transitBadgeText: {
      fontSize: 11,
      fontFamily: font.semibold,
      color: '#0ea5e9',
    },

    // ── No service ──
    noService: { alignItems: 'center', paddingVertical: 24, gap: 8 },
    noServiceTitle: {
      fontSize: 18,
      fontFamily: font.bold,
      color: 'rgba(255,255,255,0.6)',
    },
    noServiceSub: {
      fontSize: 13,
      fontFamily: font.regular,
      color: 'rgba(255,255,255,0.3)',
    },

    // ── Board info strip ──
    boardStrip: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 16,
      paddingTop: 14,
      borderTopWidth: 1,
      borderTopColor: 'rgba(255,255,255,0.06)',
      gap: 8,
    },
    stripText: {
      fontSize: 11,
      fontFamily: font.medium,
      color: 'rgba(255,255,255,0.3)',
    },
    stripDot: {
      width: 3,
      height: 3,
      borderRadius: 1.5,
      backgroundColor: 'rgba(255,255,255,0.2)',
    },

    // ── Section ──
    section: { paddingHorizontal: 20, paddingTop: 20 },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 14,
    },
    sectionTitle: { fontSize: 16, fontFamily: font.bold, color: t.text },

    // ── Line Cards ──
    card: {
      borderRadius: 20,
      backgroundColor: t.card,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: t.border,
    },
    accentBar: { height: 4 },
    cardBody: { padding: 16 },
    cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    iconBox: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    lineName: { fontSize: 16, fontFamily: font.semibold, color: t.text },
    lineCode: {
      fontSize: 12,
      fontFamily: font.regular,
      color: t.textSecondary,
      marginTop: 1,
    },
    statsRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    statText: { fontSize: 13, fontFamily: font.regular, color: t.textSecondary },
    fareBadge: {
      marginLeft: 'auto',
      backgroundColor: isDark ? 'rgba(14,165,233,0.15)' : 'rgba(14,165,233,0.1)',
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 10,
    },
    fareText: { color: '#0ea5e9', fontSize: 12, fontFamily: font.semibold },
    lastReport: {
      fontSize: 12,
      fontFamily: font.regular,
      color: t.textTertiary,
      marginTop: 8,
    },

    // ── Empty ──
    emptyCard: {
      padding: 32,
      borderRadius: 20,
      backgroundColor: t.card,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: t.border,
    },
    emptyTitle: {
      fontSize: 16,
      fontFamily: font.semibold,
      color: t.textSecondary,
      marginTop: 12,
    },
    emptySub: {
      fontSize: 13,
      fontFamily: font.regular,
      color: t.textTertiary,
      marginTop: 4,
      textAlign: 'center',
    },
  })
}
