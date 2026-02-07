import { useState, useEffect, useCallback } from 'react'
import NetInfo from '@react-native-community/netinfo'
import { useQueryClient } from '@tanstack/react-query'
import { processQueue, getPendingCount, enqueueReport, type QueuedReportType } from '@/lib/services/offline-queue'

export function useOfflineQueue() {
  const queryClient = useQueryClient()
  const [isOnline, setIsOnline] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)

  // Monitor network state
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = !!state.isConnected
      setIsOnline(online)

      // Auto-process queue when connectivity returns
      if (online) {
        processQueue().then((processed) => {
          if (processed > 0) {
            // Refresh relevant caches after syncing
            queryClient.invalidateQueries({ queryKey: ['profile'] })
            queryClient.invalidateQueries({ queryKey: ['activity'] })
            queryClient.invalidateQueries({ queryKey: ['routes'] })
            queryClient.invalidateQueries({ queryKey: ['tales'] })
          }
          getPendingCount().then(setPendingCount)
        })
      }
    })

    // Initial pending count
    getPendingCount().then(setPendingCount)

    return () => unsubscribe()
  }, [queryClient])

  const queueReport = useCallback(
    async (type: QueuedReportType, deviceId: string, payload: Record<string, unknown>) => {
      await enqueueReport(type, deviceId, payload)
      setPendingCount((c) => c + 1)
    },
    []
  )

  return { isOnline, pendingCount, queueReport }
}
