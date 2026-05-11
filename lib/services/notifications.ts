import { supabase } from '@/lib/supabase/client'

interface FareReportWithRoute {
  id: string
  route_id: string
  reported_fare: number
  reported_at: string
  routes: { from_location: string; to_location: string } | null
}

export type NotificationType =
  | 'fare_drop'
  | 'queue_alert'
  | 'streak_risk'
  | 'level_up'
  | 'badge_earned'
  | 'community'
  | 'official_announcement'

export interface AppNotification {
  id: string
  type: NotificationType
  title: string
  body: string
  timestamp: string
  color: string
  linkTo?: string
  source?: string
}

const SOURCE_COLORS: Record<string, string> = {
  GPRTU: '#10b981',
  GRDA: '#3b82f6',
  GRA: '#8b5cf6',
  MMTL: '#f59e0b',
  MOT: '#6366f1',
  TROSKI: '#f59e0b',
  TECH: '#06b6d4',
  GLOBAL: '#ec4899',
}

export async function fetchNotifications(
  deviceId: string,
  favoriteRouteIds: string[]
): Promise<AppNotification[]> {
  const notifications: AppNotification[] = []
  const now = new Date()
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString()

  // 1. Fare drops on favorited routes (recent fares significantly lower than avg)
  if (favoriteRouteIds.length > 0) {
    const { data: fareStats } = await supabase
      .from('route_fare_stats')
      .select('route_id, avg_reported_fare, last_report_at')
      .in('route_id', favoriteRouteIds)

    if (fareStats) {
      const { data: recentFares } = await supabase
        .from('fare_reports')
        .select('id, route_id, reported_fare, reported_at, routes!inner(from_location, to_location)')
        .in('route_id', favoriteRouteIds)
        .gt('reported_at', threeDaysAgo)
        .order('reported_at', { ascending: false })
        .limit(20)

      if (recentFares) {
        for (const fare of recentFares) {
          const stat = fareStats.find((s) => s.route_id === fare.route_id)
          if (stat && fare.reported_fare < stat.avg_reported_fare * 0.85) {
            const route = (fare as unknown as FareReportWithRoute).routes
            notifications.push({
              id: `fare-drop-${fare.id}`,
              type: 'fare_drop',
              title: 'Fare Drop Alert',
              body: `${route?.from_location} → ${route?.to_location}: ₵${fare.reported_fare.toFixed(2)} (was ₵${stat.avg_reported_fare.toFixed(2)} avg)`,
              timestamp: fare.reported_at as string,
              color: '#22c55e',
            })
          }
        }
      }
    }
  }

  // 2. Queue alerts on favorited routes (long/very_long queues)
  if (favoriteRouteIds.length > 0) {
    const { data: queueAlerts } = await supabase
      .from('queue_reports')
      .select('id, station_name, queue_status, reported_at')
      .in('queue_status', ['long', 'very_long'])
      .gt('reported_at', threeDaysAgo)
      .order('reported_at', { ascending: false })
      .limit(10)

    if (queueAlerts) {
      for (const q of queueAlerts) {
        notifications.push({
          id: `queue-alert-${q.id}`,
          type: 'queue_alert',
          title: 'Queue Alert',
          body: `${q.station_name}: ${q.queue_status === 'very_long' ? 'Very long' : 'Long'} queue reported`,
          timestamp: q.reported_at as string,
          color: '#f97316',
        })
      }
    }
  }

  // 3. Streak risk — check if user might lose their streak
  const { data: profileData } = await supabase
    .from('contributor_profiles')
    .select('current_streak, last_report_date')
    .eq('device_id', deviceId)
    .single()

  if (profileData && profileData.current_streak > 0 && profileData.last_report_date) {
    const lastReport = new Date(profileData.last_report_date)
    const hoursSince = (now.getTime() - lastReport.getTime()) / (1000 * 60 * 60)
    if (hoursSince > 20 && hoursSince < 48) {
      notifications.push({
        id: `streak-risk-${profileData.last_report_date}`,
        type: 'streak_risk',
        title: 'Streak at Risk!',
        body: `Your ${profileData.current_streak}-day streak will reset if you don't report today.`,
        timestamp: now.toISOString(),
        color: '#ef4444',
      })
    }
  }

  // 4. Recent community activity (last 24h summary)
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
  const { count: recentReportCount } = await supabase
    .from('fare_reports')
    .select('id', { count: 'exact', head: true })
    .gt('reported_at', oneDayAgo)

  if (recentReportCount && recentReportCount > 5) {
    notifications.push({
      id: `community-${oneDayAgo.split('T')[0]}`,
      type: 'community',
      title: 'Community Active',
      body: `${recentReportCount} fare reports submitted in the last 24 hours. Check for updates!`,
      timestamp: oneDayAgo,
      color: '#8b5cf6',
    })
  }

  // 5. Official announcements (GPRTU, GRDA, etc.) — Transport Pulse
  const { data: announcements } = await supabase
    .from('official_announcements')
    .select('id, source, title, body, priority, published_at, expires_at, is_published')
    .eq('is_published', true)
    .order('published_at', { ascending: false })
    .limit(20)

  if (announcements) {
    const nowMs = now.getTime()
    for (const a of announcements) {
      if (a.expires_at && new Date(a.expires_at as string).getTime() < nowMs) continue
      const source = (a.source as string) || 'TROSKI'
      notifications.push({
        id: `official-${a.id}`,
        type: 'official_announcement',
        title: `${source}: ${a.title}`,
        body: a.body as string,
        timestamp: a.published_at as string,
        color: SOURCE_COLORS[source] ?? '#f59e0b',
        linkTo: '/bulletin',
        source,
      })
    }
  }

  notifications.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  return notifications
}
