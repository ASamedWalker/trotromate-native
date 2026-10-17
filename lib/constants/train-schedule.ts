// Official Train Schedules — Ghana Railway
// Sources (see TRAIN_LINE_INFO[code].source):
//   TMP + STK: GRDA website grda.gov.gh (timetable bundle modified 13 Oct 2026,
//   checked 14 Oct 2026). TMA: GRCL's last published schedule (grcl.gov.gh).
// Copy of trotromate/lib/constants/train-schedule.ts — keep the data IDENTICAL;
// this copy only adds optional stop lat/lng (STATION_COORDS).
//
// Run codes (TA1, AD1, KS1, …) are Troski's own labels so reminders and lists
// have a stable key — they are NOT GRDA train numbers. S112/S117 are GRCL's.
//
// Stop times: GRDA publishes only end-to-end times for TMP and STK. An
// intermediate stop with `arrive: null, depart: null` means the train calls
// there but no time is published — never invent one.

export interface ScheduleStop {
  station: string
  arrive: string | null
  depart: string | null
  /** Optional — only set where sourced (see STATION_COORDS); never invented. */
  lat?: number
  lng?: number
}

export interface TrainSchedule {
  id: string
  code: string
  label: string
  direction: 'inbound' | 'outbound'
  /** "Daily", "Mon – Sat", "Mon – Fri" */
  days: string
  /** Adult fare for the whole run in GH₵; null = not published/confirmed. */
  fare: number | null
  /** Child fare in GH₵; null = not published. */
  childFare: number | null
  /** Honest fare text used when `fare` is null (or needs a qualifier). */
  fareNote?: string
  /** The terminus arrival is our estimate — GRDA's listed time looks wrong. */
  arrivalApprox?: boolean
  /** Short run note, e.g. "Last train (Adomi mop-up)". */
  note?: string
  stops: ScheduleStop[]
}

export interface TrainLineDetails {
  code: string
  /** Stations in route order (all shuttles of the line). */
  stations: string[]
  days: string
  /** Honest provenance label shown next to the times. */
  source: string
  sourceUrl: string
  operator: 'GRDA' | 'GRCL'
  /** Shuttle lines: where riders change between shuttles. */
  changeAt?: string
  /** Line-level notes in our own words. */
  notes: string[]
}

// ─── Freshness ─────────────────────────────────────────────
// Bump SCHEDULE_VERIFIED whenever times/fares are re-checked against GRDA/GRCL.
export const SCHEDULE_VERIFIED = '2026-10-14'
export const GRDA_SOURCE_LABEL = 'per GRDA website · checked 14 Oct 2026'

/** Train card: GRDA lists the reusable card price separately from fares. */
export const TRAIN_CARD = { adult: 10, child: 5 } as const
export const TRAIN_CARD_TEXT =
  'Buy the train card at the station (GRDA lists the card at GH₵10 adult, GH₵5 child). Troski does not sell train tickets.'

/** Contacts — shown as plain text. */
export const RAIL_CONTACTS = [
  { org: 'GRDA', name: 'Ghana Railway Development Authority', phone: '+233 30 273 2534', email: 'info@grda.gov.gh' },
  { org: 'GRCL', name: 'Ghana Railway Company Ltd', phone: '+233 31 200 4518', email: 'info@grcl.gov.gh' },
] as const

// ─── Day helpers (single rule for every surface) ───────────
const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** "Daily" -> [0..6]; "Mon – Sat" -> [1..6] (JS getUTCDay numbers). */
export function serviceDayNumbers(days: string): number[] {
  if (/^daily$/i.test(days.trim())) return [0, 1, 2, 3, 4, 5, 6]
  const [start, end] = days.split('–').map((d) => d.trim().slice(0, 3))
  const a = DAY_ABBR.indexOf(start)
  const b = DAY_ABBR.indexOf(end ?? start)
  if (a === -1 || b === -1) return []
  const out: number[] = []
  for (let i = a; i <= b; i++) out.push(i)
  return out
}

/** Does a run with this `days` string run on `dow` (0 = Sunday)? */
export function runsOnDay(days: string, dow: number): boolean {
  return serviceDayNumbers(days).includes(dow)
}

// ─── Fares ─────────────────────────────────────────────────
// Published GRDA fares only. Anything not listed -> "confirm at station".
export interface PublishedFare {
  lineCode: string
  from: string
  to: string
  adult: number
  child: number | null
  /** 'grda' = on the GRDA site now; 'launch-2025' = Oct 2025 press, may have changed */
  basis: 'grda' | 'launch-2025'
}

export const PUBLISHED_FARES: PublishedFare[] = [
  { lineCode: 'TMP', from: 'Tema Harbour', to: 'Afienya', adult: 15, child: 7, basis: 'grda' },
  { lineCode: 'TMP', from: 'Afienya', to: 'Doryumu', adult: 10, child: 5, basis: 'grda' },
  { lineCode: 'STK', from: 'Kojokrom', to: 'Sekondi', adult: 5, child: 3, basis: 'grda' },
  { lineCode: 'STK', from: 'Kojokrom', to: 'Takoradi', adult: 7, child: 4, basis: 'grda' },
]

/** Oct 2025 launch press figures — show ONLY with LAUNCH_FARE_LABEL. */
export const TMP_LAUNCH_FARES = [
  { from: 'Afienya', to: 'Adomi', adult: 25 },
  { from: 'Tema Harbour', to: 'Adomi (full trip)', adult: 40 },
] as const
export const LAUNCH_FARE_LABEL = 'launch fares, Oct 2025, may have changed'

export const TMA_FARE_NOTE = 'Fare unconfirmed (GRCL site lists GH₵5–GH₵7) · confirm at station'

// Back-compat alias: TMP fares GRDA publishes today.
export const TMP_ZONE_FARES = PUBLISHED_FARES.filter((f) => f.lineCode === 'TMP')

// ─── Lines ─────────────────────────────────────────────────
export const TRAIN_LINE_INFO: Record<string, TrainLineDetails> = {
  TMA: {
    code: 'TMA',
    stations: ['Community 1', 'Tema Station', 'Asoprochona', 'Batchona', 'Alajo', 'Achimota', 'Odaw (Circle)', 'Accra Central'],
    days: 'Mon – Sat',
    source: 'last published schedule — confirm at station',
    sourceUrl: 'https://grcl.gov.gh',
    operator: 'GRCL',
    notes: [
      'Run by Ghana Railway Company Ltd (GRCL). Times are the last published schedule — confirm at the station.',
      'Last published as Monday to Saturday. Confirm Sunday service at the station.',
      'Some reports also list an Avenor stop between Odaw and Alajo — confirm at the station.',
    ],
  },
  TMP: {
    code: 'TMP',
    stations: ['Tema Harbour', 'Tema Industrial Area', 'Ashaiman', 'Afienya', 'Shai Hills', 'Doryumu', 'Akuse Halt', 'Kpong', 'Senchi Halt', 'Adomi'],
    days: 'Daily',
    source: GRDA_SOURCE_LABEL,
    sourceUrl: 'https://grda.gov.gh',
    operator: 'GRDA',
    changeAt: 'Afienya',
    notes: [
      'Two shuttles that meet at Afienya — not one through train. Change at Afienya.',
      'Tema Harbour – Afienya shuttle stops at Tema Industrial Area and Ashaiman.',
      'Afienya – Adomi shuttle stops at Shai Hills, Doryumu Junction, Akuse Halt, Kpong and Senchi Halt.',
      'No passenger trains to Juapong or Mpakadan — Mpakadan is a freight terminal.',
    ],
  },
  STK: {
    code: 'STK',
    stations: ['Sekondi', 'Gyandu Halt', 'Kojokrom', 'Ketan', 'Adiembra', 'Essaman', 'Butuah', 'Takoradi'],
    days: 'Daily',
    source: GRDA_SOURCE_LABEL,
    sourceUrl: 'https://grda.gov.gh',
    operator: 'GRDA',
    changeAt: 'Kojokrom',
    notes: [
      'Two shuttles from Kojokrom: one to Sekondi (via Gyandu Halt), one to Takoradi (via Ketan, Adiembra, Essaman and Butuah).',
      'Shuttle buses run from Takoradi station to the business district.',
    ],
  },
}

// ─── Station coordinates (native only) ─────────────────────
// Reused from the previous OSM-sourced values (lib/constants/train-stations.ts;
// several are town-centre approximations). New GRDA stops (Akuse Halt, Senchi
// Halt, Adomi, Gyandu Halt, Adiembra, Butuah) have NO reliable OSM station node
// yet, so they carry no coordinates — callers must treat lat/lng as optional.
export const STATION_COORDS: Record<string, { lat: number; lng: number }> = {
  'Community 1': { lat: 5.6525, lng: 0.0036 },
  'Tema Station': { lat: 5.6311, lng: 0.0018 },
  Asoprochona: { lat: 5.6145, lng: -0.0550 },
  Batchona: { lat: 5.6197, lng: -0.1197 },
  Alajo: { lat: 5.5879, lng: -0.2182 },
  Achimota: { lat: 5.6074, lng: -0.2237 },
  'Odaw (Circle)': { lat: 5.5655, lng: -0.2191 },
  'Accra Central': { lat: 5.5489, lng: -0.2110 },
  'Tema Harbour': { lat: 5.6311, lng: 0.0018 },
  'Tema Industrial Area': { lat: 5.6796, lng: 0.0026 },
  Ashaiman: { lat: 5.6868, lng: -0.0327 },
  Afienya: { lat: 5.7981, lng: 0.0052 },
  'Shai Hills': { lat: 5.8840, lng: 0.0386 },
  Doryumu: { lat: 5.9007, lng: 0.0232 },
  Kpong: { lat: 6.1759, lng: 0.0591 },
  Sekondi: { lat: 4.9377, lng: -1.7102 },
  Kojokrom: { lat: 4.9636, lng: -1.7245 },
  Ketan: { lat: 4.9511, lng: -1.7289 },
  Essaman: { lat: 4.9237, lng: -1.7369 },
  Takoradi: { lat: 4.8824, lng: -1.7496 },
}

/** Attach sourced coordinates where we have them. */
function withCoords(stop: ScheduleStop): ScheduleStop {
  const c = STATION_COORDS[stop.station]
  return c ? { ...stop, lat: c.lat, lng: c.lng } : stop
}

const TMP_TEMA_SHUTTLE = ['Tema Harbour', 'Tema Industrial Area', 'Ashaiman', 'Afienya']
const TMP_ADOMI_SHUTTLE = ['Afienya', 'Shai Hills', 'Doryumu', 'Akuse Halt', 'Kpong', 'Senchi Halt', 'Adomi']
const STK_SEKONDI_SHUTTLE = ['Kojokrom', 'Gyandu Halt', 'Sekondi']
const STK_TAKORADI_SHUTTLE = ['Kojokrom', 'Ketan', 'Adiembra', 'Essaman', 'Butuah', 'Takoradi']

/** End-to-end run: only the first departure and last arrival are published. */
function endToEnd(stations: string[], depart: string, arrive: string): ScheduleStop[] {
  return stations.map((station, i) => withCoords({
    station,
    arrive: i === stations.length - 1 ? arrive : null,
    depart: i === 0 ? depart : null,
  }))
}

type RunSpec = { code: string; depart: string; arrive: string; arrivalApprox?: boolean; note?: string }

function shuttle(
  stations: string[],
  direction: 'inbound' | 'outbound',
  base: Pick<TrainSchedule, 'fare' | 'childFare' | 'fareNote' | 'days'>,
  runs: RunSpec[],
): TrainSchedule[] {
  const to = stations[stations.length - 1]
  return runs.map((r) => ({
    id: r.code,
    code: r.code,
    label: `To ${to}`,
    direction,
    ...base,
    ...(r.arrivalApprox ? { arrivalApprox: true } : {}),
    ...(r.note ? { note: r.note } : {}),
    stops: endToEnd(stations, r.depart, r.arrive),
  }))
}

const ARRIVAL_UNCLEAR = 'Arrival time unclear on GRDA site'
const ADOMI_FARE_NOTE = 'GH₵10 to Doryumu JC (child GH₵5) · other stops: confirm at station'

export const TRAIN_SCHEDULES: Record<string, TrainSchedule[]> = {
  // ─── Tema–Accra Commuter (TMA, GRCL) ───────────────────
  // Last published schedule · Mon–Sat · fare unconfirmed
  TMA: [
    {
      id: 'S112', code: 'S112', label: 'Morning — To Accra',
      direction: 'inbound', days: 'Mon – Sat', fare: null, childFare: null, fareNote: TMA_FARE_NOTE,
      stops: ([
        { station: 'Community 1', arrive: null, depart: '06:00' },
        { station: 'Tema Station', arrive: '06:10', depart: '06:12' },
        { station: 'Asoprochona', arrive: '06:20', depart: '06:22' },
        { station: 'Batchona', arrive: '06:46', depart: '06:48' },
        { station: 'Alajo', arrive: '06:54', depart: '06:56' },
        { station: 'Achimota', arrive: '07:04', depart: '07:06' },
        { station: 'Odaw (Circle)', arrive: '07:16', depart: '07:18' },
        { station: 'Accra Central', arrive: '07:24', depart: null },
      ] as ScheduleStop[]).map(withCoords),
    },
    {
      id: 'S117', code: 'S117', label: 'Evening — To Tema',
      direction: 'outbound', days: 'Mon – Sat', fare: null, childFare: null, fareNote: TMA_FARE_NOTE,
      stops: ([
        { station: 'Accra Central', arrive: null, depart: '17:40' },
        { station: 'Odaw (Circle)', arrive: '17:50', depart: '17:52' },
        { station: 'Achimota', arrive: '18:02', depart: '18:06' },
        { station: 'Alajo', arrive: '18:12', depart: '18:14' },
        { station: 'Batchona', arrive: '18:22', depart: '18:24' },
        { station: 'Asoprochona', arrive: '18:42', depart: '18:54' },
        { station: 'Tema Station', arrive: '19:02', depart: '19:04' },
        { station: 'Community 1', arrive: '19:14', depart: null },
      ] as ScheduleStop[]).map(withCoords),
    },
  ],

  // ─── Tema–Afienya–Adomi (TMP, GRDA) ────────────────────
  // Two shuttles meeting at Afienya · Daily · per GRDA website 14 Oct 2026.
  // GRDA lists 15:45→15:55 and 08:00→08:15 — clearly typos vs ~45-min runs,
  // so those two arrivals are "about" times (arrivalApprox).
  TMP: [
    ...shuttle(TMP_TEMA_SHUTTLE, 'outbound', { days: 'Daily', fare: 15, childFare: 7 }, [
      { code: 'TA1', depart: '06:00', arrive: '06:45' },
      { code: 'TA2', depart: '07:00', arrive: '07:45' },
      { code: 'TA3', depart: '15:45', arrive: '16:30', arrivalApprox: true, note: ARRIVAL_UNCLEAR },
      { code: 'TA4', depart: '17:30', arrive: '18:00' },
    ]),
    ...shuttle([...TMP_TEMA_SHUTTLE].reverse(), 'inbound', { days: 'Daily', fare: 15, childFare: 7 }, [
      { code: 'AT1', depart: '07:00', arrive: '07:45' },
      { code: 'AT2', depart: '08:00', arrive: '08:45', arrivalApprox: true, note: ARRIVAL_UNCLEAR },
      { code: 'AT3', depart: '16:20', arrive: '16:50' },
      { code: 'AT4', depart: '18:15', arrive: '18:30' },
      { code: 'AT5', depart: '18:30', arrive: '19:10', note: 'Last train (Adomi mop-up)' },
    ]),
    ...shuttle(TMP_ADOMI_SHUTTLE, 'outbound', { days: 'Daily', fare: null, childFare: null, fareNote: ADOMI_FARE_NOTE }, [
      { code: 'AD1', depart: '06:30', arrive: '07:45' },
      { code: 'AD2', depart: '15:00', arrive: '17:00' },
    ]),
    ...shuttle([...TMP_ADOMI_SHUTTLE].reverse(), 'inbound', { days: 'Daily', fare: null, childFare: null, fareNote: ADOMI_FARE_NOTE }, [
      { code: 'DA1', depart: '08:00', arrive: '09:30' },
      { code: 'DA2', depart: '17:15', arrive: '18:45' },
    ]),
  ],

  // ─── Sekondi–Takoradi (STK, GRDA) ──────────────────────
  // Two shuttles from Kojokrom · Daily · per GRDA website 14 Oct 2026.
  // GRDA lists the Sekondi shuttle return as 5:45pm→5:55pm; we read it as
  // Sekondi → Kojokrom (the direction wording on the site is ambiguous).
  STK: [
    ...shuttle(STK_SEKONDI_SHUTTLE, 'outbound', { days: 'Daily', fare: 5, childFare: 3 }, [
      { code: 'KS1', depart: '06:40', arrive: '06:50' },
    ]),
    ...shuttle([...STK_SEKONDI_SHUTTLE].reverse(), 'inbound', { days: 'Daily', fare: 5, childFare: 3 }, [
      { code: 'SK1', depart: '17:45', arrive: '17:55', note: 'Direction wording unclear on GRDA site — confirm at station' },
    ]),
    ...shuttle(STK_TAKORADI_SHUTTLE, 'outbound', { days: 'Daily', fare: 7, childFare: 4 }, [
      { code: 'KT1', depart: '07:20', arrive: '07:40' },
    ]),
    ...shuttle([...STK_TAKORADI_SHUTTLE].reverse(), 'inbound', { days: 'Daily', fare: 7, childFare: 4 }, [
      { code: 'TK1', depart: '17:20', arrive: '17:40' },
    ]),
  ],
}

// ─── Display helpers ───────────────────────────────────────

/** "16:30" or "about 16:30" when GRDA's own arrival time looks wrong. */
export function arrivalLabel(s: TrainSchedule): string {
  const t = s.stops[s.stops.length - 1].arrive ?? ''
  return s.arrivalApprox && t ? `about ${t}` : t
}

/** Honest fare text for one run: "GH₵15 (child GH₵7)" or its fare note. */
export function scheduleFareLabel(s: TrainSchedule): string {
  if (s.fare === null) return s.fareNote ?? 'Fare not published · confirm at station'
  return s.childFare !== null ? `GH₵${s.fare} (child GH₵${s.childFare})` : `GH₵${s.fare}`
}

/** Short per-run fare for tight rows: "GH₵15" or "Fare: confirm at station". */
export function runFareLabelShort(s: TrainSchedule): string {
  return s.fare === null ? 'Fare: confirm at station' : `GH₵${s.fare}`
}

/** Line-level headline fare: "GH₵5–7", "From GH₵10", or "Fare unconfirmed". */
export function lineFareLabel(lineCode: string): string {
  const runs = TRAIN_SCHEDULES[lineCode] ?? []
  const fares = runs.map((r) => r.fare).filter((f): f is number => f !== null)
  const published = PUBLISHED_FARES.filter((f) => f.lineCode === lineCode && f.basis === 'grda').map((f) => f.adult)
  const all = [...fares, ...published]
  if (!all.length) return 'Fare unconfirmed'
  const min = Math.min(...all)
  const max = Math.max(...all)
  if (runs.some((r) => r.fare === null)) return `From GH₵${min}`
  return min === max ? `GH₵${min}` : `GH₵${min}–${max}`
}

// Flat per-run summary derived from TRAIN_SCHEDULES — single source of truth
// for the WhatsApp bot, USSD, and AI context (do NOT hardcode times elsewhere).
export interface TrainRunSummary {
  lineCode: string
  code: string
  label: string
  from: string
  to: string
  departs: string
  arrives: string | null
  /** "16:30" or "about 16:30" */
  arrivesLabel: string
  days: string
  /** Adult fare, null = not confirmed — use fareLabel for display. */
  fare: number | null
  fareLabel: string
  note?: string
}

export function getTrainRuns(): TrainRunSummary[] {
  const runs: TrainRunSummary[] = []
  for (const [lineCode, schedules] of Object.entries(TRAIN_SCHEDULES)) {
    for (const s of schedules) {
      const first = s.stops[0]
      const last = s.stops[s.stops.length - 1]
      runs.push({
        lineCode,
        code: s.code,
        label: s.label,
        from: first.station,
        to: last.station,
        departs: first.depart ?? '',
        arrives: last.arrive,
        arrivesLabel: arrivalLabel(s),
        days: s.days,
        fare: s.fare,
        fareLabel: scheduleFareLabel(s),
        ...(s.note ? { note: s.note } : {}),
      })
    }
  }
  return runs
}
