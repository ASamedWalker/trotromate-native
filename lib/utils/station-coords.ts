/**
 * Station coordinate fallbacks — single source of truth.
 * Primary source is Supabase `stations.latitude/longitude`.
 * These are used when DB coordinates are missing.
 *
 * Coordinates sourced from Mapbox Geocoding API + manual curation (2026-02-23).
 */

export const FALLBACK_STATION_COORDS: Record<string, { latitude: number; longitude: number }> = {
  // Major stations
  'Circle':               { latitude: 5.5560, longitude: -0.2055 },
  'Madina':               { latitude: 5.6690, longitude: -0.1678 },
  'Tema Station':         { latitude: 5.6596, longitude: -0.0097 },
  'Kaneshie':             { latitude: 5.5562, longitude: -0.2310 },
  'Lapaz':                { latitude: 5.6058, longitude: -0.2464 },
  'Achimota':             { latitude: 5.6140, longitude: -0.2200 },
  'Legon':                { latitude: 5.6503, longitude: -0.1869 },
  'Adenta':               { latitude: 5.7042, longitude: -0.1691 },
  'Kasoa':                { latitude: 5.5326, longitude: -0.4375 },
  'Mallam':               { latitude: 5.5743, longitude: -0.2890 },
  'Dansoman':             { latitude: 5.5468, longitude: -0.2657 },
  'Ashaiman':             { latitude: 5.6944, longitude: -0.0295 },
  'Spintex':              { latitude: 5.6288, longitude: -0.0902 },

  // Other stations
  'Accra Central':        { latitude: 5.5480, longitude: -0.2115 },
  'Haatso':               { latitude: 5.6470, longitude: -0.2050 },
  'Ofankor':              { latitude: 5.6636, longitude: -0.2652 },
  'Okponglo':             { latitude: 5.6350, longitude: -0.1870 },
  'Taifa':                { latitude: 5.6340, longitude: -0.2520 },
  'Tetteh Quarshie':      { latitude: 5.5930, longitude: -0.1640 },
  '37 Military Hospital': { latitude: 5.5870, longitude: -0.1870 },
  'Ablekuma':             { latitude: 5.5480, longitude: -0.2520 },
  'Abokobi':              { latitude: 5.7150, longitude: -0.1530 },
  'Adjringanor':          { latitude: 5.6497, longitude: -0.1367 },
  'Airport':              { latitude: 5.6050, longitude: -0.1720 },
  'Airport City':         { latitude: 5.5960, longitude: -0.1720 },
  'Asylum Down':          { latitude: 5.5709, longitude: -0.2025 },
  'Atadeka':              { latitude: 5.6920, longitude: -0.0330 },
  'Dodowa':               { latitude: 5.8830, longitude: -0.0970 },
  'Dome':                 { latitude: 5.6520, longitude: -0.2310 },
  'East Legon':           { latitude: 5.6393, longitude: -0.1625 },
  'Maamobi':              { latitude: 5.5905, longitude: -0.1970 },
  'Nima':                 { latitude: 5.5820, longitude: -0.1988 },
  'Nkrumah Circle':       { latitude: 5.5560, longitude: -0.2055 },
  'Nungua':               { latitude: 5.5607, longitude: -0.0740 },
  'Osu':                  { latitude: 5.5606, longitude: -0.1824 },
  'St Johns':             { latitude: 5.6200, longitude: -0.2400 },
  'Teshie':               { latitude: 5.5835, longitude: -0.1050 },
}

/**
 * Get coordinates for a station. Prefers DB values, falls back to curated list.
 */
export function getStationCoords(
  station: { name: string; latitude?: number | null; longitude?: number | null }
): { latitude: number; longitude: number } | null {
  if (station.latitude && station.longitude) {
    return { latitude: station.latitude, longitude: station.longitude }
  }
  return FALLBACK_STATION_COORDS[station.name] || null
}
