import { useState, useEffect, useCallback } from 'react'
import * as Updates from 'expo-updates'

interface AppUpdateState {
  isUpdateAvailable: boolean
  isDownloading: boolean
  isRestarting: boolean
  error: string | null
  checkForUpdate: () => Promise<void>
  downloadAndRestart: () => Promise<void>
}

export function useAppUpdate(): AppUpdateState {
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isRestarting, setIsRestarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const checkForUpdate = useCallback(async () => {
    // Skip in dev — Updates API is not available in Expo Go / dev builds
    if (__DEV__) return

    try {
      const update = await Updates.checkForUpdateAsync()
      if (update.isAvailable) {
        setIsUpdateAvailable(true)
      }
    } catch (e) {
      // Silently fail — don't disrupt the user experience
      console.warn('Update check failed:', e)
    }
  }, [])

  const downloadAndRestart = useCallback(async () => {
    if (__DEV__) return

    try {
      setIsDownloading(true)
      setError(null)
      await Updates.fetchUpdateAsync()
      setIsDownloading(false)
      setIsRestarting(true)
      await Updates.reloadAsync()
    } catch (e) {
      setIsDownloading(false)
      setIsRestarting(false)
      setError('Update failed. Please try again later.')
      console.warn('Update download failed:', e)
    }
  }, [])

  // Check for updates on mount
  useEffect(() => {
    checkForUpdate()
  }, [checkForUpdate])

  return {
    isUpdateAvailable,
    isDownloading,
    isRestarting,
    error,
    checkForUpdate,
    downloadAndRestart,
  }
}
