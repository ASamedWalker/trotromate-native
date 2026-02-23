import { useQuery } from '@tanstack/react-query'
import { fetchTransportStops, fetchTransportRoutes } from '@/lib/services/transport-stops'
import type { TransportStop, TransportRoute } from '@/lib/types/transport'

export function useTransportStops(): TransportStop[] {
  const { data = [] } = useQuery<TransportStop[]>({
    queryKey: ['transport-stops'],
    queryFn: fetchTransportStops,
    staleTime: 24 * 60 * 60 * 1000, // 24h — OSM data rarely changes
  })
  return data
}

export function useTransportRoutes(): TransportRoute[] {
  const { data = [] } = useQuery<TransportRoute[]>({
    queryKey: ['transport-routes'],
    queryFn: fetchTransportRoutes,
    staleTime: 24 * 60 * 60 * 1000,
  })
  return data
}
