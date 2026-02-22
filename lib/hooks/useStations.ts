import { useQuery } from '@tanstack/react-query'
import { fetchStations, type StationWithQueue } from '@/lib/services/stations'

export function useStations() {
  const { data: stations = [], isLoading, refetch } = useQuery<StationWithQueue[]>({
    queryKey: ['stations'],
    queryFn: fetchStations,
  })

  return { stations, isLoading, refetch }
}
