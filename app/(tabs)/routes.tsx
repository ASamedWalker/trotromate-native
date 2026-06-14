import { useState, useMemo, useCallback, useEffect } from 'react'
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
  Star,
} from 'lucide-react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { c, themed, font, shadow } from '@/lib/theme'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { REGIONS, REGION_HEROES } from '@/lib/config/regions'
import { useRoutes } from '@/lib/hooks/useRoutes'
import { fareConfidence } from '@/lib/utils/fare-confidence'
import { useQueryClient } from '@tanstack/react-query'
import { fetchRouteById } from '@/lib/services/routes'
import { useFavorites } from '@/lib/hooks/useFavorites'
import { timeAgo } from '@/lib/utils/time'
import type { RouteWithStats } from '@/lib/types'
import { SkeletonRouteCard } from '@/components/Skeleton'

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
  const s = useMemo(() => getStyles(isDark), [isDark])

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

  // Anticipatory prefetch (Uber "work ahead of the user" pattern): warm the
  // detail queries for the cards on screen so /routes/[id] opens instantly.
  // prefetchQuery is a no-op while the cached copy is still fresh.
  const queryClient = useQueryClient()
  useEffect(() => {
    for (const r of filteredRoutes.slice(0, 6)) {
      queryClient.prefetchQuery({
        queryKey: ['route', r.id],
        queryFn: () => fetchRouteById(r.id),
      })
    }
  }, [filteredRoutes, queryClient])

  // Citymapper-style line identity: each corridor gets a stable colour so
  // riders recognise "their" line at a glance. Deterministic hash of route id.
  const LINE_COLORS = [
    '#E32017', '#0098D4', '#00782A', '#9B0056', '#003688',
    '#EE7C0E', '#00A4A7', '#7156A5', '#B36305', '#DC241F',
  ]
  const lineColorFor = (id: string) => {
    let h = 0
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
    return LINE_COLORS[h % LINE_COLORS.length]
  }

  const filters: { key: Filter; label: string; icon: typeof Bus | null; color: string }[] = [
    { key: 'all', label: 'All', icon: null, color: '#FF4D1C' },
    { key: 'trotro', label: 'Trotro', icon: Bus, color: '#FF4D1C' },
    { key: 'okada', label: 'Okada', icon: Bike, color: c.orange500 },
    { key: 'popular', label: 'Popular', icon: TrendingUp, color: '#FF4D1C' },
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
    const accent = lineColorFor(item.id)
    const confidence = fareConfidence(item.fare_stats)

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
              <View style={[s.typeBadge, { backgroundColor: `${accent}1C` }]}>
                <Text style={[s.typeBadgeText, { color: accent }]}>
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
            {confidence && (
              <View style={s.metaItem}>
                <View style={[s.confidenceDot, { backgroundColor: confidence.color }]} />
                <Text style={[s.metaText, { color: confidence.color, fontFamily: font.semibold }]}>
                  {confidence.label}
                </Text>
              </View>
            )}
            {item.rating_stats && item.rating_stats.rating_count > 0 && (
              <View style={s.metaItem}>
                <Star size={14} color="#F5A623" fill="#F5A623" />
                <Text style={[s.metaText, { color: '#B45309', fontFamily: font.semibold }]}>
                  {Number(item.rating_stats.avg_rating).toFixed(1)} ({item.rating_stats.rating_count})
                </Text>
              </View>
            )}
            {item.is_gprtu_verified && (
              <View style={s.metaItem}>
                <ShieldCheck size={14} color="#16a34a" />
                <Text style={s.gprtuText}>GPRTU Verified</Text>
              </View>
            )}
          </View>

        </View>
      </TouchableOpacity>
    )
  }, [isDark])

  return (
    // Rendered inside the Lines tab, which already pads the top safe area
    <SafeAreaView style={s.container} edges={['bottom']}>
      {/* Editorial Header */}
      <Animated.View entering={FadeInDown.duration(300)} style={s.header}>
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
            <ChevronDown size={16} color={'#FF4D1C'} />
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
                style={[s.chip, active && s.chipActiveWrap]}
              >
                {active ? (
                  <LinearGradient
                    colors={['#FF4D1C', '#FF4D1C']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={s.chipGradient}
                  >
                    {Icon && <Icon size={14} color="#fff" fill={filter.key === 'saved' ? '#fff' : 'transparent'} />}
                    <Text style={s.chipTextActive}>{filter.label}</Text>
                  </LinearGradient>
                ) : (
                  <>
                    {Icon && (
                      <Icon
                        size={14}
                        color={t.textSecondary}
                        fill={filter.key === 'saved' ? t.textSecondary : 'transparent'}
                      />
                    )}
                    <Text style={s.chipText}>{filter.label}</Text>
                  </>
                )}
              </TouchableOpacity>
            )
          })}
        </ScrollView>

        {(params.from || params.to) && (
          <View style={s.filterRow}>
            <MapPin size={14} color={'#FF4D1C'} />
            <Text style={s.filterText}>
              Showing: {params.from || 'Any'} {'\u2192'} {params.to || 'Any'}
            </Text>
          </View>
        )}
      </Animated.View>

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
          ListHeaderComponent={activeRegion !== 'all' ? (() => {
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
              })() : null}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => { setRefreshing(true); await refetch(); setRefreshing(false) }}
              tintColor={'#FF4D1C'}
              colors={['#FF4D1C']}
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
                  <Plus size={16} color={'#FF4D1C'} />
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
                <Plus size={16} color={'#FF4D1C'} />
                <Text style={s.footerCtaText}>Can&apos;t find your route? Add it</Text>
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
                  {isActive && <Check size={18} color={'#FF4D1C'} />}
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
    header: { paddingHorizontal: 20, paddingTop: 2, paddingBottom: 8 },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    headerLabel: {
      fontSize: 10,
      fontFamily: font.bold,
      color: '#FF4D1C',
      textTransform: 'uppercase',
      letterSpacing: 2,
      marginBottom: 4,
    },
    headerTitle: {
      fontSize: 28,
      fontFamily: font.displayHeavy,
      color: t.text,
      letterSpacing: 0,
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
      color: '#FF4D1C',
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
    chipActiveWrap: {
      padding: 0,
      backgroundColor: 'transparent',
      overflow: 'hidden' as const,
    },
    chipGradient: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 6,
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 24,
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
      borderRadius: 16,
      marginBottom: 14,
      backgroundColor: surfaceContainerLow,
      overflow: 'hidden',
    },
    cardAccent: {
      width: 4,
      borderTopLeftRadius: 16,
      borderBottomLeftRadius: 16,
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
      fontSize: 26,
      fontFamily: font.displayHeavy,
      letterSpacing: 0,
    },
    fareLabel: {
      fontSize: 9,
      fontFamily: font.medium,
      color: t.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: 2,
    },

    // Meta row (last element in the card now that View Details is gone)
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    metaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    confidenceDot: {
      width: 7,
      height: 7,
      borderRadius: 3.5,
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
      backgroundColor: isDark ? 'rgba(245,158,11,0.1)' : '#FFF0EB',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(245,158,11,0.2)' : '#FFD2C2',
    },
    addRouteBtnText: { fontSize: 14, fontFamily: font.semibold, color: '#FF4D1C' },
    footerCta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 16,
      marginBottom: 80,
    },
    footerCtaText: { fontSize: 14, fontFamily: font.medium, color: '#FF4D1C' },

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
      color: '#FF4D1C',
    },
  })
}
