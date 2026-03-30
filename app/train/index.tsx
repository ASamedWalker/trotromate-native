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
  type DimensionValue,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import {
  TrainFront,
  MapPin,
  Clock,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react-native'
import { font } from '@/lib/theme'
import { DailyTipCard } from '@/components/DailyTipCard'
import { GRDABadge } from '@/components/GRDABadge'
import { useTrainLines } from '@/lib/hooks/useTrain'
import { getGhanaTime, formatGhanaTime } from '@/lib/utils/time'
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
      lineCode: string
      schedule: TrainSchedule
      remaining: number
      origin: string
      destination: string
      departTime: string
      tomorrow?: boolean
    }
  | {
      type: 'in-transit'
      lineCode: string
      schedule: TrainSchedule
      progress: number
      destination: string
      currentStation: string
      nextStation: string | null
      nextArrival: string | null
      arrivalTime: string
    }
  | { type: 'no-service' }

/** Compute next departure for a single line (direction-agnostic) */
function computeLineDeparture(
  lineCode: string,
  schedules: TrainSchedule[]
): DepartureInfo {
  const ghana = getGhanaTime()
  const day = ghana.day
  const currentMinutes = ghana.hours * 60 + ghana.minutes
  const currentSeconds = ghana.seconds
  const totalSeconds = currentMinutes * 60 + currentSeconds

  if (day === 0 || schedules.length === 0) return { type: 'no-service' }

  const sorted = [...schedules].sort(
    (a, b) => parseTimeToMinutes(a.stops[0].depart!) - parseTimeToMinutes(b.stops[0].depart!)
  )

  for (const sched of sorted) {
    const depart = parseTimeToMinutes(sched.stops[0].depart!)
    const arrive = parseTimeToMinutes(sched.stops[sched.stops.length - 1].arrive!)

    if (currentMinutes < depart) {
      return {
        type: 'waiting',
        lineCode,
        schedule: sched,
        remaining: depart * 60 - totalSeconds,
        origin: sched.stops[0].station,
        destination: sched.stops[sched.stops.length - 1].station,
        departTime: sched.stops[0].depart!,
      }
    }

    if (currentMinutes <= arrive) {
      const pos = getCurrentStation(sched, currentMinutes)
      return {
        type: 'in-transit',
        lineCode,
        schedule: sched,
        progress: (currentMinutes - depart) / (arrive - depart),
        destination: sched.stops[sched.stops.length - 1].station,
        currentStation: pos.current,
        nextStation: pos.next,
        nextArrival: pos.nextArr,
        arrivalTime: sched.stops[sched.stops.length - 1].arrive!,
      }
    }
  }

  const first = sorted[0]
  const firstDepart = parseTimeToMinutes(first.stops[0].depart!)
  const remaining = (24 * 60 - currentMinutes + firstDepart) * 60 - currentSeconds
  return {
    type: 'waiting',
    lineCode,
    schedule: first,
    remaining,
    origin: first.stops[0].station,
    destination: first.stops[first.stops.length - 1].station,
    departTime: first.stops[0].depart!,
    tomorrow: true,
  }
}

function getNextDeparture(): DepartureInfo {
  const codes = Object.keys(TRAIN_SCHEDULES)
  let bestWaiting: Extract<DepartureInfo, { type: 'waiting' }> | null = null
  let firstInTransit: Extract<DepartureInfo, { type: 'in-transit' }> | null = null

  for (const code of codes) {
    const dep = computeLineDeparture(code, TRAIN_SCHEDULES[code])
    if (dep.type === 'in-transit' && !firstInTransit) {
      firstInTransit = dep
    } else if (dep.type === 'waiting') {
      if (!bestWaiting || dep.remaining < bestWaiting.remaining) {
        bestWaiting = dep
      }
    }
  }

  if (firstInTransit) return firstInTransit
  if (bestWaiting) return bestWaiting
  return { type: 'no-service' }
}

// ─── Flip-digit component ────────────────────────────────

function FlipDigit({ digit, s }: { digit: string; s: ReturnType<typeof getStyles> }) {
  return (
    <View style={s.digit}>
      <Text style={s.digitText}>{digit}</Text>
    </View>
  )
}

// ─── Line metadata for editorial cards ───────────────────

const LINE_META: Record<string, { subtitle: string; fareRange: string; badgeColor: string; badgeBg: string; gradientFrom: string; gradientTo: string }> = {
  TMA: {
    subtitle: 'Suburban Commuter',
    fareRange: '₵15',
    badgeColor: '#0e7490',
    badgeBg: '#ecfeff',
    gradientFrom: '#06b6d4',
    gradientTo: '#1d4ed8',
  },
  TMP: {
    subtitle: 'Inter-Regional',
    fareRange: '₵40',
    badgeColor: '#92400e',
    badgeBg: '#fffbeb',
    gradientFrom: '#f59e0b',
    gradientTo: '#ea580c',
  },
}

const DEFAULT_LINE_META = {
  subtitle: 'Rail Service',
  fareRange: '—',
  badgeColor: '#0e7490',
  badgeBg: '#ecfeff',
  gradientFrom: '#06b6d4',
  gradientTo: '#1d4ed8',
}

// ─── Main screen ─────────────────────────────────────────

export default function TrainLinesScreen() {
  const router = useRouter()
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const s = getStyles(isDark)

  const { lines, isLoading, refetch } = useTrainLines()

  // Live clock — ticks every second (Ghana time)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const departure = useMemo(() => getNextDeparture(), [tick])

  const lineColor = useMemo(() => {
    if (departure.type === 'no-service') return '#0ea5e9'
    const line = lines.find((l) => l.code === departure.lineCode)
    return line?.color || '#0ea5e9'
  }, [departure, lines])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const currentTime = useMemo(() => formatGhanaTime(), [tick])

  // Compute per-line departure status for occupancy indicators
  const lineDepartures = useMemo(() => {
    const map: Record<string, DepartureInfo> = {}
    for (const code of Object.keys(TRAIN_SCHEDULES)) {
      map[code] = computeLineDeparture(code, TRAIN_SCHEDULES[code])
    }
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick])

  const renderLineCard = useCallback(
    (item: TrainLineWithStats) => {
      const meta = LINE_META[item.code] ?? DEFAULT_LINE_META
      const dep = lineDepartures[item.code]
      const isInTransit = dep?.type === 'in-transit'
      const isWaiting = dep?.type === 'waiting'

      return (
        <TouchableOpacity
          key={item.id}
          onPress={() =>
            router.push({ pathname: '/train/[lineId]', params: { lineId: item.id } })
          }
          activeOpacity={0.85}
          style={s.lineCard}
        >
          {/* Card content */}
          <View style={s.lineCardBody}>
            {/* Top: badge + title + shield */}
            <View style={s.lineCardTop}>
              <View style={{ flex: 1 }}>
                <View style={[s.lineBadge, { backgroundColor: meta.badgeBg }]}>
                  <Text style={[s.lineBadgeText, { color: meta.badgeColor }]}>
                    Line {item.code}
                  </Text>
                </View>
                <Text style={s.lineTitle}>{item.name}</Text>
                <Text style={s.lineSubtitle}>{meta.subtitle}</Text>
              </View>
              <View style={s.shieldBox}>
                <ShieldCheck size={22} color="#fff" />
              </View>
            </View>

            {/* Stats row: fare + occupancy */}
            <View style={s.lineStatsRow}>
              <View style={s.lineStat}>
                <Text style={s.lineStatLabel}>OFFICIAL FARE</Text>
                <Text style={s.lineStatValue}>{meta.fareRange}</Text>
              </View>
              <View style={s.lineStatDivider} />
              <View style={s.lineStat}>
                <Text style={s.lineStatLabel}>STATUS</Text>
                <View style={s.occupancyRow}>
                  <View style={[s.occupancyDot, {
                    backgroundColor: isInTransit ? '#22c55e' : isWaiting ? '#f59e0b' : '#9ca3af',
                  }]} />
                  <Text style={[s.occupancyText, {
                    color: isInTransit
                      ? (isDark ? '#4ade80' : '#15803d')
                      : isWaiting
                        ? (isDark ? '#fbbf24' : '#92400e')
                        : (isDark ? '#9ca3af' : '#6b7280'),
                  }]}>
                    {isInTransit ? 'In Transit' : isWaiting ? 'Next Service' : 'No Service'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Actions row */}
            <View style={s.lineActions}>
              <TouchableOpacity
                onPress={() =>
                  router.push({ pathname: '/train/[lineId]', params: { lineId: item.id } })
                }
                activeOpacity={0.85}
                style={s.lineActionPrimary}
              >
                <LinearGradient
                  colors={['#815100', '#f8a010']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={s.lineActionPrimaryGradient}
                >
                  <Text style={s.lineActionPrimaryText}>View Schedule</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() =>
                  router.push({ pathname: '/train/[lineId]', params: { lineId: item.id } })
                }
                activeOpacity={0.7}
                style={s.lineActionIcon}
              >
                <MapPin size={20} color={isDark ? '#a8a29e' : '#815100'} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Bottom gradient strip */}
          <LinearGradient
            colors={[meta.gradientFrom, meta.gradientTo]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.lineCardStrip}
          >
            <View style={s.lineCardStripContent}>
              <GRDABadge size="small" />
              <Text style={s.lineCardStripText}>GRDA Official</Text>
              <View style={s.lineCardStripDot} />
              <Text style={s.lineCardStripText}>{item.station_count} stations</Text>
              <View style={s.lineCardStripDot} />
              <Text style={s.lineCardStripText}>
                {item.stats?.total_reports ?? 0} reports
              </Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      )
    },
    [isDark, s, lineDepartures, router]
  )

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      {/* GRDA Header Bar */}
      <LinearGradient
        colors={['#0891b2', '#1e40af']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={s.headerBar}
      >
        <View style={s.headerLogo}>
          <ShieldCheck size={18} color="#fff" />
        </View>
        <Text style={s.headerTitle}>GRDA Official</Text>
        <View style={{ flex: 1 }} />
        <Clock size={14} color="rgba(255,255,255,0.6)" />
        <Text style={s.headerTime}>{currentTime}</Text>
      </LinearGradient>

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
        {/* ─── Hero Section ──────────────────────────────── */}
        <View style={s.hero}>
          <Text style={s.heroLabel}>NATIONAL TRANSIT NETWORK</Text>
          <Text style={s.heroTitle}>Train Index</Text>
          <Text style={s.heroDesc}>
            Select a regional rail line to view live schedules and fare info.
          </Text>
        </View>

        {/* ─── Departure Board ─────────────────────────── */}
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
                      { width: `${Math.min(departure.progress * 100, 100)}%` as DimensionValue },
                    ]}
                  />
                  <View
                    style={[
                      s.progressDot,
                      { left: `${Math.min(departure.progress * 100, 100)}%` as DimensionValue },
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
            <GRDABadge size="small" />
            <Text style={s.stripText}>GRDA Official</Text>
            <View style={s.stripDot} />
            <Text style={s.stripText}>Mon – Sat</Text>
            {departure.type !== 'no-service' && (
              <>
                <View style={s.stripDot} />
                <View style={[s.stripLineDot, { backgroundColor: lineColor }]} />
                <Text style={s.stripText}>{departure.lineCode}</Text>
                <View style={s.stripDot} />
                <Text style={s.stripText}>
                  GH₵{departure.schedule.fare.toFixed(2)}
                </Text>
              </>
            )}
          </View>
        </View>

        {/* ─── Rail Line Cards ─────────────────────────── */}
        <View style={s.section}>
          {isLoading ? (
            <View style={s.centered}>
              <ActivityIndicator size="large" color="#0ea5e9" />
            </View>
          ) : lines.length === 0 ? (
            <View style={s.emptyCard}>
              <TrainFront size={40} color={isDark ? '#57534e' : '#a8a29e'} />
              <Text style={s.emptyTitle}>No train lines yet</Text>
              <Text style={s.emptySub}>
                Train lines will appear here once available
              </Text>
            </View>
          ) : (
            <View style={{ gap: 24 }}>{lines.map(renderLineCard)}</View>
          )}
        </View>

        {/* ─── Authority Bulletins ─────────────────────── */}
        <View style={s.bulletinSection}>
          <View style={s.bulletinHeader}>
            <Text style={s.bulletinTitle}>Authority Bulletins</Text>
          </View>

          <View style={[s.bulletinCard, { borderLeftColor: '#815100' }]}>
            <Text style={[s.bulletinType, { color: '#815100' }]}>SERVICE NOTICE</Text>
            <Text style={s.bulletinText}>
              All train services operate Monday – Saturday. No Sunday service.
            </Text>
          </View>

          <View style={[s.bulletinCard, { borderLeftColor: '#0891b2' }]}>
            <Text style={[s.bulletinType, { color: '#0891b2' }]}>GRDA REMINDER</Text>
            <Text style={s.bulletinText}>
              Always purchase tickets before boarding. E-tickets coming soon.
            </Text>
          </View>
        </View>

        {/* Daily Commuter Tip — train-focused */}
        <View style={s.tipCard}>
          <DailyTipCard category="train" />
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

// ─── Styles ──────────────────────────────────────────────

const getStyles = (isDark: boolean) => {
  const surface = isDark ? '#1c1c1e' : '#fcf5f2'
  const surfaceLowest = isDark ? '#1c1c1e' : '#ffffff'
  const surfaceLow = isDark ? 'rgba(255,255,255,0.04)' : '#f6efed'
  const onSurface = isDark ? '#f5f5f4' : '#312e2d'
  const onSurfaceVariant = isDark ? 'rgba(255,255,255,0.5)' : '#5f5b59'
  const outlineVariant = isDark ? 'rgba(255,255,255,0.1)' : '#b2acaa'

  return StyleSheet.create({
    container: { flex: 1, backgroundColor: surface },
    centered: { padding: 40, alignItems: 'center', justifyContent: 'center' },

    // ── GRDA Header Bar ──
    headerBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 8,
    },
    headerLogo: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: 'rgba(255,255,255,0.2)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 16,
      fontFamily: font.extrabold,
      color: '#fff',
      letterSpacing: -0.5,
    },
    headerTime: {
      fontSize: 13,
      fontFamily: font.semibold,
      color: 'rgba(255,255,255,0.7)',
      marginLeft: 4,
    },

    // ── Hero Section ──
    hero: {
      paddingHorizontal: 24,
      paddingTop: 20,
      paddingBottom: 8,
    },
    heroLabel: {
      fontSize: 10,
      fontFamily: font.bold,
      color: '#815100',
      letterSpacing: 2,
      marginBottom: 6,
    },
    heroTitle: {
      fontSize: 36,
      fontFamily: font.extrabold,
      color: onSurface,
      letterSpacing: -1,
      lineHeight: 40,
      marginBottom: 8,
    },
    heroDesc: {
      fontSize: 14,
      fontFamily: font.regular,
      color: onSurfaceVariant,
      lineHeight: 20,
      maxWidth: 280,
    },

    // ── Departure Board (always dark — like a real station display) ──
    board: {
      backgroundColor: '#0c1220',
      marginHorizontal: 16,
      marginTop: 16,
      borderRadius: 24,
      padding: 20,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.18,
      shadowRadius: 12,
      elevation: 6,
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
    stripLineDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },

    // ── Section ──
    section: { paddingHorizontal: 20, paddingTop: 24 },

    // ── Editorial Line Cards ──
    lineCard: {
      borderRadius: 24,
      backgroundColor: surfaceLowest,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 3,
    },
    lineCardBody: {
      padding: 24,
      gap: 20,
    },
    lineCardTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    lineBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 20,
      marginBottom: 8,
    },
    lineBadgeText: {
      fontSize: 10,
      fontFamily: font.bold,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    lineTitle: {
      fontSize: 24,
      fontFamily: font.extrabold,
      color: onSurface,
      letterSpacing: -0.5,
      lineHeight: 28,
    },
    lineSubtitle: {
      fontSize: 13,
      fontFamily: font.medium,
      color: onSurfaceVariant,
      marginTop: 2,
    },
    shieldBox: {
      width: 40,
      height: 40,
      borderRadius: 14,
      backgroundColor: '#1e40af',
      alignItems: 'center',
      justifyContent: 'center',
    },

    // Stats row
    lineStatsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 20,
    },
    lineStat: {
      gap: 4,
    },
    lineStatLabel: {
      fontSize: 10,
      fontFamily: font.bold,
      color: onSurfaceVariant,
      letterSpacing: 1.5,
    },
    lineStatValue: {
      fontSize: 18,
      fontFamily: font.bold,
      color: onSurface,
    },
    lineStatDivider: {
      width: 1,
      height: 32,
      backgroundColor: outlineVariant,
    },
    occupancyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    occupancyDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    occupancyText: {
      fontSize: 14,
      fontFamily: font.semibold,
    },

    // Action buttons
    lineActions: {
      flexDirection: 'row',
      gap: 10,
    },
    lineActionPrimary: {
      flex: 1,
      borderRadius: 16,
      overflow: 'hidden',
    },
    lineActionPrimaryGradient: {
      paddingVertical: 14,
      alignItems: 'center',
      borderRadius: 16,
    },
    lineActionPrimaryText: {
      fontSize: 14,
      fontFamily: font.bold,
      color: '#fff',
    },
    lineActionIcon: {
      width: 48,
      height: 48,
      borderRadius: 16,
      backgroundColor: surfaceLow,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: outlineVariant,
    },

    // Bottom gradient strip
    lineCardStrip: {
      paddingVertical: 10,
      paddingHorizontal: 20,
    },
    lineCardStripContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    lineCardStripText: {
      fontSize: 11,
      fontFamily: font.medium,
      color: 'rgba(255,255,255,0.8)',
    },
    lineCardStripDot: {
      width: 3,
      height: 3,
      borderRadius: 1.5,
      backgroundColor: 'rgba(255,255,255,0.4)',
    },

    // ── Authority Bulletins ──
    bulletinSection: {
      paddingHorizontal: 20,
      paddingTop: 32,
      gap: 12,
    },
    bulletinHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    bulletinTitle: {
      fontSize: 20,
      fontFamily: font.bold,
      color: onSurface,
      letterSpacing: -0.3,
    },
    bulletinCard: {
      backgroundColor: surfaceLow,
      borderRadius: 16,
      padding: 16,
      borderLeftWidth: 4,
    },
    bulletinType: {
      fontSize: 9,
      fontFamily: font.bold,
      letterSpacing: 1.5,
      marginBottom: 4,
    },
    bulletinText: {
      fontSize: 14,
      fontFamily: font.semibold,
      color: onSurface,
      lineHeight: 20,
    },

    // ── Daily Tip ──
    tipCard: {
      marginHorizontal: 20,
      marginTop: 24,
      borderRadius: 20,
      backgroundColor: surfaceLowest,
      borderWidth: 1,
      borderColor: outlineVariant,
      overflow: 'hidden',
    },

    // ── Empty ──
    emptyCard: {
      padding: 32,
      borderRadius: 20,
      backgroundColor: surfaceLowest,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: outlineVariant,
    },
    emptyTitle: {
      fontSize: 16,
      fontFamily: font.semibold,
      color: onSurfaceVariant,
      marginTop: 12,
    },
    emptySub: {
      fontSize: 13,
      fontFamily: font.regular,
      color: onSurfaceVariant,
      marginTop: 4,
      textAlign: 'center',
    },
  })
}
