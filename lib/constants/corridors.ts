// Corridor identity: a short code from terminal codes + a colour (redesign §4).
// Launch corridors (owner, 2026-10-09) get fixed colours; every other pair gets a
// stable colour from the palette, the same in both directions. Orange stays
// reserved for actions, so it is not in the palette.

export const CORRIDOR_PALETTE = [
  '#1D4ED8', // blue
  '#0F766E', // teal
  '#6D28D9', // violet
  '#BE123C', // rose
  '#92400E', // amber-brown
  '#15803D', // green
  '#3730A3', // indigo
] as const

export const NEUTRAL_CORRIDOR = '#334155'

// Blue / teal / violet belong to the launch corridors; every other pair uses the rest
// so a launch corridor is never confused with another line.
const OTHER_PALETTE = CORRIDOR_PALETTE.slice(3)

// Longest names first so "East Legon" wins over "Legon".
const TERMINAL_CODES: [string, string][] = ([
  ['east legon', 'ELG'], ['tema station', 'TEM'], ['circle', 'CIR'], ['madina', 'MAD'], ['kasoa', 'KAS'],
  ['kaneshie', 'KNS'], ['tema', 'TEM'], ['accra', 'ACC'], ['achimota', 'ACH'], ['lapaz', 'LPZ'],
  ['legon', 'LEG'], ['dansoman', 'DAN'], ['spintex', 'SPX'], ['adenta', 'ADT'], ['nungua', 'NUN'],
  ['teshie', 'TSH'], ['labadi', 'LAB'], ['osu', 'OSU'], ['kwabenya', 'KWB'], ['ashaiman', 'ASH'],
  ['amasaman', 'AMA'], ['weija', 'WEJ'], ['mallam', 'MAL'], ['odorkor', 'ODK'], ['haatso', 'HTS'],
  ['dome', 'DOM'], ['taifa', 'TAF'], ['ofankor', 'OFK'], ['abeka', 'ABK'], ['odawna', 'ODW'],
  ['tudu', 'TUD'], ['sakumono', 'SAK'], ['shiashie', 'SHS'], ['atomic', 'ATM'], ['okponglo', 'OKP'],
] as [string, string][]).sort((a, b) => b[0].length - a[0].length)

// Unordered pairs (sorted codes joined by '|') → colour.
const LAUNCH: Record<string, string> = {
  'CIR|MAD': '#1D4ED8',
  'CIR|KAS': '#0F766E',
  'KAS|KNS': '#0F766E',
  'ACC|TEM': '#6D28D9',
  'CIR|TEM': '#6D28D9',
}

export function terminalCode(name: string): string {
  const n = name.trim().toLowerCase()
  for (const [key, code] of TERMINAL_CODES) if (n.includes(key)) return code
  const word = n.replace(/[^a-z ]/g, '').trim().split(/\s+/)[0] ?? ''
  return (word.slice(0, 3) || '???').toUpperCase()
}

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

export interface Corridor {
  code: string // e.g. "MAD·CIR" (from·to as given)
  color: string
  isLaunch: boolean
}

export function corridorFor(from: string, to: string): Corridor {
  const a = terminalCode(from)
  const b = terminalCode(to)
  const pair = [a, b].sort().join('|')
  const launch = LAUNCH[pair]
  return {
    code: `${a}·${b}`,
    color: launch ?? OTHER_PALETTE[hash(pair) % OTHER_PALETTE.length],
    isLaunch: !!launch,
  }
}

/** Direction-free key ("CIR|MAD") — the same key the web's corridors.ts and service_alerts use. */
export function corridorKey(from: string, to: string): string {
  return [terminalCode(from), terminalCode(to)].sort().join('|')
}
