import { useMemo } from 'react'
import { View, Text, TouchableOpacity, useColorScheme, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import {
  Sparkles,
  Navigation,
  TrainFront,
  TrendingUp,
  MapPin,
  ChevronRight,
  Palmtree,
} from 'lucide-react-native'
import { c, themed, font } from '@/lib/theme'
import { useSmartSuggestions } from '@/lib/hooks/useSmartSuggestions'
import { usePopularRoutes } from '@/lib/hooks/useRoutes'
import { getNextTrain, formatMinsLeft, type NextTrainInfo } from '@/lib/utils/train'
import { getGhanaTime } from '@/lib/utils/time'

type TimeContext = 'morning' | 'midday' | 'evening' | 'weekend'

const TITLES: Record<TimeContext, string> = {
  morning: 'Your Morning',
  midday: 'Right Now',
  evening: 'Your Evening',
  weekend: 'Weekend Vibes',
}

function getTimeContext(): TimeContext {
  const { hours, day } = getGhanaTime()
  if (day === 0 || day === 6) return 'weekend'
  if (hours >= 6 && hours < 9) return 'morning'
  if (hours >= 16 && hours < 19) return 'evening'
  return 'midday'
}

export function SmartCommuteCard() {
  const router = useRouter()
  const isDark = useColorScheme() === 'dark'
  const t = themed(isDark)
  const s = getStyles(isDark)

  const context = useMemo(() => getTimeContext(), [])
  const nextTrain = useMemo(() => getNextTrain(), [])
  const { suggestions } = useSmartSuggestions()
  const { routes: popularRoutes } = usePopularRoutes()

  const topSuggestion = suggestions[0]
  const topRoutes = (popularRoutes ?? []).slice(0, 3)

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Sparkles size={16} color={c.amber500} />
        <Text style={s.headerText}>{TITLES[context]}</Text>
      </View>

      {/* Commute suggestion — morning/evening */}
      {(context === 'morning' || context === 'evening') && topSuggestion && (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => router.push(`/routes/${topSuggestion.routeId}`)}
          style={s.suggestionRow}
        >
          <View style={[s.iconCircle, { backgroundColor: isDark ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.1)' }]}>
            <Navigation size={16} color={c.amber500} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.suggestionRoute} numberOfLines={1}>
              {topSuggestion.from} → {topSuggestion.to}
            </Text>
            <Text style={s.suggestionReason}>{topSuggestion.reason}</Text>
          </View>
          <ChevronRight size={16} color={t.textTertiary} />
        </TouchableOpacity>
      )}

      {/* Train info — morning/evening */}
      {(context === 'morning' || context === 'evening') && (
        <TrainRow nextTrain={nextTrain} isDark={isDark} onPress={() => router.push('/train')} />
      )}

      {/* Midday — popular routes */}
      {context === 'midday' && topRoutes.length > 0 && (
        <View style={{ gap: 8 }}>
          {topRoutes.map((route) => {
            const fare = route.fare_stats?.avg_reported_fare ?? route.official_fare
            return (
              <TouchableOpacity
                key={route.id}
                activeOpacity={0.7}
                onPress={() => router.push(`/routes/${route.id}`)}
                style={s.suggestionRow}
              >
                <View style={[s.iconCircle, { backgroundColor: isDark ? 'rgba(139,92,246,0.15)' : 'rgba(139,92,246,0.1)' }]}>
                  <TrendingUp size={14} color={c.violet500} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.suggestionRoute} numberOfLines={1}>
                    {route.from_location} → {route.to_location}
                  </Text>
                  <Text style={s.suggestionReason}>
                    ₵{fare.toFixed(2)} · {route.fare_stats?.report_count ?? 0} reports
                  </Text>
                </View>
                <ChevronRight size={16} color={t.textTertiary} />
              </TouchableOpacity>
            )
          })}
        </View>
      )}

      {/* Weekend — explore + saved routes */}
      {context === 'weekend' && (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => router.push('/(tabs)/routes')}
          style={s.suggestionRow}
        >
          <View style={[s.iconCircle, { backgroundColor: isDark ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.1)' }]}>
            <Palmtree size={16} color="#10b981" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.suggestionRoute}>Explore routes</Text>
            <Text style={s.suggestionReason}>Discover popular routes in your region</Text>
          </View>
          <ChevronRight size={16} color={t.textTertiary} />
        </TouchableOpacity>
      )}

      {/* No data fallback */}
      {(context === 'morning' || context === 'evening') && !topSuggestion && (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => router.push('/(tabs)/routes')}
          style={s.suggestionRow}
        >
          <View style={[s.iconCircle, { backgroundColor: isDark ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.1)' }]}>
            <MapPin size={16} color={c.amber500} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.suggestionRoute}>Search a route</Text>
            <Text style={s.suggestionReason}>Check fares & queue status</Text>
          </View>
          <ChevronRight size={16} color={t.textTertiary} />
        </TouchableOpacity>
      )}
    </View>
  )
}

function TrainRow({ nextTrain, isDark, onPress }: { nextTrain: NextTrainInfo; isDark: boolean; onPress: () => void }) {
  const t = themed(isDark)
  const s = getStyles(isDark)

  let label = ''
  let subtitle = ''
  const color = '#0ea5e9'

  switch (nextTrain.status) {
    case 'upcoming':
      label = `Train in ${formatMinsLeft(nextTrain.minsLeft)}`
      subtitle = `${nextTrain.from} → ${nextTrain.to} · ${nextTrain.time}`
      break
    case 'in-transit':
      label = 'Train in transit'
      subtitle = `${nextTrain.from} → ${nextTrain.to} · Arr. ${nextTrain.arrival}`
      break
    case 'done-today':
      label = 'No more trains today'
      subtitle = `Next: ${nextTrain.nextDay} ${nextTrain.nextTime}`
      break
    case 'no-service':
      label = 'No Sunday service'
      subtitle = `Next: ${nextTrain.nextDay} ${nextTrain.nextTime}`
      break
  }

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={s.suggestionRow}>
      <View style={[s.iconCircle, { backgroundColor: isDark ? 'rgba(14,165,233,0.15)' : 'rgba(14,165,233,0.1)' }]}>
        <TrainFront size={16} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.suggestionRoute}>{label}</Text>
        <Text style={s.suggestionReason}>{subtitle}</Text>
      </View>
      <ChevronRight size={16} color={t.textTertiary} />
    </TouchableOpacity>
  )
}

const getStyles = (isDark: boolean) => {
  const t = themed(isDark)
  return StyleSheet.create({
    container: {
      marginHorizontal: 20,
      marginTop: 16,
      padding: 16,
      borderRadius: 20,
      backgroundColor: t.card,
      borderWidth: isDark ? 0 : 1,
      borderColor: t.border,
      gap: 12,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    headerText: {
      fontSize: 16,
      fontFamily: font.semibold,
      color: t.text,
    },
    suggestionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 4,
    },
    iconCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    suggestionRoute: {
      fontSize: 14,
      fontFamily: font.semibold,
      color: t.text,
    },
    suggestionReason: {
      fontSize: 12,
      fontFamily: font.regular,
      color: t.textSecondary,
      marginTop: 1,
    },
  })
}
