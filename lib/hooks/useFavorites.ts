import { useState, useEffect, useCallback } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

interface FavoriteRoute {
  id: string
  from: string
  to: string
  savedAt: number
}

const STORAGE_KEY = 'troski-favorite-routes'

export function useFavorites() {
  const [favorites, setFavorites] = useState<FavoriteRoute[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  // Load favorites from AsyncStorage on mount
  useEffect(() => {
    ;(async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY)
        if (stored) setFavorites(JSON.parse(stored))
      } catch (error) {
        console.error('Failed to load favorites:', error)
      }
      setIsLoaded(true)
    })()
  }, [])

  // Save favorites whenever they change
  useEffect(() => {
    if (isLoaded) {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(favorites)).catch((e) =>
        console.error('Failed to save favorites:', e)
      )
    }
  }, [favorites, isLoaded])

  const toggleFavorite = useCallback((route: { id: string; from: string; to: string }) => {
    setFavorites((prev) => {
      const exists = prev.some((f) => f.id === route.id)
      if (exists) return prev.filter((f) => f.id !== route.id)
      return [...prev, { ...route, savedAt: Date.now() }]
    })
  }, [])

  const isFavorite = useCallback(
    (routeId: string) => favorites.some((f) => f.id === routeId),
    [favorites]
  )

  return { favorites, isLoaded, toggleFavorite, isFavorite }
}
