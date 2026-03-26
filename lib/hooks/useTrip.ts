import { useState, useRef, useCallback, useEffect } from 'react'
import * as Notifications from 'expo-notifications'
import * as TaskManager from 'expo-task-manager'
import * as Location from 'expo-location'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useLocation, requestBackgroundPermission, type UserLocation } from './useLocation'
import {
  computeTripProgress,
  type TripStation,
  type TripProgress,
} from '@/lib/services/trip'
import { buildCompletedTrip, saveCompletedTrip, type CompletedTripPayload } from '@/lib/services/trips'

const TRIP_STORAGE_KEY = '@troski_active_trip'
const BACKGROUND_TASK = 'TROSKI_TRIP_TRACKING'

export type TripState = 'idle' | 'active' | 'approaching' | 'arrived'

export interface ActiveTrip {
  routeId: string
  routeLabel: string
  stations: TripStation[]
  startedAt: number
  transportType?: 'trotro' | 'train'
  trainLineId?: string | null
}

/** Returned after endTrip so the UI can show a post-trip prompt */
export interface CompletedTripResult {
  tripId: string | null
  payload: CompletedTripPayload
}

interface UseTripReturn {
  tripState: TripState
  activeTrip: ActiveTrip | null
  progress: TripProgress | null
  lastCompletedTrip: CompletedTripResult | null
  startTrip: (routeId: string, routeLabel: string, stations: TripStation[], opts?: { transportType?: 'trotro' | 'train'; trainLineId?: string | null }) => Promise<void>
  endTrip: (deviceId: string) => Promise<CompletedTripResult | null>
  clearCompletedTrip: () => void
}

// Register background task for location tracking
TaskManager.defineTask(BACKGROUND_TASK, async ({ data, error }) => {
  if (error) return
  if (!data) return

  const { locations } = data as { locations: Location.LocationObject[] }
  if (!locations || locations.length === 0) return

  const latest = locations[locations.length - 1]

  try {
    const raw = await AsyncStorage.getItem(TRIP_STORAGE_KEY)
    if (!raw) return

    const trip: ActiveTrip = JSON.parse(raw)
    const userLoc: UserLocation = {
      latitude: latest.coords.latitude,
      longitude: latest.coords.longitude,
      accuracy: latest.coords.accuracy,
      heading: latest.coords.heading != null && latest.coords.heading >= 0 ? latest.coords.heading : null,
      timestamp: latest.timestamp,
    }

    const progress = computeTripProgress(userLoc, trip.stations, {
      transportType: trip.transportType ?? 'trotro',
    })

    if (progress.shouldAlertGetOff) {
      const dest = trip.stations.find((s) => s.isDestination)
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Time to get off!',
          body: `You're approaching ${dest?.name ?? 'your destination'}`,
          data: {
            screen: 'trip',
            routeId: trip.routeId,
            type: trip.transportType ?? 'trotro',
            lineId: trip.trainLineId ?? undefined,
          },
          sound: true,
        },
        trigger: null,
      })
      await AsyncStorage.removeItem(TRIP_STORAGE_KEY)
      await Location.stopLocationUpdatesAsync(BACKGROUND_TASK).catch(() => {})
    }
  } catch {
    // silent
  }
})

export function useTrip(): UseTripReturn {
  const [tripState, setTripState] = useState<TripState>('idle')
  const [activeTrip, setActiveTrip] = useState<ActiveTrip | null>(null)
  const [progress, setProgress] = useState<TripProgress | null>(null)
  const [lastCompletedTrip, setLastCompletedTrip] = useState<CompletedTripResult | null>(null)
  const hasAlerted = useRef(false)
  const prevProgressRef = useRef(0)
  const { startWatching, stopWatching } = useLocation()

  // Refs to avoid stale closures in endTrip
  const activeTripRef = useRef<ActiveTrip | null>(null)
  const tripStateRef = useRef<TripState>('idle')

  // Keep refs in sync with state
  useEffect(() => { activeTripRef.current = activeTrip }, [activeTrip])
  useEffect(() => { tripStateRef.current = tripState }, [tripState])

  // Restore active trip on mount + restart location watching
  useEffect(() => {
    ;(async () => {
      try {
        const raw = await AsyncStorage.getItem(TRIP_STORAGE_KEY)
        if (raw) {
          const trip: ActiveTrip = JSON.parse(raw)
          setActiveTrip(trip)
          setTripState('active')
        }
      } catch {
        // silent
      }
    })()
  }, [])

  const handleLocationUpdate = useCallback(
    (loc: UserLocation) => {
      if (!activeTripRef.current) return

      const trip = activeTripRef.current
      const p = computeTripProgress(loc, trip.stations, {
        transportType: trip.transportType ?? 'trotro',
        prevProgress: prevProgressRef.current,
      })
      prevProgressRef.current = p.progressPercent
      setProgress(p)

      if (p.shouldAlertGetOff && !hasAlerted.current) {
        hasAlerted.current = true
        setTripState('arrived')

        const dest = trip.stations.find((s) => s.isDestination)
        Notifications.scheduleNotificationAsync({
          content: {
            title: 'Time to get off!',
            body: `You're approaching ${dest?.name ?? 'your destination'}`,
            data: {
              screen: 'trip',
              routeId: trip.routeId,
              type: trip.transportType ?? 'trotro',
              lineId: trip.trainLineId ?? undefined,
            },
            sound: true,
          },
          trigger: null,
        })
      } else if (p.isApproachingDestination && p.distanceToDestinationKm < 1) {
        setTripState('approaching')
      }
    },
    [],
  )

  // Restart location watching + background task when trip is restored from storage
  useEffect(() => {
    if (!activeTrip || tripState !== 'active') return

    // Restart foreground watching
    startWatching(handleLocationUpdate, 8000)

    // Re-register background task (may have been lost on app kill)
    ;(async () => {
      try {
        const bgGranted = await requestBackgroundPermission()
        if (bgGranted) {
          const isRunning = await TaskManager.isTaskRegisteredAsync(BACKGROUND_TASK)
          if (!isRunning) {
            await Location.startLocationUpdatesAsync(BACKGROUND_TASK, {
              accuracy: Location.Accuracy.High,
              timeInterval: 15000,
              distanceInterval: 100,
              foregroundService: {
                notificationTitle: 'Troski GO Mode',
                notificationBody: `Tracking your trip: ${activeTrip.routeLabel}`,
                notificationColor: '#f59e0b',
              },
              showsBackgroundLocationIndicator: true,
            })
          }
        }
      } catch {
        // Background is optional
      }
    })()
    // Only run when activeTrip changes (mount/restore), not every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTrip?.routeId])

  const startTrip = useCallback(
    async (routeId: string, routeLabel: string, stations: TripStation[], opts?: { transportType?: 'trotro' | 'train'; trainLineId?: string | null }) => {
      const trip: ActiveTrip = {
        routeId,
        routeLabel,
        stations,
        startedAt: Date.now(),
        transportType: opts?.transportType ?? 'trotro',
        trainLineId: opts?.trainLineId ?? null,
      }

      setActiveTrip(trip)
      setTripState('active')
      hasAlerted.current = false
      prevProgressRef.current = 0
      setProgress(null)

      // Persist for background task
      await AsyncStorage.setItem(TRIP_STORAGE_KEY, JSON.stringify(trip))

      // Start foreground tracking
      startWatching(handleLocationUpdate, 8000)

      // Try to start background tracking
      try {
        const bgGranted = await requestBackgroundPermission()
        if (bgGranted) {
          const isRunning = await TaskManager.isTaskRegisteredAsync(BACKGROUND_TASK)
          if (!isRunning) {
            await Location.startLocationUpdatesAsync(BACKGROUND_TASK, {
              accuracy: Location.Accuracy.High,
              timeInterval: 15000,
              distanceInterval: 100,
              foregroundService: {
                notificationTitle: 'Troski GO Mode',
                notificationBody: `Tracking your trip: ${routeLabel}`,
                notificationColor: '#f59e0b',
              },
              showsBackgroundLocationIndicator: true,
            })
          }
        }
      } catch {
        // Background tracking is optional
      }
    },
    [startWatching, handleLocationUpdate],
  )

  const endTrip = useCallback(async (deviceId: string): Promise<CompletedTripResult | null> => {
    // Read from refs to avoid stale closure
    const trip = activeTripRef.current
    const reachedDestination = tripStateRef.current === 'arrived'

    // Clear state immediately
    setTripState('idle')
    setActiveTrip(null)
    setProgress(null)
    hasAlerted.current = false
    prevProgressRef.current = 0

    stopWatching()
    AsyncStorage.removeItem(TRIP_STORAGE_KEY)
    Location.stopLocationUpdatesAsync(BACKGROUND_TASK).catch(() => {})

    // Persist trip data to Supabase
    if (trip && deviceId && trip.stations.length >= 2) {
      const payload = buildCompletedTrip({
        deviceId,
        routeId: trip.routeId,
        routeLabel: trip.routeLabel,
        trainLineId: trip.trainLineId,
        transportType: trip.transportType ?? 'trotro',
        stations: trip.stations,
        startedAt: trip.startedAt,
        reachedDestination,
      })
      const tripId = await saveCompletedTrip(payload)
      const result: CompletedTripResult = { tripId, payload }
      setLastCompletedTrip(result)
      return result
    }

    return null
  }, [stopWatching])

  const clearCompletedTrip = useCallback(() => {
    setLastCompletedTrip(null)
  }, [])

  return { tripState, activeTrip, progress, lastCompletedTrip, startTrip, endTrip, clearCompletedTrip }
}
