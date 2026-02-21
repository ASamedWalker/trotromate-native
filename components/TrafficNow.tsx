import { View, Text, TouchableOpacity, StyleSheet, useColorScheme } from 'react-native'
import { useRouter, type Href } from 'expo-router'
import { Activity, ChevronRight, Navigation } from 'lucide-react-native'
import { c, themed, font } from '@/lib/theme'
import { useTrafficSummary } from '@/lib/hooks/useTraffic'
import { TrafficDot } from '@/components/TrafficBadge'

export default function TrafficNow() {
  const isDark = useColorScheme() === 'dark'
  const t = themed(isDark)
  const s = getStyles(isDark)
  const router = useRouter()

  const { data: routes } = useTrafficSummary()

  const routesWithData = (routes || []).filter(
    (r) => r.traffic_condition || r.busyness.confidence > 0
  )

  if (routesWithData.length === 0) return null

  return (
    <View style={s.container}>
      <View style={s.header}>
        <View style={s.headerLeft}>
          <Activity size={16} color={c.amber500} />
          <Text style={s.title}>Traffic Now</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/routes')}
          style={s.headerRight}
        >
          <Text style={s.seeAll}>All routes</Text>
          <ChevronRight size={14} color={c.amber500} />
        </TouchableOpacity>
      </View>

      <View style={s.card}>
        {routesWithData.slice(0, 5).map((route, idx) => (
          <TouchableOpacity
            key={route.route_id}
            onPress={() => router.push(`/routes/${route.route_id}` as Href)}
            activeOpacity={0.7}
            style={[
              s.row,
              idx !== routesWithData.length - 1 && idx !== 4 && s.rowBorder,
            ]}
          >
            <View style={s.rowIcon}>
              <Navigation size={14} color={t.textSecondary} />
            </View>
            <View style={s.rowContent}>
              <Text style={s.routeName} numberOfLines={1}>
                {route.from_location} → {route.to_location}
              </Text>
              <View style={s.rowMeta}>
                {route.duration_in_traffic_mins ? (
                  <Text style={s.etaText}>
                    {route.duration_in_traffic_mins} min
                    {route.delay_mins > 0 && (
                      <Text style={s.delayText}> +{route.delay_mins}m</Text>
                    )}
                  </Text>
                ) : route.estimated_duration_mins ? (
                  <Text style={s.etaText}>~{route.estimated_duration_mins} min</Text>
                ) : null}
              </View>
            </View>
            <View style={s.rowRight}>
              <TrafficDot condition={route.traffic_condition} />
              <BusynessLabel level={route.busyness.level} isDark={isDark} />
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )
}

function BusynessLabel({ level, isDark }: { level: string; isDark: boolean }) {
  const colors: Record<string, { text: string; bg: string }> = {
    low: { text: isDark ? '#34d399' : '#059669', bg: isDark ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.1)' },
    moderate: { text: isDark ? '#fbbf24' : '#d97706', bg: isDark ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.1)' },
    busy: { text: isDark ? '#fb923c' : '#ea580c', bg: isDark ? 'rgba(249,115,22,0.15)' : 'rgba(249,115,22,0.1)' },
    very_busy: { text: isDark ? '#f87171' : '#dc2626', bg: isDark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.1)' },
  }

  const labels: Record<string, string> = {
    low: 'Low',
    moderate: 'Moderate',
    busy: 'Busy',
    very_busy: 'Very busy',
  }

  const config = colors[level] || colors.low

  return (
    <View style={[bStyles.chip, { backgroundColor: config.bg }]}>
      <Text style={[bStyles.chipText, { color: config.text }]}>{labels[level] || 'Low'}</Text>
    </View>
  )
}

const bStyles = StyleSheet.create({
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  chipText: {
    fontSize: 11,
    fontFamily: font.medium,
  },
})

const getStyles = (isDark: boolean) => {
  const t = themed(isDark)
  return StyleSheet.create({
    container: {
      paddingHorizontal: 20,
      marginTop: 16,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    title: {
      fontSize: 16,
      fontFamily: font.bold,
      color: t.text,
    },
    seeAll: {
      fontSize: 13,
      fontFamily: font.medium,
      color: c.amber500,
    },
    card: {
      backgroundColor: t.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: t.border,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 10,
    },
    rowBorder: {
      borderBottomWidth: 1,
      borderBottomColor: t.border,
    },
    rowIcon: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: isDark ? c.stone800 : c.stone100,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowContent: {
      flex: 1,
    },
    routeName: {
      fontSize: 14,
      fontFamily: font.medium,
      color: t.text,
    },
    rowMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 2,
    },
    etaText: {
      fontSize: 12,
      fontFamily: font.regular,
      color: t.textSecondary,
    },
    delayText: {
      color: '#f97316',
    },
    rowRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
  })
}
