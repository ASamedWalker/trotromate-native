// copy of trotromate/lib/train-stations.ts — keep in sync
import { TRAIN_SCHEDULES, type TrainSchedule, type ScheduleStop } from "@/lib/constants/train-schedule"

// Line display names (inlined: this repo has no lib/train-lines; same values as
// trotromate/lib/train-lines.ts LINE_META).
const LINE_META: Record<string, { name: string; short: string }> = {
  TMA: { name: "Tema – Accra", short: "TEMA–ACCRA" },
  TMP: { name: "Tema – Mpakadan", short: "TEMA–MPAKADAN" },
  STK: { name: "Sekondi – Takoradi", short: "SEKONDI–TAKORADI" },
}

// Pure helpers for station pages, the station-to-station search and the
// "Next trains" board. All data comes from TRAIN_SCHEDULES (single source).
// Ghana is UTC+0 year-round, so Date UTC getters give Ghana time.

export const ZONE_FARE_UNKNOWN = "₵15–40 zone fare · confirm at the station"

export const LINE_COLORS: Record<string, { main: string; tint: string }> = {
  TMA: { main: "#1D4ED8", tint: "#EEF3FF" },
  TMP: { main: "#0F766E", tint: "#ECF7F5" },
  STK: { main: "#92400E", tint: "#FBF3E8" },
}

const WEEK_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

// ─── Stations ───────────────────────────────────────────

export interface Station {
  name: string
  slug: string
  lineCode: string
}

/** "Odaw (Circle)" -> "odaw-circle" */
export function stationSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
}

export const STATIONS: Station[] = (() => {
  const seen = new Set<string>()
  const out: Station[] = []
  for (const [lineCode, schedules] of Object.entries(TRAIN_SCHEDULES)) {
    for (const s of schedules) {
      for (const stop of s.stops) {
        const slug = stationSlug(stop.station)
        if (seen.has(slug)) continue
        seen.add(slug)
        out.push({ name: stop.station, slug, lineCode })
      }
    }
  }
  return out
})()

export const STATION_NAMES: string[] = STATIONS.map((s) => s.name)

export function getStationBySlug(slug: string): Station | null {
  return STATIONS.find((s) => s.slug === slug) ?? null
}

/** Resolve free text to a station: exact (case-insensitive), else a unique prefix match. */
export function findStation(query: string): Station | null {
  const q = stationSlug(query)
  if (!q) return null
  const exact = STATIONS.find((s) => s.slug === q)
  if (exact) return exact
  const prefixed = STATIONS.filter((s) => s.slug.startsWith(q))
  return prefixed.length === 1 ? prefixed[0] : null
}

/** Ordered station names of a line (first schedule's direction). */
export function lineStationNames(lineCode: string): string[] {
  return (TRAIN_SCHEDULES[lineCode]?.[0]?.stops ?? []).map((s) => s.station)
}

// ─── Days ───────────────────────────────────────────────

/** "Mon – Sat" -> [1..6] (JS getUTCDay numbers). */
export function serviceDayNumbers(days: string): number[] {
  const [start, end] = days.split("–").map((d) => d.trim().slice(0, 3))
  const a = WEEK_DAYS.findIndex((d) => d.startsWith(start))
  const b = WEEK_DAYS.findIndex((d) => d.startsWith(end))
  if (a === -1 || b === -1) return []
  const out: number[] = []
  for (let i = a; i <= b; i++) out.push(i)
  return out
}

/** "Mon – Sat" -> "Monday to Saturday" */
export function daysLong(days: string): string {
  const nums = serviceDayNumbers(days)
  if (!nums.length) return days
  return `${WEEK_DAYS[nums[0]]} to ${WEEK_DAYS[nums[nums.length - 1]]}`
}

/** "Mon – Fri" -> "Saturday or Sunday" (days with no service). */
export function missingDaysText(days: string): string {
  const nums = serviceDayNumbers(days)
  const missing = [6, 0].filter((d) => !nums.includes(d)).map((d) => WEEK_DAYS[d])
  return missing.join(" or ")
}

/** "Mon – Sat" -> "No Sunday service" */
export function noServiceLabel(days: string): string {
  return `No ${missingDaysText(days)} service`
}

/** Network-wide note derived from the schedules, e.g.
 *  "No Sunday service · Sekondi–Takoradi runs Mon–Fri". */
export function noServiceSummary(): string {
  const all = Object.entries(TRAIN_SCHEDULES).map(([code, sch]) => ({ code, days: sch[0].days }))
  const served = new Set(all.flatMap((l) => serviceDayNumbers(l.days)))
  const closed = [6, 0].filter((d) => !served.has(d)).map((d) => WEEK_DAYS[d])
  const widest = Math.max(...all.map((l) => serviceDayNumbers(l.days).length))
  const parts = closed.length ? [`No ${closed.join(" or ")} service`] : []
  for (const l of all) {
    if (serviceDayNumbers(l.days).length < widest) {
      parts.push(`${(LINE_META[l.code]?.name ?? l.code).replace(/ – /g, "–")} runs ${l.days.replace(/ – /g, "–")}`)
    }
  }
  return parts.join(" · ")
}

/** Heading used for title and H1; avoids "Tema Station Train Station". */
export function stationHeading(name: string): string {
  return /station$/i.test(name) ? `${name} (train)` : `${name} Train Station`
}

/** Schema.org name: append "Station" only when the name lacks it. */
export function stationSchemaName(name: string): string {
  return /station$/i.test(name) ? name : `${name} Station`
}

export function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number)
  return h * 60 + m
}

// ─── Fares (real data only) ─────────────────────────────

export interface FareResult {
  amount: number | null
  /** "₵15" or the honest zone-fare fallback */
  label: string
}

const fareResult = (amount: number | null): FareResult => ({
  amount,
  label: amount === null ? ZONE_FARE_UNKNOWN : `₵${amount}`,
})

/**
 * Fare between two stations on one line.
 * TMA flat ₵15, STK flat ₵10. TMP: only Tema Harbour<->Afienya ₵15 and
 * Tema Harbour<->Mpakadan ₵40 are published; every other pair -> null.
 */
export function getFare(lineCode: string, from: string, to: string): FareResult {
  if (from === to) return fareResult(null)
  if (lineCode === "TMA") return fareResult(15)
  if (lineCode === "STK") return fareResult(10)
  if (lineCode === "TMP") {
    // Only two pair fares are published: Tema Harbour<->Afienya and Tema Harbour<->Mpakadan.
    const pair = [from, to].sort().join("|")
    if (pair === ["Afienya", "Tema Harbour"].sort().join("|")) return fareResult(15)
    if (pair === ["Mpakadan", "Tema Harbour"].sort().join("|")) return fareResult(40)
    return fareResult(null)
  }
  return fareResult(null)
}

/** Line-level headline fare, e.g. "₵15", "₵15–40". */
export function lineFareLabel(lineCode: string): string {
  if (lineCode === "TMP") return "₵15–40"
  return `₵${TRAIN_SCHEDULES[lineCode]?.[0]?.fare ?? 0}`
}

// ─── Station-to-station search ──────────────────────────

export interface DirectRun {
  lineCode: string
  schedule: TrainSchedule
  departFrom: string
  arriveTo: string
}

/** Runs where `from` appears before `to` in the same schedule's stops. */
export function findDirectRuns(from: string, to: string): DirectRun[] {
  const runs: DirectRun[] = []
  for (const [lineCode, schedules] of Object.entries(TRAIN_SCHEDULES)) {
    for (const schedule of schedules) {
      const i = schedule.stops.findIndex((s) => s.station === from)
      const j = schedule.stops.findIndex((s) => s.station === to)
      if (i === -1 || j === -1 || i >= j) continue
      const departFrom = schedule.stops[i].depart
      const arriveTo = schedule.stops[j].arrive
      if (!departFrom || !arriveTo) continue
      runs.push({ lineCode, schedule, departFrom, arriveTo })
    }
  }
  return runs.sort((x, y) => toMinutes(x.departFrom) - toMinutes(y.departFrom))
}

export type SearchResult =
  | { kind: "unknown"; message: string }
  | { kind: "direct"; from: Station; to: Station; runs: DirectRun[]; fare: FareResult; days: string }
  | { kind: "none"; from: Station; to: Station }

export function searchStations(fromText: string, toText: string): SearchResult {
  const from = findStation(fromText)
  const to = findStation(toText)
  if (!from || !to) {
    return { kind: "unknown", message: "Pick two stations from the suggestions." }
  }
  if (from.slug === to.slug) {
    return { kind: "unknown", message: "Choose two different stations." }
  }
  const runs = findDirectRuns(from.name, to.name)
  if (!runs.length) return { kind: "none", from, to }
  return {
    kind: "direct",
    from,
    to,
    runs,
    fare: getFare(runs[0].lineCode, from.name, to.name),
    days: runs[0].schedule.days,
  }
}

// ─── Station page data ──────────────────────────────────

export interface StationRun {
  lineCode: string
  schedule: TrainSchedule
  stop: ScheduleStop
  index: number
  origin: ScheduleStop
  terminus: ScheduleStop
  /** time the train is at this station: depart, or arrive at the terminus */
  time: string
  isOrigin: boolean
  isTerminus: boolean
}

export function getStationRuns(name: string): StationRun[] {
  const runs: StationRun[] = []
  for (const [lineCode, schedules] of Object.entries(TRAIN_SCHEDULES)) {
    for (const schedule of schedules) {
      const index = schedule.stops.findIndex((s) => s.station === name)
      if (index === -1) continue
      const stop = schedule.stops[index]
      const time = stop.depart ?? stop.arrive
      if (!time) continue
      runs.push({
        lineCode,
        schedule,
        stop,
        index,
        origin: schedule.stops[0],
        terminus: schedule.stops[schedule.stops.length - 1],
        time,
        isOrigin: index === 0,
        isTerminus: index === schedule.stops.length - 1,
      })
    }
  }
  return runs.sort((a, b) => toMinutes(a.time) - toMinutes(b.time))
}

/** Fares from this station to every other station on its line. */
export function getStationFares(station: Station): { to: string; fare: FareResult }[] {
  return lineStationNames(station.lineCode)
    .filter((n) => n !== station.name)
    .map((to) => ({ to, fare: getFare(station.lineCode, station.name, to) }))
}

/** Exact fares plus the stations whose fare is not published. */
export function getStationFareSummary(station: Station) {
  const all = getStationFares(station)
  return {
    exact: all.filter((f) => f.fare.amount !== null) as { to: string; fare: FareResult & { amount: number } }[],
    unknown: all.filter((f) => f.fare.amount === null).map((f) => f.to),
  }
}

/** One natural sentence about fares, for meta descriptions. */
export function stationFareSentence(station: Station): string {
  const { exact, unknown } = getStationFareSummary(station)
  if (!exact.length) return `Fares from ${station.name} are GRDA zone fares of ₵15 to ₵40.`
  if (station.lineCode !== "TMP") return `Fares from ${station.name} are ₵${exact[0].fare.amount}, paid with TapnGo.`
  const parts = exact.map((f) => `₵${f.fare.amount} to ${f.to}`)
  return `Fares from ${station.name}: ${joinNames(parts)}${unknown.length ? ", other stations are zone fares" : ""}.`
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join("")
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`
}

/** FAQ for a station page — SINGLE source for the visible FAQ and the FAQPage JSON-LD. */
export function getStationFaqs(station: Station): { question: string; answer: string }[] {
  const name = station.name
  const line = LINE_META[station.lineCode]?.name ?? station.lineCode
  const runs = getStationRuns(name)
  const days = runs[0]?.schedule.days ?? ""

  const leaving = runs.filter((r) => !r.isTerminus)
  const timesAnswer =
    leaving
      .map((r) => `The ${r.schedule.code} to ${r.terminus.station} leaves ${name} at ${r.time} and arrives at ${r.terminus.arrive}.`)
      .join(" ") + (days ? ` It runs ${daysLong(days)}.` : "")

  const { exact, unknown } = getStationFareSummary(station)
  let fareAnswer: string
  if (station.lineCode === "TMP") {
    if (exact.length) {
      const parts = exact.map((f) => `₵${f.fare.amount} to ${f.to}`)
      fareAnswer = `The published GRDA fares from ${name} are ${joinNames(parts)}.`
      if (unknown.length) fareAnswer += " Fares to the other stations on the line are zone fares between ₵15 and ₵40, so confirm the exact fare at the station."
      fareAnswer += " Pay with a TapnGo card."
    } else {
      fareAnswer = `Train fares from ${name} are GRDA zone fares between ₵15 and ₵40. Confirm the exact fare at the station and pay with a TapnGo card.`
    }
  } else {
    fareAnswer = `The fare from ${name} to any other station on the ${line} line is ₵${exact[0].fare.amount}, paid with a TapnGo card.`
  }

  const missing = missingDaysText(days)
  const sundayAnswer = `No. Trains at ${name} run ${daysLong(days)} only, so there is no ${missing} service.`

  return [
    { question: `What time does the train leave ${name}?`, answer: timesAnswer },
    { question: `How much is the train fare from ${name}?`, answer: fareAnswer },
    { question: `Is there a train at ${name} on Sunday?`, answer: sundayAnswer },
  ]
}

// ─── Next trains board ──────────────────────────────────

export interface NextDeparture {
  lineCode: string
  lineName: string
  runCode: string
  origin: string
  destination: string
  departTime: string
  fareLabel: string
  /** days ahead (0 = today); null when not computed (server placeholder) */
  offset: number | null
  remainingMinutes: number | null
  /** "Today" | "Tomorrow" | weekday name | "" */
  when: string
}

function lineRuns(lineCode: string): TrainSchedule[] {
  return [...(TRAIN_SCHEDULES[lineCode] ?? [])].sort(
    (a, b) => toMinutes(a.stops[0].depart!) - toMinutes(b.stops[0].depart!)
  )
}

function toNext(lineCode: string, s: TrainSchedule): NextDeparture {
  return {
    lineCode,
    lineName: LINE_META[lineCode]?.name ?? lineCode,
    runCode: s.code,
    origin: s.stops[0].station,
    destination: s.stops[s.stops.length - 1].station,
    departTime: s.stops[0].depart!,
    fareLabel: lineFareLabel(lineCode),
    offset: null,
    remainingMinutes: null,
    when: "",
  }
}

/** Stable (time-independent) fallback: each line's first run. Used for SSR / pre-mount. */
export function placeholderDepartures(): NextDeparture[] {
  return Object.keys(TRAIN_SCHEDULES).map((code) => toNext(code, lineRuns(code)[0]))
}

/** Next departure per line from `now` (Ghana time = UTC), soonest first. */
export function nextDepartures(now: Date): NextDeparture[] {
  const nowSec = now.getUTCHours() * 3600 + now.getUTCMinutes() * 60 + now.getUTCSeconds()
  const today = now.getUTCDay()
  const out: NextDeparture[] = []
  for (const code of Object.keys(TRAIN_SCHEDULES)) {
    const runs = lineRuns(code)
    let found: NextDeparture | null = null
    for (let offset = 0; offset <= 7 && !found; offset++) {
      const dow = (today + offset) % 7
      for (const s of runs) {
        if (!serviceDayNumbers(s.days).includes(dow)) continue
        const depSec = toMinutes(s.stops[0].depart!) * 60
        if (offset === 0 && depSec <= nowSec) continue
        const remainingMinutes = Math.ceil((offset * 86400 + depSec - nowSec) / 60)
        found = {
          ...toNext(code, s),
          offset,
          remainingMinutes,
          when: offset === 0 ? "Today" : offset === 1 ? "Tomorrow" : WEEK_DAYS[dow],
        }
        break
      }
    }
    if (found) out.push(found)
  }
  return out.sort((a, b) => a.remainingMinutes! - b.remainingMinutes!)
}

export function formatRemaining(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}
