import { useEffect } from 'react'
import { Platform } from 'react-native'
import { useMyCommutes } from '@/lib/hooks/useMyCommutes'
import { useUserCommutes } from '@/lib/hooks/useUserCommutes'
import { supabase } from '@/lib/supabase/client'
import {
  syncCommuteToWatch,
  syncStationsToWatch,
  sendAlertToWatch,
  type QueueStatus,
} from '@/lib/watchSync'

/**
 * Syncs ALL data to Apple Watch: live reports, stations, queue status, alerts.
 * Phase 1: Always sends general transit data — no commute required.
 * Phase 2: If user has a commute set, also sends personalized data.
 */
export function useWatchSync(deviceId: string | null) {
  const { commutes } = useMyCommutes()
  const { primaryCommute } = useUserCommutes(deviceId)

  useEffect(() => {
    if (Platform.OS !== 'ios') return

    const syncAll = async () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()

      // ── 1. Commute data (if user has one set) ──
      const from = primaryCommute?.from_location ?? commutes[0]?.from
      const to = primaryCommute?.to_location ?? commutes[0]?.to
      const routeId = primaryCommute?.route_id ?? commutes[0]?.routeId

      if (from && to) {
        // User has a commute — send personalized data
        let fare = 0
        if (routeId) {
          const { data } = await supabase
            .from('route_fare_stats')
            .select('avg_reported_fare')
            .eq('route_id', routeId)
            .single()
          if (data?.avg_reported_fare && data.avg_reported_fare >= 1.0) {
            fare = data.avg_reported_fare
          }
        }
        if (fare === 0) {
          const { data } = await supabase
            .from('routes')
            .select('id, fare_stats:route_fare_stats(avg_reported_fare)')
            .ilike('from_location', `%${from}%`)
            .ilike('to_location', `%${to}%`)
            .limit(1)
            .single()
          if (data?.fare_stats?.[0]?.avg_reported_fare && data.fare_stats[0].avg_reported_fare >= 1.0) {
            fare = data.fare_stats[0].avg_reported_fare
          }
        }

        let queueStatus: QueueStatus = 'short'
        let waitTime = ''
        const { data: queueReport } = await supabase
          .from('queue_reports')
          .select('queue_status, reported_at')
          .ilike('station_name', `%${from}%`)
          .gte('reported_at', twoHoursAgo)
          .order('reported_at', { ascending: false })
          .limit(1)
          .single()

        if (queueReport) {
          const status = queueReport.queue_status as string
          queueStatus = (status === 'very_long' ? 'veryLong' : status) as QueueStatus
          const ageMins = Math.round((Date.now() - new Date(queueReport.reported_at).getTime()) / 60000)
          waitTime = ageMins < 60 ? `~${ageMins} min ago` : ''
        }

        syncCommuteToWatch({
          from,
          to,
          fare,
          queueStatus,
          waitTime,
          lastUpdated: new Date().toISOString(),
        })
      } else {
        // No commute set — send latest popular route as default
        const { data: latestFare } = await supabase
          .from('fare_reports')
          .select('route_id, reported_fare, reported_at')
          .gte('reported_fare', 1.0)
          .order('reported_at', { ascending: false })
          .limit(1)
          .single()

        if (latestFare?.route_id) {
          const { data: route } = await supabase
            .from('routes')
            .select('from_location, to_location')
            .eq('id', latestFare.route_id)
            .single()

          if (route) {
            syncCommuteToWatch({
              from: route.from_location,
              to: route.to_location,
              fare: latestFare.reported_fare,
              queueStatus: 'short',
              waitTime: '',
              lastUpdated: latestFare.reported_at,
            })
          }
        }
      }

      // ── 2. Stations — ALWAYS sync, commute or not ──
      const { data: majorStations } = await supabase
        .from('stations')
        .select('name')
        .eq('is_major', true)
        .limit(15)

      const { data: stationReports } = await supabase
        .from('queue_reports')
        .select('station_name, queue_status, reported_at')
        .gte('reported_at', twoHoursAgo)
        .order('reported_at', { ascending: false })
        .limit(20)

      // Build queue status lookup
      const queueMap = new Map<string, { name: string; status: string; reportedAt: string }>()
      if (stationReports) {
        for (const r of stationReports) {
          const key = r.station_name.toLowerCase()
          if (!queueMap.has(key)) {
            queueMap.set(key, { name: r.station_name, status: r.queue_status, reportedAt: r.reported_at })
          }
        }
      }

      const stationSet = new Map<string, { name: string; queueStatus: QueueStatus; waitTime: string; fare: number }>()

      // Include commute stations if set
      if (from && to) {
        for (const name of [from, to]) {
          const queueInfo = queueMap.get(name.toLowerCase())
          const status = queueInfo
            ? (queueInfo.status === 'very_long' ? 'veryLong' : queueInfo.status) as QueueStatus
            : 'short'
          stationSet.set(name.toLowerCase(), { name, queueStatus: status, waitTime: '', fare: 0 })
        }
      }

      // Add major stations
      if (majorStations) {
        for (const s of majorStations) {
          const key = s.name.toLowerCase()
          if (stationSet.has(key)) continue
          const queueInfo = queueMap.get(key)
          const status = queueInfo
            ? (queueInfo.status === 'very_long' ? 'veryLong' : queueInfo.status) as QueueStatus
            : 'short'
          stationSet.set(key, { name: s.name, queueStatus: status, waitTime: '', fare: 0 })
        }
      }

      // Add stations from recent queue reports
      for (const [key, info] of queueMap) {
        if (stationSet.has(key)) continue
        stationSet.set(key, {
          name: info.name,
          queueStatus: (info.status === 'very_long' ? 'veryLong' : info.status) as QueueStatus,
          waitTime: '',
          fare: 0,
        })
      }

      const watchStations = Array.from(stationSet.values())
      if (watchStations.length > 0) {
        syncStationsToWatch(watchStations)
      }

      // ── 3. Alerts — ALWAYS check, commute or not ──
      const criticalReport = stationReports?.find((r) => r.queue_status === 'very_long')
      if (criticalReport) {
        const alternative = stationReports?.find(
          (r) => r.queue_status === 'short' || r.queue_status === 'moderate'
        )
        sendAlertToWatch({
          station: criticalReport.station_name,
          queueStatus: 'veryLong',
          alternative: alternative?.station_name ?? 'a nearby station',
        })
      }
    }

    syncAll()
  }, [commutes, primaryCommute])
}
