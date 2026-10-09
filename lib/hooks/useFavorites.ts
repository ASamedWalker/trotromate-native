import { useState, useEffect, useCallback, useRef } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '@/lib/supabase/client'
import { useDeviceId } from '@/lib/hooks/useDeviceId'

interface FavoriteRoute {
  id: string
  from: string
  to: string
  savedAt: number
}

const STORAGE_KEY = 'troski-favorite-routes'

// One successful startup sync per app launch (the hook is mounted in several screens)
let syncedThisLaunch = false
// Syncs run one at a time so an older list can't land after a newer one
let syncQueue: Promise<void> = Promise.resolve()

/**
 * Mirror the list to the server (migration 099 set_commute_routes) so the morning /
 * afternoon pushes can mention the rider's own routes. Best-effort: the phone's
 * AsyncStorage copy stays the source of truth.
 */
async function syncCommuteRoutes(deviceId: string, list: FavoriteRoute[]): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('set_commute_routes', {
      p_device_id: deviceId,
      p_route_ids: list.slice(0, 10).map((f) => f.id),
    })
    if (error) {
      console.warn('Failed to sync commute routes:', error.message)
      return false
    }
    if (data === -1) {
      console.warn('Commute routes not synced (no profile yet or linked to another account)')
      return false
    }
    return true
  } catch (e) {
    console.warn('Failed to sync commute routes:', e)
    return false
  }
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<FavoriteRoute[]>([])
  const [isLoaded, setIsLoaded] = useState(false)
  const { deviceId } = useDeviceId()
  const changedByUser = useRef(false)
  // A failed read must not sync an empty list (that would wipe the server copy)
  const loadFailed = useRef(false)

  // Load favorites from AsyncStorage on mount
  useEffect(() => {
    ;(async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY)
        if (stored) setFavorites(JSON.parse(stored))
      } catch (error) {
        console.error('Failed to load favorites:', error)
        loadFailed.current = true
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

  // Sync to the server after a user change, and once per launch
  useEffect(() => {
    if (!isLoaded || !deviceId) return
    const byUser = changedByUser.current
    if (!byUser && (syncedThisLaunch || loadFailed.current)) return
    changedByUser.current = false
    syncQueue = syncQueue.then(async () => {
      const ok = await syncCommuteRoutes(deviceId, favorites)
      if (ok) syncedThisLaunch = true
    })
  }, [favorites, isLoaded, deviceId])

  const toggleFavorite = useCallback((route: { id: string; from: string; to: string }) => {
    changedByUser.current = true
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
