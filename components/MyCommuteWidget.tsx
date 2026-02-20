import { useMemo } from 'react'
import { View, Text, TouchableOpacity, useColorScheme } from 'react-native'
import { useRouter, type Href } from 'expo-router'
import { Navigation, ChevronRight, Bike, Sparkles } from 'lucide-react-native'
import { c, themed, font } from '@/lib/theme'
import { useSearchHistory } from '@/lib/hooks/useSearchHistory'

interface CommuteRoute {
  routeId: string
  from: string
  to: string
  transportType?: 'trotro' | 'okada'
  searchCount: number
}

export function MyCommuteWidget() {
  const router = useRouter()
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const t = themed(isDark)
  const { history } = useSearchHistory()

  const commuteRoutes = useMemo(() => {
    if (history.length === 0) return []

    const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000
    const recent = history.filter((h) => h.timestamp >= twoWeeksAgo)

    const counts = new Map<string, CommuteRoute>()
    for (const entry of recent) {
      const existing = counts.get(entry.routeId)
      if (existing) {
        existing.searchCount++
      } else {
        counts.set(entry.routeId, {
          routeId: entry.routeId,
          from: entry.from,
          to: entry.to,
          transportType: entry.transportType,
          searchCount: 1,
        })
      }
    }

    return Array.from(counts.values())
      .filter((r) => r.searchCount >= 3)
      .sort((a, b) => b.searchCount - a.searchCount)
      .slice(0, 2)
  }, [history])

  if (commuteRoutes.length === 0) return null

  return (
    <View style={{ paddingHorizontal: 20, marginTop: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Sparkles size={16} color={c.amber500} />
        <Text style={{ fontSize: 14, fontFamily: font.semibold, color: t.text }}>
          Your Commute
        </Text>
      </View>
      {commuteRoutes.map((route) => (
        <TouchableOpacity
          key={route.routeId}
          activeOpacity={0.8}
          onPress={() => router.push(`/routes/${route.routeId}` as Href)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            padding: 14,
            borderRadius: 16,
            backgroundColor: isDark ? 'rgba(245,158,11,0.08)' : '#fffbeb',
            borderWidth: 1,
            borderColor: isDark ? 'rgba(245,158,11,0.15)' : '#fde68a',
            marginBottom: 8,
          }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: route.transportType === 'okada' ? c.orange500 : c.amber500,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {route.transportType === 'okada' ? (
              <Bike size={20} color={c.white} />
            ) : (
              <Navigation size={20} color={c.white} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{ fontSize: 14, fontFamily: font.semibold, color: t.text }}
              numberOfLines={1}
            >
              {route.from} → {route.to}
            </Text>
            <Text style={{ fontSize: 12, fontFamily: font.regular, color: t.textSecondary, marginTop: 2 }}>
              Searched {route.searchCount} times recently
            </Text>
          </View>
          <ChevronRight size={16} color={c.amber400} />
        </TouchableOpacity>
      ))}
    </View>
  )
}
