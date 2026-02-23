import { useState, useCallback, useMemo, useRef } from 'react'
import {
  View,
  TouchableOpacity,
  useColorScheme,
  StyleSheet,
} from 'react-native'
import { useRouter } from 'expo-router'
import { ChevronLeft } from 'lucide-react-native'
import Mapbox from '@rnmapbox/maps'
import * as Haptics from 'expo-haptics'
import { c, themed } from '@/lib/theme'
import { useStations } from '@/lib/hooks/useStations'
import { getStationCoords } from '@/lib/utils/station-coords'
import { StationBottomSheet, type StationBottomSheetRef } from '@/components/stations/StationBottomSheet'
import type { SortTab } from '@/components/stations/SortTabs'
import type { StationWithQueue } from '@/lib/services/stations'

// Public token for map rendering
Mapbox.setAccessToken('pk.eyJ1Ijoic2FtcHkxIiwiYSI6ImNranl2NHNjdTAxZzQzMWxldmx5dGhkaDEifQ.1eOzL1554nbXGIPai5Kmlg')

type QueueStatus = 'empty' | 'short' | 'moderate' | 'long' | 'very_long'

const TROSKI_ORANGE = '#e88a3a'

const QUEUE_COLORS: Record<QueueStatus, string> = {
  empty: '#22c55e',
  short: '#22c55e',
  moderate: '#f59e0b',
  long: '#f97316',
  very_long: '#ef4444',
}

const QUEUE_SEVERITY: Record<string, number> = {
  empty: 0,
  short: 1,
  moderate: 2,
  long: 3,
  very_long: 4,
}

function getStationColor(station: StationWithQueue): string {
  const queueStatus = station.queue_stats?.[0]?.current_status as QueueStatus | undefined
  return queueStatus ? QUEUE_COLORS[queueStatus] : TROSKI_ORANGE
}

interface StationWithCoords extends StationWithQueue {
  _lat: number
  _lng: number
}

/* ── Main Screen ────────────────────────────────────── */

export default function StationsScreen() {
  const router = useRouter()
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const t = themed(isDark)

  const { stations, isLoading, refetch } = useStations()
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<SortTab>('nearest')
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null)

  const cameraRef = useRef<Mapbox.Camera>(null)
  const sheetRef = useRef<StationBottomSheetRef>(null)

  // Resolve coordinates: use DB values or fallback to curated list
  const stationsWithCoords = useMemo(() => {
    return stations
      .map((st) => {
        const coords = getStationCoords(st)
        if (!coords) return null
        return { ...st, _lat: coords.latitude, _lng: coords.longitude }
      })
      .filter(Boolean) as StationWithCoords[]
  }, [stations])

  // Filter by search
  const filteredStations = useMemo(() => {
    if (!search) return stationsWithCoords
    const q = search.toLowerCase()
    return stationsWithCoords.filter((st) => st.name.toLowerCase().includes(q))
  }, [stationsWithCoords, search])

  // Sort by active tab
  const sortedStations = useMemo(() => {
    const copy = [...filteredStations]
    if (activeTab === 'shortest') {
      copy.sort((a, b) => {
        const aStatus = a.queue_stats?.[0]?.current_status
        const bStatus = b.queue_stats?.[0]?.current_status
        const aSev = aStatus ? (QUEUE_SEVERITY[aStatus] ?? 99) : 99
        const bSev = bStatus ? (QUEUE_SEVERITY[bStatus] ?? 99) : 99
        if (aSev !== bSev) return aSev - bSev
        // Within same severity, freshest first
        const aTime = a.queue_stats?.[0]?.last_report_at ?? ''
        const bTime = b.queue_stats?.[0]?.last_report_at ?? ''
        return bTime.localeCompare(aTime)
      })
    } else {
      // "Nearest" Phase 1: major stations first, then alphabetical
      copy.sort((a, b) => {
        if (a.is_major !== b.is_major) return a.is_major ? -1 : 1
        return a.name.localeCompare(b.name)
      })
    }
    return copy
  }, [filteredStations, activeTab])

  // Best pick: station with shortest queue, or top major station if no queue data
  const bestPick = useMemo(() => {
    if (!stationsWithCoords.length) return null
    const withReports = stationsWithCoords.filter(
      (st) => st.queue_stats?.[0]?.current_status,
    )
    if (withReports.length) {
      withReports.sort((a, b) => {
        const aSev = QUEUE_SEVERITY[a.queue_stats![0].current_status] ?? 99
        const bSev = QUEUE_SEVERITY[b.queue_stats![0].current_status] ?? 99
        return aSev - bSev
      })
      return withReports[0]
    }
    // No queue data — pick the first major station
    return stationsWithCoords.find((st) => st.is_major) ?? stationsWithCoords[0]
  }, [stationsWithCoords])

  // Build GeoJSON for map dots (filtered by search)
  const geojson = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: filteredStations.map((station) => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [station._lng, station._lat],
        },
        properties: {
          id: station.id,
          name: station.name,
          isMajor: station.is_major ? 1 : 0,
          color: getStationColor(station),
          selected: station.id === selectedStationId ? 1 : 0,
        },
      })),
    }),
    [filteredStations, selectedStationId],
  )

  // Distance calculator (Phase 1: no GPS, return null)
  const getDistance = useCallback((_station: StationWithCoords) => {
    return null as number | null
  }, [])

  // ── Bidirectional selection ──

  // Map dot tap → select + scroll sheet to card
  const handleShapePress = useCallback(
    (event: any) => {
      const feature = event?.features?.[0]
      if (!feature?.properties?.id) return

      const stationId = feature.properties.id
      const station = filteredStations.find((s) => s.id === stationId)
      if (!station) return

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      setSelectedStationId(stationId)

      // Zoom map to station
      cameraRef.current?.setCamera({
        centerCoordinate: [station._lng, station._lat],
        zoomLevel: 14,
        animationDuration: 500,
      })

      // Snap sheet to half + scroll to card
      sheetRef.current?.snapToIndex(1)
      const idx = sortedStations.findIndex((s) => s.id === stationId)
      if (idx >= 0) {
        setTimeout(() => {
          sheetRef.current?.scrollToIndex(idx)
        }, 300)
      }
    },
    [filteredStations, sortedStations],
  )

  // Card tap → select + zoom map + snap sheet to half
  const handleSelectStation = useCallback(
    (station: StationWithCoords) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      setSelectedStationId(station.id)

      cameraRef.current?.setCamera({
        centerCoordinate: [station._lng, station._lat],
        zoomLevel: 14,
        animationDuration: 500,
      })

      sheetRef.current?.snapToIndex(1)
    },
    [],
  )

  // Refresh handler
  const handleRefresh = useCallback(() => {
    refetch()
  }, [refetch])

  return (
    <View style={styles.container}>
      {/* Full-screen map */}
      <Mapbox.MapView
        style={styles.map}
        styleURL={isDark ? Mapbox.StyleURL.Dark : Mapbox.StyleURL.Street}
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled
        scaleBarEnabled={false}
        onPress={() => setSelectedStationId(null)}
      >
        <Mapbox.Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: [-0.187, 5.6037],
            zoomLevel: 12,
          }}
        />

        {/* User location blue dot */}
        <Mapbox.UserLocation visible animated />

        {/* Station dots — native rendering, no iOS crashes */}
        <Mapbox.ShapeSource
          id="stations"
          shape={geojson}
          onPress={handleShapePress}
        >
          {/* White border circle */}
          <Mapbox.CircleLayer
            id="station-border"
            style={{
              circleRadius: [
                'case',
                ['==', ['get', 'selected'], 1], 12,
                ['==', ['get', 'isMajor'], 1], 10,
                7,
              ],
              circleColor: '#ffffff',
              circleStrokeWidth: 0,
            }}
          />
          {/* Colored inner circle */}
          <Mapbox.CircleLayer
            id="station-dot"
            style={{
              circleRadius: [
                'case',
                ['==', ['get', 'selected'], 1], 9,
                ['==', ['get', 'isMajor'], 1], 7,
                5,
              ],
              circleColor: ['get', 'color'],
              circleStrokeWidth: [
                'case',
                ['==', ['get', 'selected'], 1], 2,
                0,
              ],
              circleStrokeColor: c.amber500,
            }}
          />
          {/* Major station labels — always visible */}
          <Mapbox.SymbolLayer
            id="station-labels-major"
            filter={['==', ['get', 'isMajor'], 1]}
            style={{
              textField: ['get', 'name'],
              textSize: 13,
              textFont: ['Open Sans Bold', 'Arial Unicode MS Bold'],
              textAnchor: 'top',
              textOffset: [0, 1.2],
              textColor: isDark ? c.stone200 : c.stone800,
              textHaloColor: isDark ? c.stone900 : '#ffffff',
              textHaloWidth: 2,
              textAllowOverlap: false,
              textOptional: true,
            }}
          />
          {/* Minor station labels — only at higher zoom */}
          <Mapbox.SymbolLayer
            id="station-labels-minor"
            minZoomLevel={13}
            filter={['==', ['get', 'isMajor'], 0]}
            style={{
              textField: ['get', 'name'],
              textSize: 11,
              textFont: ['Open Sans Bold', 'Arial Unicode MS Bold'],
              textAnchor: 'top',
              textOffset: [0, 1.2],
              textColor: isDark ? c.stone200 : c.stone800,
              textHaloColor: isDark ? c.stone900 : '#ffffff',
              textHaloWidth: 1.5,
              textAllowOverlap: false,
              textOptional: true,
            }}
          />
        </Mapbox.ShapeSource>
      </Mapbox.MapView>

      {/* Floating back button */}
      <TouchableOpacity
        style={[styles.backBtn, { backgroundColor: t.card }]}
        onPress={() => router.back()}
        activeOpacity={0.7}
      >
        <ChevronLeft size={22} color={t.text} />
      </TouchableOpacity>

      {/* Bottom sheet with station list */}
      <StationBottomSheet
        ref={sheetRef}
        stations={sortedStations}
        selectedStationId={selectedStationId}
        onSelectStation={handleSelectStation}
        search={search}
        onSearchChange={setSearch}
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        isLoading={isLoading}
        onRefresh={handleRefresh}
        getDistance={getDistance}
        bestPick={bestPick}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  backBtn: {
    position: 'absolute',
    top: 56,
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
})
