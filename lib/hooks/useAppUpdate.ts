import { useEffect, useRef } from 'react'
import { AppState, DeviceEventEmitter } from 'react-native'
import * as Updates from 'expo-updates'
import AsyncStorage from '@react-native-async-storage/async-storage'

const SEEN_UPDATE_KEY = '@troski_seen_update_id'

/**
 * OTA update system — two strategies:
 *
 * 1. IN-SESSION: Manually check → download → emit "ota-update-ready" event.
 *    The OtaUpdateBanner component listens and shows a non-blocking
 *    glassmorphic toast above the tab bar (no more system Alert).
 * 2. CROSS-SESSION: Compare current updateId to last seen — if different, a new OTA
 *    was applied silently on the previous launch. Then check for an even NEWER one.
 *
 * Strategy 2 solves the chicken-and-egg: the code to show the prompt is IN the update,
 * so by the time it runs, the update is already applied. We detect that by comparing IDs.
 */
export function useAppUpdate(): void {
  const bannerShown = useRef(false)

  // ── Strategy 2: Detect silently-applied OTA from a previous session ──
  useEffect(() => {
    if (__DEV__) return

    ;(async () => {
      try {
        const currentId = Updates.updateId
        if (!currentId) return // embedded launch, no OTA ever applied

        const lastSeenId = await AsyncStorage.getItem(SEEN_UPDATE_KEY)
        await AsyncStorage.setItem(SEEN_UPDATE_KEY, currentId)

        // First OTA ever — save ID but don't prompt (nothing to compare to)
        if (lastSeenId === null) return

        // Same update as last launch — no change
        if (lastSeenId === currentId) return

        // Different update ID → new OTA was applied since last launch!
        // Don't show banner for this — the update is already active.
        // But trigger a check for an even NEWER update that might be waiting.
        const check = await Updates.checkForUpdateAsync()
        if (check.isAvailable) {
          await Updates.fetchUpdateAsync()
          showUpdateBanner(bannerShown)
        }
      } catch {
        // Silent — don't break the app
      }
    })()
  }, [])

  // ── Strategy 1: In-session check after delay + on foreground ──
  useEffect(() => {
    if (__DEV__) return

    const lastCheckRef = { time: 0 }
    const COOLDOWN_MS = 60 * 60 * 1000 // 1 hour between checks

    const check = async () => {
      // Don't check if banner already shown or cooldown not elapsed
      if (bannerShown.current) return
      if (Date.now() - lastCheckRef.time < COOLDOWN_MS) return
      lastCheckRef.time = Date.now()

      try {
        const result = await Updates.checkForUpdateAsync()
        if (result.isAvailable) {
          await Updates.fetchUpdateAsync()
          showUpdateBanner(bannerShown)
        }
      } catch {
        // Silent
      }
    }

    // Delayed check — gives native auto-check time to complete first
    const timer = setTimeout(check, 5000)

    // Re-check when app returns from background (respects cooldown)
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

function showUpdateBanner(bannerShown: React.RefObject<boolean>) {
  if (bannerShown.current) return
  bannerShown.current = true
  // OtaUpdateBanner component listens for this and slides up.
  DeviceEventEmitter.emit('ota-update-ready')
}
