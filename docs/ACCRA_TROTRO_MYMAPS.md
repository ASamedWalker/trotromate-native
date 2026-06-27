# Accra Trotro Network — Google My Maps

A geographic, shareable Google Maps version of the whole Accra trotro network —
kept OUT of the app (no bloat). 566 routes + 78 lorry-park hubs.

## File
`docs/accra-trotro-network.kml` (493 KB, valid KML, under Google's 5 MB import cap).
Regenerate anytime: `node scripts/export-network-kml.mjs`.

## Publish on Google My Maps (≈2 min)
1. Go to **mymaps.google.com** → **+ Create a new map**.
2. **Import** → upload `docs/accra-trotro-network.kml` (or drag it in).
3. It draws all 566 colored routes + bus-icon hubs. Rename the map
   "Accra Trotro Network".
4. **Share** (top-left panel) → set **"Anyone with the link can view"** → copy the
   link. That's your public Google Maps route map.
   - Optional: **Embed on my site** gives an `<iframe>` to drop on troski.me.

## Notes / limits
- My Maps caps **2,000 features per layer** — we're at 644, fine.
- If My Maps flattens the colors on import, set layer style to **"Individual styles"**
  (the KML ships a color per route number); geometry + names always import.
- It opens directly in the Google Maps app for anyone with the link.

## Data
Source = OSM / **AccraMobile** (2017, the project that first mapped Accra's trotro
lines). For a refresh, the open GTFS feed is `f-ebzz-accratrotro` on transit.land.
