import { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchRoutes } from '@/lib/services/routes'
import { searchTrainSchedules, TRANSPORT_COLORS } from '@/lib/utils/train-search'

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

  // 300ms debounce
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300)
    return () => clearTimeout(timer)
  }, [query])

  // Search routes from Supabase — "from" match
  const { data: fromRoutes = [], isLoading: fromLoading } = useQuery({
    queryKey: ['unified-search-from', debouncedQuery],
    queryFn: () => fetchRoutes(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
    staleTime: 30_000,
  })

  // Search routes from Supabase — "to" match
  const { data: toRoutes = [], isLoading: toLoading } = useQuery({
    queryKey: ['unified-search-to', debouncedQuery],
    queryFn: () => fetchRoutes(undefined, debouncedQuery),
    enabled: debouncedQuery.length >= 2,
    staleTime: 30_000,
  })

  const results = useMemo(() => {
    const q = debouncedQuery.toLowerCase()
    if (q.length < 2) return []

    const unified: UnifiedResult[] = []
    const seen = new Set<string>()

    // Merge from + to results, dedup by route id
    const allRoutes = [...fromRoutes, ...toRoutes]
    for (const route of allRoutes) {
      if (seen.has(route.id)) continue
      seen.add(route.id)

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

    // Sort: live trains first, then exact from-match, then verified
    unified.sort((a, b) => {
      if (a.liveTag === 'live' && b.liveTag !== 'live') return -1
      if (b.liveTag === 'live' && a.liveTag !== 'live') return 1
      const aExact = a.from.toLowerCase().startsWith(q) ? 0 : 1
      const bExact = b.from.toLowerCase().startsWith(q) ? 0 : 1
      if (aExact !== bExact) return aExact - bExact
      if (a.isVerified && !b.isVerified) return -1
      if (b.isVerified && !a.isVerified) return 1
      return 0
    })

    return unified.slice(0, 15)
  }, [debouncedQuery, fromRoutes, toRoutes])

  const isLoading = (fromLoading || toLoading) && debouncedQuery.length >= 2

  return { results, isLoading }
}
