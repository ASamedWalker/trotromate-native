import { TRAIN_SCHEDULES } from '@/lib/constants/train-schedule'
import { getGhanaTime } from '@/lib/utils/time'

export function parseTimeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export type NextTrainInfo =
  | { status: 'upcoming'; label: string; time: string; from: string; to: string; minsLeft: number }
  | { status: 'in-transit'; label: string; from: string; to: string; arrival: string }
  | { status: 'done-today'; nextDay: string; nextTime: string; from: string; to: string }
  | { status: 'no-service'; nextDay: string; nextTime: string; from: string; to: string }

export function getNextTrain(): NextTrainInfo {
  const ghana = getGhanaTime()
  const schedules = TRAIN_SCHEDULES['TMA'] ?? []
  const firstSchedule = schedules[0]
  const firstStop = firstSchedule?.stops[0]
  const lastStop = firstSchedule?.stops[firstSchedule.stops.length - 1]
  const nextTime = firstStop?.depart ?? '06:00'
  const from = firstStop?.station ?? 'Community 1'
  const to = lastStop?.station ?? 'Accra Central'

  if (ghana.day === 0) {
    return { status: 'no-service', nextDay: 'Monday', nextTime, from, to }
  }

  const mins = ghana.hours * 60 + ghana.minutes

  for (const sch of schedules) {
    const fStop = sch.stops[0]
    const lStop = sch.stops[sch.stops.length - 1]
    const departMin = parseTimeToMinutes(fStop.depart ?? fStop.arrive ?? '00:00')
    const arriveMin = parseTimeToMinutes(lStop.arrive ?? lStop.depart ?? '23:59')

    if (mins < departMin) {
      return {
        status: 'upcoming',
        label: sch.label,
        time: fStop.depart ?? '',
        from: fStop.station,
        to: lStop.station,
        minsLeft: departMin - mins,
      }
    }

    if (mins >= departMin && mins <= arriveMin) {
      return {
        status: 'in-transit',
        label: sch.label,
        from: fStop.station,
        to: lStop.station,
        arrival: lStop.arrive ?? '',
      }
    }
  }

  const nextDay = ghana.day === 6 ? 'Monday' : 'tomorrow'
  return { status: 'done-today', nextDay, nextTime, from, to }
}

export function formatMinsLeft(mins: number): string {
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}
