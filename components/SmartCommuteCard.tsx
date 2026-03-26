import { useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, useColorScheme, StyleSheet, Animated } from 'react-native'
import { useRouter } from 'expo-router'
import {
  Sunrise,
  Sunset,
  Coffee,
  Palmtree,
  Moon,
  Navigation,
  TrainFront,
  TrendingUp,
  MapPin,
  ChevronRight,
} from 'lucide-react-native'
import { themed, font } from '@/lib/theme'
import { useSmartSuggestions } from '@/lib/hooks/useSmartSuggestions'
import { usePopularRoutes } from '@/lib/hooks/useRoutes'
import { getNextTrain, formatMinsLeft, type NextTrainInfo } from '@/lib/utils/train'
import { getGhanaTime } from '@/lib/utils/time'

type TimeContext = 'morning' | 'midday' | 'evening' | 'night' | 'weekend'

const CONTEXT_INFO: Record<TimeContext, {
  title: string
  subtitle: string
  icon: typeof Sunrise
  gradient: [string, string] // [bg, accent]
}> = {
  morning: {
    title: 'Morning Rush',
    subtitle: 'Roads dey hot — check your route',
    icon: Sunrise,
    gradient: ['#f59e0b', '#d97706'],
  },
  midday: {
    title: 'Afternoon Flow',
    subtitle: 'Which route dey trend now?',
    icon: Coffee,
    gradient: ['#8b5cf6', '#7c3aed'],
  },
  evening: {
    title: 'Closing Time',
    subtitle: 'Rush hour — time to bounce',
    icon: Sunset,
    gradient: ['#f97316', '#ea580c'],
  },
  night: {
    title: 'Night Moves',
    subtitle: 'Late links & tomorrow trains',
    icon: Moon,
    gradient: ['#6366f1', '#4f46e5'],
  },
  weekend: {
    title: 'Weekend Flex',
    subtitle: 'No rush — explore routes',
    icon: Palmtree,
    gradient: ['#10b981', '#059669'],
  },
}

function getTimeContext(): TimeContext {
  const { hours, day } = getGhanaTime()
  if (day === 0 || day === 6) return 'weekend'
  if (hours >= 5 && hours < 9) return 'morning'
  if (hours >= 9 && hours < 16) return 'midday'
  if (hours >= 16 && hours < 19) return 'evening'
  return 'night'
}

export function SmartCommuteCard() {
  const router = useRouter()
  const isDark = useColorScheme() === 'dark'
  const s = getStyles(isDark)

  const context = getTimeContext()
  const nextTrain = getNextTrain()
  const { suggestions } = useSmartSuggestions()
  const { routes: popularRoutes } = usePopularRoutes()

  const topSuggestion = suggestions[0]
  const topRoutes = (popularRoutes ?? []).slice(0, 2)
  const info = CONTEXT_INFO[context]
  const ContextIcon = info.icon

  // Entrance animation
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(16)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start()
  }, [fadeAnim, slideAnim])

  return (
    <Animated.View style={[s.wrapper, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      {/* Hero banner — gradient colored */}
      <View style={[s.banner, { backgroundColor: info.gradient[0] }]}>
        <View style={s.bannerContent}>
          <View style={s.bannerIconWrap}>
            <ContextIcon size={22} color="#fff" />
          </View>
          <View style={s.bannerText}>
            <Text style={s.bannerTitle}>{info.title}</Text>
            <Text style={s.bannerSubtitle}>{info.subtitle}</Text>
          </View>
        </View>
        {/* Decorative accent circle */}
        <View style={[s.accentCircle, { backgroundColor: info.gradient[1] }]} />
      </View>

      {/* Suggestion rows below banner */}
      <View style={s.suggestions}>
        {/* Commute suggestion — morning/evening */}
        {(context === 'morning' || context === 'evening') && topSuggestion && (
          <SuggestionRow
            icon={<Navigation size={14} color={info.gradient[0]} />}
            iconBg={`${info.gradient[0]}18`}
            label={`${topSuggestion.from} → ${topSuggestion.to}`}
            detail={topSuggestion.reason}
            onPress={() => router.push(`/routes/${topSuggestion.routeId}`)}
            isDark={isDark}
          />
        )}

        {/* Train info — morning/evening */}
        {(context === 'morning' || context === 'evening') && (
          <TrainRow nextTrain={nextTrain} isDark={isDark} onPress={() => router.push('/train')} />
        )}

        {/* Midday / Night — trending routes */}
        {(context === 'midday' || context === 'night') && topRoutes.length > 0 && (
          <>
            {topRoutes.map((route) => {
              const fare = route.fare_stats?.avg_reported_fare ?? route.official_fare
              return (
                <SuggestionRow
                  key={route.id}
                  icon={<TrendingUp size={13} color={info.gradient[0]} />}
                  iconBg={`${info.gradient[0]}18`}
                  label={`${route.from_location} → ${route.to_location}`}
                  detail={`₵${fare.toFixed(2)} · ${route.fare_stats?.report_count ?? 0} reports`}
                  onPress={() => router.push(`/routes/${route.id}`)}
                  isDark={isDark}
                />
              )
            })}
          </>
        )}

        {/* Weekend — explore */}
        {context === 'weekend' && (
          <SuggestionRow
            icon={<Palmtree size={14} color={info.gradient[0]} />}
            iconBg={`${info.gradient[0]}18`}
            label="Explore routes"
            detail="Discover popular routes in your region"
            onPress={() => router.push('/(tabs)/routes')}
            isDark={isDark}
          />
        )}

        {/* No data fallback */}
        {(context === 'morning' || context === 'evening') && !topSuggestion && (
          <SuggestionRow
            icon={<MapPin size={14} color={info.gradient[0]} />}
            iconBg={`${info.gradient[0]}18`}
            label="Search a route"
            detail="Check fares & queue status"
            onPress={() => router.push('/(tabs)/routes')}
            isDark={isDark}
          />
        )}
      </View>
    </Animated.View>
  )
}

/* ── Sub-components ────────────────────────────────── */

function SuggestionRow({ icon, iconBg, label, detail, onPress, isDark }: {
  icon: React.ReactNode
  iconBg: string
  label: string
  detail: string
  onPress: () => void
  isDark: boolean
}) {
  const t = themed(isDark)

  return (
    <TouchableOpacity activeOpacity={0.65} onPress={onPress} style={rowStyles.row}>
      <View style={[rowStyles.icon, { backgroundColor: iconBg }]}>
        {icon}
      </View>
      <View style={rowStyles.content}>
        <Text style={[rowStyles.label, { color: t.text }]} numberOfLines={1}>{label}</Text>
        <Text style={[rowStyles.detail, { color: t.textSecondary }]} numberOfLines={1}>{detail}</Text>
      </View>
      <ChevronRight size={14} color={t.textTertiary} />
    </TouchableOpacity>
  )
}

function TrainRow({ nextTrain, isDark, onPress }: { nextTrain: NextTrainInfo; isDark: boolean; onPress: () => void }) {
  let label = ''
  let detail = ''

  switch (nextTrain.status) {
    case 'upcoming':
      label = `Train in ${formatMinsLeft(nextTrain.minsLeft)}`
      detail = `${nextTrain.from} → ${nextTrain.to} · ${nextTrain.time}`
      break
    case 'in-transit':
      label = 'Train in transit'
      detail = `${nextTrain.from} → ${nextTrain.to} · Arr. ${nextTrain.arrival}`
      break
    case 'done-today':
      label = 'No more trains today'
      detail = `Next: ${nextTrain.nextDay} ${nextTrain.nextTime}`
      break
    case 'no-service':
      label = 'No Sunday service'
      detail = `Next: ${nextTrain.nextDay} ${nextTrain.nextTime}`
      break
  }

  return (
    <SuggestionRow
      icon={<TrainFront size={14} color="#0ea5e9" />}
      iconBg="rgba(14,165,233,0.12)"
      label={label}
      detail={detail}
      onPress={onPress}
      isDark={isDark}
    />
  )
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontFamily: font.semibold,
  },
  detail: {
    fontSize: 12,
    fontFamily: font.regular,
    marginTop: 1,
  },
})

/* ── Styles ────────────────────────────────────────── */

const getStyles = (isDark: boolean) => {
  const t = themed(isDark)
  return StyleSheet.create({
    wrapper: {
      marginHorizontal: 20,
      marginTop: 12,
      borderRadius: 20,
      overflow: 'hidden',
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
      borderWidth: isDark ? 0 : StyleSheet.hairlineWidth,
      borderColor: t.border,
    },

    // Hero gradient banner
    banner: {
      paddingHorizontal: 18,
      paddingVertical: 18,
      overflow: 'hidden',
    },
    bannerContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      zIndex: 1,
    },
    bannerIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: 'rgba(255,255,255,0.2)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    bannerText: {
      flex: 1,
    },
    bannerTitle: {
      fontSize: 20,
      fontFamily: font.bold,
      color: '#fff',
      letterSpacing: 0.3,
    },
    bannerSubtitle: {
      fontSize: 13,
      fontFamily: font.medium,
      color: 'rgba(255,255,255,0.85)',
      marginTop: 2,
    },
    accentCircle: {
      position: 'absolute',
      right: -20,
      top: -20,
      width: 80,
      height: 80,
      borderRadius: 40,
      opacity: 0.3,
    },

    // Suggestion rows below banner
    suggestions: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 2,
    },
  })
}
