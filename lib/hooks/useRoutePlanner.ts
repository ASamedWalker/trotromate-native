import { useQuery } from '@tanstack/react-query'
import { planRoute, type TransferPlan } from '@/lib/services/route-planner'

export function useRoutePlanner(from: string, to: string, transportType?: string) {
  const query = useQuery<TransferPlan[]>({
    // 'v2' busts persisted caches from before results were deduped by corridor.
    // Plans are stored on disk by PersistQueryClientProvider, so a change to
    // planner logic otherwise keeps serving the old shape from previous
    // sessions until gcTime expires — bump this whenever the shape changes.
    queryKey: ['route-plan', 'v2', from, to, transportType],
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
