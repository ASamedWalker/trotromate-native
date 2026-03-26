import { useState, useEffect, useRef, useCallback } from 'react'
import * as Location from 'expo-location'
import AsyncStorage from '@react-native-async-storage/async-storage'

const LAST_LOCATION_KEY = '@troski_last_location'

export interface UserLocation {
  latitude: number
  longitude: number
  accuracy: number | null
  heading: number | null
  timestamp: number
}

interface UseLocationReturn {
  location: UserLocation | null
  isPermissionGranted: boolean
  isLoading: boolean
  requestPermission: () => Promise<boolean>
  getCurrentPosition: () => Promise<UserLocation | null>
  startWatching: (onUpdate: (loc: UserLocation) => void, intervalMs?: number) => void
  stopWatching: () => void
}

function toUserLocation(loc: Location.LocationObject): UserLocation {
  return {
    latitude: loc.coords.latitude,
    longitude: loc.coords.longitude,
    accuracy: loc.coords.accuracy,
    heading: loc.coords.heading != null && loc.coords.heading >= 0 ? loc.coords.heading : null,
    timestamp: loc.timestamp,
  }
}

async function loadCachedLocation(): Promise<UserLocation | null> {
  try {
    const raw = await AsyncStorage.getItem(LAST_LOCATION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

async function cacheLocation(loc: UserLocation): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_LOCATION_KEY, JSON.stringify(loc))
  } catch {
    // silent
  }
}

export function useLocation(): UseLocationReturn {
  const [location, setLocation] = useState<UserLocation | null>(null)
  const [isPermissionGranted, setIsPermissionGranted] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const watchSubscription = useRef<Location.LocationSubscription | null>(null)

  // Check permission + load cached location on mount
  useEffect(() => {
    ;(async () => {
      const { status } = await Location.getForegroundPermissionsAsync()
      const granted = status === 'granted'
      setIsPermissionGranted(granted)

      // Load cached location for instant UI
      const cached = await loadCachedLocation()
      if (cached) setLocation(cached)

      // If permission granted, get fresh position
      if (granted) {
        try {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          })
          const userLoc = toUserLocation(loc)
          setLocation(userLoc)
          cacheLocation(userLoc)
        } catch {
          // Use cached if fresh fails
        }
      }
      setIsLoading(false)
    })()
  }, [])

  const requestPermission = useCallback(async (): Promise<boolean> => {
    const { status } = await Location.requestForegroundPermissionsAsync()
    const granted = status === 'granted'
    setIsPermissionGranted(granted)

    if (granted) {
      try {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        })
        const userLoc = toUserLocation(loc)
        setLocation(userLoc)
        cacheLocation(userLoc)
      } catch {
        // silent
      }
    }
    return granted
  }, [])

  const getCurrentPosition = useCallback(async (): Promise<UserLocation | null> => {
    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      })
      const userLoc = toUserLocation(loc)
      setLocation(userLoc)
      cacheLocation(userLoc)
      return userLoc
    } catch {
      return location
    }
  }, [location])

  const startWatching = useCallback(
    (onUpdate: (loc: UserLocation) => void, intervalMs: number = 10000) => {
      // Stop existing watch first
      watchSubscription.current?.remove()

      Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: intervalMs,
          distanceInterval: 50, // meters
        },
        (loc) => {
          const userLoc = toUserLocation(loc)
          setLocation(userLoc)
          cacheLocation(userLoc)
          onUpdate(userLoc)
        },
      ).then((sub) => {
        watchSubscription.current = sub
      })
    },
    [],
  )

  const stopWatching = useCallback(() => {
    watchSubscription.current?.remove()
    watchSubscription.current = null
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      watchSubscription.current?.remove()
    }
  }, [])

  return {
    location,
    isPermissionGranted,
    isLoading,
    requestPermission,
    getCurrentPosition,
    startWatching,
    stopWatching,
  }
}

/** Request background location permission (for GO Mode) */
export async function requestBackgroundPermission(): Promise<boolean> {
  const { status } = await Location.requestBackgroundPermissionsAsync()
  return status === 'granted'
}
