import React, { useEffect, useState } from 'react'
import { AppState, View, Text } from 'react-native'
import { font } from '@/lib/theme'
import { HeroText } from '@/components/HeroText'
import { RollText } from '@/components/motion/RollText'
import { TRAIN_SCHEDULES, runsOnDay, runFareLabelShort, type TrainSchedule } from '@/lib/constants/train-schedule'
import { toMinutes } from '@/lib/utils/train-stations'

/**
 * Shared Train-screen time + label rules (UX v2 "Train" decisions T1–T3, T5, T7).
 * - T1: never show seconds; digits change on the minute only.
 * - T2: one clock — note "Times shown in Accra time" only off UTC+0.
 * - T3: one "Timetable" chip + "Not live tracking".
 * - T7: always "GH₵", never a bare "₵".
 * Ghana time = UTC (no DST), so getUTC* is Accra time.
 */

export const BOARD_NAVY = '#0B1B3F'
export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** Current time that only changes on the minute boundary (and when the app
 *  returns to the foreground), so countdowns roll once a minute — never per second. */
export function useMinuteNow(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>
    const schedule = () => {
      t = setTimeout(() => {
        setNow(new Date())
        schedule()
      }, 60_000 - (Date.now() % 60_000) + 50)
    }
    schedule()
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') setNow(new Date())
    })
    return () => {
      clearTimeout(t)
      sub.remove()
    }
  }, [])
  return now
}

/** "in 12 min", "in 1 h 22 min", "in 2 h". */
export function formatIn(minutes: number): string {
  const m = Math.max(0, Math.round(minutes))
  if (m < 60) return `in ${m} min`
  const h = Math.floor(m / 60)
  return m % 60 ? `in ${h} h ${m % 60} min` : `in ${h} h`
}

/** "₵15" -> "GH₵15" (leaves existing "GH₵" alone). */
export function ghCedi(text: string): string {
  return text.replace(/(GH)?₵/g, 'GH₵')
}

/** Row fare: "GH₵15", or the unconfirmed label when the fare is not published. */
export function runFareGh(s: TrainSchedule): string {
  return s.fare === null ? 'Fare unconfirmed' : ghCedi(runFareLabelShort(s))
}

/** True when the phone is not on UTC+0 (Accra), so we must say whose clock the times are on. */
export function deviceOffAccraTime(): boolean {
  return new Date().getTimezoneOffset() !== 0
}

/** T1 countdown: under 60 min -> minutes big + "min · departs HH:MM";
 *  60 min or more -> clock time big + "in 1 h 22 min". White on the navy board. */
export function BigCountdown({ minutes, departTime, color = '#FFFFFF' }: { minutes: number; departTime: string; color?: string }) {
  const under = minutes < 60
  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap', columnGap: 8, marginTop: 2 }}
      accessible
      accessibilityLabel={`Departs at ${departTime}, ${formatIn(minutes)}`}
    >
      <RollText value={under ? minutes : departTime}>
        <HeroText size={56} style={{ color, fontVariant: ['tabular-nums'] }}>{under ? minutes : departTime}</HeroText>
      </RollText>
      <Text style={{ fontFamily: font.bold, fontSize: 17, color, marginBottom: 13 }}>
        {under ? `min · departs ${departTime}` : formatIn(minutes)}
      </Text>
    </View>
  )
}

/** T3: one "Timetable" chip + "Not live tracking" (on the navy board). */
export function TimetableChips() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
      <View style={{ backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
        <Text style={{ fontFamily: font.extrabold, fontSize: 12, letterSpacing: 0.6, color: '#FFFFFF' }}>TIMETABLE</Text>
      </View>
      <Text style={{ fontFamily: font.medium, fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>Not live tracking</Text>
    </View>
  )
}

// ─── Departures list (T5) ────────────────────────────────

export interface DepartureRow {
  key: string
  lineCode: string
  schedule: TrainSchedule
  origin: string
  destination: string
  depart: string
  /** terminus arrival HH:MM (null when not published) */
  arrive: string | null
  arrivalApprox: boolean
  durationMin: number | null
  /** minutes from now to departure (negative = already left) */
  remainingMin: number
  departed: boolean
}

export interface DepartureDay {
  /** 0 = today, 1 = tomorrow, … */
  offset: number
  /** "Today" | "Tomorrow" | weekday name */
  label: string
  /** true when the network has no run at all today (e.g. a Sunday-only gap) */
  noServiceToday: boolean
  rows: DepartureRow[]
}

function rowsForDay(dow: number, offset: number, nowMin: number): DepartureRow[] {
  const rows: DepartureRow[] = []
  for (const [lineCode, runs] of Object.entries(TRAIN_SCHEDULES)) {
    for (const s of runs) {
      if (!runsOnDay(s.days, dow)) continue
      const depart = s.stops[0].depart
      if (!depart) continue
      const arrive = s.stops[s.stops.length - 1].arrive
      const dm = toMinutes(depart)
      const remainingMin = offset * 1440 + dm - nowMin
      rows.push({
        key: `${s.id}-${offset}`,
        lineCode,
        schedule: s,
        origin: s.stops[0].station,
        destination: s.stops[s.stops.length - 1].station,
        depart,
        arrive,
        arrivalApprox: !!s.arrivalApprox,
        durationMin: arrive ? toMinutes(arrive) - dm : null,
        remainingMin,
        departed: remainingMin <= 0,
      })
    }
  }
  return rows.sort((a, b) => a.remainingMin - b.remainingMin)
}

/** Today's departures across every line (Ghana time). When nothing is left
 *  today, the list for the next day that has service, honestly labelled. */
export function departuresBoard(now: Date): DepartureDay {
  const dow = now.getUTCDay()
  const nowMin = now.getUTCHours() * 60 + now.getUTCMinutes()
  const today = rowsForDay(dow, 0, nowMin)
  if (today.some((r) => !r.departed)) {
    return { offset: 0, label: 'Today', noServiceToday: false, rows: today }
  }
  for (let offset = 1; offset <= 7; offset++) {
    const d = (dow + offset) % 7
    const rows = rowsForDay(d, offset, nowMin)
    if (rows.length) {
      return {
        offset,
        label: offset === 1 ? 'Tomorrow' : WEEKDAY_NAMES[d],
        noServiceToday: today.length === 0,
        rows,
      }
    }
  }
  return { offset: 0, label: 'Today', noServiceToday: today.length === 0, rows: [] }
}
