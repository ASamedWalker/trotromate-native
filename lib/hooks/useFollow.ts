import { useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'

export function useFollow(
  myDeviceId: string | null,
  targetDeviceId: string,
  initialFollowing: boolean = false
) {
  const [isFollowing, setIsFollowing] = useState(initialFollowing)
  const [isLoading, setIsLoading] = useState(false)
  const pendingRef = useRef(false)

  const toggle = useCallback(async () => {
    if (!myDeviceId || pendingRef.current) return

    pendingRef.current = true
    setIsLoading(true)

    // Read current state via callback to avoid stale closure
    setIsFollowing(prev => {
      const wasFollowing = prev

      ;(async () => {
        try {
          if (wasFollowing) {
            const { error } = await supabase
              .from('follows')
              .delete()
              .eq('follower_device_id', myDeviceId)
              .eq('following_device_id', targetDeviceId)

            if (error) setIsFollowing(wasFollowing)
          } else {
            const { error } = await supabase
              .from('follows')
              .insert({
                follower_device_id: myDeviceId,
                following_device_id: targetDeviceId,
              })

            if (error && error.code !== '23505') {
              setIsFollowing(wasFollowing)
            }
          }
        } catch {
          setIsFollowing(wasFollowing)
        } finally {
          pendingRef.current = false
          setIsLoading(false)
        }
      })()

      return !prev // optimistic toggle
    })
  }, [myDeviceId, targetDeviceId]) // stable deps — no isFollowing/isLoading

  return { isFollowing, toggle, isLoading }
}
