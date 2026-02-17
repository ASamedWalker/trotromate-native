import { useState, useCallback } from 'react'
import { submitFareReport, submitQueueReport, submitIncidentReport } from '@/lib/services/reports'
import { awardPointsForReport } from '@/lib/services/rewards'
import type { RewardResult, TransportType } from '@/lib/types'

export function useSubmitFareReport(deviceId: string | null) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = useCallback(
    async (from: string, to: string, fare: number, transportType: TransportType = 'trotro'): Promise<RewardResult | null> => {
      if (!deviceId) {
        setError('Device not ready')
        return null
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
          setError('Failed to submit report')
          return null
        }
        // Award points
        const reward = await awardPointsForReport({
          deviceId,
          reportType: 'fare',
          reportId: result.reportId,
          routeId: result.routeId,
        })
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

export function useSubmitQueueReport(deviceId: string | null) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = useCallback(
    async (stationName: string, queueStatus: string): Promise<RewardResult | null> => {
      if (!deviceId) {
        setError('Device not ready')
        return null
      }
      setIsSubmitting(true)
      setError(null)
      try {
        const result = await submitQueueReport({ stationName, queueStatus, deviceId })
        if (!result) {
          setError('Failed to submit report')
          return null
        }
        const reward = await awardPointsForReport({
          deviceId,
          reportType: 'queue',
          reportId: result.reportId,
        })
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
        const reward = await awardPointsForReport({
          deviceId,
          reportType: 'incident',
          reportId: result.reportId,
        })
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
