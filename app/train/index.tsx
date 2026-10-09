import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  useColorScheme,
  RefreshControl,
  StyleSheet,
  Animated as RNAnimated,
  Easing,
  type DimensionValue,
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Haptics from 'expo-haptics'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { SkeletonTrainCard } from '@/components/Skeleton'
import { useRouter, useFocusEffect } from 'expo-router'
import {
  TrainFront,
  Clock,
  ArrowRight,
  Bell,
  BellRing,
  ChevronDown,
  MapPin,
  Plus,
  ArrowUpDown,
  Check,
  X,
} from 'lucide-react-native'
import { font, brand, ui, space, radius, type, cardShadow } from '@/lib/theme'
import { SvgXml } from 'react-native-svg'
import { LinearGradient } from 'expo-linear-gradient'
import { adinkraPatternXml } from '@/lib/brand/adinkra'
import { Badge, Tap } from '@/components/ui'
import { dur } from '@/lib/motion'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { DailyTipCard } from '@/components/DailyTipCard'
import { useTrainLines } from '@/lib/hooks/useTrain'
import { useDepartureReminders } from '@/lib/hooks/useDepartureReminders'
import { REMINDER_LEAD_MINUTES, showReminderFailureAlert } from '@/lib/services/trainReminders'
import { getGhanaTime, formatGhanaTime } from '@/lib/utils/time'
import { TRAIN_SCHEDULES, SCHEDULE_VERIFIED, type TrainSchedule } from '@/lib/constants/train-schedule'
import { NETWORK_BULLETINS, HOW_TO_RIDE } from '@/lib/constants/train-network'
import {
  LINE_COLORS,
  STATION_NAMES,
  findDirectRuns,
  searchStations,
  lineStationNames,
  getFare,
  lineFareLabel,
  nextDepartures,
  serviceDayNumbers,
  toMinutes,
  formatRemaining,
} from '@/lib/utils/train-stations'
import { TAB_BAR_CLEARANCE } from '@/app/(tabs)/_layout'
import { RELEASE_MODE } from '@/lib/config/release'
import { AdinkraWallpaper } from '@/components/AdinkraWallpaper'
import { ReleaseTrainTop } from '@/components/train/ReleaseTrainTop'
import { Dimensions } from 'react-native'

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


// ─── Redesign helpers (My trip, Find a train, Next trains) ───

const MY_TRIP_KEY = 'troski_my_train_trip'
const PAPER = '#FAF6F2'
const INK = '#1C1917'
const MY_TRIP_CARD = '#16110D'
const LINE_NAMES: Record<string, string> = {
  TMA: 'Tema – Accra',
  TMP: 'Tema – Mpakadan',
  STK: 'Sekondi – Takoradi',
}
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

type MyTrip = { from: string; to: string }

/** "2026-09-15" -> "15 Sep 2026" */
function formatVerified(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return `${d} ${MONTHS[m - 1]} ${y}`
}

/** "Mon – Sat" -> "Mon–Sat" (compact, en dash with no spaces) */
function compactDays(days: string): string {
  return days.replace(/ – /g, '–')
}

function hhmm(totalMinutes: number): string {
  const m = ((totalMinutes % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

function whenLabel(offset: number, now: Date): string {
  if (offset === 0) return 'today'
  if (offset === 1) return 'tomorrow'
  return WEEKDAYS[(now.getUTCDay() + offset) % 7]
}

/** Next time (Ghana = UTC) a run is at a stop departing at `depart` on `days`. */
function nextOccurrence(depart: string, days: string, now: Date): { offset: number; seconds: number } | null {
  const nowSec = now.getUTCHours() * 3600 + now.getUTCMinutes() * 60 + now.getUTCSeconds()
  const today = now.getUTCDay()
  const service = serviceDayNumbers(days)
  for (let offset = 0; offset <= 7; offset++) {
    if (!service.includes((today + offset) % 7)) continue
    const seconds = offset * 86400 + toMinutes(depart) * 60 - nowSec
    if (seconds > 0) return { offset, seconds }
  }
  return null
}

/** Reminder key for a run boarded at `from`. The "@station" suffix keeps it
 *  distinct from whole-line reminders, which are keyed by the bare schedule id. */
function tripReminderKey(schedule: TrainSchedule, from: string): string {
  // Boarding at the run's origin: share the bare id with the board and Next
  // trains bells so one train never gets two notifications.
  return schedule.stops[0].station === from ? schedule.id : `${schedule.id}@${from}`
}

const PICKER_LINES = ['TMA', 'TMP', 'STK']

function scheduleForRun(lineCode: string, runCode: string): TrainSchedule | undefined {
  return TRAIN_SCHEDULES[lineCode]?.find((x) => x.code === runCode)
}

function Collapsible({ title, children, s }: { title: string; children: React.ReactNode; s: ReturnType<typeof getStyles> }) {
  const [open, setOpen] = useState(false)
  return (
    <View style={s.collCard}>
      <Tap
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={title}
        style={s.collHead}
      >
        <Text style={s.collTitle}>{title}</Text>
        <ChevronDown
          size={20}
          color="#44403C"
          style={open ? { transform: [{ rotate: '180deg' }] } : undefined}
        />
      </Tap>
      {open && <View style={s.collBody}>{children}</View>}
    </View>
  )
}


// ─── Main screen ─────────────────────────────────────────

const HEADER_BAND = '#FFF3EA'

export default function TrainLinesScreen() {
  const router = useRouter()
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const s = useMemo(() => getStyles(isDark), [isDark])
  const insets = useSafeAreaInsets()

  const { lines, isLoading, refetch } = useTrainLines()
  const { isSet, toggle, refresh } = useDepartureReminders()
  useFocusEffect(
    useCallback(() => {
      refresh()
    }, [refresh]),
  )

  // Arm / disarm a departure reminder. `key` is the storage key (the bare
  // schedule id for whole-line reminders, "<id>@<station>" for My trip).
  // secondsUntilDeparture is the live countdown so the alert lines up with
  // what the rider sees ticking.
  const toggleKeyed = useCallback(
    async (p: {
      key: string
      lineCode: string
      origin: string
      destination: string
      departTime: string
      seconds: number
    }) => {
      Haptics.selectionAsync()
      const { on, failure } = await toggle({
        scheduleId: p.key,
        lineCode: p.lineCode,
        origin: p.origin,
        destination: p.destination,
        departTime: p.departTime,
        secondsUntilDeparture: p.seconds,
      })
      if (failure) {
        showReminderFailureAlert(failure)
      } else if (on) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      }
    },
    [toggle],
  )

  const toggleReminder = useCallback(
    (dep: Extract<DepartureInfo, { type: 'waiting' }>) =>
      toggleKeyed({
        key: dep.schedule.id,
        lineCode: dep.schedule.code,
        origin: dep.origin,
        destination: dep.destination,
        departTime: dep.departTime,
        seconds: dep.remaining,
      }),
    [toggleKeyed],
  )

  // Live clock — ticks every second (Ghana time)
  const [tick, setTick] = useState(0)
  const [boardSize, setBoardSize] = useState({ w: 0, h: 0 })
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

  // ── My trip (saved in AsyncStorage) ──
  const [trip, setTrip] = useState<MyTrip | null>(null)
  const [showReturn, setShowReturn] = useState(false)
  const tripTouched = useRef(false) // set once the rider saves/clears a trip, so a slow load can't overwrite it
  useEffect(() => {
    AsyncStorage.getItem(MY_TRIP_KEY)
      .then((raw) => {
        if (!raw || tripTouched.current) return
        const p = JSON.parse(raw) as Partial<MyTrip>
        if (
          typeof p.from === 'string' &&
          typeof p.to === 'string' &&
          STATION_NAMES.includes(p.from) &&
          STATION_NAMES.includes(p.to)
        ) {
          setTrip({ from: p.from, to: p.to })
        }
      })
      .catch(() => {})
  }, [])

  const saveTrip = useCallback((next: MyTrip) => {
    tripTouched.current = true
    setTrip(next)
    setShowReturn(false)
    AsyncStorage.setItem(MY_TRIP_KEY, JSON.stringify(next)).catch(() => {})
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  }, [])

  const now = useMemo(() => new Date(), [tick]) // eslint-disable-line react-hooks/exhaustive-deps

  const tripInfo = useMemo(() => {
    if (!trip) return null
    const runs = findDirectRuns(trip.from, trip.to)
    let best: { run: (typeof runs)[number]; offset: number; seconds: number } | null = null
    for (const run of runs) {
      const n = nextOccurrence(run.departFrom, run.schedule.days, now)
      if (n && (!best || n.seconds < best.seconds)) best = { run, ...n }
    }
    return { best, hasRuns: runs.length > 0, returnRuns: findDirectRuns(trip.to, trip.from) }
  }, [trip, now])

  // ── Find a train ──
  const [fromName, setFromName] = useState('')
  const [toName, setToName] = useState('')
  const [picker, setPicker] = useState<'from' | 'to' | null>(null)
  const scrollRef = useRef<ScrollView>(null)
  const findY = useRef(0)

  const result = useMemo(
    () => (fromName && toName ? searchStations(fromName, toName) : null),
    [fromName, toName],
  )

  const pickStation = (name: string) => {
    if (picker === 'from') setFromName(name)
    else if (picker === 'to') setToName(name)
    setPicker(null)
  }

  // Scroll the result card into view once a From+To pair is chosen
  useEffect(() => {
    if (!result) return
    const id = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, findY.current + 120), animated: true })
    }, 350)
    return () => clearTimeout(id)
  }, [result])

  const swapStations = () => {
    setFromName(toName)
    setToName(fromName)
  }

  // ── Next trains ──
  const next = useMemo(() => nextDepartures(now), [now])

  const renderMyTrip = () => {
    if (!trip || !tripInfo) return null
    const best = tripInfo.best
    const key = best ? tripReminderKey(best.run.schedule, trip.from) : ''
    const armed = best ? isSet(key) : false
    const lineName = best ? (LINE_NAMES[best.run.lineCode] ?? best.run.lineCode).replace(/ – /g, '–') : ''
    const arriveMin = best ? hhmm(toMinutes(best.run.arriveTo)) : ''
    return (
      <Animated.View entering={FadeInDown.duration(dur.entrance)} style={s.tripCard}>
        <View style={s.tripTopRow}>
          <Text style={s.tripLabel}>MY TRIP</Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Change saved trip"
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={s.tripChange}
            onPress={() => {
              tripTouched.current = true
              setFromName(trip.from)
              setToName(trip.to)
              setShowReturn(false)
              setTrip(null)
              AsyncStorage.removeItem(MY_TRIP_KEY).catch(() => {})
            }}
          >
            <Text style={s.tripChangeText}>Change</Text>
          </TouchableOpacity>
        </View>
        <View>
          <Text style={s.tripRoute}>{trip.from} → {trip.to}</Text>
          {best ? (
            <Text style={s.tripSub}>
              {lineName} line · {getFare(best.run.lineCode, trip.from, trip.to).label} · {compactDays(best.run.schedule.days)}
            </Text>
          ) : null}
        </View>
        {best ? (
          <>
            <View style={s.tripTimeRow}>
              <Text style={s.tripTime}>{best.run.departFrom}</Text>
              <Text style={s.tripWhen}>{whenLabel(best.offset, now)} · arrives {arriveMin}</Text>
            </View>
            <Text style={s.tripLeaves}>Leaves in {formatRemaining(Math.ceil(best.seconds / 60))}</Text>
            <View style={s.tripBtnRow}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={armed ? 'Turn reminder off' : 'Turn reminder on'}
                accessibilityState={{ selected: armed }}
                activeOpacity={0.85}
                style={armed ? s.tripBtnOn : s.tripBtn}
                onPress={() =>
                  toggleKeyed({
                    key,
                    lineCode: best.run.schedule.code,
                    origin: trip.from,
                    destination: trip.to,
                    departTime: best.run.departFrom,
                    seconds: best.seconds,
                  })
                }
              >
                {armed ? <BellRing size={18} color={ui.onBrand} /> : <Bell size={18} color={ui.onBrand} />}
                <Text style={s.tripBtnText}>{armed ? 'Reminder on' : 'Reminder off'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Return times"
                accessibilityState={{ expanded: showReturn }}
                activeOpacity={0.85}
                style={s.tripBtnGhost}
                onPress={() => setShowReturn((v) => !v)}
              >
                <Text style={s.tripBtnText}>Return times</Text>
              </TouchableOpacity>
            </View>
            {showReturn && (
              <View style={s.returnBox}>
                <Text style={s.returnTitle}>{trip.to} → {trip.from}</Text>
                {tripInfo.returnRuns.length === 0 ? (
                  <Text style={s.returnRow}>No direct return train.</Text>
                ) : (
                  tripInfo.returnRuns.map((r) => (
                    <Text key={r.schedule.id} style={s.returnRow}>
                      {r.departFrom} → {r.arriveTo} · {compactDays(r.schedule.days)}
                    </Text>
                  ))
                )}
              </View>
            )}
            {armed ? (
              <Text style={s.tripNote}>
                {`We'll notify you at ${hhmm(toMinutes(best.run.departFrom) - REMINDER_LEAD_MINUTES)}. Works offline.`}
              </Text>
            ) : best.seconds > REMINDER_LEAD_MINUTES * 60 ? (
              <Text style={s.tripNote}>Turn on a reminder for {REMINDER_LEAD_MINUTES} minutes before.</Text>
            ) : null}
          </>
        ) : (
          <Text style={s.tripNote}>
            {tripInfo.hasRuns
              ? 'No upcoming departure found.'
              : 'There is no direct train for this trip any more. Tap Change to pick another.'}
          </Text>
        )}
      </Animated.View>
    )
  }

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      {/* Status-bar scrim so content never collides with the clock */}
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top, backgroundColor: RELEASE_MODE ? HEADER_BAND : PAPER, zIndex: 10 }} />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={refetch}
            tintColor={brand.orange}
            colors={[brand.orange]}
          />
        }
      >
        {/* ─── Header ─────────────────────────────────────── */}
        <View style={[s.header, { paddingTop: insets.top + 12 }, RELEASE_MODE && { backgroundColor: HEADER_BAND, overflow: 'hidden', paddingBottom: 16 }]}>
          {/* Store release: Adinkra wallpaper behind the tab header (redesign) */}
          {RELEASE_MODE ? <AdinkraWallpaper width={Dimensions.get('window').width} height={insets.top + 140} size={26} color="rgba(232,70,26,0.10)" /> : null}
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>Trains</Text>
            <Text style={s.headerSub}>GRDA schedule · verified {formatVerified(SCHEDULE_VERIFIED)}</Text>
          </View>
          <View style={s.clockPill} accessibilityLabel={`Ghana time ${currentTime}`}>
            <Clock size={14} color="#44403C" />
            <Text style={s.clockPillText}>Accra {currentTime}</Text>
          </View>
        </View>

        {/* ─── My trip ─────────────────────────────────────── */}
        {renderMyTrip()}

        {/* ─── Store release: next departure + all lines (redesign) ─── */}
        {!trip && RELEASE_MODE && (
          <ReleaseTrainTop lineIdByCode={Object.fromEntries((lines ?? []).map((l) => [l.code, l.id]))} />
        )}

        {/* ─── Departure Board (no saved trip) ─────────── */}
        {!trip && !RELEASE_MODE && (
        <>
        <Animated.View entering={FadeInDown.delay(150).duration(dur.entrance)} style={s.board}>
          <View
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            onLayout={(e) => setBoardSize({ w: Math.round(e.nativeEvent.layout.width), h: Math.round(e.nativeEvent.layout.height) })}
          >
            {boardSize.w > 0 && (
              <SvgXml xml={boardPattern(boardSize.w, boardSize.h)} width={boardSize.w} height={boardSize.h} />
            )}
            {/* Fade the print out down the card: texture around the header and
                countdown, clean navy behind the route/time text so it stays readable. */}
            <LinearGradient
              colors={['rgba(12,18,32,0)', 'rgba(12,18,32,0.35)', '#0c1220']}
              locations={[0, 0.3, 0.55]}
              style={StyleSheet.absoluteFill}
            />
          </View>

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
                    accessibilityRole="button"
                    accessibilityState={{ selected: armed }}
                    style={armed ? s.remindBtnOnFull : s.remindBtn}
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
                  {lineFareLabel(departure.lineCode)}
                </Text>
              </>
            )}
          </View>

        </Animated.View>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Save a trip to pin it here"
          activeOpacity={0.7}
          style={s.saveHint}
          onPress={() => scrollRef.current?.scrollTo({ y: Math.max(0, findY.current - 8), animated: true })}
        >
          <Plus size={18} color="#C2410C" />
          <Text style={s.saveHintText}>Save a trip to pin it here</Text>
        </TouchableOpacity>
        </>
        )}

        {/* ─── Find a train ───────────────────────────────── */}
        <View style={s.findCard} onLayout={(e) => { findY.current = e.nativeEvent.layout.y }}>
          <Text style={s.cardTitle}>Find a train</Text>
          <View style={s.fieldRow}>
            <Tap
              onPress={() => setPicker('from')}
              accessibilityRole="button"
              accessibilityLabel={`From station: ${fromName || 'not chosen'}`}
              style={s.field}
            >
              <Text style={s.fieldLabel}>From</Text>
              <Text style={fromName ? s.fieldValue : s.fieldPlaceholder} numberOfLines={1}>{fromName || 'Choose station'}</Text>
            </Tap>
            <Tap
              onPress={() => setPicker('to')}
              accessibilityRole="button"
              accessibilityLabel={`To station: ${toName || 'not chosen'}`}
              style={s.field}
            >
              <Text style={s.fieldLabel}>To</Text>
              <Text style={toName ? s.fieldValue : s.fieldPlaceholder} numberOfLines={1}>{toName || 'Choose station'}</Text>
            </Tap>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Swap direction"
            activeOpacity={0.7}
            style={s.swapBtn}
            onPress={swapStations}
          >
            <ArrowUpDown size={16} color="#44403C" />
            <Text style={s.swapText}>Swap direction ⇄</Text>
          </TouchableOpacity>

          {result?.kind === 'unknown' && <Text style={s.resultNote}>{result.message}</Text>}
          {result?.kind === 'none' && (
            <Text style={s.resultNote}>
              No direct train between {result.from.name} and {result.to.name}.
            </Text>
          )}
          {result?.kind === 'direct' && (
            <View style={s.resultBox}>
              {result.runs.map((r) => (
                <View key={r.schedule.id} style={s.resultRow}>
                  <Text style={s.resultTimes}>{r.departFrom} → {r.arriveTo}</Text>
                  <Text style={s.resultMeta}>
                    <Text style={{ color: LINE_COLORS[r.lineCode]?.main ?? INK, fontFamily: font.extrabold }}>
                      {(LINE_NAMES[r.lineCode] ?? r.lineCode).replace(/ – /g, '–')}
                    </Text>
                    {' · '}{compactDays(r.schedule.days)} · {getFare(r.lineCode, result.from.name, result.to.name).label}
                  </Text>
                </View>
              ))}
              {trip && trip.from === result.from.name && trip.to === result.to.name ? (
                <View style={s.savedRow} accessibilityLabel="Saved as My trip">
                  <Check size={18} color="#15803D" />
                  <Text style={s.savedText}>Saved as My trip</Text>
                </View>
              ) : (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Save as My trip"
                  activeOpacity={0.85}
                  style={s.saveBtn}
                  onPress={() => saveTrip({ from: result.from.name, to: result.to.name })}
                >
                  <Text style={s.saveBtnText}>Save as My trip</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* ─── Next trains ────────────────────────────────── */}
        <View style={s.nextCard}>
          <Text style={s.cardTitle}>Next trains</Text>
          {next.map((d, i) => {
            const sched = scheduleForRun(d.lineCode, d.runCode)
            const occ = sched ? nextOccurrence(d.departTime, sched.days, now) : null
            const armed = sched ? isSet(sched.id) : false
            const color = LINE_COLORS[d.lineCode]?.main ?? INK
            return (
              <View key={d.runCode} style={[s.nextRow, i > 0 && s.nextRowBorder]}>
                <Text style={s.nextTime}>{d.departTime}</Text>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.nextRoute} numberOfLines={1}>{d.origin} → {d.destination}</Text>
                  <Text style={s.nextMeta} numberOfLines={1}>
                    <Text style={{ color, fontFamily: font.extrabold }}>{d.lineName.replace(/ – /g, '–')}</Text>
                    {' · '}{d.offset != null ? whenLabel(d.offset, now) : ''} · {d.fareLabel}
                  </Text>
                </View>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={`${armed ? 'Reminder on for' : 'Remind me about'} the ${d.departTime} to ${d.destination}`}
                  accessibilityState={{ selected: armed }}
                  activeOpacity={0.7}
                  disabled={!sched || !occ}
                  style={armed ? s.bellOn : s.bell}
                  onPress={() => {
                    if (!sched || !occ) return
                    toggleKeyed({
                      key: sched.id,
                      lineCode: sched.code,
                      origin: d.origin,
                      destination: d.destination,
                      departTime: d.departTime,
                      seconds: occ.seconds,
                    })
                  }}
                >
                  {armed ? (
                    <BellRing size={20} color="#FF4D1C" fill="#FF4D1C" />
                  ) : (
                    <Bell size={20} color="#44403C" />
                  )}
                </TouchableOpacity>
              </View>
            )
          })}
        </View>

        {/* ─── Akosombo tip ───────────────────────────────── */}
        <View style={s.akosombo}>
          <MapPin size={22} color="#F5A300" fill="#F5A300" style={{ marginTop: 3 }} />
          <Text style={s.akosomboText}>
            <Text style={{ fontFamily: font.extrabold, color: INK }}>Going to Akosombo? </Text>
            {"Take the Tema–Mpakadan train to Mpakadan, the line's last stop."}
          </Text>
        </View>

        {/* ─── Lines ──────────────────────────────────────── */}
        <View style={s.linesSection}>
          <Text style={s.linesTitle}>Lines</Text>
          {isLoading ? (
            <View style={{ gap: space.lg }}>
              <SkeletonTrainCard isDark={isDark} />
              <SkeletonTrainCard isDark={isDark} />
            </View>
          ) : lines.length === 0 ? (
            <View style={s.emptyCard}>
              <TrainFront size={40} color={ui.textTertiary} />
              <Text style={s.emptyTitle}>No train lines yet</Text>
              <Text style={s.emptySub}>Train lines will appear here once available</Text>
            </View>
          ) : (
            lines.map((item) => {
              const sch = TRAIN_SCHEDULES[item.code] ?? []
              const departs = sch.map((x) => x.stops[0].depart!).sort()
              // Same list the station picker uses, so the card and the picker agree
              const pickerCount = lineStationNames(item.code).length
              const stationCount = pickerCount || (item.station_count ?? sch[0]?.stops.length ?? 0)
              return (
                <Tap
                  key={item.id}
                  onPress={() => router.push({ pathname: '/train/[lineId]', params: { lineId: item.id } })}
                  accessibilityRole="button"
                  accessibilityLabel={`${LINE_NAMES[item.code] ?? item.name} line details`}
                  style={s.lineRow}
                >
                  <View style={[s.lineBar, { backgroundColor: LINE_COLORS[item.code]?.main ?? ui.info }]} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.lineName} numberOfLines={1}>{LINE_NAMES[item.code] ?? item.name.replace(/ - /g, ' – ')}</Text>
                    <Text style={s.lineMeta} numberOfLines={1}>
                      {departs.length ? `${departs[0]} · ${departs[departs.length - 1]} · ` : ''}
                      {sch[0] ? `${compactDays(sch[0].days)} · ` : ''}{stationCount} stations
                    </Text>
                  </View>
                  <Text style={s.lineFare}>{lineFareLabel(item.code)}</Text>
                </Tap>
              )
            })
          )}
        </View>

        {/* ─── How to ride / Network updates (collapsed) ─── */}
        <View style={s.collSection}>
          <Collapsible title="How to ride" s={s}>
            {HOW_TO_RIDE.map((tip) => (
              <View key={tip.title} style={s.rideItem}>
                <Text style={s.rideCardTitle}>{tip.title}</Text>
                <Text style={s.rideCardText}>{tip.text}</Text>
              </View>
            ))}
          </Collapsible>
          <Collapsible title="Network updates" s={s}>
            {(() => {
              // Two bulletins + the NOTICE disclaimer always pinned last (it is
              // the honesty statement about this whole screen).
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
                  <View key={b.text} style={s.bulletinItem}>
                    <View style={s.bulletinMeta}>
                      <Badge label={tagLabel} tone={tone} />
                      <Text style={s.bulletinDate}>{b.date}</Text>
                    </View>
                    <Text style={s.bulletinText}>{b.text}</Text>
                  </View>
                )
              })
            })()}
          </Collapsible>
        </View>

        {/* Daily Commuter Tip — train-focused (kept) */}
        <View style={s.tipCard}>
          <DailyTipCard category="train" />
        </View>

        {/* Clear the floating tab bar — Train is a top-level tab now. */}
        <View style={{ height: TAB_BAR_CLEARANCE + insets.bottom }} />
      </ScrollView>
      <Modal visible={picker !== null} animationType="slide" transparent onRequestClose={() => setPicker(null)}>
        <View style={s.modalBackdrop}>
          <View style={s.modalSheet}>
            <View style={s.modalHead}>
              <Text style={s.cardTitle}>{picker === 'from' ? 'From station' : 'To station'}</Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Close station picker"
                activeOpacity={0.7}
                style={s.modalClose}
                onPress={() => setPicker(null)}
              >
                <X size={22} color={INK} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {PICKER_LINES.map((code) => (
                <View key={code} style={{ marginBottom: 12 }}>
                  <View style={s.pickerGroupHead}>
                    <View style={[s.pickerBar, { backgroundColor: LINE_COLORS[code]?.main ?? INK }]} />
                    <Text style={s.pickerGroupTitle}>{LINE_NAMES[code]}</Text>
                  </View>
                  {lineStationNames(code).filter((name) => name !== (picker === 'from' ? toName : fromName)).map((name) => (
                    <Tap
                      key={`${code}-${name}`}
                      onPress={() => pickStation(name)}
                      accessibilityRole="button"
                      accessibilityLabel={`Choose ${name}`}
                      style={s.suggestRow}
                    >
                      <Text style={s.suggestText}>{name}</Text>
                    </Tap>
                  ))}
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

// ─── Styles ──────────────────────────────────────────────

// Board backdrop: the brand adinkra print (same tile as the route hero and the
// Troski card), faint enough that the countdown digits stay the focus.
const boardPatternCache = new Map<string, string>()
function boardPattern(w: number, h: number): string {
  const key = `${w}x${h}`
  let xml = boardPatternCache.get(key)
  if (!xml) { xml = adinkraPatternXml(w, h, 26, 'rgba(255,255,255,0.07)'); boardPatternCache.set(key, xml) }
  return xml
}

const BOARD_ACCENT = '#0ea5e9' // departure-board sky blue — board-only, keeps the station-display look

const getStyles = (isDark: boolean) => {
  const surfaceLowest = isDark ? '#1c1c1e' : ui.card
  const onSurface = INK
  const onSurfaceVariant = '#57534E'
  const outlineVariant = '#EDE5DC'
  const M = 14 // horizontal margin of the redesigned cards (approved mockup)

  return StyleSheet.create({
    container: { flex: 1, backgroundColor: PAPER },

    // ── Header ──
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 18,
      paddingBottom: 10,
      gap: 10,
    },
    headerTitle: { fontSize: 32, lineHeight: 44, fontFamily: font.extrabold, color: INK, letterSpacing: -0.5 },
    headerSub: { fontSize: 14, lineHeight: 20, fontFamily: font.regular, color: '#57534E' },
    clockPill: {
      height: 32,
      paddingHorizontal: 12,
      borderRadius: 999,
      backgroundColor: '#EFE9E3',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    clockPillText: { fontSize: 14, lineHeight: 20, fontFamily: font.bold, color: '#44403C' },

    // ── My trip ──
    tripCard: {
      marginHorizontal: M,
      marginTop: 4,
      backgroundColor: MY_TRIP_CARD,
      borderRadius: 24,
      padding: 16,
      gap: 12,
    },
    tripTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    tripLabel: { fontSize: 15, lineHeight: 22, fontFamily: font.extrabold, color: '#FFD25A', letterSpacing: 0.3 },
    tripChange: {
      minHeight: 36,
      paddingHorizontal: 12,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.25)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    tripChangeText: { fontSize: 13, lineHeight: 20, fontFamily: font.bold, color: '#FFFFFF' },
    tripRoute: { fontSize: 22, lineHeight: 30, fontFamily: font.bold, color: '#FFFFFF' },
    tripSub: { fontSize: 15, lineHeight: 22, fontFamily: font.regular, color: '#D6D3D1' },
    tripTimeRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' },
    tripTime: { fontSize: 44, lineHeight: 60, fontFamily: font.extrabold, color: '#FFFFFF' },
    tripWhen: { fontSize: 16, lineHeight: 24, fontFamily: font.regular, color: '#D6D3D1' },
    tripLeaves: { fontSize: 15, lineHeight: 22, fontFamily: font.bold, color: '#86EFAC' },
    tripBtnRow: { flexDirection: 'row', gap: 8 },
    tripBtn: {
      flex: 1,
      height: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.25)',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    tripBtnOn: {
      flex: 1,
      height: 48,
      borderRadius: 14,
      backgroundColor: '#FF4D1C',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    tripBtnGhost: {
      flex: 1,
      height: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.25)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    tripBtnText: { fontSize: 15, lineHeight: 22, fontFamily: font.extrabold, color: '#FFFFFF' },
    returnBox: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: 12, gap: 4 },
    returnTitle: { fontSize: 14, lineHeight: 20, fontFamily: font.bold, color: '#FFD25A' },
    returnRow: { fontSize: 15, lineHeight: 22, fontFamily: font.medium, color: '#FFFFFF' },
    tripNote: { fontSize: 13, lineHeight: 20, fontFamily: font.regular, color: '#D6D3D1' },

    saveHint: {
      marginHorizontal: M,
      marginTop: 10,
      minHeight: 44,
      paddingHorizontal: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: '#D6CCC2',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    saveHintText: { fontSize: 15, lineHeight: 22, fontFamily: font.semibold, color: '#C2410C' },

    // ── Find a train ──
    findCard: {
      marginHorizontal: M,
      marginTop: 14,
      backgroundColor: '#FFFFFF',
      borderRadius: 22,
      padding: 14,
      borderWidth: 1,
      borderColor: outlineVariant,
      gap: 10,
    },
    cardTitle: { fontSize: 18, lineHeight: 26, fontFamily: font.extrabold, color: INK },
    fieldRow: { flexDirection: 'row', gap: 8 },
    field: { flex: 1, minWidth: 0, backgroundColor: '#F5F1EC', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
    fieldLabel: { fontSize: 13, lineHeight: 20, fontFamily: font.bold, color: '#57534E' },
    fieldValue: { fontSize: 17, lineHeight: 26, fontFamily: font.bold, color: INK },
    fieldPlaceholder: { fontSize: 17, lineHeight: 26, fontFamily: font.bold, color: '#78716C' },
    swapBtn: {
      minHeight: 44,
      borderRadius: 14,
      backgroundColor: '#F5F1EC',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    swapText: { fontSize: 15, lineHeight: 22, fontFamily: font.bold, color: '#44403C' },
    savedRow: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    savedText: { fontSize: 16, lineHeight: 24, fontFamily: font.extrabold, color: '#15803D' },
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    modalSheet: {
      maxHeight: '80%',
      backgroundColor: PAPER,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 24,
    },
    modalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    modalClose: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    pickerGroupHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
    pickerBar: { width: 8, height: 24, borderRadius: 4 },
    pickerGroupTitle: { fontSize: 17, lineHeight: 26, fontFamily: font.extrabold, color: INK },
    suggestRow: { minHeight: 44, paddingHorizontal: 6, justifyContent: 'center' },
    suggestText: { fontSize: 16, lineHeight: 24, fontFamily: font.semibold, color: INK },
    resultNote: { fontSize: 15, lineHeight: 22, fontFamily: font.medium, color: '#44403C' },
    resultBox: { gap: 10 },
    resultRow: { gap: 2, paddingTop: 4, borderTopWidth: 1, borderTopColor: '#F0ECE8' },
    resultTimes: { fontSize: 19, lineHeight: 28, fontFamily: font.extrabold, color: INK },
    resultMeta: { fontSize: 13, lineHeight: 20, fontFamily: font.regular, color: '#57534E' },
    saveBtn: {
      height: 48,
      borderRadius: 14,
      backgroundColor: '#FF4D1C',
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveBtnText: { fontSize: 16, lineHeight: 24, fontFamily: font.extrabold, color: '#FFFFFF' },

    // ── Next trains ──
    nextCard: {
      marginHorizontal: M,
      marginTop: 14,
      backgroundColor: '#FFFFFF',
      borderRadius: 22,
      padding: 14,
      borderWidth: 1,
      borderColor: outlineVariant,
    },
    nextRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
    nextRowBorder: { borderTopWidth: 1, borderTopColor: '#F0ECE8' },
    nextTime: { width: 56, fontSize: 19, lineHeight: 28, fontFamily: font.extrabold, color: INK },
    nextRoute: { fontSize: 16, lineHeight: 24, fontFamily: font.bold, color: INK },
    nextMeta: { fontSize: 13, lineHeight: 20, fontFamily: font.regular, color: '#57534E' },
    bell: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: '#F5F1EC',
      alignItems: 'center',
      justifyContent: 'center',
    },
    bellOn: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: '#FFEDE5',
      alignItems: 'center',
      justifyContent: 'center',
    },

    // ── Akosombo tip ──
    akosombo: {
      marginHorizontal: M,
      marginTop: 14,
      backgroundColor: '#FFF8E8',
      borderRadius: 20,
      padding: 14,
      flexDirection: 'row',
      gap: 10,
      alignItems: 'flex-start',
    },
    akosomboText: { flex: 1, fontSize: 15, lineHeight: 22, fontFamily: font.regular, color: '#44403C' },

    // ── Lines ──
    linesSection: { paddingHorizontal: M, paddingTop: 20, gap: 10 },
    linesTitle: { marginHorizontal: 4, fontSize: 22, lineHeight: 30, fontFamily: font.extrabold, color: INK },
    lineRow: {
      backgroundColor: '#FFFFFF',
      borderRadius: 20,
      borderWidth: 1,
      borderColor: outlineVariant,
      paddingVertical: 14,
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    lineBar: { width: 10, height: 44, borderRadius: 6 },
    lineName: { fontSize: 18, lineHeight: 26, fontFamily: font.bold, color: INK },
    lineMeta: { fontSize: 14, lineHeight: 20, fontFamily: font.regular, color: '#57534E' },
    lineFare: { fontSize: 18, lineHeight: 26, fontFamily: font.bold, color: INK },

    // ── Collapsible sections ──
    collSection: { paddingHorizontal: M, paddingTop: 20, gap: 8 },
    collCard: {
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: outlineVariant,
      borderRadius: 18,
      paddingHorizontal: 16,
    },
    collHead: {
      minHeight: 52,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    collTitle: { fontSize: 17, lineHeight: 26, fontFamily: font.bold, color: INK },
    collBody: { paddingBottom: 14, gap: 12 },
    rideItem: { gap: 2 },
    bulletinItem: { gap: 6 },

    // ── Departure Board (always dark — like a real station display) ──
    board: {
      backgroundColor: '#0c1220',
      marginHorizontal: M,
      marginTop: 14,
      borderRadius: radius.xl,
      padding: 20,
      overflow: 'hidden',
      ...cardShadow,
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
      color: 'rgba(255,255,255,0.72)',
    },
    boardLabel: {
      fontSize: 12,
      fontFamily: font.semibold,
      color: 'rgba(255,255,255,0.65)',
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
      color: 'rgba(255,255,255,0.6)',
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
      color: 'rgba(255,255,255,0.94)',
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
      color: 'rgba(255,255,255,0.72)',
    },
    depFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    depTime: {
      fontSize: 12,
      fontFamily: font.regular,
      color: 'rgba(255,255,255,0.65)',
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
      color: 'rgba(255,255,255,0.72)',
    },
    statusDot: { width: 6, height: 6, borderRadius: 3 },

    // ── Remind-me button (board) ──
    remindBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 16,
      minHeight: 44,
      paddingVertical: 12,
      borderRadius: radius.md,
      backgroundColor: 'rgba(14,165,233,0.12)',
      borderWidth: 1,
      borderColor: 'rgba(14,165,233,0.25)',
    },
    remindBtnOnFull: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 16,
      minHeight: 44,
      paddingVertical: 12,
      borderRadius: radius.md,
      backgroundColor: 'rgba(34,197,94,0.12)',
      borderWidth: 1,
      borderColor: 'rgba(34,197,94,0.3)',
    },
    remindText: {
      fontSize: 13,
      lineHeight: 18,
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
      color: 'rgba(255,255,255,0.6)',
    },
    transitDetails: { gap: 6, marginBottom: 12 },
    transitRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    transitText: {
      fontSize: 13,
      fontFamily: font.regular,
      color: 'rgba(255,255,255,0.72)',
    },
    transitHighlight: {
      fontFamily: font.semibold,
      color: 'rgba(255,255,255,0.94)',
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
      color: 'rgba(255,255,255,0.6)',
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
      color: 'rgba(255,255,255,0.6)',
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

    // ── How to Ride ──
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
      marginHorizontal: M,
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
