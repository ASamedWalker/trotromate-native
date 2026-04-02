import { useEffect, useRef } from 'react'
import { Alert, AppState } from 'react-native'
import * as Updates from 'expo-updates'
import AsyncStorage from '@react-native-async-storage/async-storage'

const SEEN_UPDATE_KEY = '@troski_seen_update_id'

/**
 * OTA update system — two strategies:
 *
 * 1. IN-SESSION: Manually check → download → prompt restart (covers foreground checks)
 * 2. CROSS-SESSION: Compare current updateId to last seen — if different, a new OTA
 *    was applied silently on the previous launch. Show a "Welcome to the new version" note.
 *
 * Strategy 2 solves the chicken-and-egg: the code to show the alert is IN the update,
 * so by the time it runs, the update is already applied. We detect that by comparing IDs.
 */
export function useAppUpdate(): void {
  const alertShown = useRef(false)

  // ── Strategy 2: Detect silently-applied OTA from a previous session ──
  useEffect(() => {
    if (__DEV__) return

    ;(async () => {
      try {
        const currentId = Updates.updateId
        if (!currentId) return // embedded launch, no OTA ever applied

        const lastSeenId = await AsyncStorage.getItem(SEEN_UPDATE_KEY)
        await AsyncStorage.setItem(SEEN_UPDATE_KEY, currentId)

        // First OTA ever — save ID but don't alert (nothing to compare to)
        if (lastSeenId === null) return

        // Same update as last launch — no change
        if (lastSeenId === currentId) return

        // Different update ID → new OTA was applied since last launch!
        // Don't show alert for this — the update is already active.
        // But trigger a check for an even NEWER update that might be waiting.
        const check = await Updates.checkForUpdateAsync()
        if (check.isAvailable) {
          await Updates.fetchUpdateAsync()
          showRestartAlert(alertShown)
        }
      } catch {
        // Silent — don't break the app
      }
    })()
  }, [])

  // ── Strategy 1: In-session check after delay + on foreground ──
  useEffect(() => {
    if (__DEV__) return

    const check = async () => {
      try {
        const result = await Updates.checkForUpdateAsync()
        if (result.isAvailable) {
          await Updates.fetchUpdateAsync()
          showRestartAlert(alertShown)
        }
      } catch {
        // Silent
      }
    }

    // Delayed check — gives native auto-check time to complete first
    const timer = setTimeout(check, 5000)

    // Re-check when app returns from background
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setTimeout(check, 2000)
      }
    })

    return () => {
      clearTimeout(timer)
      sub.remove()
    }
  }, [])
}

function showRestartAlert(alertShown: React.RefObject<boolean>) {
  if (alertShown.current) return
  alertShown.current = true

  Alert.alert(
    'Update Available',
    'A new version of Troski has been downloaded. Restart now to get the latest improvements.',
    [
      {
        text: 'Later',
        style: 'cancel',
        onPress: () => { alertShown.current = false },
      },
      {
        text: 'Restart Now',
        onPress: () => Updates.reloadAsync(),
      },
    ]
  )
}
