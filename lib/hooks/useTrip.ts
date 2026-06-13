import { useCallback, useEffect, useSyncExternalStore } from 'react'
import * as Notifications from 'expo-notifications'
import * as TaskManager from 'expo-task-manager'
import * as Location from 'expo-location'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { requestBackgroundPermission, type UserLocation } from './useLocation'
import {
  computeTripProgress,
  type TripStation,
  type TripProgress,
} from '@/lib/services/trip'
import { buildCompletedTrip, saveCompletedTrip, type CompletedTripPayload } from '@/lib/services/trips'
import { startTripActivity, updateTripActivity, endTripActivity } from '@/lib/services/liveActivity'
import { acquireTripChannel, releaseTripChannel } from '@/lib/services/tripChannel'
import type { RealtimeChannel } from '@supabase/supabase-js'

const TRIP_STORAGE_KEY = '@troski_active_trip'
const BACKGROUND_TASK = 'TROSKI_TRIP_TRACKING'

// Transit's crowdsourcing model: a rider in GO Mode broadcasts their vehicle's
// position to riders waiting down the line. Opt-in by construction (GO is an
// explicit user action), Realtime-broadcast only (no DB writes — phone GPS is
// 1-2s fresh vs ~15s for transponders). Consumers subscribe to gps:trip:{routeId}.
const POSITION_BROADCAST_ENABLED = true
const BROADCAST_INTERVAL_MS = 10_000

function newTripKey(): string {
  return 'xxxxxxxxxxxxxxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16))
}

export type TripState = 'idle' | 'active' | 'approaching' | 'arrived'

export interface ActiveTrip {
  routeId: string
  routeLabel: string
  stations: TripStation[]
  startedAt: number
  transportType?: 'trotro' | 'train'
  trainLineId?: string | null
  /** Anonymous per-trip key so riders down-line can tell vehicles apart */
  tripKey?: string
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

/* ════════════════════════════════════════════════════════════════════
   Module-level singleton store.

   There is exactly ONE active trip per app, but useTrip() is consumed
   from several mounted components at once (trip screen, ExploreMap
   banner, stacked navigator entries). Per-instance hook state caused
   split-brain trips: each instance ran its own watcher, its own
   hasAlerted, its own tripState — duplicate notifications, and the
   instance the UI rendered was not the one that detected arrival.
   All trip state and side-effect machinery therefore lives here, once;
   the hook is just a subscription.
   ════════════════════════════════════════════════════════════════════ */

interface TripSnapshot {
  tripState: TripState
  activeTrip: ActiveTrip | null
  progress: TripProgress | null
  lastCompletedTrip: CompletedTripResult | null
}

let snapshot: TripSnapshot = {
  tripState: 'idle',
  activeTrip: null,
  progress: null,
  lastCompletedTrip: null,
}

const listeners = new Set<() => void>()

function setSnapshot(patch: Partial<TripSnapshot>) {
  snapshot = { ...snapshot, ...patch }
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot(): TripSnapshot {
  return snapshot
}

// Side-effect machinery — single set for the whole app
let watcherSub: Location.LocationSubscription | null = null
let pollInterval: ReturnType<typeof setInterval> | null = null
let lastFixTs = 0
let hasAlerted = false
let prevProgress = 0
let broadcastChannel: RealtimeChannel | null = null
let broadcastRouteId: string | null = null
let lastBroadcastTs = 0
let restorePromise: Promise<void> | null = null

function handleFix(loc: UserLocation) {
  const trip = snapshot.activeTrip
  if (!trip) return
  lastFixTs = Date.now()

  const p = computeTripProgress(loc, trip.stations, {
    transportType: trip.transportType ?? 'trotro',
    prevProgress,
  })
  prevProgress = p.progressPercent

  // Broadcast position to riders down the line (throttled, fire-and-forget)
  if (POSITION_BROADCAST_ENABLED && broadcastChannel) {
    const now = Date.now()
    if (now - lastBroadcastTs >= BROADCAST_INTERVAL_MS) {
      lastBroadcastTs = now
      Promise.resolve(
        broadcastChannel.send({
          type: 'broadcast',
          event: 'pos',
          payload: {
            routeId: trip.routeId,
            tripKey: trip.tripKey ?? 'rider',
            transportType: trip.transportType ?? 'trotro',
            latitude: loc.latitude,
            longitude: loc.longitude,
            heading: loc.heading,
            progressPercent: p.progressPercent,
            ts: loc.timestamp,
          },
        }),
      ).catch(() => {})
    }
  }

  // Update Live Activity / Android notification with new progress
  updateTripActivity(trip, p).catch(() => {})

  if (p.shouldAlertGetOff && !hasAlerted) {
    hasAlerted = true
    setSnapshot({ progress: p, tripState: 'arrived' })

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
    return
  }

  // Never downgrade 'arrived' — later fixes at the stop would flip the
  // state back and deadlock the auto-end flow
  if (!hasAlerted && p.isApproachingDestination && p.distanceToDestinationKm < 1) {
    setSnapshot({ progress: p, tripState: 'approaching' })
    return
  }

  setSnapshot({ progress: p })
}

function toUserLocation(loc: Location.LocationObject): UserLocation {
  return {
    latitude: loc.coords.latitude,
    longitude: loc.coords.longitude,
    accuracy: loc.coords.accuracy,
    heading: loc.coords.heading != null && loc.coords.heading >= 0 ? loc.coords.heading : null,
    timestamp: loc.timestamp,
  }
}

function stopTracking() {
  watcherSub?.remove()
  watcherSub = null
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
}

function startTracking() {
  stopTracking()

  Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      timeInterval: 8000,
      distanceInterval: 50,
    },
    (loc) => handleFix(toUserLocation(loc)),
  )
    .then((sub) => {
      watcherSub = sub
    })
    .catch(() => {})

  // Poll fallback: iOS CoreLocation auto-pauses foreground watchers it deems
  // stationary (and the simulator never resumes them). Skip whenever the
  // watcher delivered recently.
  pollInterval = setInterval(async () => {
    if (Date.now() - lastFixTs < 7000) return
    if (!snapshot.activeTrip) return
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
      handleFix(toUserLocation(loc))
    } catch {
      // GPS hiccup — next tick retries
    }
  }, 8000)
}

function openBroadcastChannel(routeId: string) {
  if (!POSITION_BROADCAST_ENABLED) return
  try {
    // Shared ref-counted channel — a watcher screen on the same corridor
    // must survive this trip ending (and vice versa)
    broadcastChannel = acquireTripChannel(routeId)
    broadcastRouteId = routeId
    lastBroadcastTs = 0
  } catch {
    broadcastChannel = null
    broadcastRouteId = null
  }
}

function closeBroadcastChannel() {
  if (broadcastRouteId) {
    releaseTripChannel(broadcastRouteId)
  }
  broadcastChannel = null
  broadcastRouteId = null
}

async function registerBackgroundTask(routeLabel: string) {
  try {
    const bgGranted = await requestBackgroundPermission()
    if (!bgGranted) return
    const isRunning = await TaskManager.isTaskRegisteredAsync(BACKGROUND_TASK)
    if (isRunning) return
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
  } catch {
    // Background tracking is optional
  }
}

/** Restore a persisted trip after app relaunch — idempotent. */
function ensureRestored(): Promise<void> {
  if (restorePromise) return restorePromise
  restorePromise = (async () => {
    try {
      if (snapshot.activeTrip) return
      const raw = await AsyncStorage.getItem(TRIP_STORAGE_KEY)
      if (!raw) return
      const trip: ActiveTrip = JSON.parse(raw)
      if (!trip.tripKey) trip.tripKey = newTripKey()
      hasAlerted = false
      prevProgress = 0
      setSnapshot({ activeTrip: trip, tripState: 'active', progress: null })
      openBroadcastChannel(trip.routeId)
      startTracking()
      registerBackgroundTask(trip.routeLabel)
    } catch {
      // silent
    }
  })()
  return restorePromise
}

async function startTripImpl(
  routeId: string,
  routeLabel: string,
  stations: TripStation[],
  opts?: { transportType?: 'trotro' | 'train'; trainLineId?: string | null },
): Promise<void> {
  const trip: ActiveTrip = {
    routeId,
    routeLabel,
    stations,
    startedAt: Date.now(),
    transportType: opts?.transportType ?? 'trotro',
    trainLineId: opts?.trainLineId ?? null,
    tripKey: newTripKey(),
  }

  hasAlerted = false
  prevProgress = 0
  setSnapshot({ activeTrip: trip, tripState: 'active', progress: null })

  // Persist for the background task + relaunch restore
  await AsyncStorage.setItem(TRIP_STORAGE_KEY, JSON.stringify(trip))

  openBroadcastChannel(routeId)

  // Start Live Activity (iOS) / rich notification (Android)
  startTripActivity(trip).catch(() => {})

  startTracking()
  registerBackgroundTask(routeLabel)
}

async function endTripImpl(deviceId: string): Promise<CompletedTripResult | null> {
  const trip = snapshot.activeTrip
  const reachedDestination = snapshot.tripState === 'arrived'

  // Clear state immediately
  hasAlerted = false
  prevProgress = 0
  setSnapshot({ activeTrip: null, tripState: 'idle', progress: null })

  stopTracking()
  closeBroadcastChannel()
  AsyncStorage.removeItem(TRIP_STORAGE_KEY)
  Location.stopLocationUpdatesAsync(BACKGROUND_TASK).catch(() => {})

  // End Live Activity / dismiss Android notification
  endTripActivity().catch(() => {})

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
    setSnapshot({ lastCompletedTrip: result })
    return result
  }

  return null
}

/* ════════════════════════════════════════════════════════════════════
   Background task — fires when the app is backgrounded mid-trip
   ════════════════════════════════════════════════════════════════════ */
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
    const userLoc = toUserLocation(latest)

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
      await endTripActivity().catch(() => {})
    } else {
      // Update Live Activity with latest progress from background
      await updateTripActivity(trip, progress).catch(() => {})
    }
  } catch {
    // silent
  }
})

export function useTrip(): UseTripReturn {
  const snap = useSyncExternalStore(subscribe, getSnapshot)

  // Restore a persisted trip on first consumer mount (idempotent)
  useEffect(() => {
    ensureRestored()
  }, [])

  const clearCompletedTrip = useCallback(() => {
    setSnapshot({ lastCompletedTrip: null })
  }, [])

  return {
    tripState: snap.tripState,
    activeTrip: snap.activeTrip,
    progress: snap.progress,
    lastCompletedTrip: snap.lastCompletedTrip,
    startTrip: startTripImpl,
    endTrip: endTripImpl,
    clearCompletedTrip,
  }
}
