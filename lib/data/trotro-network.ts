// Accra trotro network — derived from the bundled OSM/AccraMobile route dump
// (assets/data/transport-routes.json, 566 routes with full geometry). Powers the
// network map (the Accra answer to Nairobi's Matatu route map). All client-side,
// no network — the data ships in the app.
import raw from '@/assets/data/transport-routes.json'

export interface RawRoute {
  osm_id: number
  name: string
  ref: string | null
  from: string | null
  to: string | null
  type: string
  coordinates: [number, number][] // [lng, lat]
}

// Transit-style palette — distinct, high-contrast hues like a subway map.
export const NETWORK_PALETTE = [
  '#E6194B', '#3CB44B', '#4363D8', '#F58231', '#911EB4', '#0891B2',
  '#BFA000', '#F032E6', '#9A6324', '#1F8A70', '#E11D48', '#2563EB',
  '#D946EF', '#65A30D', '#EA580C', '#7C3AED',
]

// Stable colour per route — hash the ref (route number) or name into the palette.
export function colorFor(key: string): string {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return NETWORK_PALETTE[h % NETWORK_PALETTE.length]
}

const ROUTES = (raw as any).routes as RawRoute[]

export interface NetworkRoute {
  id: string
  name: string
  ref: string | null
  from: string | null
  to: string | null
  color: string
  coords: [number, number][]
}

export const networkRoutes: NetworkRoute[] = ROUTES
  .filter((r) => Array.isArray(r.coordinates) && r.coordinates.length > 1)
  .map((r) => ({
    id: String(r.osm_id),
    name: r.name,
    ref: r.ref,
    from: r.from,
    to: r.to,
    color: colorFor(r.ref || r.name || String(r.osm_id)),
    coords: r.coordinates,
  }))

export const ROUTE_COUNT = networkRoutes.length

// ── Stations / termini — endpoints of every route, deduped by name, weighted by
// how many routes touch them (hub size). Coord taken from the route geometry. ──
export interface Hub {
  name: string
  lng: number
  lat: number
  count: number
}

function buildHubs(): Hub[] {
  const map = new Map<string, Hub>()
  for (const r of networkRoutes) {
    const ends: [string | null, [number, number]][] = [
      [r.from, r.coords[0]],
      [r.to, r.coords[r.coords.length - 1]],
    ]
    for (const [name, c] of ends) {
      if (!name || !c) continue
      const existing = map.get(name)
      if (existing) existing.count++
      else map.set(name, { name, lng: c[0], lat: c[1], count: 1 })
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count)
}

export const hubs: Hub[] = buildHubs()

// Build a GeoJSON FeatureCollection of all route lines, with per-feature color +
// an `opacity` we can repaint on search (dim non-matches). Matching is by route
// number / name / either terminus, case-insensitive.
export function linesFeatureCollection(query: string, selectedId: string | null) {
  const q = query.trim().toLowerCase()
  return {
    type: 'FeatureCollection' as const,
    features: networkRoutes.map((r) => {
      const match =
        !q ||
        (r.ref || '').toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        (r.from || '').toLowerCase().includes(q) ||
        (r.to || '').toLowerCase().includes(q)
      const isSel = selectedId === r.id
      return {
        type: 'Feature' as const,
        id: r.id,
        geometry: { type: 'LineString' as const, coordinates: r.coords },
        properties: {
          id: r.id,
          name: r.name,
          ref: r.ref,
          from: r.from,
          to: r.to,
          color: r.color,
          width: isSel ? 5.5 : 2.2,
          opacity: selectedId ? (isSel ? 1 : 0.06) : match ? 0.85 : 0.05,
        },
      }
    }),
  }
}

export function hubsFeatureCollection(minCount = 4) {
  return {
    type: 'FeatureCollection' as const,
    features: hubs
      .filter((h) => h.count >= minCount)
      .map((h) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [h.lng, h.lat] },
        properties: { name: h.name, count: h.count, big: h.count >= 12 ? 1 : 0 },
      })),
  }
}
