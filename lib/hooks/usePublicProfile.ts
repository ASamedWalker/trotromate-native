import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import type { PublicProfile } from '@/lib/types'

export interface PublicBadge {
  id: string
  name: string
  description: string
  icon: string
  earned_at: string
}

export interface PublicTale {
  id: string
  image_url: string
  caption: string | null
  location_name: string
  like_count: number
  comment_count: number
  created_at: string
}

async function fetchPublicProfile(
  deviceId: string,
  viewerDeviceId?: string | null
): Promise<{ profile: PublicProfile; badges: PublicBadge[]; tales: PublicTale[] } | null> {
  const { data: profile, error } = await supabase
    .from('contributor_profiles')
    .select(
      'id, device_id, display_name, bio, avatar_url, current_level, total_points, total_reports, current_streak, follower_count, following_count, home_route_label, home_route_id, is_public, created_at'
    )
    .eq('device_id', deviceId)
    .single()

  if (error || !profile) return null

  // Check following status
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

  // Fetch badges
  const { data: badgeData } = await supabase
    .from('contributor_badges')
    .select('earned_at, badge:badges(id, name, description, icon)')
    .eq('contributor_id', profile.id)
    .order('earned_at', { ascending: false })

  const badges: PublicBadge[] = (badgeData || [])
    .filter((b: any) => b.badge)
    .map((b: any) => ({
      id: b.badge.id,
      name: b.badge.name,
      description: b.badge.description,
      icon: b.badge.icon,
      earned_at: b.earned_at,
    }))

  // Fetch recent tales
  const { data: taleData } = await supabase
    .from('tale_posts')
    .select('id, image_url, caption, location_name, like_count, comment_count, created_at')
    .eq('device_id', deviceId)
    .eq('is_hidden', false)
    .order('created_at', { ascending: false })
    .limit(9)

  const tales: PublicTale[] = taleData || []

  const { count: taleCount } = await supabase
    .from('tale_posts')
    .select('id', { count: 'exact', head: true })
    .eq('device_id', deviceId)
    .eq('is_hidden', false)

  return {
    profile: {
      ...profile,
      is_following: isFollowing,
      tale_count: taleCount ?? 0,
    } as PublicProfile,
    badges,
    tales,
  }
}

export function usePublicProfile(deviceId: string | null, viewerDeviceId?: string | null) {
  return useQuery({
    queryKey: ['publicProfile', deviceId],
    queryFn: () => fetchPublicProfile(deviceId!, viewerDeviceId),
    enabled: !!deviceId,
  })
}
