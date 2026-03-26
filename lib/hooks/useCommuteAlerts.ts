import { useEffect, useRef } from 'react'
import * as Notifications from 'expo-notifications'
import { supabase } from '@/lib/supabase/client'
import { useMyCommutes } from './useMyCommutes'
import { useRouteAlerts } from './useRouteAlerts'

const THROTTLE_MS = 30 * 60 * 1000 // 30 minutes per route

/**
 * Watches Supabase Realtime for incidents and long queues
 * on the user's saved commute routes, firing local notifications.
 */
export function useCommuteAlerts() {
  const { commutes, isLoaded: commutesLoaded } = useMyCommutes()
  const { alertedIds, isLoaded: alertsLoaded } = useRouteAlerts()
  const lastNotified = useRef<Map<string, number>>(new Map())

  useEffect(() => {
    if (!commutesLoaded || !alertsLoaded) return
    if (commutes.length === 0 && alertedIds.length === 0) return

    // Build lookup of station/location names from saved commutes
    const watchedLocations = new Set<string>()
    const routeLabels = new Map<string, string>()

    for (const commute of commutes) {
      watchedLocations.add(commute.from.toLowerCase())
      watchedLocations.add(commute.to.toLowerCase())
      routeLabels.set(commute.routeId, `${commute.from} → ${commute.to}`)
    }

    // Subscribe to incident reports
    const incidentChannel = supabase
      .channel('commute-incidents')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'incident_reports' },
        (payload) => {
          const locationName: string = payload.new.location_name || ''
          if (!locationName) return

          // Check if this incident matches a watched location
          const matchesWatched = [...watchedLocations].some(
            (loc) => locationName.toLowerCase().includes(loc),
          )
          if (!matchesWatched) return

          const key = `incident-${locationName}`
          if (isThrottled(key)) return

          fireNotification({
            title: `Incident: ${locationName}`,
            body: `${payload.new.incident_type} reported near your commute route`,
            data: { screen: 'stations' },
            channelId: 'commute-alerts',
          })
          markNotified(key)
        },
      )
      .subscribe()

    // Subscribe to long queue reports
    const queueChannel = supabase
      .channel('commute-queues')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'queue_reports' },
        (payload) => {
          const status = payload.new.queue_status
          if (status !== 'long' && status !== 'very_long') return

          const stationName: string = payload.new.station_name || ''
          if (!stationName) return

          const matchesWatched = [...watchedLocations].some(
            (loc) => stationName.toLowerCase().includes(loc),
          )
          if (!matchesWatched) return

          const key = `queue-${stationName}`
          if (isThrottled(key)) return

          const label = status === 'very_long' ? 'Very long queue' : 'Long queue'
          fireNotification({
            title: `${label}: ${stationName}`,
            body: 'Long queue reported on a station near your commute',
            data: { screen: 'stations' },
            channelId: 'commute-alerts',
          })
          markNotified(key)
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(incidentChannel)
      supabase.removeChannel(queueChannel)
    }
  }, [commutes, alertedIds, commutesLoaded, alertsLoaded])

  function isThrottled(key: string): boolean {
    const last = lastNotified.current.get(key)
    return !!last && Date.now() - last < THROTTLE_MS
  }

  function markNotified(key: string) {
    lastNotified.current.set(key, Date.now())
  }
}

async function fireNotification(opts: {
  title: string
  body: string
  data: Record<string, string>
  channelId: string
}) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: opts.title,
      body: opts.body,
      data: opts.data,
      sound: true,
    },
    trigger: null, // immediate
  })
}
