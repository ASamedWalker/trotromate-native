import { useState, useEffect, useMemo } from 'react'
import { usePopularRoutes } from '@/lib/hooks/useRoutes'
import { searchTrainSchedules, TRANSPORT_COLORS } from '@/lib/utils/train-search'
import type { RouteWithStats } from '@/lib/types'

/* ── Types ─────────────────────────────────────────── */

export interface UnifiedResult {
  id: string
  type: 'trotro' | 'train' | 'okada'
  from: string
  to: string
  fare: number | null
  timeLabel: string
  liveTag?: 'live' | 'scheduled' | 'done'
  lineName?: string
  isVerified?: boolean
  routeId: string
  trainLineId?: string
  color: string
}

/* ── Hook ──────────────────────────────────────────── */

export function useUnifiedSearch(query: string) {
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const { routes, isLoading: routesLoading } = usePopularRoutes()

  // 300ms debounce
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300)
    return () => clearTimeout(timer)
  }, [query])

  const results = useMemo(() => {
    const q = debouncedQuery.toLowerCase()
    if (q.length < 2) return []

    const unified: UnifiedResult[] = []

    // Trotro/okada routes — client-side filter
    for (const route of routes) {
      const from = route.from_location.toLowerCase()
      const to = route.to_location.toLowerCase()
      if (!from.includes(q) && !to.includes(q)) continue

      const fare = route.fare_stats?.avg_reported_fare ?? route.official_fare
      const duration = route.traffic?.duration_in_traffic_mins ?? route.estimated_duration_mins
      const transportType = (route.transport_type as 'trotro' | 'okada') || 'trotro'

      unified.push({
        id: `route-${route.id}`,
        type: transportType,
        from: route.from_location,
        to: route.to_location,
        fare,
        timeLabel: duration ? `${duration} min` : '',
        isVerified: route.is_gprtu_verified,
        routeId: route.id,
        color: TRANSPORT_COLORS[transportType] || TRANSPORT_COLORS.trotro,
      })
    }

    // Train schedules — client-side filter
    const trainResults = searchTrainSchedules(debouncedQuery)
    for (const train of trainResults) {
      unified.push({
        id: train.id,
        type: 'train',
        from: train.from,
        to: train.to,
        fare: train.fare,
        timeLabel: train.timeLabel,
        liveTag: train.liveTag,
        lineName: train.lineName,
        routeId: train.lineId,
        trainLineId: train.lineId,
        color: TRANSPORT_COLORS.train,
      })
    }

    // Sort: live trains first, then exact from-match, then partial
    unified.sort((a, b) => {
      // Live trains on top
      if (a.liveTag === 'live' && b.liveTag !== 'live') return -1
      if (b.liveTag === 'live' && a.liveTag !== 'live') return 1
      // Exact from-match
      const aExact = a.from.toLowerCase().startsWith(q) ? 0 : 1
      const bExact = b.from.toLowerCase().startsWith(q) ? 0 : 1
      if (aExact !== bExact) return aExact - bExact
      // Verified first
      if (a.isVerified && !b.isVerified) return -1
      if (b.isVerified && !a.isVerified) return 1
      return 0
    })

    return unified.slice(0, 10)
  }, [debouncedQuery, routes])

  return { results, isLoading: routesLoading && debouncedQuery.length >= 2 }
}
