import transportStopsData from '@/assets/data/transport-stops.json'

interface TransportStop {
  osm_id: number
  name: string
  lat: number
  lng: number
  type: 'bus_stop' | 'lorry_park' | 'taxi_rank' | 'train_station'
}

// Static data — compute GeoJSON once at module level, not per render
const stops = transportStopsData.stops as TransportStop[]

const geojson = {
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
}

/**
 * Returns bundled OSM transport stops as GeoJSON for Mapbox layers.
 * Static data — computed once at module load, zero per-render cost.
 */
export function useTransportStops() {
  return { geojson, count: stops.length }
}
