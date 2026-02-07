import { useQuery } from '@tanstack/react-query'
import { fetchRoutes, fetchPopularRoutes, fetchRouteById } from '@/lib/services/routes'
import type { RouteWithStats, FareReport } from '@/lib/types'

export function useRoutes(from?: string, to?: string) {
  const { data: routes = [], isLoading, refetch } = useQuery({
    queryKey: ['routes', from, to],
    queryFn: () => fetchRoutes(from, to),
  })

  return { routes, isLoading, error: null, refetch }
}

export function usePopularRoutes() {
  const { data: routes = [], isLoading, refetch } = useQuery({
    queryKey: ['routes', 'popular'],
    queryFn: fetchPopularRoutes,
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
