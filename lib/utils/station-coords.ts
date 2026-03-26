/**
 * Station coordinate fallbacks — single source of truth.
 * Primary source is Supabase `stations.latitude/longitude`.
 * These are used when DB coordinates are missing.
 *
 * Coordinates sourced from OpenStreetMap (Overpass API + Nominatim) 2026-02-23.
 * Verified against Mapcarta.
 */

export const FALLBACK_STATION_COORDS: Record<string, { latitude: number; longitude: number }> = {
  // Major stations (OSM verified)
  'Circle':               { latitude: 5.5703, longitude: -0.2133 }, // OSM: Accra Circle bus station
  'Madina':               { latitude: 5.6767, longitude: -0.1716 }, // OSM: Madina trotro station
  'Tema Station':         { latitude: 5.6596, longitude: -0.0097 }, // Tema city lorry park (kept, OSM "Tema station" is Accra-side)
  'Tema':                 { latitude: 5.6596, longitude: -0.0097 }, // Alias — routes use "Tema", station is "Tema Station"
  'Kaneshie':             { latitude: 5.5641, longitude: -0.2359 }, // OSM: Kaneshie market lorry park
  'Lapaz':                { latitude: 5.6058, longitude: -0.2464 }, // Lapaz Junction
  'Achimota':             { latitude: 5.6133, longitude: -0.2255 }, // OSM: Achimota Overhead
  'Legon':                { latitude: 5.6407, longitude: -0.1790 }, // OSM: Legon
  'Adenta':               { latitude: 5.7060, longitude: -0.1656 }, // OSM: Adenta Trotro Station
  'Kasoa':                { latitude: 5.5341, longitude: -0.4241 }, // OSM: Kasoa Bus Terminal
  'Mallam':               { latitude: 5.5743, longitude: -0.2890 }, // Mallam Junction
  'Dansoman':             { latitude: 5.5468, longitude: -0.2657 }, // Dansoman Roundabout (kept, OSM "Dansoman Station" is at Kaneshie)
  'Ashaiman':             { latitude: 5.6868, longitude: -0.0327 }, // OSM: Ashaiman
  'Spintex':              { latitude: 5.6288, longitude: -0.0902 }, // Spintex Road junction (kept)

  // Other stations (OSM verified where available)
  'Accra Central':        { latitude: 5.5446, longitude: -0.2048 }, // OSM: Tudu Station
  'Haatso':               { latitude: 5.6673, longitude: -0.2047 }, // OSM: Haatso
  'Ofankor':              { latitude: 5.6577, longitude: -0.2655 }, // OSM: Ofankor Barrier
  'Okponglo':             { latitude: 5.6395, longitude: -0.1781 }, // OSM: Okponglo
  'Taifa':                { latitude: 5.6584, longitude: -0.2529 }, // OSM: Taifa
  'Tetteh Quarshie':      { latitude: 5.6240, longitude: -0.1738 }, // OSM: Tetteh Quarshie Roundabout
  '37 Military Hospital': { latitude: 5.5869, longitude: -0.2076 }, // DB name (display as "37 Station")
  '37 Station':           { latitude: 5.5869, longitude: -0.2076 }, // Mapcarta N6968590872
  'Ablekuma':             { latitude: 5.5480, longitude: -0.2520 }, // Ablekuma junction (kept)
  'Abokobi':              { latitude: 5.7150, longitude: -0.1530 }, // Abokobi town (kept)
  'Adjringanor':          { latitude: 5.6497, longitude: -0.1367 }, // Adjringanor
  'Airport':              { latitude: 5.6065, longitude: -0.1773 }, // OSM: Airport First bus stop
  'Airport City':         { latitude: 5.5960, longitude: -0.1720 }, // Airport City
  'Asylum Down':          { latitude: 5.5709, longitude: -0.2025 }, // Asylum Down
  'Atadeka':              { latitude: 5.6920, longitude: -0.0330 }, // Atadeka
  'Dodowa':               { latitude: 5.8881, longitude: -0.0899 }, // OSM: Dodowa Last Stop
  'Dome':                 { latitude: 5.6452, longitude: -0.2372 }, // OSM: Dome
  'East Legon':           { latitude: 5.6483, longitude: -0.1508 }, // OSM: East Legon
  'Maamobi':              { latitude: 5.5905, longitude: -0.1970 }, // Maamobi
  'Nima':                 { latitude: 5.5820, longitude: -0.1988 }, // Nima
  'Nkrumah Circle':       { latitude: 5.5703, longitude: -0.2133 }, // Same as Circle (OSM)
  'Nungua':               { latitude: 5.6022, longitude: -0.0791 }, // OSM: Nungua bus stop
  'Osu':                  { latitude: 5.5541, longitude: -0.1836 }, // OSM: Osu
  'St Johns':             { latitude: 5.6200, longitude: -0.2400 }, // St Johns area (kept)
  'Teshie':               { latitude: 5.5886, longitude: -0.0978 }, // OSM: Teshie First Junction

  // ─── Train stations: Tema–Accra Commuter (TMA) ────────────
  // OSM Overpass API verified, 2026-03-24
  'Community 1':          { latitude: 5.6525, longitude: 0.0036 },  // OSM: Community 1 Train Station
  'Asoprochona':          { latitude: 5.6144, longitude: -0.0551 }, // OSM: Asaprochona station
  'Batchona':             { latitude: 5.6199, longitude: -0.1196 }, // OSM: Baatsona station
  'Alajo':                { latitude: 5.5869, longitude: -0.2076 }, // Near railway crossing
  'Odaw (Circle)':        { latitude: 5.5655, longitude: -0.2191 }, // OSM: Odo station

  // ─── Train stations: Tema–Mpakadan (TMP) ──────────────────
  // OSM for Tema Harbour + Kpong; Google Maps town centers for rest
  'Tema Harbour':         { latitude: 5.6313, longitude: 0.0018 },  // OSM: Tema Fishing Harbour Train Station
  'Tema Industrial Area': { latitude: 5.6420, longitude: -0.0050 }, // Along rail line east of port
  'Afienya':              { latitude: 5.7960, longitude: 0.0020 },  // Town on N1, rail station east side
  'Shai Hills':           { latitude: 5.8870, longitude: 0.0400 },  // Near Shai Hills Resource Reserve
  'Doryumu':              { latitude: 5.9590, longitude: 0.0470 },  // Junction on Accra-Aflao road
  'Kpong':                { latitude: 6.1759, longitude: 0.0591 },  // OSM verified station node
  'Juapong':              { latitude: 6.1920, longitude: 0.0740 },  // Across Volta River from Kpong
  'Mpakadan':             { latitude: 6.3170, longitude: 0.1170 },  // Terminus, east bank Volta Lake
}

/**
 * Get coordinates for a station. Prefers DB values, falls back to curated list.
 */
// Pre-built lowercase lookup for case-insensitive fallback matching
const FALLBACK_LOOKUP: Record<string, { latitude: number; longitude: number }> = {}
for (const [key, val] of Object.entries(FALLBACK_STATION_COORDS)) {
  FALLBACK_LOOKUP[key.toLowerCase()] = val
}

export function getStationCoords(
  station: { name: string; latitude?: number | null; longitude?: number | null }
): { latitude: number; longitude: number } | null {
  if (station.latitude && station.longitude) {
    return { latitude: station.latitude, longitude: station.longitude }
  }
  // Exact match first, then case-insensitive
  return FALLBACK_STATION_COORDS[station.name]
    ?? FALLBACK_LOOKUP[station.name.toLowerCase()]
    ?? null
}
