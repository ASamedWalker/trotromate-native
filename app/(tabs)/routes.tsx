import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  useColorScheme,
  RefreshControl,
  StyleSheet,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Search, MapPin, TrendingUp, Clock, Heart, ChevronLeft } from 'lucide-react-native'
import { c, themed, font } from '@/lib/theme'
import { useRoutes } from '@/lib/hooks/useRoutes'
import { useFavorites } from '@/lib/hooks/useFavorites'
import { timeAgo } from '@/lib/utils/time'
import type { RouteWithStats } from '@/lib/types'
import { SkeletonRouteCard } from '@/components/Skeleton'
import { useHaptics } from '@/lib/hooks/useHaptics'

export default function RoutesScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ from?: string; to?: string }>()
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const t = themed(isDark)
  const s = styles(isDark)

  const [searchQuery, setSearchQuery] = useState('')
  const { routes, isLoading, refetch } = useRoutes(params.from, params.to)
  const [refreshing, setRefreshing] = useState(false)
  const { isFavorite, toggleFavorite } = useFavorites()
  const haptics = useHaptics()

  const filteredRoutes = routes.filter((route) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      route.from_location.toLowerCase().includes(query) ||
      route.to_location.toLowerCase().includes(query)
    )
  })

  const renderRoute = ({ item }: { item: RouteWithStats }) => {
    const fav = isFavorite(item.id)
    const displayFare = item.fare_stats?.avg_reported_fare ?? item.official_fare
    const reportCount = item.fare_stats?.report_count ?? 0
    const lastUpdated = timeAgo(item.fare_stats?.last_report_at ?? null)

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => router.push({ pathname: '/routes/[id]', params: { id: item.id } })}
        style={s.routeCard}
      >
        <View style={s.routeIcon}>
          <MapPin size={24} color={c.amber500} />
        </View>

        <View style={s.routeInfo}>
          <Text style={s.routeName}>
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
          <TouchableOpacity
            onPress={() => { haptics.light(); toggleFavorite({ id: item.id, from: item.from_location, to: item.to_location }) }}
            style={{ marginTop: 4 }}
          >
            <Heart
              size={18}
              color={fav ? c.red500 : t.textTertiary}
              fill={fav ? c.red500 : 'transparent'}
            />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <SafeAreaView style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={{ marginRight: 8, padding: 4 }}>
            <ChevronLeft size={24} color={t.text} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { marginBottom: 0 }]}>Routes</Text>
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
        </View>

        {(params.from || params.to) && (
          <View style={s.filterRow}>
            <TrendingUp size={14} color={c.amber500} />
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
              <Text style={s.emptyTitle}>No routes found</Text>
              <Text style={s.emptySubtitle}>Try a different search</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  )
}

const styles = (isDark: boolean) => {
  const t = themed(isDark)
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },
    headerTitle: { fontSize: 24, fontFamily: font.bold, marginBottom: 16, color: t.text },
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: t.card,
    },
    searchInput: { flex: 1, marginLeft: 12, fontSize: 16, color: t.text },
    filterRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
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
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    routeInfo: { flex: 1 },
    routeName: { fontFamily: font.semibold, fontSize: 16, color: t.text },
    routeMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    routeMetaText: { fontSize: 12, marginLeft: 4, color: t.textSecondary },
    routeRight: { alignItems: 'flex-end' },
    routeFare: { color: c.amber500, fontFamily: font.bold, fontSize: 18 },
    loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    loadingText: { marginTop: 12, color: t.textSecondary },
    emptyContainer: { alignItems: 'center', paddingVertical: 48 },
    emptyTitle: { fontSize: 18, fontFamily: font.semibold, marginTop: 16, color: t.textSecondary },
    emptySubtitle: { fontSize: 14, marginTop: 4, color: t.textTertiary },
  })
}
