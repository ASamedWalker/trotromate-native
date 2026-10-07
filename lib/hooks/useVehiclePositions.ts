import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchVehiclePositions, type VehiclePosition } from '@/lib/services/vehicle-positions'

const REFRESH_INTERVAL_MS = 60_000 // 60 seconds auto-refresh

/**
 * On-demand vehicle positions for consumer map.
 * Fetches once on mount, auto-refreshes every 60s, supports manual refresh.
 * Data-efficient: single API call, no streaming.
 */
/** enabled=false: no fetch and no polling (release mode hides live buses). */
export function useVehiclePositions(routeId?: string, enabled = true) {
  const [vehicles, setVehicles] = useState<VehiclePosition[]>([])
  const [loading, setLoading] = useState(true)
  const [lastFetched, setLastFetched] = useState<Date | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetch = useCallback(async () => {
    const data = await fetchVehiclePositions(routeId)
    setVehicles(data)
    setLastFetched(new Date())
    setLoading(false)
  }, [routeId])

  // Initial fetch + auto-refresh
  useEffect(() => {
    if (!enabled) { setLoading(false); return }
    fetch()

    intervalRef.current = setInterval(fetch, REFRESH_INTERVAL_MS)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetch, enabled])

  return {
    vehicles,
    activeCount: vehicles.filter(v => !v.isStale).length,
    loading,
    lastFetched,
    refetch: fetch,
  }
}
