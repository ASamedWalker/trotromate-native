const MAPBOX_TOKEN = 'pk.eyJ1Ijoic2FtcHkxIiwiYSI6ImNranl2NHNjdTAxZzQzMWxldmx5dGhkaDEifQ.1eOzL1554nbXGIPai5Kmlg'

export type LngLat = [number, number]

/**
 * Road-following polyline between two points (Mapbox Directions, driving).
 * Used to draw the bus's corridor toward the drop-off so the marker rides the
 * actual lane instead of a straight line. Returns [] on any failure (caller
 * just skips the line — never blocks tracking).
 */
export async function fetchRoadLine(from: LngLat, to: LngLat): Promise<LngLat[]> {
  try {
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${from[0]},${from[1]};${to[0]},${to[1]}?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`
    const res = await fetch(url)
    const json = await res.json()
    const coords = json?.routes?.[0]?.geometry?.coordinates
    return Array.isArray(coords) ? (coords as LngLat[]) : []
  } catch {
    return []
  }
}
