import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  useColorScheme,
  StyleSheet,
  Platform,
  Animated,
  AccessibilityInfo,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { useRouter, type Href } from 'expo-router'
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet'
import Mapbox from '@rnmapbox/maps'
import {
  Search,
  Navigation,
  Locate,
  BusFront,
  TrainFront,
  MapPin,
  Flame,
  AlertTriangle,
} from 'lucide-react-native'
import { c, font, themed } from '@/lib/theme'
import { usePopularRoutes } from '@/lib/hooks/useRoutes'
import { useApp } from '@/lib/contexts/AppContext'
import { useRefreshOnFocus } from '@/lib/hooks/useRefreshOnFocus'
// HappeningNow, SmartCommuteCard, NearbyLines removed — replaced by live vehicle sheet
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
import { type StationPinType } from '@/components/StationMapPin'
import { useQuery } from '@tanstack/react-query'
import { X, ShieldCheck, ChevronRight, Route as RouteIcon } from 'lucide-react-native'
import { useNearbyRouteStops, type NearbyStop } from '@/lib/hooks/useNearbyRouteStops'
import { useTransportStops } from '@/lib/hooks/useTransportStops'
import { useRailwayLines } from '@/lib/hooks/useRailwayLines'
import { StopRoutesPanel } from '@/components/StopRoutesPanel'
import LiveVehicleLayer from '@/components/LiveVehicleLayer'
import { useVehiclePositions } from '@/lib/hooks/useVehiclePositions'
import type { VehiclePosition } from '@/lib/services/vehicle-positions'
import { fetchRoutesByIds } from '@/lib/services/routes'
import type { RouteWithStats } from '@/lib/types'

// Mapbox token set centrally in _layout.tsx

/* ── Constants ─────────────────────────────────────── */

const ACCRA_CENTER: [number, number] = [-0.187, 5.6037]
const MAPBOX_TOKEN = 'pk.eyJ1Ijoic2FtcHkxIiwiYSI6ImNranl2NHNjdTAxZzQzMWxldmx5dGhkaDEifQ.1eOzL1554nbXGIPai5Kmlg'

const ROUTE_DESTINATIONS: Record<string, { lat: number; lng: number; name: string }> = {
  'Circle → Madina': { lat: 5.6697, lng: -0.1662, name: 'Madina' },
  'Kasoa → Kaneshie': { lat: 5.5508, lng: -0.2377, name: 'Kaneshie' },
  'Madina → Accra': { lat: 5.5502, lng: -0.2174, name: 'Accra Central' },
  'Achimota → Circle': { lat: 5.5702, lng: -0.2167, name: 'Circle' },
  'Tema → Accra': { lat: 5.5502, lng: -0.2174, name: 'Accra Central' },
  'Lapaz → Circle': { lat: 5.5702, lng: -0.2167, name: 'Circle' },
  'Nima → Circle': { lat: 5.5702, lng: -0.2167, name: 'Circle' },
  'Adenta → Madina': { lat: 5.6697, lng: -0.1662, name: 'Madina' },
  'Dansoman → Kaneshie': { lat: 5.5508, lng: -0.2377, name: 'Kaneshie' },
  'Osu → Circle': { lat: 5.5702, lng: -0.2167, name: 'Circle' },
}

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

/* ── Animated Map Pin — springs up when appearing (like Transit/Citibike) ── */

function AnimatedMapPin({ children }: { children: React.ReactNode }) {
  const scale = useRef(new Animated.Value(0)).current
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion)
  }, [])

  useEffect(() => {
    if (reduceMotion) {
      scale.setValue(1)
      return
    }
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 12,
      bounciness: 8,
    }).start()
  }, [reduceMotion])

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      {children}
    </Animated.View>
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
const MAP_STYLE_LIGHT = 'mapbox://styles/sampy1/cmnhofbx0005q01s84a9vbm31'
const MAP_STYLE_DARK = 'mapbox://styles/sampy1/cmnhpb34g00eq01qq854gbezx'

/* ── Nearby stop pin — Uber/Grab style marker ── */
const NearbyStopPin = React.memo(function NearbyStopPin({
  name,
  isNearest,
  isDark,
}: {
  name: string
  isNearest: boolean
  isDark: boolean
}) {
  const size = isNearest ? 32 : 26
  return (
    <View style={{ alignItems: 'center', width: 80 }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: '#f59e0b',
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 2.5,
          borderColor: '#fff',
          ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4 },
            android: { elevation: 5 },
          }),
        }}
      >
        <BusFront size={isNearest ? 16 : 13} color="#fff" strokeWidth={2.5} />
      </View>
      <View
        style={{
          width: 0, height: 0,
          borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 6,
          borderLeftColor: 'transparent', borderRightColor: 'transparent',
          borderTopColor: '#f59e0b',
          marginTop: -1,
        }}
      />
      <Text
        numberOfLines={1}
        style={{
          marginTop: 2,
          fontSize: isNearest ? 10 : 9,
          fontFamily: font.semibold,
          color: isDark ? '#fafaf9' : '#1c1917',
          textAlign: 'center',
          maxWidth: 78,
          textShadowColor: isDark ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.9)',
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: 4,
        }}
      >
        {name}
      </Text>
    </View>
  )
})

/* ── Component ─────────────────────────────────────── */

export default function HomeScreen() {
  const router = useRouter()
  const isDark = useColorScheme() === 'dark'
  const mapStyle = useAutoMapStyle(isDark)
  const isNightMap = mapStyle === Mapbox.StyleURL.Dark
  const s = useMemo(() => getStyles(isDark), [isDark])

  const { profile, deviceId } = useApp()
  const { routes: popularRoutes } = usePopularRoutes()
  useRefreshOnFocus([['routes', 'popular'], ['profile']])

  const { tripState, activeTrip, endTrip } = useTrip()
  const { stations } = useStations()
  const { location, isPermissionGranted: locationGranted, requestPermission: requestLocationPermission } = useLocation()
  const { incidents } = useActiveIncidents()
  const {
    nearbyStops,
    getRoutesForStop,
    getRouteLineGeoJSON,
    getRouteStopsGeoJSON,
  } = useNearbyRouteStops(location?.latitude ?? null, location?.longitude ?? null)
  const { geojson: osmStopsGeoJSON } = useTransportStops()
  const { geojson: railwayLinesGeoJSON } = useRailwayLines()
  const { vehicles: liveVehicles, activeCount: liveVehicleCount } = useVehiclePositions()
  const greeting = getGreeting()
  const cameraRef = useRef<Mapbox.Camera>(null)
  const bottomSheetRef = useRef<BottomSheet>(null)
  const [serviceMode, setServiceMode] = useState<ServiceMode>('trotro')
  const [searchVisible, setSearchVisible] = useState(false)
  const [selectedIncident, setSelectedIncident] = useState<ActiveIncident | null>(null)
  const [selectedStop, setSelectedStop] = useState<NearbyStop | null>(null)
  const [previewRoute, setPreviewRoute] = useState<{ id: string; from: string; to: string } | null>(null)
  const zoomRef = useRef(13)
  const [showAllPins, setShowAllPins] = useState(true) // true when zoom >= 12
  const [mapIdle, setMapIdle] = useState(false)
  const [mountMap, setMountMap] = useState(false)
  const [liveBadgeExpanded, setLiveBadgeExpanded] = useState(false)
  const [liveBadgeDismissed, setLiveBadgeDismissed] = useState(false)
  const [selectedVehicle, setSelectedVehicle] = useState<VehiclePosition | null>(null)
  const [routeLineGeoJSON, setRouteLineGeoJSON] = useState<any>({ type: 'FeatureCollection', features: [] })
  const [destMarkerGeoJSON, setDestMarkerGeoJSON] = useState<any>({ type: 'FeatureCollection', features: [] })
  const [vehicleETA, setVehicleETA] = useState<string>('--')
  const [vehicleDist, setVehicleDist] = useState<string>('--')

  // Pulsing rings — refs only, no setState to avoid re-rendering
  const pulseSourceRef = useRef<any>(null)
  const pulseTickRef = useRef(0)

  // Delay MapView mount slightly so placeholder paints first — prevents green flash
  useEffect(() => {
    if (location && !mountMap) {
      const timer = setTimeout(() => setMountMap(true), 50)
      return () => clearTimeout(timer)
    }
  }, [location, mountMap])

  // Auto-request location permission on mount if not yet granted
  useEffect(() => {
    if (!locationGranted) {
      requestLocationPermission()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Manual camera follow — avoids Mapbox native followUserLocation which causes globe spin.
  // Camera moves to user location via setCamera with controlled animation.
  const [followUser, setFollowUser] = useState(true)
  const center: [number, number] = location
    ? [location.longitude, location.latitude]
    : ACCRA_CENTER

  const hasSetInitialCamera = useRef(false)
  useEffect(() => {
    if (!location || !followUser || !cameraRef.current) return
    const isFirst = !hasSetInitialCamera.current
    hasSetInitialCamera.current = true
    cameraRef.current.setCamera({
      centerCoordinate: [location.longitude, location.latitude],
      zoomLevel: 15,
      animationDuration: isFirst ? 0 : 1000,
    })
  }, [location, followUser])

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
          lastReportAt: stat?.last_report_at,
          reportCount: stat?.report_count_last_hour ?? 0,
        }
      })
      .filter(Boolean) as Array<{
        id: string
        name: string
        coordinate: [number, number]
        pinType: StationPinType
        waitText: string
        queueStatus?: string
        lastReportAt?: string
        reportCount: number
      }>
  }, [stations])

  // Active stations with queue data (for pulse animation + Watch sync)
  const activeQueueStations = useMemo(() =>
    stationPins.filter((p) => p.queueStatus && p.queueStatus !== ''),
    [stationPins]
  )

  // Sync active stations to Apple Watch
  useEffect(() => {
    if (Platform.OS !== 'ios' || activeQueueStations.length === 0) return
    import('@/lib/watchSync').then(({ syncStationsToWatch, sendAlertToWatch }) => {
      syncStationsToWatch(activeQueueStations.map((s) => ({
        name: s.name,
        queueStatus: (s.queueStatus === 'very_long' ? 'veryLong' : s.queueStatus) as any,
        waitTime: s.waitText || '',
        fare: 0,
      })))
      // Send alert for very_long stations
      const critical = activeQueueStations.find((s) => s.queueStatus === 'very_long')
      if (critical) {
        const alternative = activeQueueStations.find((s) => s.queueStatus === 'short' || s.queueStatus === 'moderate')
        sendAlertToWatch({
          station: critical.name,
          queueStatus: 'veryLong',
          alternative: alternative?.name ?? 'a nearby station',
        })
      }
    })
  }, [activeQueueStations])

  // 3D Fire tower polygons — small hexagons at congested stations
  const fireTowersGeojson = useMemo(() => {
    const features = activeQueueStations
      .filter((s) => s.queueStatus === 'moderate' || s.queueStatus === 'long' || s.queueStatus === 'very_long')
      .map((s) => {
        // Generate hexagon polygon (~15m radius)
        const radius = 0.00015
        const [lng, lat] = s.coordinate
        const hexCoords = Array.from({ length: 7 }, (_, i) => {
          const angle = (Math.PI / 3) * (i % 6)
          return [lng + radius * Math.cos(angle), lat + radius * Math.sin(angle)]
        })

        // Height based on queue severity
        const height = s.queueStatus === 'very_long' ? 250
          : s.queueStatus === 'long' ? 150
          : 80 // moderate

        return {
          type: 'Feature' as const,
          geometry: { type: 'Polygon' as const, coordinates: [hexCoords] },
          properties: {
            height,
            color: s.queueStatus === 'very_long' ? '#ef4444'
              : s.queueStatus === 'long' ? '#f97316'
              : '#f59e0b',
          },
        }
      })
    return { type: 'FeatureCollection' as const, features }
  }, [activeQueueStations])

  // Pulse animation loop — updates ShapeSource via ref, no React re-renders
  // Scales with zoom so pulse is visible behind capsules at high zoom
  useEffect(() => {
    if (!mapIdle || activeQueueStations.length === 0) return
    const id = setInterval(() => {
      pulseTickRef.current = (pulseTickRef.current + 1) % 40
      const phase = pulseTickRef.current * Math.PI / 20
      const zoom = zoomRef.current
      // Scale pulse radius based on zoom: small at low zoom, large at high zoom
      const baseRadius = zoom >= 14 ? 30 : zoom >= 13 ? 22 : 14
      const expandRange = zoom >= 14 ? 25 : zoom >= 13 ? 16 : 10
      const baseOpacity = zoom >= 14 ? 0.35 : 0.25

      const geojson = {
        type: 'FeatureCollection',
        features: activeQueueStations.map((s) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: s.coordinate },
          properties: {
            radius: baseRadius + Math.sin(phase) * expandRange,
            opacity: baseOpacity - Math.sin(phase) * (baseOpacity - 0.05),
            color: s.queueStatus === 'long' || s.queueStatus === 'very_long'
              ? '#ef4444'
              : s.queueStatus === 'moderate'
              ? '#f59e0b'
              : '#22c55e',
          },
        })),
      }
      pulseSourceRef.current?.setNativeProps({ shape: JSON.stringify(geojson) })
    }, 100)
    return () => clearInterval(id)
  }, [mapIdle, activeQueueStations])

  // Station pins as native GeoJSON for SymbolLayer/CircleLayer (performance: no JS MarkerViews)
  const stationPinsGeojson = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: stationPins.map((pin) => ({
      type: 'Feature' as const,
      id: pin.id,
      geometry: {
        type: 'Point' as const,
        coordinates: pin.coordinate,
      },
      properties: {
        name: pin.name,
        pinType: pin.pinType,
        waitText: pin.waitText || '',
        queueStatus: pin.queueStatus || '',
        iconName: pin.pinType === 'train' ? 'pin-train'
          : pin.pinType === 'major' ? 'pin-major'
          : pin.pinType === 'queue' ? `pin-queue-${pin.queueStatus || 'empty'}`
          : 'pin-trotro',
      },
    })),
  }), [stationPins])

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
  const snapPoints = useMemo(() => ['1%', '45%', '85%'], [])

  const handleRecenter = useCallback(() => {
    setFollowUser(true)
  }, [])

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

      {/* ── Full-bleed map — placeholder covers GL surface until style loads ── */}
      {mountMap && <Mapbox.MapView
        style={StyleSheet.absoluteFillObject}
        styleURL={MAP_STYLE_LIGHT}
        surfaceView={Platform.OS === 'android'}
        attributionEnabled
        attributionPosition={{ bottom: 8, left: 8 }}
        logoEnabled={false}
        compassEnabled
        compassViewPosition={1}
        compassViewMargins={{ x: 16, y: Platform.OS === 'android' ? 190 : 120 }}
        scaleBarEnabled={false}
        pitchEnabled={true}
        onDidFinishLoadingMap={() => {}}
        onMapIdle={() => { if (!mapIdle) setMapIdle(true) }}
        onTouchStart={() => {
          if (followUser) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            setFollowUser(false)
          }
        }}
        onCameraChanged={(state: any) => {
          const zoom = state.properties?.zoom
          if (zoom != null) {
            const wasAbove12 = zoomRef.current >= 12
            const isAbove12 = zoom >= 12
            zoomRef.current = zoom
            if (wasAbove12 !== isAbove12) setShowAllPins(isAbove12)
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
        {/* Camera — defaultSettings for instant snap, followUserLocation only after map is idle */}
        {location && (
          <Mapbox.Camera
            ref={cameraRef}
            defaultSettings={{
              centerCoordinate: [location.longitude, location.latitude],
              zoomLevel: 15,
              pitch: 30,
              padding: { paddingTop: 60, paddingBottom: 200, paddingLeft: 0, paddingRight: 0 },
            }}
            followUserLocation={followUser && mapIdle}
            followUserMode={Mapbox.UserTrackingMode.Follow}
            followZoomLevel={15}
            followPadding={{ paddingTop: 60, paddingBottom: 200, paddingLeft: 0, paddingRight: 0 }}
            animationMode="moveTo"
            animationDuration={0}
            minZoomLevel={3}
            maxZoomLevel={18}
          />
        )}

        {/* Delay UserLocation until map is idle — prevents Camera/UserLocation race (#2980) */}
        {mapIdle && (
          <Mapbox.UserLocation
            visible
            animated
            showsUserHeadingIndicator
            androidRenderMode="compass"
          />
        )}

        {/*
          <Mapbox.Image name="pin-trotro">
            <View style={{ width: 38, height: 62, borderRadius: 19, overflow: 'hidden', backgroundColor: '#1c1917', borderWidth: 2, borderColor: '#60a5fa', elevation: 8 }}>
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(96,165,250,0.2)' }}>
                <BusFront size={16} color="#93bbfd" strokeWidth={2.5} />
              </View>
              <View style={{ height: 1, backgroundColor: 'rgba(96,165,250,0.3)' }} />
              <View style={{ paddingVertical: 4, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#60a5fa' }} />
              </View>
            </View>
          </Mapbox.Image>
          <Mapbox.Image name="pin-train">
            <View style={{ width: 38, height: 62, borderRadius: 19, overflow: 'hidden', backgroundColor: '#1c1917', borderWidth: 2, borderColor: '#7c3aed', elevation: 8 }}>
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(124,58,237,0.12)' }}>
                <TrainFront size={16} color="#7c3aed" strokeWidth={2.5} />
              </View>
              <View style={{ height: 1, backgroundColor: 'rgba(124,58,237,0.25)' }} />
              <View style={{ paddingVertical: 4, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#7c3aed' }} />
              </View>
            </View>
          </Mapbox.Image>
          <Mapbox.Image name="pin-major">
            <View style={{ width: 38, height: 62, borderRadius: 19, overflow: 'hidden', backgroundColor: '#1c1917', borderWidth: 2, borderColor: '#60a5fa', elevation: 8 }}>
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(96,165,250,0.2)' }}>
                <MapPin size={16} color="#93bbfd" strokeWidth={2.5} />
              </View>
              <View style={{ height: 1, backgroundColor: 'rgba(96,165,250,0.3)' }} />
              <View style={{ paddingVertical: 4, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#60a5fa' }} />
              </View>
            </View>
          </Mapbox.Image>
          <Mapbox.Image name="pin-queue-empty">
            <View style={{ width: 38, height: 62, borderRadius: 19, overflow: 'hidden', backgroundColor: '#1c1917', borderWidth: 2, borderColor: '#22c55e', elevation: 8 }}>
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(34,197,94,0.12)' }}>
                <BusFront size={16} color="#22c55e" strokeWidth={2.5} />
              </View>
              <View style={{ height: 1, backgroundColor: 'rgba(34,197,94,0.25)' }} />
              <View style={{ paddingVertical: 4, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#22c55e' }} />
              </View>
            </View>
          </Mapbox.Image>
          <Mapbox.Image name="pin-queue-moderate">
            <View style={{ width: 38, height: 62, borderRadius: 19, overflow: 'hidden', backgroundColor: '#1c1917', borderWidth: 2, borderColor: '#f59e0b', elevation: 8 }}>
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(245,158,11,0.12)' }}>
                <AlertTriangle size={16} color="#f59e0b" strokeWidth={2.5} />
              </View>
              <View style={{ height: 1, backgroundColor: 'rgba(245,158,11,0.25)' }} />
              <View style={{ paddingVertical: 4, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#f59e0b' }} />
              </View>
            </View>
          </Mapbox.Image>
          <Mapbox.Image name="pin-queue-long">
            <View style={{ width: 38, height: 62, borderRadius: 19, overflow: 'hidden', backgroundColor: '#1c1917', borderWidth: 2, borderColor: '#f97316', elevation: 8 }}>
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(249,115,22,0.15)' }}>
                <Flame size={16} color="#f97316" strokeWidth={2.5} />
              </View>
              <View style={{ height: 1, backgroundColor: 'rgba(249,115,22,0.3)' }} />
              <View style={{ paddingVertical: 4, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#f97316' }} />
              </View>
            </View>
          </Mapbox.Image>
          <Mapbox.Image name="pin-queue-very_long">
            <View style={{ width: 38, height: 62, borderRadius: 19, overflow: 'hidden', backgroundColor: '#1c1917', borderWidth: 2, borderColor: '#ef4444', elevation: 8 }}>
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(239,68,68,0.18)' }}>
                <Flame size={18} color="#ef4444" strokeWidth={2.5} fill="#ef4444" />
              </View>
              <View style={{ height: 1, backgroundColor: 'rgba(239,68,68,0.35)' }} />
              <View style={{ paddingVertical: 4, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#ef4444' }} />
              </View>
            </View>
          </Mapbox.Image>
        */}

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

        {/* ── OSM transport stops — only shown contextually (search/route preview) ── */}
        {(previewRoute || selectedStop) && (
          <Mapbox.ShapeSource id="osm-stops" shape={osmStopsGeoJSON as any}>
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
        )}

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

        {/* Nearby MarkerView stops removed — replaced by OSM transport stops layer */}

        {/* Queue badges removed — vehicles are now primary */}

        {/* Fire towers + pulsing rings removed — vehicles are primary */}

        {/* Station capsule pins removed — vehicles + OSM stops are primary */}

        {/* ── Route line (drawn on vehicle tap) ── */}
        <Mapbox.ShapeSource id="vehicle-route-line" shape={routeLineGeoJSON}>
          <Mapbox.LineLayer
            id="vehicle-route-glow"
            style={{
              lineColor: '#FFAD3A',
              lineWidth: 10,
              lineOpacity: 0.12,
              lineBlur: 6,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
          <Mapbox.LineLayer
            id="vehicle-route-main"
            style={{
              lineColor: '#FFAD3A',
              lineWidth: 4,
              lineOpacity: 0.85,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        </Mapbox.ShapeSource>

        {/* ── Destination marker ── */}
        <Mapbox.ShapeSource id="vehicle-dest" shape={destMarkerGeoJSON}>
          <Mapbox.CircleLayer
            id="dest-glow"
            style={{ circleRadius: 16, circleColor: '#22c55e', circleOpacity: 0.12 }}
          />
          <Mapbox.CircleLayer
            id="dest-dot"
            style={{ circleRadius: 7, circleColor: '#22c55e', circleStrokeWidth: 3, circleStrokeColor: '#fff' }}
          />
          <Mapbox.SymbolLayer
            id="dest-label"
            style={{
              textField: ['get', 'name'],
              textSize: 12,
              textFont: ['DIN Pro Bold'],
              textOffset: [0, 1.6],
              textAnchor: 'top',
              textColor: '#22c55e',
              textHaloColor: 'rgba(0,0,0,0.85)',
              textHaloWidth: 2,
            }}
          />
        </Mapbox.ShapeSource>

        {/* ── Live vehicle markers — GPS positions from Fleet app ── */}
        <LiveVehicleLayer
          vehicles={liveVehicles}
          onVehicleTap={async (vehicle) => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            setSelectedVehicle(vehicle)

            const dest = ROUTE_DESTINATIONS[vehicle.routeLabel || '']
            if (dest) {
              try {
                const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${vehicle.longitude},${vehicle.latitude};${dest.lng},${dest.lat}?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`
                const res = await fetch(url)
                const data = await res.json()
                if (data.routes?.[0]) {
                  const route = data.routes[0]
                  setVehicleETA(Math.round(route.duration / 60) + ' min')
                  setVehicleDist((route.distance / 1000).toFixed(1) + ' km')
                  setRouteLineGeoJSON({ type: 'Feature', geometry: route.geometry })
                  setDestMarkerGeoJSON({
                    type: 'FeatureCollection',
                    features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [dest.lng, dest.lat] }, properties: { name: dest.name } }],
                  })
                  // Fit camera to show route
                  const coords = route.geometry.coordinates
                  const lngs = coords.map((c: number[]) => c[0])
                  const lats = coords.map((c: number[]) => c[1])
                  cameraRef.current?.fitBounds(
                    [Math.max(...lngs), Math.max(...lats)],
                    [Math.min(...lngs), Math.min(...lats)],
                    [100, 60, 180, 60],
                    800
                  )
                }
              } catch {}
            } else {
              cameraRef.current?.setCamera({
                centerCoordinate: [vehicle.longitude, vehicle.latitude],
                zoomLevel: 15,
                animationDuration: 600,
              })
            }
          }}
        />

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
      </Mapbox.MapView>}

      {/* Placeholder — stays on top until map tiles are fully painted */}
      {!mapIdle && (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: isDark ? '#1c1917' : '#f5f5f4', alignItems: 'center', justifyContent: 'center' }]} pointerEvents={mapIdle ? 'none' : 'auto'}>
          <Animated.View style={{ opacity: 0.4 }}>
            <Navigation size={32} color={c.stone400} />
          </Animated.View>
        </View>
      )}

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

      {/* Live status badge — tappable, expandable, dismissible */}
      {(activeQueueCount > 0 || incidents.length > 0) && !liveBadgeDismissed && (
        <View style={s.liveBadgeStack}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setLiveBadgeExpanded(!liveBadgeExpanded)}
            style={s.liveBadge}
          >
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: activeQueueCount >= 3 ? '#ef4444' : '#f59e0b' }} />
            <Text style={s.liveBadgeText}>
              {activeQueueCount > 0 ? `${activeQueueCount} ${activeQueueCount >= 3 ? '🔥' : '⚠️'} queue${activeQueueCount !== 1 ? 's' : ''}` : ''}
              {activeQueueCount > 0 && incidents.length > 0 ? ' · ' : ''}
              {incidents.length > 0 ? `${incidents.length} incident${incidents.length !== 1 ? 's' : ''}` : ''}
            </Text>
            <TouchableOpacity
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              onPress={(e) => { e.stopPropagation(); setLiveBadgeDismissed(true) }}
            >
              <X size={14} color={isDark ? '#78716c' : '#a8a29e'} />
            </TouchableOpacity>
          </TouchableOpacity>

          {/* Expanded detail panel */}
          {liveBadgeExpanded && (
            <View style={s.liveBadgeDetail}>
              {activeQueueStations.slice(0, 5).map((station) => (
                <TouchableOpacity
                  key={station.name}
                  activeOpacity={0.7}
                  onPress={() => {
                    const routeIds = getRoutesForStop(station.name)
                    setSelectedStop({
                      name: station.name,
                      latitude: station.coordinate[1],
                      longitude: station.coordinate[0],
                      routeIds,
                      distanceKm: null,
                      queueStatus: station.queueStatus,
                      waitText: station.waitText,
                      lastReportAt: station.lastReportAt,
                      reportCount: station.reportCount,
                    })
                    cameraRef.current?.setCamera({
                      centerCoordinate: station.coordinate,
                      zoomLevel: 14,
                      animationDuration: 600,
                    })
                    bottomSheetRef.current?.snapToIndex(1)
                    setLiveBadgeExpanded(false)
                  }}
                  style={s.liveBadgeDetailRow}
                >
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: station.queueStatus === 'very_long' ? '#ef4444' : station.queueStatus === 'long' ? '#f97316' : '#f59e0b' }} />
                  <Text style={s.liveBadgeDetailName} numberOfLines={1}>{station.name}</Text>
                  <Text style={s.liveBadgeDetailStatus}>
                    {station.waitText || (station.queueStatus === 'very_long' ? 'Very Long' : station.queueStatus === 'long' ? 'Long' : 'Moderate')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
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

      {/* ── Fixed bottom card — Citibike style (no drag, no expand) ── */}
      {!selectedVehicle && (
        <View style={s.fixedCard}>
          <View style={{ flex: 1 }}>
            <Text style={s.fixedCardTitle}>
              {liveVehicleCount > 0
                ? `${liveVehicleCount} trotro${liveVehicleCount !== 1 ? 's' : ''} nearby`
                : 'Take a ride'
              }
            </Text>
            <Text style={s.fixedCardSub}>
              {liveVehicles.length > 0
                ? liveVehicles[0].routeLabel || 'Tap a bus on the map'
                : 'No live trotros right now'
              }
            </Text>
          </View>
          <TouchableOpacity style={s.fixedCardScan} activeOpacity={0.8}>
            <Text style={s.fixedCardScanText}>Scan</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Vehicle info card (shown on vehicle tap) ── */}
      {selectedVehicle && (
        <View style={s.vehicleCard}>
          <View style={s.vehicleCardHeader}>
            <View style={s.vehicleCardAvatar}>
              <Text style={s.vehicleCardInitials}>
                {selectedVehicle.plateNumber.slice(0, 2)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.vehicleCardPlate}>{selectedVehicle.plateNumber}</Text>
              <Text style={s.vehicleCardRoute}>{selectedVehicle.routeLabel || 'En route'}</Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                setSelectedVehicle(null)
                setRouteLineGeoJSON({ type: 'FeatureCollection', features: [] })
                setDestMarkerGeoJSON({ type: 'FeatureCollection', features: [] })
              }}
              style={s.vehicleCardClose}
            >
              <X size={16} color={isDark ? c.stone400 : c.stone500} />
            </TouchableOpacity>
          </View>
          <View style={s.vehicleCardStats}>
            <View style={s.vehicleCardStat}>
              <Text style={s.vehicleCardStatLabel}>SPEED</Text>
              <Text style={s.vehicleCardStatValue}>
                {selectedVehicle.speed ? (selectedVehicle.speed * 3.6).toFixed(0) : '0'} km/h
              </Text>
            </View>
            <View style={s.vehicleCardStat}>
              <Text style={s.vehicleCardStatLabel}>ETA</Text>
              <Text style={[s.vehicleCardStatValue, { color: c.amber500 }]}>{vehicleETA}</Text>
            </View>
            <View style={s.vehicleCardStat}>
              <Text style={s.vehicleCardStatLabel}>DIST</Text>
              <Text style={s.vehicleCardStatValue}>{vehicleDist}</Text>
            </View>
          </View>
          <TouchableOpacity style={s.vehicleCardCTA} activeOpacity={0.8}>
            <Text style={s.vehicleCardCTAText}>🎫 Buy Ticket · GH₵ 8.00</Text>
          </TouchableOpacity>
        </View>
      )}

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
    liveBadgeStack: {
      position: 'absolute',
      left: 16,
      bottom: '22%',
      gap: 8,
    },
    liveBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: isDark ? 'rgba(12,10,9,0.85)' : 'rgba(255,255,255,0.95)',
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 16,
      borderLeftWidth: 3,
      borderLeftColor: '#f59e0b',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 12,
      elevation: 6,
    },
    liveBadgeText: {
      fontSize: 13,
      fontFamily: font.bold,
      color: isDark ? '#fafaf9' : '#1c1917',
      letterSpacing: 0.3,
      flex: 1,
    },
    liveBadgeDetail: {
      backgroundColor: isDark ? 'rgba(12,10,9,0.95)' : 'rgba(255,255,255,0.95)',
      borderRadius: 16,
      paddingVertical: 6,
      paddingHorizontal: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 8,
      minWidth: 220,
    },
    liveBadgeDetailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    },
    liveBadgeDetailName: {
      flex: 1,
      fontSize: 14,
      fontFamily: font.semibold,
      color: isDark ? '#fafaf9' : '#1c1917',
    },
    liveBadgeDetailStatus: {
      fontSize: 12,
      fontFamily: font.bold,
      color: '#f97316',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
      backgroundColor: isDark ? 'rgba(249,115,22,0.12)' : 'rgba(249,115,22,0.08)',
      overflow: 'hidden',
    },
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

    // ── New bottom sheet content ──
    sheetContent: {
      paddingHorizontal: 20,
      paddingTop: 8,
      gap: 20,
    },
    liveHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    liveDotWrap: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: 'rgba(34,197,94,0.2)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    liveDotInner: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#22c55e',
    },
    liveHeaderText: {
      fontSize: 14,
      fontFamily: font.medium,
      color: t.textSecondary,
    },
    liveHeaderCount: {
      fontFamily: font.bold,
      color: c.amber500,
    },

    // Quick actions
    quickActions: {
      flexDirection: 'row',
      gap: 12,
    },
    quickAction: {
      flex: 1,
      alignItems: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: 16,
      backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
    },
    quickActionIcon: {
      width: 44,
      height: 44,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
    },
    quickActionLabel: {
      fontSize: 12,
      fontFamily: font.semibold,
      color: t.text,
    },

    // Nearby vehicles
    nearbySection: {
      gap: 10,
    },
    nearbySectionTitle: {
      fontSize: 16,
      fontFamily: font.bold,
      color: t.text,
      marginBottom: 4,
    },
    vehicleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 14,
      backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
    },
    vehicleRowDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: c.amber500,
    },
    vehicleRowInfo: {
      flex: 1,
    },
    vehicleRowPlate: {
      fontSize: 15,
      fontFamily: font.bold,
      color: t.text,
    },
    vehicleRowRoute: {
      fontSize: 12,
      fontFamily: font.regular,
      color: t.textSecondary,
      marginTop: 2,
    },
    vehicleRowEta: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      backgroundColor: isDark ? 'rgba(255,173,58,0.1)' : 'rgba(255,173,58,0.08)',
    },
    vehicleRowEtaText: {
      fontSize: 12,
      fontFamily: font.bold,
      color: c.amber500,
    },

    // Empty state
    emptyState: {
      alignItems: 'center',
      gap: 10,
      paddingVertical: 40,
    },
    emptyStateText: {
      fontSize: 16,
      fontFamily: font.semibold,
      color: t.text,
    },
    emptyStateSub: {
      fontSize: 13,
      fontFamily: font.regular,
      color: t.textSecondary,
      textAlign: 'center',
    },

    // Vehicle info card
    vehicleCard: {
      position: 'absolute',
      bottom: '20%',
      left: 16,
      right: 16,
      backgroundColor: isDark ? 'rgba(28,25,23,0.96)' : 'rgba(255,255,255,0.97)',
      borderRadius: 16,
      padding: 16,
      gap: 12,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,173,58,0.12)' : 'rgba(0,0,0,0.06)',
      zIndex: 20,
      ...Platform.select({
        ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 20 },
        android: { elevation: 12 },
      }),
    },
    vehicleCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    vehicleCardAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: c.amber500,
      justifyContent: 'center',
      alignItems: 'center',
    },
    vehicleCardInitials: {
      fontSize: 15,
      fontFamily: font.extrabold,
      color: '#1c1917',
    },
    vehicleCardPlate: {
      fontSize: 17,
      fontFamily: font.bold,
      color: t.text,
    },
    vehicleCardRoute: {
      fontSize: 12,
      fontFamily: font.regular,
      color: t.textSecondary,
      marginTop: 2,
    },
    vehicleCardClose: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    vehicleCardStats: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingVertical: 8,
      borderTopWidth: 1,
      borderTopColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
    },
    vehicleCardStat: {
      alignItems: 'center',
    },
    vehicleCardStatLabel: {
      fontSize: 9,
      fontFamily: font.bold,
      color: t.textSecondary,
      letterSpacing: 1.5,
    },
    vehicleCardStatValue: {
      fontSize: 18,
      fontFamily: font.extrabold,
      color: t.text,
      marginTop: 2,
    },
    vehicleCardCTA: {
      backgroundColor: c.amber500,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: 'center',
    },
    vehicleCardCTAText: {
      fontSize: 14,
      fontFamily: font.bold,
      color: '#1c1917',
    },

    // Fixed bottom card — Citibike style (one card, no drag)
    fixedCard: {
      position: 'absolute',
      bottom: 90,
      left: 12,
      right: 12,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#1c1917' : '#ffffff',
      borderRadius: 14,
      paddingVertical: 14,
      paddingHorizontal: 16,
      gap: 12,
      zIndex: 15,
      ...Platform.select({
        ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 10 },
        android: { elevation: 6 },
      }),
    },
    fixedCardTitle: {
      fontSize: 16,
      fontFamily: font.extrabold,
      color: t.text,
    },
    fixedCardSub: {
      fontSize: 12,
      fontFamily: font.regular,
      color: t.textSecondary,
      marginTop: 2,
    },
    fixedCardScan: {
      backgroundColor: c.amber500,
      borderRadius: 10,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    fixedCardScanText: {
      fontSize: 14,
      fontFamily: font.bold,
      color: '#1c1917',
    },

  })
}
