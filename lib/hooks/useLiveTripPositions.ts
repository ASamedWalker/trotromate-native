import { useEffect, useRef, useState } from 'react'
import { acquireTripChannel, releaseTripChannel } from '@/lib/services/tripChannel'

/**
 * Live trotro positions for a corridor, crowdsourced from riders in GO Mode.
 *
 * Consumes the `gps:trip:{routeId}` Realtime broadcasts that useTrip emits
 * (phone GPS, 1-2s fresh — beats any transponder). Pure broadcast: nothing
 * touches the database. Positions older than STALE_MS are pruned so a rider
 * who ends their trip (or loses signal) fades off the map instead of
 * lingering as a ghost bus. Channel is shared+ref-counted via tripChannel —
 * see that module for the same-socket hazard it prevents.
 */
export interface LiveTripPosition {
  tripKey: string
  latitude: number
  longitude: number
  heading: number | null
  progressPercent: number
  transportType: 'trotro' | 'train'
  ts: number
  receivedAt: number
}

const STALE_MS = 45_000
const PRUNE_EVERY_MS = 10_000

export function useLiveTripPositions(routeId?: string | null): LiveTripPosition[] {
  const [positions, setPositions] = useState<LiveTripPosition[]>([])
  const byKey = useRef(new Map<string, LiveTripPosition>())

  useEffect(() => {
    if (!routeId) return
    byKey.current.clear()
    setPositions([])

    const onPos = (payload: Record<string, unknown>) => {
      if (typeof payload.latitude !== 'number' || typeof payload.longitude !== 'number') return
      const key = String(payload.tripKey ?? 'rider')
      byKey.current.set(key, {
        tripKey: key,
        latitude: payload.latitude,
        longitude: payload.longitude,
        heading: typeof payload.heading === 'number' ? payload.heading : null,
        progressPercent: typeof payload.progressPercent === 'number' ? payload.progressPercent : 0,
        transportType: payload.transportType === 'train' ? 'train' : 'trotro',
        ts: typeof payload.ts === 'number' ? payload.ts : Date.now(),
        receivedAt: Date.now(),
      })
      setPositions([...byKey.current.values()])
    }

    acquireTripChannel(routeId, onPos)

    const prune = setInterval(() => {
      const now = Date.now()
      let changed = false
      for (const [k, v] of byKey.current) {
        if (now - v.receivedAt > STALE_MS) {
          byKey.current.delete(k)
          changed = true
        }
      }
      if (changed) setPositions([...byKey.current.values()])
    }, PRUNE_EVERY_MS)

    return () => {
      clearInterval(prune)
      releaseTripChannel(routeId, onPos)
    }
  }, [routeId])

  return positions
}
