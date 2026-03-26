import { useState, useEffect } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  useColorScheme,
  StyleSheet,
} from 'react-native'
import { useRouter, type Href } from 'expo-router'
import { AlertTriangle, Users, Zap } from 'lucide-react-native'
import { c, themed, font } from '@/lib/theme'
import { supabase } from '@/lib/supabase/client'
import { useSupabaseRealtime } from '@/lib/hooks/useSupabaseRealtime'

interface LiveEvent {
  id: string
  type: 'incident' | 'queue_long'
  title: string
  subtitle: string
  routeId?: string
  stationId?: string
  color: string
  bgColor: string
  time: string
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  return `${hours}h ago`
}

export default function HappeningNow() {
  const router = useRouter()
  const isDark = useColorScheme() === 'dark'
  const t = themed(isDark)
  const s = getStyles(isDark)

  const [events, setEvents] = useState<LiveEvent[]>([])
  const [refreshKey, setRefreshKey] = useState(0)

  // Re-fetch when new reports come in
  useSupabaseRealtime({
    tables: ['incident_reports', 'queue_reports'],
    onInsert: () => setRefreshKey((k) => k + 1),
  })

  useEffect(() => {
    async function fetchLive() {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
      const liveEvents: LiveEvent[] = []

      // Active incidents
      const { data: incidents } = await supabase
        .from('incident_reports')
        .select('id, incident_type, description, location_name, reported_at, route_id')
        .gte('reported_at', twoHoursAgo)
        .gt('expires_at', new Date().toISOString())
        .order('reported_at', { ascending: false })
        .limit(3)

      for (const inc of incidents || []) {
        liveEvents.push({
          id: `inc-${inc.id}`,
          type: 'incident',
          title: inc.incident_type?.replace(/_/g, ' ') || 'Incident',
          subtitle: inc.location_name || inc.description?.slice(0, 40) || '',
          routeId: inc.route_id,
          color: c.red500,
          bgColor: isDark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.1)',
          time: timeAgo(inc.reported_at),
        })
      }

      // Long queues
      const { data: queues } = await supabase
        .from('queue_reports')
        .select('id, station_id, queue_level, reported_at')
        .in('queue_level', ['long', 'very_long'])
        .gte('reported_at', oneHourAgo)
        .order('reported_at', { ascending: false })
        .limit(3)

      for (const q of queues || []) {
        liveEvents.push({
          id: `queue-${q.id}`,
          type: 'queue_long',
          title: 'Long queue reported',
          subtitle: q.queue_level === 'very_long' ? 'Very long wait' : 'Long wait',
          stationId: q.station_id,
          color: c.amber600,
          bgColor: isDark ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.1)',
          time: timeAgo(q.reported_at),
        })
      }

      setEvents(liveEvents.slice(0, 5))
    }

    fetchLive()
  }, [refreshKey, isDark])

  if (events.length === 0) return null

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Zap size={14} color={c.amber500} />
        <Text style={s.headerText}>Happening Now</Text>
        <View style={s.liveDot} />
      </View>
      <FlatList
        data={events}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const Icon = item.type === 'incident' ? AlertTriangle : Users
          return (
            <TouchableOpacity
              onPress={() => {
                if (item.routeId) router.push(`/routes/${item.routeId}` as Href)
                else if (item.stationId) router.push(`/stations/${item.stationId}` as Href)
              }}
              activeOpacity={0.7}
              style={s.card}
            >
              <View style={s.cardTop}>
                <View style={[s.iconCircle, { backgroundColor: item.bgColor }]}>
                  <Icon size={14} color={item.color} />
                </View>
                <Text style={s.timeText}>{item.time}</Text>
              </View>
              <Text style={s.cardTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={s.cardSub} numberOfLines={1}>{item.subtitle}</Text>
            </TouchableOpacity>
          )
        }}
      />
    </View>
  )
}

const getStyles = (isDark: boolean) => {
  const t = themed(isDark)
  return StyleSheet.create({
    container: { marginTop: 16 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 20,
      marginBottom: 10,
    },
    headerText: {
      fontSize: 15,
      fontFamily: font.bold,
      color: t.text,
    },
    liveDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#22c55e',
    },
    card: {
      width: 200,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#fff',
      borderRadius: 16,
      padding: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    },
    cardTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
    },
    iconCircle: {
      width: 30,
      height: 30,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    timeText: {
      fontSize: 11,
      fontFamily: font.medium,
      color: t.textTertiary,
    },
    cardTitle: {
      fontSize: 14,
      fontFamily: font.bold,
      color: t.text,
    },
    cardSub: {
      fontSize: 12,
      fontFamily: font.medium,
      color: t.textSecondary,
      marginTop: 3,
    },
  })
}
