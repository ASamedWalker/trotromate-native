import { useQuery } from '@tanstack/react-query'
import { corridorKey } from '@/lib/constants/corridors'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://www.troski.me'

export interface ServiceAlert {
  id: string
  title: string
  body: string | null
  category: 'road_works' | 'traffic' | 'strike' | 'fare' | 'weather' | 'train' | 'other'
  severity: 'info' | 'warning' | 'severe'
  source: string
  corridors: string[]
  citywide: boolean
  starts_at: string
  expires_at: string
  created_at: string
}

/** Official alerts live right now (approved by Troski; web migration 100). Empty on any error. */
export function useAlerts() {
  return useQuery({
    queryKey: ['service-alerts'],
    queryFn: async (): Promise<ServiceAlert[]> => {
      const res = await fetch(`${API_URL}/api/alerts/active`)
      if (!res.ok) return []
      const json = await res.json()
      const now = Date.now()
      return ((json.alerts ?? []) as ServiceAlert[]).filter((a) => new Date(a.expires_at).getTime() > now)
    },
    staleTime: 60 * 1000,
  })
}

/** Alerts on this corridor first, then city-wide ones. */
export function alertsForRoute(alerts: ServiceAlert[] | undefined, from: string, to: string): ServiceAlert[] {
  if (!alerts) return []
  const key = corridorKey(from, to)
  return [...alerts.filter((a) => a.corridors.includes(key)), ...alerts.filter((a) => a.citywide && !a.corridors.includes(key))]
}

export const SEVERITY_STYLE: Record<ServiceAlert['severity'], { bg: string; fg: string; label: string }> = {
  info: { bg: '#DBEAFE', fg: '#1E3A8A', label: 'INFO' },
  warning: { bg: '#FEF3C7', fg: '#78350F', label: 'ALERT' },
  severe: { bg: '#FEE2E2', fg: '#7F1D1D', label: 'SEVERE' },
}

export const CATEGORY_LABEL: Record<ServiceAlert['category'], string> = {
  road_works: 'ROAD WORKS', traffic: 'TRAFFIC', strike: 'STRIKE', fare: 'FARES', weather: 'WEATHER', train: 'TRAIN', other: 'NOTICE',
}
