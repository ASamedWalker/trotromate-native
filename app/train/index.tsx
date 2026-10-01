import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  useColorScheme,
  RefreshControl,
  StyleSheet,
  Animated as RNAnimated,
  Easing,
  type DimensionValue,
} from 'react-native'
import * as Haptics from 'expo-haptics'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { SkeletonTrainCard } from '@/components/Skeleton'
import { HeroText } from '@/components/HeroText'
import { useRouter } from 'expo-router'
import {
  TrainFront,
  Clock,
  ArrowRight,
  ShieldCheck,
  Bell,
  BellRing,
} from 'lucide-react-native'
import { font, brand, ui, space, radius, type, cardShadow } from '@/lib/theme'
import { Badge, Button, SectionHeader } from '@/components/ui'
import { dur } from '@/lib/motion'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { DailyTipCard } from '@/components/DailyTipCard'
import { GRDABadge } from '@/components/GRDABadge'
import { useTrainLines } from '@/lib/hooks/useTrain'
import { useDepartureReminders } from '@/lib/hooks/useDepartureReminders'
import { REMINDER_LEAD_MINUTES, showReminderFailureAlert } from '@/lib/services/trainReminders'
import { getGhanaTime, formatGhanaTime } from '@/lib/utils/time'
import { formatGHS } from '@/lib/utils/currency'
import { TRAIN_SCHEDULES, type TrainSchedule } from '@/lib/constants/train-schedule'
import { NETWORK_BULLETINS, HOW_TO_RIDE, LINE_STATUS } from '@/lib/constants/train-network'
import { TAB_BAR_CLEARANCE } from '@/app/(tabs)/_layout'
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

export type DepartureInfo =
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
export function computeLineDeparture(
  lineCode: string,
  schedules: TrainSchedule[]
): DepartureInfo {
  const ghana = getGhanaTime()
  const day = ghana.day
  const currentMinutes = ghana.hours * 60 + ghana.minutes
  const currentSeconds = ghana.seconds
  const totalSeconds = currentMinutes * 60 + currentSeconds

  if (schedules.length === 0) return { type: 'no-service' }

  // Check if any schedule runs today
  const isSunday = day === 0
  const isSaturday = day === 6
  const hasWeekdayOnly = schedules.every((s) => s.days.includes('Fri') && !s.days.includes('Sat'))
  const hasNoSunday = schedules.every((s) => !s.days.includes('Sun'))

  if (isSunday && hasNoSunday) return { type: 'no-service' }
  if (isSaturday && hasWeekdayOnly) return { type: 'no-service' }

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

  // Today's runs are done — count down to the NEXT SERVICE DAY, not blindly to
  // tomorrow: Saturday night must roll to Monday (Sunday has no service), and
  // weekday-only lines must skip Saturday too. Otherwise the board (and the
  // reminder button armed from it) targets a phantom Sunday train.
  const first = sorted[0]
  const firstDepart = parseTimeToMinutes(first.stops[0].depart!)
  const serviceMax = hasWeekdayOnly ? 5 : 6 // last weekday with service (Fri or Sat)
  let daysAhead = 1
  let d = (day + 1) % 7
  while (d === 0 || d > serviceMax) {
    daysAhead++
    d = (d + 1) % 7
  }
  const remaining = (daysAhead * 24 * 60 - currentMinutes + firstDepart) * 60 - currentSeconds
  return {
    type: 'waiting',
    lineCode,
    schedule: first,
    remaining,
    origin: first.stops[0].station,
    destination: first.stops[first.stops.length - 1].station,
    departTime: first.stops[0].depart!,
    tomorrow: daysAhead === 1,
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
  // Core RN Animated (NOT reanimated — this sits inside a ScrollView, which
  // breaks reanimated width on Android). On each digit change the new glyph
  // ticks down into place with a quick slide + fade, like a mechanical board.
  const anim = useRef(new RNAnimated.Value(1)).current
  const prev = useRef(digit)

  useEffect(() => {
    if (prev.current === digit) return
    prev.current = digit
    anim.setValue(0)
    RNAnimated.timing(anim, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()
  }, [digit, anim])

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] })

  return (
    <View style={s.digit}>
      <RNAnimated.Text style={[s.digitText, { opacity: anim, transform: [{ translateY }] }]}>
        {digit}
      </RNAnimated.Text>
    </View>
  )
}

// ─── Line metadata for editorial cards ───────────────────

type LineTone = 'info' | 'warning' | 'success'

const LINE_META: Record<string, { subtitle: string; fareRange: number; tone: LineTone }> = {
  TMA: { subtitle: 'Suburban Commuter', fareRange: 15, tone: 'info' },
  TMP: { subtitle: 'Inter-Regional', fareRange: 40, tone: 'warning' },
  STK: { subtitle: 'Western Line Commuter', fareRange: 10, tone: 'success' },
}

const DEFAULT_LINE_META = {
  subtitle: 'Rail Service',
  fareRange: null as number | null,
  tone: 'info' as LineTone,
}

// ─── Main screen ─────────────────────────────────────────

export default function TrainLinesScreen() {
  const router = useRouter()
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const s = useMemo(() => getStyles(isDark), [isDark])
  const insets = useSafeAreaInsets()

  const { lines, isLoading, refetch } = useTrainLines()
  const { isSet, toggle } = useDepartureReminders()

  // Arm / disarm a departure reminder from a waiting DepartureInfo.
  // secondsUntilDeparture is the live countdown so the alert lines up with
  // what the rider sees ticking on the board.
  const toggleReminder = useCallback(
    async (dep: Extract<DepartureInfo, { type: 'waiting' }>) => {
      Haptics.selectionAsync()
      const { on, failure } = await toggle({
        scheduleId: dep.schedule.id,
        lineCode: dep.schedule.code,
        origin: dep.origin,
        destination: dep.destination,
        departTime: dep.departTime,
        secondsUntilDeparture: dep.remaining,
      })
      if (failure) {
        showReminderFailureAlert(failure)
      } else if (on) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      }
    },
    [toggle],
  )

  // Live clock — ticks every second (Ghana time)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const departure = useMemo(() => getNextDeparture(), [tick])

  const lineColor = useMemo(() => {
    if (departure.type === 'no-service') return ui.info
    const line = lines.find((l) => l.code === departure.lineCode)
    return line?.color || ui.info
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
                <Badge label={`Line ${item.code}`} tone={meta.tone} />
                <HeroText size={24} style={s.lineTitle}>{item.name}</HeroText>
                <Text style={s.lineSubtitle}>{meta.subtitle}</Text>
              </View>
              <View style={s.shieldBox}>
                <ShieldCheck size={22} color={ui.onBrand} />
              </View>
            </View>

            {/* Stats row: fare + occupancy */}
            <View style={s.lineStatsRow}>
              <View style={s.lineStat}>
                {/* Only a corroborated fare gets called official. TMA and STK
                    are our own figures — GRDA has published neither. */}
                <Text style={s.lineStatLabel}>
                  {LINE_STATUS[item.code]?.fareConfidence === 'confirmed' ? 'Official fare' : 'Fare (guide)'}
                </Text>
                {/* Compact: station boards write "15–40", not
                    "GH₵ 15.00 – GH₵ 40.00". The long form was wide enough to
                    push the STATUS stat clean off the card. */}
                <Text numberOfLines={1} style={s.lineStatValue}>
                  {item.code === 'TMP'
                    ? 'GH₵15–40'
                    : meta.fareRange != null
                      ? `GH₵${meta.fareRange % 1 === 0 ? meta.fareRange : meta.fareRange.toFixed(2)}`
                      : '—'}
                </Text>
              </View>
              <View style={s.lineStatDivider} />
              <View style={s.lineStat}>
                <Text style={s.lineStatLabel}>Journey</Text>
                <Text style={s.lineStatValue}>
                  {(() => {
                    const st = TRAIN_SCHEDULES[item.code]?.[0]?.stops
                    if (!st?.length || !st[0].depart || !st[st.length - 1].arrive) return '—'
                    const mins = parseTimeToMinutes(st[st.length - 1].arrive!) - parseTimeToMinutes(st[0].depart!)
                    // "42 min", not "~0h 42m" — a leading 0h is noise, and
                    // departure boards state duration the way people say it.
                    if (mins < 60) return `${mins} min`
                    const h = Math.floor(mins / 60)
                    const m = mins % 60
                    return m === 0 ? `${h}h` : `${h}h ${m}m`
                  })()}
                </Text>
              </View>
              <View style={s.lineStatDivider} />
              <View style={s.lineStat}>
                <Text style={s.lineStatLabel}>Status</Text>
                <View style={s.occupancyRow}>
                  <View style={[s.occupancyDot, {
                    backgroundColor: isInTransit ? ui.success : isWaiting ? ui.warning : ui.textTertiary,
                  }]} />
                  <Text style={[s.occupancyText, {
                    color: isInTransit
                      ? (isDark ? '#4ade80' : ui.success)
                      : isWaiting
                        ? (isDark ? '#fbbf24' : ui.warning)
                        : (isDark ? '#9ca3af' : ui.textSecondary),
                  }]}>
                    {isInTransit ? 'In Transit' : isWaiting ? 'Next Service' : 'No Service'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Actions row */}
            <View style={s.lineActions}>
              <Button
                label="View schedule"
                onPress={() =>
                  router.push({ pathname: '/train/[lineId]', params: { lineId: item.id } })
                }
                style={{ flex: 1 }}
              />
              {/* Reminder toggle — only when this line has an upcoming departure
                  far enough out to be useful; replaces the old duplicate
                  "open detail" icon that did nothing the card tap didn't. */}
              {isWaiting && dep.type === 'waiting' &&
                dep.remaining > REMINDER_LEAD_MINUTES * 60 && (() => {
                  const armed = isSet(dep.schedule.id)
                  return (
                    <TouchableOpacity
                      onPress={() => toggleReminder(dep)}
                      activeOpacity={0.7}
                      style={[s.lineActionIcon, armed && s.lineActionIconOn]}
                    >
                      {armed ? (
                        <BellRing size={20} color={ui.success} />
                      ) : (
                        <Bell size={20} color={isDark ? '#a8a29e' : brand.orangeText} />
                      )}
                    </TouchableOpacity>
                  )
                })()}
            </View>
          </View>

          {/* Bottom gradient strip */}
          <View style={s.lineCardStrip}>
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
          </View>
        </TouchableOpacity>
      )
    },
    [isDark, s, lineDepartures, router, isSet, toggleReminder]
  )

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      {/* GRDA Header Bar */}
      <View style={[s.headerBar, { paddingTop: insets.top + 12 }]}>
        <View style={s.headerLogo}>
          <ShieldCheck size={18} color={ui.onBrand} />
        </View>
        <Text style={s.headerTitle}>GRDA Official</Text>
        <View style={{ flex: 1 }} />
        <Clock size={14} color="rgba(255,255,255,0.6)" />
        <Text style={s.headerTime}>{currentTime}</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={refetch}
            tintColor={brand.orange}
            colors={[brand.orange]}
          />
        }
      >
        {/* ─── Hero Section ──────────────────────────────── */}
        <Animated.View entering={FadeInDown.duration(dur.entrance)} style={s.hero}>
          <Text style={s.heroLabel}>National transit network</Text>
          <HeroText size={36} weight="displayHeavy" style={s.heroTitle}>Trains</HeroText>
        </Animated.View>

        {/* ─── Departure Board ─────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(150).duration(dur.entrance)} style={s.board}>
          <View style={s.boardGlow} />

          {/* Top row */}
          <View style={s.boardTopRow}>
            {/* No live GPS/telemetry feed exists for trains yet — schedules
                are static, so the board always shows a neutral Schedule chip
                instead of a fake Live one. */}
            <View style={s.scheduleBadge}>
              <View style={s.scheduleDot} />
              <Text style={s.scheduleText}>Schedule</Text>
            </View>
            <View style={{ flex: 1 }} />
            <Text style={s.boardLabel}>
              {departure.type === 'in-transit' ? 'In transit' : 'Departures'}
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
                <View style={s.scheduledBadge}>
                  <View style={[s.statusDot, { backgroundColor: 'rgba(255,255,255,0.4)' }]} />
                  <Text style={s.scheduledText}>Scheduled</Text>
                </View>
              </View>

              {/* Remind me — fires REMINDER_LEAD_MINUTES before this departure */}
              {(() => {
                const armed = isSet(departure.schedule.id)
                const tooSoon = departure.remaining <= REMINDER_LEAD_MINUTES * 60
                if (tooSoon && !armed) return null
                return (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => toggleReminder(departure)}
                    style={[s.remindBtn, armed && s.remindBtnOn]}
                  >
                    {armed ? (
                      <BellRing size={16} color={ui.success} />
                    ) : (
                      <Bell size={16} color={BOARD_ACCENT} />
                    )}
                    <Text style={[s.remindText, armed && { color: ui.success }]}>
                      {armed
                        ? `Reminder set · ${REMINDER_LEAD_MINUTES} min before`
                        : `Remind me ${REMINDER_LEAD_MINUTES} min before`}
                    </Text>
                  </TouchableOpacity>
                )
              })()}
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
                {/* Position is schedule math, not telemetry — no green live dot,
                    hedged wording (UX-10) */}
                <View style={s.transitRow}>
                  <Text style={s.transitText}>
                    Should be near{' '}
                    <Text style={s.transitHighlight}>{departure.currentStation}</Text>
                    {' '}(per schedule)
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
                  <View style={[s.statusDot, { backgroundColor: BOARD_ACCENT }]} />
                  <Text style={s.transitBadgeText}>In transit</Text>
                </View>
              </View>
            </>
          )}

          {/* ── No service state ── */}
          {departure.type === 'no-service' && (
            <View style={s.noService}>
              <TrainFront size={32} color="rgba(255,255,255,0.25)" />
              <Text style={s.noServiceTitle}>No service today</Text>
              <Text style={s.noServiceSub}>
                {(() => {
                  const allSchedules = Object.values(TRAIN_SCHEDULES).flat()
                  const earliest = allSchedules.reduce((min, s) => {
                    const t = s.stops[0].depart!
                    return t < min ? t : min
                  }, '23:59')
                  return `Resumes next service day at ${earliest}`
                })()}
              </Text>
            </View>
          )}

          {/* Bottom info strip */}
          <View style={s.boardStrip}>
            <GRDABadge size="small" />
            <Text style={s.stripText}>GRDA Official</Text>
            <View style={s.stripDot} />
            <Text style={s.stripText}>
              {departure.type !== 'no-service' && departure.lineCode
                ? TRAIN_SCHEDULES[departure.lineCode]?.[0]?.days || 'Mon – Sat'
                : 'Mon – Sat'}
            </Text>
            {departure.type !== 'no-service' && (
              <>
                <View style={s.stripDot} />
                <View style={[s.stripLineDot, { backgroundColor: lineColor }]} />
                <Text style={s.stripText}>{departure.lineCode}</Text>
                <View style={s.stripDot} />
                <Text style={s.stripText}>
                  {formatGHS(departure.schedule.fare)}
                </Text>
              </>
            )}
          </View>
        </Animated.View>

        {/* ─── Rail Line Cards ─────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(300).duration(dur.entrance)} style={s.section}>
          {isLoading ? (
            <View style={{ gap: space.lg }}>
              <SkeletonTrainCard isDark={isDark} />
              <SkeletonTrainCard isDark={isDark} />
            </View>
          ) : lines.length === 0 ? (
            <View style={s.emptyCard}>
              <TrainFront size={40} color={isDark ? '#57534e' : ui.textTertiary} />
              <Text style={s.emptyTitle}>No train lines yet</Text>
              <Text style={s.emptySub}>
                Train lines will appear here once available
              </Text>
            </View>
          ) : (
            <View style={{ gap: space.lg }}>{lines.map(renderLineCard)}</View>
          )}
        </Animated.View>

        {/* ─── How to Ride ──────────────────────────────── */}
        <View style={s.rideSection}>
          <SectionHeader title="How to ride" />

          {HOW_TO_RIDE.map((tip) => (
            <View key={tip.title} style={s.rideCard}>
              <Text style={s.rideCardTitle}>{tip.title}</Text>
              <Text style={s.rideCardText}>{tip.text}</Text>
            </View>
          ))}
        </View>

        {/* ─── Authority Bulletins ─────────────────────── */}
        {/* Factual network bulletins in our own words — no media names/links. */}
        <View style={s.bulletinSection}>
          <SectionHeader title="Authority bulletins" />

          {(() => {
            // Two bulletins + the NOTICE disclaimer always pinned last (it is
            // the honesty statement about this whole screen).
            // SERVICE UPDATE outranks NETWORK UPDATE regardless of date: the
            // first kind affects the train someone is about to catch, the
            // second is background. Sorting on date alone let two pieces of
            // sector news push an active reduced-capacity notice off the screen.
            // One of each, newest of its kind: the latest SERVICE UPDATE (what
            // affects the train you are about to catch) and the latest other
            // bulletin. Ranking purely by tag buried this month's news behind a
            // five-month-old service note; ranking purely by date buried an
            // active reduced-capacity warning behind sector news.
            const byDate = [...NETWORK_BULLETINS].sort((a, b) => b.date.localeCompare(a.date))
            const notice = byDate.find((b) => b.tag === 'NOTICE')
            const service = byDate.find((b) => b.tag === 'SERVICE UPDATE')
            const latestOther = byDate.find((b) => b.tag !== 'NOTICE' && b !== service)
            const news = [service, latestOther].filter(Boolean) as typeof byDate
            const shown = notice ? [...news, notice] : news
            return shown.map((b) => {
              const tone = b.tag === 'SERVICE UPDATE' ? 'info' : b.tag === 'NETWORK UPDATE' ? 'brand' : 'neutral'
              const tagLabel = b.tag.charAt(0) + b.tag.slice(1).toLowerCase()
              return (
                <View key={b.text} style={s.bulletinCard}>
                  <View style={s.bulletinMeta}>
                    <Badge label={tagLabel} tone={tone} />
                    <Text style={s.bulletinDate}>{b.date}</Text>
                  </View>
                  <Text style={s.bulletinText}>{b.text}</Text>
                </View>
              )
            })
          })()}
        </View>

        {/* Daily Commuter Tip — train-focused */}
        <View style={s.tipCard}>
          <DailyTipCard category="train" />
        </View>

        {/* Clear the floating tab bar — Train is a top-level tab now. */}
        <View style={{ height: TAB_BAR_CLEARANCE + insets.bottom }} />
      </ScrollView>
    </SafeAreaView>
  )
}

// ─── Styles ──────────────────────────────────────────────

const BOARD_ACCENT = '#0ea5e9' // departure-board sky blue — board-only, keeps the station-display look

const getStyles = (isDark: boolean) => {
  const surface = isDark ? '#1c1c1e' : ui.bg
  const surfaceLowest = isDark ? '#1c1c1e' : ui.card
  const onSurface = isDark ? '#f5f5f4' : ui.text
  const onSurfaceVariant = isDark ? 'rgba(255,255,255,0.5)' : ui.textSecondary
  const outlineVariant = isDark ? 'rgba(255,255,255,0.1)' : ui.surfaceStrong

  return StyleSheet.create({
    container: { flex: 1, backgroundColor: surface },

    // ── GRDA Header Bar ── (single solid blue surface, no gradient)
    headerBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: space.gutter,
      paddingVertical: 12,
      gap: 8,
      backgroundColor: ui.info,
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
      color: ui.onBrand,
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
      paddingHorizontal: space.gutter,
      paddingTop: 14,
      paddingBottom: 8,
    },
    heroLabel: {
      ...type.caption,
      color: isDark ? onSurfaceVariant : brand.orangeText,
      marginBottom: 2,
    },
    heroTitle: {
      color: onSurface,
      letterSpacing: 0,
      marginBottom: 8,
    },

    // ── Departure Board (always dark — like a real station display) ──
    board: {
      backgroundColor: '#0c1220',
      marginHorizontal: space.gutter,
      marginTop: 16,
      borderRadius: radius.xl,
      padding: 20,
      overflow: 'hidden',
      ...cardShadow,
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
    scheduleBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.08)',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
      gap: 5,
    },
    scheduleDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: 'rgba(255,255,255,0.4)',
    },
    scheduleText: {
      fontSize: 12,
      fontFamily: font.semibold,
      color: 'rgba(255,255,255,0.5)',
    },
    boardLabel: {
      fontSize: 12,
      fontFamily: font.semibold,
      color: 'rgba(255,255,255,0.4)',
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
      overflow: 'hidden',
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
      color: BOARD_ACCENT,
      marginTop: 8,
      marginHorizontal: 2,
    },
    // Short uppercase unit labels are allowed inside the board only.
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
      color: BOARD_ACCENT,
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
    scheduledBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.08)',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      gap: 5,
    },
    scheduledText: {
      fontSize: 12,
      fontFamily: font.semibold,
      color: 'rgba(255,255,255,0.5)',
    },
    statusDot: { width: 6, height: 6, borderRadius: 3 },

    // ── Remind-me button (board) ──
    remindBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 16,
      paddingVertical: 12,
      borderRadius: radius.md,
      backgroundColor: 'rgba(14,165,233,0.12)',
      borderWidth: 1,
      borderColor: 'rgba(14,165,233,0.25)',
    },
    remindBtnOn: {
      backgroundColor: 'rgba(34,197,94,0.12)',
      borderColor: 'rgba(34,197,94,0.3)',
    },
    remindText: {
      fontSize: 13,
      fontFamily: font.semibold,
      color: BOARD_ACCENT,
    },

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
      backgroundColor: BOARD_ACCENT,
      borderRadius: 2,
    },
    progressDot: {
      position: 'absolute',
      top: -4,
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: BOARD_ACCENT,
      borderWidth: 2,
      borderColor: '#0c1220',
      marginLeft: -6,
    },
    transitEndpoints: { flexDirection: 'row', justifyContent: 'space-between' },
    transitEndpoint: {
      fontSize: 12,
      fontFamily: font.regular,
      color: 'rgba(255,255,255,0.35)',
    },
    transitDetails: { gap: 6, marginBottom: 12 },
    transitRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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
      fontSize: 12,
      fontFamily: font.semibold,
      color: BOARD_ACCENT,
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
      fontSize: 12,
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
    section: { paddingHorizontal: space.gutter, paddingTop: space.section },

    // ── Line Cards ──
    lineCard: {
      borderRadius: radius.lg,
      backgroundColor: surfaceLowest,
      overflow: 'hidden',
      ...cardShadow,
    },
    lineCardBody: {
      padding: space.xl,
      gap: space.xl,
    },
    lineCardTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    lineTitle: {
      color: onSurface,
      letterSpacing: -0.5,
    },
    lineSubtitle: {
      ...type.label,
      color: onSurfaceVariant,
      marginTop: 2,
    },
    shieldBox: {
      width: 40,
      height: 40,
      borderRadius: radius.md,
      backgroundColor: ui.info,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // Stats row
    lineStatsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    lineStat: {
      // flex + minWidth 0: without these a long fare value sized the stat to
      // its content and pushed Status outside the card entirely.
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    lineStatLabel: {
      ...type.caption,
      color: onSurfaceVariant,
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
    lineActionIcon: {
      width: 48,
      height: 48,
      borderRadius: radius.md,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : ui.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    lineActionIconOn: {
      backgroundColor: isDark ? 'rgba(34,197,94,0.12)' : ui.successSoft,
    },

    // Bottom info strip (was a gradient)
    lineCardStrip: {
      paddingVertical: 12,
      paddingHorizontal: space.xl,
      borderTopWidth: 1,
      borderTopColor: outlineVariant,
    },
    lineCardStripContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    lineCardStripText: {
      ...type.caption,
      color: onSurfaceVariant,
    },
    lineCardStripDot: {
      width: 3,
      height: 3,
      borderRadius: 1.5,
      backgroundColor: ui.textTertiary,
    },

    // ── How to Ride ──
    rideSection: {
      paddingHorizontal: space.gutter,
      paddingTop: space.section,
      gap: 12,
    },
    rideCard: {
      backgroundColor: surfaceLowest,
      borderRadius: radius.lg,
      padding: space.lg,
      ...cardShadow,
    },
    rideCardTitle: {
      fontSize: 14,
      fontFamily: font.bold,
      color: onSurface,
      marginBottom: 4,
    },
    rideCardText: {
      fontSize: 13,
      fontFamily: font.regular,
      color: onSurfaceVariant,
      lineHeight: 19,
    },

    // ── Authority Bulletins ──
    bulletinSection: {
      paddingHorizontal: space.gutter,
      paddingTop: space.section,
      gap: 12,
    },
    bulletinCard: {
      backgroundColor: surfaceLowest,
      borderRadius: radius.lg,
      padding: space.lg,
      gap: 8,
      ...cardShadow,
    },
    bulletinMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    bulletinDate: {
      ...type.caption,
      color: onSurfaceVariant,
    },
    bulletinText: {
      fontSize: 14,
      fontFamily: font.semibold,
      color: onSurface,
      lineHeight: 20,
    },

    // ── Daily Tip ──
    tipCard: {
      marginHorizontal: space.gutter,
      marginTop: space.section,
      borderRadius: radius.lg,
      backgroundColor: surfaceLowest,
      overflow: 'hidden',
      ...cardShadow,
    },

    // ── Empty ──
    emptyCard: {
      padding: 32,
      borderRadius: radius.lg,
      backgroundColor: surfaceLowest,
      alignItems: 'center',
      ...cardShadow,
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
