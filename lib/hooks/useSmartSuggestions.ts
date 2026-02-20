import { useMemo } from 'react'
import { useSearchHistory } from './useSearchHistory'

export interface Suggestion {
  routeId: string
  from: string
  to: string
  transportType?: 'trotro' | 'okada'
  reason: string
  score: number
}

export function useSmartSuggestions() {
  const { history } = useSearchHistory()

  const suggestions = useMemo(() => {
    if (history.length === 0) return []

    const now = new Date()
    const currentHour = now.getHours()

    const routeData = new Map<
      string,
      { count: number; entry: (typeof history)[0]; timeMatches: number }
    >()

    for (const entry of history) {
      const existing = routeData.get(entry.routeId)
      const isTimeMatch = Math.abs(entry.hour - currentHour) <= 2

      if (existing) {
        existing.count++
        if (isTimeMatch) existing.timeMatches++
      } else {
        routeData.set(entry.routeId, {
          count: 1,
          entry,
          timeMatches: isTimeMatch ? 1 : 0,
        })
      }
    }

    const results: Suggestion[] = []

    for (const [routeId, data] of routeData) {
      let score = data.count * 10
      let reason = 'Frequent route'

      if (data.timeMatches >= 2) {
        score += data.timeMatches * 15
        if (currentHour >= 5 && currentHour <= 9) {
          reason = 'Morning commute'
        } else if (currentHour >= 16 && currentHour <= 19) {
          reason = 'Evening commute'
        } else {
          const h = currentHour > 12 ? currentHour - 12 : currentHour || 12
          reason = `Usually around ${h}${currentHour >= 12 ? 'pm' : 'am'}`
        }
      }

      const hoursSince = (now.getTime() - data.entry.timestamp) / 3_600_000
      if (hoursSince < 24) score += 20
      else if (hoursSince < 72) score += 10

      results.push({
        routeId,
        from: data.entry.from,
        to: data.entry.to,
        transportType: data.entry.transportType,
        reason,
        score,
      })
    }

    return results.sort((a, b) => b.score - a.score).slice(0, 3)
  }, [history])

  return { suggestions }
}
