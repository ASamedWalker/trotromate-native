import { useState, useEffect } from 'react'
import { View, Text, useColorScheme } from 'react-native'
import { BarChart3, TrendingUp, TrendingDown, Minus, MapPin } from 'lucide-react-native'
import { c, themed, font } from '@/lib/theme'
import { useDeviceId } from '@/lib/hooks/useDeviceId'
import { supabase } from '@/lib/supabase'
import { formatGHS } from '@/lib/utils/currency'

interface SummaryData {
  total_trips: number
  total_spent: number
  avg_per_trip: number
  top_routes: { from: string; to: string; count: number; avg_fare: number }[]
  comparison: { diff: number; percent_change: number } | null
}

export function SpendingSummary() {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const t = themed(isDark)
  const { deviceId } = useDeviceId()
  const [data, setData] = useState<SummaryData | null>(null)

  useEffect(() => {
    if (!deviceId) return

    async function fetchSummary() {
      try {
        // Get contributor profile
        const { data: profile } = await supabase
          .from('contributor_profiles')
          .select('id')
          .eq('device_id', deviceId)
          .single()

        if (!profile) return

        const now = new Date()
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()
        const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
        const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString()

        // Current month fare reports
        const { data: monthHistory } = await supabase
          .from('points_history')
          .select('report_id')
          .eq('contributor_id', profile.id)
          .eq('reason', 'fare_report')
          .gte('created_at', monthStart)
          .lte('created_at', monthEnd)

        // Previous month count
        const { count: prevCount } = await supabase
          .from('points_history')
          .select('*', { count: 'exact', head: true })
          .eq('contributor_id', profile.id)
          .eq('reason', 'fare_report')
          .gte('created_at', prevMonthStart)
          .lte('created_at', prevMonthEnd)

        const totalTrips = (monthHistory || []).length
        if (totalTrips === 0) return

        const reportIds = (monthHistory || [])
          .map((h) => h.report_id)
          .filter((id): id is string => !!id && !id.startsWith('demo'))

        let totalSpent = 0
        const routeCounts = new Map<string, { from: string; to: string; count: number; totalFare: number }>()

        if (reportIds.length > 0) {
          const { data: fareReports } = await supabase
            .from('fare_reports')
            .select('id, reported_fare, route_id, routes(from_location, to_location)')
            .in('id', reportIds)

          for (const report of fareReports || []) {
            totalSpent += report.reported_fare || 0
            const route = (Array.isArray(report.routes) ? report.routes[0] : report.routes) as { from_location: string; to_location: string } | null
            if (route && report.route_id) {
              const existing = routeCounts.get(report.route_id)
              if (existing) {
                existing.count++
                existing.totalFare += report.reported_fare || 0
              } else {
                routeCounts.set(report.route_id, {
                  from: route.from_location,
                  to: route.to_location,
                  count: 1,
                  totalFare: report.reported_fare || 0,
                })
              }
            }
          }
        }

        const prevTrips = prevCount || 0
        let comparison = null
        if (prevTrips > 0) {
          const diff = totalTrips - prevTrips
          comparison = { diff, percent_change: Math.round((diff / prevTrips) * 100) }
        }

        setData({
          total_trips: totalTrips,
          total_spent: Math.round(totalSpent * 100) / 100,
          avg_per_trip: totalTrips > 0 ? Math.round((totalSpent / totalTrips) * 100) / 100 : 0,
          top_routes: Array.from(routeCounts.values())
            .sort((a, b) => b.count - a.count)
            .slice(0, 3)
            .map((r) => ({ from: r.from, to: r.to, count: r.count, avg_fare: r.count > 0 ? r.totalFare / r.count : 0 })),
          comparison,
        })
      } catch {
        // Ignore
      }
    }
    fetchSummary()
  }, [deviceId])

  if (!data) return null

  const monthLabel = new Date().toLocaleDateString('en-GH', { month: 'long' })

  return (
    <View style={{
      marginHorizontal: 20,
      marginTop: 16,
      backgroundColor: t.card,
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: t.border,
    }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <BarChart3 size={20} color={c.amber500} />
        <Text style={{ fontFamily: font.semibold, fontSize: 15, color: t.text }}>
          {monthLabel} Summary
        </Text>
      </View>

      {/* Stats Row */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
        <View style={{ flex: 1, backgroundColor: isDark ? c.stone800 : c.stone100, borderRadius: 12, padding: 12, alignItems: 'center' }}>
          <Text style={{ fontFamily: font.bold, fontSize: 22, color: t.text }}>{data.total_trips}</Text>
          <Text style={{ fontFamily: font.regular, fontSize: 11, color: t.textSecondary, marginTop: 2 }}>Trips</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: isDark ? c.stone800 : c.stone100, borderRadius: 12, padding: 12, alignItems: 'center' }}>
          <Text style={{ fontFamily: font.bold, fontSize: 22, color: c.amber500 }}>{formatGHS(data.total_spent)}</Text>
          <Text style={{ fontFamily: font.regular, fontSize: 11, color: t.textSecondary, marginTop: 2 }}>Spent</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: isDark ? c.stone800 : c.stone100, borderRadius: 12, padding: 12, alignItems: 'center' }}>
          <Text style={{ fontFamily: font.bold, fontSize: 22, color: t.text }}>{formatGHS(data.avg_per_trip)}</Text>
          <Text style={{ fontFamily: font.regular, fontSize: 11, color: t.textSecondary, marginTop: 2 }}>Avg/trip</Text>
        </View>
      </View>

      {/* Comparison */}
      {data.comparison && (
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 12,
          marginBottom: 16,
          backgroundColor: data.comparison.diff > 0
            ? (isDark ? 'rgba(16,185,129,0.1)' : '#ecfdf5')
            : data.comparison.diff < 0
              ? (isDark ? 'rgba(239,68,68,0.1)' : '#fef2f2')
              : (isDark ? c.stone800 : c.stone100),
        }}>
          {data.comparison.diff > 0 ? (
            <TrendingUp size={16} color="#10b981" />
          ) : data.comparison.diff < 0 ? (
            <TrendingDown size={16} color="#ef4444" />
          ) : (
            <Minus size={16} color={t.textSecondary} />
          )}
          <Text style={{
            fontFamily: font.medium,
            fontSize: 13,
            color: data.comparison.diff > 0 ? '#10b981' : data.comparison.diff < 0 ? '#ef4444' : t.textSecondary,
          }}>
            {data.comparison.diff > 0 ? '+' : ''}{data.comparison.percent_change}% vs last month
          </Text>
        </View>
      )}

      {/* Top Routes */}
      {data.top_routes.length > 0 && (
        <View>
          <Text style={{ fontFamily: font.semibold, fontSize: 11, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
            Top Routes
          </Text>
          {data.top_routes.map((route, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: isDark ? 'rgba(245,158,11,0.15)' : '#fef3c7', alignItems: 'center', justifyContent: 'center' }}>
                <MapPin size={12} color={c.amber500} />
              </View>
              <Text style={{ flex: 1, fontFamily: font.regular, fontSize: 13, color: t.text }} numberOfLines={1}>
                {route.from} → {route.to}
              </Text>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontFamily: font.semibold, fontSize: 13, color: t.text }}>{route.count}x</Text>
                <Text style={{ fontFamily: font.regular, fontSize: 10, color: t.textSecondary }}>{formatGHS(route.avg_fare)}/trip</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}
