// Rail news + line status — STATIC curated data (no runtime fetching).
// Keep IDENTICAL to trotromate-native/lib/constants/train-news.ts.
//
// Copy of trotromate/lib/constants/train-news.ts — keep IDENTICAL.
// LEGAL NOTE (owner, 2026-10-15): titles and summaries are in Troski's OWN
// words — never a copied headline or article text. NO media outlet names or
// links (Graphic, Citi, MyJoyOnline, 3News, Rainbow Radio, Railways Africa,
// Pulse, GhanaWeb …). Only OFFICIAL sources may be named and linked: GRDA
// (grda.gov.gh), Ghana Railway Company Ltd (grcl.gov.gh), Ministry of Transport
// (mot.gov.gh). Facts known only from press carry no source/url and show
// "Reported in Ghanaian media". Newest first. Re-check before adding.

export type RailNewsKind = 'disruption' | 'service' | 'project' | 'safety'

export interface RailNewsItem {
  id: string
  /** ISO date of the event/report */
  date: string
  title: string
  summary: string
  /** Official source name only (GRDA, GRCL, Ministry of Transport) */
  source?: string
  /** Official source link only — omit for press-reported facts */
  url?: string
  lineCode?: string
  kind: RailNewsKind
  /** 'month' = only the month is known; the label then reads "October 2026". */
  datePrecision?: 'month'
}

export const RAIL_NEWS: RailNewsItem[] = [
  {
    id: 'tmp-freight-2026-10',
    date: '2026-10-01',
    datePrecision: 'month',
    title: 'Freight services planned on the Tema–Afienya–Adomi corridor',
    summary: 'Freight trains were expected to start around mid-October 2026 (unconfirmed). Passenger times could change, so check at the station.',
    lineCode: 'TMP',
    kind: 'service',
  },
  {
    id: 'tmp-goats-2026-07',
    date: '2026-07-30',
    title: 'Livestock struck on the Tema–Afienya section',
    summary: 'On 30 July 2026 a passenger train hit goats on the track. GRDA asked residents to keep animals off the line and not to put stones on the rails.',
    lineCode: 'TMP',
    kind: 'safety',
  },
  {
    id: 'tma-derail-2026-05',
    date: '2026-05-21',
    title: 'Cattle on the line halt Accra–Tema service for a day',
    summary: 'On 21 May 2026 a train came off the rails after striking stray cattle near Avenor, and service was suspended for the rest of that day.',
    lineCode: 'TMA',
    kind: 'disruption',
  },
  {
    id: 'nsawam-2026-05',
    date: '2026-05-12',
    title: 'Accra–Nsawam: no passenger trains yet',
    summary: 'In May 2026 GRDA said the line could take about 17 months to finish once dedicated funding was in place. No passenger trains run on it.',
    kind: 'project',
  },
  {
    id: 'stk-relaunch-2026-04',
    date: '2026-04-24',
    title: 'Western Region commuter trains back in service',
    summary: 'Passenger trains between Sekondi, Kojokrom and Takoradi resumed on 24 April 2026 after rehabilitation, with shuttle buses linking Takoradi station to the business district.',
    source: 'Ministry of Transport',
    url: 'https://www.mot.gov.gh/10/16/1/337/passenger-rail-services-resume-on-takoradi-kojokrom-sekondi-line',
    lineCode: 'STK',
    kind: 'service',
  },
  {
    id: 'tmp-eu-signalling-2026-04',
    date: '2026-04-01',
    datePrecision: 'month',
    title: 'Signalling funding for the Tema line',
    summary: 'In April 2026 a €20m EU grant for new signalling was reported as approved, with a final decision expected in October 2026. Better signalling could allow more trains a day.',
    lineCode: 'TMP',
    kind: 'project',
  },
  {
    id: 'tmp-later-trains-2026-01',
    date: '2026-01-20',
    title: 'Commuters push for evening trains on Tema–Afienya',
    summary: 'In January 2026 residents asked for longer operating hours so the service fits the working day.',
    lineCode: 'TMP',
    kind: 'service',
  },
  {
    id: 'tmp-launch-2025-10',
    date: '2025-10-01',
    title: 'Tema–Afienya–Adomi opens to passengers',
    summary: 'GRDA began commercial passenger services on the new standard-gauge line on 1 October 2025.',
    source: 'GRDA',
    url: 'https://grda.gov.gh',
    lineCode: 'TMP',
    kind: 'service',
  },
]

/** Shown when an item has no official source. */
export const MEDIA_REPORT_LABEL = 'Reported in Ghanaian media'

export const RAIL_NEWS_KIND_LABEL: Record<RailNewsKind, string> = {
  disruption: 'Disruption',
  service: 'Service',
  project: 'Project',
  safety: 'Safety',
}

const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** "2026-05-21" -> "21 May 2026" (string parse — no time-zone shift). */
export function newsDateLabel(iso: string, precision?: 'month'): string {
  const [y, m, d] = iso.split('-').map(Number)
  return precision === 'month' ? `${MONTHS_LONG[m - 1]} ${y}` : `${d} ${MONTHS_LONG[m - 1]} ${y}`
}

/** Newest first; with `lineCode`, only that line's items. */
export function latestRailNews(limit = 5, lineCode?: string): RailNewsItem[] {
  const items = lineCode ? RAIL_NEWS.filter((n) => n.lineCode === lineCode) : RAIL_NEWS
  return [...items].sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit)
}

// ─── Line status ───────────────────────────────────────────
export type RailLineState = 'running' | 'not-running' | 'planned'

export interface RailLineStatus {
  id: string
  name: string
  /** Set for lines with a timetable in TRAIN_SCHEDULES */
  lineCode?: string
  state: RailLineState
  stateLabel: string
  detail: string
  source: string
}

export const RAIL_LINE_STATUS: RailLineStatus[] = [
  {
    id: 'TMA', lineCode: 'TMA', name: 'Tema – Accra', state: 'running', stateLabel: 'Running',
    detail: 'Two trains a day on the last published schedule. Confirm times at the station.',
    source: 'GRCL',
  },
  {
    id: 'TMP', lineCode: 'TMP', name: 'Tema – Afienya – Adomi', state: 'running', stateLabel: 'Running',
    detail: 'Two shuttles, daily. Change at Afienya.',
    source: 'GRDA website',
  },
  {
    id: 'STK', lineCode: 'STK', name: 'Sekondi – Takoradi', state: 'running', stateLabel: 'Running',
    detail: 'Two shuttles from Kojokrom, daily.',
    source: 'GRDA website',
  },
  {
    id: 'ACN', name: 'Accra – Nsawam', state: 'not-running', stateLabel: 'Not running',
    detail: 'Infrastructure partly built. GRDA says about 17 months to finish once funded.',
    source: 'Reported in Ghanaian media, May 2026',
  },
  {
    id: 'ACK', name: 'Accra – Kumasi', state: 'planned', stateLabel: 'Planned',
    detail: 'Planned, freight-led. No passenger trains.',
    source: 'GRDA',
  },
  {
    id: 'KPG', name: 'Kumasi – Paga', state: 'planned', stateLabel: 'Planned',
    detail: 'Planned, freight-led. No passenger trains.',
    source: 'GRDA',
  },
]

// ─── Safety notice ─────────────────────────────────────────
export const RAIL_SAFETY = {
  title: 'Stay safe near the tracks',
  points: [
    'Keep animals and children off the railway line.',
    'Never walk, sit or trade on the tracks.',
    'Report anyone throwing stones at trains or placing objects on the rails.',
  ],
} as const
