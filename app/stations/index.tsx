import { useState, useCallback, useMemo, useRef } from 'react'
import {
  View,
  TouchableOpacity,
  useColorScheme,
  StyleSheet,
} from 'react-native'
import { useRouter } from 'expo-router'
import { ChevronLeft, Layers, BusFront, TrainFront, Car } from 'lucide-react-native'
import Mapbox from '@rnmapbox/maps'
import * as Haptics from 'expo-haptics'
import { c, themed } from '@/lib/theme'
import { useStations } from '@/lib/hooks/useStations'
import { getStationCoords } from '@/lib/utils/station-coords'
import { useTransportStops, useTransportRoutes } from '@/lib/hooks/useTransportData'
import { findNearbyStops, type NearbyStop } from '@/lib/utils/nearby-stops'
import { StationBottomSheet, type StationBottomSheetRef } from '@/components/stations/StationBottomSheet'
import { RouteInfoCard } from '@/components/stations/RouteInfoCard'
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
  const transportStops = useTransportStops()
  const transportRoutes = useTransportRoutes()
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<SortTab>('nearest')
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null)
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null)
  const [showTransportLayer, setShowTransportLayer] = useState(true)

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

  // Transport stops GeoJSON (decorative layer)
  const transportStopsGeojson = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: transportStops.map((stop) => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [stop.lng, stop.lat],
        },
        properties: {
          name: stop.name || '',
          stopType: stop.type,
        },
      })),
    }),
    [transportStops],
  )

  // Transport routes GeoJSON (corridor lines)
  const transportRoutesGeojson = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: transportRoutes.map((route, idx) => ({
        type: 'Feature' as const,
        geometry: {
          type: 'LineString' as const,
          coordinates: route.coordinates,
        },
        properties: {
          osmId: route.osm_id,
          name: route.name || route.ref || '',
          ref: route.ref || '',
          from: route.from || '',
          to: route.to || '',
          routeType: route.type,
          colorIndex: idx % 6,
        },
      })),
    }),
    [transportRoutes],
  )

  // Nearby stops for selected station
  const selectedNearbyStops = useMemo((): NearbyStop[] => {
    if (!selectedStationId || !transportStops.length) return []
    const station = stationsWithCoords.find((s) => s.id === selectedStationId)
    if (!station) return []
    return findNearbyStops(station._lat, station._lng, transportStops)
  }, [selectedStationId, stationsWithCoords, transportStops])

  // Selected route object for info card
  const selectedRoute = useMemo(() => {
    if (!selectedRouteId) return null
    return transportRoutes.find((r) => r.osm_id === selectedRouteId) ?? null
  }, [selectedRouteId, transportRoutes])

  // Distance calculator (Phase 1: no GPS, return null)
  const getDistance = useCallback((_station: StationWithCoords) => {
    return null as number | null
  }, [])

  // ── Bidirectional selection ──

  // Route corridor tap → select + fit camera to route bounds
  const handleRoutePress = useCallback(
    (event: any) => {
      const feature = event?.features?.[0]
      if (!feature?.properties?.osmId) return

      const osmId = feature.properties.osmId
      const route = transportRoutes.find((r) => r.osm_id === osmId)
      if (!route) return

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      setSelectedStationId(null)
      setSelectedRouteId(osmId)
      sheetRef.current?.snapToIndex(0)

      // Fit camera to route bounds
      const lngs = route.coordinates.map((coord) => coord[0])
      const lats = route.coordinates.map((coord) => coord[1])
      cameraRef.current?.fitBounds(
        [Math.max(...lngs), Math.max(...lats)],
        [Math.min(...lngs), Math.min(...lats)],
        [60, 60, 200, 60],
        500,
      )
    },
    [transportRoutes],
  )

  // Map dot tap → select + scroll sheet to card
  const handleShapePress = useCallback(
    (event: any) => {
      const feature = event?.features?.[0]
      if (!feature?.properties?.id) return

      const stationId = feature.properties.id
      const station = filteredStations.find((s) => s.id === stationId)
      if (!station) return

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      setSelectedRouteId(null)
      setSelectedStationId(stationId)

      // Zoom map to station with 3D tilt
      cameraRef.current?.setCamera({
        centerCoordinate: [station._lng, station._lat],
        zoomLevel: 15,
        pitch: 50,
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
      setSelectedRouteId(null)
      setSelectedStationId(station.id)

      cameraRef.current?.setCamera({
        centerCoordinate: [station._lng, station._lat],
        zoomLevel: 15,
        pitch: 50,
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
        onPress={() => { setSelectedStationId(null); setSelectedRouteId(null) }}
      >
        <Mapbox.Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: [-0.187, 5.6037],
            zoomLevel: 12,
            pitch: 45,
          }}
        />

        {/* Custom transport icons rendered from React Native views */}
        <Mapbox.Images>
          <Mapbox.Image name="trotro-icon">
            <View style={styles.transportIcon}>
              <BusFront size={32} color="#d97706" strokeWidth={2.5} />
            </View>
          </Mapbox.Image>
          <Mapbox.Image name="lorry-park-icon">
            <View style={styles.transportIcon}>
              <BusFront size={36} color="#16a34a" strokeWidth={2.5} />
            </View>
          </Mapbox.Image>
          <Mapbox.Image name="train-icon">
            <View style={styles.transportIcon}>
              <TrainFront size={36} color="#2563eb" strokeWidth={2.5} />
            </View>
          </Mapbox.Image>
          <Mapbox.Image name="taxi-icon">
            <View style={styles.transportIcon}>
              <Car size={32} color="#eab308" strokeWidth={2.5} />
            </View>
          </Mapbox.Image>
        </Mapbox.Images>

        {/* 3D buildings — visible at zoom 14+ */}
        <Mapbox.FillExtrusionLayer
          id="3d-buildings"
          sourceID="composite"
          sourceLayerID="building"
          minZoomLevel={14}
          maxZoomLevel={24}
          style={{
            fillExtrusionColor: isDark ? c.stone700 : '#ddd',
            fillExtrusionHeight: ['get', 'height'],
            fillExtrusionBase: ['get', 'min_height'],
            fillExtrusionOpacity: isDark ? 0.5 : 0.6,
          }}
        />

        {/* Enhanced POI icons — pharmacies, police, mosques, schools, etc. */}
        <Mapbox.SymbolLayer
          id="poi-icons-enhanced"
          sourceID="composite"
          sourceLayerID="poi_label"
          minZoomLevel={14}
          maxZoomLevel={24}
          filter={[
            'match',
            ['get', 'maki'],
            [
              'hospital', 'pharmacy', 'doctor',
              'police',
              'school', 'college',
              'religious-muslim', 'religious-christian',
              'bank', 'atm',
              'fuel',
              'grocery', 'marketplace',
              'post',
              'fire-station',
              'library',
              'town-hall',
            ],
            true,
            false,
          ]}
          style={{
            iconImage: ['concat', ['get', 'maki'], '-15'],
            iconSize: [
              'interpolate', ['linear'], ['zoom'],
              14, 1.0,
              16, 1.3,
              18, 1.5,
            ],
            iconAllowOverlap: false,
            iconPadding: 4,
            textField: ['get', 'name'],
            textSize: [
              'interpolate', ['linear'], ['zoom'],
              14, 9,
              16, 11,
              18, 12,
            ],
            textFont: ['Open Sans Regular', 'Arial Unicode MS Regular'],
            textAnchor: 'top',
            textOffset: [0, 1.2],
            textColor: isDark ? c.stone300 : c.stone600,
            textHaloColor: isDark ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.9)',
            textHaloWidth: 1.5,
            textAllowOverlap: false,
            textOptional: true,
            textMaxWidth: 8,
          }}
        />

        {/* User location blue dot */}
        <Mapbox.UserLocation visible animated />

        {/* Transport route corridors — tappable lines */}
        {showTransportLayer && (
          <Mapbox.ShapeSource
            id="transport-routes"
            shape={transportRoutesGeojson}
            onPress={handleRoutePress}
            hitbox={{ width: 20, height: 20 }}
          >
            {/* Glow behind selected route (filter matches nothing when no selection) */}
            <Mapbox.LineLayer
              id="transport-route-glow"
              minZoomLevel={11}
              filter={['==', ['get', 'osmId'], selectedRouteId ?? -1]}
              style={{
                lineColor: '#fbbf24',
                lineWidth: [
                  'interpolate', ['linear'], ['zoom'],
                  11, 8,
                  14, 12,
                  16, 16,
                ],
                lineOpacity: 0.35,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
            {/* Main route lines with conditional highlight */}
            <Mapbox.LineLayer
              id="transport-route-line"
              minZoomLevel={11}
              style={{
                lineColor: selectedRouteId !== null
                  ? [
                    'case',
                    ['==', ['get', 'osmId'], selectedRouteId],
                    '#fbbf24',
                    [
                      'match',
                      ['get', 'colorIndex'],
                      0, '#d97706', 1, '#0891b2', 2, '#7c3aed',
                      3, '#16a34a', 4, '#dc2626', 5, '#2563eb',
                      '#d97706',
                    ],
                  ] as any
                  : [
                    'match',
                    ['get', 'colorIndex'],
                    0, '#d97706', 1, '#0891b2', 2, '#7c3aed',
                    3, '#16a34a', 4, '#dc2626', 5, '#2563eb',
                    '#d97706',
                  ],
                lineWidth: selectedRouteId !== null
                  ? [
                    'case',
                    ['==', ['get', 'osmId'], selectedRouteId],
                    6,
                    2,
                  ] as any
                  : [
                    'interpolate', ['linear'], ['zoom'],
                    11, 2.5, 14, 4, 16, 5,
                  ],
                lineOpacity: selectedRouteId !== null
                  ? [
                    'case',
                    ['==', ['get', 'osmId'], selectedRouteId],
                    0.95,
                    0.06,
                  ] as any
                  : [
                    'interpolate', ['linear'], ['zoom'],
                    11, 0.35, 13, 0.5, 16, 0.65,
                  ],
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          </Mapbox.ShapeSource>
        )}

        {/* OSM transport stops — distinct icons per mode */}
        {showTransportLayer && (
          <Mapbox.ShapeSource id="transport-stops" shape={transportStopsGeojson}>
            {/* Ambient dots at zoom 13-14 for trotro/bus network density */}
            <Mapbox.CircleLayer
              id="transport-stop-ambient"
              minZoomLevel={13}
              maxZoomLevel={15}
              filter={['match', ['get', 'stopType'], ['bus_stop', 'trotro_stop'], true, false]}
              style={{
                circleRadius: 2.5,
                circleColor: isDark ? '#fbbf24' : '#d97706',
                circleOpacity: [
                  'interpolate', ['linear'], ['zoom'],
                  13, 0.25,
                  14, 0.45,
                  15, 0.15,
                ],
              }}
            />

            {/* Trotro/bus stops — bus front icons at zoom 15+ */}
            <Mapbox.SymbolLayer
              id="transport-trotro-icons"
              minZoomLevel={15}
              filter={['match', ['get', 'stopType'], ['bus_stop', 'trotro_stop'], true, false]}
              style={{
                iconImage: 'trotro-icon',
                iconSize: [
                  'interpolate', ['linear'], ['zoom'],
                  15, 1.0,
                  17, 1.3,
                ],
                iconAllowOverlap: false,
                iconPadding: 6,
                textField: ['get', 'name'],
                textSize: 9,
                textFont: ['Open Sans Regular', 'Arial Unicode MS Regular'],
                textAnchor: 'top',
                textOffset: [0, 1.2],
                textColor: isDark ? c.stone400 : c.stone500,
                textHaloColor: isDark ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.9)',
                textHaloWidth: 1,
                textAllowOverlap: false,
                textOptional: true,
                textMaxWidth: 8,
              }}
            />

            {/* Lorry parks — larger bus icons from zoom 13 */}
            <Mapbox.SymbolLayer
              id="transport-lorry-icons"
              minZoomLevel={13}
              filter={['==', ['get', 'stopType'], 'lorry_park']}
              style={{
                iconImage: 'lorry-park-icon',
                iconSize: [
                  'interpolate', ['linear'], ['zoom'],
                  13, 1.0,
                  15, 1.2,
                  17, 1.5,
                ],
                iconAllowOverlap: false,
                iconPadding: 4,
                textField: ['get', 'name'],
                textSize: [
                  'interpolate', ['linear'], ['zoom'],
                  13, 9,
                  15, 11,
                ],
                textFont: ['Open Sans Semibold', 'Arial Unicode MS Regular'],
                textAnchor: 'top',
                textOffset: [0, 1.4],
                textColor: isDark ? '#4ade80' : '#15803d',
                textHaloColor: isDark ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.9)',
                textHaloWidth: 1.5,
                textAllowOverlap: false,
                textOptional: true,
                textMaxWidth: 8,
              }}
            />

            {/* Train stations — blue train icons from zoom 12 */}
            <Mapbox.SymbolLayer
              id="transport-train-icons"
              minZoomLevel={12}
              filter={['==', ['get', 'stopType'], 'train_station']}
              style={{
                iconImage: 'train-icon',
                iconSize: [
                  'interpolate', ['linear'], ['zoom'],
                  12, 1.0,
                  15, 1.2,
                  17, 1.5,
                ],
                iconAllowOverlap: true,
                textField: ['get', 'name'],
                textSize: [
                  'interpolate', ['linear'], ['zoom'],
                  12, 9,
                  15, 11,
                ],
                textFont: ['Open Sans Semibold', 'Arial Unicode MS Regular'],
                textAnchor: 'top',
                textOffset: [0, 1.4],
                textColor: isDark ? '#93c5fd' : '#1d4ed8',
                textHaloColor: isDark ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.9)',
                textHaloWidth: 1.5,
                textAllowOverlap: false,
                textOptional: true,
                textMaxWidth: 8,
              }}
            />

            {/* Taxi ranks — yellow car icons from zoom 14 */}
            <Mapbox.SymbolLayer
              id="transport-taxi-icons"
              minZoomLevel={14}
              filter={['==', ['get', 'stopType'], 'taxi_rank']}
              style={{
                iconImage: 'taxi-icon',
                iconSize: [
                  'interpolate', ['linear'], ['zoom'],
                  14, 1.0,
                  17, 1.3,
                ],
                iconAllowOverlap: false,
                iconPadding: 6,
                textField: ['get', 'name'],
                textSize: 9,
                textFont: ['Open Sans Regular', 'Arial Unicode MS Regular'],
                textAnchor: 'top',
                textOffset: [0, 1.2],
                textColor: isDark ? '#fde047' : '#a16207',
                textHaloColor: isDark ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.9)',
                textHaloWidth: 1,
                textAllowOverlap: false,
                textOptional: true,
                textMaxWidth: 8,
              }}
            />
          </Mapbox.ShapeSource>
        )}

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

      {/* Floating layer toggle */}
      <TouchableOpacity
        style={[
          styles.layerBtn,
          {
            backgroundColor: t.card,
            borderColor: showTransportLayer ? c.amber500 : 'transparent',
            borderWidth: showTransportLayer ? 1.5 : 0,
          },
        ]}
        onPress={() => setShowTransportLayer((v) => !v)}
        activeOpacity={0.7}
      >
        <Layers size={20} color={showTransportLayer ? c.amber500 : t.text} />
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
        nearbyStops={selectedNearbyStops}
      />

      {/* Route info overlay */}
      {selectedRoute && (
        <RouteInfoCard
          key={selectedRoute.osm_id}
          route={selectedRoute}
          isDark={isDark}
          onClose={() => setSelectedRouteId(null)}
        />
      )}
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
  layerBtn: {
    position: 'absolute',
    top: 56,
    right: 16,
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
  transportIcon: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    padding: 4,
  },
})
