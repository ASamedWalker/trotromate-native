import React, { createContext, useContext, useState, useCallback } from 'react'
import { useDeviceId } from '@/lib/hooks/useDeviceId'
import { useProfile } from '@/lib/hooks/useRewards'
import { useOfflineQueue } from '@/lib/hooks/useOfflineQueue'
import type { ContributorProfile, EarnedBadge, RewardResult } from '@/lib/types'
import type { QueuedReportType } from '@/lib/services/offline-queue'

interface AppContextValue {
  // Device
  deviceId: string | null
  isDeviceReady: boolean

  // Rewards profile
  profile: ContributorProfile | null
  badges: EarnedBadge[]
  rank: number | undefined
  isProfileLoading: boolean

  // Last reward feedback
  lastReward: RewardResult | null
  setLastReward: (r: RewardResult) => void
  clearLastReward: () => void

  // Network & offline queue
  isOnline: boolean
  pendingReports: number
  queueReport: (type: QueuedReportType, deviceId: string, payload: Record<string, unknown>) => Promise<void>

  // Actions
  refreshProfile: () => Promise<void>
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { deviceId, isLoading: deviceLoading } = useDeviceId()
  const { profile, badges, rank, isLoading: profileLoading, refetch } = useProfile(deviceId)
  const { isOnline, pendingCount, queueReport } = useOfflineQueue()
  const [lastReward, setLastReward] = useState<RewardResult | null>(null)

  const clearLastReward = useCallback(() => setLastReward(null), [])

  const refreshProfile = useCallback(async () => {
    await refetch()
  }, [refetch])

  return (
    <AppContext.Provider
      value={{
        deviceId,
        isDeviceReady: !deviceLoading && !!deviceId,
        profile,
        badges,
        rank,
        isProfileLoading: profileLoading,
        lastReward,
        setLastReward,
        clearLastReward,
        isOnline,
        pendingReports: pendingCount,
        queueReport,
        refreshProfile,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
