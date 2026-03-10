import { useCallback } from 'react'
import * as StoreReview from 'expo-store-review'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useApp } from '@/lib/contexts/AppContext'

const STORAGE_KEY = 'troski_review_prompted'
const THRESHOLDS = [3, 15, 50]

export function useStoreReview() {
  const { profile } = useApp()

  const maybePromptReview = useCallback(async () => {
    try {
      const totalReports = profile?.total_reports ?? 0
      const matchedThreshold = THRESHOLDS.find((t) => totalReports >= t)
      if (!matchedThreshold) return

      const raw = await AsyncStorage.getItem(STORAGE_KEY)
      const prompted: number[] = raw ? JSON.parse(raw) : []
      if (prompted.includes(matchedThreshold)) return

      const available = await StoreReview.isAvailableAsync()
      if (!available) return

      await StoreReview.requestReview()
      prompted.push(matchedThreshold)
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(prompted))
    } catch {
      // Silent fail — review prompt is non-critical
    }
  }, [profile?.total_reports])

  return { maybePromptReview }
}
