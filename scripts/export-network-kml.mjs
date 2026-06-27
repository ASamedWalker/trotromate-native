// Export the Accra trotro network (566 OSM/AccraMobile routes) to KML for
// Google My Maps — a geographic, shareable Google Maps version of the network,
// kept OUT of the app (no bloat). Import the .kml into mymaps.google.com.
//
//   node scripts/export-network-kml.mjs
//   → writes docs/accra-trotro-network.kml
//
import fs from 'fs'

const raw = JSON.parse(fs.readFileSync(new URL('../assets/data/transport-routes.json', import.meta.url), 'utf8'))
const routes = raw.routes.filter((r) => Array.isArray(r.coordinates) && r.coordinates.length > 1)

// Same transit palette as the in-app map (RGB hex).
const PALETTE = [
  'E6194B', '3CB44B', '4363D8', 'F58231', '911EB4', '0891B2',
  'BFA000', 'F032E6', '9A6324', '1F8A70', 'E11D48', '2563EB',
  'D946EF', '65A30D', 'EA580C', '7C3AED',
]
const colorFor = (key) => {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}
// KML colors are aabbggrr (alpha, blue, green, red).
const kmlColor = (rgb, alpha = 'ff') => alpha + rgb.slice(4, 6) + rgb.slice(2, 4) + rgb.slice(0, 2)
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// ── Hubs (termini), weighted by how many routes touch them ──
const freq = new Map()
for (const r of routes) {
  for (const [name, c] of [[r.from, r.coordinates[0]], [r.to, r.coordinates[r.coordinates.length - 1]]]) {
    if (!name || !c) continue
    const e = freq.get(name)
    if (e) e.count++
    else freq.set(name, { name, lng: c[0], lat: c[1], count: 1 })
  }
}
const hubs = [...freq.values()].filter((h) => h.count >= 4).sort((a, b) => b.count - a.count)

// ── Build KML ──
const styles = PALETTE.map((rgb, i) =>
  `  <Style id="c${i}"><LineStyle><color>${kmlColor(rgb)}</color><width>3</width></LineStyle></Style>`,
).join('\n')

const hubStyle = `  <Style id="hub"><IconStyle><scale>1.0</scale><Icon><href>http://maps.google.com/mapfiles/kml/shapes/bus.png</href></Icon></IconStyle></Style>`

const routePlacemarks = routes.map((r) => {
  const rgb = colorFor(r.ref || r.name || String(r.osm_id))
  const styleIdx = PALETTE.indexOf(rgb)
  const coordStr = r.coordinates.map(([lng, lat]) => `${lng},${lat},0`).join(' ')
  const title = `${r.ref ? r.ref + ': ' : ''}${r.from} → ${r.to}`
  return `    <Placemark>
      <name>${esc(title)}</name>
      <description>${esc(r.name)}</description>
      <styleUrl>#c${styleIdx}</styleUrl>
      <LineString><tessellate>1</tessellate><coordinates>${coordStr}</coordinates></LineString>
    </Placemark>`
}).join('\n')

const hubPlacemarks = hubs.map((h) =>
  `    <Placemark>
      <name>${esc(h.name)}</name>
      <description>${h.count} trotro routes</description>
      <styleUrl>#hub</styleUrl>
      <Point><coordinates>${h.lng},${h.lat},0</coordinates></Point>
    </Placemark>`,
).join('\n')

const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
 <Document>
  <name>Accra Trotro Network</name>
  <description>${routes.length} trotro routes + ${hubs.length} lorry-park hubs. Source: OSM / AccraMobile. Built by Troski.</description>
${styles}
${hubStyle}
  <Folder>
   <name>Trotro Routes (${routes.length})</name>
${routePlacemarks}
  </Folder>
  <Folder>
   <name>Hubs / Lorry Parks (${hubs.length})</name>
${hubPlacemarks}
  </Folder>
 </Document>
</kml>
`

const outDir = new URL('../docs/', import.meta.url)
fs.mkdirSync(outDir, { recursive: true })
const out = new URL('../docs/accra-trotro-network.kml', import.meta.url)
fs.writeFileSync(out, kml)
const kb = Math.round(Buffer.byteLength(kml) / 1024)
console.log(`✔ wrote docs/accra-trotro-network.kml — ${routes.length} routes, ${hubs.length} hubs, ${kb} KB`)
if (kb > 5000) console.warn('⚠ over 5MB — Google My Maps import cap; split by region if it rejects.')
