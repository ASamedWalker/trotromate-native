import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'

export interface ActiveIncident {
  id: string
  location_name: string
  incident_type: string
  latitude: number
  longitude: number
  reported_at: string
  expires_at: string
}

/**
 * Fetches incident reports that haven't expired and have coordinates.
 * Refreshes every 60s.
 */
export function useActiveIncidents() {
  const [incidents, setIncidents] = useState<ActiveIncident[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const fetch = useCallback(async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('incident_reports')
        .select('id, location_name, incident_type, latitude, longitude, reported_at, expires_at')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
        .gt('expires_at', new Date().toISOString())
        .order('reported_at', { ascending: false })
        .limit(50)

      if (error) {
        console.error('[useActiveIncidents] Supabase error:', error.message, error.code)
      } else if (data) {
        console.log('[useActiveIncidents] Fetched', data.length, 'active incidents')
        setIncidents(data as ActiveIncident[])
      }
    } catch (err) {
      console.error('[useActiveIncidents] Fetch error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetch()
    const interval = setInterval(fetch, 60_000)
    return () => clearInterval(interval)
  }, [fetch])

  return { incidents, isLoading, refetch: fetch }
}
