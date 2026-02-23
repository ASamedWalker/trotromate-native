import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  useColorScheme,
  RefreshControl,
} from 'react-native'
import BottomSheet, { BottomSheetFlatList } from '@gorhom/bottom-sheet'
import { Search, X, Zap } from 'lucide-react-native'
import { c, themed, font } from '@/lib/theme'
import { SortTabs, type SortTab } from './SortTabs'
import { StationCard } from './StationCard'
import { QueueStatusBar } from './QueueStatusBar'
import type { StationWithQueue } from '@/lib/services/stations'

type QueueStatus = 'empty' | 'short' | 'moderate' | 'long' | 'very_long'

const QUEUE_CONFIG: Record<QueueStatus, { label: string; estimate: string }> = {
  empty: { label: 'Empty', estimate: 'No wait' },
  short: { label: 'Short', estimate: '~5 min' },
  moderate: { label: 'Moderate', estimate: '~15 min' },
  long: { label: 'Long', estimate: '~30 min' },
  very_long: { label: 'Very Long', estimate: '45+ min' },
}

const QUEUE_COLORS: Record<QueueStatus, string> = {
  empty: '#22c55e',
  short: '#22c55e',
  moderate: '#f59e0b',
  long: '#f97316',
  very_long: '#ef4444',
}

function stationLabel(name: string): string {
  if (name === '37 Military Hospital') return '37 Station'
  if (name.endsWith('Station')) return name
  return `${name} Station`
}

interface StationWithCoords extends StationWithQueue {
  _lat: number
  _lng: number
}

export interface StationBottomSheetRef {
  snapToIndex: (index: number) => void
  scrollToIndex: (index: number) => void
}

interface StationBottomSheetProps {
  stations: StationWithCoords[]
  selectedStationId: string | null
  onSelectStation: (station: StationWithCoords) => void
  search: string
  onSearchChange: (query: string) => void
  activeTab: SortTab
  onChangeTab: (tab: SortTab) => void
  isLoading: boolean
  onRefresh: () => void
  getDistance: (station: StationWithCoords) => number | null
  bestPick: StationWithCoords | null
}

export const StationBottomSheet = forwardRef<StationBottomSheetRef, StationBottomSheetProps>(
  function StationBottomSheet(
    {
      stations,
      selectedStationId,
      onSelectStation,
      search,
      onSearchChange,
      activeTab,
      onChangeTab,
      isLoading,
      onRefresh,
      getDistance,
      bestPick,
    },
    ref,
  ) {
    const colorScheme = useColorScheme()
    const isDark = colorScheme === 'dark'
    const t = themed(isDark)
    const sheetRef = useRef<BottomSheet>(null)
    const flatListRef = useRef<any>(null)

    useImperativeHandle(ref, () => ({
      snapToIndex: (index: number) => sheetRef.current?.snapToIndex(index),
      scrollToIndex: (index: number) => {
        flatListRef.current?.scrollToIndex?.({ index, animated: true })
      },
    }))

    const snapPoints = useMemo(() => ['25%', '55%', '88%'], [])

    const renderItem = useCallback(
      ({ item }: { item: StationWithCoords }) => (
        <StationCard
          station={item}
          distanceKm={getDistance(item)}
          isSelected={item.id === selectedStationId}
          onPress={() => onSelectStation(item)}
          isDark={isDark}
        />
      ),
      [selectedStationId, onSelectStation, isDark, getDistance],
    )

    const keyExtractor = useCallback((item: StationWithCoords) => item.id, [])

    // Best pick queue info
    const bestPickStatus = bestPick?.queue_stats?.[0]?.current_status as QueueStatus | undefined
    const bestPickConfig = bestPickStatus ? QUEUE_CONFIG[bestPickStatus] : null
    const bestPickColor = bestPickStatus ? QUEUE_COLORS[bestPickStatus] : undefined

    const ListHeader = useMemo(
      () => (
        <View style={styles.sheetHeader}>
          {/* Search */}
          <View style={[styles.searchBar, { backgroundColor: isDark ? c.stone800 : c.stone100 }]}>
            <Search size={18} color={c.stone400} />
            <TextInput
              style={[styles.searchInput, { color: t.text }]}
              value={search}
              onChangeText={onSearchChange}
              placeholder="Search stations..."
              placeholderTextColor={c.stone400}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => onSearchChange('')}>
                <X size={16} color={c.stone400} />
              </TouchableOpacity>
            )}
          </View>

          {/* Best Pick card */}
          {bestPick && bestPickConfig && bestPickColor && !search && (
            <TouchableOpacity
              style={[
                styles.bestPick,
                {
                  backgroundColor: isDark ? '#1a1a0f' : '#fffef5',
                  borderColor: c.amber500,
                },
              ]}
              onPress={() => onSelectStation(bestPick)}
              activeOpacity={0.7}
            >
              <View style={styles.bestPickHeader}>
                <View style={styles.bestPickBadge}>
                  <Zap size={12} color={c.amber500} />
                  <Text style={styles.bestPickBadgeText}>BEST RIGHT NOW</Text>
                </View>
              </View>
              <Text style={[styles.bestPickName, { color: t.text }]}>
                {stationLabel(bestPick.name)}
              </Text>
              <View style={styles.bestPickBarRow}>
                <QueueStatusBar status={bestPickStatus ?? null} isDark={isDark} />
              </View>
              <View style={styles.bestPickStatus}>
                <View style={[styles.bestPickDot, { backgroundColor: bestPickColor }]} />
                <Text style={[styles.bestPickLabel, { color: bestPickColor }]}>
                  {bestPickConfig.label} queue
                </Text>
                <Text style={[styles.bestPickEstimate, { color: t.textSecondary }]}>
                  · {bestPickConfig.estimate}
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Sort tabs */}
          <View style={styles.tabsRow}>
            <SortTabs activeTab={activeTab} onChangeTab={onChangeTab} isDark={isDark} />
          </View>

          {/* Count */}
          <Text style={[styles.countText, { color: t.textTertiary }]}>
            {stations.length} station{stations.length !== 1 ? 's' : ''}
          </Text>
        </View>
      ),
      [search, onSearchChange, activeTab, onChangeTab, isDark, t, stations.length, bestPick, bestPickConfig, bestPickColor, bestPickStatus, onSelectStation],
    )

    const ListEmpty = useMemo(
      () =>
        isLoading ? (
          <View style={styles.emptyContainer}>
            <ActivityIndicator size="large" color={c.amber500} />
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: t.textSecondary }]}>
              {search ? 'No stations match your search' : 'No stations available'}
            </Text>
          </View>
        ),
      [isLoading, search, t],
    )

    return (
      <BottomSheet
        ref={sheetRef}
        index={1}
        snapPoints={snapPoints}
        backgroundStyle={{ backgroundColor: t.card, borderRadius: 24 }}
        handleIndicatorStyle={{ backgroundColor: isDark ? c.stone600 : c.stone300, width: 40 }}
        enableDynamicSizing={false}
      >
        <BottomSheetFlatList
          ref={flatListRef}
          data={stations}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={ListEmpty}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={onRefresh}
              tintColor={c.amber500}
              colors={[c.amber500]}
            />
          }
        />
      </BottomSheet>
    )
  },
)

const styles = StyleSheet.create({
  sheetHeader: {
    paddingTop: 4,
    paddingBottom: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: font.regular,
    padding: 0,
  },
  tabsRow: {
    marginHorizontal: 16,
    marginTop: 10,
  },
  countText: {
    fontSize: 11,
    fontFamily: font.medium,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
  },
  listContent: {
    paddingBottom: 40,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: font.medium,
  },
  bestPick: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 16,
    marginTop: 12,
  },
  bestPickHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  bestPickBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245,158,11,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  bestPickBadgeText: {
    fontSize: 10,
    fontFamily: font.bold,
    color: c.amber500,
    letterSpacing: 0.6,
  },
  bestPickName: {
    fontSize: 16,
    fontFamily: font.bold,
  },
  bestPickBarRow: {
    marginTop: 8,
  },
  bestPickStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
  },
  bestPickDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  bestPickLabel: {
    fontSize: 13,
    fontFamily: font.semibold,
  },
  bestPickEstimate: {
    fontSize: 12,
    fontFamily: font.regular,
  },
})
