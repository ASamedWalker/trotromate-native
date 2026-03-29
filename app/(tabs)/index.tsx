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
import { c, font, shadow, themed } from '@/lib/theme'
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
import { getGhanaTime, timeAgo } from '@/lib/utils/time'
import { useActiveIncidents } from '@/lib/hooks/useActiveIncidents'
import { IncidentMapPin, INCIDENT_CONFIGS } from '@/components/IncidentMapPin'
import { type ActiveIncident } from '@/lib/hooks/useActiveIncidents'
import { StationMapPin, type StationPinType } from '@/components/StationMapPin'

Mapbox.setAccessToken('pk.eyJ1Ijoic2FtcHkxIiwiYSI6ImNranl2NHNjdTAxZzQzMWxldmx5dGhkaDEifQ.1eOzL1554nbXGIPai5Kmlg')

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
  }, [fadeAnim, slideAnim])

  return (
    <Animated.Text
      style={[style, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
    >
      {SEARCH_HINTS[index]}
    </Animated.Text>
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

/* ── Incident Callout ──────────────────────────────── */

const INCIDENT_LABELS: Record<string, string> = {
  traffic: 'Heavy Traffic',
  accident: 'Accident Reported',
  police: 'Police Checkpoint',
  police_checkpoint: 'Police Checkpoint',
  roadwork: 'Road Work',
  road_closure: 'Road Closed',
  flooding: 'Flooding / Hazard',
  breakdown: 'Breakdown / Work',
}

function IncidentCallout({ incident, onClose }: { incident: ActiveIncident; onClose: () => void }) {
  const config = INCIDENT_CONFIGS[incident.incident_type]
  const color = config?.color ?? '#ef4444'
  const label = INCIDENT_LABELS[incident.incident_type] ?? incident.incident_type

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onClose}
      style={{
        alignItems: 'center',
        marginBottom: 8,
      }}
    >
      <View style={{
        backgroundColor: '#fff',
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 12,
        minWidth: 180,
        maxWidth: 260,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
        borderLeftWidth: 4,
        borderLeftColor: color,
      }}>
        <Text style={{
          fontSize: 14,
          fontFamily: font.bold,
          color: color,
          marginBottom: 2,
        }}>{label}</Text>
        <Text style={{
          fontSize: 13,
          fontFamily: font.medium,
          color: '#312e2d',
        }} numberOfLines={1}>{incident.location_name}</Text>
        <Text style={{
          fontSize: 11,
          fontFamily: font.regular,
          color: '#7a7674',
          marginTop: 3,
        }}>{timeAgo(incident.reported_at)}</Text>
      </View>
      {/* Arrow pointing down to the pin */}
      <View style={{
        width: 0,
        height: 0,
        borderLeftWidth: 8,
        borderRightWidth: 8,
        borderTopWidth: 8,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderTopColor: '#fff',
      }} />
    </TouchableOpacity>
  )
}

/* ── Component ─────────────────────────────────────── */

export default function HomeScreen() {
  const router = useRouter()
  const isDark = useColorScheme() === 'dark'
  const s = getStyles(isDark)

  const { profile, deviceId } = useApp()
  const { routes: popularRoutes } = usePopularRoutes()
  useRefreshOnFocus([['routes', 'popular'], ['profile']])

  const { tripState, activeTrip, endTrip } = useTrip()
  const { stations } = useStations()
  const { location, isPermissionGranted: locationGranted, requestPermission: requestLocationPermission } = useLocation()
  const { incidents } = useActiveIncidents()
  const greeting = getGreeting()
  const cameraRef = useRef<Mapbox.Camera>(null)
  const bottomSheetRef = useRef<BottomSheet>(null)
  const [serviceMode, setServiceMode] = useState<ServiceMode>('trotro')
  const [searchVisible, setSearchVisible] = useState(false)
  const [selectedIncident, setSelectedIncident] = useState<ActiveIncident | null>(null)

  const center: [number, number] = location
    ? [location.longitude, location.latitude]
    : ACCRA_CENTER

  // GeoJSON for incident tap detection (invisible layer — visual pins are MarkerViews)
  const incidentGeojson = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: incidents.map((inc) => ({
      type: 'Feature' as const,
      id: inc.id,
      geometry: {
        type: 'Point' as const,
        coordinates: [inc.longitude, inc.latitude],
      },
      properties: {
        id: inc.id,
        incident_type: inc.incident_type,
        location_name: inc.location_name,
        reported_at: inc.reported_at,
      },
    })),
  }), [incidents])

  // Station pin data for PointAnnotations
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
    setServiceMode(mode)
    if (mode === 'go') {
      if (activeTrip) {
        router.push({
          pathname: '/trip/[routeId]',
          params: {
            routeId: activeTrip.routeId,
            ...(activeTrip.transportType === 'train' ? { type: 'train', lineId: activeTrip.trainLineId ?? activeTrip.routeId } : {}),
          },
        } as Href)
      } else {
        router.push('/routes')
      }
    } else if (mode === 'train') {
      router.push('/train')
    } else if (mode === 'tales') {
      router.push('/(tabs)/tales' as Href)
    }
  }, [activeTrip, router])

  return (
    <View style={s.container}>
      <OfflineBanner />

      {/* ── Full-bleed map ── */}
      <Mapbox.MapView
        style={StyleSheet.absoluteFillObject}
        styleURL={isDark ? Mapbox.StyleURL.Dark : Mapbox.StyleURL.Street}
        attributionEnabled={false}
        logoEnabled={false}
        compassEnabled={false}
        scaleBarEnabled={false}
        onPress={() => { if (selectedIncident) setSelectedIncident(null) }}
      >
        <Mapbox.Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: center,
            zoomLevel: 13,
          }}
        />

        <Mapbox.UserLocation visible animated />

        {/* Train route lines — blue polylines */}
        <Mapbox.ShapeSource id="train-lines" shape={trainLinesGeojson as any}>
          <Mapbox.LineLayer
            id="train-lines-layer"
            style={{
              lineColor: '#0ea5e9',
              lineWidth: 3,
              lineOpacity: 0.6,
              lineCap: 'round',
              lineJoin: 'round',
              lineDasharray: [2, 3],
            }}
          />
        </Mapbox.ShapeSource>

        {/* All stations — Waze-style animated PointAnnotations */}
        {/* All stations — Waze-style animated MarkerViews */}
        {stationPins.map((pin) => (
          <Mapbox.MarkerView
            key={pin.id}
            coordinate={pin.coordinate}
            allowOverlap={false}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <StationMapPin
              type={pin.pinType}
              name={pin.name}
              waitText={pin.waitText}
              queueStatus={pin.queueStatus as any}
            />
          </Mapbox.MarkerView>
        ))}

        {/* Incident pins — animated MarkerViews (visual only, no tap) */}
        {incidents.map((inc) => (
          <Mapbox.MarkerView
            key={inc.id}
            coordinate={[inc.longitude, inc.latitude]}
            allowOverlap
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <IncidentMapPin
              type={inc.incident_type}
              createdAt={inc.reported_at}
            />
          </Mapbox.MarkerView>
        ))}

        {/* Invisible tap layer for incidents — ShapeSource onPress works on Android */}
        <Mapbox.ShapeSource
          id="incident-tap-targets"
          shape={incidentGeojson}
          hitbox={{ width: 80, height: 80 }}
          onPress={(e: any) => {
            const feature = e.features?.[0]
            if (!feature?.properties?.id) return
            const tapped = incidents.find((i) => i.id === feature.properties.id)
            if (tapped) setSelectedIncident(tapped)
          }}
        >
          <Mapbox.CircleLayer
            id="incident-tap-circles"
            style={{
              circleRadius: 40,
              circleOpacity: 0,
            }}
          />
        </Mapbox.ShapeSource>

        {/* Incident callout tooltip — above the selected pin */}
        {selectedIncident && (
          <Mapbox.MarkerView
            coordinate={[selectedIncident.longitude, selectedIncident.latitude]}
            allowOverlap
            anchor={{ x: 0.5, y: 1 }}
          >
            <IncidentCallout
              incident={selectedIncident}
              onClose={() => setSelectedIncident(null)}
            />
          </Mapbox.MarkerView>
        )}
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
          hasActiveTrip={tripState !== 'idle'}
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
          backgroundColor: isDark ? '#1c1c1e' : '#f5f5f4',
          borderRadius: 24,
          ...shadow.cardStrong,
        }}
        handleIndicatorStyle={{
          backgroundColor: isDark ? c.stone500 : c.stone300,
          width: 40,
        }}
        enablePanDownToClose={false}
      >
        <BottomSheetScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
        >
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
        </BottomSheetScrollView>
      </BottomSheet>

      <ReportFAB />
      <UnifiedSearch visible={searchVisible} onClose={() => setSearchVisible(false)} />
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
