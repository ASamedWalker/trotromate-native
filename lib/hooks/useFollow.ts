import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'

export function useFollow(
  myDeviceId: string | null,
  targetDeviceId: string,
  initialFollowing: boolean = false
) {
  const [isFollowing, setIsFollowing] = useState(initialFollowing)
  const [isLoading, setIsLoading] = useState(false)

  const toggle = useCallback(async () => {
    if (!myDeviceId || isLoading) return

    const wasFollowing = isFollowing
    setIsFollowing(!wasFollowing)
    setIsLoading(true)

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

        if (error) {
          // 23505 = already following (unique constraint)
          if (error.code !== '23505') {
            setIsFollowing(wasFollowing)
          }
        }
      }
    } catch {
      setIsFollowing(wasFollowing)
    } finally {
      setIsLoading(false)
    }
  }, [myDeviceId, targetDeviceId, isFollowing, isLoading])

  return { isFollowing, toggle, isLoading }
}
