import { useQuery } from '@tanstack/react-query'
import { fetchProfile, fetchLeaderboard, fetchAllBadges, fetchPointsHistory } from '@/lib/services/rewards'
import type { ContributorProfile, EarnedBadge, LeaderboardEntry, Badge, PointsHistoryEntry } from '@/lib/types'

export function useProfile(deviceId: string | null) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['profile', deviceId],
    queryFn: () => fetchProfile(deviceId!),
    enabled: !!deviceId,
  })

  const profile: ContributorProfile | null = data?.profile ?? null
  const badges: EarnedBadge[] = data?.badges ?? []
  const rank: number | undefined = data?.rank

  return { profile, badges, rank, isLoading, error: null, refetch }
}

export function useLeaderboard(deviceId?: string | null) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['leaderboard', deviceId],
    queryFn: () => fetchLeaderboard(deviceId || undefined),
  })

  const entries: LeaderboardEntry[] = data?.entries ?? []
  const userRank: number | undefined = data?.userRank

  return { entries, userRank, isLoading, error: null, refetch }
}

export function useAllBadges() {
  const { data, isLoading } = useQuery({
    queryKey: ['badges'],
    queryFn: fetchAllBadges,
    staleTime: 10 * 60 * 1000, // Badges rarely change
  })

  const badges: Badge[] = data ?? []
  return { badges, isLoading }
}

export function usePointsHistory(deviceId: string | null) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['history', deviceId],
    queryFn: () => fetchPointsHistory(deviceId!),
    enabled: !!deviceId,
  })

  const entries: PointsHistoryEntry[] = data ?? []
  return { entries, isLoading, refetch }
}
