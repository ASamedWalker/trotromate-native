import { useState, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  useColorScheme,
  ActivityIndicator,
  StyleSheet,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import {
  Search,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  User,
  TrainFront,
  MapPin,
  Clock,
  Flame,
  Zap,
} from 'lucide-react-native'
import { c, themed, font } from '@/lib/theme'
import { usePopularRoutes } from '@/lib/hooks/useRoutes'
import { useApp } from '@/lib/contexts/AppContext'
import PopularRoutesScroller from '@/components/PopularRoutesScroller'
import ReportFAB from '@/components/ReportFAB'
import OfflineBanner from '@/components/OfflineBanner'
import { TRAIN_SCHEDULES } from '@/lib/constants/train-schedule'
import { getGhanaTime } from '@/lib/utils/time'
import PromoBanner, { DEFAULT_PROMOS } from '@/components/PromoBanner'

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
  | { status: 'done' }

function getNextTrain(): NextTrainInfo {
  const ghana = getGhanaTime()
  if (ghana.day === 0) return { status: 'done' }

  const mins = ghana.hours * 60 + ghana.minutes
  const schedules = TRAIN_SCHEDULES['TMA'] ?? []

  for (const sch of schedules) {
    const firstStop = sch.stops[0]
    const lastStop = sch.stops[sch.stops.length - 1]
    const departMin = parseTimeToMinutes(firstStop.depart ?? firstStop.arrive ?? '00:00')
    const arriveMin = parseTimeToMinutes(lastStop.arrive ?? lastStop.depart ?? '23:59')

    if (mins < departMin) {
      return {
        status: 'upcoming',
        label: sch.label,
        time: firstStop.depart ?? '',
        from: firstStop.station,
        to: lastStop.station,
        minsLeft: departMin - mins,
      }
    }

    if (mins >= departMin && mins <= arriveMin) {
      return {
        status: 'in-transit',
        label: sch.label,
        from: firstStop.station,
        to: lastStop.station,
        arrival: lastStop.arrive ?? '',
      }
    }
  }

  return { status: 'done' }
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

  const { profile } = useApp()
  const { routes: popularRoutes, isLoading, refetch: refetchRoutes } = usePopularRoutes()

  const [refreshing, setRefreshing] = useState(false)
  const [exploreOpen, setExploreOpen] = useState(true)
  const greeting = useMemo(() => getGreeting(), [])
  const nextTrain = useMemo(() => getNextTrain(), [])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refetchRoutes()
    setRefreshing(false)
  }, [refetchRoutes])

  const levelName = profile?.current_level
    ? profile.current_level.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
    : null

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
                </>
              ) : (
                <Text style={s.levelText}>Start contributing to earn points</Text>
              )}
            </View>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/profile' as any)}
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

        {/* ── Promo Banner ── */}
        <PromoBanner
          promos={DEFAULT_PROMOS}
          onPromoPress={(promo) => {
            if (promo.id === 'train') router.push('/train' as any)
            else if (promo.id === 'tales') router.push('/(tabs)/tales' as any)
            else if (promo.id === 'welcome') router.push('/(tabs)/report' as any)
          }}
        />

        {/* ── Next Train Widget ── */}
        {nextTrain.status !== 'done' && (
          <TouchableOpacity
            onPress={() => router.push('/train' as any)}
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
              ) : (
                <>
                  <View style={s.transitRow}>
                    <Text style={s.trainWidgetTitle}>Train in transit</Text>
                    <View style={s.liveDot} />
                  </View>
                  <Text style={s.trainWidgetSub}>
                    {nextTrain.from} → {nextTrain.to} · Arrives {nextTrain.arrival}
                  </Text>
                </>
              )}
            </View>
            <ChevronRight size={16} color="#38bdf8" />
          </TouchableOpacity>
        )}

        <View style={s.content}>
          {/* ── Popular Routes ── */}
          <View style={s.sectionHeader}>
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
            <PopularRoutesScroller routes={popularRoutes} isDark={isDark} visibleHeight={exploreOpen ? 210 : 400} />
          )}

          {/* ── Explore ── */}
          <TouchableOpacity
            onPress={() => setExploreOpen((v) => !v)}
            activeOpacity={0.7}
            style={[s.sectionHeader, { marginTop: 24 }]}
          >
            <Text style={s.sectionTitle}>Explore</Text>
            {exploreOpen ? (
              <ChevronUp size={20} color={c.amber500} />
            ) : (
              <ChevronDown size={20} color={c.amber500} />
            )}
          </TouchableOpacity>

          {exploreOpen && <View style={s.exploreRow}>
            <TouchableOpacity
              onPress={() => router.push('/train' as any)}
              activeOpacity={0.8}
              style={s.exploreCard}
            >
              <View style={[s.exploreIcon, { backgroundColor: '#0ea5e9' }]}>
                <TrainFront size={20} color={c.white} />
              </View>
              <Text style={s.exploreTitle}>Train Lines</Text>
              <Text style={s.exploreSub}>Live schedules</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push('/routes')}
              activeOpacity={0.8}
              style={s.exploreCard}
            >
              <View style={[s.exploreIcon, { backgroundColor: c.amber500 }]}>
                <MapPin size={20} color={c.white} />
              </View>
              <Text style={s.exploreTitle}>Trotro Routes</Text>
              <Text style={s.exploreSub}>Browse & search</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push('/(tabs)/report' as any)}
              activeOpacity={0.8}
              style={s.exploreCard}
            >
              <View style={[s.exploreIcon, { backgroundColor: c.violet500 }]}>
                <Clock size={20} color={c.white} />
              </View>
              <Text style={s.exploreTitle}>Report</Text>
              <Text style={s.exploreSub}>Earn points</Text>
            </TouchableOpacity>
          </View>}

          <View style={{ height: 40 }} />
        </View>
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

    // Content
    content: { paddingHorizontal: 20, paddingTop: 20 },

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

    // Explore
    exploreRow: {
      flexDirection: 'row',
      gap: 10,
    },
    exploreCard: {
      flex: 1,
      backgroundColor: t.card,
      borderRadius: 16,
      paddingVertical: 12,
      paddingHorizontal: 10,
      borderWidth: 1,
      borderColor: t.border,
      alignItems: 'center',
    },
    exploreIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    exploreTitle: {
      fontSize: 13,
      fontFamily: font.semibold,
      color: t.text,
      textAlign: 'center',
    },
    exploreSub: {
      fontSize: 11,
      fontFamily: font.regular,
      color: t.textSecondary,
      marginTop: 2,
      textAlign: 'center',
    },
  })
}
