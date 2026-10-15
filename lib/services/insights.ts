import { supabase } from '@/lib/supabase/client'
import type { QueueStatus } from '@/lib/security/validate'

/*
 * Insights RPCs (backend migration 103_insights.sql) for UX v2: H7/R2 "Usually long 6–8 am",
 * H10/RW1 "Your reports helped N riders", P9 fare grouping, RW2 weekday streak,
 * RW3 Station Legend, RW4 corridor league.
 *
 * Every wrapper returns null when the RPC fails for any reason — including before 103 is
 * applied (PGRST202 "function not found" / HTTP 404) — so the UI hides the section instead of
 * showing an error. An empty array means "the function ran, there is no data yet".
 * Times are Accra = UTC. `deviceId` is the app's device id (useDeviceId); when signed in, the
 * server also finds the account's linked profiles via auth.uid().
 */

const MAX_IDS = 50

async function call<T>(fn: string, args: Record<string, unknown>): Promise<T[] | null> {
  try {
    const { data, error } = await supabase.rpc(fn, args)
    if (error) {
      // PGRST202 = not deployed yet: expected until 103 runs, so stay quiet.
      if (error.code !== 'PGRST202' && __DEV__) console.warn(`[insights] ${fn}:`, error.message)
      return null
    }
    if (data == null) return []
    return (Array.isArray(data) ? data : [data]) as T[]
  } catch {
    return null
  }
}

const num = (v: unknown): number => (v == null ? 0 : Number(v))
const numOrNull = (v: unknown): number | null => (v == null ? null : Number(v))
const uniqIds = (ids: string[]) => [...new Set(ids.filter(Boolean))].slice(0, MAX_IDS)

/* ── H7 / R2: usual queue ─────────────────────────────────────────── */

export type DayType = 'weekday' | 'sat' | 'sun'

export interface QueueUsualBucket {
  dayType: DayType
  hour: number // 5..20, UTC = Accra
  typicalStatus: QueueStatus
  typicalLevel: number // 0 empty … 4 very_long (average)
  reports: number // ≥ 3 (sparser buckets are not returned)
}

/**
 * 8-week pattern for a station. Reports match by station id; reports without a station id match
 * by name unless several stations share it. Name only (no id): the one station with that name.
 */
export async function fetchQueueUsual(stationId: string | null, stationName?: string | null): Promise<QueueUsualBucket[] | null> {
  const rows = await call<{ day_type: DayType; hour: number; typical_status: QueueStatus; typical_level: number; reports: number }>(
    'queue_usual', { p_station_id: stationId, p_station_name: stationName ?? null },
  )
  return rows?.map((r) => ({
    dayType: r.day_type,
    hour: num(r.hour),
    typicalStatus: r.typical_status,
    typicalLevel: num(r.typical_level),
    reports: num(r.reports),
  })) ?? null
}

/* ── H10 / RW1: riders helped ─────────────────────────────────────── */

export type ReportKind = 'queue' | 'fare' | 'incident'

/**
 * Tell the server this rider saw these reports (fire-and-forget). Only SIGNED-IN viewers count
 * (one per account, server reads auth.uid()); anonymous calls return 0, so callers may skip the
 * call when signed out. deviceId is optional and only marks more of the viewer's own reports,
 * which never count. Only fresh, attributed reports count (queue/incident < 2 h, fare < 24 h);
 * repeats are ignored; ≤ 300 new views per account per day. Returns how many new views were
 * counted, or null on failure. Max 50 ids per call.
 */
export async function noteReportsSeen(kind: ReportKind, reportIds: string[], deviceId?: string | null): Promise<number | null> {
  const ids = uniqIds(reportIds)
  if (ids.length === 0) return 0
  const rows = await call<number>('note_reports_seen', { p_kind: kind, p_ids: ids, p_viewer: deviceId ?? null })
  return rows ? num(rows[0]) : null
}

export interface MyImpact {
  ridersHelped7d: number // distinct signed-in accounts that saw my fresh reports
  ridersHelped30d: number
  queueReports30d: number
  fareReports30d: number
  incidentReports30d: number
}

export async function fetchMyImpact(deviceId: string | null): Promise<MyImpact | null> {
  const rows = await call<{
    riders_helped_7d: number; riders_helped_30d: number
    queue_reports_30d: number; fare_reports_30d: number; incident_reports_30d: number
  }>('my_impact', { p_device: deviceId })
  if (!rows) return null
  const r = rows[0]
  return {
    ridersHelped7d: num(r?.riders_helped_7d),
    ridersHelped30d: num(r?.riders_helped_30d),
    queueReports30d: num(r?.queue_reports_30d),
    fareReports30d: num(r?.fare_reports_30d),
    incidentReports30d: num(r?.incident_reports_30d),
  }
}

/* ── P9: fare grouping ────────────────────────────────────────────── */

export interface FareGroupToday {
  routeId: string
  todayReports: number // fare reports today (UTC)
  topFare: number | null // most-reported amount today (ties: most recent)
  topFareReports: number // "paid by N riders today"
  minFare: number | null
  maxFare: number | null
  usualFare: number | null // median of the 7 previous days
  usualReports: number // reports behind usualFare — suggest hiding "usual" below 3
}

/** Routes with no fare report in the last 8 days are left out. Max 50 route ids. */
export async function fetchFareGroupsToday(routeIds: string[]): Promise<FareGroupToday[] | null> {
  const ids = uniqIds(routeIds)
  if (ids.length === 0) return []
  const rows = await call<{
    route_id: string; today_reports: number; top_fare: number | null; top_fare_reports: number
    min_fare: number | null; max_fare: number | null; usual_fare: number | null; usual_reports: number
  }>('fare_groups_today', { p_route_ids: ids })
  return rows?.map((r) => ({
    routeId: r.route_id,
    todayReports: num(r.today_reports),
    topFare: numOrNull(r.top_fare),
    topFareReports: num(r.top_fare_reports),
    minFare: numOrNull(r.min_fare),
    maxFare: numOrNull(r.max_fare),
    usualFare: numOrNull(r.usual_fare),
    usualReports: num(r.usual_reports),
  })) ?? null
}

/* ── RW2: weekday streak ──────────────────────────────────────────── */

export interface WeekdayStreak {
  streak: number // reporting weekdays in a row; weekends skipped, 1 rest day per week
  weekDays: [boolean, boolean, boolean, boolean, boolean] // this week Mon..Fri reported?
  restDayUsed: boolean // this week's free rest day is spent
  reportedToday: boolean
}

export async function fetchWeekdayStreak(deviceId: string | null): Promise<WeekdayStreak | null> {
  const rows = await call<{ streak: number; week_days: boolean[] | null; rest_day_used: boolean; reported_today: boolean }>(
    'my_weekday_streak', { p_device: deviceId },
  )
  if (!rows) return null
  const r = rows[0]
  const d = r?.week_days ?? []
  return {
    streak: num(r?.streak),
    weekDays: [!!d[0], !!d[1], !!d[2], !!d[3], !!d[4]],
    restDayUsed: !!r?.rest_day_used,
    reportedToday: !!r?.reported_today,
  }
}

/* ── RW3: Station Legend ──────────────────────────────────────────── */

export interface StationLegend {
  stationId: string
  legendName: string // display name, or "A rider"
  legendReports: number // queue reports in the last 30 days
  reporters: number // riders who reported there in 30 days
}

/** Stations with no attributed rider report in 30 days are left out. Max 50 ids. */
export async function fetchStationLegends(stationIds: string[]): Promise<StationLegend[] | null> {
  const ids = uniqIds(stationIds)
  if (ids.length === 0) return []
  const rows = await call<{ station_id: string; legend_name: string; legend_reports: number; reporters: number }>(
    'station_legends', { p_station_ids: ids },
  )
  return rows?.map((r) => ({
    stationId: r.station_id,
    legendName: r.legend_name,
    legendReports: num(r.legend_reports),
    reporters: num(r.reporters),
  })) ?? null
}

export interface MyStationRank {
  stationId: string | null // null for a free-text station without a stations row
  stationName: string
  myRank: number // 1 = Legend
  myReports: number
  legendName: string
  legendReports: number
  isLegend: boolean
}

/** My top 2 stations (30 days). */
export async function fetchMyStationRanks(deviceId: string | null): Promise<MyStationRank[] | null> {
  const rows = await call<{
    station_id: string | null; station_name: string; my_rank: number; my_reports: number
    legend_name: string; legend_reports: number; is_legend: boolean
  }>('my_station_ranks', { p_device: deviceId })
  return rows?.map((r) => ({
    stationId: r.station_id,
    stationName: r.station_name,
    myRank: num(r.my_rank),
    myReports: num(r.my_reports),
    legendName: r.legend_name,
    legendReports: num(r.legend_reports),
    isLegend: !!r.is_legend,
  })) ?? null
}

/* ── RW4: corridor league ─────────────────────────────────────────── */

export interface LeagueRow {
  rank: number
  displayName: string // "A rider" for unnamed/private riders; a private own name shows only when signed in as its owner
  reports: number
  isMe: boolean
}

export interface CorridorLeague {
  rows: LeagueRow[] // ≤ 10, around my rank (top 10 when I'm not ranked)
  rankedRiders: number
  daysLeft: number // including today: Mon 7 … Sun 1
}

/** This ISO week's league. corridorKey = corridorKey(from, to) from lib/constants/corridors ("CIR|KNS"). */
export async function fetchCorridorLeague(corridorKey: string, deviceId: string | null): Promise<CorridorLeague | null> {
  const rows = await call<{ rank: number; display_name: string; reports: number; is_me: boolean; days_left: number; ranked_riders: number }>(
    'corridor_league', { p_corridor: corridorKey, p_device: deviceId },
  )
  if (!rows) return null
  const isoDow = ((new Date().getUTCDay() + 6) % 7) + 1
  return {
    rows: rows.map((r) => ({ rank: num(r.rank), displayName: r.display_name, reports: num(r.reports), isMe: !!r.is_me })),
    rankedRiders: rows.length ? num(rows[0].ranked_riders) : 0,
    daysLeft: rows.length ? num(rows[0].days_left) : 8 - isoDow,
  }
}
