import { useEffect, useRef } from 'react'
import {
  View,
  Text,
  Animated,
  StyleSheet,
} from 'react-native'
import { TouchableOpacity } from 'react-native-gesture-handler'
import { Navigation, Zap, TrendingUp, Users } from 'lucide-react-native'
import { useRouter } from 'expo-router'
import { c, themed, font } from '@/lib/theme'
import type { RouteWithStats } from '@/lib/types'
import { GPRTUBadge } from '@/components/GPRTUBadge'

const CARD_HEIGHT = 72
const CARD_GAP = 10
const ITEM_HEIGHT = CARD_HEIGHT + CARD_GAP
const VISIBLE_HEIGHT = 210
const SCROLL_SPEED_PER_ITEM = 4000 // 4 seconds per route

interface Props {
  routes: RouteWithStats[]
  isDark: boolean
  visibleHeight?: number
}

const BADGES: { label: string; icon: typeof Zap; color: string }[] = [
  { label: 'Fast', icon: Zap, color: '#8b5cf6' },
  { label: 'Hot', icon: TrendingUp, color: '#10b981' },
  { label: 'Busy', icon: Users, color: '#f97316' },
]

export default function PopularRoutesScroller({ routes, isDark, visibleHeight = VISIBLE_HEIGHT }: Props) {
  const router = useRouter()
  const s = getStyles(isDark, visibleHeight)

  // Double the routes for seamless loop
  const displayRoutes = [...routes, ...routes]
  const totalHeight = routes.length * ITEM_HEIGHT
  const animDuration = routes.length * SCROLL_SPEED_PER_ITEM

  const translateY = useRef(new Animated.Value(0)).current
  const animRef = useRef<Animated.CompositeAnimation | null>(null)

  useEffect(() => {
    if (routes.length < 2) return

    translateY.setValue(0)
    animRef.current = Animated.loop(
      Animated.timing(translateY, {
        toValue: -totalHeight,
        duration: animDuration,
        useNativeDriver: true,
        isInteraction: false,
      })
    )
    animRef.current.start()

    return () => animRef.current?.stop()
  }, [routes.length, totalHeight, animDuration])

  if (routes.length === 0) return null

  // If only 1 route, no scroll needed
  if (routes.length === 1) {
    const route = routes[0]
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => router.push({ pathname: '/routes/[id]', params: { id: route.id } })}
        style={s.card}
      >
        <RouteCardContent route={route} index={0} isDark={isDark} />
      </TouchableOpacity>
    )
  }

  return (
    <View style={s.container}>
      <Animated.View style={{ transform: [{ translateY }] }}>
        {displayRoutes.map((route, index) => (
          <TouchableOpacity
            key={`${route.id}-${index}`}
            activeOpacity={0.7}
            onPress={() => router.push({ pathname: '/routes/[id]', params: { id: route.id } })}
            style={s.card}
          >
            <RouteCardContent route={route} index={index % routes.length} isDark={isDark} />
          </TouchableOpacity>
        ))}
      </Animated.View>
    </View>
  )
}

function RouteCardContent({
  route,
  index,
  isDark,
}: {
  route: RouteWithStats
  index: number
  isDark: boolean
}) {
  const t = themed(isDark)
  const badge = index < 3 ? BADGES[index] : null
  const BadgeIcon = badge?.icon ?? Zap
  const fare = route.fare_stats?.avg_reported_fare ?? route.official_fare

  return (
    <View style={cardStyles.row}>
      {/* Icon with live dot */}
      <View style={cardStyles.iconWrap}>
        <Navigation size={20} color={c.amber500} />
        <View style={cardStyles.liveDot} />
      </View>

      {/* Route info */}
      <View style={{ flex: 1 }}>
        <Text style={[cardStyles.routeName, { color: t.text }]} numberOfLines={1}>
          {route.from_location} → {route.to_location}
        </Text>
        <View style={cardStyles.metaRow}>
          {route.estimated_duration_mins ? (
            <Text style={[cardStyles.duration, { color: t.textSecondary }]}>
              ~{route.estimated_duration_mins} min
            </Text>
          ) : (
            <Text style={[cardStyles.duration, { color: t.textSecondary }]}>
              {route.fare_stats?.report_count ?? 0} reports
            </Text>
          )}
          {badge && (
            <View style={[cardStyles.badge, { backgroundColor: `${badge.color}18` }]}>
              <BadgeIcon size={10} color={badge.color} />
              <Text style={[cardStyles.badgeText, { color: badge.color }]}>{badge.label}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Fare */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        {route.is_gprtu_verified && <GPRTUBadge size="small" />}
        <Text style={cardStyles.fare}>₵{fare.toFixed(2)}</Text>
      </View>
    </View>
  )
}

const cardStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  iconWrap: { width: 42, height: 42, borderRadius: 12, backgroundColor: c.amber100, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  liveDot: { position: 'absolute', top: 2, right: 2, width: 8, height: 8, borderRadius: 4, backgroundColor: c.emerald500, borderWidth: 1.5, borderColor: c.white },
  routeName: { fontFamily: font.semibold, fontSize: 15 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3, gap: 8 },
  duration: { fontSize: 12 },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, gap: 3 },
  badgeText: { fontSize: 10, fontFamily: font.bold },
  fare: { color: c.amber500, fontFamily: font.bold, fontSize: 17, marginLeft: 8 },
})

const getStyles = (isDark: boolean, height: number = VISIBLE_HEIGHT) => {
  const t = themed(isDark)
  return StyleSheet.create({
    container: {
      height,
      overflow: 'hidden',
      marginBottom: 0,
    },
    card: {
      height: CARD_HEIGHT,
      marginBottom: CARD_GAP,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 16,
      backgroundColor: t.card,
    },
  })
}
