import { useMemo } from 'react'
import { usePopularRoutes } from '@/lib/hooks/useRoutes'

// Offline / empty fallback — used only until real popular routes load.
const FALLBACK_STATIONS = [
  'Circle', 'Madina', 'Tema', 'Kaneshie', 'Lapaz',
  'Achimota', 'Legon', 'Kasoa', 'Dansoman', 'Spintex',
  'Nima', 'Osu', 'Labadi', 'Teshie', 'Ashaiman',
]

/**
 * Most-used station names, derived from the actually-popular routes (ranked by
 * report count) instead of a hardcoded list. Counts how often each place shows
 * up as a route origin/destination and returns the busiest first. Falls back to
 * the static list while routes load or offline.
 */
export function usePopularStations(limit = 15): string[] {
  const { routes } = usePopularRoutes()

  return useMemo(() => {
    if (!routes.length) return FALLBACK_STATIONS.slice(0, limit)

    const freq = new Map<string, number>()
    for (const r of routes) {
      for (const name of [r.from_location, r.to_location]) {
        const k = (name || '').trim()
        if (k) freq.set(k, (freq.get(k) || 0) + 1)
      }
    }

    const ranked = Array.from(freq.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name)
      .slice(0, limit)

    return ranked.length ? ranked : FALLBACK_STATIONS.slice(0, limit)
  }, [routes, limit])
}
