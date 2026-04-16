import { useEffect } from 'react'
import { Platform } from 'react-native'
import { useMyCommutes } from '@/lib/hooks/useMyCommutes'
import { useUserCommutes } from '@/lib/hooks/useUserCommutes'
import { supabase } from '@/lib/supabase/client'
import {
  syncCommuteToWatch,
  type QueueStatus,
} from '@/lib/watchSync'

/**
 * Syncs commute + station data to Apple Watch via WatchConnectivity.
 * Looks up actual fare from route_fare_stats.
 * Runs silently — no-op on Android.
 */
export function useWatchSync(deviceId: string | null) {
  const { commutes } = useMyCommutes()
  const { primaryCommute } = useUserCommutes(deviceId)

  useEffect(() => {
    if (Platform.OS !== 'ios') return

    const from = primaryCommute?.from_location ?? commutes[0]?.from
    const to = primaryCommute?.to_location ?? commutes[0]?.to
    const routeId = primaryCommute?.route_id ?? commutes[0]?.routeId

    if (!from || !to) return

    // Look up actual fare if we have a route_id
    const syncWithFare = async () => {
      let fare = 0

      if (routeId) {
        const { data } = await supabase
          .from('route_fare_stats')
          .select('avg_reported_fare')
          .eq('route_id', routeId)
          .single()

        if (data?.avg_reported_fare) {
          fare = data.avg_reported_fare
        }
      }

      // If no route_id, try fuzzy match
      if (fare === 0) {
        const { data } = await supabase
          .from('routes')
          .select('id, fare_stats:route_fare_stats(avg_reported_fare)')
          .ilike('from_location', `%${from}%`)
          .ilike('to_location', `%${to}%`)
          .limit(1)
          .single()

        if (data?.fare_stats?.[0]?.avg_reported_fare) {
          fare = data.fare_stats[0].avg_reported_fare
        }
      }

      syncCommuteToWatch({
        from,
        to,
        fare,
        queueStatus: 'short' as QueueStatus,
        waitTime: '',
        lastUpdated: new Date().toISOString(),
      })
    }

    syncWithFare()
  }, [commutes, primaryCommute])
}
