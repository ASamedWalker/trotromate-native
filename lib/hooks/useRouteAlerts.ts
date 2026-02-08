import { useState, useEffect, useCallback } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

const STORAGE_KEY = 'troski-route-alerts'

export function useRouteAlerts() {
  const [alertedIds, setAlertedIds] = useState<string[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY)
        if (stored) setAlertedIds(JSON.parse(stored))
      } catch (error) {
        console.error('Failed to load route alerts:', error)
      }
      setIsLoaded(true)
    })()
  }, [])

  useEffect(() => {
    if (isLoaded) {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(alertedIds)).catch((e) =>
        console.error('Failed to save route alerts:', e)
      )
    }
  }, [alertedIds, isLoaded])

  const toggleAlert = useCallback((routeId: string) => {
    setAlertedIds((prev) => {
      const exists = prev.includes(routeId)
      if (exists) return prev.filter((id) => id !== routeId)
      return [...prev, routeId]
    })
  }, [])

  const isAlerted = useCallback(
    (routeId: string) => alertedIds.includes(routeId),
    [alertedIds]
  )

  return { alertedIds, isLoaded, toggleAlert, isAlerted }
}
