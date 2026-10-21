import { ageLabel } from '@/lib/utils/freshness'
import { useState, useEffect, useRef, useMemo } from 'react'
import { fareSource, FARE_WARN_COLOR } from '@/lib/utils/fare-source'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  UIManager,
  Dimensions,
  Share,
  StyleSheet,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Clock, Navigation, Zap, AlertTriangle, Bus, Search, Info, ChevronRight, ChevronDown, ChevronLeft, MapPin, LocateFixed, Share as ShareIcon } from 'lucide-react-native'
import StopPickerModal from '@/components/StopPickerModal'
import { font } from '@/lib/theme'

const { height: SCREEN_H } = Dimensions.get('window')
// First sheet snap as a fraction of screen height (map padding + recenter FAB follow it).
const FIRST_SNAP = 0.6
// Calm pale Mapbox Light by day (stops + route pop on it); stock dark-v11 after dark.
// TODO(UX v2 M3): light basemap in all light-mode hours (dark only in dark mode) and the
// 5 dp brand route with a 2 dp white casing need Mapbox style work; not done here.
const MAP_STYLE_DAY = 'mapbox://styles/mapbox/light-v11'
const MAP_STYLE_NIGHT = 'mapbox://styles/mapbox/dark-v11'
import * as Haptics from 'expo-haptics'
import { FALLBACK_STATION_COORDS } from '@/lib/utils/station-coords'
import { fetchRouteTraffic } from '@/lib/services/traffic-api'
import { fetchQueueStatus } from '@/lib/services/queueStatus'
import { useVehiclePositions } from '@/lib/hooks/useVehiclePositions'
import { useLiveTripPositions } from '@/lib/hooks/useLiveTripPositions'
import { useRouteDetail } from '@/lib/hooks/useRoutes'
import { fetchRouteSegmentFares, resolveDropoffFareSync, type RouteSegmentFare } from '@/lib/services/segment-fares'
import { formatGHS } from '@/lib/utils/currency'
import Mapbox from '@rnmapbox/maps'
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet'
import Reanimated, { useSharedValue, useDerivedValue, useAnimatedStyle, runOnJS } from 'react-native-reanimated'
import { MAPBOX_TOKEN } from '@/lib/config/mapbox'
import { TROTRO_BOOKING_ENABLED } from '@/lib/config/booking'
import { RELEASE_MODE, FEATURES } from '@/lib/config/release'
import { useLanguage } from '@/lib/i18n'
import { ageT } from '@/lib/i18n/home-format'

const BRAND = '#FF4D1C'

// Stop layers (UX v2 M6). Module constants so re-renders never push new
// filter/style objects to the native layers.
const STOP_MINOR_FILTER = ['all', ['!=', ['get', 'sel'], 1], ['!=', ['get', 'major'], 1]] as const
const STOP_KEY_FILTER = ['any', ['==', ['get', 'sel'], 1], ['==', ['get', 'major'], 1]] as const
const STOP_MINOR_STYLE = {
  circleRadius: 4,
  circleColor: '#FFFFFF',
  circleStrokeWidth: 2,
  circleStrokeColor: '#FF4D1C',
  circlePitchAlignment: 'map',
} as const
const STOP_KEY_STYLE = {
  circleRadius: ['case', ['==', ['get', 'sel'], 1], 7, 5],
  circleColor: ['case', ['==', ['get', 'sel'], 1], '#FF4D1C', '#FFFFFF'],
  circleStrokeWidth: 2,
  circleStrokeColor: '#FF4D1C',
  circlePitchAlignment: 'map',
} as const

// Case-insensitive coord lookup
const COORDS_LOWER: Record<string, { lat: number; lon: number }> = {}
for (const [name, c] of Object.entries(FALLBACK_STATION_COORDS)) {
  COORDS_LOWER[name.toLowerCase()] = { lat: c.latitude, lon: c.longitude }
}

function getCoord(name: string) {
  return COORDS_LOWER[name.toLowerCase()] || null
}

// Compact "x ago" for fare-report freshness — builds trust by showing how recent
// the crowdsourced fare is, the way Transit/Citymapper timestamp their data.
// One age wording app-wide (lib/utils/freshness ageLabel).
const timeAgo = (iso: string): string => ageT(ageLabel(iso))

/* ── Transport options ── */

const ALL_TRANSPORT_OPTIONS = [
  { id: 'trotro', label: 'Trotro', image: require('@/assets/images/home/bus_icon_bg_removed.png'), fareMultiplier: 1 },
  // Okada routes carry their own (okada) fares; never mark them up again.
  { id: 'okada', label: 'Okada', image: require('@/assets/images/home/okada_icon_bg_removed.png'), fareMultiplier: 1 },
  { id: 'pragya', label: 'Pragya', image: require('@/assets/images/home/Pragya_icon_bg_removed.png'), fareMultiplier: 1.5 },
]

// Release mode: okada/pragya rides aren't offered yet, so only trotro is pickable.
const TRANSPORT_OPTIONS = FEATURES.okadaPragyaServices
  ? ALL_TRANSPORT_OPTIONS
  : ALL_TRANSPORT_OPTIONS.filter((o) => o.id === 'trotro')

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

export default function RouteDetailScreen() {
  const router = useRouter()
  const { t: tr } = useLanguage()
  const insets = useSafeAreaInsets()
  const sheetRef = useRef<BottomSheet>(null)
  const cameraRef = useRef<Mapbox.Camera>(null)
  // Sheet snaps: 0 = peek (just the route header, map free to explore), 1 = default,
  // 2/3 = taller. Tapping or panning the map drops it to the peek; tapping the peek
  // or dragging the handle brings it back.
  // UX v2 M1: exactly two lines (route + fare, then trip shape + source chip).
  const PEEK = 112 + insets.bottom
  const sheetIndexRef = useRef(1)
  const [sheetIndex, setSheetIndex] = useState(1)
  const lastStopTap = useRef(0)
  const collapseSheet = () => {
    if (sheetIndexRef.current > 0) sheetRef.current?.snapToIndex(0)
  }
  const expandSheet = () => {
    if (sheetIndexRef.current === 0) { Haptics.selectionAsync(); sheetRef.current?.snapToIndex(1) }
  }

  const params = useLocalSearchParams<{
    from: string; to: string; fare: string; duration: string
    transport_type: string; route_id: string; type: string; dropoff_order?: string
  }>()

  const from = params.from || ''
  const to = params.to || ''
  const baseFare = params.fare ? parseFloat(params.fare) : 0
  const duration = params.duration ? parseInt(params.duration) : 0
  const routeId = params.route_id || ''

  // Transport mode is chosen on the Plan a Trip screen and passed in via params —
  // no longer selectable here.
  const selectedTransport = params.transport_type || 'trotro'
  const selectedOption = TRANSPORT_OPTIONS.find(o => o.id === selectedTransport) || TRANSPORT_OPTIONS[0]
  const [trafficCondition, setTrafficCondition] = useState<string | null>(null)
  const [trafficDelay, setTrafficDelay] = useState(0)
  const [loadingTraffic, setLoadingTraffic] = useState(true)
  const [showVehicles, setShowVehicles] = useState(false)
  const [vehicleSearch, setVehicleSearch] = useState('')
  // Track the sheet's actual top Y (gorhom updates this every frame during drag —
  // reliable, unlike the onChange index). Drives the map overlays so the close X /
  // ETA pill hide once the sheet rises into them, and the recenter FAB hides once
  // the sheet covers it.
  const sheetPos = useSharedValue(99999)
  const [overlayHidden, setOverlayHidden] = useState(false)
  // UX v2 M4: no Traffic toggle or km pill (traffic tiles cost data for no rider
  // value). Recenter rides 12 dp above the sheet at every height, hidden at full.
  const [fabHidden, setFabHidden] = useState(false)
  useDerivedValue(() => {
    runOnJS(setOverlayHidden)(sheetPos.value < insets.top + 96)
    runOnJS(setFabHidden)(sheetPos.value < SCREEN_H * 0.2)
  }, [insets.top])
  // Day/night map style (Ghana local hours): branded by day, stock nav-night after dark.
  const isNight = useMemo(() => { const h = new Date().getHours(); return h < 6 || h >= 18 }, [])
  const mapStyleURL = isNight ? MAP_STYLE_NIGHT : MAP_STYLE_DAY

  // Live vehicles on this route — fallback to mock if none
  const { vehicles: liveVehicles, activeCount, loading: loadingVehicles } = useVehiclePositions(routeId || undefined, FEATURES.liveBuses) // FEATURES.liveBuses off: no fetch, no polling

  // Full route record (fare stats, stops, GPRTU flag) for the card. Degrades
  // gracefully to the params when routeId isn't a real route (e.g. deep link).
  const { route } = useRouteDetail(routeId)

  // Crowdsourced live trotros — riders in GO Mode broadcasting on this corridor
  const liveTrips = useLiveTripPositions(routeId || undefined)
  const liveTripsGeojson = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: liveTrips.map((t) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [t.longitude, t.latitude] },
      properties: { tripKey: t.tripKey },
    })),
  }), [liveTrips])

  // Only real broadcasting vehicles — fabricated plates/drivers with fake
  // "Live" pills made riders wait for buses that didn't exist (UX-05).
  const vehicles = liveVehicles

  // Fetch traffic
  useEffect(() => {
    if (!routeId) { setLoadingTraffic(false); return }
    fetchRouteTraffic(routeId).then(data => {
      if (data) {
        setTrafficCondition(data.traffic_condition)
        setTrafficDelay(data.delay_mins)
      }
      setLoadingTraffic(false)
    }).catch(() => setLoadingTraffic(false))
  }, [routeId])

  const fromCoord = getCoord(from)
  const toCoord = getCoord(to)
  const hasCoords = !!fromCoord && !!toCoord

  // Default center (Accra) if no coords
  const defaultCenter = { lon: -0.1870, lat: 5.6037 }
  const centerLon = hasCoords ? (fromCoord!.lon + toCoord!.lon) / 2 : defaultCenter.lon
  const centerLat = hasCoords ? (fromCoord!.lat + toCoord!.lat) / 2 : defaultCenter.lat


  // Fit the whole corridor with a flat (pitch 0) framing — leaves room for
  // the bottom sheet (paddingBottom) so the route sits above it.
  const fitRoute = (duration = 1500) => {
    if (!hasCoords || !cameraRef.current) return
    // [top, right, bottom, left] — generous bottom leaves room for the sheet.
    cameraRef.current.fitBounds(
      [Math.max(fromCoord!.lon, toCoord!.lon), Math.max(fromCoord!.lat, toCoord!.lat)],
      [Math.min(fromCoord!.lon, toCoord!.lon), Math.min(fromCoord!.lat, toCoord!.lat)],
      [insets.top + 120, 110, (sheetIndexRef.current === 0 ? PEEK : SCREEN_H * FIRST_SNAP) + 48, 52],
      duration,
    )
  }

  // Framing is handled by the Camera's defaultSettings.bounds (correct on first
  // paint) + onDidFinishLoadingMap → fitRoute, which avoids the cold-mount race
  // where cameraRef is still null inside a setTimeout.

  // Route line — fetch road-following geometry from Mapbox Directions API
  const [routeLine, setRouteLine] = useState<GeoJSON.Feature | null>(null)

  const snapPoints = useMemo(() => [PEEK, `${Math.round(FIRST_SNAP * 100)}%`, '74%', '90%'], [PEEK])
  // Recenter FAB rides just above the sheet (peek or default).
  const fabStyle = useAnimatedStyle(() => ({ bottom: Math.max(16, SCREEN_H - sheetPos.value + 12) }))


  // Some routes (e.g. okada corridors, deep links) have no duration: hide it, never "NaN min".
  const hasDuration = Number.isFinite(duration) && duration > 0
  const durationText = !hasDuration
    ? '—'
    : duration >= 60
      ? tr('routes.durHM', { h: Math.floor(duration / 60), m: duration % 60 })
      : `${duration} min`

  // ── Crowdsourced fare: show an honest avg + range, not a single "fixed" price.
  // Trotro fares vary, so a range + report count + freshness is the trust signal.
  const mult = selectedOption.fareMultiplier
  const fareStats = route?.fare_stats
  const minFare = fareStats?.min_reported_fare != null ? fareStats.min_reported_fare * mult : null
  const maxFare = fareStats?.max_reported_fare != null ? fareStats.max_reported_fare * mult : null
  const reportCount = fareStats?.report_count ?? 0
  const hasFareRange = reportCount > 0 && minFare != null && maxFare != null && maxFare - minFare > 0.01
  const fareFresh = fareStats?.last_report_at ? timeAgo(fareStats.last_report_at) : null
  // One source per fare (UX v2 L1/M2): a GPRTU-verified corridor shows the GPRTU fare;
  // otherwise the rider average, otherwise the search estimate.
  // Same rule + wording as the Lines list (lib/utils/fare-source.ts).
  const corridorSrc = route ? fareSource({ ...route, official_fare: Number(route.official_fare) }) : null
  const corridorOfficial = corridorSrc?.chip === 'GPRTU'
  const headlineFare = (corridorSrc?.amount != null ? corridorSrc.amount * mult : baseFare * mult).toFixed(2)

  // Trip shape for the header meta row
  const stopCount = route?.stops?.length ?? 0

  // Live availability — vehicles broadcasting + riders sharing GO Mode on this route
  const liveRiders = liveTrips.length
  const liveOnRoute = activeCount + liveRiders

  // ── Alight (drop-off) picker: trotro fares are per drop-off. When the corridor
  // has intermediate stops, let the rider pick where they get off; the displayed
  // fare becomes the stage fare origin → that stop (segment_fares → interpolated
  // → flat corridor fallback). Multiplier applied once for okada/pragya.
  const stops = useMemo(
    () => [...(route?.stops ?? [])].sort((a, b) => a.stop_order - b.stop_order),
    [route?.stops],
  )
  const hasStops = stops.length > 2
  const lastOrder = stops.length ? stops[stops.length - 1].stop_order : 0
  // Intermediate stops as Directions waypoints (API max 25 coordinates incl.
  // origin + destination → ≤23 vias, evenly sampled when a corridor has more).
  const waypointKey = useMemo(() => {
    const mid = stops.slice(1, -1).filter(st => st.latitude != null && st.longitude != null)
    if (mid.length === 0) return ''
    const step = Math.max(1, Math.ceil(mid.length / 23))
    return mid.filter((_, i) => i % step === 0).slice(0, 23)
      .map(st => `${st.longitude},${st.latitude}`).join(';')
  }, [stops])

  const routeReady = !routeId || !!route
  useEffect(() => {
    if (!fromCoord || !toCoord) return
    // Wait for the route (and its stops) so we fetch once, not Directions
    // first and Matching again when the stops arrive.
    if (!routeReady) return
    let cancelled = false
    const token = MAPBOX_TOKEN
    const ends = { from: `${fromCoord.lon},${fromCoord.lat}`, to: `${toCoord.lon},${toCoord.lat}` }
    const straight: GeoJSON.Feature = {
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: [[fromCoord.lon, fromCoord.lat], [toCoord.lon, toCoord.lat]] },
    }
    const directions = () =>
      fetch(`https://api.mapbox.com/directions/v5/mapbox/driving/${ends.from};${ends.to}?geometries=geojson&overview=full&access_token=${token}`)
        .then(r => r.json())
        .then(data => {
          const r0 = data.routes?.[0]
          return r0?.geometry ? { geometry: r0.geometry, distance: r0.distance as number } : null
        })
    // With stops: Map Matching snaps the corridor's stop sequence onto roads
    // (stop coords sit a few metres off the road, so Directions waypoints
    // force U-turns). Matching may split into several matchings when stops
    // can't be joined — stitch them; on NoMatch/error fall back to Directions.
    const matching = () => {
      const coords = [ends.from, ...waypointKey.split(';'), ends.to]
      return fetch(`https://api.mapbox.com/matching/v5/mapbox/driving/${coords.join(';')}?geometries=geojson&overview=full&tidy=true&radiuses=${coords.map(() => 60).join(';')}&access_token=${token}`)
        .then(r => r.json())
        .then(data => {
          const ms: { geometry?: GeoJSON.LineString; distance?: number }[] = data.matchings ?? []
          if (ms.length === 0) return null
          const coordinates = ms.flatMap(m => m.geometry?.coordinates ?? [])
          if (coordinates.length < 2) return null
          return {
            geometry: { type: 'LineString' as const, coordinates },
            distance: ms.reduce((sum, m) => sum + (m.distance ?? 0), 0),
          }
        })
    }

    ;(waypointKey ? matching().then(m => m ?? directions()) : directions())
      .catch(() => null)
      .then(best => {
        if (cancelled) return
        if (best) {
          setRouteLine({ type: 'Feature', properties: {}, geometry: best.geometry })
        } else {
          setRouteLine(straight)
        }
      })
    return () => { cancelled = true }
  }, [fromCoord, toCoord, waypointKey, routeReady])

  // Pre-select the alight when search matched an intermediate drop-off stop.
  const [dropoffOrder, setDropoffOrder] = useState<number | null>(
    params.dropoff_order ? parseInt(params.dropoff_order) : null,
  )
  const effectiveDropoff = dropoffOrder ?? lastOrder
  const corridorBase = reportCount > 0 ? (fareStats?.avg_reported_fare ?? baseFare) : baseFare
  // Prefetch every segment fare for the route ONCE → drop-off taps resolve instantly.
  const [segFares, setSegFares] = useState<RouteSegmentFare[]>([])
  const [segFaresLoaded, setSegFaresLoaded] = useState(false)
  useEffect(() => {
    if (!routeId) return
    let cancelled = false
    fetchRouteSegmentFares(routeId).then((rows) => { if (!cancelled) { setSegFares(rows); setSegFaresLoaded(true) } })
    return () => { cancelled = true }
  }, [routeId])
  const dropoffResult = hasStops
    ? resolveDropoffFareSync(segFares, stops[0].stop_order, effectiveDropoff, stops, corridorBase)
    : null
  // Wait for the prefetch before showing a stage fare, so the default doesn't
  // flash an interpolated "estimate" before the official segment loads.
  const dropoffFare = dropoffResult && segFaresLoaded ? dropoffResult.fare * mult : null

  // Fare actually shown / charged: drop-off stage fare when available, else corridor.
  const displayFare = (hasStops && dropoffFare != null) ? dropoffFare.toFixed(2) : headlineFare
  const stageShown = hasStops && dropoffFare != null
  const fareIsOfficial = stageShown ? !!dropoffResult?.isOfficial : corridorOfficial
  // Not exact/official (matches the "estimate" chip) → show rounded with a tilde.
  const isEstimate = !fareIsOfficial
  // The source chip that sits next to the fare (UX v2 M2).
  const fareSourceLabel = fareIsOfficial
    ? (stageShown && dropoffResult?.origin === 'station' ? tr('routes.stationChart') : tr('routes.gprtuFare'))
    : !stageShown && corridorSrc?.kind === 'riders'
      ? tr(reportCount === 1 ? 'routes.ridersSayOne' : 'routes.ridersSayMany', { n: reportCount })
      : reportCount > 0
      ? tr(reportCount === 1 ? 'routes.estimateFromOne' : 'routes.estimateFromMany', { n: reportCount })
      : tr('routes.estimateNone')
  // Okada routes carry their own fares; anything else (pragya, okada on a trotro
  // corridor) would just be the trotro fare relabelled, so show no number.
  const fareUnavailable = selectedOption.id !== 'trotro' && !(selectedOption.id === 'okada' && selectedTransport === 'okada')
  const fareText = fareUnavailable
    ? tr('routes.fareNA')
    : isEstimate
      ? `~${formatGHS(Math.round(Number(displayFare) * 10) / 10)}`
      : formatGHS(Number(displayFare))
  const dropoffName = hasStops ? stops.find((s) => s.stop_order === effectiveDropoff)?.stop_name : undefined
  const [alightPickerOpen, setAlightPickerOpen] = useState(false)
  // Intermediate stops as map dots (origin/destination have their own pins).
  // Tapping a dot calls setDropoffOrder — same handler as the alight picker.
  const stopsGeojson = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: stops.slice(1, -1)
      .filter((s) => Number.isFinite(s.latitude) && Number.isFinite(s.longitude))
      .map((s) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [s.longitude, s.latitude] },
        properties: { order: s.stop_order, name: s.stop_name, sel: s.stop_order === effectiveDropoff ? 1 : 0, major: s.is_terminal ? 1 : 0 },
      })),
  }), [stops, effectiveDropoff])
  const selectedStop = hasStops && effectiveDropoff !== lastOrder
    ? stops.find((s) => s.stop_order === effectiveDropoff && Number.isFinite(s.latitude) && Number.isFinite(s.longitude))
    : undefined
  // M9: until the segment fares load, a corridor with stops shows a skeleton, not a
  // corridor-wide estimate that would flash and then change.
  const fareLoading = hasStops && !segFaresLoaded && !fareUnavailable
  // Choosing a stop (map dot or picker) drops the sheet to half so the new fare shows.
  const chooseStop = (order: number) => {
    setDropoffOrder(order)
    if (sheetIndexRef.current !== 1) sheetRef.current?.snapToIndex(1)
  }
  const shareFare = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    const src = ` (${fareIsOfficial ? (fareSourceLabel === tr('routes.gprtuFare') ? tr('routes.officialGprtu') : fareSourceLabel) : !stageShown && corridorSrc?.kind === 'riders' ? tr('routes.reportedByRiders') : tr('routes.estimate')})`
    Share.share({
      message: tr('routes.shareFareMsg', { from, to: dropoffName || to, fare: fareText, src }),
    }).catch(() => {})
  }
  // M8: a queue report at the origin from the last 15 min earns a map callout; older is hidden.
  const [originQueueAge, setOriginQueueAge] = useState<number | null>(null)
  useEffect(() => {
    const origin = from.trim().toLowerCase()
    if (!origin) return
    let cancelled = false
    fetchQueueStatus(Date.now()).then((r) => {
      if (cancelled) return
      const match = r.stations.find((st) => {
        const n = st.stationName.toLowerCase()
        return n === origin || n.includes(origin) || origin.includes(n)
      })
      setOriginQueueAge(match && match.ageMins < 15 ? match.ageMins : null)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [from])

  // Fare per stop for the picker rows (Transit-style fare-per-option).
  const alightFareLabel = (order: number) =>
    hasStops ? formatGHS(resolveDropoffFareSync(segFares, stops[0].stop_order, order, stops, corridorBase).fare * mult) : undefined

  // The native map must not re-render on sheet moves (peek/half/full) — a prop
  // churn there dropped the route + stop layers on tap-to-peek. Memoised on the
  // data it draws; handlers only touch refs and state setters.
  const mapEl = useMemo(() => (
        <Mapbox.MapView
          style={{ flex: 1 }}
          styleURL={mapStyleURL}
          logoEnabled={false}
          attributionEnabled={false}
          compassEnabled={true}
          compassFadeWhenNorth={true}
          compassPosition={{ top: insets.top + 64, right: 16 }}
          scaleBarEnabled={false}
          pitchEnabled={false}
          onDidFinishLoadingMap={() => fitRoute(900)}
          // Tap or pan/zoom the map → drop the sheet so the map is free to explore.
          // A stop tap also reaches here; it picks the alight stop instead.
          onPress={() => { if (Date.now() - lastStopTap.current > 400) collapseSheet() }}
          onCameraChanged={(state) => { if (state.gestures?.isGestureActive) collapseSheet() }}
        >
          <Mapbox.Camera
            ref={cameraRef}
            pitch={0}
            defaultSettings={hasCoords ? {
              bounds: {
                ne: [Math.max(fromCoord!.lon, toCoord!.lon), Math.max(fromCoord!.lat, toCoord!.lat)],
                sw: [Math.min(fromCoord!.lon, toCoord!.lon), Math.min(fromCoord!.lat, toCoord!.lat)],
                paddingTop: insets.top + 120,
                paddingBottom: SCREEN_H * FIRST_SNAP + 48,
                paddingLeft: 52,
                paddingRight: 110,
              },
            } : {
              centerCoordinate: [centerLon, centerLat],
              zoomLevel: 12,
            }}
          />

          {/* 3D buildings come baked into the custom Mapbox style — adding a
              FillExtrusionLayer here referenced a "composite" source that the
              custom style doesn't have, which errored on every load. */}

          {/* Route line — high-contrast (Uber-style): soft ground shadow, near-black
              casing, brand-orange core, revealed with a draw sweep (lineTrimOffset). */}
          {routeLine && (
            <Mapbox.ShapeSource id="route-line" shape={routeLine} lineMetrics={true}>
              {/* Soft ground shadow for depth */}
              <Mapbox.LineLayer
                id="route-line-shadow"
                style={{
                  lineColor: '#000000',
                  lineWidth: 15,
                  lineCap: 'round',
                  lineJoin: 'round',
                  lineOpacity: 0.12,
                  lineBlur: 8,
                }}
              />
              {/* High-contrast casing — white pops on the dark map, classic nav look */}
              <Mapbox.LineLayer
                id="route-line-outline"
                style={{
                  lineColor: '#FFFFFF',
                  lineWidth: 11,
                  lineCap: 'round',
                  lineJoin: 'round',
                  lineOpacity: 1,
                }}
              />
              {/* Brand core */}
              <Mapbox.LineLayer
                id="route-line-core"
                style={{
                  lineColor: BRAND,
                  lineWidth: 6.5,
                  lineCap: 'round',
                  lineJoin: 'round',
                  lineOpacity: 1,
                }}
              />
            </Mapbox.ShapeSource>
          )}

          {/* Stop dots — white with brand stroke; selected alight stop is larger + filled.
              Tap a dot to set it as the alight stop (fare updates). */}
          {stopsGeojson.features.length > 0 && (
            <Mapbox.ShapeSource
              // Remount once the route line exists so the dots are added ABOVE it
              // (the line source mounts after the Directions/Matching fetch).
              key={routeLine ? 'stops-above-line' : 'stops'}
              id="route-stops"
              shape={stopsGeojson}
              hitbox={{ width: 28, height: 28 }}
              onPress={(e) => {
                const order = e.features?.[0]?.properties?.order
                if (typeof order === 'number') {
                  lastStopTap.current = Date.now()
                  Haptics.selectionAsync()
                  chooseStop(order)
                }
              }}
            >
              {/* UX v2 M6: ordinary stops only from zoom 13; the chosen stop and
                  major stations (terminals) show at every zoom. */}
              <Mapbox.CircleLayer
                id="route-stops-dot"
                aboveLayerID={routeLine ? 'route-line-core' : undefined}
                minZoomLevel={13}
                filter={STOP_MINOR_FILTER}
                style={STOP_MINOR_STYLE}
              />
              <Mapbox.CircleLayer
                id="route-stops-key"
                aboveLayerID={routeLine ? 'route-line-core' : undefined}
                filter={STOP_KEY_FILTER}
                style={STOP_KEY_STYLE}
              />
            </Mapbox.ShapeSource>
          )}

          {/* Selected alight stop label (only this one — labelling all stops is clutter) */}
          {selectedStop && (
            <Mapbox.MarkerView id="alight-label" coordinate={[selectedStop.longitude, selectedStop.latitude]} anchor={{ x: 0.5, y: 1.6 }} allowOverlap>
              <View pointerEvents="none" style={mapPinStyles.chip}><Text style={mapPinStyles.chipText} numberOfLines={1}>{selectedStop.stop_name}</Text></View>
            </Mapbox.MarkerView>
          )}

          {/* Origin ring */}
          {fromCoord && (
            <Mapbox.ShapeSource
              id="origin-pulse"
              shape={{ type: 'Feature', geometry: { type: 'Point', coordinates: [fromCoord.lon, fromCoord.lat] }, properties: {} }}
            >
              <Mapbox.CircleLayer
                id="origin-pulse-ring"
                style={{
                  circleRadius: 18,
                  circleColor: '#22c55e',
                  circleOpacity: 0.25,
                  circlePitchAlignment: 'map',
                }}
              />
            </Mapbox.ShapeSource>
          )}

          {/* Origin pin — solid start dot with a label chip */}
          {fromCoord && (
            <Mapbox.MarkerView id="origin-pin" coordinate={[fromCoord.lon, fromCoord.lat]} anchor={{ x: 0.5, y: 0.5 }} allowOverlap>
              <View style={{ alignItems: 'center' }}>
                <View style={mapPinStyles.chip}><Text style={mapPinStyles.chipText} numberOfLines={1}>{from}</Text></View>
                <View style={mapPinStyles.originDot} />
              </View>
            </Mapbox.MarkerView>
          )}

          {/* Destination pin — teardrop with a MapPin glyph, tip anchored to the point */}
          {toCoord && (
            <Mapbox.MarkerView id="dest-pin" coordinate={[toCoord.lon, toCoord.lat]} anchor={{ x: 0.5, y: 1 }} allowOverlap>
              <View style={{ alignItems: 'center' }}>
                <View style={mapPinStyles.chip}><Text style={mapPinStyles.chipText} numberOfLines={1}>{to}</Text></View>
                <View style={mapPinStyles.destPin}>
                  <MapPin size={16} color="#fff" strokeWidth={2.6} fill="#fff" />
                </View>
                <View style={mapPinStyles.destTip} />
              </View>
            </Mapbox.MarkerView>
          )}

          {/* Live trotros — crowdsourced from riders in GO Mode (1-2s fresh) */}
          {liveTrips.length > 0 && (
            <Mapbox.ShapeSource id="live-trips" shape={liveTripsGeojson}>
              <Mapbox.CircleLayer
                id="live-trip-halo"
                style={{
                  circleRadius: 15,
                  circleColor: BRAND,
                  circleOpacity: 0.22,
                  circlePitchAlignment: 'map',
                }}
              />
              <Mapbox.CircleLayer
                id="live-trip-dot"
                style={{
                  circleRadius: 8,
                  circleColor: BRAND,
                  circleStrokeWidth: 2.5,
                  circleStrokeColor: '#ffffff',
                  circlePitchAlignment: 'map',
                }}
              />
            </Mapbox.ShapeSource>
          )}
        </Mapbox.MapView>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [mapStyleURL, routeLine, stopsGeojson, selectedStop, fromCoord, toCoord, from, to, liveTripsGeojson, liveTrips.length, hasCoords, insets.top])

  return (
    <View style={{ flex: 1 }}>

      {mapEl}

      {/* ── Back (44 dp white circle) — hides when the sheet rises into it (M4) ── */}
      {!overlayHidden && (
        <View style={{ position: 'absolute', top: insets.top + 8, left: 20, zIndex: 10 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.7}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel={tr('routes.back')}
            style={mapPinStyles.mapBtn}
          >
            <ChevronLeft size={24} color="#000" />
          </TouchableOpacity>
        </View>
      )}

      {/* ── Share fare (optional, top-right) ── */}
      {!overlayHidden && selectedTransport === 'trotro' && !fareUnavailable && (
        <View style={{ position: 'absolute', top: insets.top + 8, right: 20, zIndex: 10 }}>
          <TouchableOpacity
            onPress={shareFare}
            activeOpacity={0.7}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel={tr('routes.shareFare')}
            style={mapPinStyles.mapBtn}
          >
            <ShareIcon size={19} color="#000" />
          </TouchableOpacity>
        </View>
      )}

      {/* ── Freshness callout: only a queue report under 15 min old (M8) ── */}
      {!overlayHidden && originQueueAge != null && (
        <View pointerEvents="none" style={{ position: 'absolute', top: insets.top + 64, alignSelf: 'center', zIndex: 10 }}>
          <View style={mapPinStyles.callout}>
            <Text style={mapPinStyles.calloutText}>
              {originQueueAge < 1 ? tr('routes.queueReportedNow') : tr('routes.queueReportedMin', { n: originQueueAge })}
            </Text>
          </View>
        </View>
      )}

      {/* ── Recenter FAB — sits just above the collapsed sheet; hidden once the
            sheet is dragged up so it never floats inside the card ── */}
      {hasCoords && !fabHidden && (
        <Reanimated.View style={[{ position: 'absolute', right: 20, zIndex: 10 }, fabStyle]}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => { Haptics.selectionAsync(); fitRoute(900) }}
            style={mapPinStyles.fab}
          >
            <LocateFixed size={22} color={BRAND} strokeWidth={2.3} />
          </TouchableOpacity>
        </Reanimated.View>
      )}

      {/* ── Draggable Bottom Sheet ── */}
      <BottomSheet
        ref={sheetRef}
        animatedPosition={sheetPos}
        snapPoints={snapPoints}
        index={1}
        onChange={(i) => { sheetIndexRef.current = i; setSheetIndex(i) }}
        // Swap peek/half content as soon as a snap starts, not when it ends.
        onAnimate={(_from, to) => { if (to >= 0) setSheetIndex(to) }}
        enableDynamicSizing={false}
        handleIndicatorStyle={{ backgroundColor: '#D1D5DB', width: 40, height: 4, borderRadius: 2 }}
        backgroundStyle={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24 }}
        style={{
          shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10,
        }}
      >
        <BottomSheetScrollView style={{ flex: 1 }}>

          {/* ── Sheet 1: Route info + transport picker ── */}
          {!showVehicles && (
          <>
          {sheetIndex === 0 ? (
            /* UX v2 M1: peek is exactly two lines. Tapping it brings the sheet back up. */
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={expandSheet}
              accessibilityRole="button"
              accessibilityLabel={tr('routes.peekA11y', { from, to, fare: fareLoading ? tr('routes.fareLoading') : fareText })}
              style={{ paddingHorizontal: 24, paddingBottom: 12 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Text numberOfLines={1} style={{ flex: 1, fontFamily: font.bold, fontSize: 18, color: '#0A0A0A', letterSpacing: -0.3 }}>{from} → {to}</Text>
                {fareLoading ? (
                  <View style={[mapPinStyles.skel, { width: 72, height: 20 }]} />
                ) : (
                  <Text style={{ fontFamily: font.bold, fontSize: fareUnavailable ? 13 : 18, color: '#0A0A0A', fontVariant: ['tabular-nums'] }}>{fareText}</Text>
                )}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 }}>
                <Text numberOfLines={1} style={{ flex: 1, fontFamily: font.medium, fontSize: 13, color: '#6B7280' }}>
                  {[selectedOption.label, stopCount > 0 ? tr('routes.stops', { n: stopCount }) : null, hasStops ? tr('routes.tapChooseStop') : tr('routes.tapDetails')].filter(Boolean).join(' · ')}
                </Text>
                {!fareUnavailable && !fareLoading && (
                  <View style={[mapPinStyles.srcChip, { backgroundColor: fareIsOfficial ? '#DCFCE7' : '#F3F4F6' }]}>
                    <Text style={[mapPinStyles.srcChipText, { color: fareIsOfficial ? '#15803D' : '#4B5563' }]}>{fareIsOfficial ? fareSourceLabel : tr('routes.estimate')}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ) : (
          <View style={{ paddingHorizontal: 24, marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ alignItems: 'center' }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, borderWidth: 2.5, borderColor: '#10B981', backgroundColor: '#fff' }} />
                <View style={{ width: 2, height: 16, backgroundColor: '#E5E7EB', marginVertical: 3 }} />
                <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: BRAND }} />
              </View>
              <View style={{ flex: 1, height: 44, justifyContent: 'space-between' }}>
                <Text numberOfLines={1} style={{ fontFamily: font.medium, fontSize: 14, color: '#6B7280' }}>{from}</Text>
                <Text numberOfLines={1} style={{ fontFamily: font.bold, fontSize: 18, color: '#000', letterSpacing: -0.4 }}>{to}</Text>
              </View>
            </View>
          </View>
          )}

          {/* M1: nothing below the two peek lines may half-show at the peek height. */}
          <View style={{ opacity: sheetIndex === 0 ? 0 : 1 }} pointerEvents={sheetIndex === 0 ? 'none' : 'auto'}>
          {/* Trip-shape meta: mode + stops. The GPRTU source chip lives on the fare (UX v2 M2). */}
          <View style={{ paddingHorizontal: 24, marginBottom: 14, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F3F4F6', borderRadius: 100, paddingLeft: 6, paddingRight: 12, paddingVertical: 5 }}>
              <Image source={selectedOption.image} style={{ width: 18, height: 18 }} resizeMode="contain" />
              <Text style={{ fontFamily: font.bold, fontSize: 12.5, color: '#374151' }}>{selectedOption.label}</Text>
            </View>
            {stopCount > 0 && (
              <View style={mapPinStyles.metaChip}><Text style={mapPinStyles.metaChipText}>{tr('routes.stops', { n: stopCount })}</Text></View>
            )}
          </View>

          {/* Alight picker — a single field opening a searchable stop list, so it
              scales to corridors with many drop-off points (no chip wall). */}
          {hasStops && (
            <View style={{ paddingHorizontal: 24, marginBottom: 14 }}>
              <Text style={{ fontFamily: font.bold, fontSize: 12.5, color: '#6B7280', marginBottom: 7, letterSpacing: 0.2, textTransform: 'uppercase' }}>{tr('routes.whereAlight')}</Text>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => { Haptics.selectionAsync(); setAlightPickerOpen(true) }}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F3F4F6', borderRadius: 14, paddingHorizontal: 16, height: 50 }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <MapPin size={16} color={BRAND} />
                  <Text style={{ fontFamily: font.bold, fontSize: 15, color: '#1F2937' }} numberOfLines={1}>{dropoffName}</Text>
                </View>
                <ChevronDown size={18} color="#6B7280" />
              </TouchableOpacity>
              {stopsGeojson.features.length > 0 && (
                <Text style={{ fontFamily: font.medium, fontSize: 13, color: '#6B7280', marginTop: 7 }}>{tr('routes.orTapStop')}</Text>
              )}
            </View>
          )}

          {/* Headline metrics: duration/arrival + fare/mode */}
          <View style={{ marginHorizontal: 24, marginBottom: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#F3F4F6', flexDirection: 'row', alignItems: 'flex-start' }}>
            {hasDuration && (
              <View>
                <Text style={{ fontFamily: font.extrabold, fontSize: 25, color: '#000', letterSpacing: -0.8 }}>{durationText}</Text>
                {selectedTransport === 'trotro' && (
                  <Text style={{ fontFamily: font.medium, fontSize: 13, color: '#6B7280', marginTop: 2 }}>{tr('routes.leavesWhenFull')}</Text>
                )}
              </View>
            )}
            <View style={{ marginLeft: 'auto', alignItems: 'flex-end' }}>
              {fareLoading ? (
                /* M9: skeleton until the official stage fare loads, so an estimate never flashes first */
                <View style={{ alignItems: 'flex-end', gap: 6 }} accessible accessibilityLabel={tr('routes.loadingFare')}>
                  <View style={[mapPinStyles.skel, { width: 110, height: 28 }]} />
                  <View style={[mapPinStyles.skel, { width: 150, height: 14 }]} />
                </View>
              ) : (
              <Text style={{ fontFamily: font.extrabold, fontSize: fareUnavailable ? 15 : 25, color: BRAND, letterSpacing: -0.8 }}>{fareText}</Text>
              )}
              {fareUnavailable || fareLoading ? null : (
                <>
                  {/* Before a stop is chosen the fare is to the end of the route — say so (UX v2 M5). */}
                  <Text style={{ fontFamily: font.semibold, fontSize: 13, color: '#6B7280', marginTop: 2, textAlign: 'right' }} numberOfLines={2}>
                    {dropoffName && dropoffOrder != null && dropoffOrder !== lastOrder
                      ? tr('routes.fareTo', { place: dropoffName })
                      : tr('routes.fareToEnd', { place: dropoffName || to })}
                  </Text>
                  {/* "official" names its source — a rider can check a GPRTU or station
                      chart. Only an authoritative origin earns the green chip; everything
                      else says it is an estimate and what it is based on. */}
                  {fareIsOfficial ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, backgroundColor: 'rgba(16,185,129,0.12)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 }}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' }} />
                      <Text style={{ fontFamily: font.bold, fontSize: 12, color: '#059669' }}>{fareSourceLabel}</Text>
                    </View>
                  ) : (
                    <View style={{ marginTop: 4, backgroundColor: '#F3F4F6', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 }}>
                      <Text style={{ fontFamily: font.medium, fontSize: 12, color: '#4B5563' }}>{fareSourceLabel}</Text>
                    </View>
                  )}
                  {/* GPRTU vs riders, worded like the Lines list: "Riders agree · 2h ago", or amber
                      "Riders paid GH₵X · 2h ago" when riders pay over 20% more. Corridor-level, so
                      only when the fare shown is to the end of the route. */}
                  {corridorSrc && (corridorSrc.kind === 'agree' || corridorSrc.kind === 'differ') && (!stageShown || effectiveDropoff === lastOrder) ? (
                    <Text style={{
                      fontFamily: corridorSrc.warn ? font.semibold : font.medium, fontSize: 12, marginTop: 4,
                      color: corridorSrc.warn ? FARE_WARN_COLOR : '#6B7280', opacity: corridorSrc.aged ? 0.6 : 1, textAlign: 'right',
                    }}>
                      {corridorSrc.provenance}
                    </Text>
                  ) : !stageShown && hasFareRange ? (
                    <Text style={{ fontFamily: font.medium, fontSize: 12, color: '#6B7280', marginTop: 4, opacity: corridorSrc?.aged ? 0.6 : 1 }}>
                      {tr('routes.ridersPaidRange', { range: `${formatGHS(minFare!)}–${formatGHS(maxFare!)}` })}{fareFresh ? ` · ${fareFresh}` : ''}
                    </Text>
                  ) : null}
                </>
              )}
            </View>
          </View>

          {/* Report a fare — feeds per-stage crowd data for this corridor */}
          {hasStops && (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                Haptics.selectionAsync()
                router.push({ pathname: '/report/fare', params: { route_id: routeId, from, to: dropoffName || to, transport_type: selectedTransport } } as any)
              }}
              style={{ paddingHorizontal: 24, marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 6 }}
            >
              <Text style={{ fontFamily: font.bold, fontSize: 13, color: '#374151' }}>{tr('routes.paidDifferent')}</Text>
              <ChevronRight size={15} color="#374151" />
            </TouchableOpacity>
          )}

          {/* Live availability — the moving-vehicle reassurance: who's on this
              route right now (operator vehicles + riders sharing GO Mode). */}
          {FEATURES.liveBuses && liveOnRoute > 0 && (
            <View style={{ paddingHorizontal: 24, marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', backgroundColor: 'rgba(255,77,28,0.1)', borderRadius: 100, paddingHorizontal: 14, paddingVertical: 8 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: BRAND }} />
                <Text style={{ fontFamily: font.bold, fontSize: 13, color: BRAND }}>
                  {activeCount > 0 ? tr(activeCount !== 1 ? 'routes.vehiclesMany' : 'routes.vehiclesOne', { n: activeCount }) : tr(liveRiders !== 1 ? 'routes.ridersSharingMany' : 'routes.ridersSharingOne', { n: liveRiders })}
                  {activeCount > 0 && liveRiders > 0 ? ` · ${tr(liveRiders !== 1 ? 'routes.ridersOnWayMany' : 'routes.ridersOnWayOne', { n: liveRiders })}` : ''}
                  {activeCount === 0 && liveRiders > 0 ? ` ${tr('routes.onThisRoute')}` : ''}
                </Text>
              </View>
            </View>
          )}

          {/* Two actions: Information + Go Now */}
          <View style={{ paddingHorizontal: 24, marginBottom: 18, flexDirection: 'row', gap: 12 }}>
            {/* Information opens the Available Buses sheet (Pro driver data) — FEATURES.liveBuses */}
            {FEATURES.liveBuses && (
            <TouchableOpacity
              style={{ flex: 1 }}
              activeOpacity={0.85}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
                setShowVehicles(true)
                sheetRef.current?.snapToIndex(3)
              }}
            >
              <View style={{ height: 52, borderRadius: 16, backgroundColor: '#F3F4F6', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Info size={18} color="#374151" />
                <Text style={{ fontFamily: font.bold, fontSize: 15, color: '#374151' }}>{tr('routes.information')}</Text>
              </View>
            </TouchableOpacity>
            )}
            {/* Only trotro trips can be booked. Okada/Pragya rides don't exist yet —
                Go Now would otherwise sell a trotro ticket for an okada corridor. */}
            {selectedTransport === 'trotro' && TROTRO_BOOKING_ENABLED && !RELEASE_MODE ? (
            <TouchableOpacity
                style={{ flex: 1 }}
                activeOpacity={0.85}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                  // Start the booking flow: Confirm Booking -> Pay -> Receipt -> Arrived.
                  // Carry the exact fare (drop-off aware) + duration so checkout matches.
                  router.push({ pathname: '/booking/checkout', params: { from, to: dropoffName || to, route_id: routeId, fare: displayFare, duration: String(duration) } } as any)
                }}
              >
                <View style={{ height: 52, borderRadius: 16, backgroundColor: '#000', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <Navigation size={18} color="#fff" />
                  <Text style={{ fontFamily: font.bold, fontSize: 15, color: '#fff' }}>{tr('routes.goNow')}</Text>
                </View>
              </TouchableOpacity>
            ) : selectedTransport === 'trotro' ? (
              <TouchableOpacity
                style={{ flex: 1 }}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={tr('routes.shareFare')}
                onPress={shareFare}
              >
                <View style={{ height: 52, borderRadius: 16, backgroundColor: '#000', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <ShareIcon size={18} color="#fff" />
                  <Text style={{ fontFamily: font.bold, fontSize: 15, color: '#fff' }}>{tr('routes.shareFare')}</Text>
                </View>
              </TouchableOpacity>
            ) : (
              <View
                style={{ flex: 1, height: 52, borderRadius: 16, backgroundColor: '#FFF4EF', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 }}
                accessible
                accessibilityRole="text"
                accessibilityState={{ disabled: true }}
                accessibilityLabel={tr('routes.ridesSoonA11y', { mode: selectedOption.label })}
              >
                <Text style={{ fontFamily: font.bold, fontSize: 14, color: '#C2410C', textAlign: 'center' }}>{tr('routes.ridesSoon', { mode: selectedOption.label })}</Text>
              </View>
            )}
          </View>
          {selectedTransport === 'trotro' && !TROTRO_BOOKING_ENABLED && !RELEASE_MODE && (
            <Text style={{ fontFamily: font.medium, fontSize: 13, color: '#6B7280', textAlign: 'center', marginTop: -6, marginBottom: 16 }}>
              {tr('routes.ticketsSoon')}
            </Text>
          )}

          {/* ── REAL-TIME PULSE card ── hidden when there is no traffic data
              (an "Unavailable" card with an empty bar tells the rider nothing) */}
          {(loadingTraffic || !!trafficCondition) && (
          <View style={{ paddingHorizontal: 24, marginBottom: 16 }}>
            <View style={{
              backgroundColor: '#F9FAFB', borderRadius: 20, padding: 18,
              gap: 16,
            }}>
              {/* Header — no "Live" pill: this card has no realtime channel.
                  Fake busyness ("Not busy 20%", no data source) removed (UX-06). */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontFamily: font.bold, fontSize: 13, color: '#6B7280', letterSpacing: 1.5, textTransform: 'uppercase' }}>{tr('routes.routeConditions')}</Text>
              </View>

              {/* Traffic Condition — badge pill */}
              <View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={{ fontFamily: font.medium, fontSize: 14, color: '#6B7280' }}>{tr('routes.trafficCondition')}</Text>
                  <View style={{
                    flexDirection: 'row', alignItems: 'center', gap: 6,
                    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
                    // null after load = fetch failed/no data — neutral, never green (UX-11)
                    backgroundColor: loadingTraffic || !trafficCondition ? '#F3F4F6'
                      : trafficCondition === 'light' ? 'rgba(16,185,129,0.1)'
                      : trafficCondition === 'moderate' ? 'rgba(245,158,11,0.1)'
                      : trafficCondition === 'heavy' ? 'rgba(249,115,22,0.1)'
                      : 'rgba(239,68,68,0.1)',
                  }}>
                    {!loadingTraffic && trafficCondition === 'light' && <Zap size={14} color="#059669" />}
                    {!loadingTraffic && trafficCondition === 'moderate' && <Clock size={14} color="#d97706" />}
                    {!loadingTraffic && (trafficCondition === 'heavy' || trafficCondition === 'severe') && <AlertTriangle size={14} color={trafficCondition === 'severe' ? '#dc2626' : '#ea580c'} />}
                    <Text style={{
                      fontFamily: font.bold, fontSize: 13,
                      color: loadingTraffic || !trafficCondition ? '#6B7280'
                        : trafficCondition === 'light' ? '#059669'
                        : trafficCondition === 'moderate' ? '#d97706'
                        : trafficCondition === 'heavy' ? '#ea580c' : '#dc2626',
                    }}>
                      {loadingTraffic ? tr('routes.checkingDots')
                        : !trafficCondition ? tr('routes.unavailable')
                        : trafficCondition === 'light' ? tr('routes.trafficLight')
                        : trafficCondition === 'moderate' ? tr('routes.trafficModerate')
                        : trafficCondition === 'heavy' ? tr('routes.trafficHeavy') : tr('routes.trafficSevere')}
                      {trafficDelay > 0 ? ` +${trafficDelay}m` : ''}
                    </Text>
                  </View>
                </View>

                {/* Traffic bar */}
                <View style={{ height: 10, borderRadius: 5, backgroundColor: '#E5E7EB', overflow: 'hidden' }}>
                  <View style={{
                    height: 10, borderRadius: 5,
                    width: loadingTraffic || !trafficCondition ? '0%'
                      : trafficCondition === 'light' ? '25%'
                      : trafficCondition === 'moderate' ? '55%'
                      : trafficCondition === 'heavy' ? '80%' : '95%',
                    backgroundColor: loadingTraffic || !trafficCondition ? '#D1D5DB'
                      : trafficCondition === 'light' ? '#22c55e'
                      : trafficCondition === 'moderate' ? '#F59E0B'
                      : trafficCondition === 'heavy' ? '#EF4444' : '#DC2626',
                  }} />
                </View>
              </View>
            </View>
          </View>
          )}

          </View>
          </>
          )}

          {/* ── Sheet 2: Available Buses (shows after Go Now) ── */}
          {FEATURES.liveBuses && showVehicles && (
            <View style={{ paddingHorizontal: 24, marginBottom: 16 }}>
              {/* Header + back */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <Text style={{ fontFamily: font.bold, fontSize: 20, color: '#000' }}>
                  {tr(selectedTransport === 'trotro' ? 'routes.availableBuses' : selectedTransport === 'okada' ? 'routes.availableOkada' : 'routes.availablePragya')}
                </Text>
                <TouchableOpacity onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setShowVehicles(false); setVehicleSearch(''); sheetRef.current?.snapToIndex(1) }} hitSlop={8}>
                  <Text style={{ fontFamily: font.bold, fontSize: 14, color: BRAND }}>{tr('routes.back')}</Text>
                </TouchableOpacity>
              </View>

              {/* Search bar */}
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 10,
                backgroundColor: '#F3F4F6', borderRadius: 12,
                paddingHorizontal: 14, height: 44, marginBottom: 16,
              }}>
                <Search size={18} color="#6B7280" />
                <TextInput
                  value={vehicleSearch}
                  onChangeText={setVehicleSearch}
                  placeholder={tr('routes.searchBusCode')}
                  placeholderTextColor="#6B7280"
                  style={{ flex: 1, fontFamily: font.medium, fontSize: 15, color: '#000', padding: 0 }}
                />
              </View>

              {/* Vehicle list */}
              {loadingVehicles ? (
                <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                  <ActivityIndicator size="small" color={BRAND} />
                  <Text style={{ fontFamily: font.medium, fontSize: 14, color: '#6B7280', marginTop: 8 }}>{tr('routes.findingBuses')}</Text>
                </View>
              ) : (() => {
                const filtered = vehicles.filter(v =>
                  Date.now() - new Date(v.updatedAt).getTime() < 30 * 60000 &&
                  (vehicleSearch.length === 0 || v.plateNumber.toLowerCase().includes(vehicleSearch.toLowerCase()))
                )
                return filtered.length > 0 ? (
                  filtered.map((v) => {
                    const ageMins = Math.max(0, Math.floor((Date.now() - new Date(v.updatedAt).getTime()) / 60000))
                    return (
                      <View key={v.vanId} style={{
                        padding: 16, borderRadius: 16,
                        backgroundColor: '#FFFFFF', marginBottom: 10,
                        borderWidth: 1, borderColor: '#F3F4F6',
                        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1,
                      }}>
                        {/* ETA headline + Live */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Text style={{ fontFamily: font.extrabold, fontSize: 18, color: v.isStale ? '#6B7280' : '#000', letterSpacing: -0.4 }}>
                            {v.isStale ? tr('routes.lastSeen', { n: ageMins }) : tr('routes.recentlySeen')}
                          </Text>
                          {!v.isStale && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#ECFDF5', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#22c55e' }} />
                              <Text style={{ fontFamily: font.bold, fontSize: 12, color: '#22c55e' }}>{tr('routes.recent')}</Text>
                            </View>
                          )}
                        </View>

                        {/* Friendly status */}
                        <Text style={{ fontFamily: font.medium, fontSize: 13, color: '#6B7280', marginTop: 3 }}>
                          {v.isStale ? tr('routes.offline') : v.speed && v.speed > 0 ? tr('routes.onTheWay') : tr('routes.waitingStop')}
                        </Text>

                        {/* Divider */}
                        <View style={{ height: 1, backgroundColor: '#F3F4F6', marginVertical: 12 }} />

                        {/* Plate + driver (secondary) */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <Image
                            source={TRANSPORT_OPTIONS.find(o => o.id === selectedTransport)?.image || TRANSPORT_OPTIONS[0].image}
                            style={{ width: 30, height: 30, opacity: v.isStale ? 0.4 : 1 }}
                            resizeMode="contain"
                          />
                          <Text style={{ flex: 1, fontFamily: font.bold, fontSize: 14, color: '#111' }} numberOfLines={1}>
                            {v.plateNumber}
                            {'driver' in v && (v as any).driver ? (
                              <Text style={{ fontFamily: font.regular, color: '#6B7280' }}>{`   ·   ${(v as any).driver}`}</Text>
                            ) : null}
                          </Text>
                        </View>
                      </View>
                    )
                  })
                ) : (
                  <View style={{ padding: 24, borderRadius: 16, backgroundColor: '#F9FAFB', alignItems: 'center' }}>
                    <Bus size={32} color="#D1D5DB" />
                    <Text style={{ fontFamily: font.medium, fontSize: 16, color: '#6B7280', marginTop: 10 }}>
                      {vehicleSearch ? tr('routes.noBusesMatch', { q: vehicleSearch }) : tr('routes.noBusesRoute')}
                    </Text>
                    <Text style={{ fontFamily: font.regular, fontSize: 13, color: '#D1D5DB', marginTop: 4 }}>{tr('routes.checkBack')}</Text>
                  </View>
                )
              })()}
            </View>
          )}

        </BottomSheetScrollView>
      </BottomSheet>

      {hasStops && (
        <StopPickerModal
          visible={alightPickerOpen}
          title={tr('routes.whereAlight')}
          stops={stops}
          selectedOrder={effectiveDropoff}
          minOrder={stops[0].stop_order}
          fareLabel={alightFareLabel}
          onSelect={chooseStop}
          onClose={() => setAlightPickerOpen(false)}
        />
      )}
    </View>
  )
}

const mapPinStyles = StyleSheet.create({
  // Label chip floating above each pin
  chip: {
    backgroundColor: '#fff', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
    marginBottom: 5, maxWidth: 150,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 5, elevation: 5,
  },
  chipText: { fontFamily: font.bold, fontSize: 12, color: '#0A0A0A', letterSpacing: -0.2 },
  // Origin: solid green start dot, white ring, drop shadow
  originDot: {
    width: 18, height: 18, borderRadius: 9, backgroundColor: '#22c55e',
    borderWidth: 3, borderColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 6,
  },
  // Destination: brand teardrop pin (rounded head + tip)
  destPin: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: BRAND,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5, borderColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 7,
  },
  destTip: {
    width: 0, height: 0, marginTop: -3,
    borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 9,
    borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: BRAND,
  },
  // Floating ETA · distance pill
  etaPill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#0A0A0A', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 22,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 8,
  },
  etaText: { fontFamily: font.bold, fontSize: 14, color: '#fff', letterSpacing: -0.2 },
  etaDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#6B7280' },
  etaSub: { fontFamily: font.semibold, fontSize: 14, color: '#D1D5DB', letterSpacing: -0.2 },
  // Header meta chips (distance / stops)
  metaChip: { backgroundColor: '#F3F4F6', borderRadius: 100, paddingHorizontal: 12, paddingVertical: 6 },
  metaChipText: { fontFamily: font.bold, fontSize: 12.5, color: '#374151' },
  // 44 dp white map buttons (back / share)
  mapBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 6,
  },
  // Black freshness callout (M8)
  callout: {
    backgroundColor: '#0A0A0A', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 6,
  },
  calloutText: { fontFamily: font.bold, fontSize: 13, color: '#fff' },
  // Fare source chip in the peek (M1/M2)
  srcChip: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  srcChipText: { fontFamily: font.bold, fontSize: 12 },
  skel: { backgroundColor: '#EEEEEE', borderRadius: 6 },
  // Recenter FAB
  fab: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.18, shadowRadius: 8, elevation: 7,
  },
})
