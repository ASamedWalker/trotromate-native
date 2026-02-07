import { useState, useEffect, useCallback } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

const PREFS_KEY = '@troski_preferences'

export type ThemeMode = 'system' | 'light' | 'dark'

export interface Preferences {
  pushNotifications: boolean
  profileVisibility: boolean
  theme: ThemeMode
}

const DEFAULTS: Preferences = {
  pushNotifications: true,
  profileVisibility: true,
  theme: 'system',
}

export function usePreferences() {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULTS)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    AsyncStorage.getItem(PREFS_KEY).then((raw) => {
      if (raw) {
        try {
          setPrefs({ ...DEFAULTS, ...JSON.parse(raw) })
        } catch {}
      }
      setIsLoaded(true)
    })
  }, [])

  const updatePref = useCallback(
    async <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
      setPrefs((prev) => {
        const next = { ...prev, [key]: value }
        AsyncStorage.setItem(PREFS_KEY, JSON.stringify(next))
        return next
      })
    },
    []
  )

  const clearAll = useCallback(async () => {
    setPrefs(DEFAULTS)
    await AsyncStorage.removeItem(PREFS_KEY)
  }, [])

  return { prefs, updatePref, clearAll, isLoaded }
}
