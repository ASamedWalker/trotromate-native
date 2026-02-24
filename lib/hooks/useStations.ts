import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchStations, type StationWithQueue } from '@/lib/services/stations'
import { supabase } from '@/lib/supabase/client'

export function useStations() {
  const queryClient = useQueryClient()
  const { data: stations = [], isLoading, refetch } = useQuery<StationWithQueue[]>({
    queryKey: ['stations'],
    queryFn: fetchStations,
    staleTime: 2 * 60 * 1000,      // 2 minutes
    refetchInterval: 2 * 60 * 1000, // auto-poll every 2 minutes
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
      supabase.removeChannel(channel)
    }
  }, [queryClient])

  return { stations, isLoading, refetch }
}
