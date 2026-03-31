// Train station coordinates — sourced from OpenStreetMap
// © OpenStreetMap contributors (ODbL license)
// Exact = OSM railway node, Approximate = town center (~0.5-2km from actual station)

export interface TrainStationCoords {
  name: string
  lat: number
  lng: number
  line: 'TMA' | 'TMP' | 'both'
  accuracy: 'exact' | 'approximate'
  osmNodeId?: string
}

// ─── TMA Line: Community 1 ↔ Accra Central (8 stations) ───
// ─── TMP Line: Tema Harbour ↔ Mpakadan (9 stations) ───

export const TRAIN_STATION_COORDS: TrainStationCoords[] = [
  // ── TMA Line ──
  { name: 'Community 1', lat: 5.6525, lng: 0.0036, line: 'TMA', accuracy: 'exact', osmNodeId: 'N133492151' },
  { name: 'Tema Station', lat: 5.6311, lng: 0.0018, line: 'both', accuracy: 'exact', osmNodeId: 'N9937916704' },
  { name: 'Asoprochona', lat: 5.6145, lng: -0.0550, line: 'TMA', accuracy: 'exact', osmNodeId: 'N9937596017' },
  { name: 'Batchona', lat: 5.6197, lng: -0.1197, line: 'TMA', accuracy: 'exact', osmNodeId: 'N133027073' },
  { name: 'Alajo', lat: 5.5879, lng: -0.2182, line: 'TMA', accuracy: 'approximate' },
  { name: 'Achimota', lat: 5.6074, lng: -0.2237, line: 'TMA', accuracy: 'exact', osmNodeId: 'N9937596017' },
  { name: 'Odaw (Circle)', lat: 5.5655, lng: -0.2191, line: 'TMA', accuracy: 'exact', osmNodeId: 'Odo stop' },
  { name: 'Accra Central', lat: 5.5489, lng: -0.2110, line: 'TMA', accuracy: 'exact', osmNodeId: 'N1375249822' },

  // ── TMP Line ──
  { name: 'Tema Harbour', lat: 5.6311, lng: 0.0018, line: 'both', accuracy: 'exact', osmNodeId: 'N9937916704' },
  { name: 'Tema Industrial Area', lat: 5.6796, lng: 0.0026, line: 'TMP', accuracy: 'approximate' },
  { name: 'Ashaiman', lat: 5.6868, lng: -0.0327, line: 'TMP', accuracy: 'approximate' },
  { name: 'Afienya', lat: 5.7981, lng: 0.0052, line: 'TMP', accuracy: 'approximate' },
  { name: 'Shai Hills', lat: 5.8840, lng: 0.0386, line: 'TMP', accuracy: 'approximate' },
  { name: 'Doryumu', lat: 5.9007, lng: 0.0232, line: 'TMP', accuracy: 'approximate' },
  { name: 'Kpong', lat: 6.1759, lng: 0.0591, line: 'TMP', accuracy: 'exact', osmNodeId: 'N16943966' },
  { name: 'Juapong', lat: 6.2545, lng: 0.1353, line: 'TMP', accuracy: 'approximate' },
  { name: 'Mpakadan', lat: 6.3322, lng: 0.1090, line: 'TMP', accuracy: 'approximate' },
]

/** Get coordinates for a station by name (fuzzy match) */
export function getStationCoords(stationName: string): TrainStationCoords | undefined {
  const lower = stationName.toLowerCase()
  return TRAIN_STATION_COORDS.find(s =>
    s.name.toLowerCase() === lower ||
    lower.includes(s.name.toLowerCase()) ||
    s.name.toLowerCase().includes(lower)
  )
}

/** Get all stations for a specific line */
export function getLineStations(line: 'TMA' | 'TMP'): TrainStationCoords[] {
  return TRAIN_STATION_COORDS.filter(s => s.line === line || s.line === 'both')
}
