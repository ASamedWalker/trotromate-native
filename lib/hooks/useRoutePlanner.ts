import { useQuery } from '@tanstack/react-query'
import { planRoute, type TransferPlan } from '@/lib/services/route-planner'

export function useRoutePlanner(from: string, to: string, transportType?: string) {
  const query = useQuery<TransferPlan[]>({
    queryKey: ['route-plan', from, to, transportType],
    queryFn: () => planRoute(from, to, transportType),
    enabled: from.length >= 2 && to.length >= 2 && transportType !== 'walk',
    staleTime: 5 * 60 * 1000, // 5 min
  })

  return {
    plans: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  }
}
