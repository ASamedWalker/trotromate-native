import { useState, useEffect, useCallback } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

export interface SearchEntry {
  routeId: string
  from: string
  to: string
  transportType?: 'trotro' | 'okada'
  timestamp: number
  dayOfWeek: number // 0=Sun, 6=Sat
  hour: number // 0-23
}

const STORAGE_KEY = 'troski-search-history'
const MAX_ENTRIES = 20

export function useSearchHistory() {
  const [history, setHistory] = useState<SearchEntry[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY)
        if (stored) setHistory(JSON.parse(stored))
      } catch {
        // Ignore parse errors
      }
      setIsLoaded(true)
    })()
  }, [])

  useEffect(() => {
    if (isLoaded) {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(history)).catch(() => {})
    }
  }, [history, isLoaded])

  const addSearch = useCallback(
    (route: { id: string; from: string; to: string; transportType?: 'trotro' | 'okada' }) => {
      const now = new Date()
      const entry: SearchEntry = {
        routeId: route.id,
        from: route.from,
        to: route.to,
        transportType: route.transportType,
        timestamp: now.getTime(),
        dayOfWeek: now.getDay(),
        hour: now.getHours(),
      }
      setHistory((prev) => {
        const filtered = prev.filter((e) => e.routeId !== route.id)
        return [entry, ...filtered].slice(0, MAX_ENTRIES)
      })
    },
    []
  )

  const getRecentSearches = useCallback(
    (limit = 5) => {
      return history.slice(0, limit)
    },
    [history]
  )

  const clearHistory = useCallback(() => {
    setHistory([])
  }, [])

  return { history, isLoaded, addSearch, getRecentSearches, clearHistory }
}
