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
import { type StationPinType } from '@/components/StationMapPin'
import { useQuery } from '@tanstack/react-query'
import { X, ShieldCheck, ChevronRight, Route as RouteIcon } from 'lucide-react-native'
import { useNearbyRouteStops, type NearbyStop } from '@/lib/hooks/useNearbyRouteStops'
import { useTransportStops } from '@/lib/hooks/useTransportStops'
import { useRailwayLines } from '@/lib/hooks/useRailwayLines'
import { StopRoutesPanel } from '@/components/StopRoutesPanel'
import LiveVehicleLayer from '@/components/LiveVehicleLayer'
import { useVehiclePositions } from '@/lib/hooks/useVehiclePositions'
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
  const snapPoints = useMemo(() => ['18%', '45%'], [])

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
        styleURL={isNightMap ? MAP_STYLE_DARK : MAP_STYLE_LIGHT}
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

        {/* ── Transport icons for circle-to-icon transition ── */}
        <Mapbox.Images>
          {/* ── Capsule pill markers — Stitch-inspired design ── */}
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
        </Mapbox.Images>

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

        {/* ── Nearby trotro stops — clean MarkerView pins ── */}
        {nearbyStops.slice(0, 5).map((stop, i) => (
          <Mapbox.MarkerView
            key={`nearby-${stop.name}`}
            coordinate={[stop.longitude, stop.latitude]}
            allowOverlap={false}
            anchor={{ x: 0.5, y: 1 }}
          >
            <AnimatedMapPin>
              <TouchableOpacity
                activeOpacity={0.8}
                accessibilityLabel={`${stop.name} stop${stop.distanceKm ? `, ${stop.distanceKm.toFixed(1)} km away` : ''}`}
                accessibilityRole="button"
                onPress={() => {
                  const routeIds = getRoutesForStop(stop.name)
                  setSelectedStop({
                    name: stop.name,
                    latitude: stop.latitude,
                    longitude: stop.longitude,
                    routeIds,
                    distanceKm: stop.distanceKm,
                  })
                  cameraRef.current?.setCamera({
                    centerCoordinate: [stop.longitude, stop.latitude],
                    zoomLevel: 14,
                    animationDuration: 600,
                  })
                  bottomSheetRef.current?.snapToIndex(1)
                }}
              >
                <NearbyStopPin name={stop.name} isNearest={i === 0} isDark={isDark} />
              </TouchableOpacity>
            </AnimatedMapPin>
          </Mapbox.MarkerView>
        ))}

        {/* ── Active queue station badges — MarkerView with rounded card wait time ── */}
        {mapIdle && activeQueueStations.slice(0, 12).map((station) => (
          <Mapbox.MarkerView
            key={`queue-badge-${station.name}`}
            coordinate={station.coordinate}
            allowOverlap={true}
            anchor={{ x: 0.5, y: -0.8 }}
          >
            <TouchableOpacity
              activeOpacity={0.8}
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
              }}
            >
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                backgroundColor: station.queueStatus === 'very_long' || station.queueStatus === 'long'
                  ? 'rgba(239,68,68,0.9)'
                  : station.queueStatus === 'moderate'
                  ? 'rgba(245,158,11,0.9)'
                  : 'rgba(34,197,94,0.9)',
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 12,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 4,
                elevation: 6,
              }}>
                {(station.queueStatus === 'very_long' || station.queueStatus === 'long') ? (
                  <Flame size={12} color="#fff" strokeWidth={2.5} />
                ) : station.queueStatus === 'moderate' ? (
                  <AlertTriangle size={12} color="#fff" strokeWidth={2.5} />
                ) : (
                  <BusFront size={12} color="#fff" strokeWidth={2.5} />
                )}
                <Text style={{
                  color: '#fff',
                  fontSize: 11,
                  fontFamily: 'Poppins_700Bold',
                  letterSpacing: 0.3,
                }}>
                  {station.waitText || (
                    station.queueStatus === 'very_long' ? 'Very Long'
                    : station.queueStatus === 'long' ? 'Long'
                    : station.queueStatus === 'moderate' ? 'Moderate'
                    : 'Short'
                  )}
                </Text>
              </View>
            </TouchableOpacity>
          </Mapbox.MarkerView>
        ))}

        {/* ── 3D Fire towers at congested stations ── */}
        {mapIdle && fireTowersGeojson.features.length > 0 && (
          <Mapbox.ShapeSource id="fire-towers" shape={fireTowersGeojson as any}>
            <Mapbox.FillExtrusionLayer
              id="fire-tower-layer"
              minZoomLevel={13}
              maxZoomLevel={22}
              style={{
                fillExtrusionHeight: ['get', 'height'],
                fillExtrusionBase: 0,
                fillExtrusionColor: ['match', ['get', 'color'],
                  '#ef4444', '#ff6b6b',
                  '#f97316', '#ffaa5c',
                  '#f59e0b', '#ffc94d',
                  '#ff6b6b',
                ],
                fillExtrusionOpacity: 0.85,
                fillExtrusionVerticalGradient: true,
                fillExtrusionEmissiveStrength: 1.5,
              }}
            />
          </Mapbox.ShapeSource>
        )}

        {/* ── Pulsing rings for active stations (updated via ref, no re-renders) ── */}
        {mapIdle && activeQueueStations.length > 0 && (
          <Mapbox.ShapeSource
            ref={pulseSourceRef}
            id="pulse-rings"
            shape={{ type: 'FeatureCollection', features: [] } as any}
          >
            <Mapbox.CircleLayer
              id="pulse-ring"
              minZoomLevel={showAllPins ? 8 : 11}
              style={{
                circleRadius: ['get', 'radius'],
                circleColor: ['get', 'color'],
                circleOpacity: ['get', 'opacity'],
                circleStrokeWidth: 0,
              }}
            />
          </Mapbox.ShapeSource>
        )}

        {/* ── Station pins — native CircleLayer + SymbolLayer for performance ── */}
        <Mapbox.ShapeSource
          id="station-pins"
          shape={stationPinsGeojson as any}
          onPress={(e) => {
            const feature = e.features?.[0]
            if (!feature?.properties) return
            const { name } = feature.properties
            const pin = stationPins.find((p) => p.name === name)
            if (!pin) return
            const routeIds = getRoutesForStop(name)
            setSelectedStop({
              name,
              latitude: pin.coordinate[1],
              longitude: pin.coordinate[0],
              routeIds,
              distanceKm: null,
              queueStatus: pin.queueStatus,
              waitText: pin.waitText,
              lastReportAt: pin.lastReportAt,
              reportCount: pin.reportCount,
            })
            cameraRef.current?.setCamera({
              centerCoordinate: pin.coordinate,
              zoomLevel: 14,
              animationDuration: 600,
            })
            bottomSheetRef.current?.snapToIndex(1)
          }}
          hitbox={{ width: 30, height: 30 }}
        >
          {/* ── Ambient glow — visible aura around capsules at all zoom levels ── */}
          <Mapbox.CircleLayer
            id="station-ambient-outer"
            minZoomLevel={showAllPins ? 8 : 11}
            style={{
              circleRadius: ['interpolate', ['exponential', 1.2], ['zoom'], 10, 24, 12, 40, 14, 50, 16, 60],
              circleColor: ['match', ['get', 'queueStatus'],
                'empty', '#22c55e', 'short', '#22c55e',
                'moderate', '#f59e0b',
                'long', '#f97316', 'very_long', '#ef4444',
                ['match', ['get', 'pinType'],
                  'train', '#7c3aed',
                  'major', '#60a5fa',
                  '#60a5fa',
                ],
              ],
              circleOpacity: ['interpolate', ['linear'], ['zoom'], 10, 0.08, 12, 0.15, 14, 0.25, 16, 0.3],
              circleBlur: 0.8,
            }}
          />
          <Mapbox.CircleLayer
            id="station-ambient-inner"
            minZoomLevel={showAllPins ? 8 : 11}
            style={{
              circleRadius: ['interpolate', ['exponential', 1.2], ['zoom'], 10, 12, 12, 20, 14, 28, 16, 36],
              circleColor: ['match', ['get', 'queueStatus'],
                'empty', '#22c55e', 'short', '#22c55e',
                'moderate', '#f59e0b',
                'long', '#f97316', 'very_long', '#ef4444',
                ['match', ['get', 'pinType'],
                  'train', '#7c3aed',
                  'major', '#3b82f6',
                  '#3b82f6',
                ],
              ],
              circleOpacity: ['interpolate', ['linear'], ['zoom'], 10, 0.1, 12, 0.2, 14, 0.35, 16, 0.4],
              circleBlur: 0.5,
            }}
          />

          {/* ── Phase 1: Flat colored dots (zoom 11–12) — fade out as icons appear ── */}
          <Mapbox.CircleLayer
            id="station-halo"
            minZoomLevel={showAllPins ? 8 : 11}
            style={{
              circleRadius: ['interpolate', ['exponential', 1.2], ['zoom'], 10, 6, 12, 10, 13, 0],
              circleColor: ['match', ['get', 'pinType'],
                'train', '#7c3aed',
                'queue', ['match', ['get', 'queueStatus'],
                  'empty', '#22c55e', 'short', '#22c55e',
                  'moderate', '#f59e0b',
                  'long', '#f97316', 'very_long', '#ef4444',
                  '#22c55e',
                ],
                '#2563eb',
              ],
              circleOpacity: ['interpolate', ['linear'], ['zoom'], 12, 0.15, 13, 0],
            }}
          />
          <Mapbox.CircleLayer
            id="station-dot"
            minZoomLevel={showAllPins ? 8 : 11}
            style={{
              circleRadius: ['interpolate', ['exponential', 1.2], ['zoom'], 10, 3, 11, 4, 12, 6, 13, 0],
              circleColor: ['match', ['get', 'pinType'],
                'train', '#7c3aed',
                'queue', ['match', ['get', 'queueStatus'],
                  'empty', '#22c55e', 'short', '#22c55e',
                  'moderate', '#f59e0b',
                  'long', '#f97316', 'very_long', '#ef4444',
                  '#22c55e',
                ],
                '#2563eb',
              ],
              circleStrokeColor: isDark ? '#1c1917' : '#ffffff',
              circleStrokeWidth: ['interpolate', ['linear'], ['zoom'], 10, 1, 12, 2, 13, 0],
              circleOpacity: ['interpolate', ['linear'], ['zoom'], 12, 1, 13, 0],
              circleStrokeOpacity: ['interpolate', ['linear'], ['zoom'], 12, 1, 13, 0],
            }}
          />

          {/* ── Phase 2: Icon pins (zoom 13+) — fade in as dots disappear ── */}
          <Mapbox.SymbolLayer
            id="station-icon"
            minZoomLevel={12}
            style={{
              iconImage: ['get', 'iconName'],
              iconSize: ['interpolate', ['exponential', 1.2], ['zoom'], 12, 0, 13, 0.7, 14, 0.85, 16, 1.1],
              iconAllowOverlap: true,
              iconIgnorePlacement: true,
              iconOpacity: ['interpolate', ['linear'], ['zoom'], 12, 0, 13, 1],
              iconAnchor: 'center',
            }}
          />

          {/* Station name labels — below the icon pin */}
          <Mapbox.SymbolLayer
            id="station-labels"
            minZoomLevel={13}
            style={{
              textField: ['get', 'name'],
              textSize: ['interpolate', ['linear'], ['zoom'], 13, 9, 16, 12],
              textColor: isDark ? '#d6d3d1' : '#374151',
              textHaloColor: isDark ? '#0c0a09' : '#ffffff',
              textHaloWidth: 1.5,
              textFont: ['DIN Pro Medium', 'Arial Unicode MS Regular'],
              textOffset: ['interpolate', ['linear'], ['zoom'], 13, ['literal', [0, 1.6]], 14, ['literal', [0, 2.0]], 16, ['literal', [0, 2.4]]],
              textAnchor: 'top',
              textMaxWidth: 7,
              textAllowOverlap: false,
            }}
          />
          {/* Wait time pill badge — styled card below the capsule */}
          <Mapbox.SymbolLayer
            id="station-wait"
            minZoomLevel={13}
            filter={['!=', ['get', 'waitText'], '']}
            style={{
              textField: ['concat', '⏱ ', ['get', 'waitText']],
              textSize: ['interpolate', ['linear'], ['zoom'], 13, 10, 14, 11, 16, 13],
              textColor: '#ffffff',
              textFont: ['DIN Pro Bold', 'Arial Unicode MS Bold'],
              textOffset: ['interpolate', ['linear'], ['zoom'], 13, ['literal', [0, 2.2]], 14, ['literal', [0, 2.6]], 16, ['literal', [0, 3.0]]],
              textAnchor: 'top',
              textAllowOverlap: true,
              textIgnorePlacement: true,
              textPadding: 0,
              textHaloColor: ['match', ['get', 'queueStatus'],
                'empty', 'rgba(34,197,94,0.9)', 'short', 'rgba(34,197,94,0.9)',
                'moderate', 'rgba(245,158,11,0.9)',
                'long', 'rgba(249,115,22,0.9)', 'very_long', 'rgba(239,68,68,0.9)',
                'rgba(34,197,94,0.9)',
              ],
              textHaloWidth: 6,
              textHaloBlur: 1,
              textLetterSpacing: 0.05,
            }}
          />
        </Mapbox.ShapeSource>

        {/* ── Live vehicle markers — GPS positions from Fleet app ── */}
        <LiveVehicleLayer
          vehicles={liveVehicles}
          onVehicleTap={(vehicle) => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            cameraRef.current?.setCamera({
              centerCoordinate: [vehicle.longitude, vehicle.latitude],
              zoomLevel: 15,
              animationDuration: 600,
            })
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
        enableDynamicSizing={false}
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

  })
}
