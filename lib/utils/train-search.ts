import { TRAIN_SCHEDULES } from '@/lib/constants/train-schedule'
import { getGhanaTime } from '@/lib/utils/time'
import type { QueueStatus } from '@/lib/services/stations'

/* ── Shared types ─────────────────────────────────── */

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
  liveTag?: 'live' | 'scheduled' | 'done'
  lineName?: string
  routeLabel?: string
  color: string
  sortKey: number
  href: string
  queueStatus?: QueueStatus
  isVerified?: boolean
}

/* ── Get all train lines with live timing ─────────── */

export function getTrainLines(): NearbyLine[] {
  const { hours, minutes, day } = getGhanaTime()
  const nowMins = hours * 60 + minutes
  const results: NearbyLine[] = []

  if (day === 0) {
    for (const [lineId, schedules] of Object.entries(TRAIN_SCHEDULES)) {
      const sch = schedules[0]
      if (!sch) continue
      const first = sch.stops[0]
      const last = sch.stops[sch.stops.length - 1]
      results.push({
        id: `train-${lineId}`,
        type: 'train',
        from: first.station,
        to: last.station,
        fare: sch.fare,
        timeNumber: 'Mon',
        timeUnit: first.depart ?? '06:00',
        liveTag: 'done',
        lineName: lineId.toUpperCase(),
        color: TRANSPORT_COLORS.train,
        sortKey: 9999,
        href: '/train',
      })
    }
    return results
  }

  for (const [lineId, schedules] of Object.entries(TRAIN_SCHEDULES)) {
    for (const sch of schedules) {
      const first = sch.stops[0]
      const last = sch.stops[sch.stops.length - 1]
      const departTime = first.depart ?? first.arrive ?? '00:00'
      const arriveTime = last.arrive ?? last.depart ?? '23:59'
      const [dh, dm] = departTime.split(':').map(Number)
      const [ah, am] = arriveTime.split(':').map(Number)
      const departMins = dh * 60 + dm
      const arriveMins = ah * 60 + am

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
          href: '/train',
        })
      } else if (nowMins >= departMins && nowMins <= arriveMins) {
        results.push({
          id: `train-${sch.id}`,
          type: 'train',
          from: first.station,
          to: last.station,
          fare: sch.fare,
          // Schedule wall-clock math, NOT telemetry — never present as "LIVE" (UX-09)
          timeNumber: 'NOW',
          timeUnit: '',
          liveTag: 'live',
          lineName: lineId.toUpperCase(),
          color: TRANSPORT_COLORS.train,
          sortKey: -1,
          href: '/train',
        })
      }
    }
  }

  if (results.length === 0) {
    for (const [lineId, schedules] of Object.entries(TRAIN_SCHEDULES)) {
      const sch = schedules[0]
      if (!sch) continue
      const first = sch.stops[0]
      const last = sch.stops[sch.stops.length - 1]
      const nextDay = day === 6 ? 'Mon' : 'Tmrw'
      results.push({
        id: `train-${lineId}-next`,
        type: 'train',
        from: first.station,
        to: last.station,
        fare: sch.fare,
        timeNumber: nextDay,
        timeUnit: first.depart ?? '06:00',
        liveTag: 'done',
        lineName: lineId.toUpperCase(),
        color: TRANSPORT_COLORS.train,
        sortKey: 9999,
        href: '/train',
      })
    }
  }

  return results
}

/* ── Search train schedules by station name query ── */

export interface TrainSearchResult {
  id: string
  lineId: string
  lineName: string
  from: string
  to: string
  fare: number
  timeLabel: string
  liveTag: 'live' | 'scheduled' | 'done'
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

    const sch = schedules[0]
    if (!sch) continue
    const first = sch.stops[0]
    const last = sch.stops[sch.stops.length - 1]

    // Compute live timing
    let timeLabel = ''
    let liveTag: 'live' | 'scheduled' | 'done' = 'done'

    if (day === 0) {
      timeLabel = 'No Sunday service'
    } else {
      // Find best schedule status for this line
      let bestStatus: 'live' | 'scheduled' | 'done' = 'done'
      let bestTimeLabel = ''

      for (const s of schedules) {
        const departTime = s.stops[0].depart ?? s.stops[0].arrive ?? '00:00'
        const arriveTime = s.stops[s.stops.length - 1].arrive ?? s.stops[s.stops.length - 1].depart ?? '23:59'
        const [dh, dm] = departTime.split(':').map(Number)
        const [ah, am] = arriveTime.split(':').map(Number)
        const departMins = dh * 60 + dm
        const arriveMins = ah * 60 + am

        if (nowMins >= departMins && nowMins <= arriveMins) {
          bestStatus = 'live'
          bestTimeLabel = 'In transit (scheduled)'
          break
        } else if (nowMins < departMins) {
          const minsLeft = departMins - nowMins
          if (bestStatus !== 'scheduled' || !bestTimeLabel) {
            bestStatus = 'scheduled'
            bestTimeLabel = minsLeft < 60
              ? `Departs in ${minsLeft} min`
              : `Departs in ${Math.floor(minsLeft / 60)}h ${minsLeft % 60}m`
          }
        }
      }

      if (bestStatus === 'done') {
        const nextDay = day === 6 ? 'Monday' : 'tomorrow'
        bestTimeLabel = `Next: ${nextDay} ${first.depart ?? '06:00'}`
      }

      timeLabel = bestTimeLabel
      liveTag = bestStatus
    }

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
