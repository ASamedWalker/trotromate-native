import { useState, useEffect, useRef, useMemo } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Animated as RNAnimated,
  Easing,
  LayoutAnimation,
  Platform,
  UIManager,
  Dimensions,
  StyleSheet,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { X, Clock, Navigation, Zap, AlertTriangle, Bus, Users, Search, BellRing, Info, ChevronRight, ChevronDown, MapPin, LocateFixed } from 'lucide-react-native'
import StopPickerModal from '@/components/StopPickerModal'
import { font } from '@/lib/theme'

const { height: SCREEN_H } = Dimensions.get('window')
// Branded Mapbox Studio style (shared with TrackingMap); stock night variant
// after dark so the route view matches premium nav apps (Uber/Bolt) at night.
const MAP_STYLE_DAY = 'mapbox://styles/sampy1/cmnhofbx0005q01s84a9vbm31'
const MAP_STYLE_NIGHT = 'mapbox://styles/mapbox/navigation-night-v1'
import * as Haptics from 'expo-haptics'
import { FALLBACK_STATION_COORDS } from '@/lib/utils/station-coords'
import { fetchRouteTraffic } from '@/lib/services/traffic-api'
import { useVehiclePositions } from '@/lib/hooks/useVehiclePositions'
import { useLiveTripPositions } from '@/lib/hooks/useLiveTripPositions'
import { useRouteDetail } from '@/lib/hooks/useRoutes'
import { fetchRouteSegmentFares, resolveDropoffFareSync, type RouteSegmentFare } from '@/lib/services/segment-fares'
import Mapbox from '@rnmapbox/maps'
import BottomSheet, { BottomSheetView, BottomSheetScrollView } from '@gorhom/bottom-sheet'

const BRAND = '#FF4D1C'

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
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return d < 7 ? `${d}d ago` : `${Math.floor(d / 7)}w ago`
}

/* ── Transport options ── */

const TRANSPORT_OPTIONS = [
  { id: 'trotro', label: 'Trotro', image: require('@/assets/images/home/bus_icon_bg_removed.png'), fareMultiplier: 1 },
  { id: 'okada', label: 'Okada', image: require('@/assets/images/home/okada_icon_bg_removed.png'), fareMultiplier: 1.3 },
  { id: 'pragya', label: 'Pragya', image: require('@/assets/images/home/Pragya_icon_bg_removed.png'), fareMultiplier: 1.5 },
]

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

export default function RouteDetailScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const sheetRef = useRef<BottomSheet>(null)
  const cameraRef = useRef<Mapbox.Camera>(null)

  const params = useLocalSearchParams<{
    from: string; to: string; fare: string; duration: string
    transport_type: string; route_id: string; type: string; dropoff_order?: string
  }>()

  const from = params.from || ''
  const to = params.to || ''
  const baseFare = params.fare ? parseFloat(params.fare) : 0
  const duration = params.duration ? parseInt(params.duration) : 0
  const routeId = params.route_id || ''
  const routeType = params.type || 'direct'

  // Transport mode is chosen on the Plan a Trip screen and passed in via params —
  // no longer selectable here.
  const selectedTransport = params.transport_type || 'trotro'
  const selectedOption = TRANSPORT_OPTIONS.find(o => o.id === selectedTransport) || TRANSPORT_OPTIONS[0]
  const [trafficCondition, setTrafficCondition] = useState<string | null>(null)
  const [trafficDelay, setTrafficDelay] = useState(0)
  const [loadingTraffic, setLoadingTraffic] = useState(true)
  const [showVehicles, setShowVehicles] = useState(false)
  const [vehicleSearch, setVehicleSearch] = useState('')
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null)
  const [notifyEnabled, setNotifyEnabled] = useState(false)
  const [sheetIndex, setSheetIndex] = useState(0)
  // Real road distance from the Directions response — feeds the floating ETA pill.
  const [routeDistanceKm, setRouteDistanceKm] = useState<number | null>(null)
  // Animated route "draw" sweep: line-trim-offset end goes 1 (hidden) -> 0 (full).
  const drawAnim = useRef(new RNAnimated.Value(1)).current
  const [trimEnd, setTrimEnd] = useState(1)
  // Day/night map style (Ghana local hours): branded by day, stock nav-night after dark.
  const isNight = useMemo(() => { const h = new Date().getHours(); return h < 6 || h >= 18 }, [])
  const mapStyleURL = isNight ? MAP_STYLE_NIGHT : MAP_STYLE_DAY

  // Live vehicles on this route — fallback to mock if none
  const { vehicles: liveVehicles, activeCount, loading: loadingVehicles } = useVehiclePositions(routeId || undefined)

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

  const MOCK_VEHICLES: Record<string, { vanId: string; plateNumber: string; routeLabel: string; speed: number; driver: string }[]> = {
    trotro: [
      { vanId: 'm1', plateNumber: 'GR-4582-24', routeLabel: `${from} → ${to}`, speed: 32, driver: 'Kwame Asante' },
      { vanId: 'm2', plateNumber: 'GN-1190-23', routeLabel: `${from} → ${to}`, speed: 0, driver: 'Yaw Mensah' },
      { vanId: 'm3', plateNumber: 'GT-7823-24', routeLabel: `${from} → ${to}`, speed: 45, driver: 'Kofi Boateng' },
    ],
    okada: [
      { vanId: 'm4', plateNumber: 'M-2891-24', routeLabel: `${from} → ${to}`, speed: 28, driver: 'Abass Ibrahim' },
      { vanId: 'm5', plateNumber: 'M-0456-23', routeLabel: `${from} → ${to}`, speed: 35, driver: 'Issah Mohammed' },
    ],
    pragya: [
      { vanId: 'm6', plateNumber: 'P-1122-24', routeLabel: `${from} → ${to}`, speed: 18, driver: 'Emmanuel Tetteh' },
      { vanId: 'm7', plateNumber: 'P-3344-23', routeLabel: `${from} → ${to}`, speed: 22, driver: 'Samuel Adjei' },
    ],
  }

  const vehicles = liveVehicles.length > 0
    ? liveVehicles
    : (MOCK_VEHICLES[selectedTransport] || []).map(m => ({
        ...m, routeId: routeId, latitude: 0, longitude: 0, heading: null,
        updatedAt: new Date().toISOString(), isStale: false,
      }))

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

  // Pulsing origin marker
  const pulseAnim = useRef(new RNAnimated.Value(0)).current
  const [pulseRadius, setPulseRadius] = useState(14)
  const [pulseOpacity, setPulseOpacity] = useState(0.4)

  // Fit the whole corridor with a pitched, cinematic framing — leaves room for
  // the bottom sheet (paddingBottom) and tilts the camera like premium nav apps.
  const fitRoute = (duration = 1500) => {
    if (!hasCoords || !cameraRef.current) return
    // [top, right, bottom, left] — generous bottom leaves room for the sheet.
    cameraRef.current.fitBounds(
      [Math.max(fromCoord!.lon, toCoord!.lon), Math.max(fromCoord!.lat, toCoord!.lat)],
      [Math.min(fromCoord!.lon, toCoord!.lon), Math.min(fromCoord!.lat, toCoord!.lat)],
      [insets.top + 96, 52, SCREEN_H * 0.44, 52],
      duration,
    )
  }

  // Framing is handled by the Camera's defaultSettings.bounds (correct on first
  // paint) + onDidFinishLoadingMap → fitRoute, which avoids the cold-mount race
  // where cameraRef is still null inside a setTimeout.

  // Route line — fetch road-following geometry from Mapbox Directions API
  const [routeLine, setRouteLine] = useState<GeoJSON.Feature | null>(null)

  // Pulse animation loop
  useEffect(() => {
    const loop = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(pulseAnim, { toValue: 1, duration: 1200, easing: Easing.out(Easing.ease), useNativeDriver: false }),
        RNAnimated.timing(pulseAnim, { toValue: 0, duration: 1200, easing: Easing.in(Easing.ease), useNativeDriver: false }),
      ])
    )
    loop.start()

    const listener = pulseAnim.addListener(({ value }) => {
      setPulseRadius(14 + value * 10)
      setPulseOpacity(0.4 - value * 0.35)
    })
    return () => { loop.stop(); pulseAnim.removeListener(listener) }
  }, [])

  // Animated route "draw" — reveal the polyline from origin once geometry loads.
  useEffect(() => {
    if (!routeLine) return
    drawAnim.setValue(1)
    const id = drawAnim.addListener(({ value }) => setTrimEnd(value))
    RNAnimated.timing(drawAnim, {
      toValue: 0, duration: 1400, easing: Easing.inOut(Easing.cubic), useNativeDriver: false,
    }).start()
    return () => drawAnim.removeListener(id)
  }, [routeLine])

  useEffect(() => {
    if (!fromCoord || !toCoord) return
    const token = 'pk.eyJ1Ijoic2FtcHkxIiwiYSI6ImNranl2NHNjdTAxZzQzMWxldmx5dGhkaDEifQ.1eOzL1554nbXGIPai5Kmlg'
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${fromCoord.lon},${fromCoord.lat};${toCoord.lon},${toCoord.lat}?geometries=geojson&overview=full&access_token=${token}`

    fetch(url)
      .then(r => r.json())
      .then(data => {
        if (data.routes?.[0]?.distance != null) setRouteDistanceKm(data.routes[0].distance / 1000)
        if (data.routes?.[0]?.geometry) {
          setRouteLine({
            type: 'Feature',
            properties: {},
            geometry: data.routes[0].geometry,
          })
        } else {
          // Fallback: straight line
          setRouteLine({
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: [[fromCoord.lon, fromCoord.lat], [toCoord.lon, toCoord.lat]],
            },
          })
        }
      })
      .catch(() => {
        setRouteLine({
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: [[fromCoord.lon, fromCoord.lat], [toCoord.lon, toCoord.lat]],
          },
        })
      })
  }, [fromCoord, toCoord])

  const snapPoints = useMemo(() => ['38%', '64%', '88%'], [])


  // Mock stops for timeline — will be replaced by route_stops from DB
  const mockStops = useMemo(() => [
    { name: from, letter: from.charAt(0).toUpperCase(), minsAgo: 30, etaMin: null as number | null, passed: true, isCurrent: false, isFinal: false },
    { name: 'Nkrumah Ave', letter: 'N', minsAgo: 20, etaMin: null as number | null, passed: true, isCurrent: false, isFinal: false },
    { name: 'Kwame Rd', letter: 'K', minsAgo: 15, etaMin: null as number | null, passed: true, isCurrent: false, isFinal: false },
    { name: 'Station Junction', letter: 'S', minsAgo: 10, etaMin: null as number | null, passed: true, isCurrent: false, isFinal: false },
    { name: 'Market Square', letter: 'M', minsAgo: null as number | null, etaMin: null as number | null, passed: false, isCurrent: true, isFinal: false },
    { name: 'Ring Road', letter: 'R', minsAgo: null as number | null, etaMin: 4 as number | null, passed: false, isCurrent: false, isFinal: false },
    { name: to, letter: to.charAt(0).toUpperCase(), minsAgo: null as number | null, etaMin: 9 as number | null, passed: false, isCurrent: false, isFinal: true },
  ], [from, to])

  const currentStopName = mockStops.find(s => s.isCurrent)?.name ?? ''
  const destEta = mockStops[mockStops.length - 1].etaMin ?? 0

  const durationText = duration >= 60
    ? `${Math.floor(duration / 60)}hr ${duration % 60}min`
    : `${duration} min`
  const arrivalTime = new Date(Date.now() + duration * 60000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  const selectedFare = (baseFare * selectedOption.fareMultiplier).toFixed(2)

  // ── Crowdsourced fare: show an honest avg + range, not a single "fixed" price.
  // Trotro fares vary, so a range + report count + freshness is the trust signal.
  const mult = selectedOption.fareMultiplier
  const fareStats = route?.fare_stats
  const avgFare = (fareStats?.avg_reported_fare ?? route?.official_fare ?? baseFare) * mult
  const minFare = fareStats?.min_reported_fare != null ? fareStats.min_reported_fare * mult : null
  const maxFare = fareStats?.max_reported_fare != null ? fareStats.max_reported_fare * mult : null
  const reportCount = fareStats?.report_count ?? 0
  const hasFareRange = reportCount > 0 && minFare != null && maxFare != null && maxFare - minFare > 0.01
  const fareFresh = fareStats?.last_report_at ? timeAgo(fareStats.last_report_at) : null
  const gprtuVerified = !!route?.is_gprtu_verified
  const headlineFare = (reportCount > 0 ? avgFare : baseFare * mult).toFixed(2)

  // Trip shape for the header meta row
  const stopCount = route?.stops?.length ?? 0
  const distanceKm = routeDistanceKm ?? route?.distance_km ?? null

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
  const dropoffName = hasStops ? stops.find((s) => s.stop_order === effectiveDropoff)?.stop_name : undefined
  const [alightPickerOpen, setAlightPickerOpen] = useState(false)
  // Fare per stop for the picker rows (Transit-style fare-per-option).
  const alightFareLabel = (order: number) =>
    hasStops ? `₵${(resolveDropoffFareSync(segFares, stops[0].stop_order, order, stops, corridorBase).fare * mult).toFixed(2)}` : undefined

  return (
    <View style={{ flex: 1 }}>

      {/* ── Full screen map ── */}
      <Mapbox.MapView
        style={{ flex: 1 }}
        styleURL={mapStyleURL}
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled={true}
        compassFadeWhenNorth={true}
        compassPosition={{ top: insets.top + 64, right: 16 }}
        scaleBarEnabled={false}
        onDidFinishLoadingMap={() => fitRoute(900)}
      >
        <Mapbox.Camera
          ref={cameraRef}
          defaultSettings={hasCoords ? {
            bounds: {
              ne: [Math.max(fromCoord!.lon, toCoord!.lon), Math.max(fromCoord!.lat, toCoord!.lat)],
              sw: [Math.min(fromCoord!.lon, toCoord!.lon), Math.min(fromCoord!.lat, toCoord!.lat)],
              paddingTop: insets.top + 96,
              paddingBottom: SCREEN_H * 0.44,
              paddingLeft: 52,
              paddingRight: 52,
            },
          } : {
            centerCoordinate: [centerLon, centerLat],
            zoomLevel: 12,
          }}
        />

        {/* 3D buildings come baked into the custom Mapbox style — adding a
            FillExtrusionLayer here referenced a "composite" source that the
            custom style doesn't have, which errored on every load. */}

        {/* Traffic layer overlay */}
        <Mapbox.RasterSource
          id="traffic-source"
          tileUrlTemplates={['https://api.mapbox.com/v4/mapbox.mapbox-traffic-v1/{z}/{x}/{y}.png?access_token=pk.eyJ1Ijoic2FtcHkxIiwiYSI6ImNranl2NHNjdTAxZzQzMWxldmx5dGhkaDEifQ.1eOzL1554nbXGIPai5Kmlg']}
          tileSize={256}
        >
          <Mapbox.RasterLayer
            id="traffic-layer"
            style={{ rasterOpacity: 0.35 }}
          />
        </Mapbox.RasterSource>

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
                lineTrimOffset: [0, trimEnd],
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
                lineTrimOffset: [0, trimEnd],
              }}
            />
          </Mapbox.ShapeSource>
        )}

        {/* Pulsing origin marker */}
        {fromCoord && (
          <Mapbox.ShapeSource
            id="origin-pulse"
            shape={{ type: 'Feature', geometry: { type: 'Point', coordinates: [fromCoord.lon, fromCoord.lat] }, properties: {} }}
          >
            <Mapbox.CircleLayer
              id="origin-pulse-ring"
              style={{
                circleRadius: pulseRadius,
                circleColor: '#22c55e',
                circleOpacity: pulseOpacity,
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

      {/* ── Close button ── */}
      <View style={{ position: 'absolute', top: insets.top + 8, left: 20, zIndex: 10 }}>
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.7}
          style={{
            width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff',
            justifyContent: 'center', alignItems: 'center',
            shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 6,
          }}
        >
          <X size={22} color="#000" />
        </TouchableOpacity>
      </View>

      {/* ── Floating ETA · distance pill (glanceable trip summary) ── */}
      {hasCoords && (
        <View style={{ position: 'absolute', top: insets.top + 10, alignSelf: 'center', zIndex: 10 }}>
          <View style={mapPinStyles.etaPill}>
            <Clock size={15} color="#fff" strokeWidth={2.4} />
            <Text style={mapPinStyles.etaText}>{durationText}</Text>
            {routeDistanceKm != null && (
              <>
                <View style={mapPinStyles.etaDot} />
                <Text style={mapPinStyles.etaSub}>{routeDistanceKm.toFixed(1)} km</Text>
              </>
            )}
          </View>
        </View>
      )}

      {/* ── Recenter FAB — sits just above the collapsed sheet; hidden once the
            sheet is dragged up so it never floats inside the card ── */}
      {hasCoords && sheetIndex <= 0 && (
        <View style={{ position: 'absolute', right: 20, bottom: SCREEN_H * 0.38 + 16, zIndex: 10 }}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => { Haptics.selectionAsync(); fitRoute(900) }}
            style={mapPinStyles.fab}
          >
            <LocateFixed size={22} color={BRAND} strokeWidth={2.3} />
          </TouchableOpacity>
        </View>
      )}

      {/* ── Draggable Bottom Sheet ── */}
      <BottomSheet
        ref={sheetRef}
        index={0}
        onChange={setSheetIndex}
        snapPoints={snapPoints}
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
          {/* Route timeline: origin → destination */}
          <View style={{ paddingHorizontal: 24, marginBottom: 18 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ alignItems: 'center' }}>
                <View style={{ width: 11, height: 11, borderRadius: 6, borderWidth: 2.5, borderColor: '#10B981', backgroundColor: '#fff' }} />
                <View style={{ width: 2, height: 18, backgroundColor: '#E5E7EB', marginVertical: 3 }} />
                <View style={{ width: 11, height: 11, borderRadius: 3, backgroundColor: BRAND }} />
              </View>
              <View style={{ flex: 1, height: 50, justifyContent: 'space-between' }}>
                <Text numberOfLines={1} style={{ fontFamily: font.medium, fontSize: 15, color: '#6B7280' }}>{from}</Text>
                <Text numberOfLines={1} style={{ fontFamily: font.bold, fontSize: 19, color: '#000', letterSpacing: -0.4 }}>{to}</Text>
              </View>
            </View>
          </View>

          {/* Trip-shape meta: mode + distance + stops + GPRTU trust badge */}
          <View style={{ paddingHorizontal: 24, marginBottom: 16, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F3F4F6', borderRadius: 100, paddingLeft: 6, paddingRight: 12, paddingVertical: 5 }}>
              <Image source={selectedOption.image} style={{ width: 18, height: 18 }} resizeMode="contain" />
              <Text style={{ fontFamily: font.bold, fontSize: 12.5, color: '#374151' }}>{selectedOption.label}</Text>
            </View>
            {distanceKm != null && (
              <View style={mapPinStyles.metaChip}><Text style={mapPinStyles.metaChipText}>{distanceKm.toFixed(1)} km</Text></View>
            )}
            {stopCount > 0 && (
              <View style={mapPinStyles.metaChip}><Text style={mapPinStyles.metaChipText}>{stopCount} stops</Text></View>
            )}
            {gprtuVerified && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(16,185,129,0.12)', borderRadius: 100, paddingHorizontal: 11, paddingVertical: 5 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' }} />
                <Text style={{ fontFamily: font.bold, fontSize: 12, color: '#059669' }}>GPRTU</Text>
              </View>
            )}
          </View>

          {/* Alight picker — a single field opening a searchable stop list, so it
              scales to corridors with many drop-off points (no chip wall). */}
          {hasStops && (
            <View style={{ paddingHorizontal: 24, marginBottom: 16 }}>
              <Text style={{ fontFamily: font.bold, fontSize: 13, color: '#374151', marginBottom: 8 }}>Where will you alight?</Text>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => { Haptics.selectionAsync(); setAlightPickerOpen(true) }}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F3F4F6', borderRadius: 14, paddingHorizontal: 16, height: 52 }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <MapPin size={16} color={BRAND} />
                  <Text style={{ fontFamily: font.bold, fontSize: 15, color: '#1F2937' }} numberOfLines={1}>{dropoffName}</Text>
                </View>
                <ChevronDown size={18} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
          )}

          {/* Headline metrics: duration/arrival + fare/mode */}
          <View style={{ paddingHorizontal: 24, marginBottom: 18, flexDirection: 'row', alignItems: 'flex-end' }}>
            <View>
              <Text style={{ fontFamily: font.extrabold, fontSize: 28, color: '#000', letterSpacing: -1 }}>{durationText}</Text>
              <Text style={{ fontFamily: font.medium, fontSize: 13, color: '#9CA3AF', marginTop: 2 }}>arrives {arrivalTime}</Text>
            </View>
            <View style={{ marginLeft: 'auto', alignItems: 'flex-end' }}>
              <Text style={{ fontFamily: font.extrabold, fontSize: 28, color: BRAND, letterSpacing: -1 }}>₵{displayFare}</Text>
              {dropoffName ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <Text style={{ fontFamily: font.semibold, fontSize: 13, color: '#6B7280' }}>to {dropoffName}</Text>
                  {dropoffResult?.isOfficial ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(16,185,129,0.12)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 }}>
                      <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#10B981' }} />
                      <Text style={{ fontFamily: font.bold, fontSize: 10.5, color: '#059669' }}>official</Text>
                    </View>
                  ) : (
                    <View style={{ backgroundColor: '#F3F4F6', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 }}>
                      <Text style={{ fontFamily: font.medium, fontSize: 10.5, color: '#9CA3AF' }}>estimate</Text>
                    </View>
                  )}
                </View>
              ) : hasFareRange ? (
                <Text style={{ fontFamily: font.semibold, fontSize: 13, color: '#6B7280', marginTop: 2 }}>
                  ₵{minFare!.toFixed(0)}–{maxFare!.toFixed(0)} · {selectedOption.label}
                </Text>
              ) : (
                <Text style={{ fontFamily: font.medium, fontSize: 13, color: '#9CA3AF', marginTop: 2 }}>{selectedOption.label} fare</Text>
              )}
              {reportCount > 0 && (
                <Text style={{ fontFamily: font.medium, fontSize: 11.5, color: '#B0B4BB', marginTop: 1 }}>
                  {reportCount} report{reportCount !== 1 ? 's' : ''}{fareFresh ? ` · ${fareFresh}` : ''}
                </Text>
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
              <Text style={{ fontFamily: font.bold, fontSize: 13, color: BRAND }}>Paid a different fare? Report it</Text>
              <ChevronRight size={15} color={BRAND} />
            </TouchableOpacity>
          )}

          {/* Live availability — the moving-vehicle reassurance: who's on this
              route right now (operator vehicles + riders sharing GO Mode). */}
          {liveOnRoute > 0 && (
            <View style={{ paddingHorizontal: 24, marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', backgroundColor: 'rgba(255,77,28,0.1)', borderRadius: 100, paddingHorizontal: 14, paddingVertical: 8 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: BRAND }} />
                <Text style={{ fontFamily: font.bold, fontSize: 13, color: BRAND }}>
                  {activeCount > 0 ? `${activeCount} ${selectedOption.label.toLowerCase()}${activeCount !== 1 ? 's' : ''} live` : `${liveRiders} live`}
                  {activeCount > 0 && liveRiders > 0 ? ` · ${liveRiders} rider${liveRiders !== 1 ? 's' : ''} en route` : ''}
                  {activeCount === 0 && liveRiders > 0 ? ' on this route' : ''}
                </Text>
              </View>
            </View>
          )}

          {/* Two actions: Information + Go Now */}
          <View style={{ paddingHorizontal: 24, marginBottom: 18, flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity
              style={{ flex: 1 }}
              activeOpacity={0.85}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
                setShowVehicles(true)
                sheetRef.current?.snapToIndex(2)
              }}
            >
              <View style={{ height: 52, borderRadius: 16, backgroundColor: '#F3F4F6', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Info size={18} color="#374151" />
                <Text style={{ fontFamily: font.bold, fontSize: 15, color: '#374151' }}>Information</Text>
              </View>
            </TouchableOpacity>
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
                <Text style={{ fontFamily: font.bold, fontSize: 15, color: '#fff' }}>Go Now</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* ── REAL-TIME PULSE card ── */}
          <View style={{ paddingHorizontal: 24, marginBottom: 16 }}>
            <View style={{
              backgroundColor: '#F9FAFB', borderRadius: 20, padding: 18,
              gap: 16,
            }}>
              {/* Header */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontFamily: font.bold, fontSize: 11, color: '#6B7280', letterSpacing: 3, textTransform: 'uppercase' }}>Real-Time Pulse</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#22c55e' }} />
                  <Text style={{ fontFamily: font.bold, fontSize: 11, color: '#22c55e' }}>Live</Text>
                </View>
              </View>

              {/* Station Busyness — Users icon + label + bar graph */}
              <View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={{ fontFamily: font.medium, fontSize: 14, color: '#6B7280' }}>Station Busyness</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Users size={16} color="#059669" />
                    <Text style={{ fontFamily: font.medium, fontSize: 13, color: '#059669' }}>Not busy</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
                      {[1, 2, 3, 4].map((bar) => (
                        <View key={bar} style={{
                          width: 6, height: 8 + bar * 3, borderRadius: 3,
                          backgroundColor: bar <= 1 ? '#10b981' : '#E5E7EB',
                        }} />
                      ))}
                    </View>
                  </View>
                </View>

                {/* Busyness bar */}
                <View style={{ height: 10, borderRadius: 5, backgroundColor: '#E5E7EB', overflow: 'hidden' }}>
                  <View style={{ height: 10, borderRadius: 5, width: '20%', backgroundColor: '#22c55e' }} />
                </View>
              </View>

              {/* Traffic Condition — badge pill */}
              <View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={{ fontFamily: font.medium, fontSize: 14, color: '#6B7280' }}>Traffic Condition</Text>
                  <View style={{
                    flexDirection: 'row', alignItems: 'center', gap: 6,
                    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
                    backgroundColor: loadingTraffic ? '#F3F4F6'
                      : !trafficCondition || trafficCondition === 'light' ? 'rgba(16,185,129,0.1)'
                      : trafficCondition === 'moderate' ? 'rgba(245,158,11,0.1)'
                      : trafficCondition === 'heavy' ? 'rgba(249,115,22,0.1)'
                      : 'rgba(239,68,68,0.1)',
                  }}>
                    {!loadingTraffic && (!trafficCondition || trafficCondition === 'light') && <Zap size={14} color="#059669" />}
                    {!loadingTraffic && trafficCondition === 'moderate' && <Clock size={14} color="#d97706" />}
                    {!loadingTraffic && (trafficCondition === 'heavy' || trafficCondition === 'severe') && <AlertTriangle size={14} color={trafficCondition === 'severe' ? '#dc2626' : '#ea580c'} />}
                    <Text style={{
                      fontFamily: font.bold, fontSize: 13,
                      color: loadingTraffic ? '#9CA3AF'
                        : !trafficCondition || trafficCondition === 'light' ? '#059669'
                        : trafficCondition === 'moderate' ? '#d97706'
                        : trafficCondition === 'heavy' ? '#ea580c' : '#dc2626',
                    }}>
                      {loadingTraffic ? 'Checking...'
                        : !trafficCondition || trafficCondition === 'light' ? 'Light'
                        : trafficCondition === 'moderate' ? 'Moderate'
                        : trafficCondition === 'heavy' ? 'Heavy' : 'Severe'}
                      {trafficDelay > 0 ? ` +${trafficDelay}m` : ''}
                    </Text>
                  </View>
                </View>

                {/* Traffic bar */}
                <View style={{ height: 10, borderRadius: 5, backgroundColor: '#E5E7EB', overflow: 'hidden' }}>
                  <View style={{
                    height: 10, borderRadius: 5,
                    width: loadingTraffic ? '30%'
                      : !trafficCondition || trafficCondition === 'light' ? '25%'
                      : trafficCondition === 'moderate' ? '55%'
                      : trafficCondition === 'heavy' ? '80%' : '95%',
                    backgroundColor: loadingTraffic ? '#D1D5DB'
                      : !trafficCondition || trafficCondition === 'light' ? '#22c55e'
                      : trafficCondition === 'moderate' ? '#F59E0B'
                      : trafficCondition === 'heavy' ? '#EF4444' : '#DC2626',
                  }} />
                </View>
              </View>

              {/* Timestamp */}
              <Text style={{ fontFamily: font.medium, fontSize: 12, color: '#9CA3AF' }}>
                {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
              </Text>
            </View>
          </View>

          </>
          )}

          {/* ── Sheet 2: Available Buses (shows after Go Now) ── */}
          {showVehicles && !selectedVehicle && (
            <View style={{ paddingHorizontal: 24, marginBottom: 16 }}>
              {/* Header + back */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <Text style={{ fontFamily: font.bold, fontSize: 20, color: '#000' }}>
                  Available {selectedTransport === 'trotro' ? 'Buses' : selectedTransport === 'okada' ? 'Okada' : 'Pragya'}
                </Text>
                <TouchableOpacity onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setShowVehicles(false); setVehicleSearch(''); sheetRef.current?.snapToIndex(0) }} hitSlop={8}>
                  <Text style={{ fontFamily: font.bold, fontSize: 14, color: BRAND }}>Back</Text>
                </TouchableOpacity>
              </View>

              {/* Search bar */}
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 10,
                backgroundColor: '#F3F4F6', borderRadius: 12,
                paddingHorizontal: 14, height: 44, marginBottom: 16,
              }}>
                <Search size={18} color="#9CA3AF" />
                <TextInput
                  value={vehicleSearch}
                  onChangeText={setVehicleSearch}
                  placeholder="Search by bus code..."
                  placeholderTextColor="#9CA3AF"
                  style={{ flex: 1, fontFamily: font.medium, fontSize: 15, color: '#000', padding: 0 }}
                />
              </View>

              {/* Vehicle list */}
              {loadingVehicles ? (
                <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                  <ActivityIndicator size="small" color={BRAND} />
                  <Text style={{ fontFamily: font.medium, fontSize: 14, color: '#9CA3AF', marginTop: 8 }}>Finding buses on route...</Text>
                </View>
              ) : (() => {
                const filtered = vehicles.filter(v =>
                  vehicleSearch.length === 0 || v.plateNumber.toLowerCase().includes(vehicleSearch.toLowerCase())
                )
                return filtered.length > 0 ? (
                  filtered.map((v) => {
                    const etaMins = v.speed && v.speed > 0 ? Math.max(2, Math.round(15 - v.speed * 0.2)) : null
                    return (
                      <TouchableOpacity key={v.vanId} activeOpacity={0.7} onPress={() => {
                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
                        setSelectedVehicle(v)
                      }} style={{
                        padding: 16, borderRadius: 16,
                        backgroundColor: '#FFFFFF', marginBottom: 10,
                        borderWidth: 1, borderColor: '#F3F4F6',
                        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1,
                      }}>
                        {/* ETA headline + Live */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Text style={{ fontFamily: font.extrabold, fontSize: 18, color: v.isStale ? '#9CA3AF' : '#000', letterSpacing: -0.4 }}>
                            {v.isStale ? 'Offline' : etaMins != null ? (etaMins <= 2 ? 'Arriving now' : `Arriving in ${etaMins} min`) : 'At a stop'}
                          </Text>
                          {!v.isStale && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#ECFDF5', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#22c55e' }} />
                              <Text style={{ fontFamily: font.bold, fontSize: 12, color: '#22c55e' }}>Live</Text>
                            </View>
                          )}
                        </View>

                        {/* Friendly status */}
                        <Text style={{ fontFamily: font.medium, fontSize: 13, color: '#9CA3AF', marginTop: 3 }}>
                          {v.isStale ? 'Last seen a moment ago' : v.speed && v.speed > 0 ? 'On the way' : 'Waiting at a stop'}
                        </Text>

                        {/* Divider */}
                        <View style={{ height: 1, backgroundColor: '#F3F4F6', marginVertical: 12 }} />

                        {/* Plate + driver (secondary) — tap opens the bus timeline */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <Image
                            source={TRANSPORT_OPTIONS.find(o => o.id === selectedTransport)?.image || TRANSPORT_OPTIONS[0].image}
                            style={{ width: 30, height: 30, opacity: v.isStale ? 0.4 : 1 }}
                            resizeMode="contain"
                          />
                          <Text style={{ flex: 1, fontFamily: font.bold, fontSize: 14, color: '#111' }} numberOfLines={1}>
                            {v.plateNumber}
                            {'driver' in v && (v as any).driver ? (
                              <Text style={{ fontFamily: font.regular, color: '#9CA3AF' }}>{`   ·   ${(v as any).driver}`}</Text>
                            ) : null}
                          </Text>
                          <ChevronRight size={18} color="#D1D5DB" />
                        </View>
                      </TouchableOpacity>
                    )
                  })
                ) : (
                  <View style={{ padding: 24, borderRadius: 16, backgroundColor: '#F9FAFB', alignItems: 'center' }}>
                    <Bus size={32} color="#D1D5DB" />
                    <Text style={{ fontFamily: font.medium, fontSize: 16, color: '#9CA3AF', marginTop: 10 }}>
                      {vehicleSearch ? `No buses matching "${vehicleSearch}"` : 'No buses currently on this route'}
                    </Text>
                    <Text style={{ fontFamily: font.regular, fontSize: 13, color: '#D1D5DB', marginTop: 4 }}>Check back shortly</Text>
                  </View>
                )
              })()}
            </View>
          )}

          {/* ── Sheet 3: Bus Stop Timeline ── */}
          {showVehicles && selectedVehicle && (
            <View style={{ flex: 1 }}>
              {/* Orange header */}
              <View style={{
                backgroundColor: BRAND, borderRadius: 16, marginHorizontal: 24,
                paddingHorizontal: 18, paddingVertical: 14, marginBottom: 20,
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: font.bold, fontSize: 16, color: '#fff' }}>
                    Towards {to}
                  </Text>
                  <Text style={{ fontFamily: font.regular, fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
                    {selectedVehicle.plateNumber} · {'driver' in selectedVehicle ? selectedVehicle.driver : ''}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                    setNotifyEnabled(!notifyEnabled)
                  }}
                  activeOpacity={0.7}
                  style={{
                    width: 40, height: 40, borderRadius: 20,
                    backgroundColor: notifyEnabled ? '#fff' : 'rgba(255,255,255,0.2)',
                    justifyContent: 'center', alignItems: 'center',
                  }}
                >
                  <BellRing size={20} color={notifyEnabled ? BRAND : '#fff'} />
                </TouchableOpacity>
              </View>

              {/* Back button */}
              <TouchableOpacity
                onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setSelectedVehicle(null) }}
                style={{ paddingHorizontal: 24, marginBottom: 12 }}
              >
                <Text style={{ fontFamily: font.bold, fontSize: 14, color: BRAND }}>← Back to list</Text>
              </TouchableOpacity>

              {/* ETA headline — live, updates as real driver data arrives */}
              <View style={{ paddingHorizontal: 24, marginBottom: 18 }}>
                <Text style={{ fontFamily: font.extrabold, fontSize: 22, color: '#000', letterSpacing: -0.6 }}>
                  Arrives in ~{destEta} min
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#22c55e' }} />
                  <Text style={{ fontFamily: font.medium, fontSize: 13, color: '#6B7280' }}>
                    Now at {currentStopName} · updates live
                  </Text>
                </View>
              </View>

              {/* Timeline */}
              <View style={{ paddingHorizontal: 24 }}>
                {mockStops.map((stop, i) => {
                  const isLast = i === mockStops.length - 1
                  const isCurrent = 'isCurrent' in stop && stop.isCurrent
                  const isFinal = 'isFinal' in stop && stop.isFinal

                  return (
                    <View key={i} style={{ flexDirection: 'row', minHeight: isLast ? 40 : 52 }}>
                      {/* Timeline column — dot + line */}
                      <View style={{ width: 32, alignItems: 'center' }}>
                        {/* Dot or bus icon */}
                        {isCurrent ? (
                          <View style={{
                            width: 28, height: 28, borderRadius: 14,
                            backgroundColor: BRAND,
                            justifyContent: 'center', alignItems: 'center',
                            shadowColor: BRAND, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 6, elevation: 4,
                          }}>
                            <Bus size={14} color="#fff" />
                          </View>
                        ) : (
                          <View style={{
                            width: 28, height: 28, borderRadius: 14,
                            backgroundColor: stop.passed || isFinal ? BRAND : '#E5E7EB',
                            justifyContent: 'center', alignItems: 'center',
                          }}>
                            <Text style={{ fontFamily: font.bold, fontSize: 11, color: stop.passed || isFinal ? '#fff' : '#9CA3AF' }}>
                              {stop.letter}
                            </Text>
                          </View>
                        )}
                        {/* Vertical line */}
                        {!isLast && (
                          <View style={{
                            width: 3, flex: 1,
                            backgroundColor: stop.passed ? BRAND : '#E5E7EB',
                            marginVertical: 2,
                            borderRadius: 1.5,
                          }} />
                        )}
                      </View>

                      {/* Stop info */}
                      <View style={{
                        flex: 1, marginLeft: 14,
                        paddingBottom: isLast ? 0 : 16,
                        justifyContent: 'center',
                      }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, marginRight: 8 }}>
                            <Text numberOfLines={1} style={{
                              fontFamily: isCurrent || isFinal ? font.extrabold : font.bold,
                              fontSize: isCurrent ? 16 : 15,
                              color: stop.passed || isCurrent || isFinal ? '#000' : '#9CA3AF',
                            }}>
                              {stop.name}
                            </Text>
                            {isFinal && (
                              <View style={{ backgroundColor: '#FFF0EB', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                                <Text style={{ fontFamily: font.bold, fontSize: 10, color: BRAND }}>Your stop</Text>
                              </View>
                            )}
                          </View>
                          <Text style={{
                            fontFamily: font.bold,
                            fontSize: 13,
                            color: isFinal ? BRAND : isCurrent ? '#22c55e' : stop.passed ? '#9CA3AF' : '#6B7280',
                          }}>
                            {stop.passed ? `${stop.minsAgo} min ago` : isCurrent ? 'Here now' : `in ${stop.etaMin} min`}
                          </Text>
                        </View>
                      </View>
                    </View>
                  )
                })}
              </View>

              {/* Notify banner */}
              {notifyEnabled && (
                <View style={{
                  marginHorizontal: 24, marginTop: 20, padding: 14, borderRadius: 14,
                  backgroundColor: '#FFF0EB', flexDirection: 'row', alignItems: 'center', gap: 10,
                }}>
                  <BellRing size={18} color={BRAND} />
                  <Text style={{ fontFamily: font.medium, fontSize: 13, color: BRAND, flex: 1 }}>
                    Arrival alerts are coming soon — we&apos;ll ping your phone when your bus is close
                  </Text>
                </View>
              )}
            </View>
          )}

        </BottomSheetScrollView>
      </BottomSheet>

      {hasStops && (
        <StopPickerModal
          visible={alightPickerOpen}
          title="Where will you alight?"
          stops={stops}
          selectedOrder={effectiveDropoff}
          minOrder={stops[0].stop_order}
          fareLabel={alightFareLabel}
          onSelect={setDropoffOrder}
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
  // Recenter FAB
  fab: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.18, shadowRadius: 8, elevation: 7,
  },
})
