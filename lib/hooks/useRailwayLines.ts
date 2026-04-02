import railwayData from '@/assets/data/railway-lines.json'

// Static data — compute GeoJSON once at module level
const geojson = {
  type: 'FeatureCollection' as const,
  features: railwayData.features.map((f: any) => ({
    type: 'Feature' as const,
    geometry: f.geometry,
    properties: { name: f.properties.name },
  })),
}

/**
 * Returns bundled OSM railway line geometries as GeoJSON for Mapbox layers.
 * Static data — computed once at module load.
 */
export function useRailwayLines() {
  return { geojson, count: railwayData.features.length }
}
