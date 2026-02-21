import { useState, useEffect, useCallback, useMemo } from 'react'
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
  User,
  TrainFront,
  Zap,
  Flame,
  Bus,
  Bike,
  TrendingUp,
  Camera,
  Heart,
  Navigation,
  ArrowRight,
  Timer,
  Trophy,
  Map,
} from 'lucide-react-native'
import { c, themed, font } from '@/lib/theme'
import { usePopularRoutes } from '@/lib/hooks/useRoutes'
import { useApp } from '@/lib/contexts/AppContext'
import { useFavorites } from '@/lib/hooks/useFavorites'
import ReportFAB from '@/components/ReportFAB'
import OfflineBanner from '@/components/OfflineBanner'
import { TRAIN_SCHEDULES } from '@/lib/constants/train-schedule'
import { getGhanaTime } from '@/lib/utils/time'
import PromoBanner, { DEFAULT_PROMOS } from '@/components/PromoBanner'
import { useRefreshOnFocus } from '@/lib/hooks/useRefreshOnFocus'
import { MyCommuteWidget } from '@/components/MyCommuteWidget'
import { WeatherBadge, WeatherRainAlert } from '@/components/WeatherBadge'
import { supabase } from '@/lib/supabase/client'
import InitialsAvatar from '@/components/InitialsAvatar'
import FollowButton from '@/components/FollowButton'
import type { RouteWithStats, PublicProfile } from '@/lib/types'

/* ── Quick Actions ────────────────────────────────────── */

const QUICK_ACTIONS = [
  { label: 'Trotro', subtitle: 'Routes', icon: Bus, color: c.amber500, href: '/routes' },
  { label: 'Okada', subtitle: 'Fares', icon: Bike, color: c.orange500, href: '/routes?transport=okada' },
  { label: 'Train', subtitle: 'Schedule', icon: TrainFront, color: '#0ea5e9', href: '/train' },
  { label: 'Report', subtitle: 'Earn pts', icon: TrendingUp, color: c.violet500, href: '/(tabs)/report' },
  { label: 'Plan', subtitle: 'Multi-hop', icon: Map, color: '#10b981', href: '/routes/plan' },
] as const

/* ── helpers ─────────────────────────────────────────── */

function getGreeting(): string {
  const { hours } = getGhanaTime()
  if (hours < 12) return 'Good morning'
  if (hours < 17) return 'Good afternoon'
  return 'Good evening'
}

function parseTimeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

type NextTrainInfo =
  | { status: 'upcoming'; label: string; time: string; from: string; to: string; minsLeft: number }
  | { status: 'in-transit'; label: string; from: string; to: string; arrival: string }
  | { status: 'done-today'; nextDay: string; nextTime: string; from: string; to: string }
  | { status: 'no-service'; nextDay: string; nextTime: string; from: string; to: string }

function getNextTrain(): NextTrainInfo {
  const ghana = getGhanaTime()
  const schedules = TRAIN_SCHEDULES['TMA'] ?? []
  const firstSchedule = schedules[0]
  const firstStop = firstSchedule?.stops[0]
  const lastStop = firstSchedule?.stops[firstSchedule.stops.length - 1]
  const nextTime = firstStop?.depart ?? '06:00'
  const from = firstStop?.station ?? 'Community 1'
  const to = lastStop?.station ?? 'Accra Central'

  if (ghana.day === 0) {
    return { status: 'no-service', nextDay: 'Monday', nextTime, from, to }
  }

  const mins = ghana.hours * 60 + ghana.minutes

  for (const sch of schedules) {
    const fStop = sch.stops[0]
    const lStop = sch.stops[sch.stops.length - 1]
    const departMin = parseTimeToMinutes(fStop.depart ?? fStop.arrive ?? '00:00')
    const arriveMin = parseTimeToMinutes(lStop.arrive ?? lStop.depart ?? '23:59')

    if (mins < departMin) {
      return {
        status: 'upcoming',
        label: sch.label,
        time: fStop.depart ?? '',
        from: fStop.station,
        to: lStop.station,
        minsLeft: departMin - mins,
      }
    }

    if (mins >= departMin && mins <= arriveMin) {
      return {
        status: 'in-transit',
        label: sch.label,
        from: fStop.station,
        to: lStop.station,
        arrival: lStop.arrive ?? '',
      }
    }
  }

  const nextDay = ghana.day === 6 ? 'Monday' : 'tomorrow'
  return { status: 'done-today', nextDay, nextTime, from, to }
}

function formatMinsLeft(mins: number): string {
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

/* ── component ───────────────────────────────────────── */

export default function HomeScreen() {
  const router = useRouter()
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const s = getStyles(isDark)
  const t = themed(isDark)

  const { profile, deviceId } = useApp()
  const { routes: popularRoutes, isLoading, refetch: refetchRoutes } = usePopularRoutes()
  const { favorites } = useFavorites()
  useRefreshOnFocus([['routes', 'popular'], ['profile']])

  const [refreshing, setRefreshing] = useState(false)
  const [discoverUsers, setDiscoverUsers] = useState<PublicProfile[]>([])
  const greeting = getGreeting()
  const nextTrain = useMemo(() => getNextTrain(), [])

  // Fetch discover users
  useEffect(() => {
    if (!deviceId) return
    async function fetchDiscover() {
      try {
        // Get users the requester already follows
        const { data: existingFollows } = await supabase
          .from('follows')
          .select('following_device_id')
          .eq('follower_device_id', deviceId!)

        const followedIds = new Set(existingFollows?.map((f) => f.following_device_id) || [])

        // Get recently active users
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        const { data: activeTalers } = await supabase
          .from('tale_posts')
          .select('device_id')
          .gte('created_at', sevenDaysAgo)
          .eq('is_hidden', false)
          .neq('device_id', deviceId!)
          .order('created_at', { ascending: false })
          .limit(30)

        const activeIds = [...new Set((activeTalers || []).map((t) => t.device_id))]
          .filter((id) => !followedIds.has(id))
          .slice(0, 6)

        if (activeIds.length === 0) return

        const { data: profiles } = await supabase
          .from('contributor_profiles')
          .select('device_id, display_name, bio, avatar_url, current_level, total_points, total_reports, current_streak, follower_count, following_count, home_route_label, home_route_id, is_public')
          .in('device_id', activeIds)
          .eq('is_public', true)
          .order('total_points', { ascending: false })

        if (profiles && profiles.length > 0) {
          setDiscoverUsers(profiles.map((u) => ({ ...u, is_following: false })) as PublicProfile[])
        }
      } catch {
        // ignore
      }
    }
    fetchDiscover()
  }, [deviceId])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refetchRoutes()
    setRefreshing(false)
  }, [refetchRoutes])

  const levelName = profile?.current_level
    ? profile.current_level.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
    : null

  const renderRouteCard = useCallback(({ item: route }: { item: RouteWithStats }) => (
    <TouchableOpacity
      key={route.id}
      onPress={() => router.push(`/routes/${route.id}` as Href)}
      activeOpacity={0.8}
      style={s.routeCard}
    >
      <View style={s.routeCardIcon}>
        <Navigation size={14} color={c.amber500} />
      </View>
      <View style={s.routeCardNames}>
        <Text style={s.routeCardFrom} numberOfLines={1}>{route.from_location}</Text>
        <ArrowRight size={10} color={c.amber500} />
        <Text style={s.routeCardTo} numberOfLines={1}>{route.to_location}</Text>
      </View>
      <View style={s.routeCardMeta}>
        <Timer size={10} color={t.textSecondary} />
        <Text style={s.routeCardMetaText}>{route.estimated_duration_mins} min</Text>
      </View>
      <Text style={s.routeCardFare}>₵{route.official_fare.toFixed(2)}</Text>
    </TouchableOpacity>
  ), [isDark])

  const renderSavedRoute = useCallback(({ item }: { item: typeof favorites[0] }) => (
    <TouchableOpacity
      onPress={() => router.push(`/routes/${item.id}` as Href)}
      activeOpacity={0.8}
      style={s.savedChip}
    >
      <Heart size={12} color={c.red500} fill={c.red500} />
      <Text style={s.savedChipText} numberOfLines={1}>{item.from} → {item.to}</Text>
    </TouchableOpacity>
  ), [isDark])

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
        {/* ── Header ── */}
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.greeting}>{greeting}</Text>
            <View style={s.statsRow}>
              {profile ? (
                <>
                  <View style={s.statPill}>
                    <Zap size={12} color={c.amber500} />
                    <Text style={s.statText}>{profile.total_points} pts</Text>
                  </View>
                  {profile.current_streak > 0 && (
                    <View style={s.statPill}>
                      <Flame size={12} color="#ef4444" />
                      <Text style={s.statText}>{profile.current_streak} day streak</Text>
                    </View>
                  )}
                  {levelName && <Text style={s.levelText}>{levelName}</Text>}
                  <WeatherBadge />
                </>
              ) : (
                <Text style={s.levelText}>Start contributing to earn points</Text>
              )}
            </View>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/profile' as Href)}
            activeOpacity={0.7}
            style={s.avatar}
          >
            <User size={20} color={c.amber500} />
          </TouchableOpacity>
        </View>

        {/* ── Search Pill ── */}
        <TouchableOpacity
          onPress={() => router.push('/routes')}
          activeOpacity={0.8}
          style={s.searchPill}
        >
          <Search size={18} color={c.amber500} />
          <Text style={s.searchText}>Where are you going?</Text>
        </TouchableOpacity>

        {/* ── Rain Alert ── */}
        <WeatherRainAlert />

        {/* ── My Commute ── */}
        <MyCommuteWidget />

        {/* ── Quick Actions ── */}
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

        {/* ── Promo Banner ── */}
        <PromoBanner
          promos={DEFAULT_PROMOS}
          onPromoPress={(promo) => {
            if (promo.id === 'train') router.push('/train' as Href)
            else if (promo.id === 'tales') router.push('/(tabs)/tales' as Href)
            else if (promo.id === 'welcome') router.push('/(tabs)/report' as Href)
          }}
        />

        {/* ── Next Train Widget ── */}
        <TouchableOpacity
          onPress={() => router.push('/train' as Href)}
          activeOpacity={0.8}
          style={s.trainWidget}
        >
          <View style={s.trainWidgetIcon}>
            <TrainFront size={18} color={c.white} />
          </View>
          <View style={{ flex: 1 }}>
            {nextTrain.status === 'upcoming' ? (
              <>
                <Text style={s.trainWidgetTitle}>
                  Next train in {formatMinsLeft(nextTrain.minsLeft)}
                </Text>
                <Text style={s.trainWidgetSub}>
                  {nextTrain.from} → {nextTrain.to} · Departs {nextTrain.time}
                </Text>
              </>
            ) : nextTrain.status === 'in-transit' ? (
              <>
                <View style={s.transitRow}>
                  <Text style={s.trainWidgetTitle}>Train in transit</Text>
                  <View style={s.liveDot} />
                </View>
                <Text style={s.trainWidgetSub}>
                  {nextTrain.from} → {nextTrain.to} · Arrives {nextTrain.arrival}
                </Text>
              </>
            ) : nextTrain.status === 'no-service' ? (
              <>
                <Text style={s.trainWidgetTitle}>No service today</Text>
                <Text style={s.trainWidgetSub}>
                  {nextTrain.from} → {nextTrain.to} · Resumes {nextTrain.nextDay} {nextTrain.nextTime}
                </Text>
              </>
            ) : (
              <>
                <Text style={s.trainWidgetTitle}>
                  Next train {nextTrain.nextDay} at {nextTrain.nextTime}
                </Text>
                <Text style={s.trainWidgetSub}>
                  {nextTrain.from} → {nextTrain.to}
                </Text>
              </>
            )}
          </View>
          <ChevronRight size={16} color="#38bdf8" />
        </TouchableOpacity>

        {/* ── Popular Routes ── */}
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

        {/* ── Saved Routes ── */}
        {favorites.length > 0 && (
          <>
            <View style={[s.sectionHeader, { paddingHorizontal: 20, marginTop: 24 }]}>
              <Text style={s.sectionTitle}>Saved Routes</Text>
              <TouchableOpacity
                onPress={() => router.push('/routes?filter=saved' as Href)}
                style={{ flexDirection: 'row', alignItems: 'center' }}
              >
                <Text style={s.seeAll}>See all</Text>
                <ChevronRight size={16} color={c.amber500} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={favorites.slice(0, 6)}
              renderItem={renderSavedRoute}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}
              scrollEnabled
              nestedScrollEnabled
            />
          </>
        )}

        {/* ── Community ── */}
        <View style={[s.sectionHeader, { paddingHorizontal: 20, marginTop: 24 }]}>
          <Text style={s.sectionTitle}>Community</Text>
        </View>
        <View style={s.communityRow}>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/tales' as Href)}
            activeOpacity={0.8}
            style={[s.communityCard, s.communityTales]}
          >
            <Camera size={24} color={c.pink500} />
            <Text style={s.communityCardTitle}>Trotro Tales</Text>
            <Text style={s.communityCardSub}>Share your commute stories</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/profile' as Href)}
            activeOpacity={0.8}
            style={[s.communityCard, s.communityRewards]}
          >
            <Trophy size={24} color={c.violet500} />
            <Text style={s.communityCardTitle}>Rewards</Text>
            <Text style={s.communityCardSub}>Earn points & climb ranks</Text>
          </TouchableOpacity>
        </View>

        {/* ── People You May Know ── */}
        {discoverUsers.length > 0 && (
          <>
            <View style={[s.sectionHeader, { paddingHorizontal: 20, marginTop: 24 }]}>
              <Text style={s.sectionTitle}>People You May Know</Text>
            </View>
            <FlatList
              data={discoverUsers}
              keyExtractor={(item) => item.device_id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
              scrollEnabled
              nestedScrollEnabled
              renderItem={({ item }) => {
                const userNumber = item.device_id.slice(-4).toUpperCase()
                const name = item.display_name || `User-${userNumber}`
                return (
                  <TouchableOpacity
                    onPress={() => router.push(`/profile/${item.device_id}` as Href)}
                    activeOpacity={0.8}
                    style={s.discoverCard}
                  >
                    <InitialsAvatar name={name} size={48} />
                    <Text style={s.discoverName} numberOfLines={1}>{name}</Text>
                    <Text style={s.discoverLevel} numberOfLines={1}>
                      {item.current_level?.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) || 'Commuter'}
                    </Text>
                    <View style={{ marginTop: 8 }}>
                      <FollowButton
                        myDeviceId={deviceId}
                        targetDeviceId={item.device_id}
                        initialFollowing={false}
                        size="sm"
                      />
                    </View>
                  </TouchableOpacity>
                )
              }}
            />
          </>
        )}

        <View style={{ height: 40 }} />
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
    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      marginTop: 4,
      gap: 8,
    },
    statPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: isDark ? c.stone800 : c.stone100,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    statText: {
      fontSize: 12,
      fontFamily: font.semibold,
      color: t.text,
    },
    levelText: {
      fontSize: 12,
      fontFamily: font.medium,
      color: t.textSecondary,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: isDark ? c.stone800 : c.amber100,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 12,
    },

    // Search
    searchPill: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 20,
      marginTop: 16,
      marginBottom: 8,
      paddingHorizontal: 18,
      paddingVertical: 14,
      borderRadius: 16,
      backgroundColor: t.card,
      borderWidth: 1,
      borderColor: t.border,
      gap: 12,
    },
    searchText: {
      fontSize: 15,
      fontFamily: font.regular,
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
      width: 56,
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
      fontSize: 12,
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

    // Train widget
    trainWidget: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 20,
      marginTop: 12,
      padding: 14,
      borderRadius: 16,
      backgroundColor: isDark ? 'rgba(14,165,233,0.12)' : 'rgba(14,165,233,0.06)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(14,165,233,0.2)' : 'rgba(14,165,233,0.12)',
      gap: 12,
    },
    trainWidgetIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: '#0ea5e9',
      alignItems: 'center',
      justifyContent: 'center',
    },
    trainWidgetTitle: {
      fontSize: 14,
      fontFamily: font.semibold,
      color: t.text,
    },
    trainWidgetSub: {
      fontSize: 12,
      fontFamily: font.regular,
      color: t.textSecondary,
      marginTop: 1,
    },
    transitRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    liveDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#22c55e',
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
      width: 180,
      padding: 14,
      backgroundColor: t.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: t.border,
    },
    routeCardIcon: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: isDark ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.1)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    routeCardNames: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginBottom: 4,
    },
    routeCardFrom: {
      fontSize: 13,
      fontFamily: font.semibold,
      color: t.text,
      flexShrink: 1,
    },
    routeCardTo: {
      fontSize: 13,
      fontFamily: font.semibold,
      color: t.text,
      flexShrink: 1,
    },
    routeCardMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginBottom: 8,
    },
    routeCardMetaText: {
      fontSize: 11,
      fontFamily: font.regular,
      color: t.textSecondary,
    },
    routeCardFare: {
      fontSize: 20,
      fontFamily: font.bold,
      color: c.amber500,
    },

    // Saved route chips (horizontal scroll)
    savedChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: t.card,
      borderRadius: 100,
      borderWidth: 1,
      borderColor: t.border,
    },
    savedChipText: {
      fontSize: 13,
      fontFamily: font.medium,
      color: t.text,
      maxWidth: 160,
    },

    // Community cards
    communityRow: {
      flexDirection: 'row',
      paddingHorizontal: 20,
      gap: 12,
    },
    communityCard: {
      flex: 1,
      padding: 16,
      borderRadius: 16,
      borderWidth: 1,
    },
    communityTales: {
      backgroundColor: isDark ? 'rgba(236,72,153,0.08)' : 'rgba(236,72,153,0.05)',
      borderColor: isDark ? 'rgba(236,72,153,0.2)' : 'rgba(236,72,153,0.12)',
    },
    communityRewards: {
      backgroundColor: isDark ? 'rgba(139,92,246,0.08)' : 'rgba(139,92,246,0.05)',
      borderColor: isDark ? 'rgba(139,92,246,0.2)' : 'rgba(139,92,246,0.12)',
    },
    communityCardTitle: {
      fontSize: 15,
      fontFamily: font.bold,
      color: t.text,
      marginTop: 10,
    },
    communityCardSub: {
      fontSize: 12,
      fontFamily: font.regular,
      color: t.textSecondary,
      marginTop: 2,
    },

    // Discover user cards
    discoverCard: {
      width: 130,
      padding: 16,
      borderRadius: 16,
      backgroundColor: t.card,
      borderWidth: 1,
      borderColor: t.border,
      alignItems: 'center',
    },
    discoverName: {
      fontSize: 13,
      fontFamily: font.semibold,
      color: t.text,
      marginTop: 8,
      textAlign: 'center',
      width: '100%',
    },
    discoverLevel: {
      fontSize: 11,
      fontFamily: font.regular,
      color: t.textSecondary,
      textAlign: 'center',
      marginTop: 2,
      width: '100%',
    },
  })
}
