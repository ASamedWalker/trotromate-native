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
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Haptics from 'expo-haptics'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { SkeletonTrainCard } from '@/components/Skeleton'
import { useRouter, useFocusEffect } from 'expo-router'
import {
  TrainFront,
  Bell,
  BellRing,
  ChevronDown,
  MapPin,
  ArrowLeftRight,
  Check,
  X,
  Repeat,
} from 'lucide-react-native'
import { font, brand, ui, space, radius, cardShadow } from '@/lib/theme'
import { Tap } from '@/components/ui'
import { HeroText } from '@/components/HeroText'
import { DailyTipCard } from '@/components/DailyTipCard'
import { useTrainLines } from '@/lib/hooks/useTrain'
import { useDepartureReminders } from '@/lib/hooks/useDepartureReminders'
import { REMINDER_LEAD_MINUTES, showReminderFailureAlert } from '@/lib/services/trainReminders'
import { getGhanaTime } from '@/lib/utils/time'
import { TRAIN_SCHEDULES, SCHEDULE_VERIFIED, TRAIN_CARD_TEXT, arrivalLabel, runsOnDay, type TrainSchedule } from '@/lib/constants/train-schedule'
import { HOW_TO_RIDE } from '@/lib/constants/train-network'
import { RailNewsList, RailLineStatusCard, RailSafetyCard } from '@/components/train/RailNewsSection'
import {
  LINE_COLORS,
  STATION_NAMES,
  findDirectRuns,
  searchStations,
  lineStationNames,
  getFare,
  fareWithChild,
  noConnectionText,
  lineFareLabel,
  serviceDayNumbers,
  toMinutes,
} from '@/lib/utils/train-stations'
import { TAB_BAR_CLEARANCE } from '@/app/(tabs)/_layout'
import { ReleaseTrainTop } from '@/components/train/ReleaseTrainTop'
import {
  BOARD_NAVY,
  useMinuteNow,
  formatIn,
  ghCedi,
  runFareGh,
  deviceOffAccraTime,
  departuresBoard,
  type DepartureRow,
} from '@/components/train/trainTime'

// ─── Schedule helpers ────────────────────────────────────

function parseTimeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function getCurrentStation(schedule: TrainSchedule, currentMinutes: number) {
  // Only stops with a published time count — GRDA publishes end-to-end times
  // only on TMP/STK, so intermediate stops can have no time at all.
  for (let i = schedule.stops.length - 1; i >= 0; i--) {
    const t = schedule.stops[i].arrive || schedule.stops[i].depart
    if (!t) continue
    if (currentMinutes >= parseTimeToMinutes(t)) {
      const next = schedule.stops.slice(i + 1).find((x) => x.arrive || x.depart) ?? null
      return {
        current: schedule.stops[i].station,
        next: next?.station ?? null,
        nextArr: next?.arrive ?? null,
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

/** Compute next departure for a single line (direction-agnostic). Service
 *  days are per run (`days`: "Daily", "Mon – Sat") — TMP/STK run daily per GRDA,
 *  TMA's last published timetable is Mon–Sat. */
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

  const sorted = [...schedules].sort(
    (a, b) => parseTimeToMinutes(a.stops[0].depart!) - parseTimeToMinutes(b.stops[0].depart!)
  )

  for (const sched of sorted) {
    if (!runsOnDay(sched.days, day)) continue
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
        progress: (currentMinutes - depart) / Math.max(1, arrive - depart),
        destination: sched.stops[sched.stops.length - 1].station,
        currentStation: pos.current,
        nextStation: pos.next,
        nextArrival: pos.nextArr,
        arrivalTime: arrivalLabel(sched),
      }
    }
  }

  // Today's runs are done (or none today) — count down to the first run on the
  // NEXT day this line runs, so the board (and the reminder armed from it)
  // never targets a phantom train.
  for (let daysAhead = 1; daysAhead <= 7; daysAhead++) {
    const d = (day + daysAhead) % 7
    const first = sorted.find((sc) => runsOnDay(sc.days, d))
    if (!first) continue
    const firstDepart = parseTimeToMinutes(first.stops[0].depart!)
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
  return { type: 'no-service' }
}


// ─── Screen helpers (My trip, Find a train, Departures) ───

const MY_TRIP_KEY = 'troski_my_train_trip'
const PAPER = ui.bg // #FAFAF9 — UX v2 mockup screen ground
const INK = '#1C1917'
const MUTED = '#5F6670'
const HAIRLINE = '#F0EFED'
const LINE_NAMES: Record<string, string> = {
  TMA: 'Tema – Accra',
  TMP: 'Tema – Afienya – Adomi',
  STK: 'Sekondi – Takoradi',
}
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
/** Upcoming rows shown before "Show all" (plus the last departed one). */
const DEPARTURES_PREVIEW = 5

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

/** "(52 min)" / "(1 h 15 min)" */
function durationText(min: number): string {
  if (min < 60) return `(${min} min)`
  const h = Math.floor(min / 60)
  return min % 60 ? `(${h} h ${min % 60} min)` : `(${h} h)`
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

/** T5 departures row: 72pt, "06:00 – 06:52 (52 min)", line chip, countdown
 *  (green only at 15 min or less), GH₵ fare; past trains greyed. */
function DepartureListRow({
  r,
  dayLabel,
  first,
  onPress,
  s,
}: {
  r: DepartureRow
  dayLabel: string | null
  first: boolean
  onPress?: () => void
  s: ReturnType<typeof getStyles>
}) {
  const color = LINE_COLORS[r.lineCode] ?? { main: INK, tint: '#F3F4F6' }
  const times = `${r.depart}${r.arrive ? ` – ${r.arrivalApprox ? 'about ' : ''}${r.arrive}` : ''}`
  const dur = r.durationMin !== null && r.durationMin > 0 ? durationText(r.durationMin) : ''
  const soon = !r.departed && r.remainingMin <= 15
  const when = dayLabel ?? formatIn(r.remainingMin)
  const fare = runFareGh(r.schedule)
  const unconfirmed = r.schedule.fare === null
  return (
    <Tap
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={`${r.departed ? 'Departed, scheduled ' : ''}${r.depart} from ${r.origin} to ${r.destination}${
        r.arrive ? `, arrives ${r.arrivalApprox ? 'about ' : ''}${r.arrive}` : ''
      }, ${LINE_NAMES[r.lineCode] ?? r.lineCode} line${r.departed ? '' : `, ${when}`}, ${fare}`}
      style={[r.departed ? s.depRowPast : s.depRow, !first && s.depRowBorder]}
    >
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={r.departed ? s.depTimesPast : s.depTimes} numberOfLines={1}>
          {times}
          {dur ? <Text style={r.departed ? s.depDurPast : s.depDur}> {dur}</Text> : null}
        </Text>
        {r.departed ? (
          <Text style={s.depPastNote}>Departed (scheduled)</Text>
        ) : (
          <View style={s.depMetaRow}>
            <View style={[s.lineChip, { backgroundColor: color.tint }]}>
              <Text style={[s.lineChipText, { color: color.main }]}>{r.lineCode}</Text>
            </View>
            <Text style={soon ? s.depSoon : s.depLater}>{when}</Text>
            <Text style={s.depRoute} numberOfLines={1}>· {r.origin} → {r.destination}</Text>
          </View>
        )}
      </View>
      <Text style={[unconfirmed ? s.depFareNote : s.depFare, r.departed && { color: '#A8A29E' }]} numberOfLines={2}>
        {fare}
      </Text>
    </Tap>
  )
}

// ─── Main screen ─────────────────────────────────────────

export default function TrainLinesScreen() {
  const router = useRouter()
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const s = useMemo(() => getStyles(), [])
  const insets = useSafeAreaInsets()

  const { lines, isLoading, refetch } = useTrainLines()
  const { isSet, toggle, refresh } = useDepartureReminders()
  useFocusEffect(
    useCallback(() => {
      refresh()
    }, [refresh]),
  )
  const lineIdByCode = useMemo(() => Object.fromEntries((lines ?? []).map((l) => [l.code, l.id])) as Record<string, string>, [lines])

  // Arm / disarm a departure reminder. `key` is the storage key (the bare
  // schedule id for whole-run reminders, "<id>@<station>" for My trip).
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

  // T1: one clock that only changes on the minute — no per-second ticking.
  const now = useMinuteNow()

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
  const resultY = useRef(0)

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
      scrollRef.current?.scrollTo({ y: Math.max(0, resultY.current - 120), animated: true })
    }, 350)
    return () => clearTimeout(id)
  }, [result])

  const swapStations = () => {
    Haptics.selectionAsync()
    setFromName(toName)
    setToName(fromName)
  }

  // ── Departures (T5) ──
  const board = useMemo(() => departuresBoard(now), [now])
  const [showAllDeps, setShowAllDeps] = useState(false)
  const depRows = useMemo(() => {
    const upcoming = board.rows.filter((r) => !r.departed)
    const past = board.rows.filter((r) => r.departed)
    const lastPast = past.length ? [past[past.length - 1]] : []
    return {
      visible: [...lastPast, ...(showAllDeps ? upcoming : upcoming.slice(0, DEPARTURES_PREVIEW))],
      hidden: Math.max(0, upcoming.length - DEPARTURES_PREVIEW),
    }
  }, [board, showAllDeps])

  const renderMyTrip = () => {
    if (!trip || !tripInfo) return null
    const best = tripInfo.best
    const key = best ? tripReminderKey(best.run.schedule, trip.from) : ''
    const armed = best ? isSet(key) : false
    const lineName = best ? (LINE_NAMES[best.run.lineCode] ?? best.run.lineCode).replace(/ – /g, '–') : ''
    const arriveMin = best ? best.run.arriveLabel : ''
    const canRemind = best ? armed || best.seconds > REMINDER_LEAD_MINUTES * 60 : false
    return (
      <View style={s.tripCard}>
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
          <HeroText size={20} style={{ color: '#FFFFFF' }}>{trip.from} → {trip.to}</HeroText>
          {best ? (
            <Text style={s.tripSub}>
              {lineName} line · {ghCedi(getFare(best.run.lineCode, trip.from, trip.to).label)} · {compactDays(best.run.schedule.days)}
            </Text>
          ) : null}
        </View>
        {best ? (
          <>
            <View style={s.tripTimeRow}>
              <HeroText size={44} style={{ color: '#FFFFFF', fontVariant: ['tabular-nums'] }}>{best.run.departFrom}</HeroText>
              <Text style={s.tripWhen}>{whenLabel(best.offset, now)} · arrives {arriveMin}</Text>
            </View>
            <Text style={s.tripLeaves}>Leaves {formatIn(Math.ceil(best.seconds / 60))}</Text>
            <View style={s.tripChipRow}>
              <View style={s.tripChip}>
                <Text style={s.tripChipText}>TIMETABLE</Text>
              </View>
              <Text style={s.tripChipNote}>Not live tracking</Text>
            </View>
            {!best.run.timesExact ? (
              <Text style={s.tripNote}>
                {`${trip.from} time not published — ${best.run.departFrom} is when it leaves ${best.run.schedule.stops[0].station}.`}
              </Text>
            ) : null}
            <View style={s.tripBtnRow}>
              {canRemind ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={armed ? 'Reminder on. Tap to cancel' : `Remind me ${REMINDER_LEAD_MINUTES} minutes before`}
                  accessibilityState={{ selected: armed }}
                  activeOpacity={0.85}
                  style={s.tripBtn}
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
                  {armed ? <BellRing size={18} color={BOARD_NAVY} /> : <Bell size={18} color={BOARD_NAVY} />}
                  <Text style={s.tripBtnText}>{armed ? 'Reminder on' : 'Remind me'}</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Return times"
                accessibilityState={{ expanded: showReturn }}
                activeOpacity={0.85}
                style={s.tripBtnGhost}
                onPress={() => setShowReturn((v) => !v)}
              >
                <Text style={s.tripBtnGhostText}>Return times</Text>
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
                      {r.departLabel} → {r.arriveLabel} · {compactDays(r.schedule.days)}
                    </Text>
                  ))
                )}
              </View>
            )}
            {armed ? (
              <Text style={s.tripNote}>
                {`We'll notify you at ${hhmm(toMinutes(best.run.departFrom) - REMINDER_LEAD_MINUTES)}. Works offline.`}
              </Text>
            ) : null}
          </>
        ) : (
          <Text style={s.tripNote}>
            {tripInfo.hasRuns
              ? 'No upcoming departure found.'
              : 'There is no direct train for this trip any more. Tap Change to pick another.'}
          </Text>
        )}
      </View>
    )
  }

  const openLine = (code: string) => {
    const id = lineIdByCode[code]
    if (id) router.push({ pathname: '/train/[lineId]', params: { lineId: id } })
  }

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      {/* Status-bar scrim so content never collides with the clock */}
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top, backgroundColor: PAPER, zIndex: 10 }} />
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
        {/* ─── Header (T2: one clock — the phone's own status bar) ─── */}
        <View style={[s.header, { paddingTop: insets.top + 12 }]}>
          <HeroText size={28} style={{ color: ui.text, letterSpacing: -0.3 }} accessibilityRole="header">Trains</HeroText>
          <Text style={s.headerSub}>Timetables from GRDA and GRCL · checked {formatVerified(SCHEDULE_VERIFIED)}</Text>
          {deviceOffAccraTime() ? <Text style={s.headerSub}>Times shown in Accra time</Text> : null}
        </View>

        {/* ─── Next train (saved trip takes this slot when one exists) ─── */}
        {trip ? renderMyTrip() : <ReleaseTrainTop now={now} />}

        {/* ─── Find a train (T4: directly under the next-departure card) ─── */}
        <View style={s.findCard}>
          <Tap
            onPress={() => setPicker('from')}
            accessibilityRole="button"
            accessibilityLabel={`Find a train. From station: ${fromName || 'not chosen'}`}
            style={s.findField}
          >
            <Text style={s.fieldLabel}>From</Text>
            <Text style={fromName ? s.fieldValue : s.fieldPlaceholder} numberOfLines={1}>{fromName || 'Choose station'}</Text>
          </Tap>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Swap From and To"
            activeOpacity={0.7}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            style={s.swapCircle}
            onPress={swapStations}
          >
            <ArrowLeftRight size={18} color={INK} />
          </TouchableOpacity>
          <Tap
            onPress={() => setPicker('to')}
            accessibilityRole="button"
            accessibilityLabel={`To station: ${toName || 'not chosen'}`}
            style={[s.findField, { alignItems: 'flex-end' }]}
          >
            <Text style={s.fieldLabel}>To</Text>
            <Text style={toName ? s.fieldValue : s.fieldPlaceholder} numberOfLines={1}>{toName || 'Choose station'}</Text>
          </Tap>
        </View>

        {result && (
          <View style={s.resultCard} onLayout={(e) => { resultY.current = e.nativeEvent.layout.y }}>
            {result.kind === 'unknown' && <Text style={s.resultNote}>{result.message}</Text>}
            {result.kind === 'none' && (
              <Text style={s.resultNote}>
                No direct train between {result.from.name} and {result.to.name}.
              </Text>
            )}
            {result.kind === 'transfer' && (
              <View style={s.resultBox}>
                <View style={s.changeChip}>
                  <Repeat size={16} color="#92400E" />
                  <Text style={s.changeChipText}>Change at {result.via} · two separate shuttles</Text>
                </View>
                {([
                  { label: `1. ${result.from.name} → ${result.via}`, runs: result.first, fare: result.firstFare },
                  { label: `2. ${result.via} → ${result.to.name}`, runs: result.second, fare: result.secondFare },
                ] as const).map((leg) => (
                  <View key={leg.label} style={{ gap: 4 }}>
                    <Text style={s.resultMeta}>
                      <Text style={{ color: INK, fontFamily: font.extrabold }}>{leg.label}</Text>
                      {' · '}{ghCedi(fareWithChild(leg.fare))}
                    </Text>
                    {leg.runs.map((r) => (
                      <View key={r.schedule.id} style={s.resultRow}>
                        <Text style={s.resultTimes}>{r.departLabel} → {r.arriveLabel}</Text>
                        {r.schedule.note ? <Text style={s.resultMeta}>{r.schedule.note}</Text> : null}
                        {leg.runs === result.first && result.noConnection.includes(r) ? (
                          <Text style={[s.resultMeta, { color: '#B91C1C', fontFamily: font.bold }]}>{noConnectionText(r, result.to.name)}</Text>
                        ) : null}
                      </View>
                    ))}
                  </View>
                ))}
                <Text style={s.resultMeta}>{compactDays(result.days)} · check the connection time at {result.via}. Timetable times, not live tracking.</Text>
              </View>
            )}
            {result.kind === 'direct' && (
              <View style={s.resultBox}>
                {result.runs.map((r) => (
                  <View key={r.schedule.id} style={s.resultRow}>
                    <Text style={s.resultTimes}>{r.departLabel} → {r.arriveLabel}</Text>
                    <Text style={s.resultMeta}>
                      <Text style={{ color: LINE_COLORS[r.lineCode]?.main ?? INK, fontFamily: font.extrabold }}>
                        {(LINE_NAMES[r.lineCode] ?? r.lineCode).replace(/ – /g, '–')}
                      </Text>
                      {' · '}{compactDays(r.schedule.days)} · {ghCedi(fareWithChild(getFare(r.lineCode, result.from.name, result.to.name)))}
                    </Text>
                    {r.schedule.note ? <Text style={s.resultMeta}>{r.schedule.note}</Text> : null}
                  </View>
                ))}
                {result.runs.some((r) => !r.timesExact) ? (
                  <Text style={s.resultMeta}>“after” / “by” = the train’s first or last stop time. GRDA does not publish times for every stop.</Text>
                ) : null}
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
        )}

        {/* ─── Departures (T5) ─────────────────────────────── */}
        {board.rows.length > 0 && (
          <View style={s.depSection}>
            <Text style={s.sectionLabel}>DEPARTURES · {board.label.toUpperCase()}</Text>
            <View style={s.depCard}>
              {depRows.visible.map((r, i) => (
                <DepartureListRow
                  key={r.key}
                  r={r}
                  first={i === 0}
                  dayLabel={board.offset === 0 ? null : board.label}
                  onPress={lineIdByCode[r.lineCode] ? () => openLine(r.lineCode) : undefined}
                  s={s}
                />
              ))}
              {depRows.hidden > 0 && (
                <Tap
                  onPress={() => setShowAllDeps((v) => !v)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: showAllDeps }}
                  style={[s.depMore, s.depRowBorder]}
                >
                  <Text style={s.depMoreText}>
                    {showAllDeps ? 'Show fewer' : `Show all ${board.label.toLowerCase() === 'today' ? "today's" : board.label === 'Tomorrow' ? "tomorrow's" : `${board.label}'s`} trains`}
                  </Text>
                  <ChevronDown size={18} color={MUTED} style={showAllDeps ? { transform: [{ rotate: '180deg' }] } : undefined} />
                </Tap>
              )}
            </View>
          </View>
        )}

        {/* ─── Akosombo tip ───────────────────────────────── */}
        <View style={s.akosombo}>
          <MapPin size={22} color="#FF4D1C" fill="#FF4D1C" style={{ marginTop: 3 }} />
          <Text style={s.akosomboText}>
            <Text style={{ fontFamily: font.extrabold, color: INK }}>Going to Akosombo? </Text>
            {'Take the Tema–Afienya train, change at Afienya, then ride to Adomi, the last passenger stop. There is no passenger train to Mpakadan.'}
          </Text>
        </View>

        {/* ─── Lines ──────────────────────────────────────── */}
        <View style={s.linesSection}>
          <HeroText size={22} style={s.linesTitle} accessibilityRole="header">Lines</HeroText>
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
                  <Text style={s.lineFare}>{ghCedi(lineFareLabel(item.code))}</Text>
                </Tap>
              )
            })
          )}
        </View>

        {/* ─── How to ride (collapsed) ─── */}
        <View style={s.collSection}>
          <Collapsible title="How to ride" s={s}>
            {HOW_TO_RIDE.map((tip) => (
              <View key={tip.title} style={s.rideItem}>
                <Text style={s.rideCardTitle}>{tip.title}</Text>
                <Text style={s.rideCardText}>{ghCedi(tip.text)}</Text>
              </View>
            ))}
          </Collapsible>
          <Text style={s.cardNote}>{ghCedi(TRAIN_CARD_TEXT)}</Text>
        </View>

        {/* ─── Rail news, line status, safety ─── */}
        <View style={s.newsSection}>
          <RailLineStatusCard
            lineIdByCode={lineIdByCode}
            onOpenLine={(id) => router.push({ pathname: '/train/[lineId]', params: { lineId: id } })}
          />
          <RailNewsList limit={5} />
          <RailSafetyCard />
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

const getStyles = () => {
  const outline = '#EEEEEE'
  const M = 20 // screen gutter of the UX v2 mockup

  return StyleSheet.create({
    container: { flex: 1, backgroundColor: PAPER },

    // ── Header ──
    header: { paddingHorizontal: M, paddingBottom: 0 },
    headerSub: { fontSize: 13, lineHeight: 20, fontFamily: font.medium, color: MUTED },

    // ── My trip (navy board, T7 white reminder button) ──
    tripCard: {
      marginHorizontal: M,
      marginTop: 12,
      backgroundColor: BOARD_NAVY,
      borderRadius: 20,
      paddingHorizontal: 18,
      paddingVertical: 16,
      gap: 10,
    },
    tripTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    tripLabel: { fontSize: 12, lineHeight: 18, fontFamily: font.extrabold, color: 'rgba(255,255,255,0.75)', letterSpacing: 0.7 },
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
    tripSub: { fontSize: 14, lineHeight: 20, fontFamily: font.regular, color: 'rgba(255,255,255,0.8)' },
    tripTimeRow: { flexDirection: 'row', alignItems: 'flex-end', columnGap: 10, flexWrap: 'wrap' },
    tripWhen: { fontSize: 16, lineHeight: 24, fontFamily: font.medium, color: 'rgba(255,255,255,0.85)', marginBottom: 10 },
    tripLeaves: { fontSize: 16, lineHeight: 22, fontFamily: font.bold, color: '#FFFFFF' },
    tripChipRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    tripChip: { backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
    tripChipText: { fontSize: 12, fontFamily: font.extrabold, letterSpacing: 0.6, color: '#FFFFFF' },
    tripChipNote: { fontSize: 13, fontFamily: font.medium, color: 'rgba(255,255,255,0.8)' },
    tripBtnRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
    tripBtn: {
      flex: 1,
      height: 48,
      borderRadius: 12,
      backgroundColor: '#FFFFFF',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    tripBtnText: { fontSize: 16, lineHeight: 22, fontFamily: font.bold, color: BOARD_NAVY },
    tripBtnGhost: {
      flex: 1,
      height: 48,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.3)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    tripBtnGhostText: { fontSize: 16, lineHeight: 22, fontFamily: font.bold, color: '#FFFFFF' },
    returnBox: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: 12, gap: 4 },
    returnTitle: { fontSize: 14, lineHeight: 20, fontFamily: font.bold, color: '#FFFFFF' },
    returnRow: { fontSize: 15, lineHeight: 22, fontFamily: font.medium, color: '#FFFFFF' },
    tripNote: { fontSize: 13, lineHeight: 20, fontFamily: font.regular, color: 'rgba(255,255,255,0.8)' },

    // ── Find a train (one compact From | swap | To card) ──
    findCard: {
      marginHorizontal: M,
      marginTop: 14,
      backgroundColor: '#FFFFFF',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: outline,
      paddingHorizontal: 14,
      paddingVertical: 6,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    findField: { flex: 1, minWidth: 0, minHeight: 48, justifyContent: 'center' },
    fieldLabel: { fontSize: 12, lineHeight: 18, fontFamily: font.medium, color: MUTED },
    fieldValue: { fontSize: 16, lineHeight: 22, fontFamily: font.bold, color: ui.text },
    fieldPlaceholder: { fontSize: 16, lineHeight: 22, fontFamily: font.bold, color: '#78716C' },
    swapCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: '#F3F4F6',
      alignItems: 'center',
      justifyContent: 'center',
    },
    resultCard: {
      marginHorizontal: M,
      marginTop: 10,
      backgroundColor: '#FFFFFF',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: outline,
      padding: 14,
      gap: 10,
    },
    cardTitle: { fontSize: 18, lineHeight: 26, fontFamily: font.extrabold, color: INK },
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
    modalClose: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
    pickerGroupHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
    pickerBar: { width: 8, height: 24, borderRadius: 4 },
    pickerGroupTitle: { fontSize: 17, lineHeight: 26, fontFamily: font.extrabold, color: INK },
    suggestRow: { minHeight: 48, paddingHorizontal: 6, justifyContent: 'center' },
    suggestText: { fontSize: 16, lineHeight: 24, fontFamily: font.semibold, color: INK },
    resultNote: { fontSize: 15, lineHeight: 22, fontFamily: font.medium, color: '#44403C' },
    resultBox: { gap: 10 },
    resultRow: { gap: 2, paddingTop: 4, borderTopWidth: 1, borderTopColor: HAIRLINE },
    resultTimes: { fontSize: 19, lineHeight: 28, fontFamily: font.extrabold, color: INK },
    resultMeta: { fontSize: 13, lineHeight: 20, fontFamily: font.regular, color: '#57534E' },
    saveBtn: {
      height: 48,
      borderRadius: 12,
      backgroundColor: '#FF4D1C',
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveBtnText: { fontSize: 16, lineHeight: 24, fontFamily: font.extrabold, color: '#FFFFFF' },
    changeChip: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', backgroundColor: '#FFF3D6', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
    changeChipText: { fontSize: 14, lineHeight: 20, fontFamily: font.bold, color: '#92400E' },

    // ── Departures (T5) ──
    depSection: { marginHorizontal: M, marginTop: 14 },
    sectionLabel: { fontSize: 12, lineHeight: 18, fontFamily: font.extrabold, letterSpacing: 0.7, color: MUTED },
    depCard: {
      marginTop: 6,
      backgroundColor: '#FFFFFF',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: outline,
      overflow: 'hidden',
    },
    depRow: { minHeight: 72, paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
    depRowPast: { minHeight: 64, paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
    depRowBorder: { borderTopWidth: 1, borderTopColor: HAIRLINE },
    depTimes: { fontSize: 16, lineHeight: 24, fontFamily: font.extrabold, color: ui.text, fontVariant: ['tabular-nums'] },
    depTimesPast: { fontSize: 16, lineHeight: 24, fontFamily: font.bold, color: '#A8A29E', fontVariant: ['tabular-nums'] },
    depDur: { fontFamily: font.medium, color: MUTED },
    depDurPast: { fontFamily: font.medium, color: '#A8A29E' },
    depPastNote: { fontSize: 13, lineHeight: 18, fontFamily: font.medium, color: '#A8A29E' },
    depMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    lineChip: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 1 },
    lineChipText: { fontSize: 12, lineHeight: 18, fontFamily: font.extrabold, letterSpacing: 0.6 },
    depSoon: { fontSize: 14, lineHeight: 20, fontFamily: font.extrabold, color: '#15803D' },
    depLater: { fontSize: 14, lineHeight: 20, fontFamily: font.bold, color: MUTED },
    depRoute: { flexShrink: 1, fontSize: 13, lineHeight: 20, fontFamily: font.regular, color: MUTED },
    depFare: { fontSize: 16, lineHeight: 24, fontFamily: font.bold, color: ui.text, fontVariant: ['tabular-nums'] },
    depFareNote: { maxWidth: 84, textAlign: 'right', fontSize: 13, lineHeight: 18, fontFamily: font.semibold, color: MUTED },
    depMore: { minHeight: 48, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
    depMoreText: { fontSize: 15, lineHeight: 22, fontFamily: font.bold, color: ui.text },

    // ── Akosombo tip ──
    akosombo: {
      marginHorizontal: M,
      marginTop: 14,
      backgroundColor: '#FFF8E8',
      borderRadius: 16,
      padding: 14,
      flexDirection: 'row',
      gap: 10,
      alignItems: 'flex-start',
    },
    akosomboText: { flex: 1, fontSize: 15, lineHeight: 22, fontFamily: font.regular, color: '#44403C' },

    // ── Lines ──
    linesSection: { paddingHorizontal: M, paddingTop: 20, gap: 10 },
    linesTitle: { marginHorizontal: 4, color: INK },
    lineRow: {
      backgroundColor: '#FFFFFF',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: outline,
      paddingVertical: 14,
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    lineBar: { width: 10, height: 44, borderRadius: 6 },
    lineName: { fontSize: 18, lineHeight: 26, fontFamily: font.bold, color: INK },
    lineMeta: { fontSize: 14, lineHeight: 20, fontFamily: font.regular, color: '#57534E' },
    lineFare: { fontSize: 17, lineHeight: 26, fontFamily: font.bold, color: INK },

    // ── Collapsible sections ──
    collSection: { paddingHorizontal: M, paddingTop: 20, gap: 8 },
    collCard: {
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: outline,
      borderRadius: 16,
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
    cardNote: { fontSize: 13, lineHeight: 20, fontFamily: font.regular, color: '#57534E', paddingHorizontal: 4 },
    newsSection: { paddingHorizontal: M, paddingTop: 20, gap: 14 },
    rideItem: { gap: 2 },
    rideCardTitle: { fontSize: 14, fontFamily: font.bold, color: INK, marginBottom: 4 },
    rideCardText: { fontSize: 13, fontFamily: font.regular, color: '#57534E', lineHeight: 19 },

    // ── Daily Tip ──
    tipCard: {
      marginHorizontal: M,
      marginTop: space.section,
      borderRadius: radius.lg,
      backgroundColor: ui.card,
      overflow: 'hidden',
      ...cardShadow,
    },

    // ── Empty ──
    emptyCard: {
      padding: 32,
      borderRadius: radius.lg,
      backgroundColor: ui.card,
      alignItems: 'center',
      ...cardShadow,
    },
    emptyTitle: { fontSize: 16, fontFamily: font.semibold, color: '#57534E', marginTop: 12 },
    emptySub: { fontSize: 13, fontFamily: font.regular, color: '#57534E', marginTop: 4, textAlign: 'center' },
  })
}
