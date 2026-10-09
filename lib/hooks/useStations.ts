import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchStations, type StationWithQueue } from '@/lib/services/stations'
import { supabase } from '@/lib/supabase/client'
import { cacheStations, getCachedStations } from '@/lib/services/offline-cache'

let sharedChannel: ReturnType<typeof supabase.channel> | null = null
const listeners = new Set<() => void>()

function subscribeQueueUpdates(onInsert: () => void): () => void {
  listeners.add(onInsert)
  if (!sharedChannel) {
    sharedChannel = supabase
      .channel('queue-updates')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'queue_reports' }, () => {
        listeners.forEach((fn) => fn())
      })
      .subscribe()
  }
  return () => {
    listeners.delete(onInsert)
    if (listeners.size === 0 && sharedChannel) {
      const ch = sharedChannel
      sharedChannel = null
      ch.unsubscribe()
      supabase.removeChannel(ch)
    }
  }
}

export function useStations() {
  const queryClient = useQueryClient()
  const [cachedData, setCachedData] = useState<StationWithQueue[] | undefined>(undefined)

  // Load cache on mount for instant UI
  useEffect(() => {
    getCachedStations().then((data) => {
      if (data) setCachedData(data)
    })
  }, [])

  const { data: stations = [], isLoading, refetch } = useQuery<StationWithQueue[]>({
    queryKey: ['stations'],
    queryFn: async () => {
      const result = await fetchStations()
      // Cache in background for offline use
      cacheStations(result)
      return result
    },
    staleTime: 2 * 60 * 1000,      // 2 minutes
    // No refetchInterval: the realtime subscription below already invalidates
    // this query the moment anyone files a queue report. Polling as well meant
    // ~720 extra requests per device per day — each pulling every station — for
    // data we were already being pushed. Data costs money in Ghana.
    refetchOnWindowFocus: false,
    placeholderData: cachedData,
  })

  // Supabase Realtime: instantly refresh when anyone submits a queue report.
  // One shared channel for every mounted user of this hook (Stations tab, report
  // screen, …): two channels on one topic kill each other on removeChannel.
  useEffect(() => {
    const unsubscribe = subscribeQueueUpdates(() => {
      queryClient.invalidateQueries({ queryKey: ['stations'] })
    })
    return unsubscribe
  }, [queryClient])

  return { stations, isLoading, refetch }
}
