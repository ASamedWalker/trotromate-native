import AsyncStorage from '@react-native-async-storage/async-storage'
import NetInfo from '@react-native-community/netinfo'
import { submitFareReport, submitQueueReport, submitIncidentReport } from './reports'
import { submitTale } from './tales'
import { awardPointsForReport, awardPointsForTrip } from './rewards'
import { saveCompletedTripDirect } from './trips'
import type { CompletedTripPayload } from './trips'
import type { ReportType } from '@/lib/types'

const QUEUE_KEY = '@troski_offline_queue'

export type QueuedReportType = 'fare' | 'queue' | 'incident' | 'tale' | 'trip'

interface QueuedReport {
  id: string
  type: QueuedReportType
  deviceId: string
  payload: Record<string, unknown>
  createdAt: string
}

async function getQueue(): Promise<QueuedReport[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY)
  return raw ? JSON.parse(raw) : []
}

async function saveQueue(queue: QueuedReport[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
}

export async function enqueueReport(
  type: QueuedReportType,
  deviceId: string,
  payload: Record<string, unknown>
): Promise<void> {
  const queue = await getQueue()
  queue.push({
    id: `${deviceId}-${Date.now()}`,
    type,
    deviceId,
    payload,
    createdAt: new Date().toISOString(),
  })
  await saveQueue(queue)
}

export async function getPendingCount(): Promise<number> {
  const queue = await getQueue()
  return queue.length
}

export async function processQueue(): Promise<number> {
  const netState = await NetInfo.fetch()
  if (!netState.isConnected) return 0

  const queue = await getQueue()
  if (queue.length === 0) return 0

  const remaining: QueuedReport[] = []
  let processed = 0

  for (const item of queue) {
    try {
      let reportId: string | null = null
      let reportType: ReportType = item.type as ReportType

      switch (item.type) {
        case 'fare': {
          const result = await submitFareReport({
            fromLocation: item.payload.fromLocation as string,
            toLocation: item.payload.toLocation as string,
            fare: item.payload.fare as number,
            deviceId: item.deviceId,
          })
          reportId = result?.reportId ?? null
          break
        }
        case 'queue': {
          const result = await submitQueueReport({
            stationName: item.payload.stationName as string,
            queueStatus: item.payload.queueStatus as string,
            deviceId: item.deviceId,
          })
          reportId = result?.reportId ?? null
          break
        }
        case 'incident': {
          const result = await submitIncidentReport({
            locationName: item.payload.locationName as string,
            incidentType: item.payload.incidentType as string,
            deviceId: item.deviceId,
          })
          reportId = result?.reportId ?? null
          break
        }
        case 'tale': {
          const result = await submitTale({
            deviceId: item.deviceId,
            displayName: item.payload.displayName as string | null,
            imageUris: [item.payload.imageUri as string],
            caption: item.payload.caption as string,
            location: item.payload.location as string,
          })
          reportId = result?.postId ?? null
          break
        }
        case 'trip': {
          const tripPayload = item.payload as unknown as CompletedTripPayload
          const tripId = await saveCompletedTripDirect(tripPayload)
          if (tripId) {
            // Award points for the synced trip
            await awardPointsForTrip({
              deviceId: item.deviceId,
              tripId,
              withFare: !!(tripPayload.fare_paid),
            })
          }
          reportId = tripId
          break
        }
      }

      if (reportId) {
        // Award report points (skip for trips — already handled above)
        if (item.type !== 'trip') {
          await awardPointsForReport({
            deviceId: item.deviceId,
            reportType,
            reportId,
          })
        }
        processed++
      } else {
        remaining.push(item)
      }
    } catch {
      remaining.push(item)
    }
  }

  await saveQueue(remaining)
  return processed
}

export async function clearQueue(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_KEY)
}
