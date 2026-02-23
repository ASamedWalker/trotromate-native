/**
 * Expand the stations database with quality OSM transport hubs
 *
 * Identifies lorry parks, trotro stations, and major transit junctions
 * from OSM data that aren't already in the stations table.
 *
 * Usage:
 *   node scripts/expand-stations.mjs           # Preview candidates
 *   node scripts/expand-stations.mjs --sql     # Generate migration SQL
 *   node scripts/expand-stations.mjs --write   # Insert via REST API (needs SUPABASE_SERVICE_KEY)
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const SUPABASE_URL = 'https://rqctajmbfrqtjuwkykrg.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxY3Rham1iZnJxdGp1d2t5a3JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1Mzk5ODcsImV4cCI6MjA4NTExNTk4N30.jaPQiSS9ltsupXB2yMEnEkKyCxjOJUC5AP1KPl7kY68'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || ''

const sqlMode = process.argv.includes('--sql')
const writeMode = process.argv.includes('--write')

// ── Helpers ──────────────────────────────────────────────

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function escSql(val) {
  if (val === null || val === undefined) return 'NULL'
  if (typeof val === 'number') return String(val)
  if (typeof val === 'boolean') return val ? 'true' : 'false'
  return `'${String(val).replace(/'/g, "''")}'`
}

// Non-transport "station" names to exclude
const EXCLUDE_PATTERNS = [
  'police station', 'fire station', 'filling station', 'fuel station',
  'gas station', 'petrol station', 'gas filling', 'allied fuel',
  'goil filling', 'shell filling', 'total filling',
  'school junction', 'school', 'church', 'hospital',
  'resort', 'hotel junction', 'forest hotel',
]

// Too-generic names that don't make good station names
const GENERIC_NAMES = [
  'station', 'new station', 'old station', 'bus station', 'taxi rank',
  'taxi station', 'park', 'car park', 'junction', 'bus stop',
  'train station bus stop',
]

function isTransportHub(stop) {
  const name = (stop.name || '').toLowerCase().trim()

  // Reject too-generic names
  if (GENERIC_NAMES.includes(name)) return false

  // Always include lorry parks (they're transport hubs by definition)
  if (stop.type === 'lorry_park') {
    // But exclude generic "Park" or "Car Park"
    if (name === 'park' || name === 'car park') return false
    return true
  }

  // Include taxi ranks
  if (stop.type === 'taxi_rank') return true

  // Include bus stops with "Station" in the name (but not police/fire/fuel stations)
  if (name.includes('station')) {
    if (EXCLUDE_PATTERNS.some(p => name.includes(p))) return false
    return true
  }

  // Include bus terminals
  if (name.includes('terminal') || name.includes('lorry') || name.includes('trotro')) return true

  return false
}

// Clean up station name for display
function cleanStationName(name) {
  // Remove trailing "Station" duplicates like "Tudu Station Station"
  let clean = name.trim()
  // Normalize "Tro Tro" → "Trotro"
  clean = clean.replace(/Tro Tro/gi, 'Trotro')
  return clean
}

// Derive a location description from the name
function deriveLocation(_name, lat, lng) {
  // For Tema area (lng > -0.05)
  if (lng > -0.05) return 'Tema area'
  // For Kasoa area (lng < -0.4)
  if (lng < -0.4) return 'Kasoa area'
  // For Dodowa area (lat > 0.85)
  if (lat > 5.85) return 'Dodowa area'
  // Central Accra
  if (lat < 5.57 && lng > -0.25 && lng < -0.15) return 'Central Accra'
  // Default by rough area
  if (lng < -0.25) return 'Western Accra'
  if (lng > -0.15) return 'Eastern Accra'
  return 'Greater Accra'
}

async function main() {
  console.log(sqlMode ? '-- Generating expansion SQL...\n' : writeMode ? '=== WRITE MODE ===\n' : '=== PREVIEW MODE ===\n')

  // Load OSM stops
  const stopsFile = path.join(__dirname, '..', 'assets', 'data', 'transport-stops.json')
  const stopsData = JSON.parse(fs.readFileSync(stopsFile, 'utf-8'))
  console.log(`Loaded ${stopsData.count} transport stops from JSON`)

  // Fetch existing stations from Supabase
  const res = await fetch(`${SUPABASE_URL}/rest/v1/stations?select=id,name,latitude,longitude,is_major`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  })
  const existingStations = await res.json()
  console.log(`Found ${existingStations.length} existing stations in Supabase\n`)

  // Filter to quality transport hubs
  const hubs = stopsData.stops.filter(s => s.name && isTransportHub(s))
  console.log(`Transport hubs identified: ${hubs.length}`)

  // Deduplicate against existing stations (within 500m)
  const candidates = []
  for (const hub of hubs) {
    const tooClose = existingStations.some(st => {
      if (!st.latitude || !st.longitude) return false
      return haversineKm(hub.lat, hub.lng, st.latitude, st.longitude) < 0.5
    })
    if (tooClose) continue

    // Also deduplicate against already-accepted candidates (within 300m)
    const dupCandidate = candidates.some(c =>
      haversineKm(hub.lat, hub.lng, c.lat, c.lng) < 0.3
    )
    if (dupCandidate) continue

    candidates.push(hub)
  }

  console.log(`After dedup (500m from existing, 300m from each other): ${candidates.length}\n`)

  // Sort by type priority (lorry_park > taxi_rank > bus_stop) then name
  const typePriority = { lorry_park: 0, taxi_rank: 1, trotro_stop: 2, bus_stop: 3 }
  candidates.sort((a, b) => (typePriority[a.type] ?? 9) - (typePriority[b.type] ?? 9) || a.name.localeCompare(b.name))

  // Display candidates
  console.log('=== NEW STATION CANDIDATES ===\n')
  for (const c of candidates) {
    const loc = deriveLocation(c.name, c.lat, c.lng)
    console.log(`  [${c.type.padEnd(12)}] ${c.name.padEnd(35)} (${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}) — ${loc}`)
  }

  console.log(`\nTotal: ${candidates.length} new stations to add`)

  // ── Generate SQL ──
  if (sqlMode) {
    const sqlFile = path.join(__dirname, '..', 'lib', 'supabase', 'migrations', '016_expand_stations.sql')
    let sql = ''
    sql += '-- Expand station database with OSM transport hubs\n'
    sql += `-- Generated: ${new Date().toISOString()}\n`
    sql += `-- New stations: ${candidates.length}\n`
    sql += '-- All marked as is_major = false (community stations)\n\n'

    for (const c of candidates) {
      const name = cleanStationName(c.name)
      const location = deriveLocation(c.name, c.lat, c.lng)
      sql += `INSERT INTO stations (name, location, latitude, longitude, is_major)\n`
      sql += `  VALUES (${escSql(name)}, ${escSql(location)}, ${c.lat}, ${c.lng}, false)\n`
      sql += `  ON CONFLICT DO NOTHING;\n\n`
    }

    fs.writeFileSync(sqlFile, sql, 'utf-8')
    console.log(`\n✓ Generated: ${sqlFile}`)
    console.log('  Paste into Supabase Dashboard → SQL Editor → Run')
    return
  }

  // ── Write mode ──
  if (writeMode) {
    if (!SUPABASE_SERVICE_KEY) {
      console.error('\nERROR: --write needs SUPABASE_SERVICE_KEY env var')
      console.error('Use --sql to generate SQL instead')
      process.exit(1)
    }

    const rows = candidates.map(c => ({
      name: cleanStationName(c.name),
      location: deriveLocation(c.name, c.lat, c.lng),
      latitude: c.lat,
      longitude: c.lng,
      is_major: false,
    }))

    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/stations`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=ignore-duplicates,return=minimal',
      },
      body: JSON.stringify(rows),
    })

    if (!insertRes.ok) {
      console.error(`\nInsert failed: ${insertRes.status} ${await insertRes.text()}`)
      process.exit(1)
    }

    console.log(`\n✓ Inserted ${rows.length} new stations`)
    return
  }

  console.log('\nOptions:')
  console.log('  --sql     Generate migration SQL file')
  console.log('  --write   Insert via REST API (needs SUPABASE_SERVICE_KEY)')
}

main().catch(console.error)
