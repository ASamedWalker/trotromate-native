import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import { buildTripActivityVariants, type TripActivityData } from '@/lib/components/TripLiveActivity'
import { estimateETA } from '@/lib/services/trip'
import type { ActiveTrip } from '@/lib/hooks/useTrip'
import type { TripProgress } from '@/lib/services/trip'

// Track the current Live Activity ID (iOS only)
let currentActivityId: string | null = null

const GO_MODE_NOTIFICATION_ID = 'go-mode-progress'

/**
 * Derive display data from trip + progress for the Live Activity / notification
 */
function buildActivityData(trip: ActiveTrip, progress?: TripProgress | null): TripActivityData {
  const transportType = trip.transportType ?? 'trotro'
  const currentStation = progress?.nearestStation?.name ?? trip.stations[0]?.name ?? '...'

  // Find next station (first upcoming after current)
  let nextStation = trip.stations[trip.stations.length - 1]?.name ?? '...'
  if (progress?.stationStatuses) {
    const currentIdx = progress.stationStatuses.findIndex((s) => s.status === 'current')
    const upcoming = progress.stationStatuses.slice(currentIdx + 1).find((s) => s.status === 'upcoming')
    if (upcoming) nextStation = upcoming.station.name
  }

  const progressPercent = progress?.progressPercent ?? 0
  const eta = estimateETA(progress?.distanceToDestinationKm ?? 0, transportType)

  let tripState: TripActivityData['tripState'] = 'active'
  if (progress?.shouldAlertGetOff) tripState = 'arrived'
  else if (progress?.isApproachingDestination && (progress?.distanceToDestinationKm ?? 999) < 1) tripState = 'approaching'

  return {
    routeLabel: trip.routeLabel,
    currentStation,
    nextStation,
    progressPercent,
    eta,
    transportType,
    tripState,
  }
}

/**
 * Start the Live Activity (iOS) and rich ongoing notification (Android)
 */
export async function startTripActivity(trip: ActiveTrip): Promise<void> {
  const data = buildActivityData(trip)

  if (Platform.OS === 'ios') {
    try {
      const { startLiveActivity } = await import('voltra/client')
      const variants = buildTripActivityVariants(data)
      currentActivityId = await startLiveActivity(variants, {
        activityName: 'troski-trip',
        deepLinkUrl: `/trip/${trip.routeId}`,
        relevanceScore: 1.0,
      })
    } catch (e) {
      // Live Activity not supported on this device/OS version — silent
      console.warn('[LiveActivity] Start failed:', e)
    }
  }

  if (Platform.OS === 'android') {
    await postAndroidNotification(data)
  }
}

/**
 * Update the Live Activity (iOS) and rich ongoing notification (Android)
 */
export async function updateTripActivity(trip: ActiveTrip, progress: TripProgress): Promise<void> {
  const data = buildActivityData(trip, progress)

  if (Platform.OS === 'ios' && currentActivityId) {
    try {
      const { updateLiveActivity } = await import('voltra/client')
      const variants = buildTripActivityVariants(data)
      await updateLiveActivity(currentActivityId, variants, {
        relevanceScore: data.tripState === 'approaching' ? 1.0 : 0.8,
      })
    } catch (e) {
      console.warn('[LiveActivity] Update failed:', e)
    }
  }

  if (Platform.OS === 'android') {
    await postAndroidNotification(data)
  }
}

/**
 * End the Live Activity (iOS) and dismiss ongoing notification (Android)
 */
export async function endTripActivity(): Promise<void> {
  if (Platform.OS === 'ios' && currentActivityId) {
    try {
      const { stopLiveActivity } = await import('voltra/client')
      await stopLiveActivity(currentActivityId, { dismissalPolicy: { after: 5000 } })
    } catch (e) {
      console.warn('[LiveActivity] End failed:', e)
    }
    currentActivityId = null
  }

  if (Platform.OS === 'android') {
    try {
      await Notifications.dismissNotificationAsync(GO_MODE_NOTIFICATION_ID)
    } catch {
      // silent
    }
  }
}

/**
 * Post/update Android ongoing notification with trip progress
 */
async function postAndroidNotification(data: TripActivityData): Promise<void> {
  const emoji = data.transportType === 'train' ? '🚂' : '🚐'
  const statusSuffix = data.tripState === 'arrived'
    ? '✓ Arrived!'
    : data.tripState === 'approaching'
      ? '⚡ Almost there!'
      : `ETA ${data.eta}`

  try {
    await Notifications.scheduleNotificationAsync({
      identifier: GO_MODE_NOTIFICATION_ID,
      content: {
        title: `${emoji} ${data.routeLabel}`,
        body: `${data.currentStation} → ${data.nextStation} · ${Math.round(data.progressPercent)}% · ${statusSuffix}`,
        data: { screen: 'trip' },
        sticky: true,
        priority: Notifications.AndroidNotificationPriority.LOW,
        ...(Platform.OS === 'android' ? { channelId: 'go-mode' } : {}),
      },
      trigger: null,
    })
  } catch {
    // silent — notification channel may not exist yet
  }
}
