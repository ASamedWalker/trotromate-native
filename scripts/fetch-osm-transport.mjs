/**
 * Fetch OSM transport data for Ghana cities (Accra, Kumasi, Koforidua, Takoradi, Tamale)
 *
 * Queries Overpass API for:
 *   1. Transport stops (bus stops, trotro stops, lorry parks, taxi ranks)
 *   2. Transport route relations (bus, share_taxi, minibus corridors)
 *
 * Outputs:
 *   - assets/data/transport-stops.json  (bundled fallback for app)
 *   - assets/data/transport-routes.json (bundled fallback for app)
 *   - Console report of new station candidates
 *
 * Usage:
 *   node scripts/fetch-osm-transport.mjs
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')

const HEADERS = { 'User-Agent': 'Troski-App/1.0' }
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'

// City bounding boxes: south,west,north,east
const CITY_BBOXES = {
  'Greater Accra': '5.4,-0.5,5.9,0.1',
  'Kumasi':        '6.6,-1.7,6.8,-1.5',
  'Koforidua':     '6.0,-0.3,6.15,-0.2',
  'Takoradi':      '4.85,-1.8,5.0,-1.7',
  'Tamale':        '9.3,-0.9,9.5,-0.75',
}

// Known station names (for matching/exclusion)
const KNOWN_STATIONS = [
  'circle', 'madina', 'tema station', 'kaneshie', 'lapaz', 'achimota',
  'legon', 'adenta', 'kasoa', 'mallam', 'dansoman', 'ashaiman', 'spintex',
  'accra central', 'haatso', 'ofankor', 'okponglo', 'taifa',
  'tetteh quarshie', '37 station', '37 military hospital', 'ablekuma',
  'abokobi', 'adjringanor', 'airport', 'airport city', 'asylum down',
  'atadeka', 'dodowa', 'dome', 'east legon', 'maamobi', 'nima',
  'nkrumah circle', 'nungua', 'osu', 'st johns', 'teshie', 'pokuase',
  'amasaman',
]

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function categorizeStop(tags) {
  // Train/rail stations
  if (tags.railway === 'station' || tags.railway === 'halt' || tags.railway === 'tram_stop') {
    return 'train_station'
  }
  if (tags.amenity === 'bus_station') return 'lorry_park'
  if (tags.amenity === 'taxi') return 'taxi_rank'
  if (tags.highway === 'bus_stop') {
    const name = (tags.name || '').toLowerCase()
    if (name.includes('trotro') || tags.share_taxi === 'yes') return 'trotro_stop'
    if (name.includes('lorry') || name.includes('park')) return 'lorry_park'
    return 'bus_stop'
  }
  if (tags.public_transport === 'station') return 'lorry_park'
  if (tags.public_transport === 'stop_position' || tags.public_transport === 'platform') {
    return 'trotro_stop'
  }
  return 'bus_stop'
}

function isKnownStation(name) {
  if (!name) return false
  const lower = name.toLowerCase()
  return KNOWN_STATIONS.some(
    (known) => lower.includes(known) || known.includes(lower.replace(/\s*station\s*/gi, '').trim()),
  )
}

// Douglas-Peucker line simplification
function perpendicularDist(point, lineStart, lineEnd) {
  const [x, y] = point
  const [x1, y1] = lineStart
  const [x2, y2] = lineEnd
  const dx = x2 - x1
  const dy = y2 - y1
  if (dx === 0 && dy === 0) return Math.sqrt((x - x1) ** 2 + (y - y1) ** 2)
  const t = ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)
  const cx = x1 + t * dx
  const cy = y1 + t * dy
  return Math.sqrt((x - cx) ** 2 + (y - cy) ** 2)
}

function simplifyLine(coords, tolerance) {
  if (coords.length <= 2) return coords
  let maxDist = 0
  let maxIdx = 0
  for (let i = 1; i < coords.length - 1; i++) {
    const d = perpendicularDist(coords[i], coords[0], coords[coords.length - 1])
    if (d > maxDist) {
      maxDist = d
      maxIdx = i
    }
  }
  if (maxDist > tolerance) {
    const left = simplifyLine(coords.slice(0, maxIdx + 1), tolerance)
    const right = simplifyLine(coords.slice(maxIdx), tolerance)
    return [...left.slice(0, -1), ...right]
  }
  return [coords[0], coords[coords.length - 1]]
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function queryOverpass(query, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const resp = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { ...HEADERS, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'data=' + encodeURIComponent(query),
    })
    if (resp.ok) {
      const data = await resp.json()
      return data.elements || []
    }
    if (attempt < retries && (resp.status === 429 || resp.status === 504)) {
      const wait = attempt * 10000 // 10s, 20s, 30s backoff
      console.error(`    Overpass ${resp.status}, retrying in ${wait / 1000}s (attempt ${attempt}/${retries})...`)
      await sleep(wait)
    } else {
      console.error(`    Overpass error: ${resp.status} (giving up)`)
      return []
    }
  }
  return []
}

async function fetchTransportStops() {
  console.log('=== Fetching transport stops from Overpass API ===\n')

  const stopTypes = [
    { label: 'bus_stop', tag: '"highway"="bus_stop"' },
    { label: 'bus_station', tag: '"amenity"="bus_station"' },
    { label: 'stop_position', tag: '"public_transport"="stop_position"' },
    { label: 'platform', tag: '"public_transport"="platform"' },
    { label: 'taxi', tag: '"amenity"="taxi"' },
    { label: 'station', tag: '"public_transport"="station"' },
    { label: 'railway_station', tag: '"railway"="station"' },
    { label: 'railway_halt', tag: '"railway"="halt"' },
    { label: 'tram_stop', tag: '"railway"="tram_stop"' },
  ]

  const allElements = []
  const seenIds = new Set()

  for (const [city, bbox] of Object.entries(CITY_BBOXES)) {
    console.log(`\n--- ${city} (${bbox}) ---`)
    for (const { label, tag } of stopTypes) {
      console.log(`  Fetching ${label}...`)
      const q = `[out:json][timeout:60];node[${tag}](${bbox});out body;`
      const elements = await queryOverpass(q)
      let added = 0
      for (const el of elements) {
        if (!seenIds.has(el.id)) {
          seenIds.add(el.id)
          allElements.push(el)
          added++
        }
      }
      console.log(`    ${elements.length} nodes (${added} new)`)
      await sleep(5000) // Be nice to Overpass — avoid 429 rate limits
    }
  }

  console.log(`\nTotal unique transport nodes: ${allElements.length}\n`)

  // Map to our format
  const stops = allElements
    .filter((el) => el.lat && el.lon)
    .map((el) => ({
      osm_id: el.id,
      name: el.tags?.name || null,
      lat: el.lat,
      lng: el.lon,
      type: categorizeStop(el.tags || {}),
      tags: el.tags || {},
    }))

  // Deduplicate: within 50m, keep the one with a name (or more tags)
  const deduped = []
  const used = new Set()

  for (const stop of stops) {
    if (used.has(stop.osm_id)) continue
    let best = stop
    for (const other of stops) {
      if (other.osm_id === stop.osm_id || used.has(other.osm_id)) continue
      const dist = haversineKm(stop.lat, stop.lng, other.lat, other.lng)
      if (dist < 0.05) {
        // Within 50m
        used.add(other.osm_id)
        // Prefer the one with a name or more tags
        const stopScore = (stop.name ? 10 : 0) + Object.keys(stop.tags).length
        const otherScore = (other.name ? 10 : 0) + Object.keys(other.tags).length
        if (otherScore > stopScore) best = other
      }
    }
    used.add(best.osm_id)
    deduped.push(best)
  }

  console.log(`After deduplication: ${deduped.length} stops\n`)

  // Categorize
  const counts = { trotro_stop: 0, bus_stop: 0, lorry_park: 0, taxi_rank: 0, train_station: 0 }
  for (const s of deduped) counts[s.type]++
  console.log('By type:')
  for (const [type, count] of Object.entries(counts)) {
    console.log(`  ${type}: ${count}`)
  }
  console.log()

  // Named stops
  const named = deduped.filter((s) => s.name)
  console.log(`Named stops: ${named.length}`)

  // Station candidates (named, not already in our DB)
  const candidates = named.filter((s) => !isKnownStation(s.name))
  console.log(`\n=== NEW STATION CANDIDATES (${candidates.length}) ===`)
  for (const c of candidates.slice(0, 50)) {
    console.log(`  [${c.osm_id}] "${c.name}" (${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}) type=${c.type}`)
  }
  if (candidates.length > 50) console.log(`  ... and ${candidates.length - 50} more`)

  return deduped
}

async function fetchTransportRoutes() {
  console.log('\n=== Fetching transport routes from Overpass API ===\n')

  const allRelations = []
  const seenRouteIds = new Set()

  for (const [city, bbox] of Object.entries(CITY_BBOXES)) {
    console.log(`--- ${city} routes ---`)
    const query = `[out:json][timeout:120];(relation["type"="route"]["route"="bus"](${bbox});relation["type"="route"]["route"="share_taxi"](${bbox});relation["type"="route"]["route"="minibus"](${bbox}););out body geom;`

    const resp = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { ...HEADERS, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'data=' + encodeURIComponent(query),
    })

    if (!resp.ok) {
      console.error(`  Overpass error for ${city}:`, resp.status)
      await sleep(5000)
      continue
    }

    const data = await resp.json()
    let added = 0
    for (const el of data.elements) {
      if (!seenRouteIds.has(el.id)) {
        seenRouteIds.add(el.id)
        allRelations.push(el)
        added++
      }
    }
    console.log(`  ${data.elements.length} relations (${added} new)`)
    await sleep(5000)
  }

  console.log(`\nTotal unique route relations: ${allRelations.length}\n`)

  const routes = []

  for (const rel of allRelations) {
    if (!rel.members) continue

    // Extract coordinates from way members
    const coords = []
    for (const member of rel.members) {
      if (member.type === 'way' && member.geometry) {
        for (const pt of member.geometry) {
          coords.push([pt.lon, pt.lat]) // GeoJSON: [lng, lat]
        }
      }
    }

    if (coords.length < 2) continue

    // Simplify geometry (~30m tolerance ≈ 0.0003 degrees)
    const simplified = simplifyLine(coords, 0.0003)

    const tags = rel.tags || {}
    const routeType = tags.route === 'share_taxi' ? 'share_taxi' : tags.route === 'minibus' ? 'minibus' : 'bus'

    routes.push({
      osm_id: rel.id,
      name: tags.name || null,
      ref: tags.ref || null,
      from: tags.from || null,
      to: tags.to || null,
      type: routeType,
      coordinates: simplified,
    })

    console.log(
      `  [${rel.id}] "${tags.name || tags.ref || 'unnamed'}" (${routeType}) — ${coords.length} pts → ${simplified.length} simplified`,
    )
  }

  console.log(`\nTotal routes: ${routes.length}`)
  return routes
}

async function main() {
  const stops = await fetchTransportStops()
  const routes = await fetchTransportRoutes()

  // Ensure assets/data directory exists
  const dataDir = path.join(ROOT, 'assets', 'data')
  fs.mkdirSync(dataDir, { recursive: true })

  // Write transport-stops.json
  const stopsJson = {
    generated: new Date().toISOString(),
    cities: Object.keys(CITY_BBOXES),
    count: stops.length,
    stops: stops.map((s) => ({
      osm_id: s.osm_id,
      name: s.name,
      lat: s.lat,
      lng: s.lng,
      type: s.type,
    })),
  }
  const stopsPath = path.join(dataDir, 'transport-stops.json')
  fs.writeFileSync(stopsPath, JSON.stringify(stopsJson, null, 2))
  console.log(`\nWrote ${stopsPath} (${stops.length} stops)`)

  // Write transport-routes.json
  const routesJson = {
    generated: new Date().toISOString(),
    cities: Object.keys(CITY_BBOXES),
    count: routes.length,
    routes: routes.map((r) => ({
      osm_id: r.osm_id,
      name: r.name,
      ref: r.ref,
      from: r.from,
      to: r.to,
      type: r.type,
      coordinates: r.coordinates,
    })),
  }
  const routesPath = path.join(dataDir, 'transport-routes.json')
  fs.writeFileSync(routesPath, JSON.stringify(routesJson, null, 2))
  console.log(`Wrote ${routesPath} (${routes.length} routes)`)

  console.log('\n=== Done ===')
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
