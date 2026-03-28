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
  TrendingUp,
  ShieldCheck,
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
    { key: 'popular', label: 'Popular', icon: TrendingUp, color: c.amber500 },
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
    const isOkada = item.transport_type === 'okada'
    const accent = isOkada ? c.orange500 : c.amber500

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => {
          addSearch({ id: item.id, from: item.from_location, to: item.to_location, transportType: item.transport_type as 'trotro' | 'okada' | undefined })
          router.push({ pathname: '/routes/[id]', params: { id: item.id } })
        }}
        style={s.routeCard}
      >
        {/* Thin left accent border */}
        <View style={[s.cardAccent, { backgroundColor: accent }]} />

        <View style={s.cardInner}>
          {/* Top: badge + route name + fare */}
          <View style={s.cardTop}>
            <View style={s.cardTopLeft}>
              <View style={[s.typeBadge, { backgroundColor: `${accent}20` }]}>
                <Text style={[s.typeBadgeText, { color: isOkada ? '#9a3412' : '#815100' }]}>
                  {isOkada ? 'Okada' : 'Trotro'}
                </Text>
              </View>
              <Text style={s.routeName} numberOfLines={1}>
                {item.from_location} → {item.to_location}
              </Text>
            </View>
            <View style={s.fareWrap}>
              <Text style={[s.fareAmount, { color: accent }]}>
                GH₵ {displayFare.toFixed(2)}
              </Text>
              <Text style={s.fareLabel}>Per Seat</Text>
            </View>
          </View>

          {/* Meta row */}
          <View style={s.metaRow}>
            <View style={s.metaItem}>
              <Clock size={14} color={t.textTertiary} />
              <Text style={s.metaText}>{lastUpdated}</Text>
            </View>
            {item.is_gprtu_verified && (
              <View style={s.metaItem}>
                <ShieldCheck size={14} color="#16a34a" />
                <Text style={s.gprtuText}>GPRTU Verified</Text>
              </View>
            )}
          </View>

          {/* View Details button */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              addSearch({ id: item.id, from: item.from_location, to: item.to_location, transportType: item.transport_type as 'trotro' | 'okada' | undefined })
              router.push({ pathname: '/routes/[id]', params: { id: item.id } })
            }}
            style={s.viewDetailsBtn}
          >
            <Text style={s.viewDetailsText}>View Details</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    )
  }, [isDark])

  return (
    <SafeAreaView style={s.container}>
      {/* Editorial Header */}
      <View style={s.header}>
        <View style={s.headerRow}>
          <View>
            <Text style={s.headerLabel}>Urban Mobility</Text>
            <Text style={s.headerTitle}>Find Your Route</Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => { haptics.light(); setRegionPickerOpen(true) }}
            style={s.regionDropdown}
          >
            <Text style={s.regionDropdownText}>{activeRegionLabel}</Text>
            <ChevronDown size={16} color={c.amber500} />
          </TouchableOpacity>
        </View>

        {/* M3 Search bar */}
        <View style={s.searchBar}>
          <Search size={20} color={t.textTertiary} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Where are you going?"
            placeholderTextColor={t.textTertiary}
            style={s.searchInput}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={18} color={t.textTertiary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.chipRow}
          style={s.chipScroll}
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
                  s.chip,
                  active && s.chipActive,
                ]}
              >
                {Icon && (
                  <Icon
                    size={14}
                    color={active ? '#fff' : t.textSecondary}
                    fill={filter.key === 'saved' ? (active ? '#fff' : t.textSecondary) : 'transparent'}
                  />
                )}
                <Text style={[s.chipText, active && s.chipTextActive]}>
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
              Showing: {params.from || 'Any'} {'\u2192'} {params.to || 'Any'}
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

  const surfaceContainerLow = isDark ? 'rgba(255,255,255,0.04)' : '#f6efed'
  const surfaceContainerHigh = isDark ? 'rgba(255,255,255,0.08)' : '#e8e1de'

  return StyleSheet.create({
    container: { flex: 1, backgroundColor: isDark ? t.bg : '#fcf5f2' },

    // Editorial header
    header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    headerLabel: {
      fontSize: 10,
      fontFamily: font.bold,
      color: '#815100',
      textTransform: 'uppercase',
      letterSpacing: 2,
      marginBottom: 4,
    },
    headerTitle: {
      fontSize: 28,
      fontFamily: font.extrabold,
      color: t.text,
      letterSpacing: -0.5,
    },

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
      marginTop: 6,
    },
    regionDropdownText: {
      fontSize: 13,
      fontFamily: font.semibold,
      color: c.amber500,
    },

    // M3 Search bar — pill shape
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 28,
      paddingHorizontal: 20,
      paddingVertical: 14,
      backgroundColor: surfaceContainerHigh,
      gap: 12,
    },
    searchInput: {
      flex: 1,
      fontSize: 16,
      color: t.text,
      fontFamily: font.regular,
      padding: 0,
    },

    // Filter chips — gradient active, surface inactive
    chipScroll: { marginTop: 14 },
    chipRow: {
      flexDirection: 'row' as const,
      gap: 10,
      paddingBottom: 6,
    },
    chip: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 24,
      backgroundColor: surfaceContainerHigh,
      gap: 6,
    },
    chipActive: {
      backgroundColor: '#815100',
    },
    chipText: {
      fontSize: 13,
      fontFamily: font.semibold,
      color: t.textSecondary,
    },
    chipTextActive: {
      color: '#fff',
    },
    filterRow: { flexDirection: 'row' as const, alignItems: 'center' as const, marginTop: 12 },
    filterText: { fontSize: 14, marginLeft: 4, color: t.textSecondary },

    // Route cards — Stitch editorial style
    routeCard: {
      flexDirection: 'row',
      borderRadius: 24,
      marginBottom: 14,
      backgroundColor: surfaceContainerLow,
      overflow: 'hidden',
    },
    cardAccent: {
      width: 4,
      borderTopLeftRadius: 24,
      borderBottomLeftRadius: 24,
    },
    cardInner: {
      flex: 1,
      padding: 18,
    },

    // Top section: badge + name + fare
    cardTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 14,
    },
    cardTopLeft: {
      flex: 1,
      marginRight: 12,
      gap: 8,
    },
    typeBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 20,
    },
    typeBadgeText: {
      fontSize: 10,
      fontFamily: font.bold,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    routeName: {
      fontSize: 18,
      fontFamily: font.extrabold,
      color: t.text,
      letterSpacing: -0.3,
    },

    // Fare
    fareWrap: {
      alignItems: 'flex-end',
    },
    fareAmount: {
      fontSize: 20,
      fontFamily: font.extrabold,
      letterSpacing: -0.3,
    },
    fareLabel: {
      fontSize: 9,
      fontFamily: font.medium,
      color: t.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: 2,
    },

    // Meta row
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      marginBottom: 14,
    },
    metaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    metaText: {
      fontSize: 13,
      fontFamily: font.medium,
      color: t.textSecondary,
    },
    gprtuText: {
      fontSize: 11,
      fontFamily: font.bold,
      color: '#16a34a',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },

    // View Details button
    viewDetailsBtn: {
      alignItems: 'center',
      paddingVertical: 12,
      borderRadius: 14,
      backgroundColor: surfaceContainerHigh,
    },
    viewDetailsText: {
      fontSize: 14,
      fontFamily: font.bold,
      color: '#815100',
    },

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
      borderRadius: 24,
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
