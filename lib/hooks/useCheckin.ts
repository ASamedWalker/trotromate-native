import { useEffect, useRef, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '@/lib/supabase/client'

const LAST_CHECKIN_KEY = '@troski_last_checkin_date'

/**
 * Records a daily check-in on app open.
 * Uses local cache to avoid hitting Supabase on every mount.
 * Only calls the server RPC once per calendar day.
 */
export function useCheckin(deviceId: string | null) {
  const [viewStreak, setViewStreak] = useState(0)
  const [isNewDay, setIsNewDay] = useState(false)
  const calledRef = useRef(false)

  useEffect(() => {
    if (!deviceId || calledRef.current) return
    calledRef.current = true

    ;(async () => {
      try {
        const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
        const lastCheckin = await AsyncStorage.getItem(LAST_CHECKIN_KEY)

        // Already checked in today — skip network call
        if (lastCheckin === today) {
          // Still load the current streak for display
          const { data: profile } = await supabase
            .from('contributor_profiles')
            .select('view_streak')
            .eq('device_id', deviceId)
            .single()

          if (profile) setViewStreak(profile.view_streak ?? 0)
          return
        }

        // Record check-in via RPC (atomic streak calculation)
        const { data, error } = await supabase.rpc('record_checkin', {
          p_device_id: deviceId,
          p_source: 'app_open',
        })

        if (error) {
          console.warn('Checkin RPC failed:', error.message)
          return
        }

        const result = data as { streak: number; is_new_day: boolean } | null
        if (result) {
          setViewStreak(result.streak)
          setIsNewDay(result.is_new_day)
        }

        // Cache today's date locally
        await AsyncStorage.setItem(LAST_CHECKIN_KEY, today)
      } catch (err) {
        // Silently fail — checkin is non-critical
        console.warn('Checkin error:', err)
      }
    })()
  }, [deviceId])

  return { viewStreak, isNewDay }
}
