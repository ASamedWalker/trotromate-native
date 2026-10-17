// copy of trotromate/lib/train-stations.ts — keep in sync
import {
  TRAIN_SCHEDULES, TRAIN_LINE_INFO, PUBLISHED_FARES, TMA_FARE_NOTE, arrivalLabel, lineFareLabel, runFareLabelShort, runsOnDay, serviceDayNumbers,
  type TrainSchedule, type ScheduleStop,
} from "@/lib/constants/train-schedule"

// Line display names (inlined: this repo has no lib/train-lines; same values as
// trotromate/lib/train-lines.ts LINE_META).
export const LINE_META: Record<string, { name: string; short: string }> = {
  TMA: { name: "Tema – Accra", short: "TEMA–ACCRA" },
  TMP: { name: "Tema – Afienya – Adomi", short: "TEMA–AFIENYA–ADOMI" },
  STK: { name: "Sekondi – Takoradi", short: "SEKONDI–TAKORADI" },
}

// Pure helpers for station pages, the station-to-station search and the
// "Next trains" board. All data comes from TRAIN_SCHEDULES (single source).
// Ghana is UTC+0 year-round, so Date UTC getters give Ghana time.
// copy of trotromate/lib/train-stations.ts — keep in sync (LINE_META inlined).

export { serviceDayNumbers, runsOnDay, lineFareLabel }

export const ZONE_FARE_UNKNOWN = "Fare not published · confirm at the station"

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

/** Ordered station names of a line (every shuttle, in route order). */
export function lineStationNames(lineCode: string): string[] {
  const listed = TRAIN_LINE_INFO[lineCode]?.stations
  if (listed?.length) return listed
  return (TRAIN_SCHEDULES[lineCode]?.[0]?.stops ?? []).map((s) => s.station)
}

export const STATIONS: Station[] = (() => {
  const seen = new Set<string>()
  const out: Station[] = []
  for (const lineCode of Object.keys(TRAIN_SCHEDULES)) {
    for (const name of lineStationNames(lineCode)) {
      const slug = stationSlug(name)
      if (seen.has(slug)) continue
      seen.add(slug)
      out.push({ name, slug, lineCode })
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

// ─── Days ───────────────────────────────────────────────

/** "Daily" -> "every day"; "Mon – Sat" -> "Monday to Saturday" */
export function daysLong(days: string): string {
  const nums = serviceDayNumbers(days)
  if (!nums.length) return days
  if (nums.length === 7) return "every day"
  return `${WEEK_DAYS[nums[0]]} to ${WEEK_DAYS[nums[nums.length - 1]]}`
}

/** "Mon – Fri" -> "Saturday or Sunday"; "Daily" -> "" (days with no listed service). */
export function missingDaysText(days: string): string {
  const nums = serviceDayNumbers(days)
  const missing = [6, 0].filter((d) => !nums.includes(d)).map((d) => WEEK_DAYS[d])
  return missing.join(" or ")
}

/** "Daily" -> "Runs daily"; "Mon – Sat" -> "No Sunday service listed · confirm at the station" */
export function noServiceLabel(days: string): string {
  const missing = missingDaysText(days)
  return missing ? `No ${missing} service listed · confirm at the station` : "Runs daily"
}

/** Network-wide days note, e.g.
 *  "Tema–Afienya–Adomi and Sekondi–Takoradi run daily · Tema–Accra runs Mon–Sat (confirm Sunday at the station)". */
export function noServiceSummary(): string {
  const short = (code: string) => (LINE_META[code]?.name ?? code).replace(/ – /g, "–")
  const daily: string[] = []
  const partial: string[] = []
  for (const code of Object.keys(TRAIN_SCHEDULES)) {
    const days = TRAIN_LINE_INFO[code]?.days ?? TRAIN_SCHEDULES[code][0]?.days ?? ""
    if (serviceDayNumbers(days).length === 7) daily.push(short(code))
    else partial.push(`${short(code)} runs ${days.replace(/ – /g, "–")} (confirm Sunday at the station)`)
  }
  const parts: string[] = []
  if (daily.length) parts.push(`${daily.join(" and ")} ${daily.length > 1 ? "run" : "runs"} daily`)
  return [...parts, ...partial].join(" · ")
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

// ─── Fares (published data only) ────────────────────────

export interface FareResult {
  /** Adult fare in GH₵, null when not published */
  amount: number | null
  child: number | null
  /** "GH₵15" or the honest fallback text */
  label: string
}

/**
 * Fare between two stations on one line — only pairs GRDA publishes
 * (PUBLISHED_FARES, basis 'grda'). TMA's fare is unconfirmed; every other pair
 * falls back to "confirm at the station". Never derive or invent a fare.
 */
export function getFare(lineCode: string, from: string, to: string): FareResult {
  if (from === to) return { amount: null, child: null, label: ZONE_FARE_UNKNOWN }
  if (lineCode === "TMA") return { amount: null, child: null, label: TMA_FARE_NOTE }
  const pair = [from, to].sort().join("|")
  const hit = PUBLISHED_FARES.find(
    (f) => f.lineCode === lineCode && f.basis === "grda" && [f.from, f.to].sort().join("|") === pair
  )
  if (hit) return { amount: hit.adult, child: hit.child, label: `GH₵${hit.adult}` }
  return { amount: null, child: null, label: ZONE_FARE_UNKNOWN }
}

/** "No same-evening connection to Tema Harbour" for a first-leg run with no onward train. */
export function noConnectionText(r: DirectRun, to: string): string {
  return `No same-${toMinutes(r.arriveTo) >= 12 * 60 ? "evening" : "day"} connection to ${to}`
}

/** "GH₵15 · child GH₵7" — fare plus child fare when published. */
export function fareWithChild(f: FareResult): string {
  if (f.amount === null) return f.label
  return f.child !== null ? `GH₵${f.amount} · child GH₵${f.child}` : `GH₵${f.amount}`
}

/** Short per-run fare for tight rows: "GH₵15" or "Fare: confirm at station". */
export const runFareShort = runFareLabelShort

// ─── Station-to-station search ──────────────────────────

export interface DirectRun {
  lineCode: string
  schedule: TrainSchedule
  /** HH:MM used for countdowns; when the stop's own time is not published this
   *  is the run's origin departure (the train passes later). */
  departFrom: string
  /** HH:MM; when unpublished, the run's terminus arrival (it arrives earlier). */
  arriveTo: string
  /** Display text: "06:00", "after 06:00" */
  departLabel: string
  /** Display text: "06:45", "by 06:45", "about 16:30" */
  arriveLabel: string
  /** false when either stop's own time is not published */
  timesExact: boolean
}

function stopDepart(s: ScheduleStop): string | null {
  return s.depart ?? s.arrive
}
function stopArrive(s: ScheduleStop): string | null {
  return s.arrive ?? s.depart
}

/** Runs where `from` appears before `to` in the same schedule's stops. */
export function findDirectRuns(from: string, to: string): DirectRun[] {
  const runs: DirectRun[] = []
  for (const [lineCode, schedules] of Object.entries(TRAIN_SCHEDULES)) {
    for (const schedule of schedules) {
      const i = schedule.stops.findIndex((s) => s.station === from)
      const j = schedule.stops.findIndex((s) => s.station === to)
      if (i === -1 || j === -1 || i >= j) continue
      const last = schedule.stops.length - 1
      const ownDep = stopDepart(schedule.stops[i])
      const ownArr = stopArrive(schedule.stops[j])
      const departFrom = ownDep ?? schedule.stops[0].depart
      const arriveTo = ownArr ?? schedule.stops[last].arrive
      if (!departFrom || !arriveTo) continue
      const approxEnd = j === last && schedule.arrivalApprox
      runs.push({
        lineCode,
        schedule,
        departFrom,
        arriveTo,
        departLabel: ownDep ? departFrom : `after ${departFrom}`,
        arriveLabel: !ownArr ? `by ${approxEnd ? arrivalLabel(schedule) : arriveTo}` : approxEnd ? arrivalLabel(schedule) : arriveTo,
        timesExact: !!ownDep && !!ownArr && !approxEnd,
      })
    }
  }
  return runs.sort((x, y) => toMinutes(x.departFrom) - toMinutes(y.departFrom))
}

export type SearchResult =
  | { kind: "unknown"; message: string }
  | { kind: "direct"; from: Station; to: Station; runs: DirectRun[]; fare: FareResult; days: string }
  | {
      kind: "transfer"
      from: Station
      to: Station
      /** station where riders change shuttle (Afienya, Kojokrom) */
      via: string
      first: DirectRun[]
      second: DirectRun[]
      firstFare: FareResult
      secondFare: FareResult
      days: string
      /** first-leg runs with no onward run the same day (e.g. DA2 reaches
       *  Afienya 18:45, after the last Afienya→Tema train at 18:30) */
      noConnection: DirectRun[]
    }
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
  if (runs.length) {
    return {
      kind: "direct",
      from,
      to,
      runs,
      fare: getFare(runs[0].lineCode, from.name, to.name),
      days: runs[0].schedule.days,
    }
  }
  // Shuttle lines: one change at the line's interchange (Afienya, Kojokrom).
  const via = TRAIN_LINE_INFO[from.lineCode]?.changeAt
  if (via && from.lineCode === to.lineCode && via !== from.name && via !== to.name) {
    const first = findDirectRuns(from.name, via)
    const second = findDirectRuns(via, to.name)
    if (first.length && second.length) {
      return {
        kind: "transfer",
        from,
        to,
        via,
        first,
        second,
        firstFare: getFare(from.lineCode, from.name, via),
        secondFare: getFare(from.lineCode, via, to.name),
        days: first[0].schedule.days,
        noConnection: first.filter((a) => !second.some((b) => toMinutes(b.departFrom) >= toMinutes(a.arriveTo))),
      }
    }
  }
  return { kind: "none", from, to }
}

// ─── Station page data ──────────────────────────────────

export interface StationRun {
  lineCode: string
  schedule: TrainSchedule
  stop: ScheduleStop
  index: number
  origin: ScheduleStop
  terminus: ScheduleStop
  /** HH:MM the train is at this station (depart, or arrive at the terminus);
   *  for a stop with no published time, the run's origin departure */
  time: string
  /** "06:00", "about 16:30", or "after 06:00" for unpublished stop times */
  timeLabel: string
  /** false when the stop's own time is not published */
  timeExact: boolean
  /** terminus arrival text ("06:45" / "about 16:30") */
  terminusArrive: string
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
      const isTerminus = index === schedule.stops.length - 1
      const own = stop.depart ?? stop.arrive
      const time = own ?? schedule.stops[0].depart
      if (!time) continue
      const timeLabel = !own ? `after ${time}` : isTerminus ? arrivalLabel(schedule) : own
      runs.push({
        lineCode,
        schedule,
        stop,
        index,
        origin: schedule.stops[0],
        terminus: schedule.stops[schedule.stops.length - 1],
        time,
        timeLabel,
        timeExact: !!own && !(isTerminus && schedule.arrivalApprox),
        terminusArrive: arrivalLabel(schedule),
        isOrigin: index === 0,
        isTerminus,
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
  if (station.lineCode === "TMA") return `Tema–Accra fare unconfirmed (GRCL site lists GH₵5–GH₵7), confirm at the station.`
  const { exact, unknown } = getStationFareSummary(station)
  if (!exact.length) return `Fares from ${station.name} are not published by GRDA, confirm at the station.`
  const parts = exact.map((f) => `GH₵${f.fare.amount} to ${f.to}`)
  return `Fares from ${station.name}: ${joinNames(parts)}${unknown.length ? ", other stations: confirm at the station" : ""}.`
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join("")
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`
}

/** FAQ for a station page — SINGLE source for the visible FAQ and the FAQPage JSON-LD. */
export function getStationFaqs(station: Station): { question: string; answer: string }[] {
  const name = station.name
  const runs = getStationRuns(name)
  const info = TRAIN_LINE_INFO[station.lineCode]
  const days = info?.days ?? runs[0]?.schedule.days ?? ""

  const leaving = runs.filter((r) => !r.isTerminus)
  const sentences = leaving.map((r) =>
    r.timeExact
      ? `A train to ${r.terminus.station} leaves ${name} at ${r.time} and arrives at ${r.terminusArrive}.`
      : `A train from ${r.origin.station} at ${r.origin.depart} calls at ${name} on its way to ${r.terminus.station} (arrives ${r.terminusArrive}). GRDA does not publish the ${name} time.`
  )
  const timesAnswer =
    (sentences.length ? sentences.join(" ") : `${name} is the end of the line — trains arrive here and turn back.`) +
    (days ? ` Trains run ${daysLong(days)}.` : "") +
    (info?.changeAt && name !== info.changeAt ? ` For other stops on the line, change at ${info.changeAt}.` : "")

  const { exact, unknown } = getStationFareSummary(station)
  let fareAnswer: string
  if (station.lineCode === "TMA") {
    fareAnswer = `The Tema–Accra fare is unconfirmed: GRCL's site lists GH₵5–GH₵7. Confirm the fare at the station.`
  } else if (exact.length) {
    const parts = exact.map((f) => `GH₵${f.fare.amount}${f.fare.child !== null ? ` (child GH₵${f.fare.child})` : ""} to ${f.to}`)
    fareAnswer = `The GRDA fares from ${name} are ${joinNames(parts)}.`
    if (unknown.length) fareAnswer += " Fares to other stations are not published, so confirm at the station."
  } else {
    fareAnswer = `GRDA does not publish fares from ${name}. Confirm the fare at the station.`
  }
  fareAnswer += " Buy the train card at the station (GRDA lists the card at GH₵10 adult, GH₵5 child)."

  const missing = missingDaysText(days)
  const sundayAnswer = missing
    ? `The last published timetable for ${name} is ${daysLong(days)}, with no ${missing} service listed. Confirm Sunday service at the station.`
    : `Yes. GRDA lists trains at ${name} as running daily, including Sunday.`

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
    fareLabel: runFareShort(s),
    offset: null,
    remainingMinutes: null,
    when: "",
  }
}

/** Stable (time-independent) fallback: each line's first run. Used for SSR / pre-mount. */
export function placeholderDepartures(): NextDeparture[] {
  return Object.keys(TRAIN_SCHEDULES).map((code) => toNext(code, lineRuns(code)[0]))
}

function nextOf(lineCode: string, runs: TrainSchedule[], now: Date): NextDeparture | null {
  const nowSec = now.getUTCHours() * 3600 + now.getUTCMinutes() * 60 + now.getUTCSeconds()
  const today = now.getUTCDay()
  for (let offset = 0; offset <= 7; offset++) {
    const dow = (today + offset) % 7
    for (const s of runs) {
      if (!runsOnDay(s.days, dow)) continue
      const depSec = toMinutes(s.stops[0].depart!) * 60
      if (offset === 0 && depSec <= nowSec) continue
      return {
        ...toNext(lineCode, s),
        offset,
        remainingMinutes: Math.ceil((offset * 86400 + depSec - nowSec) / 60),
        when: offset === 0 ? "Today" : offset === 1 ? "Tomorrow" : WEEK_DAYS[dow],
      }
    }
  }
  return null
}

/** Next departure per line from `now` (Ghana time = UTC), soonest first. */
export function nextDepartures(now: Date): NextDeparture[] {
  const out: NextDeparture[] = []
  for (const code of Object.keys(TRAIN_SCHEDULES)) {
    const found = nextOf(code, lineRuns(code), now)
    if (found) out.push(found)
  }
  return out.sort((a, b) => a.remainingMinutes! - b.remainingMinutes!)
}

/** A line's runs grouped by direction (origin → terminus), in first-departure order. */
export function lineDirections(lineCode: string): { key: string; origin: string; destination: string; runs: TrainSchedule[] }[] {
  const groups = new Map<string, { key: string; origin: string; destination: string; runs: TrainSchedule[] }>()
  for (const s of lineRuns(lineCode)) {
    const origin = s.stops[0].station
    const destination = s.stops[s.stops.length - 1].station
    const key = `${origin}>${destination}`
    if (!groups.has(key)) groups.set(key, { key, origin, destination, runs: [] })
    groups.get(key)!.runs.push(s)
  }
  return [...groups.values()]
}

/** Stable fallback for a line board: first run of each direction, by time. */
export function placeholderLineDepartures(lineCode: string): NextDeparture[] {
  return lineDirections(lineCode).map((g) => toNext(lineCode, g.runs[0]))
}

/** Next departure in EACH direction of one line from `now` (Ghana time = UTC), soonest first. */
export function nextLineDepartures(lineCode: string, now: Date): NextDeparture[] {
  const out: NextDeparture[] = []
  for (const g of lineDirections(lineCode)) {
    const found = nextOf(lineCode, g.runs, now)
    if (found) out.push(found)
  }
  return out.sort((a, b) => a.remainingMinutes! - b.remainingMinutes!)
}

export function formatRemaining(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  // Same wording as the Train tab's formatIn: "2 h 25 min", "2 h", "40 min".
  if (h === 0) return `${m} min`
  return m ? `${h} h ${m} min` : `${h} h`
}
