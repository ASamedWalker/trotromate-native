import { useState, useMemo } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
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
import { useSearchHistory } from '@/lib/hooks/useSearchHistory'
import { useSmartSuggestions } from '@/lib/hooks/useSmartSuggestions'
import { Sparkles, History } from 'lucide-react-native'

type Filter = 'all' | 'trotro' | 'okada' | 'popular' | 'saved'

export default function RoutesScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ from?: string; to?: string; transport?: string }>()
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const t = themed(isDark)
  const s = getStyles(isDark)

  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<Filter>(
    (params.transport as Filter) || 'all'
  )
  // Derive transport type from unified filter
  const activeTransport = activeFilter === 'trotro' || activeFilter === 'okada' ? activeFilter : undefined
  const { routes, isLoading, refetch } = useRoutes(params.from, params.to, activeTransport)
  useRefreshOnFocus([['routes', params.from, params.to, activeTransport]])
  const [refreshing, setRefreshing] = useState(false)
  const { favorites, isFavorite, toggleFavorite } = useFavorites()
  const { isAlerted, toggleAlert } = useRouteAlerts()
  const haptics = useHaptics()
  const { addSearch, getRecentSearches } = useSearchHistory()
  const { suggestions } = useSmartSuggestions()

  const recentSearches = getRecentSearches(5)
  const showSuggestions = !searchQuery && activeFilter === 'all' && !params.from && !params.to

  const filteredRoutes = useMemo(() => {
    let result = routes

    // Category filter
    if (activeFilter === 'popular') {
      result = result.filter((r) => r.is_popular)
    } else if (activeFilter === 'saved') {
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
  }, [routes, activeFilter, searchQuery, favorites])

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

  const filters: { key: Filter; label: string; icon: typeof Bus | null; color: string }[] = [
    { key: 'all', label: 'All', icon: null, color: c.amber500 },
    { key: 'trotro', label: 'Trotro', icon: Bus, color: c.amber500 },
    { key: 'okada', label: 'Okada', icon: Bike, color: c.orange500 },
    { key: 'popular', label: 'Popular', icon: null, color: c.amber500 },
    { key: 'saved', label: 'Saved', icon: Heart, color: c.red500 },
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
        onPress={() => {
          addSearch({ id: item.id, from: item.from_location, to: item.to_location, transportType: item.transport_type as 'trotro' | 'okada' | undefined })
          router.push({ pathname: '/routes/[id]', params: { id: item.id } })
        }}
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

        {/* Unified filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.filterChipRow}
          style={s.filterChipScroll}
        >
          {filters.map((filter) => {
            const active = activeFilter === filter.key
            const Icon = filter.icon
            return (
              <TouchableOpacity
                key={filter.key}
                onPress={() => { haptics.light(); setActiveFilter(filter.key) }}
                activeOpacity={0.7}
                style={[
                  s.filterChip,
                  active && { backgroundColor: filter.color },
                ]}
              >
                {Icon && (
                  <Icon
                    size={14}
                    color={active ? c.white : t.textSecondary}
                    fill={filter.key === 'saved' && active ? c.white : 'transparent'}
                  />
                )}
                <Text style={[
                  s.filterChipText,
                  active && s.filterChipTextActive,
                ]}>
                  {filter.label}
                </Text>
              </TouchableOpacity>
            )
          })}
        </ScrollView>

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
          ListHeaderComponent={showSuggestions ? (
            <View>
              {/* Smart Suggestions */}
              {suggestions.length > 0 && (
                <View style={s.suggestionsSection}>
                  <View style={s.sectionHeader}>
                    <Sparkles size={16} color={c.amber500} />
                    <Text style={s.sectionTitle}>Suggested for you</Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {suggestions.map((sg) => (
                      <TouchableOpacity
                        key={sg.routeId}
                        activeOpacity={0.7}
                        onPress={() => {
                          addSearch({ id: sg.routeId, from: sg.from, to: sg.to, transportType: sg.transportType })
                          router.push({ pathname: '/routes/[id]', params: { id: sg.routeId } })
                        }}
                        style={s.suggestionCard}
                      >
                        <Text style={s.suggestionRoute} numberOfLines={1}>{sg.from} → {sg.to}</Text>
                        <Text style={s.suggestionReason}>{sg.reason}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Recent Searches */}
              {recentSearches.length > 0 && (
                <View style={s.recentSection}>
                  <View style={s.sectionHeader}>
                    <History size={16} color={t.textSecondary} />
                    <Text style={s.sectionTitle}>Recent</Text>
                  </View>
                  {recentSearches.map((entry) => (
                    <TouchableOpacity
                      key={entry.routeId + entry.timestamp}
                      activeOpacity={0.7}
                      onPress={() => {
                        addSearch({ id: entry.routeId, from: entry.from, to: entry.to, transportType: entry.transportType })
                        router.push({ pathname: '/routes/[id]', params: { id: entry.routeId } })
                      }}
                      style={s.recentItem}
                    >
                      <Clock size={16} color={t.textSecondary} />
                      <Text style={s.recentText}>{entry.from} → {entry.to}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          ) : null}
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
                {activeFilter === 'saved' ? 'No saved routes' : 'No routes found'}
              </Text>
              <Text style={s.emptySubtitle}>
                {activeFilter === 'saved'
                  ? 'Tap the heart icon on any route to save it'
                  : 'Try a different search or filter'
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
    filterChipScroll: {
      marginTop: 16,
    },
    filterChipRow: {
      flexDirection: 'row' as const,
      gap: 8,
      paddingRight: 8,
    },
    filterChip: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      paddingHorizontal: 16,
      paddingVertical: 9,
      borderRadius: 20,
      backgroundColor: t.card,
      gap: 6,
    },
    filterChipText: {
      fontSize: 13,
      fontFamily: font.semibold,
      color: t.textSecondary,
    },
    filterChipTextActive: {
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
    // Suggestions & Recent
    suggestionsSection: { marginBottom: 16 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
    sectionTitle: { fontSize: 14, fontFamily: font.semibold, color: t.text },
    suggestionCard: {
      backgroundColor: isDark ? 'rgba(245,158,11,0.1)' : '#fffbeb',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(245,158,11,0.2)' : '#fde68a',
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 12,
      minWidth: 160,
    },
    suggestionRoute: { fontSize: 14, fontFamily: font.semibold, color: t.text },
    suggestionReason: { fontSize: 12, fontFamily: font.regular, color: c.amber500, marginTop: 4 },
    recentSection: { marginBottom: 16 },
    recentItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: t.card,
      marginBottom: 6,
    },
    recentText: { fontSize: 14, fontFamily: font.regular, color: t.text },
  })
}
