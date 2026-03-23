import { useState, useEffect, useCallback } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

export interface MyCommute {
  id: string
  label: string               // 'Morning commute', 'Evening return', or custom
  routeId: string             // Links to actual route
  from: string                // e.g. 'Circle'
  to: string                  // e.g. 'Madina'
  icon: 'sunrise' | 'sunset' | 'map-pin'
  createdAt: number
}

const STORAGE_KEY = 'troski-my-commutes'

export function useMyCommutes() {
  const [commutes, setCommutes] = useState<MyCommute[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  // Load from AsyncStorage on mount
  useEffect(() => {
    ;(async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY)
        if (stored) setCommutes(JSON.parse(stored))
      } catch (error) {
        console.error('Failed to load commutes:', error)
      }
      setIsLoaded(true)
    })()
  }, [])

  // Save whenever commutes change
  useEffect(() => {
    if (isLoaded) {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(commutes)).catch((e) =>
        console.error('Failed to save commutes:', e)
      )
    }
  }, [commutes, isLoaded])

  const addCommute = useCallback((commute: Omit<MyCommute, 'id' | 'createdAt'>) => {
    setCommutes((prev) => [
      ...prev,
      { ...commute, id: Math.random().toString(36).slice(2), createdAt: Date.now() },
    ])
  }, [])

  const removeCommute = useCallback((id: string) => {
    setCommutes((prev) => prev.filter((c) => c.id !== id))
  }, [])

  const updateCommute = useCallback((id: string, updates: Partial<Omit<MyCommute, 'id'>>) => {
    setCommutes((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
    )
  }, [])

  const hasCommute = useCallback(
    (routeId: string) => commutes.some((c) => c.routeId === routeId),
    [commutes]
  )

  return { commutes, isLoaded, addCommute, removeCommute, updateCommute, hasCommute }
}
