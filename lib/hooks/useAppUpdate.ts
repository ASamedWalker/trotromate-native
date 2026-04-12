import { useEffect, useRef } from 'react'
import { DeviceEventEmitter } from 'react-native'
import * as Updates from 'expo-updates'
import AsyncStorage from '@react-native-async-storage/async-storage'

const SEEN_UPDATE_KEY = '@troski_seen_update_id'

/**
 * OTA update system — simple single-check strategy.
 * On each app launch: check for update, download if available, show banner once.
 * No foreground re-checks, no spam.
 */
export function useAppUpdate(): void {
  const bannerShown = useRef(false)

  useEffect(() => {
    if (__DEV__) return

    ;(async () => {
      try {
        // Track seen update IDs to avoid showing banner for already-applied updates
        const currentId = Updates.updateId
        if (currentId) {
          const lastSeenId = await AsyncStorage.getItem(SEEN_UPDATE_KEY)
          await AsyncStorage.setItem(SEEN_UPDATE_KEY, currentId)

          // If update changed since last launch, it's already applied — no banner needed
          if (lastSeenId && lastSeenId !== currentId) {
            // Already on new code. Check if there's an even newer one:
            const check = await Updates.checkForUpdateAsync()
            if (check.isAvailable) {
              await Updates.fetchUpdateAsync()
              showBanner(bannerShown)
            }
            return
          }
        }

        // Single delayed check — gives native auto-check time first
        await new Promise((r) => setTimeout(r, 5000))
        if (bannerShown.current) return

        const result = await Updates.checkForUpdateAsync()
        if (result.isAvailable) {
          await Updates.fetchUpdateAsync()
          showBanner(bannerShown)
        }
      } catch {
        // Silent — don't break the app
      }
    })()
  }, [])
}

function showBanner(bannerShown: React.RefObject<boolean>) {
  if (bannerShown.current) return
  bannerShown.current = true
  DeviceEventEmitter.emit('ota-update-ready')
}
