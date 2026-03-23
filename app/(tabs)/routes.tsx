import { useState, useMemo, useCallback } from 'react'
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
  Modal,
  Pressable,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { GPRTUBadge } from '@/components/GPRTUBadge'
import { useLocalSearchParams, useRouter, type Href } from 'expo-router'
import {
  Search,
  MapPin,
  Clock,
  Heart,
  X,
  Bike,
  Bus,
  Plus,
  ChevronDown,
  Check,
} from 'lucide-react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { c, themed, font, shadow } from '@/lib/theme'
import { REGIONS, REGION_HEROES } from '@/lib/config/regions'
import { useRoutes } from '@/lib/hooks/useRoutes'
import { useFavorites } from '@/lib/hooks/useFavorites'
import { timeAgo } from '@/lib/utils/time'
import type { RouteWithStats } from '@/lib/types'
import { SkeletonRouteCard } from '@/components/Skeleton'
import ExploreGhana from '@/components/ExploreGhana'
import { useHaptics } from '@/lib/hooks/useHaptics'
import { useRefreshOnFocus } from '@/lib/hooks/useRefreshOnFocus'
import { useSearchHistory } from '@/lib/hooks/useSearchHistory'

type Filter = 'all' | 'trotro' | 'okada' | 'popular' | 'saved'

export default function RoutesScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ from?: string; to?: string; transport?: string; region?: string }>()
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const t = themed(isDark)
  const s = getStyles(isDark)

  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<Filter>(
    (params.transport as Filter) || 'all'
  )
  const [activeRegion, setActiveRegion] = useState<string>(params.region || 'all')
  const [regionPickerOpen, setRegionPickerOpen] = useState(false)

  const activeTransport = activeFilter === 'trotro' || activeFilter === 'okada' ? activeFilter : undefined
  const regionParam = activeRegion !== 'all' ? activeRegion : undefined
  const { routes, isLoading, refetch } = useRoutes(params.from, params.to, activeTransport, regionParam)
  useRefreshOnFocus([['routes', params.from, params.to, activeTransport, regionParam]])
  const [refreshing, setRefreshing] = useState(false)
  const { favorites } = useFavorites()
  const haptics = useHaptics()
  const { addSearch } = useSearchHistory()

  const activeRegionLabel = REGIONS.find((r) => r.key === activeRegion)?.label ?? 'All Regions'
  const showExplore = !searchQuery && activeFilter === 'all' && activeRegion === 'all' && !params.from && !params.to

  const filteredRoutes = useMemo(() => {
    let result = routes

    if (activeFilter === 'popular') {
      result = result.filter((r) => r.is_popular)
    } else if (activeFilter === 'saved') {
      const favIds = new Set(favorites.map((f) => f.id))
      result = result.filter((r) => favIds.has(r.id))
    }

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

  const filters: { key: Filter; label: string; icon: typeof Bus | null; color: string }[] = [
    { key: 'all', label: 'All', icon: null, color: c.amber500 },
    { key: 'trotro', label: 'Trotro', icon: Bus, color: c.amber500 },
    { key: 'okada', label: 'Okada', icon: Bike, color: c.orange500 },
    { key: 'popular', label: 'Popular', icon: null, color: c.amber500 },
    { key: 'saved', label: 'Saved', icon: Heart, color: c.red500 },
  ]

  const selectRegion = useCallback((key: string) => {
    haptics.light()
    setActiveRegion(key)
    setRegionPickerOpen(false)
  }, [haptics])

  const renderRoute = useCallback(({ item }: { item: RouteWithStats }) => {
    const displayFare = item.fare_stats?.avg_reported_fare ?? item.official_fare
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
            <Bike size={22} color={c.orange500} />
          ) : (
            <MapPin size={22} color={c.amber500} />
          )}
        </View>

        <View style={s.routeInfo}>
          <Text style={s.routeName} numberOfLines={1}>
            {item.from_location} → {item.to_location}
          </Text>
          <View style={s.routeMeta}>
            <Clock size={11} color={t.textSecondary} />
            <Text style={s.routeMetaText}>{lastUpdated}</Text>
          </View>
        </View>

        <View style={s.routeRight}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {item.is_gprtu_verified && <GPRTUBadge size="small" />}
            <Text style={s.routeFare}>₵{displayFare.toFixed(2)}</Text>
          </View>
        </View>
      </TouchableOpacity>
    )
  }, [isDark])

  return (
    <SafeAreaView style={s.container}>
      {/* Header: Title + Region dropdown */}
      <View style={s.header}>
        <View style={s.headerRow}>
          <Text style={s.headerTitle}>Routes</Text>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => { haptics.light(); setRegionPickerOpen(true) }}
            style={s.regionDropdown}
          >
            <Text style={s.regionDropdownText}>{activeRegionLabel}</Text>
            <ChevronDown size={16} color={c.amber500} />
          </TouchableOpacity>
        </View>

        {/* Search */}
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

        {/* Single filter row */}
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
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 90 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={(showExplore || activeRegion !== 'all') ? (
            <View>
              {/* Region Hero Banner */}
              {activeRegion !== 'all' && (() => {
                const hero = REGION_HEROES.find(h => h.key === activeRegion)
                if (!hero) return null
                return (
                  <View style={s.heroBanner}>
                    <Image
                      source={{ uri: hero.heroImage }}
                      style={[StyleSheet.absoluteFillObject, { backgroundColor: hero.placeholderColor }]}
                      contentFit="cover"
                      transition={400}
                      cachePolicy="disk"
                    />
                    <LinearGradient
                      colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.6)']}
                      style={StyleSheet.absoluteFillObject}
                    />
                    <View style={s.heroBannerContent}>
                      <Text style={s.heroBannerCity}>{hero.label}</Text>
                      <Text style={s.heroBannerTagline}>{hero.tagline}</Text>
                    </View>
                  </View>
                )
              })()}

              {/* Explore Ghana — only when browsing without filters */}
              {showExplore && (
                <View style={{ marginBottom: 20 }}>
                  <ExploreGhana />
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
                  ? 'Tap the heart on a route detail to save it'
                  : 'Try a different search or filter'
                }
              </Text>
              {activeFilter !== 'saved' && (
                <TouchableOpacity
                  onPress={() => router.push('/report/fare' as Href)}
                  activeOpacity={0.7}
                  style={s.addRouteBtn}
                >
                  <Plus size={16} color={c.amber500} />
                  <Text style={s.addRouteBtnText}>Add This Route</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          ListFooterComponent={
            filteredRoutes.length > 0 ? (
              <TouchableOpacity
                onPress={() => router.push('/report/fare' as Href)}
                activeOpacity={0.7}
                style={s.footerCta}
              >
                <Plus size={16} color={c.amber500} />
                <Text style={s.footerCtaText}>Can't find your route? Add it</Text>
              </TouchableOpacity>
            ) : null
          }
        />
      )}

      {/* Region Picker Modal */}
      <Modal
        visible={regionPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setRegionPickerOpen(false)}
      >
        <Pressable style={s.modalOverlay} onPress={() => setRegionPickerOpen(false)}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>Select Region</Text>
            {REGIONS.map((region) => {
              const isActive = activeRegion === region.key
              return (
                <TouchableOpacity
                  key={region.key}
                  activeOpacity={0.7}
                  onPress={() => selectRegion(region.key)}
                  style={[s.modalOption, isActive && s.modalOptionActive]}
                >
                  <Text style={[s.modalOptionText, isActive && s.modalOptionTextActive]}>
                    {region.label}
                  </Text>
                  {isActive && <Check size={18} color={c.amber500} />}
                </TouchableOpacity>
              )
            })}
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  )
}

const getStyles = (isDark: boolean) => {
  const t = themed(isDark)
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },

    // Header
    header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    headerTitle: { fontSize: 26, fontFamily: font.bold, color: t.text },

    // Region dropdown
    regionDropdown: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: isDark ? 'rgba(245,158,11,0.1)' : 'rgba(245,158,11,0.08)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(245,158,11,0.2)' : 'rgba(245,158,11,0.15)',
    },
    regionDropdownText: {
      fontSize: 13,
      fontFamily: font.semibold,
      color: c.amber500,
    },

    // Search
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: t.card,
      borderWidth: 1,
      borderColor: t.border,
      ...shadow.card,
    },
    searchInput: { flex: 1, marginLeft: 12, fontSize: 16, color: t.text, fontFamily: font.regular },

    // Filter chips
    filterChipScroll: { marginTop: 12 },
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
      borderWidth: isDark ? 0 : 1,
      borderColor: t.border,
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

    // Route cards
    routeCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
      borderRadius: 16,
      marginBottom: 10,
      backgroundColor: t.card,
      borderWidth: 1,
      borderColor: t.border,
    },
    routeIcon: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: isDark ? 'rgba(245,158,11,0.12)' : c.amber100,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      marginRight: 12,
    },
    routeIconOkada: {
      backgroundColor: isDark ? 'rgba(249,115,22,0.15)' : '#fff7ed',
    },
    routeInfo: { flex: 1 },
    routeName: { fontFamily: font.semibold, fontSize: 14, color: t.text },
    routeMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 3, gap: 4 },
    routeMetaText: { fontSize: 11, color: t.textSecondary, fontFamily: font.regular },
    routeRight: { alignItems: 'flex-end', marginLeft: 8 },
    routeFare: { color: c.amber500, fontFamily: font.bold, fontSize: 17 },

    // Empty
    emptyContainer: { alignItems: 'center', paddingVertical: 48 },
    emptyTitle: { fontSize: 18, fontFamily: font.semibold, marginTop: 16, color: t.textSecondary },
    emptySubtitle: { fontSize: 14, marginTop: 4, color: t.textTertiary, textAlign: 'center' },
    addRouteBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 20,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 16,
      backgroundColor: isDark ? 'rgba(245,158,11,0.1)' : '#fffbeb',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(245,158,11,0.2)' : '#fde68a',
    },
    addRouteBtnText: { fontSize: 14, fontFamily: font.semibold, color: c.amber500 },
    footerCta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 16,
      marginBottom: 80,
    },
    footerCtaText: { fontSize: 14, fontFamily: font.medium, color: c.amber500 },

    // Region Hero Banner
    heroBanner: {
      height: 130,
      borderRadius: 16,
      overflow: 'hidden' as const,
      marginBottom: 16,
      ...shadow.cardStrong,
    },
    heroBannerContent: {
      flex: 1,
      justifyContent: 'flex-end' as const,
      padding: 16,
    },
    heroBannerCity: {
      fontSize: 22,
      fontFamily: font.bold,
      color: c.white,
    },
    heroBannerTagline: {
      fontSize: 13,
      fontFamily: font.regular,
      color: 'rgba(255,255,255,0.8)',
      marginTop: 2,
    },

    // Region picker modal
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      padding: 40,
    },
    modalContent: {
      width: '100%' as const,
      backgroundColor: t.card,
      borderRadius: 20,
      padding: 20,
      maxWidth: 340,
    },
    modalTitle: {
      fontSize: 18,
      fontFamily: font.bold,
      color: t.text,
      marginBottom: 16,
      textAlign: 'center' as const,
    },
    modalOption: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 12,
      marginBottom: 4,
    },
    modalOptionActive: {
      backgroundColor: isDark ? 'rgba(245,158,11,0.1)' : 'rgba(245,158,11,0.06)',
    },
    modalOptionText: {
      fontSize: 15,
      fontFamily: font.medium,
      color: t.text,
    },
    modalOptionTextActive: {
      fontFamily: font.semibold,
      color: c.amber500,
    },
  })
}
