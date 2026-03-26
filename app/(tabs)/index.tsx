import { useState, useCallback, useMemo, useRef } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  useColorScheme,
  StyleSheet,
  Platform,
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
import { c, themed, font, shadow } from '@/lib/theme'
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
import { getWaitEstimate, type StationWithQueue, type QueueStatus } from '@/lib/services/stations'
import { TRAIN_SCHEDULES } from '@/lib/constants/train-schedule'
import { getGhanaTime } from '@/lib/utils/time'
import {
  TrotroStationIcon,
  TrainStationIcon,
  MajorStationIcon,
  QueueActiveIcon,
} from '@/components/MapMarkers'

Mapbox.setAccessToken('pk.eyJ1Ijoic2FtcHkxIiwiYSI6ImNranl2NHNjdTAxZzQzMWxldmx5dGhkaDEifQ.1eOzL1554nbXGIPai5Kmlg')

/* ── Constants ─────────────────────────────────────── */

const ACCRA_CENTER: [number, number] = [-0.187, 5.6037]

const QUEUE_COLORS: Record<QueueStatus, string> = {
  empty: '#22c55e',
  short: '#22c55e',
  moderate: '#f59e0b',
  long: '#f97316',
  very_long: '#ef4444',
}

const TROSKI_ORANGE = '#e88a3a'

// Pre-compute train station names for map layer filtering
const TRAIN_STATION_NAMES = new Set(
  Object.values(TRAIN_SCHEDULES)
    .flatMap((scheds) => scheds.flatMap((s) => s.stops.map((st) => st.station.toLowerCase()))),
)

/* ── Helpers ───────────────────────────────────────── */

function getGreeting(): string {
  const { hours, minutes } = getGhanaTime()
  const h = hours % 12 || 12
  const ampm = hours < 12 ? 'AM' : 'PM'
  const mm = minutes.toString().padStart(2, '0')
  const period = hours < 12 ? 'Good morning' : hours < 17 ? 'Good afternoon' : 'Good evening'
  return `${period} · ${h}:${mm} ${ampm}`
}

function getStationColor(station: StationWithQueue): string {
  const status = station.queue_stats?.[0]?.current_status as QueueStatus | undefined
  return status ? QUEUE_COLORS[status] : TROSKI_ORANGE
}

/* ── Component ─────────────────────────────────────── */

export default function HomeScreen() {
  const router = useRouter()
  const isDark = useColorScheme() === 'dark'
  const t = themed(isDark)
  const s = getStyles(isDark)

  const { profile, deviceId } = useApp()
  const { routes: popularRoutes } = usePopularRoutes()
  useRefreshOnFocus([['routes', 'popular'], ['profile']])

  const { tripState, activeTrip, endTrip } = useTrip()
  const { stations } = useStations()
  const { location, isPermissionGranted: locationGranted, requestPermission: requestLocationPermission } = useLocation()
  const greeting = getGreeting()
  const cameraRef = useRef<Mapbox.Camera>(null)
  const bottomSheetRef = useRef<BottomSheet>(null)
  const [serviceMode, setServiceMode] = useState<ServiceMode>('trotro')
  const [searchVisible, setSearchVisible] = useState(false)

  const center: [number, number] = location
    ? [location.longitude, location.latitude]
    : ACCRA_CENTER

  // Station dots GeoJSON — differentiate trotro (amber) vs train (blue)
  const stationGeojson = useMemo(() => {
    const features = stations
      .map((station) => {
        const coords = getStationCoords(station)
        if (!coords) return null
        const stat = station.queue_stats?.[0]
        const waitText = stat ? getWaitEstimate(stat) : ''
        const isTrain = TRAIN_STATION_NAMES.has(station.name.toLowerCase()) ? 1 : 0
        const hasQueue = stat ? 1 : 0
        // Determine which custom marker icon to use
        let markerIcon = 'marker-trotro'
        if (isTrain) markerIcon = 'marker-train'
        else if (hasQueue) markerIcon = 'marker-queue'
        else if (station.is_major) markerIcon = 'marker-major'

        return {
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: [coords.longitude, coords.latitude],
          },
          properties: {
            id: station.id,
            name: station.name,
            color: isTrain ? '#0ea5e9' : getStationColor(station),
            waitText,
            isMajor: station.is_major ? 1 : 0,
            isTrain,
            hasQueue,
            markerIcon,
          },
        }
      })
      .filter(Boolean)
    return { type: 'FeatureCollection' as const, features }
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
      >
        <Mapbox.Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: center,
            zoomLevel: 13,
          }}
        />

        <Mapbox.UserLocation visible animated />

        {/* Register custom marker icons */}
        <Mapbox.Images>
          <Mapbox.Image name="marker-trotro"><TrotroStationIcon size={32} /></Mapbox.Image>
          <Mapbox.Image name="marker-train"><TrainStationIcon size={32} /></Mapbox.Image>
          <Mapbox.Image name="marker-major"><MajorStationIcon size={36} /></Mapbox.Image>
          <Mapbox.Image name="marker-queue"><QueueActiveIcon size={44} /></Mapbox.Image>
        </Mapbox.Images>

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

        {/* All stations — custom icon markers */}
        <Mapbox.ShapeSource id="home-stations" shape={stationGeojson as any}>
          {/* Glow rings behind queue-active stations */}
          <Mapbox.CircleLayer
            id="home-station-glow-outer"
            belowLayerID="home-station-icons"
            filter={['==', ['get', 'hasQueue'], 1]}
            style={{
              circleRadius: 26,
              circleColor: '#f59e0b',
              circleOpacity: 0.08,
            }}
          />
          <Mapbox.CircleLayer
            id="home-station-glow-inner"
            belowLayerID="home-station-icons"
            filter={['==', ['get', 'hasQueue'], 1]}
            style={{
              circleRadius: 16,
              circleColor: '#f59e0b',
              circleOpacity: 0.15,
            }}
          />
          {/* Custom icon markers */}
          <Mapbox.SymbolLayer
            id="home-station-icons"
            style={{
              iconImage: ['get', 'markerIcon'],
              iconSize: 1,
              iconAllowOverlap: true,
              iconAnchor: 'bottom',
            }}
          />
          {/* Station name labels */}
          <Mapbox.SymbolLayer
            id="home-station-labels"
            minZoomLevel={12}
            style={{
              textField: ['get', 'name'],
              textSize: [
                'case',
                ['==', ['get', 'isTrain'], 1], 11,
                ['==', ['get', 'isMajor'], 1], 11,
                10,
              ],
              textColor: [
                'case',
                ['==', ['get', 'isTrain'], 1], '#0ea5e9',
                isDark ? '#d1d5db' : '#374151',
              ],
              textHaloColor: isDark ? '#111827' : '#ffffff',
              textHaloWidth: 1.5,
              textOffset: [0, 0.3],
              textAnchor: 'top',
              textAllowOverlap: false,
              textFont: [
                'case',
                ['==', ['get', 'isTrain'], 1], ['literal', ['DIN Pro Bold', 'Arial Unicode MS Bold']],
                ['==', ['get', 'isMajor'], 1], ['literal', ['DIN Pro Bold', 'Arial Unicode MS Bold']],
                ['literal', ['DIN Pro Medium', 'Arial Unicode MS Regular']],
              ] as any,
            }}
          />
          {/* Wait time labels below name */}
          <Mapbox.SymbolLayer
            id="home-station-wait"
            minZoomLevel={12}
            filter={['!=', ['get', 'waitText'], '']}
            style={{
              textField: ['get', 'waitText'],
              textSize: 9,
              textColor: isDark ? '#9ca3af' : '#6b7280',
              textOffset: [0, 1.6],
              textAnchor: 'top',
              textAllowOverlap: false,
              textFont: ['DIN Pro Medium', 'Arial Unicode MS Regular'],
            }}
          />
        </Mapbox.ShapeSource>
      </Mapbox.MapView>

      {/* ── Floating search bar only — clean map ── */}
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
            <Text style={s.searchPlaceholder}>Where are you going?</Text>
          </View>
          <Search size={22} color={c.amber500} />
        </TouchableOpacity>
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
          backgroundColor: t.card,
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
          {/* Service mode pills */}
          <ServiceModePills
            activeMode={serviceMode}
            onModeChange={handleModeChange}
            hasActiveTrip={tripState !== 'idle'}
          />

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
  })
}
