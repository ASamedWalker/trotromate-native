import { useEffect } from 'react'
import { Platform } from 'react-native'
import { useMyCommutes } from '@/lib/hooks/useMyCommutes'
import { useUserCommutes } from '@/lib/hooks/useUserCommutes'
import {
  syncCommuteToWatch,
  syncStationsToWatch,
  type QueueStatus,
  type WatchStation,
} from '@/lib/watchSync'

/**
 * Syncs commute + station data to Apple Watch via WatchConnectivity.
 * Runs silently — no-op on Android.
 */
export function useWatchSync(deviceId: string | null) {
  const { commutes } = useMyCommutes()
  const { primaryCommute } = useUserCommutes(deviceId)

  // Sync commute to Watch when it changes
  useEffect(() => {
    if (Platform.OS !== 'ios') return
    const commute = commutes[0]
    if (!commute) return

    syncCommuteToWatch({
      from: commute.from,
      to: commute.to,
      fare: 0, // Will be populated when we have route fare data
      queueStatus: 'short' as QueueStatus,
      waitTime: '',
      lastUpdated: new Date().toISOString(),
    })
  }, [commutes])

  // Sync primary commute from Supabase (has route_id for fare lookup)
  useEffect(() => {
    if (Platform.OS !== 'ios') return
    if (!primaryCommute) return

    syncCommuteToWatch({
      from: primaryCommute.from_location,
      to: primaryCommute.to_location,
      fare: 0,
      queueStatus: 'short' as QueueStatus,
      waitTime: '',
      lastUpdated: new Date().toISOString(),
    })
  }, [primaryCommute])
}
