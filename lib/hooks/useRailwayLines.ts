import { useMemo } from 'react'
import railwayData from '@/assets/data/railway-lines.json'

/**
 * Loads bundled OSM railway line geometries and returns GeoJSON for Mapbox layers.
 * Covers Takoradi-Awaso and Dunkwa-Kumasi rail corridors.
 */
export function useRailwayLines() {
  const geojson = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: railwayData.features.map((f: any) => ({
        type: 'Feature' as const,
        geometry: f.geometry,
        properties: { name: f.properties.name },
      })),
    }),
    [],
  )

  return { geojson, count: railwayData.features.length }
}
