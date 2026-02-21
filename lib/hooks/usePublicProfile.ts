import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import type { PublicProfile } from '@/lib/types'

async function fetchPublicProfile(
  deviceId: string,
  viewerDeviceId?: string | null
): Promise<PublicProfile | null> {
  const { data: profile, error } = await supabase
    .from('contributor_profiles')
    .select(
      'device_id, display_name, bio, avatar_url, current_level, total_points, total_reports, current_streak, follower_count, following_count, home_route_label, home_route_id, is_public'
    )
    .eq('device_id', deviceId)
    .single()

  if (error || !profile) return null

  let isFollowing = false
  if (viewerDeviceId && viewerDeviceId !== deviceId) {
    const { data: follow } = await supabase
      .from('follows')
      .select('id')
      .eq('follower_device_id', viewerDeviceId)
      .eq('following_device_id', deviceId)
      .maybeSingle()

    isFollowing = !!follow
  }

  const { count: taleCount } = await supabase
    .from('tale_posts')
    .select('id', { count: 'exact', head: true })
    .eq('device_id', deviceId)
    .eq('is_hidden', false)

  return {
    ...profile,
    is_following: isFollowing,
    tale_count: taleCount ?? 0,
  } as PublicProfile
}

export function usePublicProfile(deviceId: string | null, viewerDeviceId?: string | null) {
  return useQuery({
    queryKey: ['publicProfile', deviceId],
    queryFn: () => fetchPublicProfile(deviceId!, viewerDeviceId),
    enabled: !!deviceId,
  })
}
