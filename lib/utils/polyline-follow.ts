// Minimal polyline-following math (no turf dep) so a tracked vehicle marker can
// ride the actual road geometry instead of straight-line tweening between sparse
// GPS fixes. Equirectangular metres — accurate enough at city scale (Accra).

export type LngLat = [number, number]

const R = 6371000 // earth radius, metres
const toRad = (d: number) => (d * Math.PI) / 180

// Local planar projection around a reference latitude (metres east/north).
function planar(p: LngLat, refLatRad: number): [number, number] {
  return [toRad(p[0]) * Math.cos(refLatRad) * R, toRad(p[1]) * R]
}

/** Cumulative metre distance at each vertex of the line. */
export function cumulativeDistances(line: LngLat[]): number[] {
  const cum = [0]
  if (line.length < 2) return cum
  const refLat = toRad(line[0][1])
  let prev = planar(line[0], refLat)
  for (let i = 1; i < line.length; i++) {
    const cur = planar(line[i], refLat)
    const d = Math.hypot(cur[0] - prev[0], cur[1] - prev[1])
    cum.push(cum[i - 1] + d)
    prev = cur
  }
  return cum
}

export function lineLength(cum: number[]): number {
  return cum[cum.length - 1] ?? 0
}

/**
 * Project a point onto the line. Returns the along-line distance (metres) of the
 * nearest point and the perpendicular offset (how far the raw point sat off the
 * road — used to detect when the bus has left the corridor).
 */
export function projectToLine(line: LngLat[], cum: number[], pt: LngLat): { dist: number; offset: number } {
  if (line.length < 2) return { dist: 0, offset: 0 }
  const refLat = toRad(line[0][1])
  const p = planar(pt, refLat)
  let best = { dist: 0, offset: Infinity }
  for (let i = 0; i < line.length - 1; i++) {
    const a = planar(line[i], refLat)
    const b = planar(line[i + 1], refLat)
    const abx = b[0] - a[0], aby = b[1] - a[1]
    const segLen2 = abx * abx + aby * aby || 1e-9
    let t = ((p[0] - a[0]) * abx + (p[1] - a[1]) * aby) / segLen2
    t = Math.max(0, Math.min(1, t))
    const projX = a[0] + abx * t, projY = a[1] + aby * t
    const offset = Math.hypot(p[0] - projX, p[1] - projY)
    if (offset < best.offset) {
      const segLen = Math.sqrt(segLen2)
      best = { dist: cum[i] + segLen * t, offset }
    }
  }
  return best
}

/** Coordinate + bearing (deg, clockwise from north) at a given along-line distance. */
export function pointAtDistance(line: LngLat[], cum: number[], d: number): { coord: LngLat; bearing: number } {
  if (line.length === 1) return { coord: line[0], bearing: 0 }
  const total = lineLength(cum)
  const clamped = Math.max(0, Math.min(total, d))
  let i = 0
  while (i < cum.length - 2 && cum[i + 1] < clamped) i++
  const segLen = cum[i + 1] - cum[i] || 1e-9
  const t = (clamped - cum[i]) / segLen
  const a = line[i], b = line[i + 1]
  const coord: LngLat = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
  // Bearing along the segment.
  const y = Math.sin(toRad(b[0] - a[0])) * Math.cos(toRad(b[1]))
  const x = Math.cos(toRad(a[1])) * Math.sin(toRad(b[1])) - Math.sin(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.cos(toRad(b[0] - a[0]))
  const bearing = (Math.atan2(y, x) * 180) / Math.PI
  return { coord, bearing: (bearing + 360) % 360 }
}
