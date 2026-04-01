/**
 * Fetch OSM transport routes for a SINGLE city and merge into existing transport-routes.json
 *
 * Usage:
 *   node scripts/fetch-routes-city.mjs "Kumasi"
 *   node scripts/fetch-routes-city.mjs "Koforidua"
 *   node scripts/fetch-routes-city.mjs "Takoradi"
 *   node scripts/fetch-routes-city.mjs "Tamale"
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')

const HEADERS = { 'User-Agent': 'Troski-App/1.0' }
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'

const CITY_BBOXES = {
  'Greater Accra': '5.4,-0.5,5.9,0.1',
  'Kumasi':        '6.6,-1.7,6.8,-1.5',
  'Koforidua':     '6.0,-0.3,6.15,-0.2',
  'Takoradi':      '4.85,-1.8,5.0,-1.7',
  'Tamale':        '9.3,-0.9,9.5,-0.75',
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
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
      const wait = attempt * 15000 // 15s, 30s backoff (longer for route queries)
      console.error(`  Overpass ${resp.status}, retrying in ${wait / 1000}s (attempt ${attempt}/${retries})...`)
      await sleep(wait)
    } else {
      console.error(`  Overpass error: ${resp.status} (giving up)`)
      return []
    }
  }
  return []
}

async function fetchRoutesForCity(city, bbox) {
  console.log(`\n=== Fetching routes for ${city} (${bbox}) ===\n`)

  const routeTypes = ['bus', 'share_taxi', 'minibus']
  const allRelations = []
  const seenIds = new Set()

  for (const rt of routeTypes) {
    console.log(`  Fetching ${rt} routes...`)
    const query = `[out:json][timeout:180];relation["type"="route"]["route"="${rt}"](${bbox});out body geom;`
    const elements = await queryOverpass(query)
    let added = 0
    for (const el of elements) {
      if (!seenIds.has(el.id)) {
        seenIds.add(el.id)
        allRelations.push(el)
        added++
      }
    }
    console.log(`    ${elements.length} relations (${added} new)`)
    await sleep(10000) // 10s between route type queries
  }

  console.log(`\n  Total relations for ${city}: ${allRelations.length}`)

  // Process into route objects
  const routes = []
  for (const rel of allRelations) {
    if (!rel.members) continue

    const coords = []
    for (const member of rel.members) {
      if (member.type === 'way' && member.geometry) {
        for (const pt of member.geometry) {
          coords.push([pt.lon, pt.lat])
        }
      }
    }

    if (coords.length < 2) continue

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

    console.log(`    [${rel.id}] "${tags.name || tags.ref || 'unnamed'}" (${routeType}) — ${coords.length} pts → ${simplified.length} simplified`)
  }

  return routes
}

async function main() {
  const cityArg = process.argv[2]
  if (!cityArg) {
    console.error('Usage: node scripts/fetch-routes-city.mjs "CityName"')
    console.error('Available cities:', Object.keys(CITY_BBOXES).join(', '))
    process.exit(1)
  }

  const bbox = CITY_BBOXES[cityArg]
  if (!bbox) {
    console.error(`Unknown city: "${cityArg}"`)
    console.error('Available cities:', Object.keys(CITY_BBOXES).join(', '))
    process.exit(1)
  }

  // Load existing routes file
  const routesPath = path.join(ROOT, 'assets', 'data', 'transport-routes.json')
  let existing = { routes: [], cities: [] }
  if (fs.existsSync(routesPath)) {
    existing = JSON.parse(fs.readFileSync(routesPath, 'utf-8'))
    console.log(`Loaded existing routes: ${existing.routes.length} routes from [${existing.cities?.join(', ') || 'unknown'}]`)
  }

  // Fetch new routes
  const newRoutes = await fetchRoutesForCity(cityArg, bbox)
  console.log(`\nFetched ${newRoutes.length} routes for ${cityArg}`)

  if (newRoutes.length === 0) {
    console.log('No new routes found — existing file unchanged.')
    return
  }

  // Merge: add new routes, skip duplicates by osm_id
  const existingIds = new Set(existing.routes.map((r) => r.osm_id))
  let added = 0
  for (const r of newRoutes) {
    if (!existingIds.has(r.osm_id)) {
      existing.routes.push(r)
      existingIds.add(r.osm_id)
      added++
    }
  }

  // Update metadata
  const cities = new Set(existing.cities || [])
  cities.add(cityArg)
  existing.cities = [...cities]
  existing.count = existing.routes.length
  existing.generated = new Date().toISOString()

  fs.writeFileSync(routesPath, JSON.stringify(existing, null, 2))
  console.log(`\nMerged: ${added} new routes added (${newRoutes.length - added} duplicates skipped)`)
  console.log(`Total routes now: ${existing.routes.length}`)
  console.log(`Wrote ${routesPath}`)
  console.log('\n=== Done ===')
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
