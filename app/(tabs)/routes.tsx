import { useState, useMemo } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  useColorScheme,
  RefreshControl,
  StyleSheet,
  Share,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import {
  Search,
  MapPin,
  Clock,
  Heart,
  ChevronLeft,
  Bell,
  BellOff,
  Share2,
  X,
  Bike,
  Bus,
} from 'lucide-react-native'
import { c, themed, font } from '@/lib/theme'
import { useRoutes } from '@/lib/hooks/useRoutes'
import { useFavorites } from '@/lib/hooks/useFavorites'
import { timeAgo } from '@/lib/utils/time'
import type { RouteWithStats, TransportType } from '@/lib/types'
import { SkeletonRouteCard } from '@/components/Skeleton'
import { useHaptics } from '@/lib/hooks/useHaptics'
import { useRefreshOnFocus } from '@/lib/hooks/useRefreshOnFocus'
import { useRouteAlerts } from '@/lib/hooks/useRouteAlerts'

type Tab = 'all' | 'popular' | 'saved'

export default function RoutesScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ from?: string; to?: string; transport?: string }>()
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const t = themed(isDark)
  const s = getStyles(isDark)

  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('all')
  const [transportFilter, setTransportFilter] = useState<TransportType | 'all'>(
    (params.transport as TransportType) || 'all'
  )
  const activeTransport = transportFilter === 'all' ? undefined : transportFilter
  const { routes, isLoading, refetch } = useRoutes(params.from, params.to, activeTransport)
  useRefreshOnFocus([['routes', params.from, params.to, activeTransport]])
  const [refreshing, setRefreshing] = useState(false)
  const { favorites, isFavorite, toggleFavorite } = useFavorites()
  const { isAlerted, toggleAlert } = useRouteAlerts()
  const haptics = useHaptics()

  const filteredRoutes = useMemo(() => {
    let result = routes

    // Tab filter
    if (activeTab === 'popular') {
      result = result.filter((r) => r.is_popular)
    } else if (activeTab === 'saved') {
      const favIds = new Set(favorites.map((f) => f.id))
      result = result.filter((r) => favIds.has(r.id))
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(
        (r) =>
          r.from_location.toLowerCase().includes(query) ||
          r.to_location.toLowerCase().includes(query)
      )
    }

    return result
  }, [routes, activeTab, searchQuery, favorites])

  const handleShare = async (route: RouteWithStats) => {
    haptics.light()
    try {
      const fare = route.fare_stats?.avg_reported_fare ?? route.official_fare
      await Share.share({
        message: `Check the fare from ${route.from_location} to ${route.to_location} - ₵${fare.toFixed(2)} on Troski! 🚐`,
      })
    } catch {
      // User cancelled share
    }
  }

  const handleAlert = (route: RouteWithStats) => {
    haptics.light()
    const alerted = isAlerted(route.id)
    toggleAlert(route.id)
    if (!alerted) {
      Alert.alert(
        'Fare Alert On',
        `You'll be notified when the fare for ${route.from_location} → ${route.to_location} changes.`,
        [{ text: 'OK' }]
      )
    }
  }

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'all', label: 'All', count: routes.length },
    { key: 'popular', label: 'Popular', count: routes.filter((r) => r.is_popular).length },
    { key: 'saved', label: 'Saved', count: favorites.length },
  ]

  const renderRoute = ({ item }: { item: RouteWithStats }) => {
    const fav = isFavorite(item.id)
    const alerted = isAlerted(item.id)
    const displayFare = item.fare_stats?.avg_reported_fare ?? item.official_fare
    const reportCount = item.fare_stats?.report_count ?? 0
    const lastUpdated = timeAgo(item.fare_stats?.last_report_at ?? null)

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => router.push({ pathname: '/routes/[id]', params: { id: item.id } })}
        style={s.routeCard}
      >
        <View style={[s.routeIcon, item.transport_type === 'okada' && s.routeIconOkada]}>
          {item.transport_type === 'okada' ? (
            <Bike size={24} color={c.orange500} />
          ) : (
            <MapPin size={24} color={c.amber500} />
          )}
        </View>

        <View style={s.routeInfo}>
          <Text style={s.routeName} numberOfLines={1}>
            {item.from_location} → {item.to_location}
          </Text>
          <View style={s.routeMeta}>
            <Clock size={12} color={t.textSecondary} />
            <Text style={s.routeMetaText}>{lastUpdated}</Text>
            <Text style={[s.routeMetaText, { marginLeft: 12 }]}>
              {reportCount} reports
            </Text>
          </View>
        </View>

        <View style={s.routeRight}>
          <Text style={s.routeFare}>₵{displayFare.toFixed(2)}</Text>
          <View style={s.actionRow}>
            <TouchableOpacity
              onPress={() => handleAlert(item)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {alerted ? (
                <Bell size={16} color={c.amber500} fill={c.amber500} />
              ) : (
                <BellOff size={16} color={t.textTertiary} />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleShare(item)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Share2 size={16} color={t.textTertiary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                haptics.light()
                toggleFavorite({ id: item.id, from: item.from_location, to: item.to_location })
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Heart
                size={16}
                color={fav ? c.red500 : t.textTertiary}
                fill={fav ? c.red500 : 'transparent'}
              />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <SafeAreaView style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.headerRow}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={{ padding: 4 }}>
            <ChevronLeft size={24} color={t.text} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Routes</Text>
          <View style={{ width: 32 }} />
        </View>

        <View style={s.searchBox}>
          <Search size={20} color={t.textSecondary} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search routes..."
            placeholderTextColor={t.textSecondary}
            style={s.searchInput}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={18} color={t.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Tabs */}
        <View style={s.tabRow}>
          {tabs.map((tab) => {
            const active = activeTab === tab.key
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => { haptics.light(); setActiveTab(tab.key) }}
                activeOpacity={0.7}
                style={[s.tab, active && s.tabActive]}
              >
                <Text style={[s.tabLabel, active && s.tabLabelActive]}>
                  {tab.label}
                </Text>
                {tab.count !== undefined && tab.count > 0 && (
                  <View style={[s.tabBadge, active && s.tabBadgeActive]}>
                    <Text style={[s.tabBadgeText, active && s.tabBadgeTextActive]}>
                      {tab.count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            )
          })}
        </View>

        {/* Transport type filter */}
        <View style={s.transportRow}>
          {([
            { key: 'all', label: 'All', icon: null },
            { key: 'trotro', label: 'Trotro', icon: Bus },
            { key: 'okada', label: 'Okada', icon: Bike },
          ] as const).map((item) => {
            const active = transportFilter === item.key
            const isOkada = item.key === 'okada'
            return (
              <TouchableOpacity
                key={item.key}
                onPress={() => { haptics.light(); setTransportFilter(item.key) }}
                activeOpacity={0.7}
                style={[
                  s.transportPill,
                  active && (isOkada ? s.transportPillOkada : s.transportPillActive),
                ]}
              >
                {item.icon && (
                  <item.icon
                    size={14}
                    color={active ? c.white : t.textSecondary}
                  />
                )}
                <Text style={[
                  s.transportPillText,
                  active && s.transportPillTextActive,
                ]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>

        {(params.from || params.to) && (
          <View style={s.filterRow}>
            <MapPin size={14} color={c.amber500} />
            <Text style={s.filterText}>
              Showing: {params.from || 'Any'} → {params.to || 'Any'}
            </Text>
          </View>
        )}
      </View>

      {isLoading ? (
        <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
          <SkeletonRouteCard isDark={isDark} />
          <SkeletonRouteCard isDark={isDark} />
          <SkeletonRouteCard isDark={isDark} />
          <SkeletonRouteCard isDark={isDark} />
        </View>
      ) : (
        <FlatList
          data={filteredRoutes}
          renderItem={renderRoute}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => { setRefreshing(true); await refetch(); setRefreshing(false) }}
              tintColor={c.amber500}
              colors={[c.amber500]}
            />
          }
          ListEmptyComponent={
            <View style={s.emptyContainer}>
              <MapPin size={48} color={t.textTertiary} />
              <Text style={s.emptyTitle}>
                {activeTab === 'saved' ? 'No saved routes' : 'No routes found'}
              </Text>
              <Text style={s.emptySubtitle}>
                {activeTab === 'saved'
                  ? 'Tap the heart icon on any route to save it'
                  : 'Try a different search'
                }
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  )
}

const getStyles = (isDark: boolean) => {
  const t = themed(isDark)
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    headerTitle: { fontSize: 24, fontFamily: font.bold, color: t.text },
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: t.card,
    },
    searchInput: { flex: 1, marginLeft: 12, fontSize: 16, color: t.text, fontFamily: font.regular },
    tabRow: {
      flexDirection: 'row',
      marginTop: 16,
      gap: 8,
    },
    tab: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: t.card,
      gap: 6,
    },
    tabActive: {
      backgroundColor: c.amber500,
    },
    tabLabel: {
      fontSize: 14,
      fontFamily: font.semibold,
      color: t.textSecondary,
    },
    tabLabelActive: {
      color: c.white,
    },
    tabBadge: {
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
    },
    tabBadgeActive: {
      backgroundColor: 'rgba(255,255,255,0.25)',
    },
    tabBadgeText: {
      fontSize: 11,
      fontFamily: font.bold,
      color: t.textSecondary,
    },
    tabBadgeTextActive: {
      color: c.white,
    },
    transportRow: {
      flexDirection: 'row' as const,
      marginTop: 12,
      gap: 6,
    },
    transportPill: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: t.card,
      gap: 4,
    },
    transportPillActive: {
      backgroundColor: c.amber500,
    },
    transportPillOkada: {
      backgroundColor: c.orange500,
    },
    transportPillText: {
      fontSize: 12,
      fontFamily: font.semibold,
      color: t.textSecondary,
    },
    transportPillTextActive: {
      color: c.white,
    },
    filterRow: { flexDirection: 'row' as const, alignItems: 'center' as const, marginTop: 12 },
    filterText: { fontSize: 14, marginLeft: 4, color: t.textSecondary },
    routeCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderRadius: 16,
      marginBottom: 12,
      backgroundColor: t.card,
    },
    routeIcon: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: c.amber100,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      marginRight: 12,
    },
    routeIconOkada: {
      backgroundColor: isDark ? 'rgba(249,115,22,0.15)' : '#fff7ed',
    },
    routeInfo: { flex: 1 },
    routeName: { fontFamily: font.semibold, fontSize: 15, color: t.text },
    routeMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    routeMetaText: { fontSize: 12, marginLeft: 4, color: t.textSecondary },
    routeRight: { alignItems: 'flex-end', marginLeft: 8 },
    routeFare: { color: c.amber500, fontFamily: font.bold, fontSize: 18 },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 8,
      gap: 12,
    },
    emptyContainer: { alignItems: 'center', paddingVertical: 48 },
    emptyTitle: { fontSize: 18, fontFamily: font.semibold, marginTop: 16, color: t.textSecondary },
    emptySubtitle: { fontSize: 14, marginTop: 4, color: t.textTertiary },
  })
}
