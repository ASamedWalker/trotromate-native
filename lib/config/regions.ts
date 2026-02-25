export const REGIONS = [
  { key: 'all', label: 'All Regions' },
  { key: 'greater_accra', label: 'Greater Accra' },
  { key: 'tema', label: 'Tema' },
  { key: 'central', label: 'Central' },
  { key: 'ashanti', label: 'Ashanti' },
  { key: 'western', label: 'Western' },
  { key: 'eastern', label: 'Eastern' },
  { key: 'volta', label: 'Volta' },
  { key: 'northern', label: 'Northern' },
] as const

export type RegionKey = typeof REGIONS[number]['key']

// Location patterns for auto-detecting region from route location names
const REGION_PATTERNS: { region: string; patterns: string[] }[] = [
  { region: 'tema', patterns: ['tema', 'ashaiman'] },
  { region: 'central', patterns: ['cape coast', 'winneba', 'elmina', 'mankessim', 'saltpond', 'swedru'] },
  { region: 'ashanti', patterns: ['kumasi', 'obuasi', 'ejisu', 'mampong', 'konongo', 'bekwai'] },
  { region: 'western', patterns: ['takoradi', 'sekondi', 'tarkwa', 'axim', 'prestea'] },
  { region: 'eastern', patterns: ['koforidua', 'nkawkaw', 'akosombo', 'nsawam', 'akim oda', 'suhum'] },
  { region: 'volta', patterns: ['ho ', 'keta', 'hohoe', 'aflao', 'kpando'] },
  { region: 'northern', patterns: ['tamale', 'yendi', 'bolgatanga', 'wa ', 'sunyani', 'techiman'] },
]

/** Detect region from a location name, defaults to 'greater_accra' */
export function detectRegion(location: string): string {
  const lower = location.toLowerCase()
  for (const { region, patterns } of REGION_PATTERNS) {
    if (patterns.some(p => lower.includes(p))) {
      return region
    }
  }
  return 'greater_accra'
}
