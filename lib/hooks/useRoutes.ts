import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchRoutes, fetchPopularRoutes, fetchRouteById, fetchFareTrend } from '@/lib/services/routes'
import { cacheRoutes, cachePopularRoutes, getCachedRoutes, getCachedPopularRoutes } from '@/lib/services/offline-cache'
import type { RouteWithStats, FareReport, TransportType } from '@/lib/types'

export function useRoutes(from?: string, to?: string, transportType?: TransportType, region?: string) {
  const [cachedData, setCachedData] = useState<RouteWithStats[] | undefined>(undefined)

  useEffect(() => {
    getCachedRoutes().then((data) => {
      if (data) setCachedData(data)
    })
  }, [])

  const { data: routes = [], isLoading, refetch } = useQuery({
    queryKey: ['routes', from, to, transportType, region],
    queryFn: async () => {
      const result = await fetchRoutes(from, to, transportType, region)
      cacheRoutes(result)
      return result
    },
    placeholderData: cachedData,
  })

  return { routes, isLoading, error: null, refetch }
}

export function usePopularRoutes() {
  const [cachedData, setCachedData] = useState<RouteWithStats[] | undefined>(undefined)

  useEffect(() => {
    getCachedPopularRoutes().then((data) => {
      if (data) setCachedData(data)
    })
  }, [])

  const { data: routes = [], isLoading, refetch } = useQuery({
    queryKey: ['routes', 'popular'],
    queryFn: async () => {
      const result = await fetchPopularRoutes()
      cachePopularRoutes(result)
      return result
    },
    placeholderData: cachedData,
  })

  return { routes, isLoading, error: null, refetch: refetch }
}

export function useRouteDetail(routeId: string) {
  const { data, isLoading } = useQuery({
    queryKey: ['route', routeId],
    queryFn: () => fetchRouteById(routeId),
    enabled: !!routeId,
  })

  const route: RouteWithStats | null = data?.route ?? null
  const recentReports: FareReport[] = data?.recentReports ?? []

  return { route, recentReports, isLoading, error: null }
}

export function useFareTrend(routeId: string) {
  const [days, setDays] = useState(30)

  const { data: trend = [], isLoading } = useQuery({
    queryKey: ['fare-trend', routeId, days],
    queryFn: () => fetchFareTrend(routeId, days),
    enabled: !!routeId,
    staleTime: 5 * 60 * 1000,
  })

  return { trend, isLoading, days, setDays }
}
