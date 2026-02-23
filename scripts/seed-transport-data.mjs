/**
 * Seed Supabase transport_stops & transport_routes tables from bundled JSON
 *
 * Usage:
 *   node scripts/seed-transport-data.mjs           # Preview mode
 *   node scripts/seed-transport-data.mjs --write   # Write via REST API (needs SUPABASE_SERVICE_KEY env)
 *   node scripts/seed-transport-data.mjs --sql     # Generate SQL to paste into Supabase SQL editor
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const SUPABASE_URL = 'https://rqctajmbfrqtjuwkykrg.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxY3Rham1iZnJxdGp1d2t5a3JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1Mzk5ODcsImV4cCI6MjA4NTExNTk4N30.jaPQiSS9ltsupXB2yMEnEkKyCxjOJUC5AP1KPl7kY68'

// Service role key bypasses RLS (required for --write mode)
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || ''

const writeMode = process.argv.includes('--write')
const sqlMode = process.argv.includes('--sql')
const BATCH_SIZE = 200

// ── Helpers ──────────────────────────────────────────────

function getApiKey() {
  if (writeMode) {
    if (!SUPABASE_SERVICE_KEY) {
      console.error('ERROR: --write mode requires SUPABASE_SERVICE_KEY environment variable')
      console.error('Get it from: Supabase Dashboard → Settings → API → service_role key')
      console.error('\nAlternative: use --sql to generate SQL statements instead')
      process.exit(1)
    }
    return SUPABASE_SERVICE_KEY
  }
  return SUPABASE_ANON_KEY
}

async function supabaseGet(table, select = '*') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=${select}`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  })
  if (!res.ok) throw new Error(`GET ${table}: ${res.status} ${await res.text()}`)
  return res.json()
}

async function supabaseInsertBatch(table, rows) {
  const key = getApiKey()
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=ignore-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  })
  if (!res.ok) throw new Error(`INSERT ${table}: ${res.status} ${await res.text()}`)
}

function escSql(val) {
  if (val === null || val === undefined) return 'NULL'
  if (typeof val === 'number') return String(val)
  if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`
  return `'${String(val).replace(/'/g, "''")}'`
}

// ── Main ─────────────────────────────────────────────────

async function main() {
  if (sqlMode) {
    console.log('-- Generating SQL for Supabase SQL editor...')
  } else {
    console.log(writeMode ? '=== WRITE MODE — will insert into Supabase ===' : '=== PREVIEW MODE ===')
  }
  console.log()

  // Load JSON data
  const stopsFile = path.join(__dirname, '..', 'assets', 'data', 'transport-stops.json')
  const routesFile = path.join(__dirname, '..', 'assets', 'data', 'transport-routes.json')

  const stopsData = JSON.parse(fs.readFileSync(stopsFile, 'utf-8'))
  const routesData = JSON.parse(fs.readFileSync(routesFile, 'utf-8'))

  if (!sqlMode) {
    console.log(`Loaded ${stopsData.count} transport stops from JSON`)
    console.log(`Loaded ${routesData.count} transport routes from JSON`)
    console.log()
  }

  // Fetch existing stations (to link nearby transport stops)
  const stations = await supabaseGet('stations', 'id,name,latitude,longitude')
  if (!sqlMode) console.log(`Found ${stations.length} existing stations in Supabase`)

  // Build station lookup for linking (haversine within 300m)
  function findLinkedStation(lat, lng) {
    for (const st of stations) {
      if (!st.latitude || !st.longitude) continue
      const dlat = (st.latitude - lat) * 111.32
      const dlng = (st.longitude - lng) * 111.32 * Math.cos(lat * Math.PI / 180)
      const dist = Math.sqrt(dlat * dlat + dlng * dlng)
      if (dist < 0.3) return st.id
    }
    return null
  }

  // Build stop rows
  const stopRows = stopsData.stops.map(s => ({
    osm_id: s.osm_id,
    name: s.name || null,
    latitude: s.lat,
    longitude: s.lng,
    stop_type: s.type,
    tags: {},
    linked_station_id: findLinkedStation(s.lat, s.lng),
  }))

  const linkedCount = stopRows.filter(s => s.linked_station_id).length

  // Build route rows
  const routeRows = routesData.routes.map(r => ({
    osm_id: r.osm_id,
    name: r.name || null,
    ref: r.ref || null,
    route_from: r.from || null,
    route_to: r.to || null,
    route_type: r.type,
    coordinates: r.coordinates,
    color: null,
  }))

  // ── SQL mode: generate SQL file ──
  if (sqlMode) {
    const sqlFile = path.join(__dirname, '..', 'lib', 'supabase', 'migrations', '015_seed_transport_data.sql')
    let sql = ''
    sql += '-- Seed transport stops & routes from OSM data\n'
    sql += `-- Generated: ${new Date().toISOString()}\n`
    sql += `-- Stops: ${stopRows.length}, Routes: ${routeRows.length}\n\n`

    // Transport stops — batch INSERT with ON CONFLICT
    sql += '-- ── Transport Stops ──\n\n'
    for (let i = 0; i < stopRows.length; i += BATCH_SIZE) {
      const batch = stopRows.slice(i, i + BATCH_SIZE)
      sql += `INSERT INTO transport_stops (osm_id, name, latitude, longitude, stop_type, tags, linked_station_id)\nVALUES\n`
      sql += batch.map(s =>
        `  (${s.osm_id}, ${escSql(s.name)}, ${s.latitude}, ${s.longitude}, ${escSql(s.stop_type)}, '{}', ${escSql(s.linked_station_id)})`
      ).join(',\n')
      sql += `\nON CONFLICT (osm_id) DO NOTHING;\n\n`
    }

    // Transport routes — batch INSERT with ON CONFLICT
    sql += '-- ── Transport Routes ──\n\n'
    for (let i = 0; i < routeRows.length; i += BATCH_SIZE) {
      const batch = routeRows.slice(i, i + BATCH_SIZE)
      sql += `INSERT INTO transport_routes (osm_id, name, ref, route_from, route_to, route_type, coordinates, color)\nVALUES\n`
      sql += batch.map(r =>
        `  (${r.osm_id}, ${escSql(r.name)}, ${escSql(r.ref)}, ${escSql(r.route_from)}, ${escSql(r.route_to)}, ${escSql(r.route_type)}, ${escSql(r.coordinates)}, NULL)`
      ).join(',\n')
      sql += `\nON CONFLICT (osm_id) DO NOTHING;\n\n`
    }

    fs.writeFileSync(sqlFile, sql, 'utf-8')
    console.log(`✓ Generated SQL file: ${sqlFile}`)
    console.log(`  ${stopRows.length} transport stops + ${routeRows.length} routes`)
    console.log(`  ${linkedCount} stops linked to existing stations`)
    console.log(`\nPaste into Supabase Dashboard → SQL Editor → Run`)
    return
  }

  // ── Preview / Write mode ──

  // Check existing data
  const existingStops = await supabaseGet('transport_stops', 'osm_id')
  const existingRoutes = await supabaseGet('transport_routes', 'osm_id')
  const existingStopIds = new Set(existingStops.map(s => s.osm_id))
  const existingRouteIds = new Set(existingRoutes.map(r => r.osm_id))

  console.log(`Existing in DB: ${existingStops.length} stops, ${existingRoutes.length} routes`)
  console.log()

  const newStops = stopRows.filter(s => !existingStopIds.has(s.osm_id))
  const newRoutes = routeRows.filter(r => !existingRouteIds.has(r.osm_id))

  console.log(`Transport stops: ${newStops.length} new (${stopRows.length - newStops.length} already in DB)`)
  console.log(`  → ${linkedCount} linked to existing stations`)

  if (writeMode && newStops.length > 0) {
    console.log(`  Inserting in batches of ${BATCH_SIZE}...`)
    for (let i = 0; i < newStops.length; i += BATCH_SIZE) {
      const batch = newStops.slice(i, i + BATCH_SIZE)
      await supabaseInsertBatch('transport_stops', batch)
      console.log(`  → Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} rows`)
    }
    console.log(`  ✓ ${newStops.length} transport stops inserted`)
  }

  console.log()
  console.log(`Transport routes: ${newRoutes.length} new (${routeRows.length - newRoutes.length} already in DB)`)

  if (writeMode && newRoutes.length > 0) {
    console.log(`  Inserting in batches of ${BATCH_SIZE}...`)
    for (let i = 0; i < newRoutes.length; i += BATCH_SIZE) {
      const batch = newRoutes.slice(i, i + BATCH_SIZE)
      await supabaseInsertBatch('transport_routes', batch)
      console.log(`  → Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} rows`)
    }
    console.log(`  ✓ ${newRoutes.length} transport routes inserted`)
  }

  console.log()
  console.log('--- Summary ---')
  console.log(`Transport stops: ${newStops.length} to insert`)
  console.log(`Transport routes: ${newRoutes.length} to insert`)

  if (!writeMode) {
    console.log('\nOptions:')
    console.log('  --write   Insert via REST API (needs SUPABASE_SERVICE_KEY env var)')
    console.log('  --sql     Generate SQL file to paste into Supabase SQL editor')
  } else {
    console.log('\n✓ Done!')
  }
}

main().catch(console.error)
