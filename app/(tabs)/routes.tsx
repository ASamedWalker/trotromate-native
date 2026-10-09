import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter, type Href } from 'expo-router'
import {
  Search,
  MapPin,
  Clock,
  Heart,
  X,
  Bike,
  BusFront,
  LayoutGrid,
  Plus,
  ChevronDown,
  Check,
  TrendingUp,
  ShieldCheck,
  Star,
} from 'lucide-react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { SvgXml } from 'react-native-svg'
import { adinkraPatternXml } from '@/lib/brand/adinkra'
import { RELEASE_MODE } from '@/lib/config/release'
import { REPORT_POINTS } from '@/lib/constants/rewards'
import { TAB_BAR_CLEARANCE } from '@/app/(tabs)/_layout'
import { font, brand, ui, space, radius, type, cardShadow } from '@/lib/theme'
import { Chip, Badge, Button } from '@/components/ui'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { REGIONS, REGION_HEROES } from '@/lib/config/regions'
import { useRoutes } from '@/lib/hooks/useRoutes'
import { fareConfidence } from '@/lib/utils/fare-confidence'
import { useQueryClient } from '@tanstack/react-query'
import { fetchRouteById } from '@/lib/services/routes'
import { useFavorites } from '@/lib/hooks/useFavorites'
import { timeAgo } from '@/lib/utils/time'
import { titleCase } from '@/lib/utils/title-case'
import { ReleaseLineCard } from '@/components/lines/ReleaseLineCard'
import { corridorFor } from '@/lib/constants/corridors'
import type { RouteWithStats } from '@/lib/types'
import { SkeletonRouteCard } from '@/components/Skeleton'

import { useHaptics } from '@/lib/hooks/useHaptics'
import { useRefreshOnFocus } from '@/lib/hooks/useRefreshOnFocus'
import { useSearchHistory } from '@/lib/hooks/useSearchHistory'

// Fare-of-the-day backdrop: faint brand adinkra print, cached per card size.
const fotdPatternCache = new Map<string, string>()
function fotdPattern(w: number, h: number): string {
  const key = `${w}x${h}`
  let xml = fotdPatternCache.get(key)
  if (!xml) { xml = adinkraPatternXml(w, h, 26, 'rgba(255,255,255,0.07)'); fotdPatternCache.set(key, xml) }
  return xml
}

type Filter = 'all' | 'trotro' | 'okada' | 'popular' | 'saved'

export default function RoutesScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [fotdSize, setFotdSize] = useState({ w: 0, h: 0 })
  const params = useLocalSearchParams<{ from?: string; to?: string; transport?: string; region?: string }>()
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const s = useMemo(() => getStyles(), [])

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

    // No user-location plumbing on this screen — use a cheap static heuristic
    // instead: commuter-fare corridors (<= GH₵30) surface above intercity
    // corridors (e.g. Accra→Tamale GH₵240), stable within each group.
    const COMMUTER_FARE_CEILING = 30
    const fareOf = (r: RouteWithStats) => r.fare_stats?.avg_reported_fare ?? r.official_fare
    result = result
      .map((r, index) => ({ r, index }))
      .sort((a, b) => {
        const aCommuter = fareOf(a.r) <= COMMUTER_FARE_CEILING
        const bCommuter = fareOf(b.r) <= COMMUTER_FARE_CEILING
        if (aCommuter !== bCommuter) return aCommuter ? -1 : 1
        return a.index - b.index
      })
      .map(({ r }) => r)

    return result
  }, [routes, activeFilter, searchQuery, favorites])

  // Fare of the day: one route per calendar day (day-of-year index into a
  // stable id-sorted pool) that has BOTH a GPRTU-verified official fare and at
  // least one rider report. Real numbers only; null hides the card.
  const fareOfDay = useMemo(() => {
    const pool = routes
      .filter((r) =>
        (r.transport_type ?? 'trotro') === 'trotro' &&
        r.is_gprtu_verified &&
        r.official_fare > 0 &&
        (r.fare_stats?.report_count ?? 0) > 0 &&
        (r.fare_stats?.avg_reported_fare ?? 0) > 0)
      .sort((a, b) => (a.id < b.id ? -1 : 1))
    if (pool.length === 0) return null
    const now = new Date()
    const dayOfYear = Math.floor((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(now.getFullYear(), 0, 0)) / 86400000)
    return pool[dayOfYear % pool.length]
  }, [routes])

  // Reset scroll when the query/filter changes so the first match isn't half-hidden
  const listRef = useRef<FlatList<RouteWithStats>>(null)
  useEffect(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: false })
  }, [searchQuery, activeFilter, activeRegion])

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

  const filters: { key: Filter; label: string; icon: typeof BusFront }[] = [
    { key: 'all', label: 'All', icon: LayoutGrid },
    { key: 'trotro', label: 'Trotro', icon: BusFront },
    { key: 'okada', label: 'Okada', icon: Bike },
    { key: 'popular', label: 'Popular', icon: TrendingUp },
    { key: 'saved', label: 'Saved', icon: Heart },
  ]

  const selectRegion = useCallback((key: string) => {
    haptics.light()
    setActiveRegion(key)
    setRegionPickerOpen(false)
  }, [haptics])

  const renderRoute = useCallback(({ item }: { item: RouteWithStats }) => {
    if (RELEASE_MODE) {
      return (
        <ReleaseLineCard
          item={item}
          saved={favorites.some((f) => f.id === item.id)}
          onPress={() => {
            addSearch({ id: item.id, from: item.from_location, to: item.to_location, transportType: item.transport_type as 'trotro' | 'okada' | undefined })
            router.push({ pathname: '/routes/[id]', params: { id: item.id } })
          }}
        />
      )
    }
    const displayFare = item.fare_stats?.avg_reported_fare ?? item.official_fare
    const lastUpdated = timeAgo(item.fare_stats?.last_report_at ?? null)
    const isOkada = item.transport_type === 'okada'
    const accent = lineColorFor(item.id)
    const confidence = fareConfidence(item.fare_stats)
    const hasFareReports = (item.fare_stats?.report_count ?? 0) > 0
    // GPRTU-verified official fares are authoritative — never label them estimates
    const fareTrusted = hasFareReports || (item.is_gprtu_verified && item.official_fare != null)

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
              <Badge label={isOkada ? 'Okada' : 'Trotro'} tone={isOkada ? 'brand' : 'neutral'} />
              <Text style={s.routeName} numberOfLines={1}>
                {titleCase(item.from_location)} → {titleCase(item.to_location)}
              </Text>
            </View>
            <View style={s.fareWrap}>
              <Text style={[s.fareAmount, { color: fareTrusted ? ui.text : ui.textSecondary }]}>
                {fareTrusted ? '' : 'Est. '}GH₵ {displayFare.toFixed(2)}
              </Text>
              <Text style={s.fareLabel}>Per seat</Text>
              {!hasFareReports && (
                <TouchableOpacity
                  style={s.reportFareCta}
                  onPress={() => router.push({
                    pathname: '/report/fare',
                    params: { route_id: item.id, from: item.from_location, to: item.to_location, transport_type: item.transport_type },
                  } as Href)}
                  activeOpacity={0.7}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Plus size={11} color={ui.warning} />
                  <Text style={s.reportFareCtaText}>Report fare (+pts)</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Meta row */}
          <View style={s.metaRow}>
            <View style={s.metaItem}>
              <Clock size={14} color={ui.textTertiary} />
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
                <Star size={14} color={ui.warning} fill={ui.warning} />
                <Text style={[s.metaText, { color: ui.warning, fontFamily: font.semibold }]}>
                  {Number(item.rating_stats.avg_rating).toFixed(1)} ({item.rating_stats.rating_count})
                </Text>
              </View>
            )}
            {item.is_gprtu_verified && (
              <View style={s.sourceBadgeOfficial}>
                <ShieldCheck size={12} color="#166534" />
                <Text style={s.sourceBadgeOfficialText}>GPRTU verified</Text>
              </View>
            )}
            {hasFareReports && (
              <View style={s.sourceBadgeRider}>
                <Text style={s.sourceBadgeRiderText}>Rider-reported</Text>
              </View>
            )}
          </View>

        </View>
      </TouchableOpacity>
    )
  }, [isDark, favorites]) // eslint-disable-line react-hooks/exhaustive-deps

  // Store release: launch corridors first (redesign wave 3), otherwise the existing order.
  const listRoutes = useMemo(() => {
    if (!RELEASE_MODE) return filteredRoutes
    const launch = (r: RouteWithStats) => (corridorFor(r.from_location, r.to_location).isLaunch ? 0 : 1)
    return [...filteredRoutes].sort((a, b) => launch(a) - launch(b))
  }, [filteredRoutes])

  return (
    // Rendered inside the Lines tab, which already pads the top safe area
    <SafeAreaView style={s.container} edges={['bottom']}>
      {/* Editorial Header */}
      <Animated.View entering={FadeInDown.duration(300)} style={s.header}>
        <View style={s.headerRow}>
          {/* Release mode: the Fares tab header (lines.tsx) already titles this screen */}
          {RELEASE_MODE ? <View /> : (
            <View>
              <Text style={s.headerLabel}>Urban mobility</Text>
              <Text style={s.headerTitle}>Find your route</Text>
            </View>
          )}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => { haptics.light(); setRegionPickerOpen(true) }}
            style={s.regionDropdown}
          >
            <Text style={s.regionDropdownText}>{activeRegionLabel}</Text>
            <ChevronDown size={16} color={brand.orange} />
          </TouchableOpacity>
        </View>

        {/* M3 Search bar */}
        <View style={s.searchBar}>
          <Search size={20} color={ui.textTertiary} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Where are you going?"
            placeholderTextColor={ui.textTertiary}
            style={s.searchInput}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={18} color={ui.textTertiary} />
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
            return (
              <Chip
                key={filter.key}
                label={filter.label}
                icon={filter.icon}
                selected={activeFilter === filter.key}
                onPress={() => { haptics.light(); setActiveFilter(filter.key) }}
              />
            )
          })}
        </ScrollView>

        {(params.from || params.to) && (
          <View style={s.filterRow}>
            <MapPin size={14} color={brand.orange} />
            <Text style={s.filterText}>
              Showing: {params.from || 'Any'} {'\u2192'} {params.to || 'Any'}
            </Text>
          </View>
        )}
      </Animated.View>

      {isLoading ? (
        <View style={{ paddingHorizontal: space.gutter, paddingTop: 12 }}>
          <SkeletonRouteCard isDark={isDark} />
          <SkeletonRouteCard isDark={isDark} />
          <SkeletonRouteCard isDark={isDark} />
          <SkeletonRouteCard isDark={isDark} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={listRoutes}
          renderItem={renderRoute}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: space.gutter, paddingTop: 8, paddingBottom: 90 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={(
            <>
              {RELEASE_MODE && fareOfDay && activeRegion === 'all' && !searchQuery && activeFilter === 'all' && (
                <TouchableOpacity
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={`Fare of the day, ${titleCase(fareOfDay.from_location)} to ${titleCase(fareOfDay.to_location)}. Official GH₵ ${fareOfDay.official_fare.toFixed(2)}, riders paid GH₵ ${(fareOfDay.fare_stats?.avg_reported_fare ?? 0).toFixed(2)}`}
                  onPress={() => router.push({ pathname: '/routes/[id]', params: { id: fareOfDay.id } })}
                  style={s.fotdCard}
                  onLayout={(e) => setFotdSize({ w: Math.round(e.nativeEvent.layout.width), h: Math.round(e.nativeEvent.layout.height) })}
                >
                  {fotdSize.w > 0 && (
                    <View style={StyleSheet.absoluteFill} pointerEvents="none">
                      <SvgXml xml={fotdPattern(fotdSize.w, fotdSize.h)} width={fotdSize.w} height={fotdSize.h} />
                    </View>
                  )}
                  <LinearGradient
                    colors={['#16110D', 'rgba(22,17,13,0.88)', 'rgba(22,17,13,0.25)']}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={StyleSheet.absoluteFill}
                    pointerEvents="none"
                  />
                  <Text style={s.fotdLabel}>FARE OF THE DAY</Text>
                  <Text style={s.fotdRoute} numberOfLines={2}>
                    {titleCase(fareOfDay.from_location)} → {titleCase(fareOfDay.to_location)}
                  </Text>
                  <View style={s.fotdCols}>
                    <View style={s.fotdCol}>
                      <Text style={s.fotdColLabel}>Official</Text>
                      <Text style={s.fotdAmount}>GH₵ {fareOfDay.official_fare.toFixed(2)}</Text>
                    </View>
                    <View style={s.fotdCol}>
                      <Text style={s.fotdColLabel}>Riders paid</Text>
                      <Text style={[s.fotdAmount, { color: '#FF7A50' }]}>GH₵ {(fareOfDay.fare_stats?.avg_reported_fare ?? 0).toFixed(2)}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              )}
              {activeRegion !== 'all' ? (() => {
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
            </>
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => { setRefreshing(true); await refetch(); setRefreshing(false) }}
              tintColor={brand.orange}
              colors={[brand.orange]}
            />
          }
          ListEmptyComponent={
            <View style={s.emptyContainer}>
              <MapPin size={48} color={ui.textTertiary} />
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
                <Button
                  label="Add this route"
                  icon={Plus}
                  variant="secondary"
                  fullWidth={false}
                  style={{ marginTop: 20, alignSelf: 'center' }}
                  onPress={() => router.push('/report/fare' as Href)}
                />
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
                <Plus size={16} color={brand.orangeText} />
                <Text style={s.footerCtaText}>Can&apos;t find your route? Add it</Text>
              </TouchableOpacity>
            ) : null
          }
        />
      )}

      {RELEASE_MODE && (
        <TouchableOpacity
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Report a fare"
          onPress={() => router.push('/report/fare' as Href)}
          style={[s.reportFab, { bottom: TAB_BAR_CLEARANCE + insets.bottom - 8 }]}
        >
          <Plus size={18} color="#fff" />
          <Text style={s.reportFabText}>Report a fare · +{REPORT_POINTS.fare}</Text>
        </TouchableOpacity>
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
            <Text style={s.modalTitle}>Select region</Text>
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
                  {isActive && <Check size={18} color={brand.orange} />}
                </TouchableOpacity>
              )
            })}
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  )
}

const getStyles = () => {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: ui.bg },

    // Header
    header: { paddingHorizontal: space.gutter, paddingTop: 2, paddingBottom: 8 },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    headerLabel: {
      ...type.caption,
      color: ui.textSecondary,
      marginBottom: 2,
    },
    headerTitle: {
      fontSize: 28,
      fontFamily: font.displayHeavy,
      color: ui.text,
      letterSpacing: 0,
    },

    // Region dropdown
    regionDropdown: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: radius.pill,
      backgroundColor: brand.orangeSoft,
      marginTop: 6,
    },
    regionDropdownText: {
      ...type.labelStrong,
      color: brand.orangeText,
    },

    // Search bar
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: radius.pill,
      paddingHorizontal: 20,
      paddingVertical: 14,
      backgroundColor: ui.surface,
      gap: 12,
    },
    searchInput: {
      flex: 1,
      fontSize: 16,
      color: ui.text,
      fontFamily: font.regular,
      padding: 0,
    },

    // Filter chips (Chip primitive)
    chipScroll: { marginTop: 14, marginHorizontal: -space.gutter },
    chipRow: {
      flexDirection: 'row' as const,
      gap: 10,
      paddingHorizontal: space.gutter,
      paddingBottom: 6,
    },
    filterRow: { flexDirection: 'row' as const, alignItems: 'center' as const, marginTop: 12 },
    filterText: { ...type.label, marginLeft: 4, color: ui.textSecondary },

    // Route cards — Stitch editorial style
    routeCard: {
      flexDirection: 'row',
      borderRadius: radius.lg,
      marginBottom: 14,
      backgroundColor: ui.card,
      overflow: 'hidden',
      ...cardShadow,
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
    routeName: {
      fontSize: 18,
      fontFamily: font.bold,
      color: ui.text,
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
      ...type.caption,
      color: ui.textSecondary,
      marginTop: 2,
    },
    reportFareCta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      marginTop: 6,
    },
    reportFareCtaText: {
      fontSize: 11,
      fontFamily: font.semibold,
      color: ui.warning,
    },

    // Meta row (last element in the card now that View Details is gone)
    metaRow: {
      flexWrap: 'wrap',
      rowGap: 6,
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
      ...type.label,
      color: ui.textSecondary,
    },
    sourceBadgeOfficial: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: '#DCFCE7',
    },
    sourceBadgeOfficialText: { fontSize: 11, fontFamily: font.semibold, color: '#166534' },
    sourceBadgeRider: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: '#FFEDD5',
    },
    sourceBadgeRiderText: { fontSize: 11, fontFamily: font.semibold, color: '#9A3412' },

    // Fare of the day (release mode)
    fotdCard: {
      backgroundColor: '#16110D',
      borderRadius: 20,
      padding: 18,
      marginBottom: 14,
      overflow: 'hidden',
    },
    fotdLabel: { fontSize: 12, fontFamily: font.bold, color: '#F5A300', letterSpacing: 1 },
    fotdRoute: { fontSize: 18, fontFamily: font.bold, color: '#fff', marginTop: 6 },
    fotdCols: { flexDirection: 'row', gap: 24, marginTop: 14 },
    fotdCol: { flexShrink: 1 },
    fotdColLabel: { fontSize: 12, fontFamily: font.medium, color: 'rgba(255,255,255,0.65)' },
    fotdAmount: { fontSize: 22, fontFamily: font.displayHeavy, color: '#fff', marginTop: 2 },

    reportFab: {
      position: 'absolute',
      alignSelf: 'center',
      height: 48,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 20,
      borderRadius: 24,
      backgroundColor: '#FF4D1C',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 12,
      elevation: 6,
    },
    reportFabText: { fontSize: 15, fontFamily: font.bold, color: '#fff' },

    // View Details button

    // Empty
    emptyContainer: { alignItems: 'center', paddingVertical: 48 },
    emptyTitle: { ...type.headline, marginTop: 16, color: ui.textSecondary },
    emptySubtitle: { ...type.label, marginTop: 4, color: ui.textTertiary, textAlign: 'center' },
    footerCta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 16,
      marginBottom: 80,
    },
    footerCtaText: { ...type.labelStrong, color: brand.orangeText },

    // Region Hero Banner
    heroBanner: {
      height: 130,
      borderRadius: radius.xl,
      overflow: 'hidden' as const,
      marginBottom: 16,
      ...cardShadow,
    },
    heroBannerContent: {
      flex: 1,
      justifyContent: 'flex-end' as const,
      padding: 16,
    },
    heroBannerCity: {
      fontSize: 22,
      fontFamily: font.bold,
      color: ui.onBrand,
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
      backgroundColor: ui.card,
      borderRadius: radius.xl,
      padding: 20,
      maxWidth: 340,
    },
    modalTitle: {
      fontSize: 18,
      fontFamily: font.bold,
      color: ui.text,
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
      backgroundColor: brand.orangeSoft,
    },
    modalOptionText: {
      fontSize: 15,
      fontFamily: font.medium,
      color: ui.text,
    },
    modalOptionTextActive: {
      fontFamily: font.semibold,
      color: brand.orangeText,
    },
  })
}
