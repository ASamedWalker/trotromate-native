import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchStations, type StationWithQueue } from '@/lib/services/stations'
import { supabase } from '@/lib/supabase/client'
import { cacheStations, getCachedStations } from '@/lib/services/offline-cache'

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

  // Supabase Realtime: instantly refresh when anyone submits a queue report
  useEffect(() => {
    const channel = supabase
      .channel('queue-updates')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'queue_reports' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['stations'] })
        },
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
      supabase.removeChannel(channel)
    }
  }, [queryClient])

  return { stations, isLoading, refetch }
}
