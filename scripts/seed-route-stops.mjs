/**
 * Seed route_stops using transport_routes polylines + transport_stops coordinates
 *
 * Strategy:
 *   1. For each of 566 transport_routes (OSM polylines), find nearby transport_stops
 *   2. Order stops by their position along the polyline
 *   3. Match transport_routes to our routes table by coordinate proximity
 *   4. Output SQL for route_stops table
 *
 * This uses the Mapcarta/OSM-verified coordinates from transport_stops (2,387 stops)
 * and the polyline corridors from transport_routes (566 routes).
 *
 * Usage:
 *   node scripts/seed-route-stops.mjs              # Preview (dry run)
 *   node scripts/seed-route-stops.mjs --sql        # Generate SQL file
 *   node scripts/seed-route-stops.mjs --verbose    # Show all matching details
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const SUPABASE_URL = 'https://rqctajmbfrqtjuwkykrg.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxY3Rham1iZnJxdGp1d2t5a3JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1Mzk5ODcsImV4cCI6MjA4NTExNTk4N30.jaPQiSS9ltsupXB2yMEnEkKyCxjOJUC5AP1KPl7kY68'

const sqlMode = process.argv.includes('--sql')
const verbose = process.argv.includes('--verbose')

// ── Config ──────────────────────────────────────────────
const STOP_PROXIMITY_KM = 0.30    // 300m from polyline = candidate
const MIN_STOP_SPACING_KM = 0.20  // Don't include 2 stops within 200m of each other
const ENDPOINT_MATCH_KM = 1.0     // Route origin/dest must be within 1km of polyline start/end

// ── Geo Utils ───────────────────────────────────────────

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Project a point onto a polyline, return distance from polyline and cumulative along-distance
 */
function projectOntoPolyline(lat, lng, polyline) {
  let best = { dist: Infinity, along: 0 }
  let cumDist = 0

  for (let i = 0; i < polyline.length - 1; i++) {
    const [aLng, aLat] = polyline[i]
    const [bLng, bLat] = polyline[i + 1]
    const segLen = haversineKm(aLat, aLng, bLat, bLng)

    // Find projection parameter t
    const dx = bLng - aLng, dy = bLat - aLat
    const px = lng - aLng, py = lat - aLat
    let t = (dx * dx + dy * dy) > 0 ? (px * dx + py * dy) / (dx * dx + dy * dy) : 0
    t = Math.max(0, Math.min(1, t))

    const projLat = aLat + t * dy
    const projLng = aLng + t * dx
    const dist = haversineKm(lat, lng, projLat, projLng)

    if (dist < best.dist) {
      best = { dist, along: cumDist + t * segLen }
    }
    cumDist += segLen
  }

  return { ...best, totalLength: cumDist }
}

function polylineLength(polyline) {
  let len = 0
  for (let i = 0; i < polyline.length - 1; i++) {
    const [aLng, aLat] = polyline[i]
    const [bLng, bLat] = polyline[i + 1]
    len += haversineKm(aLat, aLng, bLat, bLng)
  }
  return len
}

// ── Station Coords (for matching route endpoints to polyline endpoints) ──

// Major station coordinates — same as station-coords.ts
const STATION_COORDS = {
  'circle': { lat: 5.5696, lng: -0.2133 },
  'nkrumah circle': { lat: 5.5696, lng: -0.2133 },
  'circle accra': { lat: 5.5696, lng: -0.2133 },
  'madina': { lat: 5.6767, lng: -0.1716 },
  'madina station': { lat: 5.6767, lng: -0.1716 },
  'tema station': { lat: 5.6596, lng: -0.0097 },
  'tema': { lat: 5.6596, lng: -0.0097 },
  'kaneshie': { lat: 5.5641, lng: -0.2359 },
  'kaneshie station': { lat: 5.5641, lng: -0.2359 },
  'lapaz': { lat: 5.6058, lng: -0.2464 },
  'lazpaz': { lat: 5.6058, lng: -0.2464 },
  'achimota': { lat: 5.6133, lng: -0.2255 },
  'legon': { lat: 5.6502, lng: -0.1790 },
  'adenta': { lat: 5.7060, lng: -0.1656 },
  'kasoa': { lat: 5.5341, lng: -0.4241 },
  'mallam': { lat: 5.5710, lng: -0.2855 },
  'dansoman': { lat: 5.5640, lng: -0.2381 },
  'ashaiman': { lat: 5.6868, lng: -0.0327 },
  'ashaiman lebanon': { lat: 5.6868, lng: -0.0327 },
  'ashaiman market': { lat: 5.6868, lng: -0.0327 },
  'spintex': { lat: 5.6288, lng: -0.0902 },
  'spintex road': { lat: 5.6288, lng: -0.0902 },
  'accra': { lat: 5.5446, lng: -0.2048 },
  'accra central': { lat: 5.5446, lng: -0.2048 },
  'haatso': { lat: 5.6673, lng: -0.2047 },
  'ofankor': { lat: 5.6577, lng: -0.2655 },
  'ofankor-barrier': { lat: 5.6577, lng: -0.2655 },
  'okponglo': { lat: 5.6413, lng: -0.1781 },
  'taifa': { lat: 5.6584, lng: -0.2529 },
  'tetteh quarshie': { lat: 5.6240, lng: -0.1738 },
  '37': { lat: 5.5889, lng: -0.1796 },
  '37 military hospital': { lat: 5.5869, lng: -0.2076 },
  '37 millitary hospital': { lat: 5.5869, lng: -0.2076 },
  '37 station': { lat: 5.5869, lng: -0.2076 },
  'east legon': { lat: 5.6483, lng: -0.1508 },
  'osu': { lat: 5.5541, lng: -0.1836 },
  'nima': { lat: 5.5820, lng: -0.1988 },
  'maamobi': { lat: 5.5905, lng: -0.1970 },
  'mamobi': { lat: 5.5905, lng: -0.1970 },
  'nungua': { lat: 5.6022, lng: -0.0792 },
  'dodowa': { lat: 5.8881, lng: -0.0899 },
  'adjringanor': { lat: 5.6497, lng: -0.1367 },
  'abokobi': { lat: 5.7150, lng: -0.1530 },
  'st johns': { lat: 5.6389, lng: -0.2424 },
  "st john's": { lat: 5.6389, lng: -0.2424 },
  'atadeka station': { lat: 5.6906, lng: -0.0320 },
  'american house': { lat: 5.6190, lng: -0.1508 },
  'emmanuel villa': { lat: 5.5870, lng: -0.1750 },
  'asylum down': { lat: 5.5709, lng: -0.2025 },
  'lakeside': { lat: 5.6830, lng: -0.1790 },
  'lashibi': { lat: 5.6226, lng: -0.0694 },
}

function getStationCoords(name) {
  const lower = name.toLowerCase().trim()
  return STATION_COORDS[lower] || null
}

// ── Supabase Fetch ──────────────────────────────────────

async function supabaseFetch(table, select = '*') {
  const all = []
  let offset = 0
  const pageSize = 1000

  while (true) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${table}?select=${select}&limit=${pageSize}&offset=${offset}`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    )
    if (!res.ok) throw new Error(`GET ${table}: ${res.status} ${await res.text()}`)
    const data = await res.json()
    all.push(...data)
    if (data.length < pageSize) break
    offset += pageSize
  }
  return all
}

// ── Main ────────────────────────────────────────────────

async function main() {
  console.log('=== Seed Route Stops ===\n')

  // 1. Fetch all data
  console.log('Fetching data from Supabase...')
  const [routes, transportRoutes, transportStops] = await Promise.all([
    supabaseFetch('routes', 'id,from_location,to_location,distance_km,estimated_duration_mins'),
    supabaseFetch('transport_routes', 'id,osm_id,name,route_from,route_to,coordinates'),
    supabaseFetch('transport_stops', 'id,osm_id,name,latitude,longitude,stop_type'),
  ])

  console.log(`  Routes: ${routes.length}`)
  console.log(`  Transport routes (polylines): ${transportRoutes.length}`)
  console.log(`  Transport stops: ${transportStops.length}`)

  const namedStops = transportStops.filter(s => s.name && s.name.trim())
  console.log(`  Named stops: ${namedStops.length}\n`)

  // Parse coordinates
  for (const tr of transportRoutes) {
    tr.coords = typeof tr.coordinates === 'string' ? JSON.parse(tr.coordinates) : tr.coordinates
  }

  // 2. For each route, find matching transport_route by COORDINATE PROXIMITY
  //    (not text matching — too unreliable)
  const results = []
  let matched = 0
  let noCoords = 0
  let noPolyline = 0

  for (const route of routes) {
    // Get origin/destination coordinates
    const fromCoords = getStationCoords(route.from_location)
    const toCoords = getStationCoords(route.to_location)

    if (!fromCoords || !toCoords) {
      noCoords++
      if (verbose) console.log(`  SKIP (no coords): ${route.from_location} → ${route.to_location}`)
      continue
    }

    // Find the best transport_route whose polyline endpoints are near our route's endpoints
    let bestTR = null
    let bestDist = Infinity

    for (const tr of transportRoutes) {
      if (!tr.coords || tr.coords.length < 2) continue

      const [startLng, startLat] = tr.coords[0]
      const [endLng, endLat] = tr.coords[tr.coords.length - 1]

      // Try forward match
      const fwdStartDist = haversineKm(fromCoords.lat, fromCoords.lng, startLat, startLng)
      const fwdEndDist = haversineKm(toCoords.lat, toCoords.lng, endLat, endLng)
      const fwdScore = fwdStartDist + fwdEndDist

      // Try reverse match
      const revStartDist = haversineKm(fromCoords.lat, fromCoords.lng, endLat, endLng)
      const revEndDist = haversineKm(toCoords.lat, toCoords.lng, startLat, startLng)
      const revScore = revStartDist + revEndDist

      const isReversed = revScore < fwdScore
      const score = Math.min(fwdScore, revScore)
      const startDist = isReversed ? revStartDist : fwdStartDist
      const endDist = isReversed ? revEndDist : fwdEndDist

      // Both endpoints must be within threshold
      if (startDist <= ENDPOINT_MATCH_KM && endDist <= ENDPOINT_MATCH_KM && score < bestDist) {
        bestDist = score
        bestTR = { tr, isReversed, startDist, endDist }
      }
    }

    if (!bestTR) {
      noPolyline++
      if (verbose) console.log(`  SKIP (no polyline match): ${route.from_location} → ${route.to_location}`)
      continue
    }

    matched++
    let polyline = bestTR.tr.coords
    if (bestTR.isReversed) polyline = [...polyline].reverse()
    const totalLength = polylineLength(polyline)

    // 3. Find named stops near the polyline
    const candidates = []
    for (const stop of namedStops) {
      const proj = projectOntoPolyline(stop.latitude, stop.longitude, polyline)
      if (proj.dist <= STOP_PROXIMITY_KM) {
        candidates.push({
          stop,
          distFromPolyline: proj.dist,
          along: proj.along,
          pctAlong: proj.along / totalLength,
        })
      }
    }

    // Sort by position along polyline
    candidates.sort((a, b) => a.along - b.along)

    // 4. Deduplicate: keep best within MIN_STOP_SPACING_KM
    const filtered = []
    for (const c of candidates) {
      const existing = filtered.find(f => Math.abs(f.along - c.along) < MIN_STOP_SPACING_KM)
      if (!existing) {
        filtered.push(c)
      } else if (c.distFromPolyline < existing.distFromPolyline) {
        // Replace with closer stop
        const idx = filtered.indexOf(existing)
        filtered[idx] = c
      }
    }

    if (filtered.length < 2) continue

    // 5. Build route_stop entries
    const stops = filtered.map((c, i) => ({
      route_id: route.id,
      transport_stop_id: c.stop.id,
      stop_name: c.stop.name,
      latitude: c.stop.latitude,
      longitude: c.stop.longitude,
      stop_order: i,
      is_terminal: i === 0 || i === filtered.length - 1,
      distance_from_origin_km: Math.round(c.along * 100) / 100,
      duration_from_origin_mins: route.estimated_duration_mins
        ? Math.round(c.pctAlong * route.estimated_duration_mins)
        : null,
    }))

    results.push({
      route: `${route.from_location} → ${route.to_location}`,
      routeId: route.id,
      osmRoute: bestTR.tr.name,
      polylineKm: Math.round(totalLength * 10) / 10,
      matchDist: Math.round(bestDist * 100) / 100,
      stopsFound: stops.length,
      stops,
    })
  }

  // 5b. Remove results with < 3 stops (not useful)
  const validResults = results.filter(r => r.stopsFound >= 3)

  // 6. Report
  console.log(`=== Results ===`)
  console.log(`Routes in DB: ${routes.length}`)
  console.log(`No station coords: ${noCoords}`)
  console.log(`No polyline match: ${noPolyline}`)
  console.log(`Matched with stops: ${validResults.length}`)

  const totalStops = validResults.reduce((sum, r) => sum + r.stopsFound, 0)
  console.log(`Total route_stop entries: ${totalStops}\n`)

  // Show all results
  const sorted = [...validResults].sort((a, b) => b.stopsFound - a.stopsFound)
  for (const r of sorted) {
    const stopNames = r.stops.map(s => s.stop_name).join(' → ')
    console.log(`[${r.stopsFound} stops] ${r.route}`)
    console.log(`  OSM: ${r.osmRoute} | ${r.polylineKm}km | matchDist=${r.matchDist}km`)
    console.log(`  ${stopNames}\n`)
  }

  // 7. Generate SQL
  if (sqlMode && validResults.length > 0) {
    const sqlLines = [
      '-- 044b_seed_route_stops.sql',
      `-- Generated: ${new Date().toISOString()}`,
      `-- Routes: ${results.length}, Stops: ${totalStops}`,
      '-- Run in Supabase SQL Editor AFTER 044_route_stops.sql',
      '',
      '-- Clear existing OSM-sourced stops (safe to re-run)',
      "DELETE FROM route_stops WHERE source = 'osm';",
      '',
    ]

    for (const r of validResults) {
      sqlLines.push(`-- ${r.route} (${r.stopsFound} stops, ${r.polylineKm}km)`)
      sqlLines.push('INSERT INTO route_stops (route_id, transport_stop_id, stop_name, latitude, longitude, stop_order, is_terminal, distance_from_origin_km, duration_from_origin_mins, source, is_verified)')
      sqlLines.push('VALUES')

      const valueLines = r.stops.map((s, i) => {
        const comma = i < r.stops.length - 1 ? ',' : ';'
        const durVal = s.duration_from_origin_mins !== null ? s.duration_from_origin_mins : 'NULL'
        return `  ('${s.route_id}', '${s.transport_stop_id}', '${s.stop_name.replace(/'/g, "''")}', ${s.latitude}, ${s.longitude}, ${s.stop_order}, ${s.is_terminal}, ${s.distance_from_origin_km}, ${durVal}, 'osm', true)${comma}`
      })

      sqlLines.push(...valueLines)
      sqlLines.push('')
    }

    const sqlContent = sqlLines.join('\n')
    const sqlPath = path.join(__dirname, '..', 'lib', 'supabase', 'migrations', '044b_seed_route_stops.sql')
    fs.writeFileSync(sqlPath, sqlContent)
    console.log(`\nSQL written to: ${sqlPath}`)
    console.log(`  ${validResults.length} routes, ${totalStops} stops`)
  }

  console.log('\n=== Done ===')
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
