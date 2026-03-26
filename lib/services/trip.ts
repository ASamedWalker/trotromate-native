import type { Station } from '@/lib/types'
import type { UserLocation } from '@/lib/hooks/useLocation'

export interface TripStation {
  id: string
  name: string
  latitude: number
  longitude: number
  isOrigin: boolean
  isDestination: boolean
}

export interface StationStatus {
  station: TripStation
  status: 'passed' | 'current' | 'upcoming'
  distanceKm: number
}

export interface TripProgress {
  nearestStation: TripStation | null
  distanceToDestinationKm: number
  distanceToNearestKm: number
  isApproachingDestination: boolean
  shouldAlertGetOff: boolean
  progressPercent: number
  stationStatuses: StationStatus[]
}

// Transport-aware thresholds: trotro stops are 200-300m apart, train stations are 5-10km apart
const GET_OFF_THRESHOLD: Record<string, number> = {
  trotro: 300,  // meters — tight enough for Accra trotro stops
  train: 500,   // meters — wider buffer for train stations
}
const EARTH_RADIUS_KM = 6371

/**
 * Haversine distance between two points in km
 */
export function getDistanceKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return EARTH_RADIUS_KM * c
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

/**
 * Format distance for display
 */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)}m`
  return `${km.toFixed(1)}km`
}

// Average speeds for ETA estimation (km/h)
const AVG_SPEED: Record<string, number> = {
  trotro: 20,  // Accra traffic reality
  train: 40,   // Ghana railway average
}

/**
 * Estimate time of arrival based on distance and transport type
 */
export function estimateETA(distanceKm: number, type: 'trotro' | 'train' = 'trotro'): string {
  const speed = AVG_SPEED[type] ?? 20
  const mins = Math.round((distanceKm / speed) * 60)
  if (mins < 1) return '< 1 min'
  if (mins >= 60) return `~${Math.round(mins / 60)}h ${mins % 60}m`
  return `~${mins} min`
}

/**
 * Given a list of stations on a trip, find the nearest one to the user
 * and compute trip progress.
 */
export function computeTripProgress(
  userLocation: UserLocation,
  stations: TripStation[],
  opts?: { transportType?: 'trotro' | 'train'; prevProgress?: number },
): TripProgress {
  if (stations.length === 0) {
    return {
      nearestStation: null,
      distanceToDestinationKm: 0,
      distanceToNearestKm: 0,
      isApproachingDestination: false,
      shouldAlertGetOff: false,
      progressPercent: 0,
      stationStatuses: [],
    }
  }

  const destination = stations.find((s) => s.isDestination) ?? stations[stations.length - 1]
  const origin = stations.find((s) => s.isOrigin) ?? stations[0]

  // Distance from user to each station
  const distances = stations.map((station) => ({
    station,
    distance: getDistanceKm(
      userLocation.latitude, userLocation.longitude,
      station.latitude, station.longitude,
    ),
  }))

  // Nearest station
  distances.sort((a, b) => a.distance - b.distance)
  const nearest = distances[0]

  // Distance to destination
  const distToDest = getDistanceKm(
    userLocation.latitude, userLocation.longitude,
    destination.latitude, destination.longitude,
  )

  // Total route distance (origin to destination as the crow flies)
  const totalDist = getDistanceKm(
    origin.latitude, origin.longitude,
    destination.latitude, destination.longitude,
  )

  // Distance from origin to user
  const distFromOrigin = getDistanceKm(
    origin.latitude, origin.longitude,
    userLocation.latitude, userLocation.longitude,
  )

  // Progress: how far along from origin to destination (clamped 0-100)
  let progressPercent = totalDist > 0
    ? Math.min(100, Math.max(0, ((totalDist - distToDest) / totalDist) * 100))
    : 0

  // Never go backwards — GPS drift shouldn't make progress bar jump back
  if (opts?.prevProgress != null && progressPercent < opts.prevProgress) {
    progressPercent = opts.prevProgress
  }

  // Transport-aware get-off threshold + GPS accuracy tolerance
  const thresholdM = GET_OFF_THRESHOLD[opts?.transportType ?? 'trotro'] ?? 300
  const accuracyM = userLocation.accuracy ?? 0
  const shouldAlertGetOff = distToDest * 1000 <= (thresholdM + accuracyM)

  // Station-by-station status: passed if user is closer to destination than the station is,
  // current = nearest station, upcoming = everything else
  const stationStatuses: StationStatus[] = stations.map((station) => {
    const distStationToOrigin = getDistanceKm(
      origin.latitude, origin.longitude,
      station.latitude, station.longitude,
    )
    const distUserToStation = getDistanceKm(
      userLocation.latitude, userLocation.longitude,
      station.latitude, station.longitude,
    )

    let status: 'passed' | 'current' | 'upcoming'
    if (station.id === nearest.station.id) {
      status = 'current'
    } else if (distStationToOrigin < distFromOrigin && distUserToStation > 0.3) {
      // Station is behind the user (closer to origin) and user is >300m past it
      status = 'passed'
    } else {
      status = 'upcoming'
    }

    return { station, status, distanceKm: distUserToStation }
  })

  return {
    nearestStation: nearest.station,
    distanceToDestinationKm: distToDest,
    distanceToNearestKm: nearest.distance,
    isApproachingDestination: distToDest < distFromOrigin,
    shouldAlertGetOff,
    progressPercent,
    stationStatuses,
  }
}

/**
 * Build trip stations from origin/destination info.
 * Uses station coordinates when available, with intermediate stations
 * from the stations list that fall roughly between origin and destination.
 */
export function buildTripStations(
  originStation: Pick<Station, 'id' | 'name'> & { latitude: number; longitude: number },
  destinationStation: Pick<Station, 'id' | 'name'> & { latitude: number; longitude: number },
  allStations: Array<{ id: string; name: string; latitude: number; longitude: number }>,
): TripStation[] {
  const origin: TripStation = {
    ...originStation,
    isOrigin: true,
    isDestination: false,
  }

  const dest: TripStation = {
    ...destinationStation,
    isOrigin: false,
    isDestination: true,
  }

  // Find intermediate stations within a corridor between origin and destination
  const totalDist = getDistanceKm(
    origin.latitude, origin.longitude,
    dest.latitude, dest.longitude,
  )
  const intermediates = allStations
    .filter((s) => s.id !== origin.id && s.id !== dest.id)
    .filter((s) => {
      const distToOrigin = getDistanceKm(origin.latitude, origin.longitude, s.latitude, s.longitude)
      const distToDest = getDistanceKm(dest.latitude, dest.longitude, s.latitude, s.longitude)
      // Station is between origin and destination (within corridor)
      return (
        distToOrigin < totalDist &&
        distToDest < totalDist &&
        distToOrigin + distToDest < totalDist * 1.5 // not too far off the straight line
      )
    })
    .map((s) => ({
      ...s,
      isOrigin: false,
      isDestination: false,
      distFromOrigin: getDistanceKm(origin.latitude, origin.longitude, s.latitude, s.longitude),
    }))
    .sort((a, b) => a.distFromOrigin - b.distFromOrigin)

  return [origin, ...intermediates, dest]
}
