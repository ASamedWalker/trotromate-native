import { useState, useCallback } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  FlatList,
  RefreshControl,
  useColorScheme,
  ActivityIndicator,
  StyleSheet,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, type Href } from 'expo-router'
import {
  Search,
  ChevronRight,
  DollarSign,
  Clock,
  TrainFront,
  TrendingUp,
  ArrowRight,
} from 'lucide-react-native'
import { c, themed, font, shadow } from '@/lib/theme'
import { GPRTUBadge } from '@/components/GPRTUBadge'
import { usePopularRoutes } from '@/lib/hooks/useRoutes'
import { useApp } from '@/lib/contexts/AppContext'
import { useRefreshOnFocus } from '@/lib/hooks/useRefreshOnFocus'
import { WeatherBadge } from '@/components/WeatherBadge'
import HappeningNow from '@/components/HappeningNow'
import { SmartCommuteCard } from '@/components/SmartCommuteCard'
import { MyCommutesRow } from '@/components/MyCommutesRow'
import ReportFAB from '@/components/ReportFAB'
import OfflineBanner from '@/components/OfflineBanner'
import InitialsAvatar from '@/components/InitialsAvatar'
import { getGhanaTime } from '@/lib/utils/time'
import type { RouteWithStats } from '@/lib/types'

/* ── Quick Actions (action-oriented) ─────────────────── */

const QUICK_ACTIONS = [
  { label: 'Check Fare', subtitle: 'Routes & Fares', icon: DollarSign, color: c.amber500, href: '/routes' },
  { label: 'Queue Status', subtitle: 'Live queues', icon: Clock, color: '#f97316', href: '/stations' },
  { label: 'Train Times', subtitle: 'Schedule', icon: TrainFront, color: '#0ea5e9', href: '/train' },
  { label: 'Report', subtitle: 'Earn pts', icon: TrendingUp, color: c.violet500, href: '/(tabs)/report' },
] as const

/* ── helpers ─────────────────────────────────────────── */

function getGreeting(): string {
  const { hours } = getGhanaTime()
  if (hours < 12) return 'Good morning'
  if (hours < 17) return 'Good afternoon'
  return 'Good evening'
}

/* ── component ───────────────────────────────────────── */

export default function HomeScreen() {
  const router = useRouter()
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const s = getStyles(isDark)

  const { profile, deviceId } = useApp()
  const { routes: popularRoutes, isLoading, refetch: refetchRoutes } = usePopularRoutes()
  useRefreshOnFocus([['routes', 'popular'], ['profile']])

  const [refreshing, setRefreshing] = useState(false)
  const greeting = getGreeting()

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refetchRoutes()
    setRefreshing(false)
  }, [refetchRoutes])

  const handleAddCommute = useCallback(() => {
    router.push('/routes')
  }, [router])

  const renderRouteCard = useCallback(({ item: route }: { item: RouteWithStats }) => {
    const displayMins = route.traffic?.duration_in_traffic_mins ?? route.estimated_duration_mins

    return (
      <TouchableOpacity
        key={route.id}
        onPress={() => router.push(`/routes/${route.id}` as Href)}
        activeOpacity={0.8}
        style={s.routeCard}
      >
        {/* From → To */}
        <Text style={s.routeCardFrom} numberOfLines={1}>{route.from_location}</Text>
        <View style={s.routeCardArrowRow}>
          <ArrowRight size={12} color={c.amber500} />
          <Text style={s.routeCardTo} numberOfLines={1}>{route.to_location}</Text>
        </View>

        {/* Fare */}
        <View style={s.routeCardBottom}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={s.routeCardFare}>₵{route.official_fare.toFixed(2)}</Text>
            {route.is_gprtu_verified && <GPRTUBadge size="small" />}
          </View>
          {displayMins != null && (
            <Text style={s.routeCardMeta}>{displayMins} min</Text>
          )}
        </View>
      </TouchableOpacity>
    )
  }, [isDark])

  return (
    <SafeAreaView style={s.container}>
      <OfflineBanner />
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={c.amber500}
            colors={[c.amber500]}
          />
        }
      >
        {/* ── LAYER 1: Above the fold ── */}

        {/* Header: Greeting + Weather + Avatar */}
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.greeting}>{greeting}</Text>
          </View>
          <WeatherBadge />
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/profile' as Href)}
            activeOpacity={0.7}
            style={{ marginLeft: 10 }}
          >
            <InitialsAvatar
              name={profile?.display_name ?? null}
              deviceId={deviceId ?? ''}
              size={40}
            />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <TouchableOpacity
          onPress={() => router.push('/routes')}
          activeOpacity={0.8}
          style={s.searchPill}
        >
          <Search size={20} color={c.amber500} />
          <Text style={s.searchText}>Where are you going?</Text>
        </TouchableOpacity>

        {/* My Commutes Row */}
        <MyCommutesRow onAddPress={handleAddCommute} />


        {/* Quick Actions (4 action-oriented) */}
        <View style={s.quickActionsRow}>
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon
            return (
              <TouchableOpacity
                key={action.label}
                onPress={() => router.push(action.href as Href)}
                activeOpacity={0.7}
                style={s.quickAction}
              >
                <View style={[s.quickActionIcon, { backgroundColor: action.color }]}>
                  <Icon size={20} color={c.white} />
                </View>
                <Text style={s.quickActionLabel}>{action.label}</Text>
                <Text style={s.quickActionSub}>{action.subtitle}</Text>
              </TouchableOpacity>
            )
          })}
        </View>

        {/* ── LAYER 2: Context cards ── */}

        {/* Live Near You — compact real-time strip */}
        <HappeningNow />

        {/* Smart Commute Card (time-aware) */}
        <SmartCommuteCard />

        {/* ── LAYER 3: Scroll to discover ── */}

        {/* Popular Routes */}
        <View style={[s.sectionHeader, { paddingHorizontal: 20, marginTop: 20 }]}>
          <Text style={s.sectionTitle}>Popular Routes</Text>
          <TouchableOpacity
            onPress={() => router.push('/routes')}
            style={{ flexDirection: 'row', alignItems: 'center' }}
          >
            <Text style={s.seeAll}>See all</Text>
            <ChevronRight size={16} color={c.amber500} />
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <ActivityIndicator size="small" color={c.amber500} style={{ marginVertical: 40 }} />
        ) : (
          <FlatList
            data={popularRoutes.slice(0, 8)}
            renderItem={renderRouteCard}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
            scrollEnabled
            nestedScrollEnabled
          />
        )}

        {/* Extra padding for absolute tab bar */}
        <View style={{ height: 90 }} />
      </ScrollView>
      <ReportFAB />
    </SafeAreaView>
  )
}

/* ── styles ──────────────────────────────────────────── */

const getStyles = (isDark: boolean) => {
  const t = themed(isDark)
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },

    // Header
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 4,
    },
    greeting: {
      fontSize: 24,
      fontFamily: font.bold,
      color: t.text,
    },

    // Search
    searchPill: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 20,
      marginTop: 16,
      marginBottom: 12,
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderRadius: 20,
      backgroundColor: t.card,
      borderWidth: 1,
      borderColor: t.border,
      gap: 14,
      ...shadow.cardStrong,
    },
    searchText: {
      fontSize: 16,
      fontFamily: font.medium,
      color: t.textSecondary,
    },

    // Quick Actions
    quickActionsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      marginTop: 16,
      marginBottom: 4,
    },
    quickAction: {
      alignItems: 'center',
      flex: 1,
    },
    quickActionIcon: {
      width: 48,
      height: 48,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 6,
    },
    quickActionLabel: {
      fontSize: 11,
      fontFamily: font.semibold,
      color: t.text,
      textAlign: 'center',
    },
    quickActionSub: {
      fontSize: 10,
      fontFamily: font.regular,
      color: t.textSecondary,
      textAlign: 'center',
      marginTop: 1,
    },

    // Section headers
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    sectionTitle: {
      fontSize: 18,
      fontFamily: font.bold,
      color: t.text,
    },
    seeAll: {
      color: c.amber500,
      fontFamily: font.medium,
      fontSize: 14,
    },

    // Popular route cards (horizontal scroll)
    routeCard: {
      width: 200,
      padding: 16,
      backgroundColor: t.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: t.border,
      justifyContent: 'space-between',
    },
    routeCardFrom: {
      fontSize: 15,
      fontFamily: font.semibold,
      color: t.text,
    },
    routeCardArrowRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 3,
    },
    routeCardTo: {
      fontSize: 13,
      fontFamily: font.regular,
      color: t.textSecondary,
      flexShrink: 1,
    },
    routeCardBottom: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      marginTop: 14,
    },
    routeCardFare: {
      fontSize: 22,
      fontFamily: font.bold,
      color: c.amber500,
    },
    routeCardMeta: {
      fontSize: 11,
      fontFamily: font.regular,
      color: t.textSecondary,
    },
  })
}
