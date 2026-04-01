import { useMemo } from 'react'
import transportStopsData from '@/assets/data/transport-stops.json'

interface TransportStop {
  osm_id: number
  name: string
  lat: number
  lng: number
  type: 'bus_stop' | 'lorry_park' | 'taxi_rank' | 'train_station'
}

/**
 * Loads bundled OSM transport stops and returns GeoJSON for Mapbox layers.
 * Uses static JSON — no network call, instant load.
 */
export function useTransportStops() {
  const stops = transportStopsData.stops as TransportStop[]

  const geojson = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: stops
        .filter((s) => s.lat && s.lng && s.name)
        .map((s) => ({
          type: 'Feature' as const,
          properties: {
            name: s.name,
            type: s.type,
            osmId: s.osm_id,
          },
          geometry: {
            type: 'Point' as const,
            coordinates: [s.lng, s.lat],
          },
        })),
    }),
    [stops],
  )

  return { geojson, count: stops.length }
}
