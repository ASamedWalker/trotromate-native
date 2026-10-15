import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SectionList,
  RefreshControl,
  StyleSheet,
  Modal,
  Pressable,
  Linking,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter, type Href } from 'expo-router'
import { Search, MapPin, X, Plus, ChevronDown, Check, Navigation } from 'lucide-react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { font, brand, ui, space, radius, type, cardShadow } from '@/lib/theme'
import { Button } from '@/components/ui'
import { HeroText } from '@/components/HeroText'
import { AdinkraBand } from '@/components/AdinkraAccent'
import { QueueGlyph } from '@/components/QueueGlyph'
import { REGIONS, REGION_HEROES } from '@/lib/config/regions'
import { useRoutes } from '@/lib/hooks/useRoutes'
import { useQueryClient, useQuery as useRQ } from '@tanstack/react-query'
import { fetchRouteById } from '@/lib/services/routes'
import { useFavorites } from '@/lib/hooks/useFavorites'
import { LineRow } from '@/components/lines/LineRow'
import { useLocation } from '@/lib/hooks/useLocation'
import { fetchStations, type StationWithQueue } from '@/lib/services/stations'
import { QUEUE_COLOR, QUEUE_WORD } from '@/lib/constants/queueStatus'
import { freshness, ageLabel } from '@/lib/utils/freshness'
import { haversineKm } from '@/lib/utils/distance'
import type { RouteWithStats } from '@/lib/types'
import { SkeletonRouteCard } from '@/components/Skeleton'

import { useHaptics } from '@/lib/hooks/useHaptics'
import { useRefreshOnFocus } from '@/lib/hooks/useRefreshOnFocus'
import { useSearchHistory } from '@/lib/hooks/useSearchHistory'

/**
 * Lines (UX v2 canvas "Lines → Proposed", L1–L8). One layout for store and full builds:
 * header "Lines" + region chip + stamp, search, Saved · Near me · All segments with a
 * separate Trotro | Okada toggle, and 72 pt rows in grouped cards. Near me groups the
 * lines by boarding station (walk chip + that station's queue in the group header).
 */

type Segment = 'saved' | 'near' | 'all'
type Mode = 'trotro' | 'okada'

// Stations further than this are not "near" (about a 1 h walk).
const NEAR_KM = 5
const MAX_NEAR_GROUPS = 5
// Accra walking pace with detours: ~80 m a minute.
const WALK_M_PER_MIN = 80

interface StationGroup {
  station: StationWithQueue
  km: number
}
interface LineSection {
  key: string
  group: StationGroup | null
  data: RouteWithStats[]
}

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

function walkLabel(km: number): string {
  const mins = Math.max(1, Math.round((km * 1000) / WALK_M_PER_MIN))
  return mins <= 45 ? `${mins} min walk` : `${km.toFixed(1)} km`
}

export default function RoutesScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ from?: string; to?: string; transport?: string; region?: string; t?: string }>()
  const s = useMemo(() => getStyles(), [])

  const [searchQuery, setSearchQuery] = useState('')
  const [segment, setSegment] = useState<Segment>('near')
  const [mode, setMode] = useState<Mode>('trotro')
  // Tabs stay mounted, so a later push with ?transport= (Home Okada tile) must update too.
  useEffect(() => {
    const t = params.transport
    if (t === 'okada' || t === 'trotro') setMode(t)
    else if (t === 'saved' || t === 'near' || t === 'all') setSegment(t)
    else if (t) setSegment('all')
  }, [params.transport, params.t]) // t = per-tap nonce so a repeat tap re-applies the filter
  const [activeRegion, setActiveRegion] = useState<string>(params.region || 'all')
  const [regionPickerOpen, setRegionPickerOpen] = useState(false)

  const regionParam = activeRegion !== 'all' ? activeRegion : undefined
  // One query for both modes; the Trotro | Okada toggle filters on the client.
  const { routes, isLoading, refetch } = useRoutes(params.from, params.to, undefined, regionParam)
  useRefreshOnFocus([['routes', params.from, params.to, undefined, regionParam]])
  const [refreshing, setRefreshing] = useState(false)
  const { favorites } = useFavorites()
  const favoriteIds = useMemo(() => new Set(favorites.map((f) => f.id)), [favorites])
  const haptics = useHaptics()
  const { addSearch } = useSearchHistory()

  const activeRegionLabel = REGIONS.find((r) => r.key === activeRegion)?.label ?? 'All Regions'

  // ── Near me: stations by distance (GPS), with their live queue stats ──
  const { location, isPermissionGranted, isLoading: locLoading, requestPermission } = useLocation()
  const stationsQ = useRQ({ queryKey: ['stations'], queryFn: fetchStations, staleTime: 2 * 60 * 1000, enabled: segment === 'near' })

  const inGhana = !!location && location.latitude >= 4.5 && location.latitude <= 11.5 && location.longitude >= -3.5 && location.longitude <= 1.5

  // Stamp (L3): only real numbers. Latest fare report across all lines, and how many
  // lines got a report in the last 7 days. No weekly report total exists, so none is shown.
  const stamp = useMemo(() => {
    const now = Date.now()
    let latest = 0
    let week = 0
    for (const r of routes) {
      const at = r.fare_stats?.last_report_at ? new Date(r.fare_stats.last_report_at).getTime() : 0
      if (!Number.isFinite(at) || at <= 0) continue
      if (at > latest) latest = at
      if (now - at <= 7 * 86400000) week++
    }
    if (!latest) return 'GPRTU fares and what riders paid'
    const checked = sameDay(new Date(latest), new Date(now)) ? 'Fares checked today' : `Fares last checked ${ageLabel(new Date(latest).toISOString(), now)}`
    return week > 0 ? `${checked} · ${week} ${week === 1 ? 'line' : 'lines'} reported this week` : checked
  }, [routes])

  // Mode + search + commuter-first sort, shared by every segment.
  const modeRoutes = useMemo(() => {
    let result = routes.filter((r) => (r.transport_type ?? 'trotro') === mode)
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter((r) => r.from_location.toLowerCase().includes(q) || r.to_location.toLowerCase().includes(q))
    }
    // Commuter-fare corridors (<= GH₵30) above intercity ones, stable within each group.
    const COMMUTER_FARE_CEILING = 30
    const fareOf = (r: RouteWithStats) => r.fare_stats?.avg_reported_fare ?? r.official_fare
    return result
      .map((r, index) => ({ r, index }))
      .sort((a, b) => {
        const ac = fareOf(a.r) <= COMMUTER_FARE_CEILING
        const bc = fareOf(b.r) <= COMMUTER_FARE_CEILING
        if (ac !== bc) return ac ? -1 : 1
        return a.index - b.index
      })
      .map(({ r }) => r)
  }, [routes, mode, searchQuery])

  // Near me (L5): lines grouped by the nearest stations they board at.
  const nearSections = useMemo<LineSection[] | null>(() => {
    if (!inGhana || !location || !stationsQ.data) return null
    const near = stationsQ.data
      .filter((st) => st.latitude != null && st.longitude != null)
      .map((st) => ({ station: st, km: haversineKm(location.latitude, location.longitude, Number(st.latitude), Number(st.longitude)) }))
      .filter((g) => g.km <= NEAR_KM)
      .sort((a, b) => a.km - b.km)
    const taken = new Set<string>()
    const out: LineSection[] = []
    for (const g of near) {
      const key = g.station.name.trim().toLowerCase()
      const lines = modeRoutes.filter((r) => {
        if (taken.has(r.id)) return false
        const f = r.from_location.trim().toLowerCase()
        return f === key || key.startsWith(f) || f.startsWith(key)
      })
      if (lines.length === 0) continue
      lines.forEach((r) => taken.add(r.id))
      out.push({ key: g.station.id, group: g, data: lines })
      if (out.length >= MAX_NEAR_GROUPS) break
    }
    return out
  }, [inGhana, location, stationsQ.data, modeRoutes])

  // Why Near me fell back to All (null = it didn't).
  const nearFallback: 'location' | 'none' | 'loading' | null = useMemo(() => {
    if (segment !== 'near') return null
    if (nearSections && nearSections.length > 0) return null
    if (locLoading || (inGhana && stationsQ.isLoading)) return 'loading'
    if (!isPermissionGranted || !inGhana) return 'location'
    return 'none'
  }, [segment, nearSections, locLoading, inGhana, stationsQ.isLoading, isPermissionGranted])

  const sections = useMemo<LineSection[]>(() => {
    if (segment === 'near' && nearSections && nearSections.length > 0) return nearSections
    const data = segment === 'saved' ? modeRoutes.filter((r) => favoriteIds.has(r.id)) : modeRoutes
    return data.length > 0 ? [{ key: 'all', group: null, data }] : []
  }, [segment, nearSections, modeRoutes, favoriteIds])

  // Reset scroll when the query/filter changes so the first match isn't half-hidden
  const listRef = useRef<SectionList<RouteWithStats, LineSection>>(null)
  useEffect(() => {
    listRef.current?.getScrollResponder()?.scrollTo({ y: 0, animated: false })
  }, [searchQuery, segment, mode, activeRegion])

  // Anticipatory prefetch: warm the detail queries for the rows on screen.
  const queryClient = useQueryClient()
  useEffect(() => {
    for (const r of sections.flatMap((sec) => sec.data).slice(0, 6)) {
      queryClient.prefetchQuery({ queryKey: ['route', r.id], queryFn: () => fetchRouteById(r.id) })
    }
  }, [sections, queryClient])

  const selectRegion = useCallback((key: string) => {
    haptics.light()
    setActiveRegion(key)
    setRegionPickerOpen(false)
  }, [haptics])

  const turnOnLocation = useCallback(async () => {
    haptics.light()
    const ok = await requestPermission()
    if (!ok) Linking.openSettings().catch(() => {})
  }, [haptics, requestPermission])

  const openLine = useCallback((item: RouteWithStats) => {
    addSearch({ id: item.id, from: item.from_location, to: item.to_location, transportType: item.transport_type as 'trotro' | 'okada' | undefined })
    router.push({ pathname: '/routes/[id]', params: { id: item.id } })
  }, [addSearch, router])

  const renderItem = useCallback(({ item, index, section }: { item: RouteWithStats; index: number; section: LineSection }) => (
    <LineRow
      item={item}
      saved={favoriteIds.has(item.id)}
      showFrom={!section.group}
      first={index === 0}
      last={index === section.data.length - 1}
      onPress={() => openLine(item)}
    />
  ), [favoriteIds, openLine])

  const renderSectionHeader = useCallback(({ section }: { section: LineSection }) => {
    if (!section.group) return null
    const { station, km } = section.group
    const q = station.queue_stats?.[0]
    const fresh = q ? freshness(q.last_report_at) : 'stale'
    const qColor = q ? QUEUE_COLOR[q.current_status] : ui.textTertiary
    return (
      <View style={s.groupHead}>
        <Text style={s.groupName} numberOfLines={2}>{station.name}</Text>
        <View style={s.walkChip}><Text style={s.walkChipText}>{walkLabel(km)}</Text></View>
        <View style={s.groupQueue}>
          {q && fresh !== 'stale' ? (
            <>
              <QueueGlyph status={q.current_status} color={qColor} size={14} opacity={fresh === 'aging' ? 0.8 : 1} />
              <Text style={[s.groupQueueText, { color: qColor }]} numberOfLines={1}>
                {QUEUE_WORD[q.current_status].replace(/ queue$/, '')} · {ageLabel(q.last_report_at)}
              </Text>
            </>
          ) : (
            <Text style={[s.groupQueueText, { color: ui.textTertiary, fontFamily: font.medium }]} numberOfLines={1}>No recent queue</Text>
          )}
        </View>
      </View>
    )
  }, [s])

  const header = (
    // Adinkra header band (owner rule: every header carries Adinkra), behind title → segments.
    <AdinkraBand patternHeight={300} style={s.header}>
      {/* L3: title and region chip share one row */}
      <View style={s.headerRow}>
        <HeroText size={28} style={{ color: ui.text }} accessibilityRole="header">Lines</HeroText>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => { haptics.light(); setRegionPickerOpen(true) }}
          style={s.regionChip}
          accessibilityRole="button"
          accessibilityLabel={`Region: ${activeRegionLabel}. Change region`}
          hitSlop={{ top: 6, bottom: 6 }}
        >
          <Text style={s.regionChipText}>{activeRegionLabel}</Text>
          <ChevronDown size={16} color={brand.orangeText} />
        </TouchableOpacity>
      </View>
      <Text style={s.stamp}>{stamp}</Text>

      <View style={s.searchBar}>
        <Search size={20} color={ui.textSecondary} />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search a station or line"
          placeholderTextColor={ui.textSecondary}
          style={s.searchInput}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={12} accessibilityRole="button" accessibilityLabel="Clear search">
            <X size={18} color={ui.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      {/* L4: segments and mode no longer share one clipped chip row */}
      <View style={s.controls}>
        <View style={[s.segWrap, { flex: 1 }]} accessibilityRole="tablist">
          {([['saved', 'Saved'], ['near', 'Near me'], ['all', 'All']] as [Segment, string][]).map(([k, label]) => {
            const on = segment === k
            return (
              <TouchableOpacity
                key={k}
                onPress={() => { haptics.light(); setSegment(k) }}
                style={[s.seg, { flex: 1 }, on && s.segOn]}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                hitSlop={{ top: 4, bottom: 4 }}
              >
                <Text style={s.segText} numberOfLines={1}>{label}</Text>
              </TouchableOpacity>
            )
          })}
        </View>
        <View style={s.segWrap} accessibilityRole="tablist">
          {([['trotro', 'Trotro'], ['okada', 'Okada']] as [Mode, string][]).map(([k, label]) => {
            const on = mode === k
            return (
              <TouchableOpacity
                key={k}
                onPress={() => { haptics.light(); setMode(k) }}
                style={[s.seg, { paddingHorizontal: 10 }, on && s.modeOn]}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                hitSlop={{ top: 4, bottom: 4 }}
              >
                <Text style={[s.segText, on && { color: '#FFFFFF' }]}>{label}</Text>
              </TouchableOpacity>
            )
          })}
        </View>
      </View>

      {(params.from || params.to) && (
        <View style={s.filterRow}>
          <MapPin size={14} color={brand.orangeText} />
          <Text style={s.filterText}>
            Showing: {params.from || 'Any'} {'→'} {params.to || 'Any'}
          </Text>
        </View>
      )}
    </AdinkraBand>
  )

  const listHeader = (
    <>
      {nearFallback === 'location' ? (
        <TouchableOpacity onPress={turnOnLocation} activeOpacity={0.8} style={s.hint} accessibilityRole="button" accessibilityLabel="Turn on location to see lines from the stations near you. Showing all lines for now.">
          <Navigation size={20} color={brand.orangeText} />
          <View style={{ flex: 1 }}>
            <Text style={s.hintTitle}>Turn on location</Text>
            <Text style={s.hintText}>To group lines by the stations near you. Showing all lines for now.</Text>
          </View>
        </TouchableOpacity>
      ) : nearFallback === 'none' ? (
        <View style={s.hint}>
          <Navigation size={20} color={brand.orangeText} />
          <View style={{ flex: 1 }}>
            <Text style={s.hintTitle}>No {mode === 'okada' ? 'okada' : 'trotro'} lines start near you yet</Text>
            <Text style={s.hintText}>Showing all lines.</Text>
          </View>
        </View>
      ) : null}
      {activeRegion !== 'all' ? (() => {
        const hero = REGION_HEROES.find((h) => h.key === activeRegion)
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
            <LinearGradient colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.6)']} style={StyleSheet.absoluteFillObject} />
            <View style={s.heroBannerContent}>
              <Text style={s.heroBannerCity}>{hero.label}</Text>
              <Text style={s.heroBannerTagline}>{hero.tagline}</Text>
            </View>
          </View>
        )
      })() : null}
    </>
  )

  return (
    // Rendered inside the Lines tab, which already pads the top safe area
    <SafeAreaView style={s.container} edges={['bottom']}>
      {header}

      {isLoading && routes.length === 0 ? (
        <View style={{ paddingHorizontal: space.xl, paddingTop: 12 }}>
          <SkeletonRouteCard isDark={false} />
          <SkeletonRouteCard isDark={false} />
          <SkeletonRouteCard isDark={false} />
        </View>
      ) : (
        <SectionList
          ref={listRef}
          sections={sections}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          renderSectionFooter={() => <View style={{ height: 6 }} />}
          stickySectionHeadersEnabled={false}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: space.xl, paddingTop: 6, paddingBottom: 90 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={listHeader}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true)
                await Promise.all([refetch(), segment === 'near' ? stationsQ.refetch() : Promise.resolve()])
                setRefreshing(false)
              }}
              tintColor={brand.orange}
              colors={[brand.orange]}
            />
          }
          ListEmptyComponent={
            <View style={s.emptyContainer}>
              <MapPin size={48} color={ui.textTertiary} />
              <Text style={s.emptyTitle}>
                {segment === 'saved' ? 'No saved lines' : mode === 'okada' ? 'No okada lines found' : 'No lines found'}
              </Text>
              <Text style={s.emptySubtitle}>
                {segment === 'saved' ? 'Tap the heart on a line to save it' : 'Try a different search or region'}
              </Text>
              {segment !== 'saved' && (
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
            sections.length > 0 ? (
              <TouchableOpacity onPress={() => router.push('/report/fare' as Href)} activeOpacity={0.7} style={s.footerCta} accessibilityRole="button">
                <Plus size={16} color={brand.orangeText} />
                <Text style={s.footerCtaText}>Can&apos;t find your line? Add it</Text>
              </TouchableOpacity>
            ) : null
          }
        />
      )}

      {/* Region Picker Modal */}
      <Modal visible={regionPickerOpen} transparent animationType="fade" onRequestClose={() => setRegionPickerOpen(false)}>
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
                  <Text style={[s.modalOptionText, isActive && s.modalOptionTextActive]}>{region.label}</Text>
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

    // Header (L3/L4) — mockup gutter is 20
    header: { paddingHorizontal: space.xl, paddingTop: 4, paddingBottom: 12 },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    regionChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      height: 36,
      paddingHorizontal: 14,
      borderRadius: radius.pill,
      backgroundColor: brand.orangeSoft,
    },
    regionChipText: { fontFamily: font.semibold, fontSize: 15, color: brand.orangeText },
    stamp: { fontFamily: font.medium, fontSize: 13, color: ui.textTertiary },

    searchBar: {
      marginTop: 10,
      height: 48,
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 14,
      paddingHorizontal: 14,
      backgroundColor: ui.surface,
      gap: 10,
    },
    searchInput: { flex: 1, fontSize: 16, color: ui.text, fontFamily: font.regular, padding: 0 },

    controls: { flexDirection: 'row', gap: 8, marginTop: 10 },
    segWrap: { flexDirection: 'row', height: 40, backgroundColor: ui.surface, borderRadius: 12, padding: 3 },
    seg: { borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
    segOn: {
      backgroundColor: ui.card,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 3,
      elevation: 1,
    },
    modeOn: { backgroundColor: ui.text },
    segText: { fontFamily: font.bold, fontSize: 14, color: ui.text },

    filterRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
    filterText: { ...type.label, marginLeft: 4, color: ui.textSecondary },

    // Near me group header (L5)
    groupHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, marginBottom: 8, flexWrap: 'wrap' },
    groupName: { fontFamily: font.bold, fontSize: 16, color: ui.text, flexShrink: 1 },
    walkChip: { height: 24, borderRadius: radius.pill, paddingHorizontal: 10, backgroundColor: ui.surface, justifyContent: 'center' },
    walkChipText: { fontFamily: font.semibold, fontSize: 12, color: ui.text },
    groupQueue: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto' },
    groupQueueText: { fontFamily: font.bold, fontSize: 13 },

    hint: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: brand.orangeSoft,
      borderRadius: radius.lg,
      padding: 14,
      minHeight: 48,
      marginTop: 4,
      marginBottom: 10,
    },
    hintTitle: { fontFamily: font.bold, fontSize: 16, color: ui.text },
    hintText: { fontFamily: font.medium, fontSize: 13, color: ui.textTertiary },

    // Empty
    emptyContainer: { alignItems: 'center', paddingVertical: 48 },
    emptyTitle: { ...type.headline, marginTop: 16, color: ui.textSecondary },
    emptySubtitle: { ...type.label, marginTop: 4, color: ui.textTertiary, textAlign: 'center' },
    footerCta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      minHeight: 48,
      paddingVertical: 12,
      marginBottom: 80,
    },
    footerCtaText: { ...type.labelStrong, color: brand.orangeText },

    // Region Hero Banner
    heroBanner: {
      height: 130,
      borderRadius: radius.xl,
      overflow: 'hidden' as const,
      marginBottom: 12,
      ...cardShadow,
    },
    heroBannerContent: { flex: 1, justifyContent: 'flex-end' as const, padding: 16 },
    heroBannerCity: { fontSize: 22, fontFamily: font.bold, color: ui.onBrand },
    heroBannerTagline: { fontSize: 13, fontFamily: font.regular, color: 'rgba(255,255,255,0.8)', marginTop: 2 },

    // Region picker modal
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      padding: 40,
    },
    modalContent: { width: '100%' as const, backgroundColor: ui.card, borderRadius: radius.xl, padding: 20, maxWidth: 340 },
    modalTitle: { fontSize: 18, fontFamily: font.bold, color: ui.text, marginBottom: 16, textAlign: 'center' as const },
    modalOption: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      minHeight: 48,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 12,
      marginBottom: 4,
    },
    modalOptionActive: { backgroundColor: brand.orangeSoft },
    modalOptionText: { fontSize: 15, fontFamily: font.medium, color: ui.text },
    modalOptionTextActive: { fontFamily: font.semibold, color: brand.orangeText },
  })
}
