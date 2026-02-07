import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  fetchTrainLines,
  fetchTrainLineDetail,
  submitTrainReport,
} from '@/lib/services/train'
import { awardPointsForReport } from '@/lib/services/rewards'
import { queryClient } from '@/lib/query-client'
import type {
  TrainLine,
  TrainStation,
  TrainReportWithNames,
  RewardResult,
} from '@/lib/types'

export function useTrainLines() {
  const { data: lines = [], isLoading, refetch } = useQuery({
    queryKey: ['trainLines'],
    queryFn: fetchTrainLines,
  })

  return { lines, isLoading, error: null, refetch }
}

export function useTrainLineDetail(lineId: string) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['trainLine', lineId],
    queryFn: () => fetchTrainLineDetail(lineId),
    enabled: !!lineId,
  })

  const line: TrainLine | null = data?.line ?? null
  const stations: TrainStation[] = data?.stations ?? []
  const recentReports: TrainReportWithNames[] = data?.recentReports ?? []

  return { line, stations, recentReports, isLoading, error: null, refetch }
}

export function useSubmitTrainReport(deviceId: string | null) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = useCallback(
    async (params: {
      lineId: string
      stationId: string
      reportType: string
      direction?: string
      crowdLevel?: string
      reportedFare?: number
      delayMins?: number
      notes?: string
    }): Promise<RewardResult | null> => {
      if (!deviceId) {
        setError('Device not ready')
        return null
      }
      setIsSubmitting(true)
      setError(null)
      try {
        const result = await submitTrainReport({ ...params, deviceId })
        if (!result) {
          setError('Failed to submit report')
          return null
        }
        const reward = await awardPointsForReport({
          deviceId,
          reportType: 'train',
          reportId: result.reportId,
        })
        // Invalidate train queries so fresh data shows
        queryClient.invalidateQueries({ queryKey: ['trainLines'] })
        queryClient.invalidateQueries({ queryKey: ['trainLine'] })
        queryClient.invalidateQueries({ queryKey: ['activity'] })
        return reward
      } catch {
        setError('Failed to submit report')
        return null
      } finally {
        setIsSubmitting(false)
      }
    },
    [deviceId]
  )

  return { submit, isSubmitting, error }
}
