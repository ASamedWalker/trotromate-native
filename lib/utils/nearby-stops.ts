import { haversineKm } from './distance'
import type { TransportStop, TransportStopType } from '@/lib/types/transport'

export interface NearbyStop {
  name: string
  type: TransportStopType
  distanceM: number
}

export function findNearbyStops(
  latitude: number,
  longitude: number,
  stops: TransportStop[],
  radiusKm = 0.5,
  maxResults = 8,
): NearbyStop[] {
  return stops
    .map((stop) => ({
      name: stop.name || 'Unnamed stop',
      type: stop.type,
      distanceM: Math.round(haversineKm(latitude, longitude, stop.lat, stop.lng) * 1000),
    }))
    .filter((s) => s.distanceM <= radiusKm * 1000 && s.distanceM > 20)
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, maxResults)
}
