/**
 * App-side view of the intercity fare data. The data file
 * lib/constants/intercity-fares.ts is a VERBATIM copy of the web's generated
 * trotromate/lib/constants/intercity-fares.ts (keep them identical; re-copy when
 * the web regenerates it). Everything app-specific lives here: town-pair grouping,
 * operator labels, search, and date formatting.
 *
 * Source rules (owner): operator-published fares only (STC + VIP Jeoun booking
 * sites); never media. Directions are separate (fares are not symmetric).
 * Info only: no booking, no tickets.
 */
import {
  INTERCITY_CHECKED,
  INTERCITY_FARES,
  INTERCITY_PLACES,
  type IntercityFare,
  type IntercityOperatorId,
  type IntercityPlace,
} from '@/lib/constants/intercity-fares'

export type { IntercityFare, IntercityOperatorId }

export interface IntercityOperator {
  id: IntercityOperatorId
  /** Chip name */
  name: string
  /** Card title */
  fullName: string
  /** "Source: <sourceLabel> · checked 17 Oct 2026" */
  sourceLabel: string
}

export const INTERCITY_OPERATORS: Record<IntercityOperatorId, IntercityOperator> = {
  stc: { id: 'stc', name: 'STC', fullName: 'STC', sourceLabel: 'STC booking site' },
  'vip-jeoun': { id: 'vip-jeoun', name: 'VIP', fullName: 'VIP Jeoun', sourceLabel: 'VIP booking site' },
}

const OPERATOR_ORDER: IntercityOperatorId[] = ['stc', 'vip-jeoun']

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function fmtDate(iso: string, withYear: boolean): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return `${d} ${MONTHS[m - 1]}${withYear ? ` ${y}` : ''}`
}
/** "17 Oct" */
export const INTERCITY_CHECKED_SHORT = fmtDate(INTERCITY_CHECKED, false)
/** "17 Oct 2026" */
export const INTERCITY_CHECKED_LONG = fmtDate(INTERCITY_CHECKED, true)

export interface IntercityPair {
  /** "accra-to-kumasi" — route param for /intercity/[pair] */
  slug: string
  from: string
  to: string
  fromSlug: string
  toSlug: string
  /** Cheapest first */
  fares: IntercityFare[]
}

const PLACE_BY_SLUG = new Map<string, IntercityPlace>(INTERCITY_PLACES.map((p) => [p.slug, p]))
const placeName = (slug: string) => PLACE_BY_SLUG.get(slug)?.name ?? slug

export const INTERCITY_PAIRS: IntercityPair[] = (() => {
  const map = new Map<string, IntercityPair>()
  for (const f of INTERCITY_FARES) {
    const slug = `${f.from}-to-${f.to}`
    let p = map.get(slug)
    if (!p) {
      p = { slug, from: placeName(f.from), to: placeName(f.to), fromSlug: f.from, toSlug: f.to, fares: [] }
      map.set(slug, p)
    }
    p.fares.push(f)
  }
  for (const p of map.values()) {
    p.fares.sort((a, b) => a.fareMin - b.fareMin || OPERATOR_ORDER.indexOf(a.operator) - OPERATOR_ORDER.indexOf(b.operator))
  }
  return [...map.values()]
})()

const PAIR_BY_SLUG = new Map(INTERCITY_PAIRS.map((p) => [p.slug, p]))

export function getIntercityPair(slug: string | undefined | null): IntercityPair | null {
  if (!slug) return null
  return PAIR_BY_SLUG.get(slug.toLowerCase()) ?? null
}

/** The opposite direction, when an operator lists it. */
export function getReversePair(pair: IntercityPair): IntercityPair | null {
  return PAIR_BY_SLUG.get(`${pair.toSlug}-to-${pair.fromSlug}`) ?? null
}

/** Cheapest and dearest listed fare across all operators on the pair. */
export function intercityRange(pair: IntercityPair): { min: number; max: number } {
  let min = Infinity
  let max = 0
  for (const f of pair.fares) {
    if (f.fareMin < min) min = f.fareMin
    if (f.fareMax > max) max = f.fareMax
  }
  return { min, max }
}

/** Operators on the pair, STC first. */
export function intercityOperators(pair: IntercityPair): IntercityOperatorId[] {
  const ids = new Set(pair.fares.map((f) => f.operator))
  return OPERATOR_ORDER.filter((id) => ids.has(id))
}

/** Departure terminals with their fare range, in listing order: [{ terminal, min, max }]. */
export function fareTerminals(fare: IntercityFare): { terminal: string; min: number; max: number }[] {
  const out: { terminal: string; min: number; max: number }[] = []
  for (const p of fare.prices) {
    const t = out.find((x) => x.terminal === p.terminal)
    if (t) { t.min = Math.min(t.min, p.fare); t.max = Math.max(t.max, p.fare) }
    else out.push({ terminal: p.terminal, min: p.fare, max: p.fare })
  }
  return out
}

/** Pairs grouped by origin town: Accra first, then A–Z. */
export function intercityByOrigin(pairs: IntercityPair[] = INTERCITY_PAIRS): { origin: string; pairs: IntercityPair[] }[] {
  const map = new Map<string, IntercityPair[]>()
  for (const p of pairs) {
    const list = map.get(p.from) ?? []
    list.push(p)
    map.set(p.from, list)
  }
  return [...map.entries()]
    .sort(([a], [b]) => (a === 'Accra' ? -1 : b === 'Accra' ? 1 : a.localeCompare(b)))
    .map(([origin, list]) => ({ origin, pairs: [...list].sort((x, y) => x.to.localeCompare(y.to)) }))
}

/* ── Search ────────────────────────────────────────── */

const norm = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim()

/**
 * Town slug for free text. Exact names/aliases from 2 letters ("Ho", "Wa", "Circle"
 * is Accra, "Adum" is Kumasi); prefixes of the town NAME from 3 ("kum", "tama"), so
 * "ac" or "ka" never pull intercity rows into trotro searches.
 */
function matchTown(q: string, terminals = true): string | null {
  const n = norm(q)
  if (n.length < 2) return null
  for (const p of INTERCITY_PLACES) {
    const name = norm(p.name)
    // terminals=false: only spellings of the town ("kumase", "bolga"), not its terminals/
    // neighbourhoods ("kaneshie", "adum") — a lone "Kaneshie" is a trotro search.
    if (name === n || p.aliases.some((a) => norm(a) === n && (terminals || norm(a).slice(0, 3) === name.slice(0, 3)))) return p.slug
  }
  if (n.length < 3) return null
  return INTERCITY_PLACES.find((p) => norm(p.name).startsWith(n))?.slug ?? null
}

/**
 * "accra to kumasi", "accra - kumasi", "accra kumasi" → that pair (then its
 * reverse); a single town ("kumasi", "tama") → every pair from or to it.
 */
export function searchIntercity(query: string, limit = 6): IntercityPair[] {
  const n = norm(query)
  if (n.length < 2) return []

  const parts = query.toLowerCase().split(/\s+to\s+|\s*[-→>]+\s*/).map((s) => s.trim()).filter(Boolean)
  let a: string | null = null
  let b: string | null = null
  if (parts.length >= 2) {
    a = matchTown(parts[0])
    b = matchTown(parts[1])
  } else {
    const words = n.split(' ')
    for (let i = 1; i < words.length && !(a && b); i++) {
      a = matchTown(words.slice(0, i).join(' '))
      b = matchTown(words.slice(i).join(' '))
    }
  }
  if (a && b && a !== b) {
    const exact = PAIR_BY_SLUG.get(`${a}-to-${b}`)
    const reverse = PAIR_BY_SLUG.get(`${b}-to-${a}`)
    const hits = [exact, reverse].filter((p): p is IntercityPair => !!p)
    if (hits.length) return hits
  }

  const town = matchTown(n, false)
  if (!town) return []
  return INTERCITY_PAIRS
    .filter((p) => p.fromSlug === town || p.toSlug === town)
    .sort((x, y) => (x.fromSlug === town ? 0 : 1) - (y.fromSlug === town ? 0 : 1))
    .slice(0, limit)
}

/** The planner's two fields ("Circle" + "Kumasi") → the Accra to Kumasi pair, or null. */
export function intercityForTrip(from: string, to: string): IntercityPair | null {
  const f = matchTown(from)
  const t = matchTown(to)
  if (!f || !t || f === t) return null
  return PAIR_BY_SLUG.get(`${f}-to-${t}`) ?? null
}
