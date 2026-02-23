/**
 * Update station coordinates in Supabase
 *
 * Coordinates sourced from:
 *   - Mapbox Geocoding API (where it returned specific results)
 *   - Manual lookup for stations Mapbox couldn't resolve
 *
 * Usage:
 *   node scripts/geocode-stations.js           # Preview mode
 *   node scripts/geocode-stations.js --write   # Write to Supabase
 */

const SUPABASE_URL = 'https://rqctajmbfrqtjuwkykrg.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxY3Rham1iZnJxdGp1d2t5a3JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1Mzk5ODcsImV4cCI6MjA4NTExNTk4N30.jaPQiSS9ltsupXB2yMEnEkKyCxjOJUC5AP1KPl7kY68'

// Curated coordinates for all trotro stations in Greater Accra
// Sources: Mapbox geocoding (marked [M]), manual lookup (marked [L])
const STATION_COORDS = {
  // === Major stations ===
  'Circle':              { lat: 5.5560, lon: -0.2055, src: 'L', note: 'Kwame Nkrumah Interchange' },
  'Madina':              { lat: 5.6690, lon: -0.1678, src: 'L', note: 'Madina Zongo Junction' },
  'Tema Station':        { lat: 5.6596, lon: -0.0097, src: 'M', note: 'Tema main lorry park' },
  'Kaneshie':            { lat: 5.5562, lon: -0.2310, src: 'L', note: 'Kaneshie Market lorry park' },
  'Lapaz':               { lat: 5.6058, lon: -0.2464, src: 'L', note: 'Lapaz Junction' },
  'Achimota':            { lat: 5.6140, lon: -0.2200, src: 'L', note: 'Achimota Overpass station' },
  'Legon':               { lat: 5.6503, lon: -0.1869, src: 'L', note: 'UG main gate area' },
  'Adenta':              { lat: 5.7042, lon: -0.1691, src: 'M', note: 'Adenta Barrier' },
  'Kasoa':               { lat: 5.5326, lon: -0.4375, src: 'M', note: 'Kasoa main market' },
  'Mallam':              { lat: 5.5743, lon: -0.2890, src: 'M', note: 'Mallam Junction' },
  'Dansoman':            { lat: 5.5468, lon: -0.2657, src: 'M', note: 'Dansoman Roundabout' },
  'Ashaiman':            { lat: 5.6944, lon: -0.0295, src: 'M', note: 'Ashaiman lorry park' },
  'Spintex':             { lat: 5.6288, lon: -0.0902, src: 'M', note: 'Spintex Road junction' },

  // === Other stations ===
  'Accra Central':       { lat: 5.5480, lon: -0.2115, src: 'L', note: 'Tudu/Makola area' },
  'Haatso':              { lat: 5.6470, lon: -0.2050, src: 'L', note: 'Haatso junction' },
  'Ofankor':             { lat: 5.6636, lon: -0.2652, src: 'M', note: 'Ofankor barrier' },
  'Okponglo':            { lat: 5.6350, lon: -0.1870, src: 'L', note: 'Okponglo junction' },
  'Taifa':               { lat: 5.6340, lon: -0.2520, src: 'L', note: 'Taifa junction' },
  'Tetteh Quarshie':     { lat: 5.5930, lon: -0.1640, src: 'L', note: 'TQ Interchange' },
  '37 Station':          { lat: 5.5869, lon: -0.2076, src: 'L', note: 'Mapcarta N6968590872' },
  'Ablekuma':            { lat: 5.5480, lon: -0.2520, src: 'L', note: 'Ablekuma junction' },
  'Abokobi':             { lat: 5.7150, lon: -0.1530, src: 'L', note: 'Abokobi town' },
  'Adjringanor':         { lat: 5.6497, lon: -0.1367, src: 'M', note: 'Adjiringanor' },
  'Airport':             { lat: 5.6050, lon: -0.1720, src: 'L', note: 'Kotoka area' },
  'Airport City':        { lat: 5.5960, lon: -0.1720, src: 'L', note: 'Airport City' },
  'Asylum Down':         { lat: 5.5709, lon: -0.2025, src: 'M', note: 'Asylum Down' },
  'Atadeka':             { lat: 5.6920, lon: -0.0330, src: 'L', note: 'near Ashaiman' },
  'Dodowa':              { lat: 5.8830, lon: -0.0970, src: 'L', note: 'Dodowa town' },
  'Dome':                { lat: 5.6520, lon: -0.2310, src: 'L', note: 'Dome Market area' },
  'East Legon':          { lat: 5.6393, lon: -0.1625, src: 'M', note: 'East Legon' },
  'Maamobi':             { lat: 5.5905, lon: -0.1970, src: 'M', note: 'Maamobi' },
  'Nima':                { lat: 5.5820, lon: -0.1988, src: 'M', note: 'Nima' },
  'Nkrumah Circle':      { lat: 5.5560, lon: -0.2055, src: 'L', note: 'Same as Circle' },
  'Nungua':              { lat: 5.5607, lon: -0.0740, src: 'L', note: 'Nungua' },
  'Osu':                 { lat: 5.5606, lon: -0.1824, src: 'M', note: 'Osu Oxford Street' },
  'St Johns':            { lat: 5.6200, lon: -0.2400, src: 'L', note: 'St Johns area' },
  'Teshie':              { lat: 5.5835, lon: -0.1050, src: 'L', note: 'Teshie' },
}

const writeMode = process.argv.includes('--write')

async function fetchStations() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/stations?select=id,name,location,latitude,longitude,is_major&order=is_major.desc,name`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  })
  if (!res.ok) throw new Error(`Supabase error: ${res.status} ${await res.text()}`)
  return res.json()
}

async function updateStation(id, lat, lon) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/stations?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ latitude: lat, longitude: lon }),
  })
  if (!res.ok) throw new Error(`Update failed for ${id}: ${res.status}`)
}

async function main() {
  console.log(writeMode ? '=== WRITE MODE — will update Supabase ===' : '=== PREVIEW MODE — use --write to save ===')
  console.log()

  const stations = await fetchStations()
  console.log(`Found ${stations.length} stations in Supabase\n`)

  let updated = 0, skipped = 0, notFound = 0

  for (const station of stations) {
    const coords = STATION_COORDS[station.name]

    if (!coords) {
      console.log(`[SKIP] ${station.name.padEnd(25)} — not in curated list`)
      notFound++
      continue
    }

    const hasExisting = station.latitude && station.longitude
    const changed = !hasExisting || Math.abs(station.latitude - coords.lat) > 0.0001 || Math.abs(station.longitude - coords.lon) > 0.0001

    if (!changed) {
      console.log(`[SAME] ${station.name.padEnd(25)} ${coords.lat}, ${coords.lon} (${coords.note})`)
      skipped++
      continue
    }

    console.log(`[UPD]  ${station.name.padEnd(25)} ${coords.lat}, ${coords.lon} [${coords.src}] (${coords.note})`)
    if (hasExisting) {
      console.log(`       was: ${station.latitude}, ${station.longitude}`)
    } else {
      console.log(`       was: NULL`)
    }

    if (writeMode) {
      await updateStation(station.id, coords.lat, coords.lon)
      console.log(`       ✓ Updated`)
    }
    updated++
  }

  console.log(`\n--- Summary ---`)
  console.log(`Updated: ${updated}`)
  console.log(`Unchanged: ${skipped}`)
  console.log(`Not in list: ${notFound}`)

  // Print SQL migration
  console.log('\n=== SQL Migration ===\n')
  console.log('-- Station coordinates (Mapbox geocoding + manual curation)')
  console.log(`-- Generated: ${new Date().toISOString()}\n`)
  for (const [name, coords] of Object.entries(STATION_COORDS)) {
    console.log(`UPDATE stations SET latitude = ${coords.lat}, longitude = ${coords.lon} WHERE name = '${name.replace(/'/g, "''")}';`)
  }

  if (!writeMode) {
    console.log('\n=== Run with --write to update Supabase ===')
  }
}

main().catch(console.error)
