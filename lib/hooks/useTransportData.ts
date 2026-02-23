import { useMemo } from 'react'
import { getTransportStops, getTransportRoutes } from '@/lib/services/transport-stops'
import type { TransportStop, TransportRoute } from '@/lib/types/transport'

export function useTransportStops(): TransportStop[] {
  return useMemo(() => getTransportStops(), [])
}

export function useTransportRoutes(): TransportRoute[] {
  return useMemo(() => getTransportRoutes(), [])
}
