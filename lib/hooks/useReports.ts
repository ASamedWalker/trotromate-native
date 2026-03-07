import { useState, useCallback } from 'react'
import { submitFareReport, submitQueueReport, submitIncidentReport } from '@/lib/services/reports'
import { awardPointsForReport } from '@/lib/services/rewards'
import { REPORT_POINTS } from '@/lib/constants/rewards'
import type { RewardResult, TransportType } from '@/lib/types'

export function useSubmitFareReport(deviceId: string | null) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = useCallback(
    async (from: string, to: string, fare: number, transportType: TransportType = 'trotro'): Promise<{ reward: RewardResult | null; errorMsg?: string }> => {
      if (!deviceId) {
        setError('Device not ready')
        return { reward: null, errorMsg: 'Device not ready' }
      }
      setIsSubmitting(true)
      setError(null)
      try {
        const result = await submitFareReport({
          fromLocation: from,
          toLocation: to,
          fare,
          deviceId,
          transportType,
        })
        if (!result) {
          return { reward: null, errorMsg: 'Report returned empty' }
        }
        // Award points in background — don't block the UI
        awardPointsForReport({
          deviceId,
          reportType: 'fare',
          reportId: result.reportId,
          routeId: result.routeId,
        }).catch((err) => console.error('Points award failed:', err))

        // Return optimistic reward immediately
        const reward: RewardResult = {
          points_awarded: REPORT_POINTS.fare,
          new_total: 0,
          level_up: false,
          badges_earned: [],
          new_streak: 1,
        }
        return { reward }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        console.error('Fare submit error:', msg)
        setError(msg)
        return { reward: null, errorMsg: msg }
      } finally {
        setIsSubmitting(false)
      }
    },
    [deviceId]
  )

  return { submit, isSubmitting, error }
}

export function useSubmitQueueReport(deviceId: string | null) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = useCallback(
    async (stationName: string, queueStatus: string, stationId?: string, vehicleCount?: number): Promise<RewardResult | null> => {
      if (!deviceId) {
        setError('Device not ready')
        return null
      }
      setIsSubmitting(true)
      setError(null)
      try {
        const result = await submitQueueReport({ stationName, queueStatus, deviceId, stationId, vehicleCount })
        if (!result) {
          setError('Failed to submit report')
          return null
        }
        // Award points in background
        awardPointsForReport({
          deviceId,
          reportType: 'queue',
          reportId: result.reportId,
        }).catch((err) => console.error('Points award failed:', err))

        return {
          points_awarded: REPORT_POINTS.queue,
          new_total: 0,
          level_up: false,
          badges_earned: [],
          new_streak: 1,
        }
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

export function useSubmitIncidentReport(deviceId: string | null) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = useCallback(
    async (locationName: string, incidentType: string): Promise<RewardResult | null> => {
      if (!deviceId) {
        setError('Device not ready')
        return null
      }
      setIsSubmitting(true)
      setError(null)
      try {
        const result = await submitIncidentReport({ locationName, incidentType, deviceId })
        if (!result) {
          setError('Failed to submit report')
          return null
        }
        // Award points in background
        awardPointsForReport({
          deviceId,
          reportType: 'incident',
          reportId: result.reportId,
        }).catch((err) => console.error('Points award failed:', err))

        return {
          points_awarded: REPORT_POINTS.incident,
          new_total: 0,
          level_up: false,
          badges_earned: [],
          new_streak: 1,
        }
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
