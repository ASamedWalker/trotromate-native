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
import { Search, X } from 'lucide-react-native'
import { c, themed, font } from '@/lib/theme'
import { SortTabs, type SortTab } from './SortTabs'
import { StationCard } from './StationCard'
import type { StationWithQueue } from '@/lib/services/stations'

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

    const snapPoints = useMemo(() => ['28%', '55%', '88%'], [])

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
      [search, onSearchChange, activeTab, onChangeTab, isDark, t, stations.length],
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
        index={0}
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
})
