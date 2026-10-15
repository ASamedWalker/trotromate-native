import { TRAIN_SCHEDULES, runsOnDay, type TrainSchedule } from '@/lib/constants/train-schedule'
import { getGhanaTime } from '@/lib/utils/time'
import type { QueueStatus } from '@/lib/services/stations'

const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** 'Tmrw' or the weekday the line next runs (per-run `days`). */
function nextServiceDay(days: string, today: number): string {
  for (let add = 1; add <= 7; add++) {
    const d = (today + add) % 7
    if (runsOnDay(days, d)) return add === 1 ? 'Tmrw' : DAY_ABBR[d]
  }
  return 'Tmrw'
}

/* ── Shared types ─────────────────────────────────── */

/** Train timing tag — schedule math only, never live telemetry. */
export type TrainTimeTag = 'in-transit-scheduled' | 'scheduled' | 'done'

export const TRANSPORT_COLORS = {
  trotro: '#f59e0b',
  train: '#0ea5e9',
  okada: '#22c55e',
}

export interface NearbyLine {
  id: string
  type: 'trotro' | 'train' | 'okada'
  from: string
  to: string
  fare: number | null
  timeNumber: string
  timeUnit: string
  liveTag?: TrainTimeTag
  lineName?: string
  routeLabel?: string
  color: string
  sortKey: number
  href: string
  queueStatus?: QueueStatus
  isVerified?: boolean
}

/* ── Next train per line direction (scheduled timing) ─── */

/** Max train cards in the nearby list, so trotro lines are not crowded out. */
export const MAX_NEARBY_TRAIN_CARDS = 3

function hm(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export function getTrainLines(): NearbyLine[] {
  const { hours, minutes, day } = getGhanaTime()
  const nowMins = hours * 60 + minutes
  const results: NearbyLine[] = []

  // One card per line direction: the run in transit (scheduled) or the soonest upcoming today.
  for (const [lineId, schedules] of Object.entries(TRAIN_SCHEDULES)) {
    const byDir = new Map<string, TrainSchedule[]>()
    for (const sch of schedules) {
      if (!runsOnDay(sch.days, day)) continue
      const key = `${sch.stops[0].station}>${sch.stops[sch.stops.length - 1].station}`
      if (!byDir.has(key)) byDir.set(key, [])
      byDir.get(key)!.push(sch)
    }
    for (const runs of byDir.values()) {
      const sorted = [...runs].sort((a, b) => hm(a.stops[0].depart ?? '00:00') - hm(b.stops[0].depart ?? '00:00'))
      for (const sch of sorted) {
        const first = sch.stops[0]
        const last = sch.stops[sch.stops.length - 1]
        const departMins = hm(first.depart ?? first.arrive ?? '00:00')
        const arriveMins = hm(last.arrive ?? last.depart ?? '23:59')
        if (nowMins < departMins) {
          const minsLeft = departMins - nowMins
          results.push({
            id: `train-${sch.id}`,
            type: 'train',
            from: first.station,
            to: last.station,
            fare: sch.fare,
            timeNumber: minsLeft < 60 ? `${minsLeft}` : `${Math.floor(minsLeft / 60)}h${minsLeft % 60}`,
            timeUnit: minsLeft < 60 ? 'minutes' : '',
            liveTag: 'scheduled',
            lineName: lineId.toUpperCase(),
            color: TRANSPORT_COLORS.train,
            sortKey: minsLeft,
            href: '/(tabs)/train',
          })
          break
        }
        if (nowMins <= arriveMins) {
          results.push({
            id: `train-${sch.id}`,
            type: 'train',
            from: first.station,
            to: last.station,
            fare: sch.fare,
            // Schedule wall-clock math, NOT telemetry — never present as "LIVE" (UX-09)
            timeNumber: 'NOW',
            timeUnit: '',
            liveTag: 'in-transit-scheduled',
            lineName: lineId.toUpperCase(),
            color: TRANSPORT_COLORS.train,
            sortKey: 0,
            href: '/(tabs)/train',
          })
          break
        }
      }
    }
  }

  if (results.length === 0) {
    for (const [lineId, schedules] of Object.entries(TRAIN_SCHEDULES)) {
      const nd = nextServiceDay(schedules[0]?.days ?? 'Daily', day)
      const d = DAY_ABBR.indexOf(nd === 'Tmrw' ? DAY_ABBR[(day + 1) % 7] : nd)
      const sch = [...schedules]
        .filter((x) => runsOnDay(x.days, d))
        .sort((a, b) => hm(a.stops[0].depart ?? '00:00') - hm(b.stops[0].depart ?? '00:00'))[0]
      if (!sch) continue
      const first = sch.stops[0]
      const last = sch.stops[sch.stops.length - 1]
      results.push({
        id: `train-${lineId}-next`,
        type: 'train',
        from: first.station,
        to: last.station,
        fare: sch.fare,
        timeNumber: nd,
        timeUnit: first.depart ?? '06:00',
        liveTag: 'done',
        lineName: lineId.toUpperCase(),
        color: TRANSPORT_COLORS.train,
        sortKey: 9999,
        href: '/(tabs)/train',
      })
    }
  }

  return results.sort((a, b) => a.sortKey - b.sortKey).slice(0, MAX_NEARBY_TRAIN_CARDS)
}

/* ── Search train schedules by station name query ── */

export interface TrainSearchResult {
  id: string
  lineId: string
  lineName: string
  from: string
  to: string
  fare: number | null
  timeLabel: string
  liveTag: TrainTimeTag
}

export function searchTrainSchedules(query: string): TrainSearchResult[] {
  const q = query.toLowerCase().trim()
  if (q.length < 2) return []

  const { hours, minutes, day } = getGhanaTime()
  const nowMins = hours * 60 + minutes
  const results: TrainSearchResult[] = []
  const seen = new Set<string>()

  for (const [lineId, schedules] of Object.entries(TRAIN_SCHEDULES)) {
    // Check if any station in this line matches the query
    const hasMatch = schedules.some((sch) =>
      sch.stops.some((stop) => stop.station.toLowerCase().includes(q)),
    )
    if (!hasMatch) continue
    if (seen.has(lineId)) continue
    seen.add(lineId)

    if (!schedules[0]) continue
    const sorted = [...schedules].sort((a, b) => hm(a.stops[0].depart ?? '00:00') - hm(b.stops[0].depart ?? '00:00'))
    let sch = sorted[0]
    let timeLabel = ''
    let liveTag: TrainTimeTag = 'done'

    const today = sorted.filter((s) => runsOnDay(s.days, day))
    // Scheduled in-transit run first, else the SOONEST upcoming departure today.
    const inTransit = today.find((s) => {
      const dep = hm(s.stops[0].depart ?? '00:00')
      const arr = hm(s.stops[s.stops.length - 1].arrive ?? '23:59')
      return nowMins >= dep && nowMins <= arr
    })
    const upcoming = today.find((s) => hm(s.stops[0].depart ?? '00:00') > nowMins)
    if (!today.length) {
      timeLabel = `No ${DAY_ABBR[day]} service listed`
    } else if (inTransit) {
      sch = inTransit
      liveTag = 'in-transit-scheduled'
      timeLabel = 'In transit (scheduled)'
    } else if (upcoming) {
      sch = upcoming
      liveTag = 'scheduled'
      const minsLeft = hm(upcoming.stops[0].depart ?? '00:00') - nowMins
      timeLabel = minsLeft < 60 ? `Departs in ${minsLeft} min` : `Departs in ${Math.floor(minsLeft / 60)}h ${minsLeft % 60}m`
    } else {
      const nd = nextServiceDay(sorted[0].days, day)
      timeLabel = `Next: ${nd === 'Tmrw' ? 'tomorrow' : nd} ${sorted[0].stops[0].depart ?? '06:00'}`
    }
    const first = sch.stops[0]
    const last = sch.stops[sch.stops.length - 1]

    results.push({
      id: `train-${lineId}`,
      lineId,
      lineName: lineId.toUpperCase(),
      from: first.station,
      to: last.station,
      fare: sch.fare,
      timeLabel,
      liveTag,
    })
  }

  return results
}
