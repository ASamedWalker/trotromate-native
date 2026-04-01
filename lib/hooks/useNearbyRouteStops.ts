import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { haversineKm } from '@/lib/utils/distance'
import type { RouteStop } from '@/lib/types'

const MAX_NEARBY = 5

export interface NearbyStop {
  name: string
  latitude: number
  longitude: number
  routeIds: string[]
  distanceKm: number | null
}

interface RouteLineData {
  routeId: string
  stops: RouteStop[]
}

/**
 * Progressive-disclosure hook for the homepage map.
 *
 * Fetches all route_stops once, exposes:
 * - nearbyStopsGeoJSON: 3-5 closest unique stops (clean on-load)
 * - getRouteLineGeoJSON(routeIds): polylines for tap interaction
 * - getRouteStopsGeoJSON(routeIds): stop dots for tap interaction
 * - getRoutesForStop(stopName): reverse lookup
 */
export function useNearbyRouteStops(
  userLat: number | null,
  userLng: number | null,
) {
  const { data: routeLines = [] } = useQuery<RouteLineData[]>({
    queryKey: ['route-stops-map'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('route_stops')
        .select('*')
        .order('route_id')
        .order('stop_order', { ascending: true })

      if (error || !data) return []

      const grouped = new Map<string, RouteStop[]>()
      for (const stop of data as RouteStop[]) {
        const existing = grouped.get(stop.route_id)
        if (existing) existing.push(stop)
        else grouped.set(stop.route_id, [stop])
      }

      return Array.from(grouped.entries())
        .filter(([, stops]) => stops.length >= 2)
        .map(([routeId, stops]) => ({ routeId, stops }))
    },
    staleTime: 10 * 60 * 1000,
  })

  // Index: stopName (lowercase) → coords + routeIds
  const stopIndex = useMemo(() => {
    const index = new Map<string, { lat: number; lng: number; routeIds: Set<string> }>()
    for (const { routeId, stops } of routeLines) {
      for (const stop of stops) {
        const key = stop.stop_name.toLowerCase()
        const entry = index.get(key)
        if (entry) {
          entry.routeIds.add(routeId)
        } else {
          index.set(key, {
            lat: stop.latitude,
            lng: stop.longitude,
            routeIds: new Set([routeId]),
          })
        }
      }
    }
    return index
  }, [routeLines])

  // Index: routeId → stops
  const routeIndex = useMemo(() => {
    const index = new Map<string, RouteStop[]>()
    for (const { routeId, stops } of routeLines) {
      index.set(routeId, stops)
    }
    return index
  }, [routeLines])

  // Nearest unique stops sorted by distance
  const nearbyStops = useMemo((): NearbyStop[] => {
    const all: NearbyStop[] = []
    for (const [name, entry] of stopIndex) {
      const distanceKm =
        userLat != null && userLng != null
          ? haversineKm(userLat, userLng, entry.lat, entry.lng)
          : null
      all.push({
        name,
        latitude: entry.lat,
        longitude: entry.lng,
        routeIds: Array.from(entry.routeIds),
        distanceKm,
      })
    }
    if (userLat != null) {
      all.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))
    }
    return all.slice(0, MAX_NEARBY)
  }, [stopIndex, userLat, userLng])

  // GeoJSON for nearby stops with rank for data-driven styling
  const nearbyStopsGeoJSON = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: nearbyStops.map((stop, i) => ({
        type: 'Feature' as const,
        properties: {
          name: stop.name,
          rank: i,
          routeCount: stop.routeIds.length,
          distanceKm: stop.distanceKm,
          routeIds: stop.routeIds.join(','),
        },
        geometry: {
          type: 'Point' as const,
          coordinates: [stop.longitude, stop.latitude],
        },
      })),
    }),
    [nearbyStops],
  )

  const getRoutesForStop = (stopName: string): string[] => {
    const entry = stopIndex.get(stopName.toLowerCase())
    return entry ? Array.from(entry.routeIds) : []
  }

  const getRouteLineGeoJSON = (routeIds: string[]) => ({
    type: 'FeatureCollection' as const,
    features: routeIds
      .map((id) => {
        const stops = routeIndex.get(id)
        if (!stops || stops.length < 2) return null
        return {
          type: 'Feature' as const,
          properties: { routeId: id },
          geometry: {
            type: 'LineString' as const,
            coordinates: stops.map((s) => [s.longitude, s.latitude]),
          },
        }
      })
      .filter(Boolean),
  })

  const getRouteStopsGeoJSON = (routeIds: string[]) => ({
    type: 'FeatureCollection' as const,
    features: routeIds.flatMap((id) => {
      const stops = routeIndex.get(id) ?? []
      return stops.map((stop) => ({
        type: 'Feature' as const,
        properties: {
          name: stop.stop_name,
          isTerminal: stop.is_terminal,
          routeId: id,
        },
        geometry: {
          type: 'Point' as const,
          coordinates: [stop.longitude, stop.latitude],
        },
      }))
    }),
  })

  return {
    nearbyStops,
    nearbyStopsGeoJSON,
    getRoutesForStop,
    getRouteLineGeoJSON,
    getRouteStopsGeoJSON,
    routeCount: routeLines.length,
  }
}
