import { useEffect } from 'react'
import * as Updates from 'expo-updates'

/**
 * Silent OTA updates — download in background, apply on next cold start.
 * No banner, no popup, no user interruption. Like Uber, Instagram, etc.
 */
export function useAppUpdate(): void {
  useEffect(() => {
    if (__DEV__) return

    ;(async () => {
      try {
        const update = await Updates.checkForUpdateAsync()
        if (update.isAvailable) {
          await Updates.fetchUpdateAsync()
          // Update is now cached — it will apply automatically on next app launch.
          // No reloadAsync() — don't force-restart the app mid-session.
        }
      } catch {
        // Silent fail — never disrupt the user
      }
    })()
  }, [])
}
