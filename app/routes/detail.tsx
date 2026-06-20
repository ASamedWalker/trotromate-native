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
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { X, Clock, Navigation, Zap, AlertTriangle, Bus, Users, Search, BellRing, Info, ChevronRight } from 'lucide-react-native'
import { font } from '@/lib/theme'
import * as Haptics from 'expo-haptics'
import { FALLBACK_STATION_COORDS } from '@/lib/utils/station-coords'
import { fetchRouteTraffic } from '@/lib/services/traffic-api'
import { useVehiclePositions } from '@/lib/hooks/useVehiclePositions'
import { useLiveTripPositions } from '@/lib/hooks/useLiveTripPositions'
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
    transport_type: string; route_id: string; type: string
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

  // Live vehicles on this route — fallback to mock if none
  const { vehicles: liveVehicles, activeCount, loading: loadingVehicles } = useVehiclePositions(routeId || undefined)

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

  // Smooth camera fly-in
  useEffect(() => {
    if (!hasCoords || !cameraRef.current) return
    // Start zoomed on origin, then fly to fit bounds
    const timer = setTimeout(() => {
      cameraRef.current?.setCamera({
        centerCoordinate: [fromCoord!.lon, fromCoord!.lat],
        zoomLevel: 14,
        animationDuration: 800,
      })
      // Then fit bounds after zoom-in
      setTimeout(() => {
        cameraRef.current?.fitBounds(
          [Math.max(fromCoord!.lon, toCoord!.lon), Math.max(fromCoord!.lat, toCoord!.lat)],
          [Math.min(fromCoord!.lon, toCoord!.lon), Math.min(fromCoord!.lat, toCoord!.lat)],
          [80, 80, 350, 80],
          1200,
        )
      }, 1000)
    }, 400)
    return () => clearTimeout(timer)
  }, [hasCoords])

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

  useEffect(() => {
    if (!fromCoord || !toCoord) return
    const token = 'pk.eyJ1Ijoic2FtcHkxIiwiYSI6ImNranl2NHNjdTAxZzQzMWxldmx5dGhkaDEifQ.1eOzL1554nbXGIPai5Kmlg'
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${fromCoord.lon},${fromCoord.lat};${toCoord.lon},${toCoord.lat}?geometries=geojson&overview=full&access_token=${token}`

    fetch(url)
      .then(r => r.json())
      .then(data => {
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

  // Markers
  const markers = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: [
      fromCoord && { type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [fromCoord.lon, fromCoord.lat] }, properties: { label: from, color: '#22c55e' } },
      toCoord && { type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [toCoord.lon, toCoord.lat] }, properties: { label: to, color: '#ef4444' } },
    ].filter(Boolean) as GeoJSON.Feature[],
  }), [fromCoord, toCoord, from, to])

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

  return (
    <View style={{ flex: 1 }}>

      {/* ── Full screen map ── */}
      <Mapbox.MapView
        style={{ flex: 1 }}
        styleURL="mapbox://styles/mapbox/navigation-day-v1"
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled={false}
        scaleBarEnabled={false}
      >
        <Mapbox.Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: [centerLon, centerLat],
            zoomLevel: hasCoords ? 11 : 12,
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
            style={{ rasterOpacity: 0.6 }}
          />
        </Mapbox.RasterSource>

        {/* Route line — Waze-style: bright blue core, white casing, soft glow */}
        {routeLine && (
          <Mapbox.ShapeSource id="route-line" shape={routeLine}>
            {/* Outer glow */}
            <Mapbox.LineLayer
              id="route-line-shadow"
              style={{
                lineColor: '#1FA2FF',
                lineWidth: 14,
                lineCap: 'round',
                lineJoin: 'round',
                lineOpacity: 0.18,
                lineBlur: 6,              }}
            />
            {/* White casing */}
            <Mapbox.LineLayer
              id="route-line-outline"
              style={{
                lineColor: '#FFFFFF',
                lineWidth: 10,
                lineCap: 'round',
                lineJoin: 'round',
                lineOpacity: 1,              }}
            />
            {/* Bright blue core */}
            <Mapbox.LineLayer
              id="route-line-core"
              style={{
                lineColor: '#1A8CFF',
                lineWidth: 6,
                lineCap: 'round',
                lineJoin: 'round',
                lineOpacity: 1,              }}
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

        {/* Origin + Destination markers */}
        {hasCoords && (
          <Mapbox.ShapeSource id="route-markers" shape={markers}>
            <Mapbox.CircleLayer
              id="marker-outer"
              style={{
                circleRadius: 12,
                circleColor: '#ffffff',
                circleStrokeWidth: 3,
                circleStrokeColor: ['get', 'color'],
                circlePitchAlignment: 'map',
              }}
            />
            <Mapbox.CircleLayer
              id="marker-inner"
              style={{
                circleRadius: 6,
                circleColor: ['get', 'color'],
                circlePitchAlignment: 'map',
              }}
            />
            <Mapbox.SymbolLayer
              id="marker-labels"
              style={{
                textField: ['get', 'label'],
                textSize: 13,
                textFont: ['Open Sans Bold', 'Arial Unicode MS Bold'],
                textOffset: [0, 2.2],
                textAnchor: 'top',
                textColor: '#000000',
                textHaloColor: '#ffffff',
                textHaloWidth: 2,
                textAllowOverlap: true,
              }}
            />
          </Mapbox.ShapeSource>
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

      {/* ── Draggable Bottom Sheet ── */}
      <BottomSheet
        ref={sheetRef}
        index={0}
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

          {/* Headline metrics: duration/arrival + fare/mode */}
          <View style={{ paddingHorizontal: 24, marginBottom: 18, flexDirection: 'row', alignItems: 'flex-end' }}>
            <View>
              <Text style={{ fontFamily: font.extrabold, fontSize: 28, color: '#000', letterSpacing: -1 }}>{durationText}</Text>
              <Text style={{ fontFamily: font.medium, fontSize: 13, color: '#9CA3AF', marginTop: 2 }}>arrives {arrivalTime}</Text>
            </View>
            <View style={{ marginLeft: 'auto', alignItems: 'flex-end' }}>
              <Text style={{ fontFamily: font.extrabold, fontSize: 28, color: BRAND, letterSpacing: -1 }}>₵{selectedFare}</Text>
              <Text style={{ fontFamily: font.medium, fontSize: 13, color: '#9CA3AF', marginTop: 2 }}>{selectedOption.label} fare</Text>
            </View>
          </View>

          {/* Live corridor pill — riders in GO Mode are sharing this route */}
          {liveTrips.length > 0 && (
            <View style={{ paddingHorizontal: 24, marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', backgroundColor: 'rgba(255,77,28,0.1)', borderRadius: 100, paddingHorizontal: 14, paddingVertical: 8 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: BRAND }} />
                <Text style={{ fontFamily: font.bold, fontSize: 13, color: BRAND }}>
                  {liveTrips.length} trotro{liveTrips.length !== 1 ? 's' : ''} live on this route
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
                router.push({ pathname: '/booking/checkout', params: { from, to, route_id: routeId } } as any)
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
    </View>
  )
}
