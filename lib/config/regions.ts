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

export interface RegionHero {
  key: string
  label: string
  tagline: string
  heroImage: string
  placeholderColor: string
}

const PEXELS_BASE = 'https://images.pexels.com/photos'
const PEXELS_PARAMS = '?auto=compress&cs=tinysrgb&w=800'

export const REGION_HEROES: RegionHero[] = [
  {
    key: 'greater_accra',
    label: 'Accra',
    tagline: 'The vibrant capital city',
    heroImage: `${PEXELS_BASE}/31782030/pexels-photo-31782030.jpeg${PEXELS_PARAMS}`,
    placeholderColor: '#2d3748',
  },
  {
    key: 'tema',
    label: 'Tema',
    tagline: "Ghana's industrial port city",
    heroImage: `${PEXELS_BASE}/20164535/pexels-photo-20164535.jpeg${PEXELS_PARAMS}`,
    placeholderColor: '#1a365d',
  },
  {
    key: 'central',
    label: 'Cape Coast',
    tagline: 'History meets the Atlantic',
    heroImage: `${PEXELS_BASE}/33224238/pexels-photo-33224238.jpeg${PEXELS_PARAMS}`,
    placeholderColor: '#744210',
  },
  {
    key: 'ashanti',
    label: 'Kumasi',
    tagline: 'Heart of the Ashanti kingdom',
    heroImage: `${PEXELS_BASE}/31070828/pexels-photo-31070828.jpeg${PEXELS_PARAMS}`,
    placeholderColor: '#553c17',
  },
  {
    key: 'western',
    label: 'Takoradi',
    tagline: 'The oil city by the coast',
    heroImage: `${PEXELS_BASE}/13221990/pexels-photo-13221990.jpeg${PEXELS_PARAMS}`,
    placeholderColor: '#276749',
  },
  {
    key: 'eastern',
    label: 'Koforidua',
    tagline: 'Gateway to the Eastern hills',
    heroImage: `${PEXELS_BASE}/31881358/pexels-photo-31881358.jpeg${PEXELS_PARAMS}`,
    placeholderColor: '#22543d',
  },
  {
    key: 'volta',
    label: 'Ho',
    tagline: 'Scenic Volta Region capital',
    heroImage: `${PEXELS_BASE}/14055688/pexels-photo-14055688.jpeg${PEXELS_PARAMS}`,
    placeholderColor: '#285e61',
  },
  {
    key: 'northern',
    label: 'Tamale',
    tagline: 'Gateway to the north',
    heroImage: `${PEXELS_BASE}/14529326/pexels-photo-14529326.jpeg${PEXELS_PARAMS}`,
    placeholderColor: '#975a16',
  },
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
