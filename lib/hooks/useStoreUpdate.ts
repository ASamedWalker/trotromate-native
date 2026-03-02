import { useState, useEffect, useCallback } from 'react'
import { Platform } from 'react-native'
import Constants from 'expo-constants'
import * as Linking from 'expo-linking'
import AsyncStorage from '@react-native-async-storage/async-storage'

const DISMISS_KEY = '@troski_store_update_dismissed'
const DISMISS_DURATION_MS = 24 * 60 * 60 * 1000 // 24 hours
const FETCH_TIMEOUT_MS = 10_000

const BUNDLE_ID = 'com.troski.app'
const IOS_APP_ID = '6758959524'

const STORE_URLS = {
  ios: `itms-apps://apps.apple.com/app/troski-know-your-fare/id${IOS_APP_ID}`,
  android: `market://details?id=${BUNDLE_ID}`,
  androidFallback: `https://play.google.com/store/apps/details?id=${BUNDLE_ID}`,
}

interface DismissRecord {
  version: string
  timestamp: string
}

interface StoreUpdateState {
  isUpdateAvailable: boolean
  storeVersion: string | null
  currentVersion: string
  dismiss: () => Promise<void>
  openStore: () => void
}

/** Compare two semver strings. Returns true if store > current. */
function isNewerVersion(store: string, current: string): boolean {
  const s = store.split('.').map(Number)
  const c = current.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    const sv = s[i] ?? 0
    const cv = c[i] ?? 0
    if (sv > cv) return true
    if (sv < cv) return false
  }
  return false
}

/** Fetch with a timeout via AbortController. */
function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), ms)
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timeout))
}

/** iOS: use Apple's official iTunes Lookup API. */
async function fetchIOSVersion(): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(
      `https://itunes.apple.com/lookup?bundleId=${BUNDLE_ID}`,
      FETCH_TIMEOUT_MS,
    )
    const json = await res.json()
    return json.results?.[0]?.version ?? null
  } catch {
    return null
  }
}

/** Android: parse version from Google Play Store page HTML. */
async function fetchAndroidVersion(): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(
      `https://play.google.com/store/apps/details?id=${BUNDLE_ID}&hl=en`,
      FETCH_TIMEOUT_MS,
    )
    const html = await res.text()

    // Strategy 1: structured data pattern
    const m1 = html.match(/\[\[\["(\d+\.\d+(?:\.\d+)?)"\]\]\]/)
    if (m1) return m1[1]

    // Strategy 2: near "Current Version" label
    const m2 = html.match(/Current Version.*?>([\d.]+)</)
    if (m2) return m2[1]

    // Strategy 3: generic semver near "version" keyword
    const m3 = html.match(/\bversion.*?(\d+\.\d+\.\d+)/i)
    if (m3) return m3[1]

    return null
  } catch {
    return null
  }
}

async function getDismissRecord(): Promise<DismissRecord | null> {
  try {
    const raw = await AsyncStorage.getItem(DISMISS_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

async function saveDismissRecord(version: string): Promise<void> {
  const record: DismissRecord = { version, timestamp: new Date().toISOString() }
  await AsyncStorage.setItem(DISMISS_KEY, JSON.stringify(record))
}

function isDismissedFor(record: DismissRecord | null, version: string): boolean {
  if (!record) return false
  if (record.version !== version) return false
  const elapsed = Date.now() - new Date(record.timestamp).getTime()
  return elapsed < DISMISS_DURATION_MS
}

export function useStoreUpdate(): StoreUpdateState {
  const currentVersion = Constants.expoConfig?.version ?? '0.0.0'
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false)
  const [storeVersion, setStoreVersion] = useState<string | null>(null)

  const openStore = useCallback(() => {
    if (Platform.OS === 'ios') {
      Linking.openURL(STORE_URLS.ios)
    } else {
      Linking.openURL(STORE_URLS.android).catch(() => {
        Linking.openURL(STORE_URLS.androidFallback)
      })
    }
  }, [])

  const dismiss = useCallback(async () => {
    if (storeVersion) {
      await saveDismissRecord(storeVersion)
    }
    setIsUpdateAvailable(false)
  }, [storeVersion])

  useEffect(() => {
    if (__DEV__) return
    if (Platform.OS === 'web') return

    let cancelled = false

    const check = async () => {
      try {
        const dismissRecord = await getDismissRecord()

        const version =
          Platform.OS === 'ios' ? await fetchIOSVersion() : await fetchAndroidVersion()

        if (cancelled || !version) return
        if (!isNewerVersion(version, currentVersion)) return
        if (isDismissedFor(dismissRecord, version)) return

        setStoreVersion(version)
        setIsUpdateAvailable(true)
      } catch {
        // Silent fail — never disrupt the user experience
      }
    }

    check()

    return () => {
      cancelled = true
    }
  }, [currentVersion])

  return { isUpdateAvailable, storeVersion, currentVersion, dismiss, openStore }
}
