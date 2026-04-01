import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  useColorScheme,
  StyleSheet,
  Platform,
  Animated,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, type Href } from 'expo-router'
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet'
import Mapbox from '@rnmapbox/maps'
import {
  Search,
  Navigation,
  Locate,
} from 'lucide-react-native'
import { c, font, themed } from '@/lib/theme'
import { usePopularRoutes } from '@/lib/hooks/useRoutes'
import { useApp } from '@/lib/contexts/AppContext'
import { useRefreshOnFocus } from '@/lib/hooks/useRefreshOnFocus'
import HappeningNow from '@/components/HappeningNow'
import { SmartCommuteCard } from '@/components/SmartCommuteCard'
import { NearbyLines } from '@/components/NearbyLines'
import ReportFAB from '@/components/ReportFAB'
import OfflineBanner from '@/components/OfflineBanner'
import InitialsAvatar from '@/components/InitialsAvatar'
import { ServiceModePills, type ServiceMode } from '@/components/ServiceModePills'
import { UnifiedSearch } from '@/components/UnifiedSearch'
import { useTrip } from '@/lib/hooks/useTrip'
import { useStations } from '@/lib/hooks/useStations'
import { useLocation } from '@/lib/hooks/useLocation'
import { getStationCoords } from '@/lib/utils/station-coords'
import { FALLBACK_STATION_COORDS } from '@/lib/utils/station-coords'
import { getWaitEstimate } from '@/lib/services/stations'
import { TRAIN_SCHEDULES } from '@/lib/constants/train-schedule'
import { getGhanaTime } from '@/lib/utils/time'
import { useActiveIncidents } from '@/lib/hooks/useActiveIncidents'
import { type ActiveIncident } from '@/lib/hooks/useActiveIncidents'
import { IncidentDetailSheet } from '@/components/IncidentDetailSheet'
import { StationMapPin, type StationPinType } from '@/components/StationMapPin'
import { useQuery } from '@tanstack/react-query'
import { X, ShieldCheck, ChevronRight, Route as RouteIcon } from 'lucide-react-native'
import { useNearbyRouteStops, type NearbyStop } from '@/lib/hooks/useNearbyRouteStops'
import { useTransportStops } from '@/lib/hooks/useTransportStops'
import { useRailwayLines } from '@/lib/hooks/useRailwayLines'
import { StopRoutesPanel } from '@/components/StopRoutesPanel'
import { fetchRoutesByIds } from '@/lib/services/routes'
import type { RouteWithStats } from '@/lib/types'

// Mapbox token set centrally in _layout.tsx

/* ── Constants ─────────────────────────────────────── */

const ACCRA_CENTER: [number, number] = [-0.187, 5.6037]

// Pre-compute train station names for map layer filtering
const TRAIN_STATION_NAMES = new Set(
  Object.values(TRAIN_SCHEDULES)
    .flatMap((scheds) => scheds.flatMap((s) => s.stops.map((st) => st.station.toLowerCase()))),
)

/* ── Animated search placeholder ───────────────────── */

const SEARCH_HINTS = [
  'Where are you going?',
  'Try "Circle to Kasoa"',
  'Search for a trotro route',
  'Try "Tema to Accra"',
  'Find a train near you',
  'Try "Madina to Legon"',
]

function AnimatedPlaceholder({ style }: { style: any }) {
  const [index, setIndex] = useState(0)
  const fadeAnim = useRef(new Animated.Value(1)).current
  const slideAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const interval = setInterval(() => {
      // Fade out + slide up
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: -8, duration: 200, useNativeDriver: true }),
      ]).start(() => {
        setIndex((i) => (i + 1) % SEARCH_HINTS.length)
        slideAnim.setValue(8)
        // Fade in + slide down into place
        Animated.parallel([
          Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
          Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        ]).start()
      })
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  return (
    <Animated.Text
      style={[style, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
    >
      {SEARCH_HINTS[index]}
    </Animated.Text>
  )
}

/* ── Route Preview Card (Phase 4 — search → map preview) ── */

function RoutePreviewCard({ routeId, from, to, onClose }: {
  routeId: string
  from: string
  to: string
  onClose: () => void
}) {
  const isDark = useColorScheme() === 'dark'
  const t = themed(isDark)
  const router = useRouter()

  const { data: routes = [], isLoading } = useQuery<RouteWithStats[]>({
    queryKey: ['preview-route', routeId],
    queryFn: () => fetchRoutesByIds([routeId]),
    staleTime: 5 * 60 * 1000,
  })

  const route = routes[0]
  const fare = route?.fare_stats?.avg_reported_fare

  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
          <View style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            backgroundColor: '#22c55e',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <RouteIcon size={18} color="#fff" strokeWidth={2.5} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{
              fontSize: 16,
              fontFamily: font.bold,
              color: t.text,
            }} numberOfLines={1}>
              {from} → {to}
            </Text>
            <Text style={{
              fontSize: 12,
              fontFamily: font.regular,
              color: t.textSecondary,
              marginTop: 1,
            }}>
              Route preview
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <X size={16} color={isDark ? c.stone400 : c.stone500} />
        </TouchableOpacity>
      </View>

      {/* Route info card */}
      {isLoading ? (
        <View style={{ alignItems: 'center', paddingVertical: 20 }}>
          <Text style={{ fontSize: 13, fontFamily: font.medium, color: t.textSecondary }}>Loading route info...</Text>
        </View>
      ) : route ? (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => router.push(`/routes/${routeId}` as Href)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            padding: 14,
            borderRadius: 14,
            backgroundColor: isDark ? 'rgba(34,197,94,0.08)' : 'rgba(34,197,94,0.05)',
            borderWidth: 1,
            borderColor: isDark ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.1)',
            gap: 12,
          }}
        >
          {/* Accent bar */}
          <View style={{
            width: 3,
            height: 40,
            borderRadius: 2,
            backgroundColor: '#22c55e',
          }} />

          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {fare != null && (
                <Text style={{
                  fontSize: 18,
                  fontFamily: font.bold,
                  color: '#22c55e',
                }}>
                  {'\u20B5'}{fare.toFixed(2)}
                </Text>
              )}
              {route.is_gprtu_verified && (
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 3,
                  backgroundColor: isDark ? 'rgba(22,163,74,0.15)' : 'rgba(22,163,74,0.1)',
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: 6,
                }}>
                  <ShieldCheck size={11} color="#16a34a" />
                  <Text style={{ fontSize: 10, fontFamily: font.bold, color: '#16a34a' }}>GPRTU</Text>
                </View>
              )}
            </View>
            {route.via && (
              <Text style={{
                fontSize: 12,
                fontFamily: font.regular,
                color: t.textSecondary,
                marginTop: 2,
              }} numberOfLines={1}>
                via {route.via}
              </Text>
            )}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={{ fontSize: 13, fontFamily: font.semibold, color: '#22c55e' }}>Details</Text>
            <ChevronRight size={16} color="#22c55e" />
          </View>
        </TouchableOpacity>
      ) : null}
    </View>
  )
}

/* ── Helpers ───────────────────────────────────────── */

function getGreeting(): string {
  const { hours, minutes } = getGhanaTime()
  const h = hours % 12 || 12
  const ampm = hours < 12 ? 'AM' : 'PM'
  const mm = minutes.toString().padStart(2, '0')
  const period = hours < 12 ? 'Good morning' : hours < 17 ? 'Good afternoon' : 'Good evening'
  return `${period} · ${h}:${mm} ${ampm}`
}

/** Auto night mode — dark map style between 6 PM and 6 AM Ghana time */
function useAutoMapStyle(isDark: boolean): string {
  const { hours } = getGhanaTime()
  const isNightInGhana = hours >= 18 || hours < 6
  if (isDark || isNightInGhana) return Mapbox.StyleURL.Dark
  return Mapbox.StyleURL.Street
}

/** Mapbox traffic-aware style URLs */
const TRAFFIC_STYLE_LIGHT = 'mapbox://styles/mapbox/navigation-day-v1'
const TRAFFIC_STYLE_DARK = 'mapbox://styles/mapbox/navigation-night-v1'

/* ── Component ─────────────────────────────────────── */

export default function HomeScreen() {
  const router = useRouter()
  const isDark = useColorScheme() === 'dark'
  const mapStyle = useAutoMapStyle(isDark)
  const isNightMap = mapStyle === Mapbox.StyleURL.Dark
  const s = getStyles(isDark)

  const { profile, deviceId } = useApp()
  const { routes: popularRoutes } = usePopularRoutes()
  useRefreshOnFocus([['routes', 'popular'], ['profile']])

  const { tripState, activeTrip, endTrip } = useTrip()
  const { stations } = useStations()
  const { location, isPermissionGranted: locationGranted, requestPermission: requestLocationPermission } = useLocation()
  const { incidents } = useActiveIncidents()
  const {
    nearbyStopsGeoJSON,
    getRoutesForStop,
    getRouteLineGeoJSON,
    getRouteStopsGeoJSON,
  } = useNearbyRouteStops(location?.latitude ?? null, location?.longitude ?? null)
  const { geojson: osmStopsGeoJSON } = useTransportStops()
  const { geojson: railwayLinesGeoJSON } = useRailwayLines()
  const greeting = getGreeting()
  const cameraRef = useRef<Mapbox.Camera>(null)
  const bottomSheetRef = useRef<BottomSheet>(null)
  const [serviceMode, setServiceMode] = useState<ServiceMode>('trotro')
  const [searchVisible, setSearchVisible] = useState(false)
  const [selectedIncident, setSelectedIncident] = useState<ActiveIncident | null>(null)
  const [selectedStop, setSelectedStop] = useState<NearbyStop | null>(null)
  const [previewRoute, setPreviewRoute] = useState<{ id: string; from: string; to: string } | null>(null)
  const [currentZoom, setCurrentZoom] = useState(13)

  // Auto-request location permission on mount if not yet granted
  useEffect(() => {
    if (!locationGranted) {
      requestLocationPermission()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Reactive center — updates when user location arrives
  const center: [number, number] = location
    ? [location.longitude, location.latitude]
    : ACCRA_CENTER

  // GeoJSON for incident markers — offset slightly so they don't hide behind station MarkerViews
  const incidentGeojson = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: incidents.map((inc) => ({
      type: 'Feature' as const,
      id: inc.id,
      geometry: {
        type: 'Point' as const,
        // Offset ~80m north-east so incident dot sits beside the station pin, not under it
        coordinates: [inc.longitude + 0.0005, inc.latitude + 0.0005],
      },
      properties: {
        id: inc.id,
        incident_type: inc.incident_type,
        location_name: inc.location_name,
        reported_at: inc.reported_at,
      },
    })),
  }), [incidents])

  // All stations with valid coordinates — Mapcarta-style pins
  const stationPins = useMemo(() => {
    return stations
      .map((station) => {
        const coords = getStationCoords(station)
        if (!coords) return null
        const stat = station.queue_stats?.[0]
        const waitText = stat ? getWaitEstimate(stat) : ''
        const isTrain = TRAIN_STATION_NAMES.has(station.name.toLowerCase())
        const hasQueue = !!stat

        let pinType: StationPinType = 'trotro'
        if (isTrain) pinType = 'train'
        else if (hasQueue) pinType = 'queue'
        else if (station.is_major) pinType = 'major'

        return {
          id: station.id,
          name: station.name,
          coordinate: [coords.longitude, coords.latitude] as [number, number],
          pinType,
          waitText,
          queueStatus: stat?.current_status,
        }
      })
      .filter(Boolean) as Array<{
        id: string
        name: string
        coordinate: [number, number]
        pinType: StationPinType
        waitText: string
        queueStatus?: string
      }>
  }, [stations])

  // Train route polylines (TMA = blue, TMP = sky)
  const trainLinesGeojson = useMemo(() => {
    const features = Object.entries(TRAIN_SCHEDULES).map(([lineId, schedules]) => {
      const sch = schedules[0]
      if (!sch) return null
      const coordinates = sch.stops
        .map((stop) => {
          const key = stop.station
          const coords = FALLBACK_STATION_COORDS[key]
          if (!coords) return null
          return [coords.longitude, coords.latitude]
        })
        .filter(Boolean) as [number, number][]
      if (coordinates.length < 2) return null
      return {
        type: 'Feature' as const,
        geometry: { type: 'LineString' as const, coordinates },
        properties: { lineId, color: '#0ea5e9' },
      }
    }).filter(Boolean)
    return { type: 'FeatureCollection' as const, features }
  }, [])


  const activeQueueCount = stations.filter(
    (st) => st.queue_stats?.[0]?.current_status,
  ).length

  // Bottom sheet snap points
  const snapPoints = useMemo(() => ['18%', '50%', '88%'], [])

  const handleRecenter = useCallback(() => {
    cameraRef.current?.setCamera({
      centerCoordinate: center,
      zoomLevel: 13,
      animationDuration: 800,
    })
  }, [center])

  const handleModeChange = useCallback((mode: ServiceMode) => {
    if (mode === 'train') {
      router.push('/train')
    } else if (mode === 'tales') {
      router.push('/(tabs)/tales' as Href)
    } else {
      // Only persist mode for trotro (the home tab) — others navigate away
      setServiceMode(mode)
    }
  }, [router])

  return (
    <View style={s.container}>
      <OfflineBanner />

      {/* ── Full-bleed map ── */}
      <Mapbox.MapView
        style={StyleSheet.absoluteFillObject}
        styleURL={isNightMap ? TRAFFIC_STYLE_DARK : TRAFFIC_STYLE_LIGHT}
        attributionEnabled={false}
        logoEnabled={false}
        compassEnabled={false}
        scaleBarEnabled={false}
        onCameraChanged={(state: any) => {
          const zoom = state.properties?.zoom
          if (zoom != null && Math.abs(zoom - currentZoom) > 0.5) {
            setCurrentZoom(zoom)
          }
        }}
        onPress={() => {
          if (selectedIncident) setSelectedIncident(null)
          if (selectedStop) {
            setSelectedStop(null)
            bottomSheetRef.current?.snapToIndex(0)
          }
          if (previewRoute) {
            setPreviewRoute(null)
            bottomSheetRef.current?.snapToIndex(0)
          }
        }}
      >
        <Mapbox.Camera
          ref={cameraRef}
          centerCoordinate={center}
          zoomLevel={13}
          animationMode="flyTo"
          animationDuration={0}
          triggerKey={center.join(',')}
        />

        <Mapbox.UserLocation
          visible
          animated
          showsUserHeadingIndicator
          androidRenderMode="compass"
        />

        {/* ── Train route lines — subtle blue dashed polylines ── */}
        <Mapbox.ShapeSource id="train-lines" shape={trainLinesGeojson as any}>
          <Mapbox.LineLayer
            id="train-lines-layer"
            style={{
              lineColor: '#0ea5e9',
              lineWidth: ['interpolate', ['linear'], ['zoom'], 10, 2, 14, 4],
              lineOpacity: ['interpolate', ['linear'], ['zoom'], 10, 0.2, 13, 0.4, 16, 0.7],
              lineCap: 'round',
              lineJoin: 'round',
              lineDasharray: [2, 3],
            }}
          />
        </Mapbox.ShapeSource>

        {/* ── OSM railway lines — Takoradi-Awaso + Dunkwa-Kumasi corridors ── */}
        <Mapbox.ShapeSource id="railway-lines" shape={railwayLinesGeoJSON as any}>
          <Mapbox.LineLayer
            id="railway-lines-layer"
            style={{
              lineColor: '#0ea5e9',
              lineWidth: ['interpolate', ['linear'], ['zoom'], 8, 1.5, 12, 3, 16, 5],
              lineOpacity: ['interpolate', ['linear'], ['zoom'], 8, 0.15, 11, 0.3, 14, 0.5, 16, 0.7],
              lineCap: 'round',
              lineJoin: 'round',
              lineDasharray: [2, 3],
            }}
          />
        </Mapbox.ShapeSource>

        {/* ── OSM transport stops — 2,500+ stops from OpenStreetMap ── */}
        <Mapbox.ShapeSource id="osm-stops" shape={osmStopsGeoJSON as any}>
          {/* Small dots visible at zoom 12+ */}
          <Mapbox.CircleLayer
            id="osm-stops-dots"
            minZoomLevel={12}
            style={{
              circleRadius: ['interpolate', ['linear'], ['zoom'], 12, 2, 16, 5],
              circleColor: ['match', ['get', 'type'],
                'lorry_park', '#8b5cf6',
                'taxi_rank', '#06b6d4',
                'train_station', '#7c3aed',
                '#94a3b8', // bus_stop — subtle gray
              ],
              circleStrokeColor: '#fff',
              circleStrokeWidth: ['interpolate', ['linear'], ['zoom'], 12, 0.5, 16, 1.5],
              circleOpacity: ['interpolate', ['linear'], ['zoom'], 12, 0.4, 14, 0.7, 16, 0.9],
            }}
          />
          {/* Name labels at zoom 14+ */}
          <Mapbox.SymbolLayer
            id="osm-stops-labels"
            minZoomLevel={14}
            style={{
              textField: ['get', 'name'],
              textSize: ['interpolate', ['linear'], ['zoom'], 14, 9, 16, 11],
              textColor: isDark ? '#d6d3d1' : '#57534e',
              textHaloColor: isDark ? '#0c0a09' : '#ffffff',
              textHaloWidth: 1.2,
              textFont: ['DIN Pro Medium', 'Arial Unicode MS Regular'],
              textOffset: [0, 1.2],
              textAnchor: 'top',
              textMaxWidth: 7,
              textAllowOverlap: false,
            }}
          />
        </Mapbox.ShapeSource>

        {/* ── Preview route from search — green polyline + stops ── */}
        {previewRoute && (
          <Mapbox.ShapeSource
            id="preview-route-lines"
            shape={getRouteLineGeoJSON([previewRoute.id]) as any}
          >
            <Mapbox.LineLayer
              id="preview-route-lines-glow"
              style={{
                lineColor: '#22c55e',
                lineWidth: 7,
                lineOpacity: 0.2,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
            <Mapbox.LineLayer
              id="preview-route-lines-main"
              style={{
                lineColor: '#22c55e',
                lineWidth: 3.5,
                lineOpacity: 0.9,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          </Mapbox.ShapeSource>
        )}
        {previewRoute && (
          <Mapbox.ShapeSource
            id="preview-route-stops"
            shape={getRouteStopsGeoJSON([previewRoute.id]) as any}
          >
            <Mapbox.CircleLayer
              id="preview-route-stops-intermediate"
              filter={['==', ['get', 'isTerminal'], false]}
              style={{
                circleRadius: 4,
                circleColor: '#fff',
                circleStrokeColor: '#22c55e',
                circleStrokeWidth: 2,
                circleOpacity: 0.8,
              }}
            />
            <Mapbox.CircleLayer
              id="preview-route-stops-terminal"
              filter={['==', ['get', 'isTerminal'], true]}
              style={{
                circleRadius: 7,
                circleColor: '#22c55e',
                circleStrokeColor: '#fff',
                circleStrokeWidth: 2.5,
              }}
            />
            <Mapbox.SymbolLayer
              id="preview-route-stops-labels"
              style={{
                textField: ['get', 'name'],
                textSize: 11,
                textColor: isDark ? '#fafaf9' : '#1c1917',
                textHaloColor: isDark ? '#0c0a09' : '#ffffff',
                textHaloWidth: 1.5,
                textFont: ['DIN Pro Medium', 'Arial Unicode MS Regular'],
                textOffset: [0, 1.4],
                textAnchor: 'top',
                textMaxWidth: 8,
                textAllowOverlap: false,
              }}
            />
          </Mapbox.ShapeSource>
        )}

        {/* ── Selected stop route lines — only when a stop is tapped ── */}
        {selectedStop && (
          <Mapbox.ShapeSource
            id="selected-route-lines"
            shape={getRouteLineGeoJSON(selectedStop.routeIds) as any}
          >
            <Mapbox.LineLayer
              id="selected-route-lines-glow"
              style={{
                lineColor: '#f8a010',
                lineWidth: 6,
                lineOpacity: 0.2,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
            <Mapbox.LineLayer
              id="selected-route-lines-main"
              style={{
                lineColor: '#f8a010',
                lineWidth: 3,
                lineOpacity: 0.85,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          </Mapbox.ShapeSource>
        )}

        {/* ── Selected stop's route stops — subtle dots along highlighted routes ── */}
        {selectedStop && (
          <Mapbox.ShapeSource
            id="selected-route-stops"
            shape={getRouteStopsGeoJSON(selectedStop.routeIds) as any}
          >
            <Mapbox.CircleLayer
              id="selected-route-stops-intermediate"
              filter={['==', ['get', 'isTerminal'], false]}
              style={{
                circleRadius: 3.5,
                circleColor: '#fff',
                circleStrokeColor: '#f8a010',
                circleStrokeWidth: 1.5,
                circleOpacity: 0.7,
              }}
            />
            <Mapbox.CircleLayer
              id="selected-route-stops-terminal"
              filter={['==', ['get', 'isTerminal'], true]}
              style={{
                circleRadius: 6,
                circleColor: '#f8a010',
                circleStrokeColor: '#fff',
                circleStrokeWidth: 2,
              }}
            />
          </Mapbox.ShapeSource>
        )}

        {/* ── Nearby trotro stops — clean 3-5 dots, progressive disclosure ── */}
        <Mapbox.ShapeSource
          id="nearby-stops"
          shape={nearbyStopsGeoJSON as any}
          hitbox={{ width: 44, height: 44 }}
          onPress={(e: any) => {
            const feature = e.features?.[0]
            if (!feature?.properties?.name) return
            const name = feature.properties.name
            const coords = feature.geometry?.coordinates
            const routeIds = getRoutesForStop(name)
            setSelectedStop({
              name,
              latitude: coords[1],
              longitude: coords[0],
              routeIds,
              distanceKm: feature.properties.distanceKm,
            })
            // Pan camera to tapped stop
            if (coords && cameraRef.current) {
              cameraRef.current.setCamera({
                centerCoordinate: coords,
                zoomLevel: 14,
                animationDuration: 600,
              })
            }
            bottomSheetRef.current?.snapToIndex(1)
          }}
        >
          {/* Halo for nearest stop (rank 0) — visible at zoom 11+ */}
          <Mapbox.CircleLayer
            id="nearby-stops-halo"
            minZoomLevel={11}
            filter={['==', ['get', 'rank'], 0]}
            style={{
              circleRadius: ['interpolate', ['linear'], ['zoom'], 11, 10, 14, 18],
              circleColor: '#f8a010',
              circleOpacity: ['interpolate', ['linear'], ['zoom'], 11, 0.06, 14, 0.12],
            }}
          />
          {/* Stop dots — visible at zoom 11+, grow with zoom */}
          <Mapbox.CircleLayer
            id="nearby-stops-dots"
            minZoomLevel={11}
            style={{
              circleRadius: ['interpolate', ['linear'], ['zoom'],
                11, ['match', ['get', 'rank'], 0, 5, 1, 4, 3],
                14, ['match', ['get', 'rank'], 0, 9, 1, 7, 2, 6, 5],
              ],
              circleColor: '#f8a010',
              circleStrokeColor: '#fff',
              circleStrokeWidth: ['interpolate', ['linear'], ['zoom'], 11, 1, 14, ['match', ['get', 'rank'], 0, 3, 2]],
            }}
          />
          {/* Stop name labels — only at zoom 13+ */}
          <Mapbox.SymbolLayer
            id="nearby-stops-labels"
            minZoomLevel={13}
            style={{
              textField: ['get', 'name'],
              textSize: ['interpolate', ['linear'], ['zoom'],
                13, ['match', ['get', 'rank'], 0, 11, 9],
                16, ['match', ['get', 'rank'], 0, 14, 12],
              ],
              textColor: isDark ? '#fafaf9' : '#1c1917',
              textHaloColor: isDark ? '#0c0a09' : '#ffffff',
              textHaloWidth: 1.5,
              textFont: ['DIN Pro Medium', 'Arial Unicode MS Regular'],
              textOffset: [0, 1.6],
              textAnchor: 'top',
              textMaxWidth: 8,
              textAllowOverlap: false,
            }}
          />
        </Mapbox.ShapeSource>

        {/* ── Station pins — zoom-aware: train always, others at zoom 12+ ── */}
        {stationPins
          .filter((pin) => pin.pinType === 'train' || pin.pinType === 'queue' || currentZoom >= 12)
          .map((pin) => (
          <Mapbox.MarkerView
            key={pin.id}
            coordinate={pin.coordinate}
            allowOverlap={false}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View pointerEvents="box-none">
              <StationMapPin
                type={pin.pinType}
                name={pin.name}
                waitText={pin.waitText}
                queueStatus={pin.queueStatus as any}
              />
            </View>
          </Mapbox.MarkerView>
        ))}

        {/* ── Incident markers — native Mapbox layers with clustering ── */}
        <Mapbox.ShapeSource
          id="incident-markers"
          shape={incidentGeojson}
          cluster
          clusterRadius={50}
          clusterMaxZoomLevel={14}
          hitbox={{ width: 60, height: 60 }}
          onPress={(e: any) => {
            const feature = e.features?.[0]
            if (!feature) return
            if (feature.properties?.cluster === true) {
              const coords = feature.geometry?.coordinates
              if (coords && cameraRef.current) {
                cameraRef.current.setCamera({
                  centerCoordinate: coords,
                  zoomLevel: 15,
                  animationDuration: 600,
                })
              }
              return
            }
            if (!feature.properties?.id) return
            const tapped = incidents.find((i) => i.id === feature.properties.id)
            if (tapped) setSelectedIncident(tapped)
          }}
        >
          <Mapbox.CircleLayer
            id="incident-cluster-halo"
            filter={['has', 'point_count']}
            style={{
              circleRadius: ['step', ['get', 'point_count'], 28, 5, 34, 10, 40],
              circleColor: '#ef4444',
              circleOpacity: 0.12,
            }}
          />
          <Mapbox.CircleLayer
            id="incident-cluster-circle"
            filter={['has', 'point_count']}
            style={{
              circleRadius: ['step', ['get', 'point_count'], 20, 5, 24, 10, 30],
              circleColor: '#ef4444',
              circleOpacity: 0.9,
              circleStrokeColor: '#ffffff',
              circleStrokeWidth: 2.5,
            }}
          />
          <Mapbox.SymbolLayer
            id="incident-cluster-count"
            filter={['has', 'point_count']}
            style={{
              textField: ['get', 'point_count_abbreviated'],
              textSize: 13,
              textColor: '#ffffff',
              textFont: ['DIN Pro Bold', 'Arial Unicode MS Bold'],
              textAllowOverlap: true,
            }}
          />
          <Mapbox.CircleLayer
            id="incident-halo"
            filter={['!', ['has', 'point_count']]}
            style={{
              circleRadius: 26,
              circleColor: ['match', ['get', 'incident_type'],
                'traffic', '#f59e0b',
                'accident', '#dc2626',
                'police_checkpoint', '#3b82f6',
                'police', '#3b82f6',
                'roadwork', '#f97316',
                'road_closure', '#f97316',
                'flooding', '#0d9488',
                'breakdown', '#d97706',
                '#ef4444',
              ],
              circleOpacity: 0.15,
            }}
          />
          <Mapbox.CircleLayer
            id="incident-main"
            filter={['!', ['has', 'point_count']]}
            style={{
              circleRadius: 14,
              circleColor: ['match', ['get', 'incident_type'],
                'traffic', '#f59e0b',
                'accident', '#dc2626',
                'police_checkpoint', '#3b82f6',
                'police', '#3b82f6',
                'roadwork', '#f97316',
                'road_closure', '#f97316',
                'flooding', '#0d9488',
                'breakdown', '#d97706',
                '#ef4444',
              ],
              circleOpacity: 0.95,
              circleStrokeColor: '#ffffff',
              circleStrokeWidth: 2.5,
            }}
          />
          <Mapbox.CircleLayer
            id="incident-inner"
            filter={['!', ['has', 'point_count']]}
            style={{
              circleRadius: 4,
              circleColor: '#ffffff',
              circleOpacity: 0.9,
            }}
          />
          <Mapbox.SymbolLayer
            id="incident-label"
            filter={['!', ['has', 'point_count']]}
            style={{
              textField: '!',
              textSize: 14,
              textColor: '#ffffff',
              textFont: ['DIN Pro Bold', 'Arial Unicode MS Bold'],
              textAllowOverlap: true,
              textIgnorePlacement: true,
              textOffset: [0, -0.1],
            }}
          />
        </Mapbox.ShapeSource>
      </Mapbox.MapView>

      {/* ── Floating search bar + service pills ── */}
      <SafeAreaView edges={['top']} style={s.floatingTop} pointerEvents="box-none">
        <TouchableOpacity
          onPress={() => setSearchVisible(true)}
          activeOpacity={0.85}
          style={s.searchBar}
        >
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/profile' as Href)}
            activeOpacity={0.7}
          >
            <InitialsAvatar
              name={profile?.display_name ?? null}
              deviceId={deviceId ?? ''}
              size={36}
            />
          </TouchableOpacity>
          <View style={s.searchTextWrap}>
            <Text style={s.searchGreeting}>{greeting}</Text>
            <AnimatedPlaceholder style={s.searchPlaceholder} />
          </View>
          <Search size={22} color={c.amber500} />
        </TouchableOpacity>

        {/* Service mode pills — under search bar */}
        <ServiceModePills
          activeMode={serviceMode}
          onModeChange={handleModeChange}
        />
      </SafeAreaView>

      {/* Recenter button */}
      <TouchableOpacity
        onPress={handleRecenter}
        activeOpacity={0.8}
        style={s.recenterBtn}
      >
        <Locate size={20} color={c.amber500} />
      </TouchableOpacity>

      {/* Live queue badge */}
      {activeQueueCount > 0 && (
        <View style={s.queueBadge}>
          <View style={s.queueBadgeDot} />
          <Text style={s.queueBadgeText}>
            {activeQueueCount} live queue{activeQueueCount !== 1 ? 's' : ''}
          </Text>
        </View>
      )}

      {/* Live incidents badge */}
      {incidents.length > 0 && (
        <View style={s.incidentBadge}>
          <View style={s.incidentBadgeDot} />
          <Text style={s.incidentBadgeText}>
            {incidents.length} incident{incidents.length !== 1 ? 's' : ''}
          </Text>
        </View>
      )}

      {/* Active trip banner — floats above bottom sheet */}
      {tripState !== 'idle' && activeTrip && (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.push({
            pathname: '/trip/[routeId]',
            params: {
              routeId: activeTrip.routeId,
              ...(activeTrip.transportType === 'train' ? { type: 'train', lineId: activeTrip.trainLineId ?? activeTrip.routeId } : {}),
            },
          } as Href)}
          style={s.activeTripBanner}
        >
          <View style={s.activeTripDot} />
          <Navigation size={16} color="#fff" />
          <View style={{ flex: 1 }}>
            <Text style={s.activeTripText}>Trip in progress</Text>
            <Text style={s.activeTripSub} numberOfLines={1}>{activeTrip.routeLabel}</Text>
          </View>
          <TouchableOpacity
            onPress={() => deviceId && endTrip(deviceId)}
            activeOpacity={0.7}
            style={s.activeTripEnd}
          >
            <Text style={s.activeTripEndText}>End</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      )}

      {/* ── Bottom Sheet ── */}
      <BottomSheet
        ref={bottomSheetRef}
        index={0}
        snapPoints={snapPoints}
        backgroundStyle={{
          backgroundColor: themed(isDark).sheetBg,
          borderRadius: 40,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -8 },
          shadowOpacity: 0.08,
          shadowRadius: 40,
          elevation: 8,
        }}
        handleIndicatorStyle={{
          backgroundColor: isDark ? c.stone500 : c.stone300,
          width: 40,
        }}
        enablePanDownToClose={false}
      >
        <BottomSheetScrollView
          key={selectedStop ? `stop-${selectedStop.name}` : previewRoute ? `preview-${previewRoute.id}` : 'home'}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
        >
          {selectedStop ? (
            <StopRoutesPanel
              stop={selectedStop}
              onClose={() => {
                setSelectedStop(null)
                bottomSheetRef.current?.snapToIndex(0)
              }}
            />
          ) : previewRoute ? (
            <RoutePreviewCard
              routeId={previewRoute.id}
              from={previewRoute.from}
              to={previewRoute.to}
              onClose={() => {
                setPreviewRoute(null)
                bottomSheetRef.current?.snapToIndex(0)
              }}
            />
          ) : (
            <>
              {/* Smart Commute — hero greeting, first thing users see */}
              <SmartCommuteCard />

              {/* Transit-style nearby lines */}
              <NearbyLines
                stations={stations}
                routes={popularRoutes}
                userLat={location?.latitude ?? null}
                userLng={location?.longitude ?? null}
                locationGranted={locationGranted}
                onRequestLocation={requestLocationPermission}
              />

              {/* Happening Now */}
              <HappeningNow />
            </>
          )}
        </BottomSheetScrollView>
      </BottomSheet>

      {/* Citizen-style incident detail sheet */}
      {selectedIncident && (
        <IncidentDetailSheet
          incident={selectedIncident}
          onClose={() => setSelectedIncident(null)}
        />
      )}

      <ReportFAB />
      <UnifiedSearch
        visible={searchVisible}
        onClose={() => setSearchVisible(false)}
        onRoutePreview={(routeId, from, to) => {
          setPreviewRoute({ id: routeId, from, to })
          setSelectedStop(null)
          bottomSheetRef.current?.snapToIndex(1)
        }}
      />
    </View>
  )
}

/* ── Styles ────────────────────────────────────────── */

const getStyles = (isDark: boolean) => {
  const t = themed(isDark)
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },

    // Floating top UI
    floatingTop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10,
    },

    // Search bar — Uber/Bolt style
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 16,
      marginTop: 8,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 28,
      backgroundColor: isDark ? 'rgba(28,28,30,0.92)' : 'rgba(255,255,255,0.95)',
      gap: 12,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
        },
        android: { elevation: 8 },
      }),
    },
    searchTextWrap: {
      flex: 1,
    },
    searchGreeting: {
      fontSize: 11,
      fontFamily: font.medium,
      color: t.textTertiary,
    },
    searchPlaceholder: {
      fontSize: 16,
      fontFamily: font.semibold,
      color: t.text,
      marginTop: 1,
    },

    // Recenter button
    recenterBtn: {
      position: 'absolute',
      right: 16,
      bottom: '22%',
      width: 46,
      height: 46,
      borderRadius: 14,
      backgroundColor: isDark ? 'rgba(28,28,30,0.92)' : 'rgba(255,255,255,0.97)',
      borderWidth: 1.5,
      borderColor: isDark ? 'rgba(245,158,11,0.25)' : 'rgba(245,158,11,0.15)',
      alignItems: 'center',
      justifyContent: 'center',
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.12,
          shadowRadius: 8,
        },
        android: { elevation: 6 },
      }),
    },

    // Queue badge
    queueBadge: {
      position: 'absolute',
      left: 16,
      bottom: '22%',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: isDark ? 'rgba(28,28,30,0.9)' : 'rgba(255,255,255,0.95)',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.12,
          shadowRadius: 6,
        },
        android: { elevation: 4 },
      }),
    },
    queueBadgeDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#22c55e',
    },
    queueBadgeText: {
      fontSize: 12,
      fontFamily: font.semibold,
      color: t.text,
    },

    // Active trip banner
    activeTripBanner: {
      position: 'absolute',
      left: 16,
      right: 16,
      bottom: '20%',
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderRadius: 16,
      backgroundColor: '#22c55e',
      gap: 10,
      zIndex: 20,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.2,
          shadowRadius: 8,
        },
        android: { elevation: 10 },
      }),
    },
    activeTripDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#fff',
    },
    activeTripText: {
      fontSize: 14,
      fontFamily: font.semibold,
      color: '#fff',
    },
    activeTripSub: {
      fontSize: 11,
      fontFamily: font.regular,
      color: 'rgba(255,255,255,0.75)',
      marginTop: 1,
    },
    activeTripEnd: {
      backgroundColor: 'rgba(255,255,255,0.25)',
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 12,
    },
    activeTripEndText: {
      fontSize: 12,
      fontFamily: font.semibold,
      color: '#fff',
    },

    // Incident badge
    incidentBadge: {
      position: 'absolute',
      left: 16,
      bottom: '27%',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: isDark ? 'rgba(28,28,30,0.9)' : 'rgba(255,255,255,0.95)',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.12,
          shadowRadius: 6,
        },
        android: { elevation: 4 },
      }),
    },
    incidentBadgeDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#ef4444',
    },
    incidentBadgeText: {
      fontSize: 12,
      fontFamily: font.semibold,
      color: t.text,
    },

  })
}
